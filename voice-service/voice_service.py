#!/usr/bin/env python3
"""
File: voice-service/voice_service.py

Python backend service for voice processing using:
- Faster-Whisper (STT) - Fast, lightweight transcription
- VibeVoice-ASR (STT) - Microsoft's long-form ASR with speaker diarization
- Piper (TTS) - Text-to-speech synthesis

This service provides HTTP endpoints for speech-to-text and text-to-speech operations.
"""

import json
import os
import sys
import base64
import tempfile
import argparse
from pathlib import Path
from typing import Optional, Dict, Any
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import io
import threading


try:
    from faster_whisper import WhisperModel
    import numpy as np
    import soundfile as sf
    FASTER_WHISPER_AVAILABLE = True
except ImportError as e:
    print(f"Warning: faster-whisper not available: {e}")
    FASTER_WHISPER_AVAILABLE = False
    WhisperModel = None
    np = None
    sf = None

# Try to import VibeVoice-ASR dependencies
VIBEVOICE_AVAILABLE = False
vibevoice_model = None
vibevoice_processor = None
vibevoice_lock = threading.Lock()

try:
    import torch
    import torchaudio
    from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, TextIteratorStreamer
    VIBEVOICE_AVAILABLE = True
except ImportError as e:
    print(f"Warning: VibeVoice-ASR dependencies not available: {e}")
    torch = None
    torchaudio = None

# Global model instances
whisper_model: Optional[WhisperModel] = None
model_lock = threading.Lock()
piper_available = False

# Try to import Piper
try:
    import subprocess
    piper_available = True
except ImportError:
    piper_available = False


class VoiceServiceHandler(BaseHTTPRequestHandler):
    """HTTP request handler for voice service endpoints."""
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        """Handle POST requests for voice processing."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        try:
            if path == '/transcribe':
                self.handle_transcribe(body)
            elif path == '/synthesize':
                self.handle_synthesize(body)
            elif path == '/health':
                self.handle_health()
            else:
                self.send_error(404, "Not Found")
        except Exception as e:
            self.send_error(500, f"Internal Server Error: {str(e)}")
    
    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == '/health':
            self.handle_health()
        else:
            self.send_error(404, "Not Found")
    
    def handle_transcribe(self, body: bytes):
        """Handle speech-to-text transcription. Routes to appropriate provider."""
        try:
            # Parse request
            data = json.loads(body.decode('utf-8'))
            provider = data.get('provider', 'faster-whisper')  # Default to faster-whisper
            
            if provider == 'vibevoice' or provider == 'vibevoice-asr':
                self.handle_transcribe_vibevoice(data)
            else:
                self.handle_transcribe_whisper(data)
                
        except json.JSONDecodeError as e:
            self.send_error(400, f"Invalid JSON in request: {str(e)}")
        except Exception as e:
            self.send_error(500, f"Transcription error: {str(e)}")
    
    def handle_transcribe_vibevoice(self, data: Dict[str, Any]):
        """Handle transcription using Microsoft VibeVoice-ASR."""
        global vibevoice_model, vibevoice_processor
        
        if not VIBEVOICE_AVAILABLE:
            self.send_error(503, "VibeVoice-ASR not available. Please install: pip install transformers torch torchaudio")
            return
        
        try:
            audio_data = data.get('audio')
            hotwords = data.get('hotwords', [])  # Custom terms for accuracy
            enable_diarization = data.get('enable_diarization', True)
            stream = data.get('stream', False)
            
            if not audio_data:
                self.send_error(400, "Missing audio data")
                return
            
            # Decode base64 audio
            audio_bytes = base64.b64decode(audio_data)
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_path = tmp_file.name
            
            try:
                # Initialize VibeVoice model if needed (with GPU detection)
                if vibevoice_model is None:
                    with vibevoice_lock:
                        if vibevoice_model is None:
                            print("Loading VibeVoice-ASR model (this may take a moment on first run)...")
                            device = "cuda" if torch.cuda.is_available() else "cpu"
                            dtype = torch.float16 if device == "cuda" else torch.float32
                            
                            vibevoice_processor = AutoProcessor.from_pretrained(
                                "microsoft/VibeVoice-ASR",
                                trust_remote_code=True
                            )
                            vibevoice_model = AutoModelForSpeechSeq2Seq.from_pretrained(
                                "microsoft/VibeVoice-ASR",
                                torch_dtype=dtype,
                                low_cpu_mem_usage=True,
                                trust_remote_code=True
                            ).to(device)
                            print(f"VibeVoice-ASR loaded on {device}!")
                
                # Load and preprocess audio
                waveform, sample_rate = torchaudio.load(tmp_path)
                
                # Resample to 16kHz if needed (VibeVoice expects 16kHz)
                if sample_rate != 16000:
                    resampler = torchaudio.transforms.Resample(sample_rate, 16000)
                    waveform = resampler(waveform)
                    sample_rate = 16000
                
                # Convert to mono if stereo
                if waveform.shape[0] > 1:
                    waveform = torch.mean(waveform, dim=0, keepdim=True)
                
                # Prepare inputs with hotwords if provided
                prompt = ""
                if hotwords:
                    prompt = f"Context: {', '.join(hotwords)}. "
                
                # Process with VibeVoice
                device = vibevoice_model.device
                inputs = vibevoice_processor(
                    waveform.squeeze().numpy(),
                    sampling_rate=sample_rate,
                    return_tensors="pt"
                ).to(device)
                
                if stream:
                    # Streaming mode
                    streamer = TextIteratorStreamer(vibevoice_processor.tokenizer, skip_special_tokens=True)
                    generation_kwargs = dict(inputs, streamer=streamer, max_length=8192, num_beams=5, do_sample=False)
                    
                    thread = threading.Thread(target=vibevoice_model.generate, kwargs=generation_kwargs)
                    thread.start()
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/x-ndjson')
                    self.send_header('Cache-Control', 'no-cache')
                    self.end_headers()
                    
                    full_text = ""
                    for new_text in streamer:
                        full_text += new_text
                        # Send simplified token event
                        chunk = {"type": "token", "text": new_text}
                        self.wfile.write((json.dumps(chunk) + "\n").encode('utf-8'))
                        self.wfile.flush()
                        
                    # Parse segments for "done" event (diarization)
                    segments = self.parse_vibevoice_output(full_text, enable_diarization)
                    
                    result = {
                        "type": "done",
                        "text": full_text.strip(),
                        "segments": segments,
                        "speakers": list(set([s.get('speaker') for s in segments if s.get('speaker')])),
                        "provider": "vibevoice-asr"
                    }
                    self.wfile.write((json.dumps(result) + "\n").encode('utf-8'))
                    self.wfile.flush()
                    
                else:
                    # Non-streaming mode (Existing)
                    with torch.no_grad():
                        generated_ids = vibevoice_model.generate(
                            **inputs,
                            max_length=8192,
                            num_beams=5,
                            do_sample=False
                        )
                    
                    # Decode output
                    transcription = vibevoice_processor.batch_decode(
                        generated_ids,
                        skip_special_tokens=True
                    )[0]
                    
                    # Parse structured output (VibeVoice returns Who/When/What format)
                    segments = self.parse_vibevoice_output(transcription, enable_diarization)
                    
                    # Extract plain text
                    full_text = " ".join([s.get('text', '') for s in segments])
                    
                    response = {
                        'success': True,
                        'text': full_text.strip(),
                        'provider': 'vibevoice-asr',
                        'segments': segments,
                        'language': 'auto',  # VibeVoice auto-detects
                        'language_probability': 1.0,
                        'speakers': list(set([s.get('speaker') for s in segments if s.get('speaker')]))
                    }
                    
                    self.send_json_response(response)
                
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    
        except Exception as e:
            error_msg = str(e)
            if "out of memory" in error_msg.lower():
                error_msg = "GPU out of memory. Try shorter audio or use CPU mode."
            elif "model" in error_msg.lower() and "download" in error_msg.lower():
                error_msg = "VibeVoice model downloading... Please try again in a few minutes."
            
            # Use simple print as fallback if streaming already started
            if stream:
                 print(f"Streaming error: {error_msg}")
            else:
                 self.send_error(500, f"VibeVoice transcription error: {error_msg}")
    
    def parse_vibevoice_output(self, transcription: str, include_diarization: bool) -> list:
        """Parse VibeVoice structured output into segments."""
        segments = []
        
        # VibeVoice outputs structured format like:
        # [Speaker 1] (0:00-0:05): Hello, how are you?
        # [Speaker 2] (0:05-0:08): I'm doing great!
        
        import re
        pattern = r'\[([^\]]+)\]\s*\((\d+:\d+)-(\d+:\d+)\):\s*(.+?)(?=\[|$)'
        matches = re.findall(pattern, transcription, re.DOTALL)
        
        if matches:
            for match in matches:
                speaker, start_time, end_time, text = match
                
                # Parse timestamps (MM:SS format to seconds)
                def parse_time(t):
                    parts = t.split(':')
                    if len(parts) == 2:
                        return int(parts[0]) * 60 + int(parts[1])
                    return 0
                
                segment = {
                    'text': text.strip(),
                    'start': parse_time(start_time),
                    'end': parse_time(end_time),
                    'confidence': 0.95
                }
                
                if include_diarization:
                    segment['speaker'] = speaker.strip()
                
                segments.append(segment)
        else:
            # Fallback: treat entire transcription as single segment
            segments.append({
                'text': transcription.strip(),
                'start': 0.0,
                'end': 0.0,
                'confidence': 0.9
            })
        
        return segments
    
    def handle_transcribe_whisper(self, data: Dict[str, Any]):
        """Handle speech-to-text transcription using Faster-Whisper."""
        global whisper_model
        
        if not FASTER_WHISPER_AVAILABLE:
            self.send_error(503, "Faster-Whisper not available. Please install: pip install faster-whisper")
            return
        
        try:
            audio_data = data.get('audio')
            language = data.get('language', 'en')
            if language and '-' in language:
                language = language.split('-')[0]
            model_size = data.get('model_size', 'base')
            device = data.get('device', 'cpu')
            compute_type = data.get('compute_type', 'int8')
            stream = data.get('stream', False)
            
            if not audio_data:
                self.send_error(400, "Missing audio data")
                return
            
            # Decode base64 audio
            audio_bytes = base64.b64decode(audio_data)
            
            # Save to temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp_file:
                tmp_file.write(audio_bytes)
                tmp_path = tmp_file.name
            
            try:
                # Initialize model if needed ensures thread safety
                if whisper_model is None:
                    with model_lock:
                        if whisper_model is None:
                            print(f"Initializing Whisper model ({model_size}) on demand...")
                            whisper_model = WhisperModel(
                                model_size,
                                device=device,
                                compute_type=compute_type
                            )
                            print("Whisper model loaded!")
                
                # Transcribe
                segments, info = whisper_model.transcribe(
                    tmp_path,
                    language=language if language != 'auto' else None,
                    beam_size=5,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500)
                )

                if stream:
                    # Streaming mode
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/x-ndjson')
                    self.send_header('Cache-Control', 'no-cache')
                    self.end_headers()
                    
                    # Send info first
                    start_evt = {
                        "type": "start",
                        "language": info.language,
                        "language_probability": info.language_probability
                    }
                    self.wfile.write((json.dumps(start_evt) + "\n").encode('utf-8'))
                    self.wfile.flush()
                    
                    full_text = ""
                    all_segments = []
                    
                    for segment in segments:
                        chunk = {
                            "type": "segment",
                            "text": segment.text.strip(),
                            "start": segment.start,
                            "end": segment.end
                        }
                        self.wfile.write((json.dumps(chunk) + "\n").encode('utf-8'))
                        self.wfile.flush()
                        
                        full_text += segment.text.strip() + " "
                        all_segments.append(chunk)
                    
                    # Done event
                    done_evt = {
                        "type": "done",
                        "text": full_text.strip(),
                        "language": info.language,
                        "segments": all_segments,
                        "provider": "faster-whisper"
                    }
                    self.wfile.write((json.dumps(done_evt) + "\n").encode('utf-8'))
                    self.wfile.flush()
                    
                else:
                    # Non-streaming mode (Existing)
                    # Collect results
                    full_text = ""
                    segments_list = []
                    for segment in segments:
                        segments_list.append({
                            'start': segment.start,
                            'end': segment.end,
                            'text': segment.text.strip(),
                            'confidence': getattr(segment, 'confidence', 0.0)
                        })
                        full_text += segment.text.strip() + " "
                    
                    # Send response
                    response = {
                        'success': True,
                        'text': full_text.strip(),
                        'provider': 'faster-whisper',
                        'language': info.language,
                        'language_probability': info.language_probability,
                        'segments': segments_list
                    }
                    
                    self.send_json_response(response)
                
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    
        except base64.binascii.Error as e:
            self.send_error(400, f"Invalid base64 audio data: {str(e)}")
        except ImportError as e:
            self.send_error(500, f"Whisper model not available: {str(e)}. Please ensure faster-whisper is installed.")
        except Exception as e:
            error_msg = str(e)
            # Provide more helpful error messages
            if "model" in error_msg.lower() and ("not found" in error_msg.lower() or "load" in error_msg.lower()):
                error_msg = f"Whisper model error: {error_msg}. The model may still be loading or not installed correctly."
            elif "cuda" in error_msg.lower() or "gpu" in error_msg.lower():
                error_msg = f"GPU/CUDA error: {error_msg}. Try using CPU device instead."
            elif "memory" in error_msg.lower():
                error_msg = f"Memory error: {error_msg}. Try using a smaller model size or reducing audio length."
            
            try:
                self.send_error(500, f"Transcription error: {error_msg}")
            except:
                print(f"Failed to send error response (streaming started?): {error_msg}")
    
    def handle_synthesize(self, body: bytes):
        """Handle text-to-speech synthesis using Piper."""
        try:
            # Parse request
            data = json.loads(body.decode('utf-8'))
            text = data.get('text', '')
            voice = data.get('voice', 'en_US-lessac-medium')
            speed = data.get('speed', 1.0)
            
            if not text:
                self.send_error(400, "Missing text")
                return
            
            # Find voice model file
            voice_path = self.find_voice_model(voice)
            if not voice_path:
                self.send_error(404, f"Voice model '{voice}' not found. Please download and place in voices directory.")
                return
            
            # Try to use piper via python library first
            try:
                audio_data = self.synthesize_with_piper_lib(text, voice, speed)
                if audio_data:
                    response = {
                        'success': True,
                        'audio': base64.b64encode(audio_data).decode('utf-8'),
                        'format': 'wav'
                    }
                    self.send_json_response(response)
                    return
            except Exception as e:
                print(f"Piper library synthesis failed, trying command line: {e}")
            
            # Fallback: Use Piper TTS via command line
            # Try to find piper executable
            piper_paths = [
                'piper',
                '/usr/local/bin/piper',
                os.path.expanduser('~/.local/bin/piper'),
            ]
            
            piper_executable = None
            for path in piper_paths:
                if os.path.exists(path) or self.command_exists(path):
                    piper_executable = path
                    break
            
            if not piper_executable:
                self.send_error(503, "Piper TTS not available. Please install piper and ensure it's in PATH.")
                return
            
            # Piper command: piper --model <model_path> --output_file -
            piper_cmd = [
                piper_executable,
                '--model', voice_path,
                '--output_file', '-'  # Output to stdout
            ]
            
            # Run piper command
            try:
                process = subprocess.Popen(
                    piper_cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    timeout=30  # 30 second timeout
                )
                
                stdout, stderr = process.communicate(input=text.encode('utf-8'), timeout=30)
                
                if process.returncode != 0:
                    error_msg = stderr.decode('utf-8') if stderr else "Unknown error"
                    self.send_error(500, f"Piper synthesis error: {error_msg}")
                    return
                
                if not stdout or len(stdout) == 0:
                    self.send_error(500, "Piper returned empty audio")
                    return
                
                # Encode audio to base64
                audio_b64 = base64.b64encode(stdout).decode('utf-8')
                
                response = {
                    'success': True,
                    'audio': audio_b64,
                    'format': 'wav'
                }
                
                self.send_json_response(response)
            except subprocess.TimeoutExpired:
                process.kill()
                self.send_error(500, "Piper synthesis timed out")
            except Exception as e:
                self.send_error(500, f"Piper execution error: {str(e)}")
            
        except Exception as e:
            self.send_error(500, f"Synthesis error: {str(e)}")
    
    def synthesize_with_piper_lib(self, text: str, voice: str, speed: float) -> Optional[bytes]:
        """Synthesize using piper-tts Python library if available."""
        try:
            # Try different import methods
            try:
                from piper import PiperVoice
            except ImportError:
                try:
                    import piper_tts
                    from piper_tts import PiperVoice
                except ImportError:
                    return None
            
            # Load voice model
            voice_path = self.find_voice_model(voice)
            if not voice_path:
                return None
            
            voice_model = PiperVoice.load(voice_path)
            
            # Synthesize (speed parameter may vary by library version)
            try:
                audio_stream = voice_model.synthesize(text, speed=speed)
            except TypeError:
                # Some versions don't support speed parameter
                audio_stream = voice_model.synthesize(text)
            
            # Collect audio data
            if hasattr(audio_stream, '__iter__'):
                audio_data = b''.join(audio_stream)
            else:
                audio_data = audio_stream
            
            return audio_data
        except Exception as e:
            print(f"Piper library synthesis error: {e}")
            return None
    
    def find_voice_model(self, voice_name: str) -> Optional[str]:
        """Find Piper voice model file."""
        # Common locations for Piper models
        search_paths = [
            os.path.expanduser('~/.local/share/piper/voices'),
            '/usr/local/share/piper/voices',
            './voices',
            './piper-voices'
        ]
        
        for base_path in search_paths:
            if not os.path.exists(base_path):
                continue
            
            # Look for .onnx file
            voice_file = os.path.join(base_path, f'{voice_name}.onnx')
            if os.path.exists(voice_file):
                return voice_file
            
            # Look in subdirectories
            for root, dirs, files in os.walk(base_path):
                for file in files:
                    if file == f'{voice_name}.onnx':
                        return os.path.join(root, file)
        
        return None
    
    def command_exists(self, command: str) -> bool:
        """Check if a command exists in PATH."""
        try:
            result = subprocess.run(
                ['which', command] if sys.platform != 'win32' else ['where', command],
                capture_output=True,
                timeout=1
            )
            return result.returncode == 0
        except:
            return False
    
    def handle_health(self):
        """Handle health check requests."""
        response = {
            'status': 'healthy',
            'whisper_available': whisper_model is not None or FASTER_WHISPER_AVAILABLE,
            'vibevoice_available': vibevoice_model is not None or VIBEVOICE_AVAILABLE,
            'piper_available': piper_available or self.command_exists('piper'),
            'service': 'voice-service',
            'providers': {
                'faster-whisper': {
                    'available': FASTER_WHISPER_AVAILABLE,
                    'loaded': whisper_model is not None
                },
                'vibevoice-asr': {
                    'available': VIBEVOICE_AVAILABLE,
                    'loaded': vibevoice_model is not None
                }
            }
        }
        self.send_json_response(response)
    
    def send_json_response(self, data: Dict[str, Any]):
        """Send JSON response."""
        response_json = json.dumps(data)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(response_json)))
        self.end_headers()
        self.wfile.write(response_json.encode('utf-8'))
    
    def log_message(self, format, *args):
        """Override to reduce logging noise."""
        # Only log errors
        is_error = 'error' in format.lower()
        
        # Check if status code indicates error (4xx or 5xx)
        if args and len(args) > 0:
            status_arg = args[0]
            # Handle case where status code is first arg (log_error)
            if isinstance(status_arg, int):
                if status_arg >= 400:
                    is_error = True
            # Handle case where status code is second arg (log_request)
            elif len(args) > 1:
                try:
                    code = int(args[1])
                    if code >= 400:
                        is_error = True
                except (ValueError, TypeError):
                    pass
        
        if is_error:
            super().log_message(format, *args)


def main():
    """Main entry point for voice service."""
    parser = argparse.ArgumentParser(description='Voice Service (Faster-Whisper + Piper)')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', type=int, default=8765, help='Port to bind to')
    parser.add_argument('--model-size', default='base', 
                       choices=['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3'],
                       help='Whisper model size')
    parser.add_argument('--device', default='cpu', choices=['cpu', 'cuda'],
                       help='Device to use for Whisper')
    parser.add_argument('--compute-type', default='int8',
                       choices=['int8', 'int8_float16', 'int16', 'float16', 'float32'],
                       help='Compute type for Whisper')
    
    args = parser.parse_args()
    
    # Pre-load Whisper model in background
    def load_model_bg():
        global whisper_model
        with model_lock:
            if whisper_model is not None:
                return
                
            print(f"Loading Whisper model ({args.model_size}) in background...")
            try:
                whisper_model = WhisperModel(
                    args.model_size,
                    device=args.device,
                    compute_type=args.compute_type
                )
                print("Whisper model loaded successfully!")
            except Exception as e:
                print(f"Warning: Could not pre-load Whisper model: {e}")
                print("Model will be loaded on first transcription request.")

    # Start background loading
    threading.Thread(target=load_model_bg, daemon=True).start()
    
    class VoiceHTTPServer(HTTPServer):
        allow_reuse_address = True

    # Start HTTP server
    server_address = (args.host, args.port)
    httpd = VoiceHTTPServer(server_address, VoiceServiceHandler)
    
    print(f"Voice Service running on http://{args.host}:{args.port}")
    print("Endpoints:")
    print("  POST /transcribe - Speech-to-text")
    print("  POST /synthesize - Text-to-speech")
    print("  GET  /health - Health check")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down voice service...")
        httpd.shutdown()


if __name__ == '__main__':
    main()

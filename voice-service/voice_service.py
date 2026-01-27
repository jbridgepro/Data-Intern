#!/usr/bin/env python3
"""
File: voice-service/voice_service.py

Python backend service for voice processing using Faster-Whisper (STT) and Piper (TTS).
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
except ImportError as e:
    print(f"Error importing dependencies: {e}")
    print("Please install: pip install faster-whisper soundfile numpy")
    sys.exit(1)

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
        """Handle speech-to-text transcription using Faster-Whisper."""
        global whisper_model
        
        try:
            # Parse request
            data = json.loads(body.decode('utf-8'))
            audio_data = data.get('audio')
            language = data.get('language', 'en')
            if language and '-' in language:
                language = language.split('-')[0]
            model_size = data.get('model_size', 'base')
            device = data.get('device', 'cpu')
            compute_type = data.get('compute_type', 'int8')
            
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
                    'language': info.language,
                    'language_probability': info.language_probability,
                    'segments': segments_list
                }
                
                self.send_json_response(response)
                
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
                    
        except json.JSONDecodeError as e:
            self.send_error(400, f"Invalid JSON in request: {str(e)}")
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
            self.send_error(500, f"Transcription error: {error_msg}")
    
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
            'whisper_available': whisper_model is not None,
            'piper_available': piper_available or self.command_exists('piper'),
            'service': 'voice-service'
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

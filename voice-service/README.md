# Voice Service - Faster-Whisper + Piper Integration

**File: voice-service/README.md**

Complete voice solution stack using Faster-Whisper for speech-to-text (STT) and Piper for text-to-speech (TTS), integrated with Ollama for LLM processing.

## Overview

This voice service provides high-quality, fast, and resource-efficient voice processing capabilities:

- **Faster-Whisper**: Fast and accurate speech-to-text transcription
- **Piper**: High-quality, low-latency text-to-speech synthesis
- **Ollama**: Already integrated for LLM processing (see `src/features/ai-assistant/utils/ollamaService.ts`)

## Installation

### 1. Install Python Dependencies

```bash
cd voice-service
pip install -r requirements.txt
```

### 2. Install Piper TTS

Piper can be installed in several ways:

#### Option A: Using Pre-built Binaries

Download from [Piper releases](https://github.com/rhasspy/piper/releases) and place the executable in your PATH.

#### Option B: Using Python Package (if available)

```bash
pip install piper-tts
```

#### Option C: Build from Source

See [Piper documentation](https://github.com/rhasspy/piper) for build instructions.

### 3. Download Piper Voice Models

Download voice models from [Piper voices](https://github.com/rhasspy/piper/releases/tag/v1.2.0) and place them in one of these locations:

- `~/.local/share/piper/voices/`
- `/usr/local/share/piper/voices/`
- `./voices/` (relative to voice-service directory)
- `./piper-voices/` (relative to voice-service directory)

Recommended voice: `en_US-lessac-medium` (English, US, Lessac, Medium quality)

## Usage

### Starting the Service

```bash
python3 voice_service.py --host 127.0.0.1 --port 8765 --model-size base
```

Options:

- `--host`: Host to bind to (default: 127.0.0.1)
- `--port`: Port to bind to (default: 8765)
- `--model-size`: Whisper model size - `tiny`, `base`, `small`, `medium`, `large-v2`, `large-v3` (default: base)
- `--device`: Device to use - `cpu` or `cuda` (default: cpu)
- `--compute-type`: Compute type - `int8`, `int8_float16`, `int16`, `float16`, `float32` (default: int8)

### API Endpoints

#### POST /transcribe

Transcribe audio to text using Faster-Whisper.

**Request:**

```json
{
  "audio": "base64-encoded-wav-audio",
  "language": "en",
  "model_size": "base",
  "device": "cpu",
  "compute_type": "int8"
}
```

**Response:**

```json
{
  "success": true,
  "text": "Transcribed text here",
  "language": "en",
  "language_probability": 0.99,
  "segments": [
    {
      "start": 0.0,
      "end": 2.5,
      "text": "Transcribed text",
      "confidence": 0.95
    }
  ]
}
```

#### POST /synthesize

Synthesize text to speech using Piper.

**Request:**

```json
{
  "text": "Text to speak",
  "voice": "en_US-lessac-medium",
  "speed": 1.0
}
```

**Response:**

```json
{
  "success": true,
  "audio": "base64-encoded-wav-audio",
  "format": "wav"
}
```

#### GET /health

Check service health and availability.

**Response:**

```json
{
  "status": "healthy",
  "whisper_available": true,
  "piper_available": true,
  "service": "voice-service"
}
```

## Integration with Tauri App

The voice service is automatically integrated into the Tauri application:

1. **Backend (Rust)**: Tauri commands in `src-tauri/src/voice_service.rs` communicate with the Python service
2. **Frontend (TypeScript)**: Updated `voiceService.ts` uses Faster-Whisper and Piper via Tauri commands
3. **Audio Recording**: `audioRecorder.ts` handles microphone input and converts to WAV format

### Configuration

Voice settings can be configured in the app's voice settings panel:

- **Provider**: Select "faster-whisper" for STT
- **Voice Service URL**: Default is `http://127.0.0.1:8765`
- **Whisper Model Size**: Choose based on accuracy vs. speed tradeoff
- **Piper Voice**: Select voice model name (e.g., `en_US-lessac-medium`)

## Performance Considerations

### Faster-Whisper Model Sizes

- **tiny**: Fastest, lowest accuracy (~39M parameters)
- **base**: Good balance (~74M parameters) - **Recommended**
- **small**: Better accuracy (~244M parameters)
- **medium**: High accuracy (~769M parameters)
- **large-v2/v3**: Best accuracy (~1550M parameters), slowest

### Device Selection

- **CPU**: Works everywhere, slower
- **CUDA**: Much faster if NVIDIA GPU available

### Compute Types

- **int8**: Fastest, good quality (recommended for CPU)
- **float16**: Better quality, requires CUDA
- **float32**: Best quality, slowest

## Troubleshooting

### Service Not Starting

1. Check Python version: `python3 --version` (requires 3.8+)
2. Verify dependencies: `pip list | grep faster-whisper`
3. Check port availability: `lsof -i :8765`

### Transcription Errors

1. Ensure audio is in WAV format, 16kHz, mono
2. Check Whisper model is downloaded (first run downloads automatically)
3. Verify sufficient disk space for model cache

### Synthesis Errors

1. Verify Piper is installed: `which piper` or `piper --version`
2. Check voice model exists in expected locations
3. Ensure voice model name matches exactly (case-sensitive)

### Connection Issues

1. Verify service is running: `curl http://127.0.0.1:8765/health`
2. Check firewall settings
3. Verify Tauri can access localhost

## Architecture

```
┌─────────────────┐
│  Frontend (TS)  │
│  voiceService.ts│
└────────┬─────────┘
         │
         │ Tauri Commands
         │
┌────────▼─────────┐
│  Backend (Rust)  │
│ voice_service.rs │
└────────┬─────────┘
         │
         │ HTTP
         │
┌────────▼─────────┐
│ Python Service   │
│ voice_service.py │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼───┐
│Faster-│ │Piper │
│Whisper│ │ TTS  │
└───────┘ └──────┘
```

## Best Practices

1. **Start with base model**: Good balance of speed and accuracy
2. **Use int8 on CPU**: Best performance without GPU
3. **Pre-load model**: Service pre-loads on startup for faster first transcription
4. **Monitor resources**: Larger models use more RAM/VRAM
5. **Cache models**: Faster-Whisper caches models automatically

## License

This service integrates:

- Faster-Whisper: MIT License
- Piper: MIT License
- Ollama: MIT License

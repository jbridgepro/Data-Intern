# Quick Start Guide - Voice Service

**File: voice-service/QUICKSTART.md**

Get up and running with Faster-Whisper + Piper voice service in 5 minutes.

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Microphone access (for STT)
- Audio output (for TTS)

## Installation Steps

### 1. Install Python Dependencies

```bash
cd voice-service
pip3 install -r requirements.txt
```

This installs:

- `faster-whisper` - Fast speech-to-text
- `soundfile` - Audio file handling
- `numpy` - Numerical operations

### 2. Install Piper TTS

**Option A: Download Pre-built Binary (Recommended)**

1. Visit [Piper releases](https://github.com/rhasspy/piper/releases)
2. Download the binary for your OS
3. Extract and add to PATH, or place in `voice-service/` directory

**Option B: Use Setup Script**

```bash
./setup.sh
```

The script will check for Piper and guide you through installation.

### 3. Download Voice Model

Download a Piper voice model:

```bash
# Example: Download English US voice
mkdir -p voices
cd voices
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
```

Or visit: https://huggingface.co/rhasspy/piper-voices

## Starting the Service

### Basic Start

```bash
python3 voice_service.py
```

This starts the service on `http://127.0.0.1:8765` with default settings.

### Custom Configuration

```bash
python3 voice_service.py \
  --host 127.0.0.1 \
  --port 8765 \
  --model-size base \
  --device cpu \
  --compute-type int8
```

### Model Size Options

- `tiny` - Fastest, ~39M params (good for testing)
- `base` - Balanced, ~74M params (**recommended**)
- `small` - Better accuracy, ~244M params
- `medium` - High accuracy, ~769M params
- `large-v2` - Best accuracy, ~1550M params (slow)

## Testing the Service

### Health Check

```bash
curl http://127.0.0.1:8765/health
```

Expected response:

```json
{
  "status": "healthy",
  "whisper_available": true,
  "piper_available": true,
  "service": "voice-service"
}
```

### Test Transcription

```bash
# Record a short audio file (WAV format, 16kHz, mono)
# Then encode to base64 and send:

curl -X POST http://127.0.0.1:8765/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "audio": "base64-encoded-audio-here",
    "language": "en"
  }'
```

### Test Synthesis

```bash
curl -X POST http://127.0.0.1:8765/synthesize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test.",
    "voice": "en_US-lessac-medium",
    "speed": 1.0
  }'
```

## Integration with App

The voice service is automatically integrated into the Tauri app:

1. **Start the service** (see above)
2. **Open the app** and go to Voice Settings
3. **Select provider**: Choose "faster-whisper"
4. **Configure settings**:
   - Voice Service URL: `http://127.0.0.1:8765`
   - Whisper Model Size: `base` (recommended)
   - Piper Voice: `en_US-lessac-medium`
5. **Test**: Click the microphone button and speak

## Troubleshooting

### "Cannot connect to voice service"

- Ensure service is running: `curl http://127.0.0.1:8765/health`
- Check firewall settings
- Verify port 8765 is not in use: `lsof -i :8765`

### "Piper TTS not available"

- Verify Piper is installed: `which piper`
- Check voice model exists in expected location
- Try downloading voice model again

### "Failed to access microphone"

- Grant microphone permissions in system settings
- Check browser/app permissions
- Verify microphone is not in use by another app

### Slow Transcription

- Use smaller model size (`tiny` or `base`)
- Use `int8` compute type on CPU
- Consider using CUDA if GPU available: `--device cuda`

## Performance Tips

1. **First run is slow**: Models download on first use (~150MB for base)
2. **Pre-load model**: Service pre-loads on startup for faster response
3. **Use base model**: Best balance of speed and accuracy
4. **CPU optimization**: Use `int8` compute type for best CPU performance
5. **GPU acceleration**: Use `cuda` device if NVIDIA GPU available

## Next Steps

- Read full documentation: [README.md](./README.md)
- Explore voice models: https://huggingface.co/rhasspy/piper-voices
- Customize settings in app voice panel
- Integrate with Ollama for LLM processing (already configured)

## Support

For issues:

1. Check service logs in terminal
2. Verify all dependencies installed
3. Test with health endpoint
4. Review [README.md](./README.md) for detailed troubleshooting

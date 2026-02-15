#!/bin/bash
# File: voice-service/setup.sh
#
# Setup script for voice service (Faster-Whisper + Piper)

set -e

echo "Setting up Voice Service (Faster-Whisper + Piper)..."
echo ""

# Check Python version
echo "Checking Python version..."
python3 --version || {
    echo "Error: Python 3 is required but not found."
    exit 1
}

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
pip3 install -r requirements.txt || {
    echo "Error: Failed to install Python dependencies."
    exit 1
}

# Check if Piper is available
echo ""
echo "Checking for Piper TTS..."
if command -v piper &> /dev/null; then
    echo "✓ Piper found: $(which piper)"
    piper --version || echo "  (version check failed)"
else
    echo "⚠ Piper not found in PATH"
    echo "  Please install Piper:"
    echo "  - Download from: https://github.com/rhasspy/piper/releases"
    echo "  - Or build from source: https://github.com/rhasspy/piper"
    echo ""
    echo "  Voice models can be downloaded from:"
    echo "  https://github.com/rhasspy/piper/releases/tag/v1.2.0"
    echo ""
    echo "  Place voice models in one of:"
    echo "  - ~/.local/share/piper/voices/"
    echo "  - /usr/local/share/piper/voices/"
    echo "  - ./voices/ (relative to voice-service directory)"
fi

# Test Faster-Whisper import
echo ""
echo "Testing Faster-Whisper..."
python3 -c "from faster_whisper import WhisperModel; print('✓ Faster-Whisper is available')" || {
    echo "Error: Faster-Whisper import failed"
    exit 1
}

echo ""
echo "✓ Setup complete!"
echo ""
echo "To start the voice service:"
echo "  python3 voice_service.py --host 127.0.0.1 --port 8765 --model-size base"
echo ""
echo "Or use the default settings:"
echo "  python3 voice_service.py"

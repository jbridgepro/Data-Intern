# Complete Voice Solution Stack Integration

**File: VOICE_STACK_INTEGRATION.md**

This document describes the complete voice solution stack integration using Faster-Whisper, Ollama, and Piper for optimal speed, quality, and resource usage.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/TS)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  VoiceControlPanel.tsx                                │   │
│  │  - UI controls for voice interaction                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  voiceService.ts                                       │   │
│  │  - Manages voice providers                            │   │
│  │  - Handles Faster-Whisper & Piper integration        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  audioRecorder.ts                                     │   │
│  │  - Captures microphone input                          │   │
│  │  - Converts to WAV format                              │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Tauri Commands
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                  Backend (Rust/Tauri)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  voice_service.rs                                     │   │
│  │  - Tauri commands for voice operations               │   │
│  │  - HTTP client for Python service                    │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP (localhost:8765)
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Python Voice Service                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  voice_service.py                                    │   │
│  │  - HTTP server for voice processing                  │   │
│  │  - Faster-Whisper integration (STT)                  │   │
│  │  - Piper integration (TTS)                            │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
    ┌───────▼────────┐      ┌───────▼────────┐
    │ Faster-Whisper │      │    Piper      │
    │     (STT)      │      │     (TTS)     │
    └────────────────┘      └───────────────┘
            │
            │ (Text Output)
            │
┌───────────▼───────────────────────────────────────────────────┐
│                    Ollama LLM Service                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ollamaService.ts                                      │   │
│  │  - Processes transcribed text                         │   │
│  │  - Generates responses                                 │   │
│  │  - Tool orchestration                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Faster-Whisper (Speech-to-Text)

**Location**: `voice-service/voice_service.py`

**Features**:

- Fast, accurate transcription
- Multiple model sizes (tiny to large-v3)
- CPU and CUDA support
- VAD (Voice Activity Detection)
- Language detection
- Segment-level timestamps

**Configuration**:

- Model size: `tiny`, `base`, `small`, `medium`, `large-v2`, `large-v3`
- Device: `cpu` or `cuda`
- Compute type: `int8`, `int8_float16`, `int16`, `float16`, `float32`

**Recommended**: `base` model with `int8` compute type on CPU for best balance.

### 2. Piper (Text-to-Speech)

**Location**: `voice-service/voice_service.py`

**Features**:

- High-quality neural TTS
- Low latency
- Multiple voice models
- Adjustable speed
- Natural-sounding speech

**Configuration**:

- Voice models: Various languages and styles
- Speed: 0.5 - 2.0x
- Format: WAV output

**Recommended**: `en_US-lessac-medium` for English.

### 3. Ollama (LLM Processing)

**Location**: `src/features/ai-assistant/utils/ollamaService.ts`

**Features**:

- Local LLM processing
- Function calling support
- Tool orchestration
- Multi-turn conversations
- Already integrated and working

**Configuration**:

- Base URL: `http://localhost:11434` (default)
- Model: Configurable (e.g., `llama3.2:3b`)

## Data Flow

### Speech-to-Text Flow

1. **User speaks** → Microphone captures audio
2. **AudioRecorder** → Converts to WAV format (16kHz, mono)
3. **voiceService.ts** → Encodes to base64
4. **Tauri command** → Sends to Python service
5. **Faster-Whisper** → Transcribes audio
6. **Response** → Returns text with confidence scores
7. **Ollama** → Processes text for LLM operations

### Text-to-Speech Flow

1. **Ollama/App** → Generates text response
2. **voiceService.ts** → Calls Tauri command
3. **Tauri command** → Sends to Python service
4. **Piper** → Synthesizes speech
5. **Response** → Returns base64-encoded WAV
6. **Audio playback** → Plays through speakers

## File Structure

```
file-pro/
├── voice-service/                    # Python voice service
│   ├── voice_service.py              # Main service (STT + TTS)
│   ├── requirements.txt             # Python dependencies
│   ├── setup.sh                      # Setup script
│   ├── README.md                     # Full documentation
│   └── QUICKSTART.md                 # Quick start guide
│
├── src-tauri/
│   └── src/
│       ├── lib.rs                    # Tauri entry point
│       └── voice_service.rs          # Tauri commands
│
└── src/
    └── features/
        └── ai-assistant/
            └── voice/
                ├── voiceService.ts   # Frontend voice service
                ├── types.ts          # Type definitions
                └── utils/
                    └── audioRecorder.ts  # Audio capture utility
```

## Configuration

### Voice Settings (Frontend)

Access via Voice Settings Panel in the app:

```typescript
{
  provider: 'faster-whisper',
  voiceServiceUrl: 'http://127.0.0.1:8765',
  whisperModelSize: 'base',
  whisperDevice: 'cpu',
  whisperComputeType: 'int8',
  piperVoice: 'en_US-lessac-medium',
  voiceSpeed: 1.0,
  volume: 100,
  language: 'en',
  // ... other settings
}
```

### Service Configuration (Python)

Start service with custom settings:

```bash
python3 voice_service.py \
  --host 127.0.0.1 \
  --port 8765 \
  --model-size base \
  --device cpu \
  --compute-type int8
```

## Performance Characteristics

### Speed Comparison

| Model Size | Parameters | CPU Speed | GPU Speed | Accuracy  |
| ---------- | ---------- | --------- | --------- | --------- |
| tiny       | ~39M       | Very Fast | Very Fast | Good      |
| base       | ~74M       | Fast      | Very Fast | Very Good |
| small      | ~244M      | Medium    | Fast      | Excellent |
| medium     | ~769M      | Slow      | Medium    | Excellent |
| large-v3   | ~1550M     | Very Slow | Medium    | Best      |

**Recommendation**: Use `base` model for best balance.

### Resource Usage

- **CPU**: Base model uses ~500MB RAM, processes ~2-3x real-time
- **GPU**: Base model uses ~1GB VRAM, processes ~10-20x real-time
- **Piper**: Minimal resources (~50MB RAM), very fast synthesis

## Integration Points

### 1. Frontend → Backend

- **Tauri Commands**: `transcribe_audio`, `synthesize_speech`, `check_voice_service_health`
- **Location**: `src-tauri/src/voice_service.rs`

### 2. Backend → Python Service

- **HTTP API**: REST endpoints on `http://127.0.0.1:8765`
- **Endpoints**: `/transcribe`, `/synthesize`, `/health`
- **Location**: `voice-service/voice_service.py`

### 3. Voice Service → LLM

- **Ollama Integration**: Already implemented
- **Location**: `src/features/ai-assistant/utils/ollamaService.ts`
- **Flow**: Transcribed text → Ollama → Response → Piper TTS

## Usage Examples

### Starting the Service

```bash
# Basic start
cd voice-service
python3 voice_service.py

# With custom settings
python3 voice_service.py --model-size small --device cuda
```

### Using in App

1. Start voice service (see above)
2. Open app → Voice Settings
3. Select "faster-whisper" as provider
4. Configure settings
5. Click microphone button to start

### Programmatic Usage

```typescript
import { VoiceService } from "./voice/voiceService";

const service = new VoiceService({
  provider: "faster-whisper",
  voiceServiceUrl: "http://127.0.0.1:8765",
  // ... other settings
});

service.setTranscriptCallback((result) => {
  console.log("Transcribed:", result.text);
});

await service.startListening();
```

## Troubleshooting

### Service Not Starting

1. Check Python: `python3 --version` (needs 3.8+)
2. Install dependencies: `pip3 install -r requirements.txt`
3. Check port: `lsof -i :8765`

### Slow Performance

1. Use smaller model (`base` or `tiny`)
2. Use `int8` compute type
3. Consider GPU if available
4. Pre-load model (service does this automatically)

### Audio Issues

1. Check microphone permissions
2. Verify audio format (WAV, 16kHz, mono)
3. Test with health endpoint
4. Check browser/app permissions

## Best Practices

1. **Start with base model**: Best speed/accuracy balance
2. **Use int8 on CPU**: Optimal performance without GPU
3. **Pre-load models**: Service does this automatically
4. **Monitor resources**: Larger models use more RAM/VRAM
5. **Cache models**: Faster-Whisper caches automatically
6. **Use continuous mode**: For hands-free operation
7. **Adjust speed**: Piper supports 0.5-2.0x speed

## Future Enhancements

Potential improvements:

1. **Wake word detection**: "Hey Assistant" activation
2. **Voice activity detection**: Automatic speech detection
3. **Streaming transcription**: Real-time results
4. **Multi-language support**: Automatic language switching
5. **Voice profiles**: Custom voice selection
6. **Offline mode**: Full local processing
7. **Model quantization**: Further optimization

## License

- Faster-Whisper: MIT License
- Piper: MIT License
- Ollama: MIT License

All components are open source and free to use.

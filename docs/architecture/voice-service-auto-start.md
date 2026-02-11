# Voice Service Automatic Startup

**File: VOICE_SERVICE_AUTO_START.md**

The voice service (Faster-Whisper + Piper) now automatically starts when the application launches, eliminating the need for manual service management.

## Overview

When the AI File Assistant starts and the voice provider is set to `faster-whisper`, the system automatically:

1. **Checks** if the voice service is already running
2. **Starts** the service if it's not running
3. **Monitors** the service health every 10 seconds
4. **Auto-restarts** if the service stops unexpectedly
5. **Displays** status in the Voice Settings panel

## Implementation

### 1. Voice Service Manager Hook

**File**: `src/features/ai-assistant/voice/hooks/useVoiceServiceManager.ts`

A React hook that manages the voice service lifecycle:

- **Auto-start**: Automatically starts service on mount if provider is `faster-whisper`
- **Health monitoring**: Checks service health every 10 seconds
- **Auto-restart**: Attempts to restart if service stops (max 3 attempts)
- **Status tracking**: Tracks running, starting, and error states

### 2. Tauri Backend Command

**File**: `src-tauri/src/voice_service.rs`

The `start_voice_service` command:

- Finds Python executable (`python3` on Unix, `python` on Windows)
- Locates `voice_service.py` script
- Spawns process in background
- Returns process ID
- Process runs independently of the Tauri app

### 3. Integration

**File**: `src/features/ai-assistant/AIFileAssistant.tsx`

- Hook is initialized when component mounts
- Automatically starts service if provider is `faster-whisper`
- Service manager status is passed to Voice Settings panel

### 4. UI Updates

**File**: `src/features/ai-assistant/voice/components/VoiceServiceStatus.tsx`

Enhanced status display:

- Shows "Starting..." when service is launching
- Displays "Start Service" button if service fails to start
- Shows error messages with helpful information
- Auto-refreshes status

## How It Works

### Startup Flow

```
App Starts
    ↓
AIFileAssistant Mounts
    ↓
useVoiceServiceManager Hook Initializes
    ↓
Checks if provider === 'faster-whisper'
    ↓
Checks service health
    ↓
If not running → Starts service
    ↓
Waits 2 seconds
    ↓
Verifies health
    ↓
Updates status
```

### Monitoring Flow

```
Every 10 seconds:
    ↓
Check service health
    ↓
If not running AND not starting:
    ↓
Attempt restart (max 3 attempts)
    ↓
Update status
```

## Configuration

The service uses voice settings for configuration:

- **Service URL**: `settings.voiceServiceUrl` (default: `http://127.0.0.1:8765`)
- **Model Size**: `settings.whisperModelSize` (default: `base`)
- **Device**: `settings.whisperDevice` (default: `cpu`)
- **Compute Type**: `settings.whisperComputeType` (default: `int8`)

## Features

### ✅ Automatic Startup

- Service starts automatically when app launches
- No manual intervention required
- Works on first launch

### ✅ Health Monitoring

- Continuous health checks every 10 seconds
- Detects service failures
- Updates UI in real-time

### ✅ Auto-Restart

- Automatically restarts if service stops
- Maximum 3 restart attempts
- Prevents infinite restart loops

### ✅ Error Handling

- Graceful error messages
- Manual retry button
- Helpful troubleshooting info

### ✅ Status Display

- Real-time status indicators
- Starting/Running/Error states
- Service availability info

## User Experience

### Normal Operation

1. User opens app
2. Service starts automatically (if using faster-whisper)
3. Status shows "Connected" in Voice Settings
4. Voice features work immediately

### Service Failure

1. Service fails to start or stops
2. Status shows "Disconnected"
3. "Start Service" button appears
4. User can manually retry
5. Auto-restart attempts (up to 3 times)

### Provider Change

1. User switches to `faster-whisper`
2. Service automatically starts
3. User switches away from `faster-whisper`
4. Service monitoring stops (but process may continue running)

## Troubleshooting

### Service Won't Start

**Possible causes:**

- Python not installed or not in PATH
- Dependencies not installed (`pip install -r requirements.txt`)
- Port 8765 already in use
- `voice_service.py` not found

**Solutions:**

1. Check Python installation: `python3 --version`
2. Install dependencies: `pip3 install -r requirements.txt`
3. Check port: `lsof -i :8765`
4. Verify script location: `voice-service/voice_service.py`

### Service Starts But Health Check Fails

**Possible causes:**

- Service needs more time to initialize
- Model download in progress
- Network/firewall issues

**Solutions:**

1. Wait 10-30 seconds for initialization
2. Check service logs (if available)
3. Verify service URL in settings

### Service Keeps Restarting

**Possible causes:**

- Service crashes immediately
- Configuration error
- Missing dependencies

**Solutions:**

1. Check error messages in status panel
2. Verify Python dependencies
3. Try manual start to see error details

## Technical Details

### Process Management

- Process spawned via Rust `Command::spawn()`
- Process runs independently (not waited on)
- Process continues after Tauri app closes (by design)
- Process cleanup handled by OS

### Health Check

- HTTP GET request to `/health` endpoint
- 2-second timeout
- Checks every 10 seconds
- Updates UI on status change

### Restart Logic

- Maximum 3 restart attempts
- 2-second wait after start before health check
- Prevents infinite restart loops
- Manual retry resets attempt counter

## Future Enhancements

Potential improvements:

1. **Process Management**: Better process lifecycle management
2. **Logging**: Service output logging
3. **Notifications**: Toast notifications for service status
4. **Settings**: Auto-start toggle in settings
5. **Multiple Instances**: Detection and handling of multiple instances
6. **Graceful Shutdown**: Clean shutdown on app exit

## Summary

The voice service now starts automatically when the application runs, providing a seamless user experience. Users no longer need to manually start the Python service - it happens automatically in the background.

- ✅ Automatic startup on app launch
- ✅ Continuous health monitoring
- ✅ Auto-restart on failure
- ✅ Clear status indicators
- ✅ Manual retry option
- ✅ Error handling and reporting

The integration is complete and ready to use!

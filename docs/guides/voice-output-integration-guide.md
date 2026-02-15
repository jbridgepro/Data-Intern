
# Gemini Live-Style Voice Mode - Integration Guide

## Overview

This guide shows you how to enable **automatic voice output** for AI responses, making the AI File Assistant behave like **Gemini Live Voice Mode** with continuous conversation flow.

---

## 🎯 What Was Implemented

### 1. **Voice Output Manager**
📄 [`voiceOutputManager.ts`](src/features/ai-assistant/voice/voiceOutputManager.ts)

**Features:**
- ✅ Automatic text-to-speech for AI responses
- ✅ Markdown cleaning (removes code blocks, links, formatting)
- ✅ Smart text chunking (sentences, paragraphs, or fixed-size)
- ✅ Speech queue management (priority, interruption support)
- ✅ Streaming response support (speak as chunks arrive)
- ✅ Callbacks for speech start/complete/error

### 2. **Live Conversation Manager**
📄 [`liveConversationManager.ts`](src/features/ai-assistant/voice/liveConversationManager.ts)

**Features:**
- ✅ Gemini Live-style conversation flow
- ✅ Automatic listening → processing → speaking → listening cycle
- ✅ Conversation history tracking
- ✅ Barge-in support (interrupt while AI is speaking)
- ✅ Auto-resume listening after AI finishes
- ✅ State management (idle, listening, processing, thinking, speaking, waiting)

### 3. **React Hook for Easy Integration**
📄 [`useLiveConversation.ts`](src/features/ai-assistant/voice/hooks/useLiveConversation.ts)

**Features:**
- ✅ Simple React hook interface
- ✅ Automatic state management
- ✅ Conversation history
- ✅ Easy controls (start, stop, send response, interrupt)

---

## 🚀 Quick Integration (3 Steps)

### Step 1: Import the Hook

```typescript
import { useLiveConversation } from './voice/hooks/useLiveConversation';
import { VoiceService } from './voice/voiceService';
import type { VoiceSettings } from './voice/types';
```

### Step 2: Setup Live Conversation

```typescript
function AIFileAssistantSession() {
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    provider: 'faster-whisper',
    activationMode: 'continuous',
    voiceOutputEnabled: true,  // IMPORTANT: Enable voice output!
    voiceSpeed: 1.0,
    volume: 80,
    language: 'en-US',
    showTranscription: true,
    autoPunctuation: true,
    noiseCancellation: false,
    allowInterruptions: true,  // Allow barge-in
    updateFrequency: 'milestones',
    piperVoice: 'en_US-lessac-medium',
    voiceServiceUrl: 'http://127.0.0.1:8765',
  });

  const voiceServiceRef = useRef<VoiceService>(new VoiceService(voiceSettings));

  // Setup live conversation
  const liveConversation = useLiveConversation(
    voiceServiceRef.current,
    voiceSettings,
    {
      // Callbacks
      onUserSpoke: (text) => {
        console.log('User said:', text);
        // Send to AI for processing
        processUserInput(text);
      },
      onAssistantResponse: (text) => {
        console.log('Assistant responding:', text);
      },
      onAssistantStartedSpeaking: () => {
        console.log('AI started speaking');
      },
      onAssistantFinishedSpeaking: () => {
        console.log('AI finished speaking');
      },
      onConversationStateChange: (state) => {
        console.log('Conversation state:', state);
      },
    },
    {
      // Options
      autoResumeListening: true,   // Auto-listen after AI speaks
      autoSpeakResponses: true,    // Auto-speak AI responses
      allowInterruptions: true,    // Allow barge-in
      voiceOutputSettings: {
        splitMode: 'sentences',    // Split by sentences
        maxChunkLength: 500,       // Max 500 chars per chunk
        streamingMode: true,       // Support streaming
      },
    }
  );

  return (
    // Your UI here
  );
}
```

### Step 3: Use in Your Component

```typescript
function VoiceMode() {
  const liveConversation = useLiveConversation(/* ... */);

  // Start live conversation
  const handleStartVoice = async () => {
    try {
      await liveConversation.startConversation();
      console.log('Live voice mode started!');
    } catch (error) {
      console.error('Failed to start:', error);
    }
  };

  // Stop conversation
  const handleStopVoice = async () => {
    await liveConversation.stopConversation();
  };

  // When AI responds (in your message handler)
  const handleAIResponse = async (aiText: string) => {
    // This will automatically speak the response!
    await liveConversation.sendAssistantResponse(aiText);
  };

  // For streaming responses
  const handleStreamingChunk = async (chunk: string) => {
    await liveConversation.sendStreamingChunk(chunk);
  };

  return (
    <div>
      <button onClick={handleStartVoice}>
        Start Voice Conversation
      </button>

      <button onClick={handleStopVoice}>
        Stop Voice Conversation
      </button>

      {/* Show status */}
      <div>
        State: {liveConversation.conversationState}
        {liveConversation.isSpeaking && <span>🔊 AI Speaking...</span>}
        {liveConversation.isListening && <span>🎤 Listening...</span>}
        {liveConversation.isProcessing && <span>⚙️ Processing...</span>}
      </div>

      {/* Show conversation history */}
      <div>
        {liveConversation.history.map(turn => (
          <div key={turn.id}>
            <strong>{turn.role}:</strong> {turn.text}
            {turn.role === 'assistant' && turn.audioPlayed && <span> ✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 💡 Complete Integration Example

Here's a complete example showing how to integrate with the AI assistant:

```typescript
import { useState, useRef, useEffect } from 'react';
import { VoiceService } from './voice/voiceService';
import { useLiveConversation } from './voice/hooks/useLiveConversation';
import { processCommand } from './utils/aiService';

function AIFileAssistantWithVoice() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    provider: 'faster-whisper',
    activationMode: 'continuous',
    voiceOutputEnabled: true,  // Enable voice output
    voiceSpeed: 1.0,
    volume: 80,
    language: 'en-US',
    allowInterruptions: true,
    // ... other settings
  });

  const voiceServiceRef = useRef(new VoiceService(voiceSettings));

  // Setup live conversation
  const liveConversation = useLiveConversation(
    voiceServiceRef.current,
    voiceSettings,
    {
      onUserSpoke: async (text) => {
        // Add user message to UI
        const userMessage: Message = {
          id: generateId(),
          role: 'user',
          content: text,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMessage]);

        // Process with AI
        try {
          const response = await processCommand(text, {
            /* context */
          });

          // Add assistant message to UI
          const assistantMessage: Message = {
            id: generateId(),
            role: 'assistant',
            content: response.text,
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMessage]);

          // Speak the response!
          await liveConversation.sendAssistantResponse(response.text);

        } catch (error) {
          console.error('AI processing error:', error);
        }
      },
      onAssistantStartedSpeaking: () => {
        // Visual feedback that AI is speaking
        console.log('AI started speaking');
      },
      onAssistantFinishedSpeaking: () => {
        // AI finished, will auto-resume listening
        console.log('AI finished speaking');
      },
    },
    {
      autoResumeListening: true,    // Auto-listen after AI speaks
      autoSpeakResponses: true,     // Auto-speak responses
      allowInterruptions: true,     // Allow barge-in
    }
  );

  return (
    <div className="voice-assistant">
      {/* Voice Control Button */}
      <button
        onClick={async () => {
          if (liveConversation.isActive) {
            await liveConversation.stopConversation();
          } else {
            await liveConversation.startConversation();
          }
        }}
      >
        {liveConversation.isActive ? 'Stop Voice Mode' : 'Start Voice Mode'}
      </button>

      {/* Status Indicator */}
      <div className="status">
        {liveConversation.isListening && '🎤 Listening...'}
        {liveConversation.isProcessing && '⚙️ Processing...'}
        {liveConversation.isSpeaking && '🔊 Speaking...'}
      </div>

      {/* Messages */}
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className={`message message-${message.role}`}>
            <strong>{message.role}:</strong>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 🔧 Advanced Configuration

### Custom Voice Output Settings

```typescript
const liveConversation = useLiveConversation(
  voiceService,
  voiceSettings,
  callbacks,
  {
    voiceOutputSettings: {
      // How to split text
      splitMode: 'sentences',  // 'sentences' | 'paragraphs' | 'chunks' | 'none'

      // Max characters per chunk
      maxChunkLength: 500,

      // Speak streaming chunks as they arrive
      streamingMode: true,

      // Min chunk size to speak (avoid tiny fragments)
      minChunkLength: 20,
    },
  }
);
```

### Handling Streaming Responses

```typescript
// When you get streaming chunks from AI
async function handleStreamingAIResponse(stream: AsyncIterator<string>) {
  let fullResponse = '';

  for await (const chunk of stream) {
    fullResponse += chunk;

    // Speak chunk if it's a complete sentence
    await liveConversation.sendStreamingChunk(chunk);
  }

  // Final complete response
  await liveConversation.sendAssistantResponse(fullResponse);
}
```

### Manual Control

```typescript
// Manually speak something (without adding to history)
import { createVoiceOutputManager } from './voice/voiceOutputManager';

const outputManager = createVoiceOutputManager(voiceService, voiceSettings);

await outputManager.speakResponse('Hello, how can I help you today?', {
  interrupt: true,  // Interrupt current speech
  priority: 'high', // High priority
  onComplete: () => console.log('Finished speaking'),
});
```

---

## 🎨 UI Integration Examples

### Voice Mode Toggle

```typescript
<button
  onClick={async () => {
    if (liveConversation.isActive) {
      await liveConversation.stopConversation();
    } else {
      await liveConversation.startConversation();
    }
  }}
  className={liveConversation.isActive ? 'active' : ''}
>
  {liveConversation.isActive ? (
    <>
      <MicrophoneIcon className="animate-pulse" />
      Voice Mode Active
    </>
  ) : (
    <>
      <MicrophoneOffIcon />
      Start Voice Mode
    </>
  )}
</button>
```

### State Indicators

```typescript
<div className="voice-status">
  {liveConversation.conversationState === 'listening' && (
    <div className="status-listening">
      <WaveformIcon className="animate-wave" />
      Listening...
    </div>
  )}

  {liveConversation.conversationState === 'thinking' && (
    <div className="status-thinking">
      <LoaderIcon className="animate-spin" />
      Thinking...
    </div>
  )}

  {liveConversation.conversationState === 'speaking' && (
    <div className="status-speaking">
      <SpeakerIcon className="animate-pulse" />
      Speaking...
    </div>
  )}
</div>
```

### Conversation History

```typescript
<div className="conversation-history">
  {liveConversation.history.map(turn => (
    <div
      key={turn.id}
      className={`turn turn-${turn.role}`}
    >
      <div className="turn-avatar">
        {turn.role === 'user' ? <UserIcon /> : <AssistantIcon />}
      </div>
      <div className="turn-content">
        <p>{turn.text}</p>
        <span className="turn-time">
          {new Date(turn.timestamp).toLocaleTimeString()}
        </span>
        {turn.role === 'assistant' && turn.audioPlayed && (
          <span className="audio-played">✓ Spoken</span>
        )}
      </div>
    </div>
  ))}
</div>
```

---

## ⚙️ Settings Recommendations

### For Best Gemini Live Experience

```typescript
const voiceSettings: VoiceSettings = {
  // Use Faster-Whisper for best quality
  provider: 'faster-whisper',

  // Continuous mode for natural conversation
  activationMode: 'continuous',

  // Enable voice output (required!)
  voiceOutputEnabled: true,

  // Natural speech speed
  voiceSpeed: 1.0,

  // Comfortable volume
  volume: 75,

  // Allow interruptions (barge-in)
  allowInterruptions: true,

  // Moderate noise cancellation
  noiseCancellation: true,

  // Show what you're saying
  showTranscription: true,

  // Use a natural-sounding voice
  piperVoice: 'en_US-lessac-medium',  // or 'en_US-amy-medium'

  // Update frequency (for progress)
  updateFrequency: 'milestones',
};
```

### For Noisy Environments

```typescript
const voiceSettings: VoiceSettings = {
  activationMode: 'push-to-talk',  // More control
  noiseCancellation: true,
  micSensitivity: 2,  // Less sensitive
  allowInterruptions: false,  // Prevent accidental interruptions
};
```

---

## 🐛 Troubleshooting

### AI Not Speaking

**Problem**: Voice mode starts but AI doesn't speak responses

**Solution**:
1. Check `voiceOutputEnabled: true` in settings
2. Check `autoSpeakResponses: true` in options
3. Verify voice service is running (`http://127.0.0.1:8765/health`)
4. Check browser console for errors

```typescript
// Debug: Manually test speech
await liveConversation.sendAssistantResponse('Testing 1 2 3');
```

### Voice Service Not Available

**Problem**: "Voice service not available" error

**Solution**:
1. Start the voice service: `python voice-service/voice_service.py`
2. Check service health: `curl http://127.0.0.1:8765/health`
3. Install dependencies: `pip install faster-whisper piper-tts`

### Interruptions Not Working

**Problem**: Can't interrupt while AI is speaking

**Solution**:
1. Check `allowInterruptions: true` in settings
2. Check `allowInterruptions: true` in options
3. Verify `activationMode: 'continuous'`

### Speech Too Fast/Slow

**Problem**: AI speaks too quickly or slowly

**Solution**:
```typescript
updateSettings({ voiceSpeed: 1.0 });  // 0.5 = slow, 2.0 = fast
```

---

## 📊 Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| **Auto Voice Output** | ✅ | AI responses automatically spoken |
| **Continuous Conversation** | ✅ | Listen → Process → Speak → Listen cycle |
| **Barge-in Support** | ✅ | Interrupt AI while speaking |
| **Markdown Cleaning** | ✅ | Removes code blocks, links, formatting |
| **Smart Chunking** | ✅ | Splits long responses into sentences |
| **Streaming Support** | ✅ | Speak as chunks arrive |
| **Priority Queue** | ✅ | High-priority interruptions |
| **State Management** | ✅ | Idle, listening, processing, speaking states |
| **History Tracking** | ✅ | Full conversation history |
| **Callbacks** | ✅ | Events for start/stop/error |

---

## 🎉 Result

With this implementation, your AI File Assistant now has:

✅ **Gemini Live-style voice mode**
✅ **Automatic speech output** for all AI responses
✅ **Natural conversation flow** (listen → respond → listen)
✅ **Interruption support** (barge-in while AI speaking)
✅ **Clean speech** (removes markdown and code)
✅ **Smart chunking** (sentences/paragraphs)
✅ **Streaming support** (speak as text arrives)
✅ **Full state management**

You can now have natural voice conversations with your AI assistant, just like Gemini Live!

---

**Document Version**: 1.0
**Last Updated**: 2026-01-31
**Author**: AI File Assistant Development Team

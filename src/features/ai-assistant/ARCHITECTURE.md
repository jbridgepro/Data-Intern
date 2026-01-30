# AI Assistant System – Architecture

This document describes the architecture of the AI Assistant feature: components, data flow, AI providers, tool system, and supporting services.

---

## 1. Overview

The AI Assistant provides a **conversational interface** for file and directory management. Users give natural-language commands; the system uses one of several **AI providers** (Anthropic Claude, OpenRouter, Ollama) and a **tool layer** to analyze, organize, and modify files. It supports **multiple chat sessions**, **voice input/output**, **undo/redo**, **audit logging**, and **workflow templates**.

### 1.1 Design Principles

- **Provider-agnostic**: Core logic is independent of the chosen LLM; providers are plugged in via `aiService`.
- **Tool-first**: File operations are implemented as tools; the AI chooses and parameterizes them.
- **Context-aware**: Conversation history and directory context are managed and trimmed for the model’s context window.
- **Safety**: Permissions, confirmations, backups, operation history, and audit logs are built in.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UI LAYER                                            │
│  AIFileAssistant → AIFileAssistantTabs → AIFileAssistantSession                 │
│  ChatInput | ChatMessage | QuickActions | SettingsPanel | Voice panels            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         STATE & ORCHESTRATION                                     │
│  ChatContext (sessions, messages, inputValue, sendMessage)                       │
│  AgentSelectionContext (tabs/agents)                                              │
│  useAIFileAssistant (settings, processUserCommand, executeOperation)              │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         AI PROCESSING LAYER                                       │
│  aiService.ts                                                                     │
│  ├── initializeAIClient(settings)                                                 │
│  ├── processCommandWithAI(...) → routes by provider                               │
│  ├── processCommandWithAnthropicProvider (Claude + tool use loop)                 │
│  ├── processCommandWithOllamaProvider                                             │
│  └── processCommandWithOpenRouterProvider                                         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
          ┌────────────────────────────┼────────────────────────────┐
          ▼                            ▼                            ▼
┌──────────────────┐    ┌──────────────────────────┐    ┌──────────────────────┐
│  contextManager  │    │  TOOLS REGISTRY           │    │  toolPermissions     │
│  (history trim,   │    │  toolsRegistry.ts        │    │  (enable/confirm     │
│   relevance)      │    │  getAllTools(settings)   │    │   per tool)          │
└──────────────────┘    │  executeTool(name, args)  │    └──────────────────────┘
                        │  + MCP tools              │
                        └──────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         EXECUTION & SUPPORT SERVICES                              │
│  toolOrchestrator (tab tools: file_copy, folder_creation, etc.)                  │
│  fileOperations, fileAnalysis, organizationStrategies, duplicateDetection, …     │
│  operationHistory (undo/redo), auditLogger, directoryCache, workflowManager       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PLATFORM (Tauri)                                          │
│  @tauri-apps/plugin-fs, plugin-dialog, plugin-shell                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Layers

### 3.1 UI Layer

| Component | Path | Responsibility |
|-----------|------|----------------|
| **AIFileAssistant** | `AIFileAssistant.tsx` | Root; renders `AIFileAssistantTabs`. |
| **AIFileAssistantTabs** | `components/AIFileAssistantTabs.tsx` | Tab bar (per agent/session), “New chat”, close tab; delegates to `AgentSelectionContext`. |
| **AIFileAssistantSession** | `components/AIFileAssistantSession.tsx` | Single session: header (directory, provider badge), chat area, quick actions, clarification/implementation plan/execution progress, message list, chat input; wires voice, settings, preview. |
| **ChatInput** | `components/ChatInput.tsx` | Text input, folder selector, provider/model selector, attachments (files/dir), voice/dictate buttons, **Send** (passes current value to `onSend`). |
| **ChatMessage** | `components/ChatMessage.tsx` | Renders one message (user/assistant), metadata badges, tool widgets, reasoning chain, confirmation actions. |
| **QuickActions** | `components/QuickActions.tsx` | Shortcuts (e.g. organize by type, find duplicates, smart rename, create project, archive). |
| **SettingsPanel** | `components/SettingsPanel.tsx` | AI settings: provider, API keys, model, creativity, backup, dry run, tool permissions, context, cache, audit, workflows, OpenRouter config. |
| **Voice** | `voice/components/*`, `VoiceToTextPanel`, `VoiceModeOverlay` | Voice settings, STT/TTS, voice mode overlay, clarification/implementation plan UI. |

Session state (messages, input, processing) is driven by **ChatContext**; the session reads `activeSession` and calls `sendMessage`, `setInputValue`, etc.

### 3.2 State & Orchestration

- **ChatContext** (`features/chat/contexts/ChatContext.tsx`)
  - Holds **sessions** keyed by `agentId`: `messages`, `inputValue`, `currentDirectory`, `isProcessing`.
  - **sendMessage(content)** adds user message, sets `isProcessing`, calls **processUserCommand** (from `useAIFileAssistant`), then appends assistant message and clears `inputValue`.
  - **setInputValue**, **setDirectory**, **addMessage**, **clearHistory**.
  - Uses **useAIFileAssistant(activeSession?.currentDirectory)** to get `processUserCommand` and settings.

- **AgentSelectionContext** (`features/agents/contexts/AgentSelectionContext.tsx`)
  - Tracks **selectedAgentId** (active tab); **createAndSelectAgent**, **deleteAgent**, **selectAgent**.
  - Tabs in the UI map to agents; switching tabs switches session.

- **useAIFileAssistant** (`hooks/useAIFileAssistant.ts`)
  - Loads/saves **AISettings** (provider, model, API key, Ollama/OpenRouter options, etc.) from localStorage.
  - **initializeAIClient(settings)** on provider/key/url/model change.
  - Exposes **processUserCommand**, **executeOperation**, **analyzeDirectory**, **organizeFiles**, **renameFiles**, **findDuplicates**, **updateSettings**.

Message flow: User types and clicks Send (or Enter) → **ChatInput** calls **onSend(value.trim())** → Session’s **handleSendMessage(value)** → **ChatContext.sendMessage(content)** → **processUserCommand(content, …)** in aiService → tool loop → response → **addMessage(agentId, aiMsg)**.

### 3.3 AI Processing Layer

**File:** `utils/aiService.ts`

- **initializeAIClient(settings)**  
  - Anthropic: creates `Anthropic` client with `apiKey`.  
  - Ollama: `initializeOllamaClient({ baseUrl, model })`.  
  - OpenRouter: `openRouterService.updateSettings(settings.openRouter)`.

- **processCommandWithAI(command, currentDirectory, directoryAnalysis, settings, abortSignal, conversationHistory, voiceContext)**  
  - Dispatches by `settings.provider` to:
    - **processCommandWithAnthropicProvider**
    - **processCommandWithOllamaProvider**
    - **processCommandWithOpenRouterProvider**
  - Returns `{ content, operation?, metadata? }`.

Common steps (conceptually) across providers:

1. Build **system prompt** (persona, tool guidelines, optional ClawdHub context) via **generateSystemPrompt** (`aiGuidelines.ts`).
2. Build **user prompt** (command + current directory + optional directory analysis).
3. Get **tool definitions** from **getAllTools(settings)** (filtered by permissions).
4. Use **contextManager** to select and format **conversation history** for the API.
5. Call the provider’s API (messages + tools).
6. If the model returns **tool_use** blocks:
   - Check **toolPermissions** (enabled, confirmation).
   - **executeTool** (or **executeMCPTool** for MCP tools) with **ToolContext** (currentDirectory, settings, directoryAnalysis).
   - Append tool results to conversation and call the API again (loop, with a max iteration limit).
7. Format final **content** and optional **metadata** (tool executions, reasoning steps).

**Anthropic:** Uses Claude Messages API with `tools` and tool-use loop; **OpenRouter** and **Ollama** use their own tool-calling paths in `openRouterService` and `ollamaService`.

### 3.4 Tool System

**Registry:** `utils/toolsRegistry.ts`

- **TOOLS**: Array of **ToolDefinition** (name, description, input_schema, category, examples).
- **ToolCategory**: FILE_OPERATIONS, DIRECTORY_OPERATIONS, SEARCH_AND_ANALYSIS, ORGANIZATION, AGENT_MANAGEMENT, SYSTEM_COMMANDS, TAB_TOOLS, SKILLS.
- **getAllTools(settings)** returns tools filtered by **toolPermissions** and optionally includes **MCP** tools.
- **executeTool(name, args, context)** looks up the tool and runs the corresponding handler (file ops, analyze, organize, find_duplicates, rename, execute_operation, agents, search, list_directory, read/write/delete, undo, workflows, etc.). Many handlers use **directoryCache**, **operationHistory**, **auditLogger**, **toolPermissionManager**.

**Important tools (examples):**

- **analyze_directory** – fileAnalysis.
- **organize_files** – organizationStrategies.
- **find_duplicates** – duplicateDetection.
- **rename_files** – renameIntelligence.
- **execute_operation** – fileOperations.
- **file_copy_tab**, **folder_creation_tab**, **file_creation_tab**, **find_replace_tab** – implemented in **tabTools** and executed via **toolOrchestrator**.
- **list_agents**, **start_agent**, **stop_agent**, **get_agent_status**, **configure_agent** – agent management.
- **undo_last_operation** – operationHistory.
- **list_workflows**, **run_workflow**, **create_workflow**, **get_workflow_templates** – workflowManager.

**toolOrchestrator** (`utils/toolOrchestrator.ts`): Executes tab tools (file_copy, folder_creation, file_creation, find_replace) with progress callbacks; used for multi-step workflows and by the session’s implementation plan execution.

**Tool permissions** (`utils/toolPermissions.ts`): **ToolPermissionManager** stores per-tool “enabled” and “requireConfirmation”; **checkPermission(toolName)** and **requestConfirmation** integrate with the execution path in aiService.

**MCP** (`utils/mcpIntegration.ts`, `mcpToolDiscovery.ts`): MCP tools are discovered and converted to the provider’s tool format; **executeMCPTool** is used when the model calls an MCP tool.

### 3.5 Supporting Services

| Service | File | Purpose |
|--------|------|--------|
| **ContextManager** | `contextManager.ts` | Selects and trims conversation history by relevance, recency, tool usage; optional summarization; formats for provider. |
| **DirectoryCache** | `directoryCache.ts` | Caches **analyze_directory** results by path to avoid repeated scans. |
| **OperationHistoryManager** | `operationHistory.ts` | Records file operations for undo; creates backups for destructive ops; **undo()** / **redo()**; persistence. |
| **AuditLogger** | `auditLogger.ts` | Logs AI requests, responses, tool runs, errors; levels/categories; retention; export (JSON/CSV/TXT). |
| **WorkflowManager** | `workflowManager.ts` | Workflow templates and runs; **run_workflow**, **create_workflow**, **get_workflow_templates**. |
| **PromptBuilder** | `services/PromptBuilder.ts` | Builds user-facing prompts (e.g. directory + command). |
| **ResponseParser** | `services/ResponseParser.ts` | Parses AI output when needed. |
| **ToolExecutionService** | `services/ToolExecutionService.ts` | Service layer for tool execution. |

---

## 4. Data Flow (End-to-End)

1. User selects **working directory** (folder button in ChatInput or header); stored in **ChatContext** (`currentDirectory`) and optionally in localStorage.
2. User types a message and clicks **Send** (or Enter). **ChatInput** calls **onSend(value.trim())**.
3. Session’s **handleSendMessage(text)** calls **sendMessage(text)** from **ChatContext**.
4. **ChatContext.sendMessage**:
   - Appends user message to `sessions[agentId].messages`.
   - Sets `inputValue` to `''` and `isProcessing` to `true`.
   - Calls **processUserCommand(trimmedContent, null, undefined, history)** from **useAIFileAssistant** (which gets `processUserCommand` from the hook that uses `activeSession?.currentDirectory`).
5. **processUserCommand** (in `useAIFileAssistant`) calls **processCommandWithAI(...)** in **aiService** with command, current directory, optional directory analysis, settings, abort signal, conversation history, voice context.
6. **aiService**:
   - Picks provider (Anthropic / OpenRouter / Ollama).
   - Builds system and user prompts; gets tools; uses **contextManager** to prepare conversation history.
   - Calls the provider; on **tool_use**, checks permissions, runs **executeTool** (or **executeMCPTool**), appends results, repeats until no more tool calls or limit.
7. **executeTool** in toolsRegistry runs the right handler (often using **directoryCache**, **operationHistory**, **auditLogger**).
8. **aiService** returns `{ content, operation?, metadata? }`.
9. **ChatContext** appends the assistant message (with optional metadata), sets `isProcessing` to `false`.
10. UI re-renders; **ChatMessage** shows the new message, tool results, and any widgets/confirmations.

---

## 5. AI Providers

| Provider | Config | Entry in aiService | Notes |
|----------|--------|--------------------|--------|
| **Anthropic** | `provider: 'anthropic'`, `apiKey`, `model` (claude-sonnet/opus/haiku) | **processCommandWithAnthropicProvider** | Claude Messages API; native tool use; system + messages + tools loop. |
| **OpenRouter** | `provider: 'openrouter'`, `openRouter` (apiKey, model, temperature, maxTokens, etc.) | **processCommandWithOpenRouterProvider** | Single API for many models; **openRouterService.chatWithTools** implements tool loop. |
| **Ollama** | `provider: 'ollama'`, `ollamaBaseUrl`, `ollamaModel` | **processCommandWithOllamaProvider** | Local models; **ollamaService** for chat and tool use. |

Model and provider can be switched in **ChatInput** (model dropdown) and **SettingsPanel**; **initializeAIClient** is called when provider or related settings change.

---

## 6. Voice Integration

- **Voice input:** **useVoiceInput** (STT) and **VoiceToTextPanel** / **VoiceModeOverlay**; transcript can be sent as a message or inserted into the input.
- **Voice output:** **useVoiceOutput** (TTS); can speak assistant replies and step progress.
- **Voice settings:** Stored in localStorage; **VoiceSettingsPanel** and **VoiceServiceStatus**; optional external **voice_service** (Python).
- **Clarification / implementation plan:** **ClarificationPanel**, **ImplementationPlanView**, **ExecutionProgress** for multi-step plans and approvals; **toolOrchestrator** runs steps.

Voice-specific prompts (e.g. brevity, confirmations) can be passed via **voiceContext** into **generateSystemPrompt**.

---

## 7. Safety and Compliance

- **Tool permissions:** Per-tool enable/disable and “require confirmation” via **toolPermissions**; integrated in **executeTool** path.
- **Operation history:** **operationHistory** records changes and supports **undo_last_operation**; backups for destructive ops.
- **Audit logging:** **auditLogger** records requests, responses, tool runs; configurable level/category and export.
- **Dry run / backup:** **AISettings.enableBackup**, **dryRunDefault**; respected in **executeOperation** and file operation execution.
- **Excluded folders:** **settings.excludedFolders** used in file operations to avoid touching protected paths.

---

## 8. File Structure (Summary)

```
src/features/ai-assistant/
├── AIFileAssistant.tsx              # Root component
├── types.ts                          # Shared types (messages, operations, settings, tools, audit, workflow)
├── ARCHITECTURE.md                   # This file
├── README.md / TOOL_*.md / VOICE_*.md
├── components/                       # UI
│   ├── AIFileAssistantTabs.tsx
│   ├── AIFileAssistantSession.tsx
│   ├── ChatInput.tsx
│   ├── ChatMessage.tsx
│   ├── QuickActions.tsx
│   ├── SettingsPanel.tsx
│   ├── ToolExecutionCard.tsx, ContextualToolWidget.tsx, ConfirmationButtons.tsx, …
│   ├── OperationHistoryPanel.tsx, AuditLogPanel.tsx, WorkflowPanel.tsx
│   └── VoiceToTextPanel.tsx, VoiceModeOverlay.tsx, …
├── hooks/
│   ├── useAIFileAssistant.ts        # Main hook: settings, processUserCommand, executeOperation
│   ├── useToolWidget.ts             # Tool widgets attached to messages
│   └── useVoiceInput.ts
├── services/
│   ├── PromptBuilder.ts
│   ├── ResponseParser.ts
│   └── ToolExecutionService.ts
├── utils/
│   ├── aiService.ts                 # Provider routing, Anthropic/Ollama/OpenRouter processing
│   ├── aiGuidelines.ts              # System prompt generation
│   ├── toolsRegistry.ts            # Tool definitions + executeTool
│   ├── toolOrchestrator.ts          # Tab tool execution (file_copy, folder_creation, …)
│   ├── toolPermissions.ts
│   ├── contextManager.ts            # Conversation context selection
│   ├── directoryCache.ts
│   ├── operationHistory.ts          # Undo/redo
│   ├── auditLogger.ts
│   ├── workflowManager.ts
│   ├── openRouterService.ts
│   ├── ollamaService.ts
│   ├── mcpIntegration.ts, mcpToolDiscovery.ts
│   ├── fileAnalysis.ts, fileOperations.ts, organizationStrategies.ts, duplicateDetection.ts, renameIntelligence.ts
│   ├── fileCreationFallback.ts, widgetExtractor.ts
│   └── tabTools.ts                  # file_copy, folder_creation, file_creation, find_replace
└── voice/
    ├── components/                  # Voice UI
    ├── hooks/                       # useVoiceOutput, useVoiceServiceManager
    ├── types.ts
    ├── voiceService.ts
    └── utils/                       # audioRecorder, planGenerator
```

---

## 9. Dependencies

- **React** (state, hooks, UI).
- **ChatContext** and **AgentSelectionContext** for session and tab state.
- **useAIFileAssistant** from `ai-assistant` (used by ChatContext and session).
- **Tauri** plugins: **plugin-fs** (file system), **plugin-dialog** (pickers), **plugin-shell** (e.g. ClawdBot, terminal).
- **@anthropic-ai/sdk** for Claude.
- **OpenRouter** and **Ollama** HTTP APIs via their respective service modules.

---

This architecture keeps the UI and state layer separate from the AI and tool layers, so adding a new provider or tool follows a clear path and keeps the system testable and maintainable.

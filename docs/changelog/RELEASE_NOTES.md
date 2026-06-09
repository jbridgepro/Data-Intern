# Release Notes

## v1.0.9
**Release Date:** 2026-02-17

**New Features**
- **Audio Transcription**: Added local voice service integration for transcribing audio files.
- **Quick Tools Hub**: Centralized utility interface including:
  - SQL Formatter
  - File Converter
  - Prompt Optimizer
  - Audio Transcription
- **Custom Date Formats**: Added support for user-defined date formats using Excel-like tokens.
- **Global Job Management**: Unified system for monitoring and controlling background tasks (scans, searches, etc.).
- **Push Notifications**: Added support for notifications on chat messages and follow requests.
- **Profile Visibility**: New privacy settings for profile visibility and default post visibility.

**Enhancements**
- **Search & Replace**: Rewritten in Rust for significant performance improvements and stability with large files.
- **File Mapper**: Added Directory Chart, Mind Map, and Network Graph visualizations; added scan cancellation and concurrency controls.
- **File Copy/Move**: Added "Collapse/Expand All" and improved Filter Mode UI.
- **UI/UX**: Redesigned Home Feed (grid layout, glassrnorphism), improved Import UI theming, and enhanced Collection sharing.

**Fixes**
- Fixed application launch issues related to updater configuration.
- Fixed file creation statistics to reflect total items.
- Fixed subfolder generation bugs.
- Fixed sidebar theme switcher accessibility.

---

## v1.0.8
**Release Date:** 2026-02-16

**Changes**
- Maintenance release / Version bump.

---

## v1.0.7
**Release Date:** 2026-02-16

**Features**
- **Dynamic Settings**: Implemented dynamic settings information and refactored settings components.

**CI/CD & Build**
- **Signing Improvements**: Robust fallback for signed build failures; enabled unsigned fallback for all platforms.
- **Workflow Updates**: Removed Tauri signing keys from workflows for better security practices; updated Tauri updater public key.
- **Dependencies**: Updated Tauri Rust dependencies to match NPM versions.

---

## v1.0.6
**Release Date:** 2026-02-16

**Features**
- **Layout & Assistant**: Updates to layout components and AI assistant features.

**CI/CD & Build**
- **Multi-platform Build**: Added comprehensive multi-platform build workflows.
- **macOS Signing**: Setup and improvements for macOS code signing in CI.
- **TypeScript**: Resolved TypeScript build errors to ensure stable production builds.

---

## v1.0.5
**Release Date:** 2026-01-30

**Features**
- **AI Assistant**: Major updates to AI Assistant, Chat, and File System integration.
- **File Tools**: Added common CSV configuration component; refined file tool panels.
- **Voice Service**: Updates to voice service and agent components.

**Fixes**
- **Build**: Fixed Rust compilation errors (AuthMethod) and Windows build script issues.
- **Linux Support**: Fixed Linux dependencies for Tauri GitHub Actions build.

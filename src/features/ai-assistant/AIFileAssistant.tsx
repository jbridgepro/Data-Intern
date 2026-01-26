/**
 * File: src/features/ai-assistant/AIFileAssistant.tsx
 *
 * Main component for the AI-Powered File Organization feature.
 * Provides a conversational interface for natural language file management.
 * 
 * This component now wraps the tabs system to allow multiple concurrent chat sessions.
 */

import { AIFileAssistantTabs } from './components/AIFileAssistantTabs';

export const AIFileAssistant = () => {
  return <AIFileAssistantTabs />;
};

/**
 * File: src/features/ai-assistant/hooks/useAIFileAssistant.ts
 * 
 * Main hook for AI File Assistant functionality.
 * Handles AI operations, file analysis, and organization logic.
 */

import { useState, useCallback, useEffect } from 'react';
import { analyzeDirectoryFiles } from '../utils/fileAnalysis';
import { organizeFilesByStrategy } from '../utils/organizationStrategies';
import { findDuplicateFiles } from '../utils/duplicateDetection';
import { generateRenameOperation } from '../utils/renameIntelligence';
import { executeFileOperation } from '../utils/fileOperations';
import { initializeAIClient, processCommandWithAI, suggestOrganizationStrategy } from '../utils/aiService';
import type {
  AISettings,
  FileOperation,
  DirectoryAnalysis,
  DuplicateAnalysis,
  OrganizationConfig,
} from '../types';

const DEFAULT_SETTINGS: AISettings = {
  provider: 'anthropic', // Default to Anthropic, can be changed to 'ollama'
  model: 'claude-sonnet',
  creativityLevel: 'balanced',
  autoApproveThreshold: 50,
  enableBackup: true,
  dryRunDefault: false,
  excludedFolders: [],
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2:3b',
  maxTokens: 4096,
  systemPrompt: undefined,
  clawdbotEnabled: false, // ClawdBot integration disabled by default
  aiName: undefined, // Default AI name (will use "FilePro" if not set)
  userName: undefined, // Default user name (will use "You" if not set)
};

/**
 * Migrates old settings format to new format with provider support.
 */
function migrateSettings(savedSettings: any): AISettings {
  const migrated = { ...DEFAULT_SETTINGS, ...savedSettings };

  // If provider is not set, infer from existing settings
  if (!migrated.provider) {
    // If there's an API key, assume Anthropic
    // Otherwise, default to Anthropic but user can switch
    migrated.provider = savedSettings.apiKey ? 'anthropic' : 'anthropic';
  }

  // Ensure Ollama defaults are set if provider is Ollama
  if (migrated.provider === 'ollama') {
    if (!migrated.ollamaBaseUrl) {
      migrated.ollamaBaseUrl = DEFAULT_SETTINGS.ollamaBaseUrl;
    }
    if (!migrated.ollamaModel) {
      migrated.ollamaModel = DEFAULT_SETTINGS.ollamaModel;
    }
  }

  return migrated;
}

export const useAIFileAssistant = (currentDirectory: string) => {
  const [settings, setSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('ai-assistant-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return migrateSettings(parsed);
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Initialize AI client when settings change
  useEffect(() => {
    initializeAIClient(settings);
  }, [settings.provider, settings.apiKey, settings.ollamaBaseUrl, settings.ollamaModel]);

  const updateSettings = useCallback((updates: Partial<AISettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('ai-assistant-settings', JSON.stringify(updated));

      // Reinitialize AI client if relevant settings changed
      if (
        updates.provider !== undefined ||
        updates.apiKey !== undefined ||
        updates.ollamaBaseUrl !== undefined ||
        updates.ollamaModel !== undefined
      ) {
        initializeAIClient(updated);
      }

      return updated;
    });
  }, []);

  const analyzeDirectory = useCallback(async (path: string): Promise<DirectoryAnalysis> => {
    try {
      const analysis = await analyzeDirectoryFiles(path);

      // Use AI to enhance the analysis summary if AI is configured
      if (settings.provider === 'anthropic' ? settings.apiKey : true) {
        try {
          const aiSuggestion = await suggestOrganizationStrategy(analysis, settings);
          analysis.summary += `\n\n**AI Suggestion:** ${aiSuggestion}`;
        } catch (error) {
          console.warn('Failed to get AI suggestion:', error);
          // Continue with regular analysis
        }
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing directory:', error);
      throw error;
    }
  }, [settings]);

  const organizeFiles = useCallback(async (
    path: string,
    command: string
  ): Promise<FileOperation> => {
    try {
      // Parse the command to determine organization strategy
      const config = parseOrganizationCommand(command);
      const operation = await organizeFilesByStrategy(path, config);
      return operation;
    } catch (error) {
      console.error('Error organizing files:', error);
      throw error;
    }
  }, []);

  const renameFiles = useCallback(async (
    path: string,
    command: string
  ): Promise<FileOperation> => {
    try {
      const operation = await generateRenameOperation(path, command);
      return operation;
    } catch (error) {
      console.error('Error generating rename operation:', error);
      throw error;
    }
  }, []);

  const findDuplicates = useCallback(async (path: string): Promise<DuplicateAnalysis> => {
    try {
      const duplicates = await findDuplicateFiles(path);
      return duplicates;
    } catch (error) {
      console.error('Error finding duplicates:', error);
      throw error;
    }
  }, []);

  const generateWorkflow = useCallback(async (
    name: string,
    steps: any[]
  ) => {
    // Workflow generation logic
    // This would integrate with AI to create workflows
    console.log('Generating workflow:', name, steps);
  }, []);

  /**
   * Processes a user command using AI and returns a response.
   */
  const processUserCommand = useCallback(async (
    command: string,
    directoryAnalysis: DirectoryAnalysis | null = null,
    abortSignal?: AbortSignal,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    voiceContext?: { enabled: boolean; persona?: string }
  ): Promise<{ content: string; operation?: FileOperation; metadata?: any }> => {
    // Check if AI is configured based on provider
    const isAIConfigured = settings.provider === 'anthropic'
      ? !!settings.apiKey
      : true; // Ollama doesn't need API key

    if (isAIConfigured) {
      try {
        const aiResponse = await processCommandWithAI(
          command,
          currentDirectory,
          directoryAnalysis,
          settings,
          abortSignal,
          conversationHistory,
          voiceContext
        );
        return aiResponse;
      } catch (error) {
        console.error('AI processing error:', error);
        // Fall through to rule-based processing
      }
    }

    // Fallback message based on provider
    const errorMessage = settings.provider === 'anthropic'
      ? 'AI processing is not available. Please configure your Anthropic API key in settings for AI-powered features.'
      : 'AI processing is not available. Please make sure Ollama is running and configured correctly.';

    return {
      content: errorMessage,
    };
  }, [currentDirectory, settings]);

  const executeOperation = useCallback(async (operation: FileOperation) => {
    try {
      if (settings.dryRunDefault) {
        console.log('Dry run mode - operation not executed:', operation);
        return;
      }

      await executeFileOperation(operation, {
        enableBackup: settings.enableBackup,
        excludedFolders: settings.excludedFolders,
      });
    } catch (error) {
      console.error('Error executing operation:', error);
      throw error;
    }
  }, [settings]);

  return {
    settings,
    updateSettings,
    analyzeDirectory,
    organizeFiles,
    renameFiles,
    findDuplicates,
    generateWorkflow,
    executeOperation,
    processUserCommand,
  };
};

// Helper function to parse organization commands
function parseOrganizationCommand(command: string): OrganizationConfig {
  const lower = command.toLowerCase();

  if (lower.includes('by type') || lower.includes('file type')) {
    return { strategy: 'by-type', options: {} };
  }
  if (lower.includes('by date') || lower.includes('date')) {
    const dateFormat = lower.includes('quarter') ? 'quarter' :
      lower.includes('year') && !lower.includes('month') ? 'year' :
        'year-month';
    return { strategy: 'by-date', options: { dateFormat } };
  }
  if (lower.includes('by project') || lower.includes('project')) {
    return { strategy: 'by-project', options: {} };
  }
  if (lower.includes('by size') || lower.includes('size')) {
    return { strategy: 'by-size', options: {} };
  }

  // Default to by-type
  return { strategy: 'by-type', options: {} };
}

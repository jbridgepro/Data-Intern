/**
 * File: src/features/ai-assistant/utils/providerStatus.ts
 *
 * Utility functions for checking AI provider configuration and connection status.
 * Used to determine if users need to go through the setup wizard.
 */

import type { AISettings, AIProvider } from "../types";

/**
 * Configuration status result for an AI provider.
 */
export interface ProviderConfigStatus {
  /** Whether the provider is properly configured */
  isConfigured: boolean;
  /** Whether the provider has been tested and is connected */
  isConnected: boolean;
  /** Human-readable status message */
  message: string;
  /** Details about what's missing or needs attention */
  details: string[];
  /** Suggested action to resolve any issues */
  suggestedAction?: "setup-wizard" | "check-connection" | "enter-api-key" | "install-ollama" | "pull-model";
}

/**
 * Checks if an AI provider is properly configured based on the settings.
 * This is a quick check that doesn't make network requests.
 *
 * @param settings - Current AI settings
 * @returns Configuration status for the current provider
 */
export function checkProviderConfiguration(settings: AISettings): ProviderConfigStatus {
  const provider = settings.provider || "anthropic";

  switch (provider) {
    case "ollama":
      return checkOllamaConfiguration(settings);
    case "openrouter":
      return checkOpenRouterConfiguration(settings);
    case "anthropic":
      return checkAnthropicConfiguration(settings);
    default:
      return {
        isConfigured: false,
        isConnected: false,
        message: "Unknown provider",
        details: [`Provider "${provider}" is not recognized`],
        suggestedAction: "setup-wizard",
      };
  }
}

/**
 * Checks Ollama configuration status.
 */
function checkOllamaConfiguration(settings: AISettings): ProviderConfigStatus {
  const details: string[] = [];
  let isConfigured = true;
  let suggestedAction: ProviderConfigStatus["suggestedAction"] = undefined;

  // Ollama doesn't require an API key, but needs a model
  if (!settings.ollamaModel) {
    details.push("No Ollama model selected");
    isConfigured = false;
    suggestedAction = "pull-model";
  }

  // Check if base URL is set (defaults to localhost)
  const baseUrl = settings.ollamaBaseUrl || "http://localhost:11434";

  return {
    isConfigured,
    isConnected: false, // Need to test connection separately
    message: isConfigured
      ? "Ollama is configured - test connection to verify"
      : "Ollama needs setup",
    details,
    suggestedAction: suggestedAction || (isConfigured ? "check-connection" : "setup-wizard"),
  };
}

/**
 * Checks OpenRouter configuration status.
 */
function checkOpenRouterConfiguration(settings: AISettings): ProviderConfigStatus {
  const details: string[] = [];
  let isConfigured = true;
  let suggestedAction: ProviderConfigStatus["suggestedAction"] = undefined;

  // OpenRouter requires an API key
  const apiKey = settings.openRouter?.apiKey;
  if (!apiKey || apiKey.trim() === "") {
    details.push("OpenRouter API key is not set");
    isConfigured = false;
    suggestedAction = "enter-api-key";
  } else if (!apiKey.startsWith("sk-or-")) {
    details.push("OpenRouter API key format appears invalid (should start with 'sk-or-')");
    // Still consider it configured, but warn
  }

  // Check if model is selected
  const model = settings.openRouter?.model;
  if (!model || model.trim() === "") {
    details.push("No OpenRouter model selected");
    // Model has a default, so not a blocker
  }

  return {
    isConfigured,
    isConnected: false, // Need to test connection separately
    message: isConfigured
      ? "OpenRouter is configured - test connection to verify"
      : "OpenRouter API key required",
    details,
    suggestedAction: suggestedAction || (isConfigured ? "check-connection" : "setup-wizard"),
  };
}

/**
 * Checks Anthropic configuration status.
 */
function checkAnthropicConfiguration(settings: AISettings): ProviderConfigStatus {
  const details: string[] = [];
  let isConfigured = true;
  let suggestedAction: ProviderConfigStatus["suggestedAction"] = undefined;

  // Anthropic requires an API key
  const apiKey = settings.apiKey;
  if (!apiKey || apiKey.trim() === "") {
    details.push("Anthropic API key is not set");
    isConfigured = false;
    suggestedAction = "enter-api-key";
  } else if (!apiKey.startsWith("sk-ant-")) {
    details.push("Anthropic API key format appears invalid (should start with 'sk-ant-')");
    // Still consider it configured, but warn
  }

  return {
    isConfigured,
    isConnected: false, // Need to test connection separately
    message: isConfigured
      ? "Anthropic is configured - test connection to verify"
      : "Anthropic API key required",
    details,
    suggestedAction: suggestedAction || (isConfigured ? "check-connection" : "setup-wizard"),
  };
}

/**
 * Checks if the user has completed initial setup.
 * Returns true if any provider is properly configured.
 *
 * @param settings - Current AI settings
 * @returns Whether initial setup has been completed
 */
export function hasCompletedSetup(settings: AISettings): boolean {
  const status = checkProviderConfiguration(settings);
  return status.isConfigured;
}

/**
 * Checks if the user should be prompted to run the setup wizard.
 * This considers whether setup has been completed or explicitly skipped.
 *
 * @param settings - Current AI settings
 * @returns Whether to show the setup wizard
 */
export function shouldShowSetupWizard(settings: AISettings): boolean {
  // Check localStorage for setup skip flag
  const setupSkipped = localStorage.getItem("ai-provider-setup-skipped");
  const setupCompleted = localStorage.getItem("ai-provider-setup-completed");

  // If setup was completed or skipped, don't show wizard
  if (setupCompleted === "true" || setupSkipped === "true") {
    // But still check if provider is actually configured
    // In case user cleared their API key
    const status = checkProviderConfiguration(settings);
    if (status.isConfigured) {
      return false;
    }
    // Provider no longer configured, prompt again
  }

  // Check if any provider is configured
  return !hasCompletedSetup(settings);
}

/**
 * Marks the setup as completed in localStorage.
 */
export function markSetupCompleted(): void {
  localStorage.setItem("ai-provider-setup-completed", "true");
  localStorage.removeItem("ai-provider-setup-skipped");
}

/**
 * Marks the setup as skipped in localStorage.
 */
export function markSetupSkipped(): void {
  localStorage.setItem("ai-provider-setup-skipped", "true");
}

/**
 * Resets the setup status (for testing or re-configuration).
 */
export function resetSetupStatus(): void {
  localStorage.removeItem("ai-provider-setup-completed");
  localStorage.removeItem("ai-provider-setup-skipped");
}

/**
 * Tests the actual connection to the configured provider.
 * This makes network requests to verify the connection.
 *
 * @param settings - Current AI settings
 * @returns Promise resolving to connection test result
 */
export async function testProviderConnection(
  settings: AISettings
): Promise<{ success: boolean; message: string }> {
  const provider = settings.provider || "anthropic";

  try {
    switch (provider) {
      case "ollama":
        return await testOllamaConnection(settings);
      case "openrouter":
        return await testOpenRouterConnection(settings);
      case "anthropic":
        return await testAnthropicConnection(settings);
      default:
        return { success: false, message: "Unknown provider" };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Connection test failed",
    };
  }
}

/**
 * Tests Ollama connection.
 */
async function testOllamaConnection(
  settings: AISettings
): Promise<{ success: boolean; message: string }> {
  const baseUrl = settings.ollamaBaseUrl || "http://localhost:11434";

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Ollama returned status ${response.status}`,
      };
    }

    const data = await response.json();
    const models = data.models || [];

    if (models.length === 0) {
      return {
        success: false,
        message: "Ollama is running but no models are installed",
      };
    }

    return {
      success: true,
      message: `Connected to Ollama with ${models.length} model(s)`,
    };
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return {
        success: false,
        message: "Connection timed out. Is Ollama running?",
      };
    }
    if (error.message?.includes("fetch failed") || error.message?.includes("ECONNREFUSED")) {
      return {
        success: false,
        message: "Cannot connect to Ollama. Make sure Ollama is running.",
      };
    }
    return {
      success: false,
      message: error.message || "Failed to connect to Ollama",
    };
  }
}

/**
 * Tests OpenRouter connection.
 */
async function testOpenRouterConnection(
  settings: AISettings
): Promise<{ success: boolean; message: string }> {
  const apiKey = settings.openRouter?.apiKey;

  if (!apiKey) {
    return {
      success: false,
      message: "OpenRouter API key is not configured",
    };
  }

  try {
    // Use the auth/key endpoint to validate the API key
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: `Connected to OpenRouter${data.data?.label ? ` (${data.data.label})` : ""}`,
      };
    } else if (response.status === 401) {
      return {
        success: false,
        message: "Invalid OpenRouter API key",
      };
    } else {
      return {
        success: false,
        message: `OpenRouter returned status ${response.status}`,
      };
    }
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return {
        success: false,
        message: "Connection timed out",
      };
    }
    return {
      success: false,
      message: error.message || "Failed to connect to OpenRouter",
    };
  }
}

/**
 * Tests Anthropic connection.
 */
async function testAnthropicConnection(
  settings: AISettings
): Promise<{ success: boolean; message: string }> {
  const apiKey = settings.apiKey;

  if (!apiKey) {
    return {
      success: false,
      message: "Anthropic API key is not configured",
    };
  }

  try {
    // Make a minimal request to test the API key
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    // Even a successful request will return 200
    // We just want to know the API key is valid
    if (response.ok) {
      return {
        success: true,
        message: "Connected to Anthropic Claude",
      };
    } else if (response.status === 401) {
      return {
        success: false,
        message: "Invalid Anthropic API key",
      };
    } else if (response.status === 400) {
      // Bad request but API key is valid
      return {
        success: true,
        message: "Connected to Anthropic Claude",
      };
    } else {
      const error = await response.json().catch(() => ({}));
      return {
        success: false,
        message: error.error?.message || `Anthropic returned status ${response.status}`,
      };
    }
  } catch (error: any) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return {
        success: false,
        message: "Connection timed out",
      };
    }
    return {
      success: false,
      message: error.message || "Failed to connect to Anthropic",
    };
  }
}

/**
 * Gets a user-friendly description of the current provider.
 */
export function getProviderDisplayName(provider: AIProvider): string {
  switch (provider) {
    case "ollama":
      return "Ollama (Local)";
    case "openrouter":
      return "OpenRouter";
    case "anthropic":
      return "Anthropic Claude";
    default:
      return provider;
  }
}

/**
 * Gets the help URL for setting up a provider.
 */
export function getProviderHelpUrl(provider: AIProvider): string {
  switch (provider) {
    case "ollama":
      return "https://ollama.com/download";
    case "openrouter":
      return "https://openrouter.ai/keys";
    case "anthropic":
      return "https://console.anthropic.com/settings/keys";
    default:
      return "";
  }
}

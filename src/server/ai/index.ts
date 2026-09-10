import { AIProviderManager } from "./provider-manager";
import { GeminiProvider } from "./gemini-provider";
import { GroqProvider } from "./groq-provider";
import { CodeCraftProvider } from "./codecraft-provider";
import { OpenRouterProvider } from "./openrouter-provider";
import type { AIImageRequest, AIImageResponse, AITextRequest, AITextResponse } from "./types";

/**
 * The application's single AI entry point.
 *
 * Story, scene and character code calls generateText / generateImage and never
 * names a vendor. To add a provider, implement AIProvider and register it in
 * the block below - nothing else in the app changes.
 */
export const aiProviders = new AIProviderManager();

// ---------------------------------------------------------------------------
// PROVIDER REGISTRY - the extension point.
//
//   import { MistralProvider } from "./mistral-provider";
//   aiProviders.register(new MistralProvider());
//
// Registration order defines the fallback default; AI_PROVIDER selects one at
// runtime. Gemini is registered first, so behaviour is unchanged when
// AI_PROVIDER is unset.
// ---------------------------------------------------------------------------
aiProviders.register(new GeminiProvider());
aiProviders.register(new GroqProvider());
aiProviders.register(new CodeCraftProvider());
aiProviders.register(new OpenRouterProvider());

/** Generate text with the selected provider, honouring its model fallback chain. */
export function generateText(request: AITextRequest): Promise<AITextResponse> {
  return aiProviders.generateText(request);
}

/** Generate an image with the selected provider. Resolves a data URL or null. */
export function generateImage(request: AIImageRequest): Promise<AIImageResponse> {
  return aiProviders.generateImage(request);
}

export { AIProviderManager } from "./provider-manager";
export { GeminiProvider } from "./gemini-provider";
export { GroqProvider } from "./groq-provider";
export { CodeCraftProvider } from "./codecraft-provider";
export { OpenRouterProvider } from "./openrouter-provider";
export {
  AllProvidersFailedError,
  classifyError,
  tagError,
  type AIErrorKind,
  type AIErrorClassification,
  type AIProviderAttempt,
} from "./errors";
export type {
  AIProvider,
  AIProviderInfo,
  AIImageRequest,
  AIImageResponse,
  AIResponseSchema,
  AITextOptions,
  AITextRequest,
  AITextResponse,
} from "./types";

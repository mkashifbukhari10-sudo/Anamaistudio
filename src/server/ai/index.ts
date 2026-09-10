import { AIProviderManager } from "./provider-manager.js";
import { GeminiProvider } from "./gemini-provider.js";
import type { AIImageRequest, AIImageResponse, AITextRequest, AITextResponse } from "./types.js";

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
// GEMINI-ONLY. Gemini serves all text/story generation and all image
// generation. It is the only adapter in this directory, so no other
// provider is constructed and no other API key is read.
//
// To add a provider: implement AIProvider (gemini-provider.ts is the reference
// implementation), then register it here - nothing else in the app changes:
//
//   import { MistralProvider } from "./mistral-provider.js";
//   aiProviders.register(new MistralProvider());
//
// Registration order defines text-generation priority and the fallback default;
// AI_PROVIDER overrides the primary at runtime.
// ---------------------------------------------------------------------------
aiProviders.register(new GeminiProvider());

/** Generate text with the selected provider, honouring its model fallback chain. */
export function generateText(request: AITextRequest): Promise<AITextResponse> {
  return aiProviders.generateText(request);
}

/** Generate an image with the selected provider. Resolves a data URL or null. */
export function generateImage(request: AIImageRequest): Promise<AIImageResponse> {
  return aiProviders.generateImage(request);
}

export { AIProviderManager } from "./provider-manager.js";
export { GeminiProvider } from "./gemini-provider.js";
export {
  AllProvidersFailedError,
  classifyError,
  tagError,
  type AIErrorKind,
  type AIErrorClassification,
  type AIProviderAttempt,
} from "./errors.js";
export type {
  AIProvider,
  AIProviderInfo,
  AIImageRequest,
  AIImageResponse,
  AIResponseSchema,
  AITextOptions,
  AITextRequest,
  AITextResponse,
} from "./types.js";

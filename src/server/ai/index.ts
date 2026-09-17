import { AIProviderManager } from "./provider-manager.js";
import { DeepSeekProvider } from "./deepseek-provider.js";
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
// DEEPSEEK-ONLY. DeepSeek serves all text and story generation. It is the only
// adapter in this directory, so no other provider is constructed and no other
// API key is read.
//
// DeepSeek publishes no image endpoint, so generateImage rejects and the
// Character Reference Studio falls back to prompt-only, which it already
// supported.
//
// To add a provider: implement AIProvider (deepseek-provider.ts is the
// reference implementation), then register it here - nothing else changes:
//
//   import { MistralProvider } from "./mistral-provider.js";
//   aiProviders.register(new MistralProvider());
//
// Registration order defines text-generation priority and the fallback default;
// AI_PROVIDER overrides the primary at runtime.
// ---------------------------------------------------------------------------
aiProviders.register(new DeepSeekProvider());

/** Generate text with the selected provider, honouring its model fallback chain. */
export function generateText(request: AITextRequest): Promise<AITextResponse> {
  return aiProviders.generateText(request);
}

/** Generate an image with the selected provider. Resolves a data URL or null. */
export function generateImage(request: AIImageRequest): Promise<AIImageResponse> {
  return aiProviders.generateImage(request);
}

export { AIProviderManager } from "./provider-manager.js";
export { DeepSeekProvider, MAX_SCENES_PER_BATCH } from "./deepseek-provider.js";
export { Type, toJsonSchema, describeSchemaForPrompt } from "./schema.js";
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

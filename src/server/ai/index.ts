import { AIProviderManager } from "./provider-manager.js";
import { GeminiProvider } from "./gemini-provider.js";
import { GroqProvider } from "./groq-provider.js";
import { CodeCraftProvider } from "./codecraft-provider.js";
import { OpenRouterProvider } from "./openrouter-provider.js";
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
//   import { MistralProvider } from "./mistral-provider.js";
//   aiProviders.register(new MistralProvider());
//
// Registration order defines the text-generation priority and the fallback
// default; AI_PROVIDER overrides the primary at runtime.
//
// Text priority: Groq -> Gemini -> CodeCraft -> OpenRouter.
//
// Image generation is unaffected by this order: the manager filters the chain
// by capability, and Gemini is the only provider that declares supportsImages,
// so character reference images are always served by Gemini.
// ---------------------------------------------------------------------------
aiProviders.register(new GroqProvider());
aiProviders.register(new GeminiProvider());
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

export { AIProviderManager } from "./provider-manager.js";
export { GeminiProvider } from "./gemini-provider.js";
export { GroqProvider } from "./groq-provider.js";
export { CodeCraftProvider } from "./codecraft-provider.js";
export { OpenRouterProvider } from "./openrouter-provider.js";
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

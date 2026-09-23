import { AIProviderManager } from "./provider-manager.js";
import { DeepSeekProvider } from "./deepseek-provider.js";
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
// GEMINI PRIMARY, DEEPSEEK FALLBACK. Registration order defines text-generation
// priority, so Gemini serves story and scene generation and DeepSeek is only
// reached when Gemini fails RECOVERABLY (rate limit, quota, timeout,
// unavailable). A bad key or a denied project is terminal and is rethrown
// immediately rather than quietly falling through to the other vendor.
//
// Gemini also publishes an image endpoint, so the Character Reference Studio
// can generate reference images again instead of falling back to prompt-only.
// DeepSeek has no image endpoint; if it is ever the active provider, that
// fallback still applies.
//
// AI_PROVIDER overrides the primary at runtime, and request.provider pins one
// provider with failover disabled.
//
// To add a provider: implement AIProvider (deepseek-provider.ts is the
// reference implementation), then register it here - nothing else changes.
// ---------------------------------------------------------------------------
aiProviders.register(new GeminiProvider());
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
export { GeminiProvider } from "./gemini-provider.js";
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

/**
 * One line at boot naming which providers actually have a key.
 *
 * Without it a missing GEMINI_API_KEY surfaces partway through a generation,
 * after the run has already been waiting - and with a fallback registered it
 * can surface as a silent switch to the other vendor rather than as an error.
 * Better to say it before any work starts.
 */
export function describeProviderSetup(): string {
  const readiness = aiProviders.readiness();
  const rows = readiness.map((r) => `${r.id}${r.configured ? "" : " (NO KEY)"}`);

  const primary = rows[0] ?? "none";
  const rest = rows.slice(1);
  const chain = rest.length > 0 ? `, fallback: ${rest.join(", ")}` : ", no fallback";

  const line = `[AI] primary: ${primary}${chain}`;

  // The primary having no key is the failure this line exists to catch: without
  // it the run gets partway in and then either errors or quietly switches
  // vendor, both after the wait has started.
  if (readiness[0] && !readiness[0].configured) {
    return `${line}\n[AI] WARNING: the primary provider has no API key. Set ${readiness[0].id.toUpperCase()}_API_KEY in .env before generating.`;
  }

  return line;
}

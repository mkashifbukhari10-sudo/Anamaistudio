/**
 * Provider-neutral contract for AI text and image generation.
 *
 * SERVER ONLY. Nothing in src/server/** may be imported from client code:
 * provider credentials are read from the process environment and must never
 * reach the browser bundle.
 */

/**
 * Structured-output schema, handed to the provider untouched.
 *
 * The schemas the app builds today use OpenAPI-style uppercase type names
 * ("OBJECT", "STRING", "ARRAY", "INTEGER") because @google/genai's `Type` enum
 * is a plain string enum. That means the schema literals are already portable
 * JSON: a future adapter can translate them (e.g. lowercase the `type` fields
 * for OpenAI-style JSON Schema) without touching a single call site.
 */
export type AIResponseSchema = Record<string, unknown>;

/** Generation options shared by every text provider. */
export interface AITextOptions {
  /** System / developer instruction prepended to the conversation. */
  systemInstruction?: string;
  temperature?: number;
  /** e.g. "application/json" to request structured output. */
  responseMimeType?: string;
  responseSchema?: AIResponseSchema;
}

export interface AITextRequest {
  /** The user-visible prompt text. */
  prompt: string;
  options?: AITextOptions;
  /**
   * Override the provider's model fallback chain for this call.
   * Omit to use the provider's configured order.
   */
  models?: string[];
  /** Route this single call to a specific registered provider id. */
  provider?: string;
}

export interface AITextResponse {
  /** Raw text payload, or undefined when the model returned no text. */
  text: string | undefined;
  /** The model that actually answered (after any fallback). */
  model: string;
  /** The provider that served the request. */
  provider: string;
  /** Untouched provider-native response, for diagnostics. */
  raw: unknown;
}

export interface AIImageRequest {
  prompt: string;
  models?: string[];
  provider?: string;
}

export interface AIImageResponse {
  /**
   * Fully-formed `data:<mime>;base64,<data>` URL, or null when the model
   * responded but returned no image payload.
   */
  imageDataUrl: string | null;
  mimeType?: string;
  model: string;
  provider: string;
  raw: unknown;
}

/**
 * One AI backend. Add a provider by implementing this interface and
 * registering it with the AIProviderManager - no story, scene or route code
 * changes required.
 */
export interface AIProvider {
  /** Stable lookup key, e.g. "gemini", "groq", "openrouter". */
  readonly id: string;
  /** Human-readable name for logs and diagnostics. */
  readonly label: string;
  readonly supportsText: boolean;
  readonly supportsImages: boolean;
  /** Default model fallback chains, exposed for diagnostics. */
  readonly textModels: string[];
  readonly imageModels: string[];
  /**
   * Whether credentials are present. Informational only - it must not be used
   * to short-circuit a call, because each provider owns the exact error it
   * raises for missing credentials.
   */
  isConfigured(): boolean;
  generateText(request: AITextRequest): Promise<AITextResponse>;
  generateImage(request: AIImageRequest): Promise<AIImageResponse>;
}

/** Summary row used by diagnostics. */
export interface AIProviderInfo {
  id: string;
  label: string;
  supportsText: boolean;
  supportsImages: boolean;
  configured: boolean;
  isDefault: boolean;
  /** True while the manager is skipping this provider after a recoverable failure. */
  coolingDown?: boolean;
  cooldownRemainingMs?: number;
  textModels: string[];
  imageModels: string[];
}

import { tagError } from "./errors";
import { toJsonSchema } from "./schema";
import type {
  AIImageRequest,
  AIImageResponse,
  AIProvider,
  AITextRequest,
  AITextResponse,
} from "./types";

/**
 * CodeCraft API adapter - text generation only.
 *
 * Verified against https://codecraftapi.com/docs (2026-09) and a live probe:
 *   - Base URL:      https://codecraftapi.com/v1
 *   - Auth:          Authorization: Bearer cc_<48 chars>   (x-api-key also accepted)
 *   - Endpoints:     POST /chat/completions, GET /models, GET /models/{id}, POST /embeddings
 *   - Compatibility: OpenAI chat-completions request/response shape, incl. error envelope
 *   - JSON output:   response_format: { "type": "json_object" }
 *   - max_tokens:    optional, API default 8192
 *   - Errors:        { "error": { "message", "type", "code" } }
 *                    401 authentication_error (missing_api_key / invalid_api_key)
 *                    402 empty balance, 403 insufficient_scope,
 *                    404 model_not_found, 429 rate limit (Retry-After header)
 *   - Rate limits:   3,000 requests/min and 5M tokens/min, reported in X-RateLimit-* headers
 *
 * Image GENERATION is not offered (the "vision" capability is image INPUT), so
 * this provider declares supportsImages = false and character reference images
 * stay on Gemini.
 */

/**
 * Default chain. All IDs verified present on the CodeCraft model list; the
 * 8K-context gemma-2-2b is deliberately excluded because AnamStudio's scene
 * prompts carry the screenplay, blueprint slice and story memory.
 * Reported context windows: deepseek-v4-pro-0813 and gpt-5.6-luna ~1049K,
 * qwen3.8-27b ~262K.
 */
const DEFAULT_TEXT_MODELS = [
  "deepseek-v4-pro-0813",
  "gpt-5.6-luna",
  "qwen3.8-27b",
];

const DEFAULT_BASE_URL = "https://codecraftapi.com/v1";
const TEXT_TIMEOUT_MS = 35000;

export class CodeCraftProvider implements AIProvider {
  readonly id = "codecraft";
  readonly label = "CodeCraft API";
  readonly supportsText = true;
  readonly supportsImages = false;

  /** Read from the environment on access; the host may inject config late. */
  get textModels(): string[] {
    const configured = process.env.CODECRAFT_TEXT_MODELS;
    if (configured && configured.trim()) {
      const parsed = configured.split(",").map((m) => m.trim()).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
    return DEFAULT_TEXT_MODELS;
  }

  get imageModels(): string[] {
    return [];
  }

  private get baseUrl(): string {
    return (process.env.CODECRAFT_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  /**
   * The documented default is 8192 output tokens, which is tight for a
   * twelve-scene batch. Set CODECRAFT_MAX_TOKENS to raise it for models whose
   * limit you have confirmed; unset, we send nothing and take the API default.
   */
  private get maxTokens(): number | null {
    const raw = process.env.CODECRAFT_MAX_TOKENS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
  }

  isConfigured(): boolean {
    return !!process.env.CODECRAFT_API_KEY;
  }

  private getApiKey(): string {
    const apiKey = process.env.CODECRAFT_API_KEY;
    if (!apiKey) {
      // Tagged 'auth' so the manager treats it as terminal, never a failover trigger.
      throw tagError(new Error("CODECRAFT_API_KEY environment variable is missing."), "auth");
    }
    return apiKey;
  }

  /**
   * CodeCraft supports response_format json_object but not a JSON schema, so
   * the app's schema is stated in the system message exactly as on the Groq
   * path. No Gemini prompt is altered.
   */
  private buildSystemMessage(request: AITextRequest): string | null {
    const base = request.options?.systemInstruction || "";
    const wantsJson = request.options?.responseMimeType === "application/json";
    const jsonSchema = wantsJson ? toJsonSchema(request.options?.responseSchema) : undefined;

    if (!wantsJson) {
      return base || null;
    }

    const contract = jsonSchema
      ? `\n\nOUTPUT CONTRACT: Respond with a single valid JSON object and nothing else - no markdown fences, no commentary. The object MUST conform to this JSON Schema:\n${JSON.stringify(jsonSchema)}`
      : `\n\nOUTPUT CONTRACT: Respond with a single valid JSON object and nothing else - no markdown fences, no commentary.`;

    return `${base}${contract}`.trim();
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const apiKey = this.getApiKey();
    const models = request.models && request.models.length > 0 ? request.models : this.textModels;
    const systemMessage = this.buildSystemMessage(request);
    const wantsJson = request.options?.responseMimeType === "application/json";
    const maxTokens = this.maxTokens;
    let lastError: any = null;

    for (let mIdx = 0; mIdx < models.length; mIdx++) {
      const model = models[mIdx];
      try {
        console.log(`[CodeCraft Text] Requesting '${model}'...`);

        const messages: Array<{ role: string; content: string }> = [];
        if (systemMessage) {
          messages.push({ role: "system", content: systemMessage });
        }
        messages.push({ role: "user", content: request.prompt });

        const body: Record<string, unknown> = { model, messages };
        if (typeof request.options?.temperature === "number") {
          body.temperature = request.options.temperature;
        }
        if (wantsJson) {
          body.response_format = { type: "json_object" };
        }
        if (maxTokens !== null) {
          body.max_tokens = maxTokens;
        }

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          let reason = detail.slice(0, 300);
          let code = "";
          try {
            const parsed = JSON.parse(detail);
            reason = parsed?.error?.message || reason;
            code = parsed?.error?.code || parsed?.error?.type || "";
          } catch {
            // keep the raw body snippet
          }

          // 429 carries Retry-After; we fail over rather than wait, but log it.
          const retryAfter = res.headers.get("retry-after");
          if (res.status === 429 && retryAfter) {
            console.log(`[CodeCraft Text] Rate limited on '${model}' (retry-after ${retryAfter}s).`);
          }

          throw Object.assign(
            new Error(
              `CodeCraft model '${model}' failed with HTTP ${res.status}${code ? ` (${code})` : ""}: ${reason}`
            ),
            { status: res.status }
          );
        }

        const payload: any = await res.json();
        const text = payload?.choices?.[0]?.message?.content;
        const finishReason = payload?.choices?.[0]?.finish_reason;

        if (text) {
          if (finishReason === "length") {
            // Truncated output would be malformed JSON; treat as recoverable so
            // the batch splitter can retry with a smaller range.
            throw tagError(
              new Error(
                `CodeCraft model '${model}' hit the output token limit (finish_reason=length). Set CODECRAFT_MAX_TOKENS higher or use a smaller batch.`
              ),
              "provider_error"
            );
          }
          console.log(`[CodeCraft Text] Successfully generated with model '${model}'.`);
          return {
            text,
            model,
            provider: this.id,
            raw: payload,
          };
        }
      } catch (err: any) {
        // AbortSignal.timeout rejects with a TimeoutError DOMException.
        if (err?.name === "TimeoutError" || err?.name === "AbortError") {
          lastError = tagError(
            new Error(`CodeCraft model '${model}' request timed out after 35s`),
            "timeout"
          );
        } else {
          lastError = err;
        }
        const reason = lastError?.message || String(lastError);
        console.log(`[CodeCraft Text] Model '${model}' unavailable (${reason}). Moving to next fallback model...`);

        if (mIdx < models.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    throw lastError || new Error("CodeCraft text models were unavailable. Please try again in a few moments.");
  }

  async generateImage(_request: AIImageRequest): Promise<AIImageResponse> {
    throw tagError(
      new Error("CodeCraft API does not offer image generation. Character reference images are generated by Gemini."),
      "invalid_request"
    );
  }
}

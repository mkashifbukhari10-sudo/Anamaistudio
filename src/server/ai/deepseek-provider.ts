import { tagError, type AIErrorKind } from "./errors.js";
import { recordCall } from "./telemetry.js";
import { describeSchemaForPrompt } from "./schema.js";
import type {
  AIImageRequest,
  AIImageResponse,
  AIProvider,
  AIProviderInfo,
  AITextRequest,
  AITextResponse,
} from "./types.js";

/**
 * DeepSeek text provider — the application's only AI provider.
 *
 * Speaks DeepSeek's OpenAI-compatible Chat Completions API over plain fetch;
 * no SDK, so nothing new enters the serverless bundle.
 *
 * The job of this file is ADAPTATION. The Story Director asks for structured
 * output the way it always has - a schema object and `responseMimeType:
 * "application/json"` - and this provider turns that into whatever DeepSeek
 * needs, then hands back plain text exactly as before. No schema, no prompt and
 * no call site upstream changed for the migration.
 *
 * ---------------------------------------------------------------------------
 * MODEL CONFIGURATION lives at the top of this file and nowhere else, so the
 * model can change without touching Story Director code.
 * ---------------------------------------------------------------------------
 */

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

/**
 * The model chain.
 *
 * `deepseek-flash` (DeepSeek-V4.1-Flash) is currently the only model this app
 * uses: 1M context, 384K max output, and the cheap high-concurrency tier.
 * `deepseek-v4-pro` shares those limits at roughly 4x the input cost, so it is
 * not worth reaching for until a quality gap is actually observed.
 *
 * The earlier chain named `deepseek-chat` and `deepseek-reasoner`. Neither
 * appears in DeepSeek's current model list, so both were removed rather than
 * left to fail on the first call.
 */
const TEXT_MODELS_FALLBACK_ORDER = ["deepseek-flash"];

/** What deepseek-flash will emit at most. Used for clamping, not as a default. */
export const MODEL_MAX_OUTPUT_TOKENS = 384000;

/**
 * Default output ceiling per request.
 *
 * Sized from real measurements rather than from the model's maximum. The
 * largest thing this app asks for is a 12-scene batch, which came to roughly
 * 13,000 output tokens in a real 60-scene story; the blueprint and the
 * screenplay/Character Bible were each under 5,000.
 *
 * CORRECTED after a real failed run. 32,000 was sized from the VISIBLE JSON
 * alone and every scene batch was truncated at it.
 *
 * deepseek-flash is a reasoning model: it emits internal reasoning that counts
 * toward max_tokens and is billed as output. A probe measured `reasoning_tokens`
 * at roughly 60% of visible content on a small task, and a twelve-scene batch -
 * twelve interlocking scenes with continuity, social and world state - reasons
 * far more than that before writing anything.
 *
 * 120,000 is ~9x the visible-content need of the largest real request, leaving
 * ample room for reasoning, and still under a third of the 384K ceiling. This
 * costs nothing when unused: billing counts tokens GENERATED, not the ceiling
 * requested. The ceiling remains a guard against a runaway generation, not a
 * budget.
 */
const DEFAULT_MAX_OUTPUT_TOKENS = 120000;

/**
 * Scenes per batch.
 *
 * 12 is what the long-form architecture was validated with over a real
 * 60-scene generation, and it keeps retry granularity sensible: a failed batch
 * costs one twelfth of the film, not the whole thing. The output limit permits
 * far more - even all 60 scenes in one call - but batch size is a reliability
 * decision, not a limits decision.
 */
export const MAX_SCENES_PER_BATCH = 12;

/** Per-attempt ceiling. Long structured batches legitimately take a while. */
const TEXT_TIMEOUT_MS = 180000;

/** Clamp a caller's request to something the model will actually accept. */
export function resolveMaxOutputTokens(requested?: number): number {
  if (typeof requested !== "number" || !Number.isFinite(requested) || requested <= 0) {
    return DEFAULT_MAX_OUTPUT_TOKENS;
  }
  return Math.min(Math.round(requested), MODEL_MAX_OUTPUT_TOKENS);
}

/**
 * Failures every model in the chain will reproduce.
 *
 * Auth and malformed-request errors are properties of the key or the payload,
 * not of the model, so walking the chain costs time and changes nothing.
 * Rate limits (429), server errors (5xx) and timeouts stay retryable, which is
 * what lets the existing batch split/retry recovery do its job.
 */
function isTerminalFailure(status: number | undefined, message: string): boolean {
  if (status === 401 || status === 402 || status === 403 || status === 400) return true;
  return /invalid api key|authentication|insufficient balance|unauthorized/i.test(message);
}

/** Map a DeepSeek failure onto the generic error kinds the manager understands. */
function classifyDeepSeekError(status: number | undefined, message: string): AIErrorKind {
  if (status === 401 || status === 403 || /invalid api key|authentication/i.test(message)) return "auth";
  if (status === 402 || /insufficient balance/i.test(message)) return "auth";
  if (status === 400) return "invalid_request";
  if (status === 429 || /rate limit/i.test(message)) return "rate_limit";
  if (status === 503 || /overloaded|busy/i.test(message)) return "unavailable";
  if (status && status >= 500) return "provider_error";
  if (/timed out|timeout|aborted/i.test(message)) return "timeout";
  return "unknown";
}

/**
 * Recover a JSON payload from a model reply.
 *
 * JSON mode usually returns clean JSON, but a fallback model or a retry can
 * still wrap it in a code fence or add a sentence of preamble. This unwraps
 * those cases and otherwise returns the text untouched.
 *
 * It deliberately does NOT repair or complete truncated JSON: a half-written
 * scene list parsed into a plausible shape would silently lose story content,
 * which is worse than a clean failure the retry path can handle.
 */
export function extractJsonPayload(raw: string): string {
  const text = String(raw ?? "").trim();
  if (!text) return text;

  // ```json ... ``` or ``` ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1].trim()) return fenced[1].trim();

  if (text.startsWith("{") || text.startsWith("[")) return text;

  // Prose before the payload: take from the first brace to its matching close.
  const firstObject = text.indexOf("{");
  const firstArray = text.indexOf("[");
  const start =
    firstObject === -1 ? firstArray : firstArray === -1 ? firstObject : Math.min(firstObject, firstArray);
  if (start === -1) return text;

  const lastObject = text.lastIndexOf("}");
  const lastArray = text.lastIndexOf("]");
  const end = Math.max(lastObject, lastArray);
  if (end <= start) return text;

  return text.slice(start, end + 1);
}

export class DeepSeekProvider implements AIProvider {
  readonly id = "deepseek";
  readonly label = "DeepSeek";
  readonly supportsText = true;
  /** DeepSeek publishes no image endpoint. */
  readonly supportsImages = false;
  readonly textModels = TEXT_MODELS_FALLBACK_ORDER;
  readonly imageModels: string[] = [];

  info(): AIProviderInfo {
    return {
      id: this.id,
      label: this.label,
      supportsText: this.supportsText,
      supportsImages: this.supportsImages,
      configured: this.isConfigured(),
      isDefault: true,
      textModels: this.textModels,
      imageModels: this.imageModels,
    };
  }

  isConfigured(): boolean {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  }

  private apiKey(): string {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      throw tagError(new Error("DEEPSEEK_API_KEY environment variable is missing."), "auth");
    }
    return key;
  }

  /**
   * One completion request.
   *
   * A structured call arrives with a schema and a JSON mime type. The schema is
   * rendered into the system message - DeepSeek's JSON mode takes no schema
   * argument - and `response_format` is set so the model is constrained to
   * emit an object.
   */
  private async callModel(model: string, request: AITextRequest): Promise<{ text: string; raw: any }> {
    const options = request.options ?? {};
    const wantsJson = options.responseMimeType === "application/json" || Boolean(options.responseSchema);

    const systemParts: string[] = [];
    if (options.systemInstruction) systemParts.push(options.systemInstruction);
    if (wantsJson && options.responseSchema) systemParts.push(describeSchemaForPrompt(options.responseSchema));
    else if (wantsJson) systemParts.push("Reply with a single valid json object and nothing else.");

    const messages: Array<{ role: string; content: string }> = [];
    if (systemParts.length > 0) messages.push({ role: "system", content: systemParts.join("\n\n") });
    messages.push({ role: "user", content: request.prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: resolveMaxOutputTokens(options.maxOutputTokens),
      stream: false,
    };
    if (typeof options.temperature === "number") body.temperature = options.temperature;
    if (wantsJson) body.response_format = { type: "json_object" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TEXT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey()}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timer);
      const aborted = err?.name === "AbortError";
      throw tagError(
        new Error(aborted ? `Model '${model}' request timed out after ${TEXT_TIMEOUT_MS / 1000}s` : String(err?.message || err)),
        "timeout"
      );
    } finally {
      clearTimeout(timer);
    }

    const payload = await response.text();

    if (!response.ok) {
      let message = payload.slice(0, 300);
      try {
        message = JSON.parse(payload)?.error?.message || message;
      } catch {
        // Non-JSON error body: the raw text is the best diagnostic available.
      }
      const err = new Error(`DeepSeek ${response.status}: ${message}`);
      (err as any).status = response.status;
      throw tagError(err, classifyDeepSeekError(response.status, message), response.status);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw tagError(new Error(`Model '${model}' returned a non-JSON envelope.`), "provider_error");
    }

    const choice = parsed?.choices?.[0];
    const content = choice?.message?.content;
    const finish = choice?.finish_reason;

    // A completion cut off at the token ceiling yields structurally invalid
    // JSON. Surfaced as recoverable so the batch splitter can retry smaller,
    // never repaired into something that merely parses.
    if (finish === "length") {
      throw tagError(
        new Error(
          `Model '${model}' hit its output limit (${resolveMaxOutputTokens(options.maxOutputTokens)} tokens) and the reply is truncated. ` +
            `Retry with a smaller scene range.`
        ),
        "provider_error"
      );
    }

    // DeepSeek documents that the API "may occasionally return empty content".
    // It is a real, known failure mode rather than a sign the story is empty,
    // so it is raised as recoverable and the existing retry/split path handles
    // it. Nothing is ever synthesised to cover it.
    if (!content || !String(content).trim()) {
      throw tagError(
        new Error(
          `Model '${model}' returned empty content (finish_reason: ${finish ?? "none"}). ` +
            `This is a known intermittent DeepSeek response; retrying.`
        ),
        "provider_error"
      );
    }

    const text = wantsJson ? extractJsonPayload(String(content)) : String(content);

    if (wantsJson) {
      // Fail here rather than downstream: a JSON error at the provider boundary
      // is recoverable by the existing retry path, while the same error inside
      // the scene pipeline looks like a story failure.
      try {
        JSON.parse(text);
      } catch {
        throw tagError(
          new Error(`Model '${model}' returned malformed JSON (${String(content).length} chars).`),
          "provider_error"
        );
      }
    }

    return { text, raw: parsed };
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const models = request.models && request.models.length > 0 ? request.models : this.textModels;
    let lastError: any = null;

    for (let index = 0; index < models.length; index++) {
      const model = models[index];
      const startedAt = Date.now();
      try {
        console.log(`[DeepSeek] Requesting '${model}'...`);
        const { text, raw } = await this.callModel(model, request);
        console.log(`[DeepSeek] Successfully generated with model '${model}'.`);

        const usage = (raw as any)?.usage ?? {};
        recordCall({
          provider: this.id,
          model,
          maxTokensRequested: resolveMaxOutputTokens(request.options?.maxOutputTokens),
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
          cachedPromptTokens: usage.prompt_cache_hit_tokens,
          finishReason: (raw as any)?.choices?.[0]?.finish_reason,
          latencyMs: Date.now() - startedAt,
          outcome: "success",
        });

        return { text, model, provider: this.id, raw };
      } catch (err: any) {
        lastError = err;
        const status = err?.status;
        const message = err?.message || String(err);

        recordCall({
          provider: this.id,
          model,
          maxTokensRequested: resolveMaxOutputTokens(request.options?.maxOutputTokens),
          latencyMs: Date.now() - startedAt,
          outcome: "error",
          error: message.slice(0, 300),
        });

        if (isTerminalFailure(status, message)) {
          console.error(
            `[DeepSeek] Model '${model}' failed terminally (${message}). ` +
              `Not trying the remaining ${models.length - index - 1} fallback model(s) - they would fail identically.`
          );
          throw err;
        }

        console.log(`[DeepSeek] Model '${model}' failed (${message}). Moving to next fallback model...`);
        if (index < models.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }

    throw lastError || new Error("DeepSeek text generation failed with no further detail.");
  }

  /**
   * DeepSeek publishes no image-generation endpoint.
   *
   * Rejected honestly rather than faked. The Character Reference Studio already
   * treats image generation as best-effort and falls back to showing the
   * reference prompt for the operator to run elsewhere, so this degrades to
   * prompt-only rather than breaking.
   */
  async generateImage(_request: AIImageRequest): Promise<AIImageResponse> {
    throw tagError(
      new Error(
        "DeepSeek does not provide an image-generation API. The character reference PROMPTS are still generated " +
          "and can be copied into an image tool."
      ),
      // A capability this provider does not have. Non-recoverable by design:
      // retrying or failing over cannot make an image endpoint exist.
      "invalid_request"
    );
  }
}

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
 * OpenRouter adapter - text generation only.
 *
 * Verified against the live OpenRouter model API and the published docs (2026-09):
 *   - Base URL:      https://openrouter.ai/api/v1
 *   - Auth:          Authorization: Bearer <OPENROUTER_API_KEY>
 *   - Endpoint:      POST /chat/completions (OpenAI-compatible)
 *   - JSON output:   response_format supported by the selected models; the
 *                    defaults below also advertise structured_outputs
 *   - Errors:        { "error": { "code": number, "message": string, "metadata"?: {} } }
 *                    400 bad request, 401 invalid credentials, 402 insufficient
 *                    credits, 403 moderation/guardrail block, 408 timeout,
 *                    429 rate limited, 502 model down / invalid response,
 *                    503 no provider meets routing requirements
 *   - IMPORTANT:     OpenRouter may return HTTP 200 whose body holds only an
 *                    `error` object and no `choices`. This adapter checks for
 *                    that explicitly - see readCompletion().
 *   - Free tier:     :free models are capped at 20 requests/minute and
 *                    50 requests/day (1,000/day once $10 of credit has ever
 *                    been purchased). Rate-limit errors carry X-RateLimit-*.
 *
 * Image generation is not used here; character reference images stay on Gemini.
 */

/**
 * Defaults chosen from the live /models response, filtered to entries that are
 * genuinely free (":free" suffix with prompt and completion priced at "0"),
 * emit text, and advertise `response_format` so the pipeline's JSON mode works.
 *
 *   dots-studio/dots-3-note-preview:free    512K context / 460K max output
 *   nvidia/nemotron-3-super-120b-a12b:free  262K context / 236K max output
 *   openrouter/free                         200K context, Free Models Router
 *
 * The router is last on purpose: it picks among whatever free models exist at
 * request time, so the chain still resolves if a specific ID is retired.
 */
const DEFAULT_TEXT_MODELS = [
  "dots-studio/dots-3-note-preview:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openrouter/free",
];

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const TEXT_TIMEOUT_MS = 35000;

export class OpenRouterProvider implements AIProvider {
  readonly id = "openrouter";
  readonly label = "OpenRouter";
  readonly supportsText = true;
  readonly supportsImages = false;

  /** Read from the environment on access; the host may inject config late. */
  get textModels(): string[] {
    const configured = process.env.OPENROUTER_TEXT_MODELS;
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
    return (process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  private get maxTokens(): number | null {
    const raw = process.env.OPENROUTER_MAX_TOKENS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
  }

  isConfigured(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
  }

  private getApiKey(): string {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      // Tagged 'auth' so the manager treats it as terminal, never a failover trigger.
      throw tagError(new Error("OPENROUTER_API_KEY environment variable is missing."), "auth");
    }
    return apiKey;
  }

  /** Optional attribution headers; sent only when configured. */
  private attributionHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const site = process.env.OPENROUTER_SITE_URL;
    const title = process.env.OPENROUTER_APP_TITLE;
    if (site) headers["HTTP-Referer"] = site;
    if (title) headers["X-Title"] = title;
    return headers;
  }

  /**
   * OpenRouter supports response_format but the app's schema is stated in the
   * system message, exactly as on the Groq and CodeCraft paths. No Gemini
   * prompt is altered.
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

  /**
   * OpenRouter can answer 200 OK with a body containing only an `error`.
   * Surface that as a real error carrying the numeric code so the shared
   * classifier can decide whether to fail over.
   */
  private readCompletion(payload: any, model: string): string {
    if (payload && payload.error) {
      const code = Number(payload.error.code);
      const message = payload.error.message || "Unknown OpenRouter error";
      throw Object.assign(
        new Error(`OpenRouter model '${model}' returned an error payload: ${message}`),
        { status: Number.isFinite(code) ? code : undefined }
      );
    }

    const choice = payload?.choices?.[0];
    if (!choice) {
      throw tagError(
        new Error(`OpenRouter model '${model}' returned no choices.`),
        "provider_error"
      );
    }

    if (choice.finish_reason === "length") {
      // Truncated output is malformed JSON; recoverable so the scene-batch
      // splitter can retry with a smaller range.
      throw tagError(
        new Error(
          `OpenRouter model '${model}' hit the output token limit (finish_reason=length). Set OPENROUTER_MAX_TOKENS higher or use a smaller batch.`
        ),
        "provider_error"
      );
    }

    return choice?.message?.content || "";
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
        console.log(`[OpenRouter Text] Requesting '${model}'...`);

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
            ...this.attributionHeaders(),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          let reason = detail.slice(0, 300);
          try {
            const parsed = JSON.parse(detail);
            reason = parsed?.error?.message || reason;
          } catch {
            // keep the raw body snippet
          }

          if (res.status === 429) {
            const remaining = res.headers.get("x-ratelimit-remaining");
            const reset = res.headers.get("x-ratelimit-reset");
            console.log(
              `[OpenRouter Text] Rate limited on '${model}' (remaining=${remaining ?? "?"}, reset=${reset ?? "?"}). ` +
                `Free models allow 20 requests/minute and 50/day below $10 of lifetime credit.`
            );
          }

          throw Object.assign(
            new Error(`OpenRouter model '${model}' failed with HTTP ${res.status}: ${reason}`),
            { status: res.status }
          );
        }

        const payload: any = await res.json();
        const text = this.readCompletion(payload, model);

        if (text) {
          console.log(`[OpenRouter Text] Successfully generated with model '${model}'.`);
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
            new Error(`OpenRouter model '${model}' request timed out after 35s`),
            "timeout"
          );
        } else {
          lastError = err;
        }
        const reason = lastError?.message || String(lastError);
        console.log(`[OpenRouter Text] Model '${model}' unavailable (${reason}). Moving to next fallback model...`);

        if (mIdx < models.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    throw lastError || new Error("OpenRouter text models were unavailable. Please try again in a few moments.");
  }

  async generateImage(_request: AIImageRequest): Promise<AIImageResponse> {
    throw tagError(
      new Error("OpenRouter is configured for text generation only in AnamStudio. Character reference images are generated by Gemini."),
      "invalid_request"
    );
  }
}

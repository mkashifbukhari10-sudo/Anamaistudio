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
 * Groq adapter - text generation only.
 *
 * Groq exposes an OpenAI-compatible chat/completions endpoint. Structured
 * output is requested with response_format json_object, and the app's schema
 * (translated to standard JSON Schema) is stated in the system message so the
 * parsed object carries the same fields the Gemini path produces. No Gemini
 * prompt is altered - the schema contract below is appended only on this path.
 *
 * Image generation is NOT supported here; character reference images stay on
 * Gemini, and the manager's capability guard enforces that.
 */

const DEFAULT_TEXT_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
  "openai/gpt-oss-20b",
];

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const TEXT_TIMEOUT_MS = 35000;

export class GroqProvider implements AIProvider {
  readonly id = "groq";
  readonly label = "Groq";
  readonly supportsText = true;
  readonly supportsImages = false;

  /**
   * Read from the environment on access, not at construction: the host may
   * inject configuration after module load.
   */
  get textModels(): string[] {
    const configured = process.env.GROQ_TEXT_MODELS;
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
    return (process.env.GROQ_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  isConfigured(): boolean {
    return !!process.env.GROQ_API_KEY;
  }

  private getApiKey(): string {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      // Tagged 'auth' so the manager treats it as terminal, never a failover trigger.
      throw tagError(new Error("GROQ_API_KEY environment variable is missing."), "auth");
    }
    return apiKey;
  }

  /** Build the system message, appending the JSON contract when one is requested. */
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
    let lastError: any = null;

    for (let mIdx = 0; mIdx < models.length; mIdx++) {
      const model = models[mIdx];
      try {
        console.log(`[Groq Text] Requesting '${model}'...`);

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
          try {
            const parsed = JSON.parse(detail);
            reason = parsed?.error?.message || reason;
          } catch {
            // keep the raw body snippet
          }
          throw Object.assign(
            new Error(`Groq model '${model}' failed with HTTP ${res.status}: ${reason}`),
            { status: res.status }
          );
        }

        const payload: any = await res.json();
        const text = payload?.choices?.[0]?.message?.content;

        if (text) {
          console.log(`[Groq Text] Successfully generated with model '${model}'.`);
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
            new Error(`Groq model '${model}' request timed out after 35s`),
            "timeout"
          );
        } else {
          lastError = err;
        }
        const reason = lastError?.message || String(lastError);
        console.log(`[Groq Text] Model '${model}' unavailable (${reason}). Moving to next fallback model...`);

        if (mIdx < models.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    throw lastError || new Error("Groq text models were unavailable. Please try again in a few moments.");
  }

  async generateImage(_request: AIImageRequest): Promise<AIImageResponse> {
    throw tagError(
      new Error("Groq does not support image generation. Character reference images are generated by Gemini."),
      "invalid_request"
    );
  }
}

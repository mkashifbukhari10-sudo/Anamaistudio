import { GoogleGenAI } from "@google/genai";
import { tagError } from "./errors.js";
import { recordCall } from "./telemetry.js";
import type {
  AIImageRequest,
  AIImageResponse,
  AIProvider,
  AITextRequest,
  AITextResponse,
} from "./types.js";

/**
 * Google Gemini adapter.
 *
 * This file owns every Gemini-specific concern that used to sit in server.ts:
 * client construction, the model fallback chains, the per-attempt timeouts,
 * the quota/busy error classification, the retry spacing, and the inlineData
 * extraction for images. The behaviour is carried over verbatim - same model
 * order, same timeouts, same delays, same log lines, same thrown messages.
 */

/**
 * Strongest first, degrading only on a recoverable failure.
 *
 * The order used to lead with the *lite* model, which dated from when a batch
 * was a handful of small scenes. A batch is now up to 12 scenes and each one
 * carries a dense schema - contract, continuityState, dialogueTurns with four
 * required fields per turn, bystanders, openThread, worldText, two frame
 * descriptions and a full Flow prompt. Lite models are measurably less reliable
 * at long structured JSON, and one malformed scene costs the whole batch, so
 * the cheapest model is the most expensive place to start.
 *
 * Lite stays at the END: on a genuine rate limit a weaker completion beats no
 * completion. Every name here was verified against a real generateContent call
 * (npm run check:gemini) - being listed by models.list is not enough, as
 * gemini-2.5-flash is listed and 404s.
 */
const TEXT_MODELS_FALLBACK_ORDER = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
];

const IMAGE_MODELS_FALLBACK_ORDER = [
  "gemini-3.1-flash-lite-image",
  "gemini-3.1-flash-image",
];

/**
 * Per-attempt ceiling for one model in the fallback chain.
 *
 * Was 35 seconds, which was sized when a batch was a handful of small scenes.
 * A batch is now up to 12 scenes and each scene's prompt carries a beat clock,
 * a performance track, in-frame text and two full frame descriptions - so 35s
 * expires mid-generation and the chain burns through every model before
 * failing. Matches the DeepSeek adapter's ceiling, which is sized for the same
 * work.
 */
const TEXT_TIMEOUT_MS = 420000;

/**
 * Failures that every model in the chain will reproduce.
 *
 * Auth, permission and malformed-request errors are properties of the key, the
 * project or the payload - not of the model - so retrying across the fallback
 * chain costs several seconds and yields the same result. Quota (429) and
 * unavailability (503) are genuinely per-model and stay retryable.
 */
function isTerminalFailure(code: unknown, rawMsg: string): boolean {
  const numeric = Number(code);
  if (numeric === 401 || numeric === 403 || numeric === 400 || numeric === 404) return true;
  return (
    /PERMISSION_DENIED|UNAUTHENTICATED|API key not valid|API_KEY_INVALID|denied access|INVALID_ARGUMENT|NOT_FOUND/i.test(
      rawMsg
    )
  );
}

/** Plain-language cause, so the log names the real problem. */
function describeTerminalFailure(code: unknown, rawMsg: string): string {
  if (/denied access|PERMISSION_DENIED/i.test(rawMsg)) {
    return "HTTP 403 - the Google project behind GEMINI_API_KEY is denied access to generateContent. " +
      "The key itself is valid (it can list models); the PROJECT is blocked. Create a key against a " +
      "different project at https://aistudio.google.com/apikey, or enable billing on this one";
  }
  if (/API key not valid|API_KEY_INVALID|UNAUTHENTICATED/i.test(rawMsg)) {
    return "the GEMINI_API_KEY is invalid or expired - issue a new one at https://aistudio.google.com/apikey";
  }
  if (Number(code) === 404 || /NOT_FOUND/i.test(rawMsg)) {
    return "the model name does not exist for this key - check TEXT_MODELS_FALLBACK_ORDER";
  }
  if (Number(code) === 400 || /INVALID_ARGUMENT/i.test(rawMsg)) {
    return "the request was malformed (schema or payload), not a service problem";
  }
  return `HTTP ${String(code)}`;
}
const IMAGE_TIMEOUT_MS = 20000;

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly label = "Google Gemini";
  readonly supportsText = true;
  readonly supportsImages = true;
  readonly textModels = TEXT_MODELS_FALLBACK_ORDER;
  readonly imageModels = IMAGE_MODELS_FALLBACK_ORDER;


  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  /**
   * Built per call, not cached: the hosting environment injects
   * GEMINI_API_KEY at runtime, so the key is read at request time exactly as
   * the original getGeminiClient() did.
   */
  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Tagged 'auth' so the manager treats it as terminal. Message unchanged.
      throw tagError(new Error("GEMINI_API_KEY environment variable is missing."), "auth");
    }

    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const ai = this.getClient();
    const models = request.models && request.models.length > 0 ? request.models : this.textModels;
    let lastError: any = null;

    for (let mIdx = 0; mIdx < models.length; mIdx++) {
      const model = models[mIdx];
      const startedAt = Date.now();
      try {
        console.log(`[Gemini Text] Requesting '${model}'...`);

        // Enforce 35s timeout per model attempt
        const modelPromise = ai.models.generateContent({
          model,
          contents: request.prompt,
          config: request.options as any,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model '${model}' request timed out after ${Math.round(TEXT_TIMEOUT_MS / 1000)}s`)), TEXT_TIMEOUT_MS)
        );

        const response = await Promise.race([modelPromise, timeoutPromise]);

        if (response && (response.text || response.candidates)) {
          console.log(`[Gemini Text] Successfully generated with model '${model}'.`);

          // This adapter predates the telemetry module, so until now every
          // Gemini run reported "unknown / unknown" and zero tokens - no cost
          // visibility on a sixty-scene film, and attributionFrom() had nothing
          // to read.
          const usage = (response as any)?.usageMetadata ?? {};
          recordCall({
            provider: this.id,
            model,
            maxTokensRequested: (request.options as any)?.maxOutputTokens,
            promptTokens: usage.promptTokenCount,
            completionTokens: usage.candidatesTokenCount,
            reasoningTokens: usage.thoughtsTokenCount,
            cachedPromptTokens: usage.cachedContentTokenCount,
            finishReason: (response as any)?.candidates?.[0]?.finishReason,
            latencyMs: Date.now() - startedAt,
            outcome: "success",
          });

          return {
            text: response.text,
            model,
            provider: this.id,
            raw: response,
          };
        }
      } catch (err: any) {
        lastError = err;
        const code = err?.status || err?.code || err?.error?.code || err?.error?.status;
        const rawMsg = err?.message || String(err);

        // Failures are recorded too: a report that shows which model was tried
        // and why it fell through is the only way to explain a partial run.
        recordCall({
          provider: this.id,
          model,
          latencyMs: Date.now() - startedAt,
          outcome: "error",
          error: `${code ? `${code}: ` : ""}${rawMsg}`.slice(0, 300),
        });
        const isQuotaOrBusy =
          code === 429 ||
          code === 503 ||
          rawMsg.includes("429") ||
          rawMsg.includes("503") ||
          rawMsg.includes("quota") ||
          rawMsg.includes("high demand") ||
          rawMsg.includes("RESOURCE_EXHAUSTED") ||
          rawMsg.includes("UNAVAILABLE");

        // A terminal failure is the same on every model: a denied project, a
        // bad key or a malformed request will not start working on the next
        // one. Walking the whole chain wastes seconds and, worse, reports the
        // cause as "service busy" - which sends you looking for an outage that
        // is not there.
        if (isTerminalFailure(code, rawMsg)) {
          console.error(
            `[Gemini Text] Model '${model}' failed terminally (${describeTerminalFailure(code, rawMsg)}). ` +
              `Not trying the remaining ${models.length - mIdx - 1} fallback model(s) - they would fail identically.`
          );
          throw err;
        }

        const briefReason = isQuotaOrBusy ? "rate-limited or temporary high demand" : "a transient error";
        console.log(`[Gemini Text] Model '${model}' hit ${briefReason}. Moving to next fallback model...`);

        if (mIdx < models.length - 1) {
          const delay = isQuotaOrBusy ? 600 : 300;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("The AI model service is currently experiencing high demand. Please try again in a few moments.");
  }

  async generateImage(request: AIImageRequest): Promise<AIImageResponse> {
    const ai = this.getClient();
    const models = request.models && request.models.length > 0 ? request.models : this.imageModels;
    let lastError: any = null;

    for (let mIdx = 0; mIdx < models.length; mIdx++) {
      const model = models[mIdx];
      try {
        console.log(`[Gemini Image] Requesting '${model}'...`);

        const modelPromise = ai.models.generateContent({
          model,
          contents: request.prompt,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Image model '${model}' timed out after 20s`)), IMAGE_TIMEOUT_MS)
        );

        const response = await Promise.race([modelPromise, timeoutPromise]);

        if (response && response.candidates && response.candidates.length > 0) {
          // Gemini returns image bytes as an inlineData part; unwrapping it is
          // provider-specific, so it belongs here rather than in the route.
          const candidate = response.candidates[0];
          const part = candidate.content?.parts?.find((p: any) => p.inlineData);
          if (part && part.inlineData) {
            const mimeType = part.inlineData.mimeType || "image/png";
            const base64Data = part.inlineData.data;
            return {
              imageDataUrl: `data:${mimeType};base64,${base64Data}`,
              mimeType,
              model,
              provider: this.id,
              raw: response,
            };
          }

          // Candidates but no image payload: the original code returned this
          // response to the caller, which then answered 503. Preserved.
          return {
            imageDataUrl: null,
            model,
            provider: this.id,
            raw: response,
          };
        }
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        const code = err?.status || err?.code || err?.error?.code;
        const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");

        if (isTerminalFailure(code, msg)) {
          console.error(
            `[Gemini Image] Model '${model}' failed terminally (${describeTerminalFailure(code, msg)}). ` +
              `Skipping the remaining fallback model(s). The reference prompt is still available to copy.`
          );
          throw err;
        }

        console.log(`[Gemini Image] Model '${model}' ${isQuota ? 'requires paid API quota' : 'unavailable'}. Prompt is available to copy.`);
        if (mIdx < models.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    throw lastError || new Error("Direct image generation models were unavailable on this key. The reference prompt is ready to copy.");
  }
}

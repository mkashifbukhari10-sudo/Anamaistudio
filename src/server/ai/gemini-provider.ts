import { GoogleGenAI } from "@google/genai";
import { tagError } from "./errors.js";
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

const TEXT_MODELS_FALLBACK_ORDER = [
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-3.7-flash",
];

const IMAGE_MODELS_FALLBACK_ORDER = [
  "gemini-3.1-flash-lite-image",
  "gemini-3.1-flash-image",
];

const TEXT_TIMEOUT_MS = 35000;
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
      try {
        console.log(`[Gemini Text] Requesting '${model}'...`);

        // Enforce 35s timeout per model attempt
        const modelPromise = ai.models.generateContent({
          model,
          contents: request.prompt,
          config: request.options as any,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model '${model}' request timed out after 35s`)), TEXT_TIMEOUT_MS)
        );

        const response = await Promise.race([modelPromise, timeoutPromise]);

        if (response && (response.text || response.candidates)) {
          console.log(`[Gemini Text] Successfully generated with model '${model}'.`);
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
        const isQuotaOrBusy =
          code === 429 ||
          code === 503 ||
          rawMsg.includes("429") ||
          rawMsg.includes("503") ||
          rawMsg.includes("quota") ||
          rawMsg.includes("high demand") ||
          rawMsg.includes("RESOURCE_EXHAUSTED") ||
          rawMsg.includes("UNAVAILABLE");

        const briefReason = isQuotaOrBusy ? "rate-limited or temporary high demand" : "service busy";
        console.log(`[Gemini Text] Model '${model}' was ${briefReason}. Moving to next fallback model...`);

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
        const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
        console.log(`[Gemini Image] Model '${model}' ${isQuota ? 'requires paid API quota' : 'unavailable'}. Prompt is available to copy.`);
        if (mIdx < models.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    throw lastError || new Error("Direct image generation models were unavailable on this key. The reference prompt is ready to copy.");
  }
}

import {
  AllProvidersFailedError,
  classifyError,
  type AIProviderAttempt,
} from "./errors.js";
import type {
  AIImageRequest,
  AIImageResponse,
  AIProvider,
  AIProviderInfo,
  AITextRequest,
  AITextResponse,
} from "./types.js";

const DEFAULT_COOLDOWN_MS = 60000;

/**
 * Registry, selection and cross-provider failover.
 *
 * Selection order for a call:
 *   1. request.provider  - pins one provider, failover disabled
 *   2. AI_PROVIDER        - names the primary
 *   3. registration order - Gemini is registered first
 *
 * Failover rules:
 *   - Each provider is attempted AT MOST ONCE per request. The chain is the
 *     finite list of capable providers, so retries are bounded and there is no
 *     loop that can spin.
 *   - A provider is only skipped-to when the previous failure was classified
 *     recoverable (rate limit, quota, timeout, unavailable, provider error).
 *   - A terminal failure (invalid request, safety block, auth, unknown) is
 *     rethrown immediately without touching the next provider.
 *   - A recoverable failure puts the provider in cooldown so later requests
 *     skip it until it expires. If EVERY provider is cooling down the cooldown
 *     is ignored rather than hard-failing.
 *   - Unconfigured providers are skipped. If none are configured the primary is
 *     still attempted, so its original "API key missing" error surfaces intact.
 *   - When only one provider was attempted, its error is rethrown untouched -
 *     single-provider deployments keep their exact legacy error messages.
 */
export class AIProviderManager {
  private readonly providers = new Map<string, AIProvider>();
  private readonly cooldowns = new Map<string, number>();
  private defaultId: string | null = null;

  register(provider: AIProvider): this {
    this.providers.set(provider.id, provider);
    if (!this.defaultId) {
      this.defaultId = provider.id;
    }
    return this;
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  /** Ids of every registered provider, in registration order. */
  ids(): string[] {
    return [...this.providers.keys()];
  }

  /** The provider id used when a call does not name one. */
  getDefaultId(): string {
    const configured = process.env.AI_PROVIDER;
    if (configured && this.providers.has(configured)) {
      return configured;
    }
    if (configured && !this.providers.has(configured)) {
      throw new Error(
        `AI_PROVIDER is set to '${configured}', which is not registered. Available providers: ${this.ids().join(", ") || "none"}.`
      );
    }
    if (!this.defaultId) {
      throw new Error("No AI provider has been registered.");
    }
    return this.defaultId;
  }

  resolve(id?: string): AIProvider {
    const targetId = id || this.getDefaultId();
    const provider = this.providers.get(targetId);
    if (!provider) {
      throw new Error(
        `Unknown AI provider '${targetId}'. Available providers: ${this.ids().join(", ") || "none"}.`
      );
    }
    return provider;
  }

  // ---------------------------------------------------------------- cooldown

  private get cooldownMs(): number {
    const raw = process.env.AI_PROVIDER_COOLDOWN_MS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_COOLDOWN_MS;
  }

  isCoolingDown(id: string): boolean {
    const until = this.cooldowns.get(id);
    if (until === undefined) return false;
    if (Date.now() >= until) {
      this.cooldowns.delete(id);
      return false;
    }
    return true;
  }

  /** Milliseconds left on a provider's cooldown (0 when ready). */
  cooldownRemaining(id: string): number {
    const until = this.cooldowns.get(id);
    if (until === undefined) return 0;
    return Math.max(0, until - Date.now());
  }

  private startCooldown(id: string): void {
    const ms = this.cooldownMs;
    if (ms > 0) {
      this.cooldowns.set(id, Date.now() + ms);
    }
  }

  private clearCooldown(id: string): void {
    this.cooldowns.delete(id);
  }

  /** Test/ops hook: forget all cooldowns. */
  resetCooldowns(): void {
    this.cooldowns.clear();
  }

  // ------------------------------------------------------------------- chain

  private buildChain(capability: "text" | "image", requested?: string): AIProvider[] {
    if (requested) {
      // An explicit provider pin disables failover by design.
      return [this.resolve(requested)];
    }

    const primaryId = this.getDefaultId();
    const capable = [...this.providers.values()].filter((p) =>
      capability === "text" ? p.supportsText : p.supportsImages
    );

    if (capable.length === 0) {
      throw new Error(`No registered AI provider supports ${capability} generation.`);
    }

    // Primary first, then the rest in registration order.
    const ordered = [
      ...capable.filter((p) => p.id === primaryId),
      ...capable.filter((p) => p.id !== primaryId),
    ];

    const configured = ordered.filter((p) => p.isConfigured());
    // Nothing configured: still attempt the primary so its own credential
    // error is what the caller sees.
    const base = configured.length > 0 ? configured : ordered.slice(0, 1);

    const ready = base.filter((p) => !this.isCoolingDown(p.id));
    // Everything cooling down: ignore cooldown rather than fail outright.
    return ready.length > 0 ? ready : base;
  }

  // -------------------------------------------------------------- generation

  private async runChain<TRequest extends { provider?: string }, TResponse>(
    capability: "text" | "image",
    request: TRequest,
    invoke: (provider: AIProvider) => Promise<TResponse>
  ): Promise<TResponse> {
    const chain = this.buildChain(capability, request.provider);
    const attempts: AIProviderAttempt[] = [];
    const errors: any[] = [];

    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      try {
        const result = await invoke(provider);
        this.clearCooldown(provider.id);
        return result;
      } catch (err: any) {
        const classification = classifyError(err);
        attempts.push({
          provider: provider.id,
          kind: classification.kind,
          recoverable: classification.recoverable,
          message: classification.message,
        });
        errors.push(err);

        if (!classification.recoverable) {
          // Terminal: another provider would fail identically. Surface as-is.
          console.log(
            `[AI] Provider '${provider.id}' returned a terminal ${classification.kind} error. Not failing over.`
          );
          throw err;
        }

        this.startCooldown(provider.id);

        const next = chain[i + 1];
        if (next) {
          console.log(
            `[AI] Provider '${provider.id}' failed (${classification.kind}). Failing over to '${next.id}'...`
          );
        } else {
          console.log(
            `[AI] Provider '${provider.id}' failed (${classification.kind}). No providers left in the chain.`
          );
        }
      }
    }

    // Only one provider was tried: preserve its original error verbatim.
    if (errors.length === 1) {
      throw errors[0];
    }
    throw new AllProvidersFailedError(attempts);
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    return this.runChain("text", request, (provider) => {
      if (!provider.supportsText) {
        throw new Error(`Provider '${provider.id}' does not support text generation.`);
      }
      return provider.generateText(request);
    });
  }

  async generateImage(request: AIImageRequest): Promise<AIImageResponse> {
    return this.runChain("image", request, (provider) => {
      if (!provider.supportsImages) {
        throw new Error(`Provider '${provider.id}' does not support image generation.`);
      }
      return provider.generateImage(request);
    });
  }

  /** Diagnostics snapshot. Never includes credentials. */
  describe(): AIProviderInfo[] {
    let defaultId: string | null = null;
    try {
      defaultId = this.getDefaultId();
    } catch {
      defaultId = null;
    }
    return [...this.providers.values()].map((provider) => ({
      id: provider.id,
      label: provider.label,
      supportsText: provider.supportsText,
      supportsImages: provider.supportsImages,
      configured: provider.isConfigured(),
      isDefault: provider.id === defaultId,
      textModels: provider.textModels,
      imageModels: provider.imageModels,
      coolingDown: this.isCoolingDown(provider.id),
      cooldownRemainingMs: this.cooldownRemaining(provider.id),
    }));
  }
}

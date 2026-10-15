# GPT-6 Astra migration plan

## Goal and migration boundary

Move the application's five story/text generation paths to OpenAI's Responses API with `gpt-6-astra` as the primary text model, while preserving the current provider-neutral contract, JSON output shapes, retry behavior, long-form batching, telemetry, and Gemini image generation.

This is a compatibility migration, not a model-string replacement. The current text paths all use structured JSON, pass `temperature`, and rely on schemas that allow some fields to be omitted. GPT-6 Astra rejects `temperature`, `top_p`, and logprob parameters, and OpenAI strict Structured Outputs require every field to be required plus `additionalProperties: false` on objects. Those differences must be handled inside the OpenAI adapter so the story engine does not silently change behavior.

Official references:

- [GPT-6 Astra migration guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [GPT-6 Astra model and current limits](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [Responses API quickstart](https://developers.openai.com/api/docs/quickstart)
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

## Current usage inventory

| Workload | Call site | Current API surface | Output contract | Migration class |
| --- | --- | --- | --- | --- |
| Scene batches | `server.ts` around `generateScenesBatch` | `generateText()` through provider manager | `{ scenes: [...] }` JSON schema | Compatibility migration |
| Narrative blueprint | `server.ts` blueprint phase | `generateText()` | Large blueprint JSON schema | Compatibility migration |
| Screenplay and character bible | `server.ts` phase 1 | `generateText()` | Story, character, chapter JSON | Compatibility migration |
| Single-scene regeneration | `server.ts` scene regeneration route | `generateText()` | `{ scene: ... }` JSON schema | Compatibility migration |
| Character generation | `server.ts` character route | `generateText()` | `{ characters: [...] }` JSON schema | Compatibility migration |
| Character reference images | `server.ts` image route | `generateImage()` | Data URL | Leave on Gemini |

The five text paths already share `AITextRequest` and `AITextResponse`, so their prompts and downstream `JSON.parse` calls do not need to be rewritten. The existing Gemini and DeepSeek adapters should remain intact as fallbacks. Historical reports, audits, fixtures, and provider-specific connectivity checks should not be rewritten.

Current behavioral facts to preserve:

- Gemini is registered first and is currently the default text and image provider; DeepSeek is the text fallback.
- `AI_PROVIDER` can pin the primary provider without changing call sites.
- Scene generation uses batches of 12. That is a reliability choice validated by this project, even though model output ceilings permit more.
- Text attempts allow up to seven minutes, and long-running HTTP requests have separate server timeouts.
- Call sites request JSON and pass temperatures of `0.7` or `0.8`.
- The repository has 42 object schema declarations, 40 `required` arrays, and no `additionalProperties` declarations. Some omitted fields are intentional, including the optional life-journey branch.
- Baseline TypeScript checking passes. The test command is currently blocked before the first test by a host `ENOMEM` error from `tsx` calling `uv_os_get_passwd`; this is an environment baseline issue, not a test assertion failure.

## Target mapping

| Existing role | Target | Reason |
| --- | --- | --- |
| All five quality-critical story/text calls | `gpt-6-astra` through Responses API | These are long, interdependent creative and reasoning workloads where the flagship model fits the existing quality-first role. |
| Character reference image generation | Gemini image models, unchanged | The current contract expects a provider to return image bytes as a data URL. Astra's image-generation tool is not a drop-in implementation of that adapter contract. |
| Gemini text adapter | Keep as fallback | Preserves a tested rollback and cross-provider recovery path. |
| DeepSeek text adapter | Keep as later fallback | Preserves the existing cost/availability fallback rather than collapsing the router into one provider. |

Start Astra at `reasoning.effort: "low"`, because the current providers have no directly transferable OpenAI reasoning setting and Astra does not support `none`. Compare `low` with `medium` on representative story runs before selecting the production value. Do not add pro mode, async tools, persisted reasoning, WebSocket steering, or explicit prompt caching during the baseline migration.

## Implementation sequence

### 1. Add the OpenAI provider behind the existing switch

- Add the official OpenAI JavaScript SDK to `package.json` and lock it in `package-lock.json`.
- Create `src/server/ai/openai-provider.ts` implementing `AIProvider`.
- Use `OPENAI_API_KEY` only on the server and the Responses API with the exact model ID `gpt-6-astra`.
- Initially register the provider without changing the default order. Exercise it with `AI_PROVIDER=openai`; after validation, make it the first registered text provider or set `AI_PROVIDER=openai` in each deployment.
- Export the provider from `src/server/ai/index.ts` and add it to diagnostics.
- Fix `describeProviderSetup()` so it reports and warns about `aiProviders.getDefaultId()`, not `readiness()[0]`. This matters during a staged rollout where `AI_PROVIDER=openai` overrides registration order.

The adapter should build a Responses request with:

- `model: "gpt-6-astra"`;
- `instructions` from `systemInstruction` and `input` from `prompt`;
- `reasoning: { effort: "low" }` initially, with a validated server-side override such as `OPENAI_REASONING_EFFORT` limited to Astra's supported values;
- `max_output_tokens` clamped to Astra's current 128,000-token maximum; retain the project's current 120,000 default initially because it already covers the measured 12-scene workload and leaves room for reasoning tokens;
- `text.format` for JSON requests and plain text format otherwise;
- no forwarded `temperature`, `top_p`, `top_logprobs`, `logprobs`, or `message.output_text.logprobs` fields;
- an explicit storage choice. Use `store: false` to preserve the current stateless provider behavior unless product requirements call for stored responses.

Keep `temperature` in the provider-neutral request type because Gemini and DeepSeek still use it. The OpenAI adapter should intentionally ignore it and a unit test should prove that it never reaches the Astra request.

### 2. Bridge the existing schemas safely

- Reuse `toJsonSchema()` to translate the repository's uppercase type vocabulary to standard JSON Schema.
- Begin with Responses `text.format: { type: "json_schema", strict: false, ... }`. This preserves optional fields during the first compatibility pass while still supplying the full schema to Astra.
- Continue validating that `response.output_text` is non-empty and valid JSON at the provider boundary before returning it to `server.ts`.
- Add a schema-compatibility test that walks every production response schema and reports unsupported keywords or shapes.

Move to `strict: true` as a second, separately measured step:

1. Recursively add `additionalProperties: false` to every object.
2. Encode each intentionally optional property as nullable, then include every property in `required`, as required by OpenAI strict Structured Outputs.
3. Normalize nullable placeholders back to the omission semantics expected by the current application.
4. Run all five generation paths before enabling strict mode by default.

Do not make every current property required without the nullable/normalization layer. That would change story behavior, especially the optional life-journey data.

### 3. Preserve failure and retry behavior

Map OpenAI SDK errors and Responses states onto the existing shared error taxonomy:

- 401 -> `auth`; 403 entitlement failures -> `access_denied`; 429 -> `rate_limit`; 5xx/network failures -> `unavailable`; timeout/abort -> `timeout`.
- Invalid schemas, context overflow, safety refusals, and malformed requests -> terminal `invalid_request`, so the same request is not sent to another provider.
- `status: "incomplete"` with `incomplete_details.reason: "max_output_tokens"`, empty output, or malformed JSON -> recoverable `provider_error`, allowing the existing fallback and batch-splitting paths to run.
- Preserve the raw Responses object in `AITextResponse.raw` for diagnostics and return `response.output_text` as the provider-neutral `text` value.

Keep the current seven-minute attempt ceiling for the first Astra trial. Change it only after real p95 latency data exists. Move `MAX_SCENES_PER_BATCH` out of `deepseek-provider.ts` into a provider-neutral generation-limits module; retain the value 12.

### 4. Complete telemetry, configuration, and documentation

- Record the actual `response.model`, `usage.input_tokens`, `usage.output_tokens`, `usage.output_tokens_details.reasoning_tokens`, `usage.input_tokens_details.cached_tokens`, response status, incomplete reason, and latency.
- Keep the existing report fields stable so current development reports continue to work.
- Add `OPENAI_API_KEY`, `OPENAI_REASONING_EFFORT=low`, and `AI_PROVIDER=openai` examples to `.env.example`. Update the allowed `AI_PROVIDER` values and explain that images still require Gemini.
- Update `README.md` to use the actual `.env` loading behavior and document the OpenAI-primary/Gemini-image setup.
- Add a `check:openai` script analogous to `check:gemini`. It should verify the key, make one tiny Responses request with `gpt-6-astra`, verify one minimal structured response, and never print the key.
- Update server startup diagnostics for both the local and self-hosted production entry points.

### 5. Validate before cutover

Unit and contract checks:

- OpenAI request construction emits Responses fields and excludes unsupported parameters.
- Schema translation preserves descriptions, enums, arrays, nested objects, required fields, and intentional optionality.
- Successful structured output returns parseable JSON through the unchanged `AITextResponse` contract.
- Refusal, incomplete output, timeout, auth, rate-limit, invalid-schema, and 5xx cases receive the correct shared classification.
- `AI_PROVIDER=openai` makes OpenAI the first text attempt; a recoverable OpenAI failure falls through to Gemini; image generation still selects Gemini.
- Telemetry maps Responses token fields correctly and records the returned model ID.

Repository checks:

```text
npm run lint
npm test
npm run build
npm run check:openai
```

The live smoke check requires an OpenAI API key and incurs a small API charge. Run it only in an environment intended for API testing.

Representative eval matrix:

| Variant | Prompt | Provider/model setting | Purpose |
| --- | --- | --- | --- |
| Baseline | Current | Current Gemini primary | Capture current quality, latency, validity, and cost proxy |
| Migration baseline | Unchanged | Astra, `low` | Isolate the model/API change |
| Reasoning trial | Unchanged | Astra, `medium` | Test whether quality gains justify latency and output-token cost |
| Compatibility fix | Only if a measured failure requires it | Selected Astra effort | Validate the smallest schema or prompt correction |

Run at least one representative request for each of the five text paths, including one full 12-scene batch and one long-form story. Measure JSON parse success, existing story quality gates, completion rate, retries, end-to-end latency, input/output/reasoning/cached tokens, and cost per successful story. Current Astra pricing is $10 per million input tokens, $1 per million cached input tokens, $12.50 per million cache-write tokens, and $50 per million output tokens; prompts above 272,000 input tokens use higher long-context rates, so flag any call that crosses that threshold.

### 6. Roll out and retain a quick rollback

1. Deploy the adapter with the old default and run `AI_PROVIDER=openai` in development/staging.
2. Compare Astra `low` and `medium`; choose one production effort based on quality and cost per successful story.
3. Enable OpenAI as primary for a limited production slice while preserving Gemini and DeepSeek fallbacks.
4. Watch parse failures, incomplete responses, failover rate, p95 latency, reasoning-token share, and cost per story.
5. Make OpenAI the default only after the full story path passes. Roll back instantly by setting `AI_PROVIDER=gemini`; no prompt or route rollback should be required.

## Definition of done

- All five text-generation paths complete through `gpt-6-astra` using the Responses API.
- Existing JSON consumers and story validation gates pass without weakening schemas or business rules.
- Unsupported Astra parameters never reach the API.
- The selected reasoning effort is backed by a low-versus-medium evaluation.
- Gemini image generation still returns the same data-URL contract.
- Provider fallback, cooldown, diagnostics, and telemetry accurately represent OpenAI.
- Type checking, tests, production build, the OpenAI smoke check, and a representative long-form generation pass.
- Deployment can return to Gemini by changing only `AI_PROVIDER`.

## Known baseline issue

`npm run lint` passes on the current worktree. `npm test` currently exits before running assertions because Node/`tsx` receives `uv_os_get_passwd returned ENOMEM` on this host. Resolve or rerun that environment failure before using the existing test suite as a migration acceptance signal.

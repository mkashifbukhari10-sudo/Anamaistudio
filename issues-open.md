# Issues from the first real test

Recorded 2026-09-19, after the first generation on the post-Phase-5 pipeline
("Ek Palre Ka Tarazu", 11 scenes). Evidence: a Flow/Veo output frame showing a
**comic-strip grid**, not a single cinematic shot.

---

## ISSUE 1 — Veo rendered a COMIC PAGE, not a video shot
### *(cause confirmed · fixed in code · unproven until the next generation)*

### What was seen

One clip came back as **four to six panels in a grid**, each with its own
framing, plus **speech balloons with the dialogue written inside them**. A
storyboard page, not a shot.

### Cause, confirmed against the prompt that produced it

`test-output/2026-09-19T15-41-49-881Z__complete__ek-palre-ka-tarazu.md`,
Scene 2, exactly as it was pasted into Flow:

```
Beat timing across the 8-second shot:
0.0-0.5s Gajjar counts coins one by one into the open tin...
0.5-3.8s Gajjar says, "Sau assee ka target. Do rupay kam, hai na?"...
3.8-7.1s Tamaatar says, "Mashhoor tarazu wahi — ya aaj nayi toli se tola?"...
7.1-8.0s Gajjar says, "Wahi."...
```

**Four timestamped rows of framings, each with quoted dialogue.** That is the
shape of a storyboard or comic script, and it was rendered as one — one panel
per row, the quoted lines as balloons. All 11 shipped prompts carried this block.

This was introduced by Phase B (the beat clock). The timing problem it solved was
real — 0 of 36 prompts previously carried any time cue — but the **form** was
wrong.

It also explains Issue 2: the dialogue was not being *performed*, it was being
*drawn*.

### What changed

| file | change |
|---|---|
| `beat-clock.ts` | `renderBeatClock()` rewritten as **one paragraph of prose** — no rows, no leading timestamps. **One** mid-shot time anchor instead of one per beat: seven timings in eight seconds is over-specification, and the repetition was itself the list-like rhythm being rendered. |
| `seam.ts` | New `SHOT_DECLARATION`, the **first thing in every prompt**: one continuous unbroken take, one moving camera, no panels, no split screen, no grid, no storyboard, no comic layout, no words drawn over the picture, all dialogue spoken aloud and lip-synced. |
| `seam.ts` | `Opening frame:` / `Closing frame:` → `The shot opens on:` / `The shot ends on:`. The old labels read as form fields in a spec sheet. **The seam text either side of a join stays byte-identical**, so Phase A is intact. |
| `seam.ts` | `worldText` reworded from *"Text visible in frame, rendered exactly and legibly"* to *"The lettering visible in the shot reads exactly"* — a fact about the scene rather than an instruction to render text. |
| `prompt-continuity.ts` | 15 terms added to `VIDEO_NEGATIVE_PROMPT`: comic panel, comic strip, storyboard, multiple panels, panel grid, split screen, collage, contact sheet, film strip, speech bubble, speech balloon, caption box, subtitle bar, montage grid, side by side frames. |

### The same scene, after

```
The shot plays out over its 8 seconds like this: it opens on a brief moment where
Gajjar counts coins one by one into the open tin and taps its chalked lid while
Tamaatar leans across the gap with his crate-lid fan; then Gajjar says, "Sau assee
ka target. Do rupay kam, hai na?"; around 3.8 seconds in, Tamaatar says, "Mashhoor
tarazu wahi — ya aaj nayi toli se tola?"; and it closes as Gajjar says, "Wahi."
```

### Regression

`tsc --noEmit` clean. Full suite **905 passed, 0 failed**. Phase A exit criteria
still PASS — **190/190 joins**, asymmetry 0.99. Build succeeds.

Tests now assert the new shape directly: the clock is one paragraph, no clause
begins with a timestamp, at most one mid-shot anchor, every spoken line survives
in order, and the old form-field labels are gone.

### Still unproven

This is a **rendering behaviour**. Only a real generation through Flow settles
whether the panels stop. It is the first thing to check in the next output.

---

## ISSUE 2 — Dialogue does not follow the intended flow *(re-assess after Issue 1)*

The spoken lines did not play as a conversation moving through the shot.

If the clip was rendered as a comic page, the dialogue was drawn rather than
spoken, so "flow" could not exist. **Do not chase this separately yet** — it may
disappear with Issue 1, and changing dialogue rules that are not at fault would
undo work that is measurably correct.

If it survives the next generation, the next suspects are:
- the clock's ordering not matching the action described in the prompt body
- `accompanyingAction` (now required) contradicting the beat for the same line

---

## ISSUE 3 — Provider attribution was false *(fixed)*

The saved report hardcoded `provider: "deepseek"` / `model: "deepseek-flash"` —
a false claim about the run's own source once a second provider existed. Now
derived from telemetry via `attributionFrom()`: the provider and model that
actually served the run.

---

## Shifted to Gemini

| | |
|---|---|
| `src/server/ai/gemini-provider.ts` | Restored from git history (deleted in `7411829`). |
| `@google/genai` | Reinstalled (`^2.23.0`). |
| `src/server/ai/index.ts` | **Gemini registered first (primary), DeepSeek second (fallback).** |
| `TEXT_TIMEOUT_MS` | **35s → 420s.** The old value was sized for small batches; a 12-scene batch with a beat clock, performance track and two frame descriptions per scene would have expired mid-generation and burned the whole model chain. |
| `src/server/ai/telemetry.ts` | New `attributionFrom()`. |

`GEMINI_API_KEY` must be set. A bad key or a denied project is **terminal** and
is rethrown rather than silently falling through to DeepSeek.

Gemini also has an image endpoint, so the Character Reference Studio can
generate reference images again instead of prompt-only.

### Not yet verified

`MAX_SCENES_PER_BATCH = 12` and the 384K output ceiling are **DeepSeek**
properties. Gemini's limits differ. If batches come back truncated or incomplete,
this is the first thing to check.

---

## Standing

`src/server/auth/users.ts` still ships `admin` / `change-me-now`. `APP_USERS`
must be set before any deployment.

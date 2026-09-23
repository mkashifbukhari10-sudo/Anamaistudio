# Audit — Why the Flow/Veo clips do not read as one film

Scope: the complete generation pipeline, from story planning to the text actually
pasted into Google Flow. Evidence base is the most recent full generation,
`test-output/2026-09-19T09-10-14-193Z__complete__chhota-beej-bada-sapna.md`
(36 scenes, post-P4, post-precision). No API calls were made and no production
code was changed for this audit.

A note on method: every claim below is a measurement over the 36 real prompts,
not an inference from reading the code. Where a measurement contradicted a
hypothesis I had, the hypothesis is recorded as rejected rather than quietly
dropped.

---

## 0. What is NOT the problem

Three systems I expected to find broken are healthy, and the recommendation
preserves all of them.

**The planning chain is faithful.** I compared every scene's `startState`
against the previous scene's `endState`. They chain tightly and in detail:

```
S30 endState   Beeju lies flat on his back ... both hands dug down into it and
               stopped on the hard ground beneath, eyes wide open and fixed on
               the pale sky, mouth open on a silent breath.
S31 startState Beeju lies flat on his back ... both hands dug into the thin wet
               soil and stopped on hard ground, eyes wide open at the pale sky,
               mouth open on a silent breath; fine rain drifts down and the
               seven planted seeds lie in a row behind him.
```

That is correct inheritance. The blueprint, world registry, story memory,
ledger and seam blocks are doing their job.

**Dialogue reaches the prompts.** `ensureDialogueInPrompt()` had to append a
recovery block in only **2 of 36** scenes (S28, S31). In the other 34 the model
quoted the lines inline and interleaved them with action, which is what we want.

**Rejected hypothesis — "ghost characters".** S3's prompt opens by staging
Beeju, Motu and Teeli and then plays a Beeju/Ankuri beat, which looked like the
injected prefix contradicting the scene. I tested all 24 injected prefixes
against each scene's `charactersPresent`: **0 scenes** stage a character who is
not actually in the scene. The prefix is cast-correct. That theory was wrong.

So the disconnection is not a planning failure. **It is a failure of transfer:
the pipeline knows the continuity and does not put it into the artifact that
gets pasted into Flow.**

---

## 1. What is actually causing the disconnected-video problem

### 1.1 The 6.1x frame-specification asymmetry — the primary cause

Measured across the 35 scenes that state both frames:

| | mean words |
|---|---|
| Opening frame ("where this clip starts") | **327.9** |
| Closing frame ("where this clip ends") | **53.9** |

Every clip is told, in 328 words, exactly where to begin — and in 54 words,
roughly where to end. Concretely:

```
S30 prompt, closing frame:
  "Final frame: Beeju lying exposed on the thin soil, arms out, eyes wide open
   on the empty sky, small and warm-lit against the cold grey field."

S31 prompt, opening frame — additionally specifies:
  hands dug into the soil and stopped on hard ground · mouth open on a silent
  breath · fine rain drifting · the seven planted seeds in a row behind him
```

Veo generating S30 was never instructed to produce the hands, the breath, the
rain or the seed row. Veo generating S31 is instructed to open on all of them.
**The join cannot match, because only one side of it was specified.** This
repeats at all 35 joins. That is the fragmentation the user is seeing.

This is the single highest-value thing to fix, and it is fixable in code
without touching story quality: the two texts describe the same instant and
should be the *same text*.

### 1.2 CHAIN joins are actively fought

5 joins are marked CHAIN (S3, S4, S10, S22, S23). On those the operator exports
the previous clip's last frame and uploads it as the first-frame reference. But
the prompt for the chained scene still carries its own ~328-word opening-frame
description, written independently of the frame being uploaded. The uploaded
pixels and the prompt text give Veo two different instructions for frame one.
Mean closing-frame specification on the scene *before* a CHAIN is 53.6 words —
no better than average, on exactly the joins that need it most.

### 1.3 Two competing opening frames in 12 of 36 prompts

Two systems each restate the inherited frame:

- `server.ts:543` instructs the model: *"For Scene N > 1 this opening
  description MUST restate the previous scene's 'endState' IN FULL"*
- `makeSelfContained()` (`prompt-continuity.ts:88`) *also* prepends
  `Opening frame: ${priorEndState}.`

The guard against duplication is `openingFrameIsDescribed()`
(`prompt-continuity.ts:103`): it accepts the model's version only if 50% or more
of the endState's >4-letter words appear in the first 400 characters. The model
paraphrases rather than echoing, so the gate fails often, and the prefix is
added on top of a restatement that was already there. Result: **12/36 prompts
contain two opening-frame statements**, e.g. S21 opens
`Opening frame: At 10.0s Beeju stands at the very end of the shelf board...`
immediately followed by `Opening frame, described exactly: a cute 3D,
Pixar-style animated scene at nightfall...` — two different pictures, both
labelled frame one.

### 1.4 The injected prefix is written in end-state grammar

`endState` is authored as an *ending* ("Exact visual ending state at 10.0s",
`server.ts:303`; fallbacks at `server.ts:894` and `server.ts:2027` literally
prepend `At 10.0s`). `makeSelfContained()` pastes it verbatim as an *opening*.

So **24 of 36 prompts begin by telling Veo that the opening frame occurs at the
ten-second mark**, then describe ten seconds of action after it. The timeline
the prompt describes is internally contradictory before the action even starts.

### 1.5 There is no prompt template — every clip is a differently-shaped instruction

`finalVideoPrompt` is free prose authored by the model, then lightly
post-processed. Section vocabulary across the 36 prompts:

| section | present in |
|---|---|
| `Opening frame` | 32/36 |
| `First frame` | 12/36 |
| `Closing frame` | 24/36 |
| `Final frame` | 12/36 |
| `Action:` | **11/36** |
| `Camera:` | **12/36** |
| `Score` | 24/36 |
| Foley/Sound | 36/36 |

Only two labels are near-universal. A third of the prompts name their action
block; a third name their camera. Veo reads a differently-organised document for
every shot, so its emphasis and pacing shift shot to shot. Consistent output
needs a consistent input shape, and right now there isn't one.

### 1.6 Continuity intelligence never reaches the artifact

The blueprint, story memory, ledger, seam block, planned moves, world registry
and life-journey state are all rich — and all of them are addressed to the
*planner*. The only cross-scene information that survives into `finalVideoPrompt`
is the restated opening frame. Narrative cause, emotional carry-over, the open
dramatic question, and the conversational thread have **no carrier into the
pasted text at all**.

`story-craft.ts:435` already asks for the right thing:

> *"CONVERSATION CARRIES ACROSS THE JOIN: a question asked at the end of one
> scene can be answered at the start of the next ... Dialogue that continues
> over a cut is one of the strongest things making separate ten-second clips
> feel like one continuous film."*

Measured reality: of 35 joins, only **6** end on a question, and only **3** are
answered by a different speaker opening the next scene. Speaker changes across a
join happen 15/31 times — indistinguishable from chance. The guidance is prose
advice to the planner with no structure behind it, so it does not land.

---

## 2. What is causing weak / underused 10-second dialogue and performance

### 2.1 No prompt contains a beat clock — 0 of 36

Not one prompt carries any internal time cue: no "0.0–2.5s", no "by 4 seconds",
no beat numbering. Ten seconds is handed to Veo as an undifferentiated
paragraph containing an opening frame, a character bible, an action, three
dialogue lines, camera notes, Foley and a closing frame — with no statement of
what occupies which second.

Veo therefore paces it arbitrarily. That is the direct mechanical cause of both
symptoms the user describes: **dead time** (Veo stretches one line across the
clip) and **rushed/thin conversation** (Veo compresses three turns into two
seconds and fills the rest with the camera move).

### 2.2 The speech envelope is 40% unused

Mean spoken words per dialogue scene: **14.4**, against a comfortable envelope
of 18 and a ceiling of 24 for a 10-second shot. Eight scenes are at or under
eight words:

```
S10  1 word / 1 turn      S23  5 words / 2 turns    S32  6 words / 2 turns
S19  8 words / 2 turns    S24  5 words / 2 turns    S35  3 words / 1 turn
S20  8 words / 2 turns                              S36  4 words / 1 turn
```

S10 is a **one-word scene with two characters on screen**. This is exactly the
user's "a character says only one short line" complaint, and it is measurable.

Note the direction of the error. The Q5 fix correctly stopped scenes
*overrunning* the envelope (38.1 → 13.6 words, 35/36 overruns → 1). It
overshot: the pipeline now systematically under-fills. The envelope is being
treated as a ceiling to stay well clear of rather than a budget to use.

### 2.3 Contradictory turn-count targets are still live in the prompt

Two instructions in the same request disagree:

- `server.ts:537` — *"WRITE A REAL CONVERSATION IN EVERY SCENE. **Four to six
  short turns** is the normal weight of a ten-second shot."*
- `server.ts:278` (schema) — *"roughly FOURTEEN TO TWENTY-TWO WORDS total —
  about **three or four short turns**."*

The model splits the difference and lands at **3.5 turns per conversation
scene**. The Q5 sweep corrected `story-craft.ts`, `blueprint.ts` and the system
instruction's per-line word counts, but this pair of turn-count claims was
missed. "WRITE A REAL CONVERSATION IN EVERY SCENE" also contradicts the
silent-scene rules that appear 12 lines later.

### 2.4 Half the dialogue scenes are single-speaker, and four are talking statues

| | count |
|---|---|
| scenes with dialogue | 34 |
| real conversations (2+ speakers) | 17 |
| monologue, character alone on screen (legitimate) | 13 |
| **monologue with other characters present and silent** | **4** |

S10 (2 present), S13 (3 present), S19 (2 present) and S35 (2 present) put
characters on screen and give them nothing to do while another speaks. These are
literally the "talking statues" the prompt warns against at `server.ts:547`.

Within the 17 real conversations, alternation is good (86% of consecutive turns
change speaker). The problem is not that exchanges are badly written — it is
that **only half the dialogue scenes are exchanges at all**, and the exchanges
that exist are 3.5 turns of 14 words.

### 2.5 Nothing plans what a listener does

`dialogueTurns` has `facialExpression` and `accompanyingAction` in the schema —
but `required` is `["speaker", "line"]` (`server.ts:287`), and neither optional
field is rendered into the report. So `server.ts:547`'s instruction —

> *"dialogue-scene: the spoken lines, PLUS what each listener is doing while the
> other speaks — the reaction, the hands, the glance away. A prompt that lists
> only speech produces talking statues."*

— has **no planned data behind it**. Whether a listener does anything is left
entirely to the model's free prose, scene by scene, which is why it varies.
There is also no field anywhere for what a *non-speaking present character*
does; the schema models speech turns, not scene performance.

### 2.6 37% of turns narrate the picture instead of advancing it

In 36 of 98 turns the speaker names themselves inside their own line, across
25 of 34 dialogue scenes — `"Beeju gir gaya. Beeju phir chadhega."` ("Beeju
fell. Beeju will climb again.") spoken by Beeju while we watch him fall and
climb.

This one needs care. Third-person self-reference is a deliberate and charming
characterisation for a toddler-like character, and **the recommendation must not
ban it** — that would be hardcoding this story's voice. The problem is not the
grammar, it is the *information*: the line restates what the image already
shows, so the words add nothing to the ten seconds. That is a redundancy
measure, not a style rule, and it generalises: speech that duplicates the
visible action is wasted runtime in any story, in any language.

---

## 3. Which current systems are contributing

| system | role in the problem |
|---|---|
| `prompt-continuity.ts` · `makeSelfContained()` | Prepends the previous `endState` as an opening frame, in end-state grammar ("At 10.0s"), on top of a restatement the model was separately ordered to write. Source of 1.3 and 1.4. |
| `prompt-continuity.ts` · `openingFrameIsDescribed()` | 50%-keyword gate over the first 400 chars; fails on paraphrase, so duplication is the default rather than the exception. |
| `server.ts:543` (batch prompt §6) | Orders a full endState restatement at the head of the prompt — correct intent, but duplicated by the code path above, and with **no matching order for the closing frame**. This omission is the direct cause of the 6.1x asymmetry. |
| `server.ts` · `finalVideoPrompt` as free prose | No template, so section vocabulary and ordering vary per clip (1.5). |
| `server.ts:303`, `:894`, `:2027` · endState grammar | Bakes "At 10.0s" into text that is later reused as an opening. |
| `server.ts:537` vs `server.ts:278` | Contradictory turn-count targets (2.3). |
| `server.ts:287` · `dialogueTurns.required` | Performance fields optional, so listener behaviour is unplanned (2.5). |
| `performance-budget.ts` | Envelope is enforced as a ceiling only. Nothing reports *under*-fill, so 2.2 is invisible to the quality gate. |
| `beat-density.ts` | Clusters moves and caps them per performance type — but produces no **time allocation**, so the clip has no clock (2.1). |
| `story-craft.ts:421–435` | Correct conversational intent, delivered as planner prose with no structural carrier; measurably not landing (1.6). |
| blueprint / memory / ledger / world registry / life-journey | **Not at fault.** Healthy, and addressed to the planner. Their output simply has no route into `finalVideoPrompt`. |
| `quality-gate.ts` | Blind to all of the above: no finding code covers frame asymmetry, duplicate opening frames, missing beat clock, speech under-fill, or silent-bystander scenes. |

---

## 4. Recommended architecture

One sentence: **stop asking the model to write the Flow prompt as prose, and
assemble it in code from fields the model already produces — so that the seam
between two clips is one shared text rather than two independently written
descriptions.**

Five components. All generalise across story, language, genre, duration and
scene count; none forces dialogue into silent scenes.

### 4.1 Seam Identity — one frame, one text, two uses

Introduce a single canonical frame description per join, rendered once:

```
seamText(N) := the full, absolute description of the instant between clip N and clip N+1
```

- Clip N's prompt ends with it, verbatim, as its closing frame.
- Clip N+1's prompt begins with it, verbatim, as its opening frame.

Symmetry stops being something the model is asked to achieve and becomes a
property of the data. This alone removes the 6.1x asymmetry (1.1), the duplicate
opening frames (1.3), and the end-state grammar leak (1.4), because the seam text
is authored once for the purpose and is tense-neutral.

`makeSelfContained()`'s reference-stripping and negative-block removal stay —
they are still correct and still needed. Only the endState-prefixing branch and
its 50% gate are retired.

For CHAIN joins this matters most: the uploaded last frame and the next prompt's
opening text now describe the same instant by construction (1.2).

### 4.2 Deterministic prompt assembler — a fixed shape for every clip

Build `finalVideoPrompt` in code from a fixed template:

```
[opening frame — seamText(N-1), verbatim]
[character identity — locked visual descriptions, as today]
[beat clock — §4.3]
[action + interleaved dialogue, with listener behaviour — §4.4]
[camera]
[light / palette]
[Foley]
[score]
[closing frame — seamText(N), verbatim]
```

The model keeps authoring the *content* of each field — its craft is not
reduced. It stops authoring the *document structure*, which is where the
variance in 1.5 comes from. Every clip becomes the same shape, which is what
gives Veo consistent emphasis across 36 generations.

This is also what makes the rest testable offline: once the prompt is assembled,
its properties can be asserted.

### 4.3 Beat Clock — allocate the ten seconds explicitly

`beat-density.ts` already clusters a scene into beats; `performance-budget.ts`
already knows speech runs ~2.8 words/sec. Combine them into a time allocation
and render it into the prompt:

```
0.0–2.5s   Beeju drags himself upright, both hands sliding on the wet stone
2.5–5.0s   Beeju: "..."   — Ankuri's leaf turns toward him as he speaks
5.0–7.5s   Ankuri: "..."  — Beeju's shoulders drop
7.5–10.0s  camera settles; Beeju's hand closes on the pot rim
```

Duration-general: the allocation is computed from `SECONDS_PER_SCENE`, not
hardcoded to 10. Silent scenes get a beat clock with no speech rows — the clock
is about *pacing*, not about talking, so it improves silent-emotional and action
scenes too rather than pushing words into them.

This is the fix for dead time and for rushed conversation (2.1).

### 4.4 Performance Track — make the listener a planned object

- Promote `facialExpression` and `accompanyingAction` to `required` on each turn.
- Add a per-scene `bystanders` field: for each present, non-speaking character,
  what they are doing during the scene. Empty when a character is alone — so
  solo scenes are unaffected and nothing is forced.

This gives 2.5's instruction real data to render, and kills the four
talking-statue scenes (2.4) structurally rather than by exhortation.

### 4.5 Envelope as a budget, and a redundancy measure

- **Resolve the contradiction** (2.3): one turn-count statement, derived from
  `wordEnvelope()` rather than restated as a literal in three places.
- **Report under-fill**: `performance-budget.ts` gains an under-fill verdict
  alongside its overrun verdict, and the quality gate gets a finding for a
  dialogue scene using well under its envelope. This is a *report*, not a
  forced rewrite — matching how every other P0–P4 detector behaves.
- **Redundancy finding**: flag turns whose content is already carried by
  `characterActions`, using the existing `textSimilarity()` machinery. Not a
  style ban (2.6) — a measure of whether the words earn their runtime.
- **Seam-thread field**: an optional `openThread` on the seam — a question
  asked, a line unfinished, a look held — which the next scene is told to
  engage. Null for genuine breaks, so act boundaries and time jumps stay clean.

### What is explicitly preserved

Blueprint, world registry, story memory, ledger, life-journey, continuity
director, scene contracts, scene distinctiveness, action density, and every
P0–P4 threshold. Nothing in this design weakens story quality; it changes how
the plan is *transferred* into the pasted artifact, and adds measurement where
the pipeline is currently blind.

### What is explicitly not done

No automatic repair (P5 stays disabled). No hardcoding of this story, its
characters, its language, its genre or its duration. No forced dialogue: silent,
action, montage and reaction scenes keep their silence, and the beat clock
serves them rather than filling them.

---

## 5. Phased implementation plan

Each phase is independently shippable, offline-testable against the four
existing generated stories, and adds regression tests in the established style.

### Phase A — Seam Identity + deterministic assembler *(highest value, no schema change)*

1. Add a seam renderer producing one tense-neutral `seamText` per join from the
   existing `endState`/`continuityState` fields.
2. Build `finalVideoPrompt` from the fixed template in §4.2.
3. Retire the endState-prefixing branch and `openingFrameIsDescribed()`; keep
   reference-stripping and the trailing-negative cleanup.
4. Remove `At 10.0s` from endState authoring (`server.ts:303`, `:894`, `:2027`).
5. Replace `server.ts:543` with an instruction covering **both** frames.

Exit criteria, measured on re-rendered prompts from stored scene data:
opening/closing word ratio at or below 1.3 (from 6.1); duplicate opening frames
0/36 (from 12); prompts beginning "At 10.0s" 0/36 (from 24); all eight template
sections present in 100% of prompts.

### Phase B — Beat Clock

6. Extend `beat-density.ts` with time allocation across `SECONDS_PER_SCENE`.
7. Render the clock into the assembler, speech rows placed via `speechRateFor()`.
8. Calibrate against the four stories; add `tests/beat-clock.test.ts`.

Exit criteria: 100% of prompts carry a clock; allocated speech time never
exceeds the envelope; silent scenes produce speech-free clocks.

### Phase C — Performance Track *(schema change)*

9. `facialExpression` + `accompanyingAction` become required per turn.
10. Add per-scene `bystanders`; render listener behaviour into the action block.
11. Quality-gate finding: present, silent, and doing nothing.

Exit criteria: talking-statue scenes 0 (from 4); no regression in scene-contract
or action-density results.

### Phase D — Envelope budget + redundancy + seam thread

12. Resolve the turn-count contradiction; derive the single statement from
    `wordEnvelope()`.
13. Under-fill verdict in `performance-budget.ts` + gate finding.
14. Dialogue-to-action redundancy measure via `textSimilarity()`.
15. Optional `openThread` on the seam; render into the next scene's brief.

Exit criteria: mean spoken words per dialogue scene inside the comfortable band
rather than 40% below it; conversation carried across joins measurably above the
current 3/35; **no increase** in envelope overruns.

### Phase E — Gate integration and calibration

16. New finding codes for frame asymmetry, missing clock, speech under-fill,
    silent bystanders, dialogue redundancy — with severity policy consistent
    with the existing 21 codes.
17. Re-run all four stories; re-calibrate any threshold the new signals disturb.
18. Update `plan-story-quality.md` with results.

Suggested order of value: **A, then B, then C, then D, then E.** Phase A alone
addresses the user's primary complaint and requires no model-schema change, so
it can be validated entirely offline against prompts already on disk.

---

## Appendix — measurements

| measurement | value |
|---|---|
| scenes | 36 |
| mean opening-frame specification | 327.9 words |
| mean closing-frame specification | 53.9 words |
| asymmetry ratio | **6.1x** |
| prompts with two opening-frame statements | 12/36 |
| prompts opening "At 10.0s" | 24/36 |
| prompts with any internal time cue | **0/36** |
| prompts naming an `Action:` section | 11/36 |
| prompts naming a `Camera:` section | 12/36 |
| dialogue recovery block needed | 2/36 |
| scenes with dialogue | 34 |
| real conversations (2+ speakers) | 17 |
| monologue, alone on screen (legitimate) | 13 |
| monologue with silent characters present | 4 |
| mean turns per conversation scene | 3.5 |
| speaker change between consecutive turns | 86% |
| mean spoken words per dialogue scene | 14.4 (envelope 18 / ceiling 24) |
| dialogue scenes at 8 words or fewer | 8 |
| turns naming their own speaker | 36/98 (37%) |
| joins ending on a question | 6/35 |
| joins where that question is answered next | 3/35 |
| CHAIN joins | 5 |
| scenes staging a character not present | **0/36** (hypothesis rejected) |

---

## 6. Phase A — implemented

Shipped: Seam Identity and code-owned frame bookends. Validated offline against
six stored generations (186 scenes). No API calls were made.

### What changed

| file | change |
|---|---|
| `src/server/story/seam.ts` | **New.** Builds one tense-neutral seam text per join from `endState` (falling back to `continuityState`), strips the model's own frame statements, and bookends the prompt. |
| `src/server/story/prompt-continuity.ts` | `makeSelfContained()` no longer prepends the previous `endState`, and `openingFrameIsDescribed()` (the 50%-keyword gate) is deleted. Reference-stripping and negative-block removal are unchanged. |
| `server.ts` | Both prompt paths (batch + single-scene regeneration) now call `applyFrameBookends(buildSceneFrames(...))`. `endState` schema and both fallbacks no longer emit `At 10.0s`. Section 6, the `finalVideoPrompt` schema and the regeneration prompt all instruct the model NOT to write either frame. |
| `tests/seam.test.ts` | **New.** 37 tests. |
| `tests/validate-seam.ts` | **New.** Offline exit-criteria harness over `test-output/`. |

Ordering note: `ensureDialogueInPrompt()` now runs *before* the bookends, so a
recovered dialogue block lands inside the body and the closing frame stays the
last thing in the prompt.

### Exit criteria — measured over 186 scenes in 6 stories

| criterion | before | after | target |
|---|---|---|---|
| opening/closing asymmetry ratio | 6.10 | **1.00** | ≤ 1.30 |
| mean opening frame | 327.9 w | 81.5 w | — |
| mean closing frame | 53.9 w | 81.5 w | — |
| prompts opening `At 10.0s` | 24/36 | **0/186** | 0 |
| leftover frame labels in the body | 12/36 duplicated | **0/186** | 0 |
| **seam identity** (closing N ≡ opening N+1) | 0/35 | **180/180** | all |
| frames correctly placed | — | 186/186 open, 186/186 close | all |

### Content safety

Re-rendering all 186 prompts through the new pipeline:

- **0 dialogue lines lost.**
- 2 prompts lost a single incidental word of character detail (absorbed into the
  code-owned frame); 0 lost a character bible. `stripFrameStatements()` keeps
  content and drops only the label whenever a frame span is long or carries a
  bible marker, so an over-long block can never delete an identity anchor.
- 1 prompt shrank by >200 chars (S36 of *Chhota Beej*): its terse model-written
  `Final frame:` was replaced by the fuller authored `endState`. An improvement,
  not a loss.

### Regression

`npx tsc --noEmit` clean. Full suite **690 passed, 0 failed** (653 pre-existing
+ 37 new). `npm run build` succeeds.

### Not done in Phase A

Full section-order normalisation (`Action:` in 11/36, `Camera:` in 12/36) is
**not** fixed. Normalising those requires the model to emit action, camera,
light and sound as separate fields rather than as one prose blob — a schema
change, which belongs with Phase C. Phase A deliberately owns only the two
frames, because those are cleanly delimited and can be replaced without any risk
of destroying prompt content.

---

## 7. Phase B — implemented

Shipped: the beat clock. Validated offline against six stored generations
(186 scenes). No API calls were made.

### What changed

| file | change |
|---|---|
| `src/server/story/beat-clock.ts` | **New.** Segments the action line losslessly, sizes each spoken line from its word count at the language's speaking rate, interleaves them and renders a timestamped schedule. |
| `src/server/story/seam.ts` | `applyFrameBookends()` takes a `clock` section and places it between the body and the closing frame. Sections are now newline-separated so the schedule keeps its line breaks. Injected legacy endState prefixes are now removed whole rather than truncated at the safety cap. |
| `server.ts` | Both prompt paths attach a clock. Section 6 tells the model the clock exists and to write `characterActions` and `dialogueTurns` in the order things happen. |
| `tests/beat-clock.test.ts` | **New.** 52 tests. |
| `tests/calibrate-beat-clock.ts` | **New.** Offline calibration over `test-output/`. |

### Results

| criterion | before | after |
|---|---|---|
| prompts carrying any internal time cue | **0/36** | **186/186** |
| silent scenes given speech rows | — | **0** (11 silent clocks, all action) |
| mean rows per clock | — | 5.8 |
| prompt cost | — | +374 chars/scene (+11%) |

A real clock, from S2 of *Chhota Beej*:

```
Beat timing across the 10-second shot:
0.0-0.9s Motu surges up through the packet's open corner and shoulders Beeju off the paper lip...
0.9-3.7s Motu says, "Hatt! Sab se bara, sab se pehle!"
3.7-6.2s Beeju says, "Beeju gir gaya. Beeju phir chadhega."
6.2-7.9s Motu says, "Tum se do guna!"
7.9-10.0s Teeli says, "Nau baje dhoop. Qanoon hai."
```

### Two problems found during implementation, and what was done

**1. The obvious reuse would have deleted half the action.** The first
implementation built action rows from `measureActionDensity().beatTexts`, which
already segments in English and Roman Urdu and is calibrated. Measured across
186 scenes, those clauses cover only **48.1% of the action text** — it samples
the clauses it needs in order to *count* beats and drops the rest, so
"Beeju grips the rim and leans in, then Motu shoves the pot" reduces to
"leans in". Shipping that would have silently removed half the action from every
prompt. The clock now partitions the text itself: coverage **99.3%**.
`measureActionDensity` was left untouched, doing the job it is calibrated for.

**2. Segmentation orphaned the actor.** "Kadoo Bi's big hand sweeps along the
shelf, lifts the packet off the board and carries it to the work table" produced
the row "lifts the mustard packet off the board" — an action with nobody
performing it, which Veo is free to attribute to the wrong character. The
subject is now carried forward from `charactersPresent`, and the opening
subject is recovered from the action line itself. Where no present character is
named, no subject is invented.

### Overflow is reported, not hidden

64/186 clocks overflow — meaning the scene's content cannot fit at a speakable
rate. The distribution shows the clock is measuring correctly rather than
misfiring:

| story | mean words/scene | overflowing scenes |
|---|---|---|
| Inspector Kheera (pre-Q5) | 38.1 | **36/36** |
| Roshni Ke Diye | 16.4 | 12/36 |
| Jahazi | 15.4 | 7/36 |
| Chhota Beej (post-Q5) | 13.6 | 4/36 |
| Ek Bottle Ek Jhoot | 12.4 | 4/36 |

The pre-Q5 story is unspeakable in every scene, which is exactly what the Q5 fix
was for. Action rows are squeezed to their floor before speech is ever
compressed, because a line rendered faster than it can be spoken produces a
clipped clip, whereas a compressed action beat still reads.

### Regression

`npx tsc --noEmit` clean. Full suite **742 passed, 0 failed** (690 + 52).
Phase A exit criteria still PASS. `npm run build` succeeds.

### Still open

Phase C (performance track), D (envelope budget, redundancy, seam thread) and
E (gate integration) are unstarted. Section-order normalisation remains deferred
to Phase C as recorded in §6.

# Story Quality Architecture — Implementation Plan

**Status:** APPROVED with adjustments. **P0-P4 IMPLEMENTED** (2026-09-19). P5 (repair) not started and deliberately disabled.
**Date:** 2026-09-19
**Scope:** Raise generated story quality from "technically valid" to "worth watching," without weakening any existing system.

---

## APPROVED DECISIONS (2026-09-19)

These override the corresponding text later in this document.

| # | Decision | Effect on the plan |
|---|---|---|
| **1** | P0 approved, fully offline. Baseline the real failed story, but **do not calibrate from it alone**. Calibration must combine the real baseline, synthetic bad fixtures and legitimate negative fixtures. | §19.5 now mandates all three populations. Implemented: `tests/calibrate-thresholds.ts` reports all three and the committed threshold sits in the gap between the fixture populations, with the real stories plotted against it. |
| **2** | `distinctScenesNeeded` is **not trusted as declared truth**. `whatEachSceneDoes[]` must be independently compared for dramatic distinctiveness. A model cannot justify 8 repetitive scenes by declaring 8 are needed. | §8 and §5.D revised: the density check runs the same similarity engine over `whatEachSceneDoes[]` entries. A beat whose per-scene lines are near-duplicates of each other is a planned stretch regardless of the number it declares. |
| **3** | The intra-batch progression rail is a **prompt-level safeguard, not programmatic intra-call memory**. Deterministic post-batch distinctiveness remains the enforcement layer. **Do not change max batch size yet.** | §9.1 relabelled. `MAX_SCENES_PER_BATCH` stays 12. The rail is best-effort; the measurement is the guarantee. |
| **4** | Performance budgets are **speakability envelopes, not hard creative limits**. Preserve pauses, acting, emotion, language variation and intentional silence. Feasibility stays **report-only**. | §5.C and §11.7 revised. Implemented that way: `performance-budget.ts` never truncates, and a silent scene gets its own verdict rather than being judged against a floor. |
| **Q1** | YES — P0 baseline first. | Done. Results in §25. |
| **Q2** | P5 architecture yes, but **repair stays disabled** until P0–P4 plus manual real-story validation are stable. | §12 unchanged in design; §20 marks P5 as build-but-do-not-enable. |
| **Q3** | **Never block** a generated story, for now. | §11.7 already says this. Confirmed permanent for P0–P5. |
| **Q4** | Measure contract token overhead first. If material, **compact the contract** before considering batch-size changes. | §21 R3 revised: the mitigation is a smaller contract, not smaller batches. |
| **Q5** | Fix the unspeakable 4–6 turns × 8–14 words rule **now**. Remove/soften that regression only; do **not** prematurely implement the full P3 Performance Director. | Done. Exact change in §25.1. |

---

## 0. The finding that reframes everything

The anti-filler instructions are not being ignored. They are being **obeyed by the wrong department**.

The blueprint is required to tile beats across scenes `1..N` with no gaps. If a story's natural material is worth 20 scenes and the runtime demands 60, some beat is handed 8 scenes — and the scene department then **correctly** fills 8 scenes with that beat. Every anti-filler rule in the system is aimed at the scene department, but the stretching decision was already made upstream, in the beat sheet, and the scene department is faithfully executing it.

Second finding, equally structural: **the repetition happens inside a single API call.** Batches generate up to 12 scenes in one request. `StoryMemory` — the system that knows what already happened — is built from *completed* scenes and injected *between* batches. Within a batch there is no memory mechanism at all. Twelve near-identical scenes can be produced in one call without a single check firing, because every check that could notice runs later, or compares the wrong things.

Everything below follows from these two facts.

---

## 1. Research findings

Extracted craft principles only. No characters, plots, dialogue or episode structures reproduced.

### 1.1 The scene must turn

McKee's governing rule: a scene is *an action through conflict that turns the value-charged condition of a character's life on at least one value.* If the value-charged condition is the same at the end as at the start, the scene has **activity but no event** — it is exposition wearing a costume. The diagnostic is two questions: *what value is at stake here?* and *where is that value now?* Same answer to both → the scene has no reason to exist.

This maps directly onto the observed failure. Twelve jogging scenes have abundant *activity* and zero *events*.

**Design consequence:** the value change must become a typed, comparable field — not prose. Prose cannot be compared by code, and `storyFunction` is currently prose.

### 1.2 Short-form children's structure: problem → co-regulation → repair

Analyses of strong 7–9 minute children's episodes describe a recurring emotional shape: **a rising problem, a period of shared working-through with another character, and a small but genuine repair or insight.** Episode length is matched to attention span rather than to plot size — brevity is a design constraint, not a limitation.

The wants/needs engine is explicit in that tradition: characters often *do not get what they want*, and get what they need instead.

**Design consequence:** an emotional arc is not the same as a plot arc, and a quiet story can be fully structured without a villain or danger. The pacing model must support "problem → working-through → repair" as a first-class rhythm, not force a three-act action spine onto it.

### 1.3 Repetition in children's media is a *tool*, and it has a rule

Children's-media research treats repetition as pedagogically valuable — but the finding is specifically that **children need the same concept in different contexts**, not the same scene again. Repetition works through *variation*; identical repetition is where it stops working.

Programmes deliberately give characters **distinct personas, speech styles and knowledge gaps** so that different characters teach different things.

**Design consequence:** the duplicate detector must not ban repetition. It must require **variation across recurrence** — which is exactly the rule `Routine.variationAcrossStory` already encodes in the Life Journey layer. That rule should be generalised, not duplicated.

### 1.4 Animation is a visual medium and every second is expensive

Animation writing guidance is consistent: *show, don't tell*; emotion is carried by staging, framing and colour more reliably than by dialogue; scripts are tighter than live action because every second costs money. Many acclaimed animated shorts carry their entire story with little or no dialogue.

**Design consequence:** forcing dialogue into every scene is a craft error, not a quality improvement. (See §3.5 — the current system now does exactly this, and it is my own recent change that caused it.)

### 1.5 On-the-nose dialogue

Characters who say exactly what they feel produce flat, expository scenes. Real speech works by **implication** — a character speaks *around* the feeling, not about it. The test: could this line appear in a one-sentence summary of what the story means? If yes, it is a summary, not dialogue.

**Design consequence:** the existing "lesson is never spoken" doctrine is correct and already strong. What is missing is a detector for the *generic motivational* register — lines that would fit in any story with the same theme.

### 1.6 Value/goal/obstacle/outcome as the scene unit

Standard scene construction: a character enters with a **goal**, meets an **obstacle**, makes a **choice**, and leaves with an **outcome** that is different from what they came in with. Reversals and setbacks are how escalation is produced; a scene where the goal is simply achieved without cost rarely lands.

**Design consequence:** these four are the minimum typed fields a scene needs for any deterministic quality check to be possible at all.

**Sources:**
- [Do Your Scenes Turn? — McKee Seminars](https://mckeestory.com/do-your-scenes-turn/)
- [Every Scene In Your Screenplay Must Turn — TripTee Pictures](https://tripteepictures.com/articles/turn-your-scene)
- [Screenwriting lessons from Bluey — Write for Animation](https://www.writeforanimation.com/articles/screenwriting-lessons-from-bluey)
- [“Oh, Biscuits!” Exploring resilience in the children's television programme Bluey — Australian Journal of Psychology](https://www.tandfonline.com/doi/full/10.1080/20590776.2025.2526340)
- [Educational goals of Sesame Street](https://en.wikipedia.org/wiki/Educational_goals_of_Sesame_Street)
- [Sesame Street research](https://en.wikipedia.org/wiki/Sesame_Street_research)
- [Visual Storytelling: How to "Show, Don't Tell" in Animation — BINUS](https://binus.ac.id/bandung/dkv/2025/11/04/visual-storytelling-how-to-show-dont-tell-in-animation/)
- [Writing Scripts for Animation — CGWire](https://blog.cg-wire.com/animation-scripts/)
- [What is 'On the Nose' Dialogue? — No Film School](https://nofilmschool.com/on-the-nose-dialogue)
- [On the Nose Dialogue: How to Lose It or Use It — Industrial Scripts](https://industrialscripts.com/on-the-nose-dialogue/)

---

## 2. Current architecture audit

### 2.1 What the quality report actually measures

`buildStoryQualityReport()` (`blueprint.ts:971`) produces 18 metrics. Classified by what they compare:

| Metric | Comparison type | Can it catch 12 identical scenes? |
|---|---|---|
| `beatsCovered`, `scenesWithoutBeat` | global | No |
| `castParticipation` | global aggregate | No |
| `dialogueDistribution`, `silentCharacters` | global aggregate | No |
| `averageTurnsPerScene`, `thinDialogueScenes`, `silentScenes` | per-scene count | No |
| `repeatedDialogueLines` | global, **exact normalised match**, ≥12 chars | Only if lines are character-identical |
| `scenesMissingStoryFunction` | per-scene, `length < 12` | No |
| `staticScenes` | **within-scene** (`startState === endState`) | No |
| `fillerSuspects` | union of the two above | No |
| `setupsPlanted/PaidOff/unpaid` | global | No |
| `relationshipsTracked` | global | No |

**There is not one cross-scene comparison in the entire quality report.** Every metric is within-scene or global-aggregate. Nothing anywhere asks *"is scene N materially different from scene N−1?"*

The **only** consecutive-scene similarity check in the whole codebase is `repeatedShotRun` (`continuity-director.ts:688`) — camera `shotSize` + `movement` only, fires at 3+ in a row, severity `info`. It would have caught the repeated *framing* and reported it as a note.

### 2.2 Why the anti-filler prompts cannot work

The instructions are strong and correctly written:

- `blueprint.ts:854` — *"Every scene MUST change something… State that change in `storyFunction`. If you cannot name a real change, the scene is filler."*
- `story-craft.ts` `ANTI-FILLER` — a ten-item list of what a scene must achieve.
- `blueprint.ts:848` — *"Never repeat a line, a sentiment or an exchange that has already occurred."*

They fail for three structural reasons:

1. **`storyFunction` is free prose with a 12-character floor.** "Chintu keeps going, determined" satisfies the validator. So does the same sentence twelve times.
2. **Nothing verifies the claim.** The model asserts a change; no code checks whether the asserted change differs from the previous scene's asserted change.
3. **The rule is evaluated by the same model that is about to break it,** inside one call, with no mechanism forcing it to compare scene 7 against scene 6.

### 2.3 The batching blind spot

```
runSceneBatchPipeline
  └── partitionSceneRanges(60, 12) -> 5 batches
       └── ONE generateText call produces 12 complete scenes
```

`buildStoryMemory()` (`storySoFar`, `recentDialogue`, `dialogueCounts`, `emotionalTrajectory`) is derived from **already-generated** scenes and injected into the *next* batch. Inside a batch, the model has:
- the beat slice for that range
- the previous batch's last scene state
- the ledger

…and no per-scene running record of what it just wrote two scenes ago. **Intra-batch repetition is architecturally unobserved.** For a 12-scene batch that is up to 12 consecutive scenes with no repetition check of any kind.

`recentDialogue` is additionally capped at `slice(-10)` — ten lines. With the density target now at 4–6 turns per scene, ten lines is roughly the last **two** scenes.

### 2.4 The beat-density root cause

`blueprint.ts:571` requires: *"Assign each beat a scene range. Ranges must be contiguous and must cover scenes 1 to N exactly once, with no gaps or overlaps."*

There is a scale doctrine telling the director to *"scale the AMBITION to fill the runtime,"* and an explicit warning against *"the same thin plot slowed down."* But there is **no structural check** that a beat's scene allocation is justified by its content. Nothing measures beat density. A blueprint that gives "Resolution / celebration" scenes 49–60 is structurally valid, and the scene department must then produce twelve celebration scenes.

This is why the observed story stretched its resolution: **the stretch was planned, then executed faithfully.**

### 2.5 Dialogue timing has no model at all

`grep` for speakability, word budget, words-per-second: **nothing exists.**

The current instruction (`story-craft.ts` `buildSceneCraftRules`, and the `dialogueTurns` schema description) asks for **4–6 turns of 8–14 words** in a ten-second shot.

That is **32–84 words**. Roman Urdu / Hindi / Urdu conversational delivery runs roughly 2.5–3 words per second. 32 words is ~11–13 seconds of *continuous* speech with no pauses and no action. 84 words is close to 30 seconds.

**The current density target is physically unspeakable in the shot length it targets**, and it applies uniformly to establishing shots, montages and silent emotional beats. This is a regression I introduced in an earlier task while fixing the opposite problem (2.2 turns per scene, narrator-carried). Both failure modes have the same cause: **there is no duration budget, so the system can only oscillate between too little and too much.**

### 2.6 What is missing, by category

**1. Prompt weakness**
- Anti-repetition is stated but unverifiable and unenforced.
- No guidance on *how much* performance fits in ten seconds.
- No performance-type vocabulary — every scene is written as if it were the same kind of scene.
- Dialogue density is a single global number rather than a function of what the scene is.

**2. Schema / data-model weakness**
- No typed narrative change. `storyFunction` is prose.
- No `goal` / `obstacle` / `outcome`.
- No value-before / value-after.
- No `performanceType`.
- No declaration of *intentional* repetition (callback, montage, parallel).
- No per-scene dialogue word budget.

**3. Planning weakness**
- Beats carry no density justification; scene allocation is unchecked.
- No requirement that consecutive beats differ in kind.
- No explicit "resolution gets N scenes" discipline.
- `StoryBeat` has `escalation` as prose; nothing verifies escalation actually escalates.

**4. Scene-generation weakness**
- No intra-batch memory.
- `recentDialogue` capped at 10 lines across batches.
- No mechanism forcing scene N to differ from scene N−1.

**5. Validation weakness**
- Zero cross-scene similarity checks.
- Exact-match only for dialogue repetition.
- `staticScenes` compares the wrong pair (within-scene, not across).
- No escalation, agency, or thread-resolution measurement.

**6. Missing deterministic post-generation checks**
- Near-duplicate scene detection (the headline gap).
- Dialogue near-duplicate (fuzzy, not exact).
- Camera pattern beyond a 3-run of identical framing.
- Location concentration.
- Dialogue-vs-duration feasibility.
- Choice→consequence chain completion.
- Unresolved thread detection.

**7. Already protected — do NOT duplicate**

| Already works | Where | Verdict |
|---|---|---|
| Physical continuity (props, positions, exits, reframes) | `continuity-director.ts` | Excellent. Do not touch. |
| CHAIN/CUT plausibility, frame handoff | `continuity-director.ts`, `prompt-continuity.ts` | Correct. Leave alone. |
| Stated-moral detection | `fact-validator.ts:471` `checkStatedMoral()` | Exists and works. **Extend, do not rebuild.** |
| Place identity drift | `fact-validator.ts` | Works. |
| Entity registered-but-never-appears | `fact-validator.ts:513` | Works. Same shape as the thread-resolution check — reuse it. |
| Dialogue distribution / silent characters | quality report | Works. |
| Setup / payoff tracking | blueprint + quality report | Works, with a known window bug (§11.6). |
| Reciprocity, namespaced ids | `social-graph.ts`, `world-registry.ts` | Structural guards. Model to copy. |
| Camera repetition run | `continuity-director.ts` | Exists. **Upgrade in place.** |
| Routine variation requirement | `life-journey.ts` | The right rule already, scoped to journeys. **Generalise it.** |
| Dialogue reaching the Flow prompt | `prompt-continuity.ts:174` | Works. |
| Report-only philosophy, no fabricated scenes | throughout | **Preserve absolutely.** |

---

## 3. Root causes of the observed weak story

| # | Root cause | Category | Evidence |
|---|---|---|---|
| **RC1** | Narrative change is prose, so no code can compare it | schema | `storyFunction`, validated by `length < 12` |
| **RC2** | No cross-scene comparison anywhere in the quality report | validation | §2.1 table |
| **RC3** | Intra-batch repetition is architecturally unobserved | scene-gen | 12 scenes per call, memory only between calls |
| **RC4** | Repetition detection is exact-match | validation | `seenLines` map, normalised equality |
| **RC5** | No duration budget → dialogue is either starved or unspeakable | prompt + schema | no speakability logic exists; 4–6×8–14 words = 32–84 words in 10s |
| **RC6** | Beat scene-allocation is unjustified and unchecked | planning | contiguous tiling with no density rule |
| **RC7** | Quality report is computed and then ignored | validation | report-only, no gate, no repair |
| **RC8** | No performance-type concept — every scene written identically | schema + prompt | no such field; density rule applied globally |

RC6 and RC3 are the two that make the others possible. Fixing RC1/RC2 without RC6 would produce a story that *reports* its own stretching accurately and still ships it.

---

## 4. What already works and must be preserved

Non-negotiable. Listed because the temptation in a quality push is to rebuild things that are already correct.

1. **FACTS / STATE / PHYSICS / LIFE STATE separation.** The new layer adds a *derived measurement* plane; it introduces no fifth state layer and owns no facts.
2. **The Continuity Director.** The most battle-tested code here. Narrative quality checks must live beside it, never inside it — physical continuity and narrative progression are different questions and merging them would make both worse.
3. **StoryMemory is derived, never stored.** Every addition must also be derived from `blueprint + characters + scenes`. No new persisted memory.
4. **Social Graph, World Registry, Life Journey.** Untouched. Life Journey stays optional and dormant by default.
5. **Never fabricate a replacement scene.** A failed scene is reported, or regenerated by the model — never filled with invented content.
6. **Report-only by default.** Anything that blocks or repairs must earn it explicitly (§11.7).
7. **No hardcoded worlds, casts, plots or morals.** Every doctrine addition is craft vocabulary, offered the way `BEAT_SPINE` is offered.

---

## 5. Proposed architecture

Five components. Three are extensions of existing systems; two are new modules.

```
BLUEPRINT (Phase 1A)
  ├── + Beat Density Planner        [extends blueprint doctrine + normalisation]
  │       "does this beat's material justify its scene count?"
  │
SCENE BATCHES (Phase 2)
  ├── + Scene Progression Contract  [extends SCENE_SCHEMA]
  │       typed goal / obstacle / outcome / change / performanceType
  ├── + Performance Budget          [new module: performance-budget.ts]
  │       what fits in ten seconds, by performance type and language
  ├── + Intra-batch progression rail [prompt block, derived]
  │       "here is what you have written SO FAR IN THIS BATCH"
  │
POST-GENERATION (Phase 3)
  ├── + Scene Distinctiveness Engine [new module: scene-distinctiveness.ts]
  │       weighted multi-dimension near-duplicate detection
  └── + Story Quality Gate           [extends buildStoryQualityReport]
          tiered: report / warn / repair / block
```

### 5.A Scene Progression Contract *(extends the scene schema)*

**Why needed:** RC1. Every deterministic quality check is impossible while the narrative change is prose. This is the enabling change; nothing else in the plan works without it.

**Integrates with:** `SCENE_SCHEMA` in `server.ts`, `ScenePlannerItem` in `types.ts`, `buildStoryQualityReport`.

**Owns:** the typed drama fields on a scene — `goal`, `obstacle`, `outcome`, `progression`, `performanceType`, `repetitionIntent`.

**Must NOT duplicate:** `continuityState` (physical), `socialChanges` (relationship deltas — the progression field *references* a relationship change, it does not record one), `storyFunction` (kept, demoted to a human-readable gloss of the typed fields).

**When it runs:** authored by the model per scene, during Phase 2.

**On failure:** a scene missing the contract is reported as `unverifiable` rather than rejected — the fields degrade to today's behaviour (prose-only), and the story still ships. Old stories without the contract skip every check that needs it.

### 5.B Scene Distinctiveness Engine *(new, `scene-distinctiveness.ts`)*

**Why needed:** RC2 + RC4. The headline gap.

**Integrates with:** consumed by the Quality Gate; reads finished scenes only.

**Owns:** scene signatures and the pairwise similarity matrix. Nothing else.

**Must NOT duplicate:** `repeatedShotRun` in the continuity director — the camera dimension is *read from* that concept, and the continuity director's own check is upgraded in place rather than reimplemented here.

**When it runs:** Phase 3, after standardisation, before the report.

**On failure:** returns an empty finding list. It is pure measurement — it can never fail a generation.

**Method — semantic, not string equality:**

A scene signature is a set of weighted, normalised token bags:

| Dimension | Source | Weight | Rationale |
|---|---|---|---|
| progression kind + outcome | contract | 3.0 | Two scenes that change the *same thing in the same direction* are the core duplicate signal |
| goal | contract | 2.5 | Same goal twice running is the jogging failure exactly |
| action | `characterActions` | 2.0 | |
| dialogue content | `dialogueTurns` lines | 2.0 | |
| emotional state | `facialExpressions` + `continuityState.characterEmotions` | 1.5 | |
| obstacle | contract | 1.5 | |
| place | `continuityState.placeId` | 1.0 | Same place is weak evidence alone — recurring locations are normal |
| characters present | `charactersPresent` | 0.5 | Very weak alone |
| camera | `cameraShot` + `cameraMovement` | 1.0 | |
| Flow prompt | `finalVideoPrompt` | 1.0 | Catches identical production output even when metadata differs |

Similarity per dimension = **Jaccard on content-word token sets** after stopword removal, plus a **trigram-overlap** term so that "Hum kar sakte hain" and "Hum zaroor kar sakte hain" score high (exact match scores 1.0, the current implementation's only possible score above 0).

Total = weighted mean. A pair is a **near-duplicate candidate** when the weighted score crosses a threshold *and* the progression dimension is itself high — a scene may look similar while doing something genuinely different, and that is not a duplicate.

**Thresholds are derived, not invented.** §19 requires calibration against the synthetic fixtures before any number is committed; the implementation ships with the threshold as a named, documented constant with its calibration recorded beside it. No number goes in without a fixture that justifies it.

**Intentional repetition is exempt** when any of these hold:
- the scene declares `repetitionIntent` (`callback` / `montage-element` / `parallel-scene` / `running-gag` / `ritual`) **and** names the scene it echoes
- both scenes belong to a declared `Routine` with a stated `variationAcrossStory` (Life Journey)
- both scenes are paid-off halves of the same `StorySetup`

An exempted pair is still measured, and still reported if the recurrence shows **no variation at all** — which is the research rule from §1.3.

### 5.C Performance Budget Director *(new, `performance-budget.ts`)*

**Why needed:** RC5 + RC8. A ten-second clip is a performance, and nothing in the system models what fits in one.

**Integrates with:** `story-craft.ts` (emits guidance), scene schema (`performanceType`), quality gate (feasibility check), Flow prompt assembly.

**Owns:** speech-rate constants, per-performance-type budgets, the feasibility calculation.

**Must NOT duplicate:** `SECONDS_PER_SCENE` (already in `src/shared/duration.ts` — read it, do not redefine).

**When it runs:** twice — as prompt guidance during Phase 2, and as a deterministic check during Phase 3.

**On failure:** report-only. A scene whose dialogue overruns is flagged, never truncated — silently cutting a line would corrupt the Flow prompt.

**The model:**

Spoken delivery rate is roughly **2.5–3 words/second** for conversational Roman Urdu / Urdu / Hindi. A ten-second shot cannot be 100% speech — it needs breath, reaction and action. Budgeting ~55–70% of the shot as speech gives a working target of **14–21 words** of dialogue in a typical talking scene, not 32–84.

Performance types and their budgets:

| `performanceType` | Dialogue target | What fills the ten seconds |
|---|---|---|
| `dialogue-scene` | 3–5 short turns, ~14–21 words total | speech + reaction + small physical business |
| `action` | 0–2 turns, ≤8 words | continuous physical action |
| `establishing` | 0–1 turns | camera move across the space, one clear subject |
| `reaction` | 0–2 turns | a held face, a decision landing |
| `silent-emotional` | 0 turns | stillness, a gesture, an object |
| `montage-element` | 0–1 turns | one compressed idea |
| `comedy-beat` | 1–3 short turns | setup, timing gap, payoff |
| `transition` | 0–1 turns | movement between places or moments |

This replaces the current global "4–6 turns everywhere" with a rule that knows what kind of scene it is writing — and it is the fix for *both* the flat-narrator failure and the over-stuffed-dialogue regression.

### 5.D Beat Density Planner *(extends blueprint)*

**Why needed:** RC6. The stretching is planned upstream; no downstream fix can undo it.

**Integrates with:** `BLUEPRINT_SCHEMA.beats`, `buildBlueprintSystemInstruction`, blueprint normalisation.

**Owns:** per-beat density justification and the derived density report.

**Must NOT duplicate:** the beat sheet itself, chapters, or Life Journey phases. Beats remain the single source of truth for scene ranges (§16).

**When it runs:** Phase 1A, at normalisation.

**On failure:** report-only in P1; promoted to a blueprint-level warning once calibrated. Never rewrites the beat sheet — reallocating scenes is a creative decision.

**Mechanism:** each beat declares `distinctScenesNeeded` — how many *materially different* scenes its material actually contains — plus `whatEachSceneDoes`, one line per scene in its range. A beat claiming 8 scenes with 3 distinct lines is a planned stretch, visible before a single scene is generated.

Doctrine addition, stated as craft rather than arithmetic: *if the total material is smaller than the runtime, the answer is more story — another complication, a second relationship line, a cost that compounds — never a longer beat.* And an explicit note that **resolution and celebration compress**: the ending is the most commonly over-allocated beat in generated long-form, and it is where the observed story failed.

### 5.E Story Quality Gate *(extends `buildStoryQualityReport`)*

**Why needed:** RC7. The report is currently computed and discarded.

**Integrates with:** the existing quality report (extended, not replaced), the dev report, and the **existing single-scene regeneration path** (`server.ts:~1653`) for targeted repair.

**Owns:** severity classification and the repair decision.

**Must NOT duplicate:** the continuity report, the fact report, the social plan report, the life-journey report. It *aggregates* them; it does not recompute them.

**When it runs:** Phase 3, last.

**On failure:** falls back to report-only. A gate that cannot decide must never block a story the user paid tokens for.

---

## 6. Exact data-model / type changes

All additive and optional. No existing field changes type or meaning.

```ts
// ---- src/types.ts ----

/** What kind of change a scene produces. The typed replacement for prose. */
export type NarrativeChangeKind =
  | 'information'      // something is learned
  | 'decision'         // a choice is made
  | 'consequence'      // an earlier choice lands
  | 'relationship'     // how two characters stand shifts
  | 'emotional'        // an emotional state genuinely turns
  | 'obstacle'         // something new blocks the goal
  | 'discovery'        // something is found or revealed
  | 'escalation'       // cost or pressure rises
  | 'setup'            // something is planted
  | 'payoff'           // something planted returns changed
  | 'reversal'         // the understanding of the problem inverts
  | 'progress'         // measurable movement toward the goal
  | 'setback';         // measurable movement away

/** How the scene's goal resolves. */
export type SceneOutcome = 'achieved' | 'partial' | 'denied' | 'deferred' | 'reversed';

/** What kind of ten seconds this is. Drives the dialogue budget. */
export type PerformanceType =
  | 'dialogue-scene' | 'action' | 'establishing' | 'reaction'
  | 'silent-emotional' | 'montage-element' | 'comedy-beat' | 'transition';

/** Declared, deliberate echo of an earlier scene. Exempts a duplicate finding. */
export interface RepetitionIntent {
  kind: 'callback' | 'montage-element' | 'parallel-scene' | 'running-gag' | 'ritual';
  echoesScene: number;
  /** REQUIRED. What is different this time. Recurrence without variation is filler. */
  variation: string;
}

/** The value this scene turns. McKee's test, made comparable. */
export interface SceneProgression {
  kind: NarrativeChangeKind;
  /** The value at stake, named for this story: "trust", "the deadline", "hope". */
  value: string;
  /** Where that value stands entering the scene. */
  before: string;
  /** Where it stands leaving it. Must differ from `before`. */
  after: string;
}

/** Drama contract for one scene. */
export interface SceneContract {
  goal: string;
  obstacle: string;
  outcome: SceneOutcome;
  progression: SceneProgression;
  performanceType: PerformanceType;
  repetitionIntent?: RepetitionIntent;
}

// ---- additions to ScenePlannerItem (all optional) ----
interface ScenePlannerItem {
  /* ... existing ... */
  contract?: SceneContract;
}

// ---- additions to StoryBeat (optional) ----
interface StoryBeat {
  /* ... existing ... */
  distinctScenesNeeded?: number;
  whatEachSceneDoes?: string[];
}

// ---- new report types ----
export interface ScenePairSimilarity {
  sceneA: number;
  sceneB: number;
  score: number;
  topDimensions: Array<{ dimension: string; score: number }>;
  exempt: boolean;
  exemptReason?: string;
}

export interface DialogueFeasibility {
  sceneNumber: number;
  performanceType: PerformanceType;
  words: number;
  estimatedSeconds: number;
  verdict: 'comfortable' | 'tight' | 'overruns' | 'underfilled';
}

export type QualitySeverity = 'block' | 'repair' | 'warn' | 'info';

export interface QualityFinding {
  code: string;                 // stable, e.g. 'near-duplicate-scenes'
  severity: QualitySeverity;
  sceneNumbers: number[];
  title: string;
  detail: string;
  suggestedFix: string;
}

export interface StoryQualityGateReport {
  findings: QualityFinding[];
  blocked: number;
  repairCandidates: number[];
  warnings: number;
  infos: number;
  /** True when the contract was absent, so contract-dependent checks were skipped. */
  degraded: boolean;
}

// ---- StoryQualityReport gains (optional, additive) ----
interface StoryQualityReport {
  /* ... existing 18 ... */
  nearDuplicatePairs?: ScenePairSimilarity[];
  progressionCoverage?: { withContract: number; distinctKinds: number; byKind: Record<string, number> };
  consecutiveSameKindRuns?: Array<{ from: number; to: number; kind: string }>;
  placeConcentration?: Array<{ placeId: string; scenes: number; sharePercent: number }>;
  dialogueFeasibility?: DialogueFeasibility[];
  choiceConsequenceChains?: Array<{ decisionScene: number; consequenceScenes: number[]; resolved: boolean }>;
  unresolvedThreads?: string[];
  escalationProfile?: Array<{ beatNumber: number; outcomeMix: string }>;
  protagonistAgency?: { decisionsByProtagonist: number; decisionsTotal: number };
  resolutionScenes?: number;
}
```

---

## 7. Exact pipeline changes

```
Phase 1A  blueprint
            + beat density doctrine in the system instruction
            + distinctScenesNeeded / whatEachSceneDoes in BLUEPRINT_SCHEMA.beats
            + density normalisation & report          [new: beat-density.ts, or inside blueprint.ts]

Phase 1B  screenplay + Character Bible
            UNCHANGED

Phase 2   scene batches
            + SceneContract in SCENE_SCHEMA
            + performance-type + budget guidance in buildSceneCraftRules
            + INTRA-BATCH PROGRESSION RAIL in the batch prompt
            + widened recentDialogue window

Phase 3   standardisation & validation
            (existing: resolveScenePlace, makeSelfContained, ensureDialogueInPrompt,
             reconcileHandoffs, validateContinuity, validateStoryFacts, ...)
            + buildSceneSignatures / findNearDuplicates   [new]
            + dialogue feasibility                        [new]
            + extended buildStoryQualityReport
            + runQualityGate  -> findings + repair candidates   [new]
            + optional targeted repair pass (P5, opt-in)
```

---

## 8. Planning changes (Phase 1A)

1. **Beat density fields** (§6) — optional, so an older blueprint still normalises.
2. **Doctrine additions** to `buildBlueprintSystemInstruction`:
   - *Every beat states how many materially different scenes its material contains, and one line per scene saying what that scene does. If two lines are the same, the beat has fewer scenes than you assigned it.*
   - *If your beats' material totals less than the runtime, the story is too small for this length. Add a complication, a second relationship line, or a cost that compounds. Never stretch a beat.*
   - *RESOLUTION COMPRESSES. Arrival, celebration and aftermath are the most commonly over-allocated beats in long-form. A resolution rarely needs more scenes than the beat that caused it.*
   - *Consecutive beats must differ in KIND, not only in content. Three beats in a row that are all "they try again" is one beat with three names.*
3. **Normalisation** (`normalizeBeatDensity()`): derive actual scene span per beat; compare against `distinctScenesNeeded`; emit a finding where a beat's span materially exceeds its declared distinct material. Report-only in P1. **Never rewrites the beat sheet.**

---

## 9. Scene-generation changes (Phase 2)

### 9.1 The intra-batch progression rail — the RC3 fix

The single highest-value scene-generation change. The batch prompt gains an explicit, ordered instruction to write a running record and check against it:

> **SCENE-BY-SCENE PROGRESSION RAIL.** Before writing each scene, restate in `contract.progression` what value it turns and from what to what. Then check it against every scene you have already written **in this batch**: if the kind, the goal and the value movement are all the same as the scene before it, you have written the same scene twice. Change what the scene does, or cut it and let the beat breathe.

Paired with the typed contract this is checkable *after* the fact, which is what makes the instruction more than a wish.

### 9.2 Contract fields in `SCENE_SCHEMA`

Each with doctrine in its `description`, following the existing pattern. Critically: `progression.before` and `progression.after` must differ — stated in the schema description **and** verified by code.

### 9.3 Wider dialogue memory

`recentDialogue: allLines.slice(-10)` → scale with batch size (roughly the last 2–3 scenes' worth per batch, capped for token safety). Ten lines is now under two scenes.

Add `recentGoals` and `recentProgressions` to `StoryMemory` — derived, like everything else there, so no new persisted state.

### 9.4 Performance-type guidance

`buildSceneCraftRules` gains the §5.C table as craft vocabulary, replacing the current flat 4–6 rule. The dialogue-density instruction becomes conditional on performance type, with the explicit note that **establishing, action, silent-emotional, montage and transition scenes are legitimately near-silent** and must not be padded.

---

## 10. Dialogue and performance changes

**Voice.** Already strong (`voiceSignature`, mechanical rules, the voice test). Preserve. Add: voice signatures must persist across the whole film, and register may shift with situation while the mechanical rule does not.

**Language.** Guidance for natural Roman Urdu / Urdu / Hindi rhythm — contractions, particles, the way people actually interrupt each other — as craft guidance with no fixed phrases. **No stock phrase lists**; that is how every story starts sounding identical.

**New detectors** (all report-only initially):

| Detector | Method | Not a duplicate of |
|---|---|---|
| Exact repeated lines | existing | — (already works) |
| **Near-duplicate lines** | trigram + token Jaccard ≥ threshold | upgrades the exact matcher |
| **Generic motivational register** | line scores high-similarity against lines in *other* scenes with different goals, and contains no scene-specific noun | `checkStatedMoral` (which targets the theme specifically) |
| **Action narration** | line's content words overlap heavily with the same scene's `characterActions` | new |
| **Voice collapse** | two characters' line-sets are more similar to each other than either is to its own earlier lines | new |
| **Feasibility** | word count vs performance budget | new |

**Silence is protected.** Every dialogue check is skipped for performance types whose budget is 0–1 turns. A `silent-emotional` scene with no dialogue is correct and must never be flagged.

---

## 11. Validator / quality-gate design

### 11.1 Near-duplicate scenes
Per §5.B. Window-limited to pairs within ~6 scenes of each other *plus* all pairs above a higher global threshold — so a jogging run is caught locally and a repeated celebration is caught even 20 scenes apart.

### 11.2 Progression coverage
Every scene should carry a contract with `before ≠ after`. Metrics: scenes without contract; scenes where `before ≈ after`; distribution of kinds; **runs of ≥3 consecutive scenes with the same `kind` + same `outcome`** (the jogging signature).

### 11.3 Escalation
Derived from outcome sequence per beat. A story whose scenes are overwhelmingly `achieved` has no obstacles; one that never escalates cost plateaus. Reported as a profile rather than a pass/fail — different modes escalate differently (§13).

### 11.4 Protagonist agency
Ratio of `decision` progressions belonging to MAIN characters vs all decisions. Low agency = things happen *to* the protagonist. Report-only; some stories are legitimately about circumstance.

### 11.5 Choice → consequence chains
A `decision` scene should have a later `consequence` scene referencing it. Unchained decisions are reported. **Integrates with StoryMemory** — the chain is *derived* from scene contracts, not stored, exactly like `foldSocialDeltas`.

### 11.6 Setup / payoff
Existing check kept. **Fix the known window bug**: the ±1-scene payoff window produced a false "unpaid" finding on a real 60-scene run (paid at 57, window checked 59/60/61). Widen to the enclosing beat — or the enclosing Life Journey phase where one exists.

### 11.7 Severity policy

| Outcome | When | Rationale |
|---|---|---|
| **BLOCK** | Never, in P0–P5. | A story the user paid tokens for is never withheld. Revisit only with explicit approval. |
| **REPAIR** | Opt-in (P5). Near-duplicate runs of ≥3 scenes with the same progression, above the calibrated threshold. | Targeted regeneration of *specific* scenes through the **existing** single-scene path, with the diagnostic in the prompt. Never fabricates. |
| **WARN** | Near-duplicate pairs, `before ≈ after`, infeasible dialogue, voice collapse, unchained decisions, place over-concentration. | Actionable by a person. |
| **INFO** | Escalation profile, agency ratio, resolution length, camera patterns. | Craft observations, often legitimately violated. |

Everything starts at **WARN or INFO**. Nothing is promoted until fixture calibration justifies it (§19).

---

## 12. Regeneration / repair strategy

**Principles, in priority order:**
1. **Never fabricate.** No invented replacement scene, ever.
2. **Never silently mutate.** No truncating dialogue, no rewriting a scene in code.
3. **Opt-in only.** Repair is off by default; a flag enables it.
4. **Bounded.** At most one repair pass, at most N scenes, hard-capped so a pathological story cannot consume the token budget.
5. **Reuses the existing path.** `server.ts` already has single-scene regeneration with continuity re-application. Repair calls *that*, adding a diagnostic block: *"Scenes 34–37 all turn the same value in the same direction. Rewrite scene 36 so it does something these do not."*
6. **Verified.** After repair, distinctiveness is recomputed. If it did not improve, the **original is kept** and the finding stands — a repair that made things worse must not ship.
7. **Honest reporting.** The report states what was repaired, what improved, and what did not.

---

## 13. Interaction with story modes (anti-formula)

Each mode gets its own progression and pacing expectations, extending the existing `GENRE_SHAPES` rather than adding a parallel system:

| Mode | Expected progression mix | What must NOT be flagged |
|---|---|---|
| Mystery | `information` / `discovery` / `reversal` heavy; escalation by revelation | Repeated location (an investigation returns); low physical escalation |
| Comedy | `setup` / `payoff` / `escalation`; repetition-with-variation is the engine | Running gags, deliberate structural echoes |
| Heartwarming / Emotional | `relationship` / `emotional` / `consequence`; small stakes | Absence of danger; quiet scenes; low physical action |
| Adventure | `obstacle` / `progress` / `setback` | Recurring travel, if each leg differs |
| Simple Kids | fewer distinct kinds; clarity over complexity | Deliberate repetition for comprehension (§1.3) |
| Life Journey | `consequence` / `escalation` across phases; routines recur by design | Routine recurrence **with** declared variation |
| Single Episode | continuous pressure, one place is legitimate | Place concentration |

**This is the primary anti-formula safeguard: the gate's expectations are mode-conditional, so no mode is measured against another's shape.**

---

## 14. Interaction with the Continuity Director

**Strict separation.** The Continuity Director answers *"is this physically possible?"* The Quality Gate answers *"is this worth watching?"* They must not merge.

- Narrative checks live in new modules and in the quality report — **never inside `validateContinuity()`**.
- The one exception: `repeatedShotRun` is a *narrative* observation living in a *physical* validator. It is **upgraded in place** (fuzzy matching, longer window) and the distinctiveness engine **reads** its conclusion rather than recomputing it. One camera-repetition check, not two.
- `ContinuityState` is untouched. The contract adds no physical fields.
- CHAIN/CUT logic untouched.

---

## 15. Interaction with StoryMemory and Life Journey

**StoryMemory:** extended, never duplicated. New fields (`recentGoals`, `recentProgressions`, `decisionsAwaitingConsequence`) are **derived** in `buildStoryMemory()` from `blueprint + scenes`, exactly like `socialState` and `activeProps`. No new persisted state, no second memory system.

**Life Journey:** untouched and still optional. Three integration points, all read-only:
- `Routine.variationAcrossStory` becomes an **exemption source** for the duplicate engine — the rule already exists and is generalised rather than copied.
- Distinctiveness is evaluated **within a phase**; the same routine across two phases is the point of the form.
- Place concentration is measured against `LifePhase.activePlaceIds`.

`lifeStateAt()` remains the single life-state accessor. The gate reads it; it never writes.

---

## 16. Interaction with Flow/Veo prompts

- `finalVideoPrompt` joins the similarity signature — two scenes producing near-identical prompts produce near-identical clips regardless of metadata.
- `performanceType` improves the prompt: an `establishing` prompt should describe a camera move across a space; a `dialogue-scene` prompt should carry the quoted lines (already guaranteed by `ensureDialogueInPrompt`).
- The feasibility check protects the clip: dialogue that cannot be spoken in ten seconds produces a clipped or rushed generation.
- **Unchanged:** self-containment, opening-frame restatement, negative prompt field, CHAIN frame handoff, `ensureDialogueInPrompt`.

---

## 17. Anti-overfitting safeguards

1. **No plot, world, cast, occupation or moral is ever named** in any doctrine addition. Craft vocabulary only, in the established `BEAT_SPINE` style.
2. **Mode-conditional expectations** (§13) — nothing is measured against a single ideal shape.
3. **Intentional repetition is first-class**, with declared exemptions.
4. **Thresholds are calibrated against fixtures**, never guessed, and each ships with its calibration recorded.
5. **Everything starts report-only.** Promotion requires evidence.
6. **The jogging case is one fixture among many** (§19.2) — the suite deliberately includes repeated walking, repeated table talk, repeated celebration, repeated searching, repeated reaction shots and repeated motivational dialogue, so the engine cannot be tuned to one verb.
7. **Negative fixtures are mandatory**: legitimate montage, legitimate callback, legitimate recurring location, legitimate silence, legitimate ritual. A build that flags these fails.
8. **No metric may be "improved" by reducing creativity.** Explicitly: the gate never rewards shorter dialogue, more locations, or more characters for their own sake.

---

## 18. Backward compatibility

- Every new field is **optional**. An older story renders and reports exactly as today.
- Contract-dependent checks **skip** when the contract is absent, and the report says `degraded: true` rather than reporting a clean bill of health it cannot vouch for.
- `storyFunction` is **kept** — demoted to a gloss, not removed. Nothing downstream breaks.
- Blueprints without density fields normalise as today.
- `StoryQualityReport`'s 18 existing fields keep their names, types and meanings.
- No change to token-budget architecture, provider infrastructure, auth, database, sidebar, or Recent Stories.

---

## 19. Test strategy

**Designed before implementation, as asked.** All deterministic, all fixture-driven, no API calls. Extends the existing `tests/` suite and `npm test`.

### 19.1 Unit tests
- Signature construction: stable, order-independent, robust to punctuation and case.
- Similarity: identical → 1.0; paraphrase → high; unrelated → low; **empty/short fields must not produce false 1.0** (the classic Jaccard-on-empty-set bug).
- Feasibility: word counts → seconds at the documented rate; each performance type's budget.
- Contract validation: `before === after` detected; missing contract degrades rather than throws.
- Beat density: declared vs derived span.
- Exemption logic: each exemption source, and the "recurrence with no variation is still flagged" case.

### 19.2 Synthetic bad-story fixtures — the regression class
Each is a hand-built scene array; the engine must flag it:

| Fixture | Failure |
|---|---|
| `repeated-jogging` | 8 scenes, same goal, same action, same progression kind |
| `repeated-walking` | same shape, different verb — proves no verb overfit |
| `repeated-table-talk` | static dialogue scenes, same place, same emotional state |
| `repeated-celebration` | stretched resolution, 10 scenes of arrival/cheering |
| `repeated-searching` | same goal, same obstacle, no escalation |
| `repeated-reaction-shots` | camera + emotion repetition, minimal content |
| `generic-motivational` | dialogue that would fit any story with the same theme |
| `unspeakable-dialogue` | 80 words in a ten-second scene |
| `dead-air` | 4 words in a `dialogue-scene` |
| `no-progression` | every scene `before === after` |
| `unchained-decisions` | decisions with no consequence scenes |

### 19.3 Negative fixtures — must NOT be flagged
| Fixture | Legitimate because |
|---|---|
| `legitimate-montage` | declared montage elements with stated variation |
| `legitimate-callback` | comedy callback with `repetitionIntent` + variation |
| `legitimate-ritual` | Life Journey routine recurring across phases, with variation |
| `legitimate-silence` | `silent-emotional` scenes with zero dialogue |
| `single-location-story` | a siege / one-room story — place concentration is the form |
| `quiet-family-story` | no villain, no danger, small stakes, strong relationship progression |
| `mystery-revisits` | investigation returning to the same place with new information |

### 19.4 Scale and mode matrix
2-minute (12 scenes) · 6-minute (36) · 10-minute (60) × Single Episode / Life Journey, and one fixture per mode: comedy, mystery, quiet emotional family, dialogue-heavy, visually-driven low-dialogue.

**Assertion for every mode fixture:** zero false positives on its own legitimate patterns.

### 19.5 Calibration harness
A script that runs all fixtures across a threshold sweep and prints the separation between bad and negative fixtures. **Thresholds are chosen from this output and the chosen value is recorded in the constant's comment.** This is what §17.4 means operationally.

### 19.6 Backward-compatibility test
A fixture with no contracts at all must produce a report with `degraded: true`, no crashes, and all 18 existing metrics unchanged.

---

## 20. Implementation phases, in dependency order

Each phase leaves the build green and is independently shippable. Phases P0–P4 are **report-only** — no generation behaviour changes until P3.

**P0 — Measurement, on existing data.** *No schema change, no prompt change.*
`scene-distinctiveness.ts` + `performance-budget.ts` + fixtures + calibration harness. Runs against `characterActions` / `dialogueTurns` / camera / `finalVideoPrompt`, which already exist. Wire into the quality report and the dev report.
**Why first:** it can be validated entirely offline, and it will immediately score the already-generated failing story — turning "it feels repetitive" into a number before anything else is built.

**P1 — Beat density planning.** Blueprint schema + doctrine + normalisation + report. Report-only.
**Gate:** the density report must correctly describe a stretched beat sheet in a fixture.

**P2 — Scene Progression Contract.** Types + `SCENE_SCHEMA` + schema doctrine. Scenes start carrying contracts; nothing enforces yet.
**Gate:** contracts parse; stories without them still work (`degraded: true`).

**P3 — Prompt changes.** Intra-batch progression rail; performance-type guidance replacing the flat 4–6 rule; widened dialogue memory. **First phase that changes generated output.**
**Gate:** a real generation, reviewed by you — P0's metrics should move.

**P4 — Full Quality Gate.** Contract-dependent checks (progression coverage, escalation, agency, choice→consequence, thread resolution), severity classification, setup/payoff window fix, upgraded camera check.

**P5 — Targeted repair.** Opt-in, bounded, verified, reusing the existing single-scene regeneration path.

**P6 — Dialogue detectors.** Near-duplicate lines, generic-motivational register, action narration, voice collapse.

**Ordering rationale:** P0 needs nothing and proves the concept on existing data. P1 fixes the upstream cause before downstream work depends on it. P2 must precede P3 (the rail references contract fields) and P4 (checks read them). P5 needs P4's findings. P6 is independent and last because it is the most subjective.

---

## 21. Risks and tradeoffs

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | False positives punish legitimate craft | **High** | §19.3 negative fixtures are mandatory build gates; everything starts report-only |
| R2 | Thresholds become arbitrary | **High** | §19.5 calibration harness; each constant ships with recorded justification |
| R3 | Scene schema growth → token cost and truncation | **High** | Contract is ~6 short fields; measure at P2 before P3. Headroom exists (120k default, 384k ceiling) but is unverified for this payload |
| R4 | Model games the contract — plausible fields, identical scenes | **High** | Code verifies `before ≠ after` and cross-scene kind/goal runs; the contract is checked, not trusted |
| R5 | Performance types are mis-assigned to dodge dialogue rules | Medium | Distribution is reported; a story that is 80% `establishing` is visible |
| R6 | Repair loop burns tokens or degrades quality | Medium | Opt-in, one pass, hard cap, verified, original kept if not improved |
| R7 | Quality checks creep into the Continuity Director | Medium | §14 separation; camera check upgraded in place, never duplicated |
| R8 | Over-fitting to the jogging case | **High** | §17.6 six equivalent fixtures with different verbs and shapes |
| R9 | Mode-conditional expectations become a formula per mode | Medium | Expectations are *profiles reported*, not pass/fail gates |
| R10 | Fixing dialogue density re-breaks it in the other direction | Medium | This already happened once (§2.5). The budget model replaces the global number rather than retuning it |

---

## 22. Files likely to change

**New**
| File | Contents |
|---|---|
| `src/server/story/scene-distinctiveness.ts` | signatures, similarity, exemptions, near-duplicate findings |
| `src/server/story/performance-budget.ts` | speech rates, per-type budgets, feasibility |
| `src/server/story/quality-gate.ts` | severity classification, repair candidates, aggregation |
| `tests/fixtures/*.ts` | bad + negative story fixtures |
| `tests/story-quality.test.ts` | the suite from §19 |
| `tests/calibrate-thresholds.ts` | threshold sweep harness |

**Modified**
| File | Change | Risk |
|---|---|---|
| `src/types.ts` | new optional types (§6) | Low |
| `src/server/story/blueprint.ts` | beat density; extended quality report; StoryMemory additions; setup window fix | **Medium-high** |
| `src/server/story/story-craft.ts` | performance-type guidance replacing the flat density rule; mode progression profiles | **Medium-high** |
| `server.ts` | `SCENE_SCHEMA` contract fields; progression rail; gate wiring; repair (P5) | **High** |
| `src/server/story/continuity-director.ts` | camera repetition upgraded **in place** only | **High** — most battle-tested file |
| `src/server/dev/story-report.ts` | quality-gate section | Low |
| `src/server/story/life-journey.ts` | expose routines as an exemption source (read-only) | Low |

---

## 23. Explicitly NOT changed

- Character Bible structure and `lockedVisualDescription` identity lock
- `ContinuityState`, CHAIN/CUT, frame handoff, prop/position/exit validation
- FACTS / STATE / PHYSICS / LIFE STATE separation
- Social Graph, World Registry, reciprocity, namespaced ids
- Life Journey architecture; it stays optional and dormant by default
- StoryMemory's derived-not-stored design
- DeepSeek token-budget architecture, provider infrastructure, timeouts
- Auth, database, sidebar, Recent Stories, Story Inspirations
- The no-fabricated-scenes rule
- The existing 11 Story Modes
- `npm run build` / deployment shape

---

## 24. Open questions for approval

1. **P0 scope** — run the new metrics against your existing failed story's `test-output/` MD first, so we have a measured baseline before building anything? (Free, no API calls, and it validates the thresholds against a real failure.)
2. **Repair (P5)** — build it at all, or stop at reporting and let you regenerate specific scenes manually from the UI?
3. **Blocking** — I propose nothing ever blocks. Agree, or do you want a "this story is badly broken, regenerate?" prompt before the package opens?
4. **Contract token cost** — if P2 measurement shows the contract materially raises per-batch cost, prefer (a) fewer contract fields, (b) smaller batches, or (c) accept the cost?
5. **Dialogue density right now** — §2.5 shows the current 4–6 turn rule targets 32–84 words in a ten-second shot, which is unspeakable. Want that corrected as an immediate one-line fix before this plan is implemented, or folded into P3?

---

*Plan only. No production code modified. No story generated. No DeepSeek calls. No API tokens spent.*

---

## 25. P0 IMPLEMENTATION RECORD (2026-09-19)

### 25.1 The Q5 correction (approved as an immediate fix)

The rule being corrected asked for **4–6 turns of 8–14 words** in a ten-second shot — 32–84 words, or 11–28 seconds of continuous speech. Measured evidence from a real 36-scene generation: **average 38.1 words per scene, speech alone filling 136% of the shot, and exactly six turns in 33 of 36 scenes (92%).** The model was filling a quota it could not physically perform.

Three edits, nothing else:

| File | Before | After |
|---|---|---|
| `story-craft.ts` line-length constant | `SIX TO TEN` / `EIGHT TO FOURTEEN WORDS per line` | `FOUR TO SEVEN` / `FIVE TO NINE WORDS per line` |
| `story-craft.ts` density rule | *"FILL THE SCENE WITH TALK: a ten-second scene comfortably holds FOUR to SIX short exchanges."* | *"WHAT ACTUALLY FITS IN TEN SECONDS: …about FOURTEEN TO TWENTY-TWO WORDS of speech — roughly THREE OR FOUR short turns."* plus *"THIS IS AN ENVELOPE, NOT A QUOTA"* and a note that uniform density is itself repetition |
| `story-craft.ts` silence rule | *"A scene with NO dialogue must be a deliberate choice… It is rare. If you are not sure, they talk."* | *"SOME SCENES ARE LEGITIMATELY NEAR-SILENT, and must not have dialogue pushed into them to hit a number"* — naming establishing, action, montage, suspense, held looks and final images |
| `server.ts` `dialogueTurns` schema description | *"normally holds FOUR to SIX short turns… One or two turns leaves the scene feeling empty."* | *"SPEAKABILITY CEILING… roughly FOURTEEN TO TWENTY-TWO WORDS total… This is what FITS, not a target."* |

The original defect this regression was fixing — a narrator carrying the story while characters managed two thin lines — is explicitly preserved in the new wording. **No Performance Director was implemented.**

### 25.2 What P0 shipped

| Component | File | Owns |
|---|---|---|
| Scene Distinctiveness Engine | `src/server/story/scene-distinctiveness.ts` | signatures, pairwise similarity, exemptions, repetition runs, place concentration |
| Performance Budget | `src/server/story/performance-budget.ts` | speech rates, word envelope, per-scene feasibility, turn-count spread |
| Report rendering | `src/server/dev/quality-section.ts` | Markdown for both |
| Report parser | `tests/parse-report.ts` | reads saved `test-output/` Markdown back into scenes |
| Fixtures | `tests/fixtures/story-fixtures.ts` | 7 bad + 7 negative |
| Tests | `tests/story-quality.test.ts` | 87 assertions |
| Calibration | `tests/calibrate-thresholds.ts` | three-population sweep (`npm run calibrate`) |

Wired into `buildStoryQualityReport()` as an optional `distinctiveness` field and onto the story as `dialogueFeasibility`, both **report-only**, both surfaced in the dev report.

### 25.3 Calibrated thresholds and their evidence

| Constant | Value | Evidence |
|---|---|---|
| `NEAR_THRESHOLD` | **0.48** | Every value in 0.45–0.50 catches 7/7 bad fixtures with 0/7 false positives. 0.48 is the midpoint, for maximum margin. My original hand-picked **0.55 missed `repeated-celebration`** (max pair 0.548) — which is why this is calibrated, not chosen. |
| `FAR_THRESHOLD` | **0.60** | Clears the entire negative population (max 0.425) with wide margin, stays below the bad mean (0.551). **Less well evidenced than NEAR** — short fixtures produce few far pairs. Flagged for recalibration once a long repetitive real story exists. |
| `NEAR_WINDOW` | 6 scenes | Repetition close together reads as a stall; far apart it is more often deliberate. |
| `RUN_LENGTH` | 3 scenes | Two similar scenes is a coincidence; three is a stretch. |
| `UNVARIED_THRESHOLD` | 0.85 | Deliberately conservative — the worst bad fixture tops at 0.713, so this fires only on near-verbatim recurrence. Withdrawing an exemption is a strong claim and needs overwhelming evidence. |

**Population separation:** BAD in-window n=71, range 0.427–0.713, mean 0.551. NEGATIVE in-window n=27, range 0.138–0.425, mean 0.240. Clean gap, no overlap.

### 25.4 Real-story baseline

| Story | Scenes | Avg consecutive similarity | Flagged pairs | Avg words/scene | Overruns |
|---|---|---|---|---|---|
| Inspector Kheera (Mystery, 6 min) | 36 | **0.273** | 0 | **38.1** (136% of shot) | **35/36** |
| Chintu Matar (Heartwarming, 60 s) | 6 | **0.277** | 0 | **9.2** (33% of shot) | 0 |

**Honest reading:** neither saved story is repetitive by this measure — both sit inside the *negative* population, below every candidate threshold. The repeated-jogging behaviour described was not among the saved reports, so the distinctiveness engine is validated against fixtures rather than against that specific failure. The **dialogue** finding, by contrast, is overwhelming and real.

The two stories bracket the Q5 problem precisely: one starved at 9.2 words, one impossible at 38.1. The corrected envelope (14–22 words) sits between them.

### 25.5 Deviations from the plan as written

1. **Run detection was redesigned mid-implementation.** The planned definition (an unbroken chain of flagged consecutive pairs) was brittle: `repeated-jogging` produced 22 flagged pairs but **zero runs**, because one adjacent pair landed at 0.427 and broke the chain. Replaced with participation-based detection — a scene is *stalled* when it resembles two or more neighbours inside the window, and contiguous stalled scenes form a run. All 7 bad fixtures now report a run; all 7 negatives report none.
2. **IDF weighting was considered and rejected.** It suppresses exactly the signal being hunted: a verb repeated across eight scenes gets a *low* IDF precisely because it repeats. Flow-prompt boilerplate is handled directly instead, by stripping each character's `lockedVisualDescription` before comparison.
3. **`cameraShot` / `cameraMovement` are not printed as their own fields** in the saved report, so the parser recovers them from `continuityState.cameraState`. Present in all 36 scenes of the real story.

### 25.6 What P0 did NOT do

No scene-schema change, no prompt change beyond Q5, no blueprint change, no beat density, no scene contract, no repair, no quality gate, no blocking, no batch-size change, no token-architecture change, no DeepSeek call.

---

## 26. P1 IMPLEMENTATION RECORD (2026-09-19) — Beat Density

### 26.1 The algorithm

For each beat, three numbers are compared — and only one of them is believed.

```
allocatedScenes     = sceneEnd - sceneStart + 1        (structural fact)
declaredDistinct    = beat.distinctScenesNeeded        (a CLAIM - never trusted alone)
describedMoves      = beat.whatEachSceneDoes.length    (evidence supplied)
verifiedDistinct    = clusterMoves(whatEachSceneDoes)  (evidence CHECKED)
stretchScenes       = max(0, allocatedScenes - verifiedDistinct)
```

`clusterMoves` is **single-linkage** clustering on P0's `textSimilarity`. Single-linkage is the correct choice here and not an accident: a stretched beat *drifts* — scene 3 resembles scene 2, scene 4 resembles scene 3 — and complete linkage would break that chain and under-report exactly the failure being hunted.

Findings emitted, all report-only:

| Code | Fires when | Severity |
|---|---|---|
| `declared-distinctness-unsupported` | `declaredDistinct > verifiedDistinct` | warning |
| `beat-stretched` | a non-final beat has `stretchScenes > 0` | warning |
| `resolution-stretched` | the **final** beat has `stretchScenes > 0` | warning |
| `description-count-mismatch` | `describedMoves ≠ allocatedScenes` | warning if fewer, info if more |
| `premise-too-small` | total stretch ≥ max(3, 15% of runtime) | warning |
| `unverifiable` | the beat carries no `whatEachSceneDoes` | info |

### 26.2 How a false `distinctScenesNeeded` is caught

A model asked *"how many distinct scenes do you need?"* will answer with the number it was allocated. A model asked *"what does each scene do?"* has to **write the moves down** — and paraphrases of one move are detectable.

So the declared number is never read on its own. It is compared against `verifiedDistinctMoves`, derived independently from the prose. The `false-distinctness-claim` fixture declares 6 distinct scenes while describing one search six ways; the engine verifies **2** and reports the gap, naming the exact scenes that repeat and their similarity.

An **honest low declaration is not punished** — declaring 1 for a 3-scene beat raises no false-claim finding, only the stretch itself. That is the behaviour the doctrine asks for.

### 26.3 Fixture results — 0 false positives, 0 false negatives

| Bad fixture | Verified moves / scenes | Stretch | Codes |
|---|---|---|---|
| stretched-celebration | 4/8 | 4 | declared-unsupported, resolution-stretched, premise-too-small |
| false-distinctness-claim | 2/6 | 4 | declared-unsupported, resolution-stretched, premise-too-small |
| repeated-attempts-no-escalation | 1/5 | 4 | declared-unsupported, resolution-stretched, premise-too-small |
| repeated-travel | 1/6 | 5 | declared-unsupported, resolution-stretched, premise-too-small |
| thin-beat-stretched-long-runtime | 16/24 | 8 | declared-unsupported, beat-stretched, premise-too-small |
| repeated-reaction-beat | 1/4 | 3 | declared-unsupported, resolution-stretched, premise-too-small |

| Negative fixture | Verified moves / scenes | Stretch | Findings |
|---|---|---|---|
| escalating-attempts | 4/4 | 0 | none |
| mystery-clues | 5/5 | 0 | none |
| varied-montage | 4/4 | 0 | none |
| evolving-emotional-conversation | 5/5 | 0 | none |
| life-journey-routine-variation | 4/4 | 0 | none |
| multi-scene-climax | 5/5 | 0 | none |
| well-paced-full-film | 12/12 | 0 | none |

Every legitimate multi-scene beat verifies **one move per scene**. In `thin-beat-stretched-long-runtime` the two dense beats report zero stretch while the padded middle beat carries all 8 — the finding is correctly localised rather than smeared across the film.

### 26.4 Calibrated threshold

`MOVE_SIMILARITY_THRESHOLD = 0.45`

Perfect-separation range **0.32 – 0.58** (14 sweep values, 6/6 caught and 0/7 false positives throughout). 0.45 is the midpoint, for maximum margin on both sides. Deliberately **not** inherited from P0's `NEAR_THRESHOLD`: that was calibrated on multi-dimension scene signatures, these are single short strings, and sharing the number would be a coincidence dressed as a decision. The *utilities* are shared; the number is not.

### 26.5 P0 change forced by P1 — and its consequences

P1's unit tests exposed a real tokenizer weakness: **`search` and `searching` were different tokens**, so short paraphrases of one move scored below any usable threshold — the repetition hid in the grammar. Scene signatures are long enough to tolerate this; beat descriptions are not.

Fix: a minimal, conservative stemmer in P0's `tokenize()` — four English suffixes (`ing`/`ed`/`es`/`s`), nothing else, because dialogue is Roman Urdu and an aggressive stemmer would mangle it. Both sides of every comparison are stemmed identically, so a wrong strip is symmetric noise rather than bias.

**Both calibrations re-run.** P0's perfect-separation range **widened** from 0.45–0.50 to **0.45–0.55**, and all 14 P0 fixtures still classify correctly. Per the standing instruction, `NEAR_THRESHOLD` was **kept at 0.48** — it remains inside the widened range with 7/7 and 0/7. (0.50 is now the midpoint if more margin is ever wanted; that is a decision, not a fix.) `FAR_THRESHOLD` and `UNVARIED_THRESHOLD` unchanged.

### 26.6 Backward compatibility — verified

| Case | Result |
|---|---|
| Blueprint with **no** density fields | `degraded: true`, zero stretch warnings, every beat listed unverifiable, summary reads "not measured" |
| **Half-migrated** blueprint (one beat has fields, one does not) | `degraded: false`, described beat verified, bare beat listed unverifiable, **no false stretch** from the missing half |
| Unverifiable beats | Credited with their full allocation, never accused. Reporting "8 scenes of padding" because a field was missing would be inventing a finding. |

### 26.7 What P1 did NOT do

No scene-schema change, no scene contract, no P2–P6 work, no repair, no blocking, no batch-size change, no provider/token change, no DeepSeek call. The beat sheet is never rewritten and no scene range is reallocated — verified by a test that asserts the input is not mutated.

---

## 27. P2 IMPLEMENTATION RECORD (2026-09-19) — Scene Progression Contract

### 27.1 What shipped

Types in `src/types.ts`; validation in `src/server/story/scene-contract.ts`; schema in `server.ts`'s `SCENE_PROPERTIES` (and added to `REQUIRED_SCENE_FIELDS`, so the model actually emits it); report section in `dev/quality-section.ts`.

`storyFunction` is **unchanged and still required** — it is now the human-readable gloss beside the machine-readable contract, not a thing replaced by it.

### 27.2 Validation algorithm

Each contract is checked, never believed:

| Check | Method |
|---|---|
| `missing-goal` / `missing-obstacle` | length floor |
| `invalid-outcome` / `invalid-kind` / `invalid-performance-type` | membership in the exported vocabularies |
| `identical-before-after` | normalised equality |
| `near-identical-before-after` | `textSimilarity ≥ 0.62` |
| `generic-progression` | whole-value match against a non-answer list (`same`, `unchanged`, `normal`…) |
| `activity-as-progression` | **lexical, threshold-free**: both `before` and `after` name a cast member *and* contain an action-verb stem |
| `progression-restates-action` | `textSimilarity(before/after, characterActions) ≥ 0.50` |
| `duplicate-contract` | same kind + similar value + similar before + similar after, across scenes |
| four `repetition-intent-*` codes | backward reference, known scene, known kind, real variation |

### 27.3 How fake before/after changes are caught

Four independent detectors, because each defeats a different dodge:

1. **Equality** — `blocked → blocked`.
2. **Similarity** — `"guarded and holding back" → "holding back and guarded"` scores 0.96.
3. **Lexical activity** — the user's own example, `"Golu enters the room" → "Golu talks to Mooli"`, defeats both of the above because the two strings genuinely differ. It is caught by noticing that both sides name a character *doing* something rather than naming a *state*.
4. **Action mirroring** — the claimed change restates the scene's own `characterActions`.

Detector 3 and detector 4 were originally one finding. They were **split during implementation** because the calibration harness could not model a code that fires from both a threshold-free and a threshold-based path — and separating them is better design anyway: different mistakes, different fixes.

### 27.4 RepetitionIntent safeguards

`isUsableRepetitionIntent` lives in `scene-distinctiveness.ts` (one-directional dependency: the contract module already reads those utilities) and is applied by **both** modules, so there is one rule and it cannot drift.

A declaration is usable only when it names a recognised kind, points **backward** at a scene that **exists**, and carries a variation of real length. P0's exemption path was tightened to require this — previously any object with a matching `echoesScene` exempted the pair. Tested directly: an empty variation, a forward reference and an echo of a missing scene each leave the pair fully measurable. A *valid* declaration is still withdrawn at `UNVARIED_THRESHOLD` when the two scenes turn out near-identical.

### 27.5 Fixture results — 10/10 bad, 10/10 legitimate

Every bad fixture raises its intended code: identical before/after, paraphrased before/after, activity-as-progression, progression-mirrors-action, empty goal, invalid outcome, forward callback, unknown-scene callback, unvaried intent, duplicate contracts.

Every legitimate fixture is clean, including the deliberately **small** ones: a quiet emotional shift with no dialogue, an establishing shot landing one fact, a wordless ritual, `"Mooli's pride: unbending → bending slightly"`. **No false positives, no false negatives.**

### 27.6 Calibrated thresholds

| Constant | Value | Evidence |
|---|---|---|
| `BEFORE_AFTER_THRESHOLD` | 0.62 | Perfect range 0.40–0.88. Legit before/after similarity max **0.067**; bad min **0.964**. Clean gap **0.897**. |
| `ACTIVITY_THRESHOLD` | 0.50 | Perfect range 0.30–0.75. Legit max **0.234**; bad min **1.000**. Clean gap **0.766**. |

**Honest caveat:** these gaps are so wide that the exact threshold is not the binding constraint — almost any value in the middle works. That means the risk here is **fixture difficulty, not threshold choice**. Real model output will produce subtler fakes than hand-written fixtures, and these numbers should be revisited against a real contract-carrying generation.

### 27.7 Schema and payload overhead (evidence for Q4)

| | chars | ~tokens |
|---|---|---|
| Scene schema **without** contract | 11,272 | 2,818 |
| Scene schema **with** contract | 15,495 | 3,874 |
| **Schema delta** (once per batch) | **4,223** | **~1,056** (+37% of the scene schema) |
| Filled contract, per scene | 347 | ~87 |
| …with `repetitionIntent` | 486 | ~122 |
| **12-scene batch total** | | **~2,097 tokens** |

Against the measured 36-scene Mystery run (~25,000 prompt + ~43,000 completion per call): **+4.2% prompt, +2.4% completion.** The output ceiling is 120,000 tokens per call against 384,000 available, so ~1,041 extra completion tokens sits well inside headroom.

**Recommendation: no compaction and no batch-size change.** The cost is not material. `npm run measure` re-runs this.

### 27.8 Backward compatibility

A contract-less story reports `degraded: true`, raises **zero** warnings, lists every scene as missing and claims **no** valid contracts — it never reports a clean bill of health it cannot vouch for. A half-migrated story is not degraded: the contract-carrying scene is validated, the bare one is listed missing, and no false warning is produced. Existing P0/P1 metrics are untouched.

### 27.9 Ownership boundary — tested

A test asserts that validation leaves `continuityState` and `socialChanges` byte-identical. The contract records a scene's dramatic *claim*; physical state, relationship deltas, life state, the Character Bible and the setup/payoff source of truth all stay where they already live. A progression may say trust moved; the fact and the delta are still owned by the social layer.

### 27.10 What P2 did NOT do

No P3 prompt rail, no performance-density rules (`performanceType` is classification only), no P4 quality gate, no repair, no blocking, no batch-size change, no provider/token change, no DeepSeek call.

---

## 28. P4 IMPLEMENTATION RECORD (2026-09-19) — Story Quality Gate

### 28.1 What shipped

| File | Role |
|---|---|
| `src/server/story/action-density.ts` | NEW measurement: can the staging happen in one clip? |
| `src/server/story/quality-gate.ts` | The gate. Consumes P0-P3 + continuity; owns nothing |
| `src/types.ts` | `QualitySeverity`, `QualityFindingCode`, `QualityFinding`, `StoryQualityGateReport` |
| `src/server/dev/quality-section.ts` | `buildQualityGateSection` |
| `tests/fixtures/action-fixtures.ts` | 6 overloaded + 10 renderable |
| `tests/quality-gate.test.ts` | 83 assertions |
| `tests/calibrate-action-density.ts` | Threshold sweep + real-story plot |

### 28.2 Action density — the measure, and why it is not a verb count

The distinction is SEQUENTIAL versus SIMULTANEOUS:

- `"she paints WHILE he pugs clay AND the child swings"` — one beat with background life. Renderable, and it is what a lived-in frame looks like.
- `"she picks it up, carries it across the yard and pushes it under the stack, THEN sets the tray down"` — four beats in three places. Needs an edit.

So the primary strand is split on sequential markers **and** on plain clause boundaries, and a segment is promoted to a beat only when it **opens** with a stageable verb. Relocation requires a locomotion verb **plus** a destination phrase — matching prepositions alone counted `"lifts the diya out from under the cloth hem"` as travel, which is where an object came from, not where a character went.

Overloaded when `relocations >= 2` **or** (`beats > type limit` **and** `relocations >= 1`). The second clause requires movement because a run of manipulations in one spot is a performance however many verbs it uses.

### 28.3 Calibration — 0 false positives, 0 false negatives

| Population | Sequential beats | Relocations |
|---|---|---|
| Overloaded (n=6) | min 3, mean 4.17, max 5 | min 1, mean 1.33, max 2 |
| Renderable (n=10) | min 1, mean 1.33, max 3 | min 0, mean 0.33, max 1 |

**16/16 fixtures correct.** Two measurement bugs were found *by* the calibration and fixed rather than tuned around: beat-splitting missed plain `", "` and `" and "` boundaries, so relocation was silently doing all the discrimination; and `crosses to the crate stack` was missed because bare `"to the"` is too loose for the destination list — some verbs (`cross`, `return`, `head`, `march`) mean travel on their own.

### 28.4 The language guard — a silent false-negative caught in real output

The first post-P3 story (`Jahazi`, 2026-09-19) writes `characterActions` in **Roman Urdu**. The earlier `Roshni Ke Diye` wrote them in English. The staging vocabulary is English, so on Jahazi every verb missed and the measure returned **"0 beats, not overloaded" for all 36 scenes** — a confident *clean* that actually meant *blind*.

Fixed by marking a substantial action line with no recognisable staging verb as `confident: false` → **unclassified**, surfaced in the report. Deliberately **not** fixed by guessing Roman Urdu verb morphology: a half-right vocabulary would produce false positives in a language these thresholds were never calibrated against. This is the top limitation (§28.9).

### 28.5 Finding codes and severity policy

**`block` = a severe quality failure was detected. The story is still delivered in full.** Nothing in P4 withholds, rewrites or repairs anything.

| Code | Severity | Source |
|---|---|---|
| `repetition-run` | block (≥4 scenes) / repair | P0 |
| `chain-screen-direction-reversed` | block | Continuity Director |
| `near-duplicate-scenes` | warn | P0 |
| `unvaried-declared-recurrence` | warn | P0 |
| `consecutive-same-dramatic-job` | repair | P2 |
| `planned-move-not-executed` | repair | P2 + P3 |
| `outcome-contradicts-progression` | warn | P2 |
| `relationship-change-uncorroborated` | info | P2 + social deltas |
| `contract-unusable` | warn | P2 |
| `dialogue-overruns-shot` | repair | P0 |
| `dialogue-tight-for-shot` | info | P0 |
| `dialogue-underfilled` | info (dialogue-scene only) | P0 + P2 |
| `uniform-dialogue-density` | warn | P0 |
| `action-overloaded` | repair | P4 |
| `chain-join-unrenderable` | warn | Continuity Director |
| `scene-necessity-doubtful` | repair | combined |
| `beat-stretched` / `premise-too-small` | warn | P1 |
| `unresolved-setup` | warn | existing quality report |
| `progression-monotony` | warn | P2 |
| `place-concentration-pathological` | info | P0 |

### 28.6 Contract honesty — deterministic, no LLM

Five checks, each precise rather than interpretive:

1. **Consecutive same dramatic job** — same kind + similar value + similar direction in adjacent scenes.
2. **Planned move not executed** — similarity between the P1 planned move and the scene's own *claim* (goal + value + after + storyFunction). Originally compared against the full scene evidence and took the best match, which meant a shared character name cleared the bar and the check could never fire; comparing the claim alone is the honest question.
3. **Outcome contradicts progression** — logical contradictions inside the model's own vocabulary (`setback` + `achieved`, `progress` + `denied`).
4. **Relationship change uncorroborated** — a `relationship` progression with no entry in `socialChanges`, using the layer that *owns* relationships as corroboration rather than re-deriving state.
5. **Contract unusable** — lifted from P2 rather than recomputed.

### 28.7 How performanceType changes evaluation

- **Action density limits** differ per type: `action` 4, `dialogue-scene`/`comedy-beat`/`transition` 3, `reaction`/`establishing`/`silent-emotional`/`montage-element` 2.
- **`dialogue-underfilled` fires only for `dialogue-scene`.** A silent, reaction, establishing, action or montage scene is never reported for being sparse — tested directly.

### 28.8 Continuity consumed, not duplicated

P4 **re-validates nothing**. It reads `scene.continuityIssues` and promotes only findings that make a join *physically unrenderable*: CHAIN screen-direction reversal (blocking) and a CHAIN not opening where the previous scene ended (warn). Everything else is counted as `continuityNoise` and left with the Continuity Director, because that validator has known false-positive classes (prose-level location comparison, overnight time) and folding them in would bury the real findings.

### 28.9 Limitations

1. **Action density is English-only.** 36/36 scenes unclassified on the one post-P3 story. Highest-value next fix.
2. **`planned-move-not-executed` is deliberately very tight** (0.08) and will fire rarely. Untested against real contract+plannedMove data because the saved report does not print per-scene contracts.
3. **`scene-necessity-doubtful` needs three independent signals**, so it is conservative by design.
4. Action-density fixtures are hand-written English prose; real generated staging may differ in shape.

### 28.10 What P4 did NOT do

No repair, no blocking, no scene mutation, no new state system, no blueprint change, no batch-size change, no provider/token change, no DeepSeek call. Prompt and token impact: **zero** — P4 runs entirely post-generation.

---

## 29. P4 CORRECTION (2026-09-19) — Roman Urdu action density

### 29.1 The blind spot

P4 shipped English-only. On the first post-P3 generation (`Jahazi`, Roman Urdu) **all 36 scenes came back unclassified** — correct fail-safe behaviour, but it meant P4 could not evaluate staging in the language these stories are actually written in.

### 29.2 Recognition strategy

**Language detection** (`looksRomanUrdu`): three or more function-word markers (`hai`, `kar`, `ke`, `ki`, `se`, `par`, `aur`, `mein`, `jabki`, `usi`, `waqt`, `taraf`, …), **or** two markers plus a recognised staging verb. The second clause exists because a short line like *"Sultan apna shawl takht par rakh deta hai"* carries only two grammar words and is still obviously Roman Urdu.

**Two structural differences drive the rest:**

1. **Word order.** Roman Urdu is verb-final — *"aangan paar karti hai"* puts the verb at the end. The English rule (a segment is a beat when it *opens* with a staging verb, which guards against descriptive tails) cannot work, so the Roman Urdu path asks whether the segment **contains** one.

2. **Participles bind.** *"tokri uthate **hue** … chalti hai"* is walking **while** carrying — one beat. *"utha **kar** … patakta hai"* is one continuous compound movement. Only finite verbs joined by `aur`, a comma or `phir` are separate beats. `kar` and `hue` are deliberately **excluded** from the sequential splitters; treating them as joiners would turn ordinary compound staging into a false overload.

**A third improvement, language-neutral:** a segment opening with a *different* proper name is parallel staging, not a later beat — *"Razia … rakh deti hai **aur Sultan** … dekhta hai"* is two people in one frame. This also improved the English path.

### 29.3 Supported action families

Move/walk/cross/run/stop · enter/leave/climb/descend · stand/sit/kneel/lie · pick up/put down/place/carry · give/take/hand · open/close · push/pull/drag/throw · reach/extend/gesture · hide/cover/wrap · turn/look · cut/tear/tie/count/measure. Locomotion is tracked as a **separate, narrower** set, because travel is what turns a performance into an edit.

### 29.4 Spelling variation

Doubled vowels are folded (`aa→a`, `ee→i`, `oo→u`), which handles `nikaal`/`nikal` and `tokree`/`tokri`. Consonant digraphs are **not** folded: `chal` (walk) and `chhal` (deceive) are different words, so where a digraph genuinely varies both spellings are listed explicitly (`chhupa`/`chupa`, `badha`/`barha`).

**One word needed an exception.** `paar` (across) folds to `par`, which is also the commonest postposition in the language (*"mez par"* = on the table). Folding made it match everywhere, so `paar` is compared **unfolded** against a small exact-match set. This was caught by the user's own BAD example failing to flag.

### 29.5 Results

| Population | False positives | False negatives | Unclassified |
|---|---|---|---|
| **Roman Urdu** (16 fixtures) | **0/11** | **0/5** | **0/16** |
| **English** (16 fixtures) | **0/10** | **0/6** | 1 (intentional: too short) |
| **Unreadable** (French, German, Chinese) | — | — | **3/3 correctly unclassified** |

**Real stories:** `Jahazi` went from 36/36 unclassified to **36/36 classified, 2 flagged** (S27: five beats and two relocations; S12: room → stairs → roof). English stories unchanged: Roshni Ke Diye and Inspector Kheera still 0 overloaded.

### 29.6 Unclassified behaviour preserved

A substantial action line that neither vocabulary recognises still returns `confident: false` and is surfaced in the report. A confident *clean* that means *blind* remains the one thing this measure will not say.

### 29.7 Thresholds unchanged

`BEAT_LIMITS`, `DEFAULT_BEAT_LIMIT` and `RELOCATION_LIMIT` are untouched — calibration showed no need to move them.

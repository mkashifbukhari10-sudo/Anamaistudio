# Life Journey Director — Architecture Plan

**Status:** PROPOSAL — awaiting approval. No production code modified.
**Date:** 2026-09-17
**Scope:** Extend the existing Story Director so it can plan grounded, cinematic life-journey stories, without replacing any existing system and without making life-journey the default.

---

## 0. The one-sentence problem

AnamStudio can plan **an episode** — one continuous situation, physically continuous, with every fact frozen for the whole runtime. It cannot plan **a life** — several situations separated by deliberate time jumps, where who someone is at scene 60 is legitimately different from who they were at scene 1, and that difference is the point.

Everything below follows from that single gap.

---

## 1. Current architecture audit

### 1.1 Pipeline shape

```
Phase 1A  buildBlueprintSystemInstruction + BLUEPRINT_SCHEMA
          -> NarrativeBlueprint { logline, theme, castPlan, socialGraph,
                                  worldRegistry, relationships, beats,
                                  setups, chapters }
Phase 1B  screenplay + Character Bible, written AGAINST the blueprint
Phase 2   runSceneBatchPipeline -> batches of <= 12 scenes
            each batch receives: sliceBlueprintForRange() + buildStoryMemory()
                                 + ledger block + previousSceneContext
Phase 3   validateAndStandardizeTimeline
            -> resolveScenePlace, scrubPlaceIds, makeSelfContained,
               ensureDialogueInPrompt, normalizeContinuityState,
               enforceChainPlausibility, buildFrameHandoff
          reconcileHandoffs -> validateContinuity -> summariseContinuity
          validateStoryFacts -> reconcilePlannedChanges
          buildStoryQualityReport
```

### 1.2 The layer separation as it stands today

This separation is the best thing in the current architecture and the plan must not damage it.

| Layer | Meaning | Where it lives | Mutability |
|---|---|---|---|
| **FACTS** | Who someone *is* to another; what a place *is*; who owns what | `SocialGraph.bonds`, `Household`, `Place`, `WorldEntity`, `CharacterBibleEntry` identity fields | Established at blueprint time, injected verbatim into **every** batch, never rewritten by scene generation |
| **STATE** | How things currently *stand* | `RelationshipDelta` → `foldSocialDeltas()` → `SocialStateEntry`; `ContinuityLedger` | Accumulates forward; folded to latest-value-per-key |
| **PHYSICS** | The literal frame | `ContinuityState`, `openingState`, `CameraState`, `PropDisposition`, CHAIN/CUT | Per scene; compared pairwise |

Two structural guarantees already enforced:

- `blueprint.ts:sliceBlueprintForRange()` — *"Facts are never sliced by scene range: every batch gets the whole graph."* This is what stops a relationship being reinterpreted at scene 50.
- `types.ts:RelationshipDelta` — *"STATE, never FACT ... deltas are stored separately and nothing folds them back into the graph."* Deltas are structurally unable to rewrite a bond.

### 1.3 Component-by-component

**Narrative Blueprint** (`blueprint.ts`)
`BEAT_SPINE` is 18 named beats offered explicitly as *"craft vocabulary you may merge, reorder, or omit"* — not a checklist. `targetBeatCount()` and `targetCastSize()` scale with runtime. Beats must tile scenes `1..N` contiguously with no gaps or overlaps. Chapters group beats. **Nothing in the blueprint models time passing between beats.** A beat has `causeFromPrevious`, `consequence`, `escalation` — all causal, none temporal.

**Character Bible** (`types.ts:CharacterBibleEntry`, `server.ts` Phase 1B)
Two field groups: immutable visual identity (`veggieType`, `bodyShape`, `faceDesign`, `eyeStyleAndColor`, `veggieFeatures`, `mainColors`, `clothing`, `shoes`, `lockedVisualDescription`) and dramatic design merged from the blueprint (`want`, `need`, `flaw`, `arcStart/Midpoint/End`). `lockedVisualDescription` is restated **word-for-word in every Flow prompt** — `server.ts:455` calls this *"the only thing holding character identity stable across independent generations."* There is exactly one appearance per character for the whole film.

**Social Graph** (`social-graph.ts`)
`bonds` (directional, `enforceReciprocity()` completes the inverse), `households`, `characterSocial` (`lifeStage`, `householdId`, `responsibilities`), `plannedChanges`. The doctrine is emphatic and correct: *"A RELATIONSHIP LABEL IS A FACT, NOT A PERSONALITY TEMPLATE."* `plannedChanges` are relationship turning points pinned to a beat; `reconcilePlannedChanges()` reports fulfilled/unfulfilled/unplanned.

**Household system**
`Household { id, name, memberIds, dwellingPlaceId }`. Membership only. **No livelihood, no economics, no possessions, no pressures.** A household is a list of people and a house.

**World Registry** (`world-registry.ts`)
`Place { id, name, belongsToHousehold, fixedFeatures, connectsTo }` and `WorldEntity { kind, tier, ownerHouseholdId, homePlaceId, caredForBy, speech, plannedAppearances }`. Namespaced ids (`place_`, `entity_`, `household_`) after a real collision. `resolveScenePlace()` repairs the field-swap failure mode. Places are **timeless** — a place exists identically for the whole film.

**Story Memory** (`blueprint.ts:buildStoryMemory()`)
Derived fresh from `scenes + blueprint` each batch — never stored, so it cannot desync. Carries `storySoFar` (one line per scene), `beatsCompleted`, `dialogueCounts`, `recentDialogue` (last 10), `activeProps` (from the ledger, all scenes), `openSetups`, `emotionalTrajectory` (last 4), `socialState` (folded). This is the mechanism that makes 60 scenes feel like one film.

**Relationship Deltas**
`scene.socialChanges` → `normalizeSocialDeltas()` → `foldSocialDeltas()` → latest value per pair+dimension. Folded, not accumulated — a 60-scene film carries a short current-state list.

**Continuity Director** (`continuity-director.ts`)
Three jobs: NORMALISE (`normalizeContinuityState`), LEDGER (`buildLedger`, `foldSceneIntoLedger` — *"a field the scene left blank does NOT erase what was already known"*), RECONCILE (`reconcileHandoffs` rewrites a CHAIN opening to the previous ending). Then `validateContinuity()` reports. Notably sophisticated: `framingTightened()` distinguishes a reframe from an exit; position/emotion are deliberately **not** compared end-to-end because `continuityState` is the *final* frame.

**Fact Validator** (`fact-validator.ts`)
Report-only, deliberately non-overlapping with physics. Checks reciprocity, household membership, life-stage consistency, place registration, place-identity drift, entity usage, and the theme being spoken aloud.

**Setup / payoff**
`StorySetup { element, type, plantScene, payoffScene, meaning }`. `sliceBlueprintForRange()` keeps any setup planted-but-unpaid visible to every later batch. `buildStoryQualityReport()` verifies payoff by distinctive-token match in a ±1 scene window.

**Chapters / beats**
`numChapters` from runtime (12 at 60 scenes). Beats tile scenes; chapters group beats; scenes carry `beatNumber` and `chapterNumber`.

**Scene generation**
Batches of ≤12 (`MAX_SCENES_PER_BATCH`), split/retry recovery on failure, cross-batch state entirely **derived** from `blueprint + characters + scenes`.

**CHAIN / CUT**
`CUT` = normal edit. `CHAIN` = unbroken action across the join; requires the operator to upload the previous clip's last frame in Flow. `enforceChainPlausibility()` demotes a CHAIN that crosses registered places. Defaults to CUT because *"a wrong CUT costs nothing ... a wrongly-CHAINed one asks for an impossible shot."*

---

## 2. What is currently missing

Nine gaps, in order of how hard they block life-journey storytelling.

**G1 — No concept of story time.** `timeRange` is *screen* time (`0:00–0:10`), derived from scene number. `ContinuityState.timeOfDay` is a single string. There is nowhere to say "three years have passed."

**G2 — A time jump is currently a continuity ERROR.** `continuity-director.ts:632` ranks time-of-day on a single-day scale (`dawn`…`midnight`) and raises a **warning** whenever the rank decreases. A story that goes `night` → `next morning` trips it at every single overnight transition. Schema text at `server.ts:274` reinforces it: *"Must move forward across the film."* A 60-scene life journey would produce a continuous stream of false warnings.

**G3 — Life stage is frozen for the film.** `fact-validator.ts:167`: *"A character has one life stage for the whole film."* A child who becomes an adult is, today, a validation failure. This is the single hardest architectural blocker.

**G4 — One appearance per character, forever.** There is exactly one `lockedVisualDescription`, restated verbatim in every prompt. There is no way to render the same character older without either breaking identity lock (catastrophic for Flow consistency) or ignoring the passage of time.

**G5 — Households have no economics.** No livelihood, no income, no possessions, no pressure. "The family owns cows and sells milk" has nowhere to live as a fact, so it can only survive as prose in `fullStoryText` — which nothing validates and nothing carries forward structurally.

**G6 — No aspiration or milestone layer.** `want` is deliberately *filmable and immediate* ("carry the lantern to the far gate before the light goes"). A life goal ("become an officer") **fails the filmable test on purpose** and must not be forced into `want`. There is no home for a long-horizon goal, and nothing that requires an achievement to be *earned* by prior scenes.

**G7 — Routines are capability text, not data.** `story-craft.ts:buildEverydayLifeDoctrine()` tells the director everyday life is legitimate material and lists possibilities. But a routine is never *recorded*, so nothing can vary it deliberately or detect that it has been repeated eleven times.

**G8 — Places are timeless.** A school the child attends in phase 1 and never returns to is indistinguishable from the family courtyard. No place has a lifespan.

**G9 — The ledger carries everything forward, forever.** Correct within a continuous situation; wrong across "one year later," where held props and positions should clear while *registered possessions* persist. Today a jump would produce a storm of "Held object disappears" warnings.

### 2.1 Unrelated finding surfaced during this audit

While reading `story-craft.ts` for this audit I found that **one of the dialogue-density edits from the previous task did not land.**

`story-craft.ts:161`, the `emotional|heartwarming|friendship` genre shape, still reads:

> `"Understated. People in real feeling say less, not more. Resist having characters narrate their own emotions."`

The `git diff` confirms only `DEFAULT_SHAPE.dialogue` and `buildSceneCraftRules()` were changed. I reported this specific line as changed; it was not. It is injected into the scene prompt as `DIALOGUE REGISTER for this story:` and it directly contradicts the new density rules — for exactly the mode the flat Chintu Matar story used.

It is a one-line fix. I have **not** made it, because this task says do not modify production code. Flagging it so it is not lost, and so the next 10-minute generation is not run against a rule that fights the fix.

---

## 3. Proposed Life Journey Director architecture

### 3.1 The central idea — a fourth layer: **LIFE STATE**

The current three layers cannot hold life-journey data:

- Make occupation a **FACT** → it can never change, and the fact validator flags change as an error.
- Make occupation **STATE** (a per-scene delta) → it drifts, and it is re-asserted 60 times.

So introduce a fourth category with a precise definition:

> **LIFE STATE** is what is true of a character or household **for the span of one life phase**. It is immutable *within* a phase and changes *only* at a declared time jump, by a change planned at blueprint time.

This reuses the existing guarantee rather than weakening it. Inside a phase, life state behaves exactly like a fact — which means **every existing validator keeps working unchanged inside a phase**. All the new logic lives at phase *boundaries*, which are explicit, few, and planned.

### 3.2 The four layers after this change

| Layer | Changes when | Example |
|---|---|---|
| **IDENTITY (facts)** | Never | Gobhi is Aloo's wife. The courtyard has a neem tree. This character is a cauliflower. |
| **LIFE STATE** *(new)* | Only at a declared time jump | The son is a schoolchild → a student in the city → salaried. The household earns from milk → from milk plus a shop. |
| **SOCIAL / WORLD STATE** | Continuously, by delta | Trust between father and son after the argument in scene 31. |
| **PHYSICS** | Every scene | Who is holding the bucket at frame left at 0:07. |

### 3.3 The hierarchy — one grouping, not three

The user's instruction *"do not create overlapping sources of truth"* is the binding constraint here. Chapters and beats already group scenes. Adding a third independent grouping would create exactly the overlap being warned against.

**Rule: a Life Phase is a contiguous run of CHAPTERS.** Phase boundaries must fall on chapter boundaries.

```
scenes  ──tiled by──>  beats  ──grouped by──>  chapters  ──grouped by──>  life phases
```

One hierarchy. Scene ranges have exactly one source of truth (`beat.sceneStart/sceneEnd`); everything above is a grouping annotation. A phase never invents a scene range — it derives one from its chapters.

### 3.4 Dormant by default

`LifeJourney` is **optional** on the blueprint. When absent, the story has one implicit phase covering all scenes, no time jumps, and every system behaves **byte-identically to today**. This is the primary generalization safeguard and it is structural, not a matter of prompt wording.

Gating:
- `storyScale() === 'micro'` (<8 scenes) → life journey **disabled**, always.
- `'short'` (8–23) → disabled unless explicitly requested.
- `'standard'` / `'long'` (24+) → available; the director decides whether the topic wants it.

---

## 4. New data structures

All additive. No existing field changes type or meaning.

```ts
// ---- types.ts additions -------------------------------------------------

/** How a story is shaped in TIME. Orthogonal to StoryMode. */
export type StoryScope = 'Auto' | 'Single Episode' | 'Life Journey';

/** A declared jump in story time between two consecutive scenes. */
export interface TimeJump {
  /** The jump happens between this scene and the next. */
  afterScene: number;
  /** Dynamic, named for this story. Not an enum — 'that evening',
   *  'the next monsoon', 'four winters later'. */
  span: string;
  /** Coarse magnitude, used by code to decide what state may change. */
  magnitude: 'within-day' | 'overnight' | 'days' | 'weeks' | 'months' | 'seasons' | 'years';
  /** How the jump is SHOWN. A jump the audience cannot see is a continuity
   *  break wearing a label. */
  screenTreatment: string;
  /** One line per thing the audience must understand has changed. */
  whatChanged: string[];
}

/** What is true of one character for the span of one life phase. */
export interface CharacterLifeState {
  characterId: string;
  /** Overrides CharacterSocial.lifeStage for this phase. Must never move
   *  backwards across phases. */
  lifeStage: string;
  /** Only where the story establishes them. Omit rather than invent. */
  occupation?: string;
  education?: string;
  skills?: string[];
  responsibilities?: string[];
  /** Feeds the appearance variant. Describes SCALE and BEARING only —
   *  never identity. */
  physicalMaturity?: string;
}

/** What is true of a household for the span of one life phase. */
export interface HouseholdLifeState {
  householdId: string;
  /** How this household earns. Invented per story. */
  livelihood?: string;
  /** Qualitative and story-relevant only. Never a number, never a currency. */
  circumstances?: string;
  dwellingPlaceId?: string;
  /** Things the household owns that matter to the story. Survive time jumps. */
  possessions?: string[];
  /** What presses on them in this phase. The engine of ordinary drama. */
  pressures?: string[];
}

/** One span of the story across which life state is constant. */
export interface LifePhase {
  phaseNumber: number;
  /** Named for THIS story, never a generic label. */
  title: string;
  /** Derived from the chapters it groups. Never authored independently. */
  chapterNumbers: number[];
  sceneStart: number;
  sceneEnd: number;
  /** The jump that OPENS this phase. Absent on phase 1. */
  entryJump?: TimeJump;
  characterStates: CharacterLifeState[];
  householdStates: HouseholdLifeState[];
  /** Place ids genuinely in use this phase. A place may enter and leave. */
  activePlaceIds: string[];
  /** Conditions of the wider world this phase, if the story uses any. */
  worldConditions?: string[];
}

/** A long-horizon goal. Deliberately NOT a `want` — it is not filmable,
 *  and forcing it into `want` would break the existing filmable test. */
export interface Aspiration {
  characterId: string;
  goal: string;
  whyItMatters: string;
  /** What pursuing it costs the people around them. */
  costToOthers: string;
  obstacles: string[];
  /** Phase where it resolves. Resolution MAY be refusal or redirection —
   *  not every aspiration is achieved, and that is often the better story. */
  resolvesAtPhase: number;
  outcome: 'achieved' | 'redirected' | 'relinquished' | 'denied';
}

/** A concrete, visible step on the way. The anti-instant-success structure. */
export interface Milestone {
  phaseNumber: number;
  atScene: number;
  /** Dynamic: 'first sale', 'taught to read', 'the loan repaid'. */
  kind: string;
  description: string;
  /** Scenes that ALREADY SHOWED the work making this credible.
   *  A milestone with no proving scenes is an unearned achievement. */
  provingSceneNumbers: number[];
  /** What it costs. A milestone that costs nothing plays flat. */
  cost: string;
}

/** A repeated activity of ordinary life, recorded so it can be VARIED. */
export interface Routine {
  id: string;
  activity: string;
  characterIds: string[];
  placeId: string;
  householdId?: string;
  phaseNumbers: number[];
  /** REQUIRED. How it differs each time it is shown. A routine with no
   *  variation is the definition of filler. */
  variationAcrossStory: string;
}

/** The whole layer. Optional — absent means an ordinary single-episode story. */
export interface LifeJourney {
  /** Why this topic wants a life journey. Guards against reflexive use. */
  whyThisShape: string;
  phases: LifePhase[];
  timeJumps: TimeJump[];
  aspirations: Aspiration[];
  milestones: Milestone[];
  routines: Routine[];
  /** The film's argument in structural terms: opening life vs closing life. */
  openingLife: string;
  closingLife: string;
}

/** Per-phase appearance. Identity anchors are COPIED, never re-invented. */
export interface CharacterAppearanceVariant {
  characterId: string;
  phaseNumber: number;
  /** May change: scale, build, posture, bearing, grooming, wear. */
  ageAppearance: string;
  /** May change: clothing, shoes, accessories. */
  wardrobe: string;
  /** MUST be copied verbatim from the Character Bible: veggieType,
   *  faceDesign, eyeStyleAndColor, veggieFeatures, mainColors. */
  identityAnchors: string;
  /** Full prompt for this phase, assembled from the two above. */
  lockedVisualDescriptionForPhase: string;
}

/** Where a scene sits in STORY time, as opposed to screen time. */
export interface StoryTimeMarker {
  phaseNumber: number;
  /** Monotonic day counter within the phase. Overnight increments it.
   *  This is what makes the time-of-day check correct. */
  dayIndex: number;
  /** Optional story-facing label: 'the morning after the results'. */
  label?: string;
}
```

Additions to existing interfaces (all optional):

```ts
interface NarrativeBlueprint { /* ... */ lifeJourney?: LifeJourney; }
interface ScenePlannerItem  { /* ... */ storyTime?: StoryTimeMarker;
                                        timeJumpBefore?: TimeJump; }
interface VeggieStory       { /* ... */ lifeJourney?: LifeJourney;
                                        appearanceVariants?: CharacterAppearanceVariant[];
                                        storyScope?: StoryScope;
                                        lifeJourneyReport?: LifeJourneyReport; }
interface BlueprintSlice    { /* ... */ activePhase: LifePhase | null;
                                        previousPhase: LifePhase | null;
                                        entryJump: TimeJump | null;
                                        activeRoutines: Routine[];
                                        milestonesInRange: Milestone[]; }
interface StoryMemory       { /* ... */ phasesCompleted: string[];
                                        milestonesReached: string[];
                                        currentLifeState: string[]; }
```

---

## 5. Integration with NarrativeBlueprint

**Schema.** Add `lifeJourney` to `BLUEPRINT_SCHEMA` as an **optional** object, following the exact pattern `socialGraph` and `worldRegistry` already use: a nested `Type.OBJECT` with heavy per-field `description` text carrying the doctrine. Not in the `required` array — its absence is the normal case.

**Prompt.** New section `2c. THE SHAPE OF TIME` in `buildBlueprintSystemInstruction()`, emitted **only** when scope resolves to life-journey. It must:

1. State the decision first: does this topic want a journey, and why? (`whyThisShape`)
2. Plan `openingLife` and `closingLife` **before** phases, so phases are derived from the distance between them rather than invented as a sequence of vignettes.
3. Plan phases as runs of chapters.
4. For each boundary, plan the `TimeJump` including `screenTreatment`.
5. Plan aspirations, then milestones that earn them, then routines that fill the everyday.

**Ordering constraint.** Life journey planning happens *after* cast and world in the prompt and *before* beats — beats must be written knowing which phase they sit in, otherwise a beat's `causeFromPrevious` can reach across a three-year gap without acknowledging it.

**Validation at normalisation** (`buildLifeJourney()`, mirroring `buildSocialGraph()` / `buildWorldRegistry()`):
- Phase scene ranges derived from chapters, never trusted from the model.
- Phases contiguous, covering `1..N` exactly once.
- `timeJumps[].afterScene` must equal `phase.sceneStart - 1` for some phase.
- Life stages monotonic per character across phases.
- Any `Milestone.provingSceneNumbers` referencing a scene after `atScene` → dropped (a milestone cannot be earned by the future).
- Empty / malformed → `undefined`, and the story silently runs as single-episode.

---

## 6. Integration with Character Bible

**The invariant to protect:** `lockedVisualDescription` restated verbatim in every prompt is the only thing holding identity stable across independent Flow generations. Nothing in this plan may weaken it.

**Design:** identity is immutable; **appearance is a per-phase variant assembled from it.**

```
CharacterBibleEntry            (immutable, one per character — UNCHANGED)
  ├── veggieType, faceDesign, eyeStyleAndColor, veggieFeatures, mainColors
  │      ^-- IDENTITY ANCHORS. Copied into every variant. Never regenerated.
  └── bodyShape, clothing, shoes, accessories
         ^-- MAY be varied per phase

CharacterAppearanceVariant     (one per character per phase — NEW)
  identityAnchors  = verbatim copy of the anchors above
  ageAppearance    = scale / build / posture / bearing / wear
  wardrobe         = clothing / shoes / accessories for this phase
  lockedVisualDescriptionForPhase = anchors + ageAppearance + wardrobe
```

**The mechanical drift guard.** `identityAnchors` is *assembled by code*, not by the model — the model supplies only `ageAppearance` and `wardrobe`. The anchors are string-copied from the bible. This makes identity drift across phases **structurally impossible** rather than prompt-discouraged, which is the same reasoning that made `enforceReciprocity()` and namespaced ids work.

A report-only check additionally scans `ageAppearance` and `wardrobe` for anchor-contradicting terms (a different colour family, a different vegetable) and flags them.

**Phase 1B change.** When a life journey exists, the Character Bible phase additionally emits one variant set per phase. Cost: one extra structured field, no extra API call.

**Production consequence (important for the user's actual workflow).** Each phase needs its **own character reference sheet** so the operator can generate a per-phase reference image in Flow. `CharacterReferencePackage` gains an optional `phaseNumber`, and the references tab groups by phase. Without this the operator has a child's reference sheet and adult scenes.

**Single-phase stories are untouched** — no variants generated, existing behaviour byte-identical.

---

## 7. Integration with Social Graph + Household

**Bonds stay immutable, and stay bonds.** A parent does not stop being a parent after a time jump. `plannedChanges` already forbids changing a relationship *type*; that rule is reinforced, not relaxed.

**What is allowed to change across a jump:**
- `authority` — a child who becomes an earner may move `defers-to` → `peer`. This is a **structural** change of responsibility, not a personality change, and it is exactly what the `authority` field was designed to record. It requires a `TimeJump` and a planned entry.
- `responsibilities` — per phase, via `CharacterLifeState`.
- `lifeStage` — per phase, via `CharacterLifeState`.
- Household **membership** — marriage, a child leaving, a grandparent arriving. Recorded as a planned household change at a jump, never silently.

**`characterSocial.lifeStage` keeps its current meaning** — the life stage at the **opening** of the film. `LifePhase.characterStates[].lifeStage` overrides it from phase 2 onward. A single-phase story therefore behaves identically to today. No field is repurposed and there is no second source of truth: phase 1's life state **is** `characterSocial`, and code reads it through one accessor.

**Household economics land in `HouseholdLifeState`, not in `Household`.** `Household` stays what it is — a group of people. Livelihood, possessions and pressures are life STATE because they legitimately change; putting them on `Household` would make them facts and freeze them. This keeps the facts/state boundary clean.

**New prompt block** `buildLifeStateBlock()` in `social-graph.ts` or the new module, injected per batch alongside `buildSocialFactsBlock()`, describing the **current phase's** life state as present-tense fact.

---

## 8. Integration with World Registry

**Places stay registered once and keep stable identity.** `fixedFeatures` still must not change — a place drifting between scenes remains an error.

**Two additive concepts:**

1. **Phase availability.** `LifePhase.activePlaceIds` lists the places genuinely in use this phase. Effects: the per-batch world block leads with active places (so a 60-scene film does not carry twenty irrelevant locations in every prompt); and a place used outside its active phases is an `info`-level finding, not an error — a character may revisit an old school.

2. **Place evolution at a jump only.** A new optional `Place.evolutions?: Array<{ atPhase: number; change: string }>`. A courtyard that gains a brick wall in phase 3 records it here. `fact-validator.ts` place-identity-drift then compares against *the description as of that phase* rather than first-seen. Without this, any world change reads as drift.

**Entities** gain `activeInPhases?: number[]`. A cow sold in phase 2 is `[1, 2]`. `checkEntityUsage()` then correctly distinguishes "registered and never appeared" (a broken promise) from "appeared in its phases and then legitimately left the story."

---

## 9. LifeState architecture (consolidated)

**Definition.** Life state is what is true of a character or household for the span of one phase.

**Invariants:**
1. Constant within a phase. Reading life state mid-phase is reading a fact.
2. Changes only at a declared `TimeJump`, and only by a change planned at blueprint time.
3. Monotonic where reality is monotonic — life stage and age never move backwards.
4. Never contradicts identity. Life state says what someone *does*; the Bible says what they *are*.
5. Derived, never stored twice. Phase 1 life state **is** `characterSocial` + `household`; later phases are overrides. One accessor:

```ts
function lifeStateAt(story, characterId, phaseNumber): CharacterLifeState
// phase 1  -> projected from socialGraph.characterSocial
// phase N  -> the phase's entry, falling back to the nearest earlier phase
```

This accessor is the **only** way any code reads life state, which is what prevents the overlapping-truth failure.

**Flow through the pipeline:**
```
blueprint
  -> LifeJourney.phases[].characterStates / householdStates   (planned)
  -> sliceBlueprintForRange() picks the ACTIVE phase for this batch
  -> buildLifeStateBlock() states it as present-tense fact in the batch prompt
  -> scenes carry storyTime.phaseNumber
  -> buildStoryMemory() reports current life state + phases completed
  -> validators check monotonicity and jump-accounting across boundaries
```

---

## 10. Time progression / time-jump architecture

### 10.1 Three kinds of time, never confused

| | What it is | Where | Who owns it |
|---|---|---|---|
| **Screen time** | `0:00–0:10` | `scene.timeRange` | Derived from scene number. **Unchanged.** |
| **Story time** | Which phase, which day | `scene.storyTime` | New. |
| **Frame time** | Time of day at the final frame | `continuityState.timeOfDay` | Existing. Meaning unchanged. |

G2 exists purely because frame time is currently being asked to do story time's job.

### 10.2 `dayIndex` — the whole fix, in one integer

`StoryTimeMarker.dayIndex` is a monotonic day counter. Same day → same index. Overnight → +1. A jump of years → a new phase and a large increment.

The time-backwards check becomes:

```ts
// BEFORE: flags every overnight transition in the film
if (prevRank >= 0 && currRank >= 0 && currRank < prevRank) -> warning

// AFTER: flags only genuine time travel
const sameDay = prev.storyTime?.phaseNumber === curr.storyTime?.phaseNumber
             && prev.storyTime?.dayIndex    === curr.storyTime?.dayIndex;
if (sameDay && prevRank >= 0 && currRank >= 0 && currRank < prevRank) -> warning
// different day or different phase: time legitimately reset. Not an error.
```

Where `storyTime` is absent (single-episode stories, and every story generated before this change) the pipeline defaults every scene to `{ phaseNumber: 1, dayIndex: 0 }`, so `sameDay` is always true and **behaviour is exactly today's**. The fix is opt-in by construction.

### 10.3 Rules at a declared jump

1. **Always a CUT.** `enforceChainPlausibility()` extends to demote any CHAIN across a `TimeJump`. An unbroken take cannot span a year.
2. **The ledger clears selectively.** New `foldJumpIntoLedger()`:
   - **cleared:** held props, character positions, poses, emotions, open/closed objects, camera state
   - **preserved:** registered places and their fixed features; world entities; `HouseholdLifeState.possessions`; social state; open setups
   This is what stops the "Held object disappears" warning storm, and it is *correct* — after a year nobody is still holding the bucket, but the family still owns the cow.
3. **The jump must be SHOWN.** `screenTreatment` is required. Options offered as vocabulary, never as a menu: a seasonal image, a match-cut on an object that has aged, a montage across the boundary, a returning routine visibly changed, a physical growth reveal. A jump the audience cannot see is a continuity break with a label on it.
4. **Presence checks skip the boundary.** `prevChars`/`currChars` comparison is suppressed across a jump — a character legitimately absent after three years is not "leaving without an exit."
5. **The opening frame is stated absolutely.** The Flow prompt after a jump gets no `Opening frame:` prefix from the previous end state (`makeSelfContained` already prefixes from `prevScene.endState` — that must be suppressed across a jump, or the new phase opens wearing the old phase's final frame).

> `prompt-continuity.ts:makeSelfContained()` is a concrete, easily-missed regression: it prepends the previous scene's end state whenever the opening does not already restate it. Across a three-year jump that is exactly wrong. Must be gated on `timeJumpBefore`.

### 10.4 How many jumps

Budgeted by scale, as a ceiling and never a quota:

| Scenes | Max phases | Rationale |
|---|---|---|
| <8 | 1 | No journey. |
| 8–23 | 1–2 | One jump at most, and only if the topic demands it. |
| 24–47 | 2–3 | Enough for before / after / consequence. |
| 48–60 | 3–5 | A genuine life shape. |

More than five phases across 60 scenes means ~12 scenes each, which is too little to establish a life before jumping again. This becomes a normalisation check, not just prompt advice.

---

## 11. Character growth without identity drift

Four distinct things are often conflated. Keeping them apart is what makes growth safe:

| | Changes | Mechanism | Guard |
|---|---|---|---|
| **Identity** | Never | `CharacterBibleEntry` anchors | Copied verbatim into every variant by code |
| **Appearance** | At jumps | `CharacterAppearanceVariant` | Model supplies only age + wardrobe; anchors machine-copied |
| **Capability** | At jumps | `CharacterLifeState.skills / education / occupation` | Monotonic unless the story shows loss on screen |
| **Character** | Continuously | existing `arcStart/Midpoint/End`, `want`, `need`, `flaw` | Unchanged |

**The flaw across phases.** A flaw is not cured by a time jump. If a flaw changes across a jump, the *phase before* must have shown the experience that changed it. This becomes a report-only finding: a life stage or flaw that changes with no proving scenes is an unearned change — the same principle as the milestone rule, applied to interiority.

**Voice.** `voiceSignature` is a mechanical rule and it **persists** across phases. A character who never finishes a sentence at eight still does at thirty — that is precisely what makes a time jump land emotionally. What may change is *register*: vocabulary and formality, never the mechanical rule. Worth stating explicitly in the prompt, because "they grew up" is a strong pull toward rewriting the voice.

---

## 12. Livelihood and everyday-routine system

**Livelihood** lives in `HouseholdLifeState.livelihood`. Explicitly **not** on `Household` — it changes, so it is state.

**Generalization is the whole design problem here.** The prompt must never seed an occupation. Following the `BEAT_SPINE` precedent exactly — offered as vocabulary the director may ignore:

> *Households earn in many ways: cultivating, keeping animals, making things by hand, repairing, selling from a shop or a cart, carrying and transporting, cooking, teaching, caring for others, performing, clerical or office work, seasonal or daily-wage work, running a small business, or a combination. Some households in a story are not defined by their work at all. Choose from what THIS topic needs; never default to farming, never default to poverty, and never default to a family at all.*

**Routines** get recorded as data (`Routine`) specifically so they can be **varied**. The required `variationAcrossStory` field is the anti-repetition mechanism: a routine cannot be registered without saying how it differs each time it appears.

**The three-appearance rule:** the first time a routine is shown it *establishes*; the second time it must *differ*; the third time it must *break*, or carry a different emotional charge. A routine shown identically three times is filler by definition. Enforced as a report-only metric (§21), not a hard block.

**Responsibilities** are already in `CharacterSocial.responsibilities` and the doctrine already calls them *"a rich source of ordinary conflict and affection."* Life journey makes them per-phase — a child's responsibilities growing over the film is one of the clearest, cheapest ways to show growth without a single line of dialogue about it.

---

## 13. Goals, struggles, milestones and achievement planning

**`want` vs `Aspiration` — the distinction must be held firmly.**

`want` is deliberately *filmable and immediate*, and `story-craft.ts` applies a hard filmable test to it. A life goal fails that test **by design**. So:

- `Aspiration` = the long-horizon goal. Not filmable. One per journey character, rarely more.
- `want` = what that character is chasing **in this phase**, filmable as ever, and it should *differ per phase*. The aspiration is the through-line; the wants are how it is dramatised.

This is the key insight that keeps the existing filmable test intact rather than weakening it.

**Milestones — the anti-instant-success structure.** `Milestone.provingSceneNumbers` must reference scenes that already showed the work. Normalisation drops forward references. A report-only rule:

> A milestone with fewer than two proving scenes, or whose proving scenes all sit in the same phase as the milestone itself, is flagged as **unearned**.

This is the structural answer to the user's "instant success / unexplained achievements" requirement — a rule prompt text alone has never reliably delivered.

**Struggle must have consequence.** Every phase carries `HouseholdLifeState.pressures`. A setback that changes nothing is not a setback. Report-only: a phase with pressures that produces no milestone, no relationship delta and no life-state change is flagged as a phase where nothing happened.

**The ending is not required to be success.** `Aspiration.outcome` has four values and `redirected` / `relinquished` are first-class. The existing doctrine already says *"decide whether this story is stronger granting the want or denying it"* — this extends that to the journey scale, and is an important generalization guard against every story becoming a success story.

---

## 14. Relationship evolution

Unchanged mechanism — `plannedChanges` → scene `socialChanges` → `foldSocialDeltas()`.

Two extensions:

1. **`PlannedSocialChange` may be pinned to a phase as well as a beat.** Some shifts happen *across* a jump rather than in a scene: an estrangement that simply exists after four years. New optional `atPhase`, used when the change is a consequence of elapsed time rather than a dramatised moment.

2. **Social state survives jumps.** Already true (`foldSocialDeltas` is not scene-window bounded) and must stay true. The batch prompt after a jump must state where relationships stand *as inherited*, so the new phase does not reset them. This is the single most likely emotional failure across a time jump — characters resuming as if the previous phase's friction never happened.

`reconcilePlannedChanges()` extends to report per-phase, so an unfulfilled turning point is attributed to the phase that should have carried it.

---

## 15. World / location evolution

Three kinds of change, distinguished so drift detection keeps working:

1. **A place evolves** — `Place.evolutions[]`, at phase boundaries only. Fact validator compares against the description *as of the current phase*.
2. **A place enters or leaves** — `LifePhase.activePlaceIds`. Not an error either way.
3. **A new place appears** — registered at blueprint time with `firstActivePhase`, so a workplace that exists only from phase 3 is not treated as an unregistered id in phase 1 (and, more usefully, is not described in phase-1 prompts where it has no business existing).

**World conditions** — `LifePhase.worldConditions` for things outside any household (a season, a drought, a road being built, a market closing). Optional, and most stories will leave it empty.

---

## 16. Chapter / beat integration

- **Beats keep tiling scenes.** Unchanged. Single source of truth for scene ranges.
- **Chapters keep grouping beats.** Unchanged.
- **Phases group chapters.** Derived, never independently authored.

**A beat must not straddle a phase boundary.** Since phases align to chapters and beats already sit inside chapters, this holds automatically — but it is asserted at normalisation because a model may still emit a beat spanning the boundary.

**`causeFromPrevious` across a jump.** The first beat of a phase has a special obligation: its cause is not the immediately preceding scene but the *accumulated consequence* of the previous phase. The prompt must say this explicitly, otherwise the first beat after a jump reads as a non-sequitur — the most common way generated time jumps feel arbitrary.

**Chapter count.** Already 12 at 60 scenes. With 3–5 phases that is 2–4 chapters per phase, which is a workable granularity. No change to `numChapters`.

---

## 17. Scene-generation integration

**Scene schema additions** (`server.ts` `SCENE_SCHEMA`):
- `storyTime: { phaseNumber, dayIndex, label? }` — required when a journey exists.
- `timeJumpBefore` — set by code from the blueprint, not authored per scene. The model is told about the jump; it does not get to invent one.

> Design decision: **the model never declares a time jump.** Jumps are planned at blueprint time and injected. A model free to jump at will is exactly the "random time jumps" failure the user listed. Scenes execute the plan.

**Batch prompt additions** (injected by `buildBlueprintPromptBlock()`):
- `CURRENT LIFE PHASE` — phase title, span, life state for every present character, household state.
- `TIME JUMP AT THE START OF THIS BATCH` — only when the batch opens a phase: what changed, how long passed, how it is shown, and an instruction that scene `sceneStart` must **establish the new normal before advancing the plot**.
- `ROUTINES ACTIVE THIS PHASE` with their variation requirement.
- `MILESTONES DUE IN THIS RANGE` with their proving scenes already listed, so the batch knows what has been earned.

**Batch boundary alignment.** Batches are currently fixed 12-scene partitions (`partitionSceneRanges`). Where a phase boundary falls mid-batch, a single batch would contain both a child and an adult with different life states — confusing to write and likely to blur. **Proposal: prefer splitting batches at phase boundaries** when a journey exists, accepting smaller batches. `MAX_SCENES_PER_BATCH` stays a ceiling. This costs extra API calls and must be weighed against the timeout budget (§27).

**Story memory additions:** phases completed, milestones reached, current life state. All derived, consistent with the existing no-stored-state design.

---

## 18. Continuity implications

Summary of every continuity behaviour that changes, all gated on a declared jump:

| Check | Today | With a jump |
|---|---|---|
| Time of day backwards | warning on every overnight | only within the same phase **and** same `dayIndex` |
| CHAIN across the join | allowed if same place | **always demoted to CUT** |
| Held props | carried forward forever | cleared; registered possessions preserved |
| Character positions / emotions | carried forward | cleared |
| Character leaves without exit | warning | suppressed across the boundary |
| `makeSelfContained` opening prefix | prepends previous end state | **suppressed** across the boundary |
| Open/closed objects | compared | reset |
| Camera continuity | compared | reset |
| Place identity drift | first-seen is the reference | reference is the description **as of this phase** |

**What does not change:** everything *within* a phase behaves exactly as today. The Continuity Director's per-scene physics work is untouched, which is deliberate — it is the most battle-tested part of the system and it is already correct.

**New optional finding** (`info`): a time jump whose `screenTreatment` is not reflected in the scene at the boundary — i.e. the jump was declared but not shown.

---

## 19. Fact-validator implications

`fact-validator.ts` stays **report-only** and stays **non-overlapping with physics**.

**Changed rule — the G3 blocker.**

```
BEFORE: "A character has one life stage for the whole film."
AFTER:  "A character has one life stage per phase.
         Across phases it may advance, never regress,
         and every advance must be accounted for by a TimeJump."
```

This is a *replacement*, not a removal. The check gets **stronger**, not weaker — it now catches un-jumped ageing and backwards ageing, neither of which is detectable today.

**New checks:**
- Life stage regression across phases → `warning`
- Life state change with no intervening `TimeJump` → `warning`
- Household membership change with no jump and no on-screen event → `warning`
- Occupation change with no proving scenes → `info` (unearned)
- Appearance variant contradicting an identity anchor → `warning`
- Milestone with insufficient proving scenes → `info`
- Aspiration never resolved → `info`
- Phase whose `pressures` produce no change → `info`

**Preserved:** reciprocity, household membership within a phase, place registration, entity usage, theme-spoken-aloud. All unchanged.

---

## 20. Setup / payoff integration

The existing setup system is **already the right shape for a life journey** and mostly needs range extension, not redesign.

- `sliceBlueprintForRange()` already keeps planted-but-unpaid setups visible to every later batch — a setup planted in scene 4 and paid off in scene 55 already works.
- `buildStoryQualityReport()` payoff detection uses a ±1 scene window. **This was already the cause of a false HIGH finding** on the 60-scene stress test (a setup paid at scene 57 reported unpaid because the window was 59/60/61). For a life journey, where a payoff may land anywhere in the final phase, the window should widen to the **phase** containing `payoffScene`. This is a fix worth doing regardless of this feature.
- **New:** setups that span a time jump are the strongest device the format has — an object that ages, a promise made to a child and kept to an adult. The doctrine should name this explicitly as a *possibility*, and `StorySetup` gains optional `plantPhase` / `payoffPhase` so a cross-phase setup is identifiable and its payoff window computed correctly.
- **Milestones are not setups** and must not be merged into them. A setup is a planted *meaning*; a milestone is an earned *step*. Separate structures, no overlap.

---

## 21. Anti-repetition / anti-filler rules

The user named six specific failure modes. Each gets a **structural** answer, not a prompt sentence — because prompt sentences for these already exist and the flat story happened anyway.

| Failure | Structural answer |
|---|---|
| One tiny event across 60 scenes | `openingLife` vs `closingLife` planned before phases; a journey whose two ends are similar is flagged at normalisation |
| 60 scenes in one courtyard | Report-only place-concentration metric: scenes per `placeId`; flag when one place exceeds ~40% of scenes without a justifying phase |
| Repetitive chores | `Routine.variationAcrossStory` required; three-appearance rule; report-only repeated-routine counter |
| Repetitive dialogue | Already exists (`repeatedDialogueLines`, `recentDialogue` in memory). Extend: compare across phases too, where repetition is most likely |
| Instant success | `Milestone.provingSceneNumbers`, forward references dropped at normalisation |
| Unexplained achievements | Same, plus occupation/skill change with no proving scenes flagged |
| Random time jumps | Jumps are blueprint-planned only; the model cannot declare one |
| Stated morals | Already covered by `checkStatedMoral()` and the doctrine's absolute rule. Unchanged |

**New quality metrics** in `buildStoryQualityReport()`:
```ts
phaseCount, scenesPerPhase[]
placeConcentration: Array<{ placeId, scenes, sharePercent }>
routineRepetition:  Array<{ routineId, appearances, variationsDeclared }>
unearnedMilestones: number[]
lifeStateChangesWithoutJump: number[]
openingVsClosingDistance: string
```

---

## 22. 10-minute / 60-scene planning strategy

A worked shape — **illustrative only, never a template**:

```
Phase 1  (chapters 1-3,  scenes 1-15)   establish the life: who, where, how they
                                        earn, what the days look like, what is
                                        wanted and what presses
  -> TimeJump
Phase 2  (chapters 4-7,  scenes 16-33)  pursuit and cost: the want is acted on,
                                        it costs the household something, the
                                        first real setback
  -> TimeJump
Phase 3  (chapters 8-10, scenes 34-48)  consequence: what the setback made
                                        necessary; the hardest sacrifice; a
                                        relationship genuinely changes
  -> TimeJump
Phase 4  (chapters 11-12, scenes 49-60) the changed life: the achievement (or
                                        its refusal) SHOWN, and the opening
                                        image answered
```

**Planning rules for this scale:**
- Every phase must contain at least one milestone **or** one relationship turning point. A phase that only depicts life is a phase that does not belong.
- The final phase must *answer the opening image*, not merely arrive at a good outcome.
- Each phase re-establishes the new normal in its **first two scenes**, then advances. A jump straight into plot leaves the audience unanchored.
- Routines should appear across phases, visibly changed. The same daily walk in phase 1 and phase 4 is one of the cheapest and strongest ways to make time visible.
- **A 10-minute story does not require four phases.** A single-phase 60-scene story is entirely valid — a siege, a day-long festival, a single journey. The scale gate permits a journey; it never requires one.

---

## 23. Generalization safeguards

The overfitting risk here is severe and the user named it explicitly. Six layers of defence, ordered from strongest (structural) to weakest (wording):

1. **Optional by construction.** `lifeJourney` absent → every system byte-identical to today. Most stories will not have one.
2. **Scale gate.** Disabled below 24 scenes. No 6-scene story can become a life journey.
3. **Scope is orthogonal to StoryMode.** A `Life Journey` mystery, a `Life Journey` comedy and a `Single Episode` heartwarming story are all reachable. Life journey is **not** a new `StoryMode` and does not compete with the existing eleven.
4. **`whyThisShape` is required.** The director must justify the shape against *this topic* before planning phases. A required justification is a real filter on reflexive use.
5. **Vocabulary, never menus.** Livelihoods, settings and jump spans are offered the way `BEAT_SPINE` is offered — *"craft vocabulary you may merge, reorder, or omit."* The `EVERYDAY_LIFE` doctrine in `story-craft.ts` already does this well and its phrasing is the model to copy.
6. **An explicit anti-default block**, naming the failure modes:

> *These are POSSIBILITIES, never defaults. Do NOT default to: a poor family; a village; a farming household; a child who becomes an officer; a husband and wife; an education-to-success arc; a story that ends in achievement. A life journey may follow a shopkeeper, a craftsperson, a teacher, a driver, two friends across decades, siblings, a grandparent, a worker, a small business, a community. It may be urban. It may contain no children and no marriage. The achievement may be refused, redirected or relinquished, and the changed life may be quieter rather than higher. If your first instinct matches the list above, discard it and design from THIS topic.*

**Residual risk, stated honestly:** the model has strong priors toward rural-poverty-to-success narratives in South Asian languages. These safeguards reduce but will not eliminate it. Validation case B and D (§24) exist specifically to measure it, and if they fail the answer is stronger structural gating, not stronger wording.

---

## 24. Validation / test strategy

### 24.1 TEST CASE A — the reference example

> **TEST CASE ONLY. This is a validation scenario, never production prompt content, never a template, and never referenced in any prompt text shipped to the model.**

Topic: a family — Gobhi (wife), Aloo (husband), their son. The household keeps cows and earns by selling milk. The son studies while helping the family, meets difficulty, grows, and eventually becomes an officer.

**What it proves:** multi-phase planning, ageing with identity lock, household livelihood, aspiration vs per-phase want, earned achievement, relationship evolution across jumps, a changed final life state.

**What it must NOT prove:** that the engine can reproduce this plot. If any later unrelated generation drifts toward this shape, the safeguards have failed.

### 24.2 Deliberately different cases — generality, not fit

| # | Case | Proves |
|---|---|---|
| **B** | Two adult siblings run a failing tailoring shop in a city. No children, no education arc. They decide together to close it and do something else. | Urban; no children; achievement = an accepted ending, not success |
| **C** | Two friends across three decades. No livelihood change, no household economics. What changes is only the friendship. | Phases **without** economics; growth that is purely relational |
| **D** | An ageing potter and an apprentice. The **potter** is the protagonist. The arc ends in handing the workshop over. | Growth that is *downward* / a letting-go; mentor as lead; craft livelihood |
| **E** | A grandmother returning to a town she left, across two phases (then / now) only. | Minimum viable journey; a non-linear emotional structure |
| **F** *(control)* | A 12-scene story with no time jumps at all. | The layer stays **dormant**; output must be indistinguishable from today's |
| **G** *(control)* | A 6-scene micro story. | Scale gate holds; life journey never offered |
| **H** *(control)* | A 30-scene **Mystery** mode story. | Scope is orthogonal to StoryMode; a journey does not flatten a mystery's revelation spine |
| **I** | A 48-scene story about a single festival day, `Single Episode` scope. | Long-form **without** phases still works; length does not force a journey |

### 24.3 Measurement — automated, not impressionistic

Run before/after on each case and diff the report:
- **Cases F, G, I:** output must be structurally identical to a pre-change run. Any difference is a regression.
- **Cases A–E:** `phaseCount` > 1; zero `lifeStateChangesWithoutJump`; zero `unearnedMilestones`; `placeConcentration` max < 40%; `openingVsClosingDistance` non-trivial.
- **Case H:** mystery escalation preserved; `phaseCount` may legitimately be 1.
- **Anti-overfit sweep:** run B, C, D and check no output contains cows, milk, farming, officers or "poor family" unless the topic asked for it.

### 24.4 Token / latency budget

A life-journey blueprint is substantially larger. Current measured baseline (real run, `test-output/` telemetry): blueprint = 10,103 prompt + 17,136 completion tokens in **87s**. A life-journey blueprint plausibly doubles completion. With `TEXT_TIMEOUT_MS` now at 420s there is headroom, but this must be **measured** in Phase 1 before proceeding, not assumed.

---

## 25. Exact files likely affected

**New:**
| File | Contents |
|---|---|
| `src/server/story/life-journey.ts` | Schema fragment, `buildLifeJourney()` normalisation, `lifeStateAt()` accessor, `buildLifePhaseBlock()`, `buildTimeJumpBlock()`, phase-boundary helpers, life-journey validators |
| `src/server/story/life-journey.test-cases.md` | The §24 cases, kept out of `src/` prompt paths entirely |

**Modified:**
| File | Change | Risk |
|---|---|---|
| `src/types.ts` | ~9 new interfaces; optional fields on 5 existing | Low — purely additive |
| `src/server/story/blueprint.ts` | `lifeJourney` in schema; doctrine section; `sliceBlueprintForRange()` phase fields; `buildStoryMemory()` additions; quality metrics; setup payoff window widened to phase | **Medium-high** — largest surface |
| `src/server/story/story-craft.ts` | Life-journey doctrine, scale-gated; anti-default block | Medium |
| `src/server/story/continuity-director.ts` | `dayIndex`-aware time check; `foldJumpIntoLedger()`; jump-aware presence and CHAIN rules | **High** — most battle-tested file |
| `src/server/story/fact-validator.ts` | Per-phase life stage; monotonicity; unearned-change checks | Medium |
| `src/server/story/world-registry.ts` | `evolutions`, `activeInPhases`, `firstActivePhase`; phase-aware drift reference | Medium |
| `src/server/story/social-graph.ts` | `atPhase` on planned changes; life-state block; phase-aware reconcile | Medium |
| `src/server/story/prompt-continuity.ts` | Suppress opening-frame prefix across a jump | **High** — silent wrong-output risk |
| `server.ts` | Scene schema fields; scope plumbing; phase-aligned batching; appearance variants in Phase 1B; persistence; per-phase reference packages | **High** — 2,162 lines, many touch points |
| `src/server/dev/story-report.ts` | Life journey section: phases, jumps, milestones, life state per phase | Low |
| `src/components/ScenePlannerSection.tsx` | Phase badges, jump markers between scenes | Low |
| `src/components/CharacterBibleSection.tsx`, `CharacterReferenceStudio.tsx` | Per-phase variants and reference sheets | Medium |
| `src/App.tsx` + a control component | `StoryScope` selector (Auto / Single Episode / Life Journey) | Low |

---

## 26. Implementation phases, in safest dependency order

Each phase is independently shippable and leaves the build green. **Every phase up to P6 is inert for stories without a life journey.**

**P0 — Types and skeleton** *(no behaviour change at all)*
`types.ts` interfaces; `life-journey.ts` with normalisation and `lifeStateAt()`; unit tests against fixtures. Nothing imports it yet. Verifiable by `tsc` and tests alone, zero API cost.

**P1 — Blueprint planning** *(generates data; nothing consumes it)*
`lifeJourney` in `BLUEPRINT_SCHEMA` (optional); doctrine in `story-craft.ts`; `buildLifeJourney()` wired; persisted on the story; rendered in the dev report.
*Gate:* run test case A and control F. Measure blueprint token cost and latency. **If the blueprint does not plan coherent phases, stop here** — everything downstream depends on this being right.

**P2 — Story time markers** *(scenes carry phase/day; still nothing enforces)*
`storyTime` in the scene schema; phase injection into batch prompts; `timeJumpBefore` set by code; defaulting to `{phase:1, day:0}` everywhere else.
*Gate:* control F must be structurally identical to a pre-P2 run.

**P3 — Continuity unblocking** *(the phase that makes jumps usable)*
`dayIndex`-aware time check; `foldJumpIntoLedger()`; CHAIN demotion at jumps; presence suppression; **`makeSelfContained` gating**.
*Gate:* case A produces zero false time/prop warnings at boundaries; control F's continuity report is unchanged. Depends on P2's markers.

**P4 — Fact validator**
Per-phase life stage replacing the one-per-film rule; monotonicity; jump-accounting; unearned-change findings.
*Gate:* controls F, G, I produce identical fact reports.

**P5 — Appearance variants**
`CharacterAppearanceVariant` with machine-copied anchors; per-phase Flow prompt assembly; per-phase reference packages; anchor-contradiction check.
*Gate:* anchors byte-identical across phases; single-phase stories emit no variants.

**P6 — Achievement and anti-repetition metrics**
Milestone earning; place concentration; routine repetition; opening-vs-closing distance; report section. Report-only throughout.

**P7 — UI**
`StoryScope` control; phase badges and jump markers in the scene planner; per-phase reference grouping.

**P8 — Validation sweep**
All nine cases; anti-overfit sweep; regression diff on the three controls.

**Why this order:** P0 is free and de-risks the types. P1 must prove the model can *plan* a journey before any consumer is built — if it cannot, the rest is wasted. P2 must precede P3 because the continuity fixes read the markers. P3 before P4 because false continuity warnings would drown the fact findings. P5 is isolated and touches the Bible, so it is late. Metrics last, because they measure the finished thing. UI last because it is the cheapest to change.

---

## 27. Regression risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | Blueprint token/latency growth → truncation or timeout | **High** | Measure at P1 before proceeding. Headroom exists (420s timeout, 120k default output, 384k ceiling) but is unverified for this payload |
| R2 | Relaxing the life-stage rule masks genuine drift | **High** | Rule is *replaced* with a stricter one (monotonic + jump-accounted), never removed |
| R3 | `makeSelfContained` prefixes the old phase's end state after a jump | **High** | Explicitly gated in P3. Silent and easy to miss — deserves a dedicated test |
| R4 | Phase-aligned batching increases call count → more timeout exposure | Medium | `MAX_SCENES_PER_BATCH` stays a ceiling; measure; fall back to fixed partitions if cost is unacceptable |
| R5 | Overfitting to the test case | **High** | §23's six layers; cases B/C/D exist to measure it; anti-overfit sweep in P8 |
| R6 | Phases and chapters become competing truth | Medium | Alignment rule; phase ranges **derived** from chapters, never authored |
| R7 | Continuity Director regressions | **High** | Every change gated on a declared jump; absent a jump, code paths are identical. Control F is the guard |
| R8 | Life journey becomes the default | Medium | Optional + scale-gated + `whyThisShape` required + Auto scope stays conservative |
| R9 | Existing Story Modes degraded | Medium | Scope orthogonal to mode; case H is the guard |
| R10 | `server.ts` (2,162 lines) accumulating more responsibility | Medium | New logic lives in `life-journey.ts`; `server.ts` only wires |
| R11 | Per-phase references confuse the Flow operator | Medium | Group by phase in the UI with explicit labels; the export must state which phase a prompt belongs to |
| R12 | Existing saved stories lack `storyTime` | Low | Defaults to `{phase:1, day:0}`; all comparisons degrade to today's behaviour |
| R13 | A larger blueprint crowds out scene-batch context | Medium | Phase slice is scoped to the active phase; only the current phase's life state is injected, not all four |

---

## 28. Open questions for approval

1. **Scope control** — add the `StoryScope` selector to the UI (Auto / Single Episode / Life Journey), or leave it Auto-only and model-decided for now?
2. **Phase-aligned batching** (§17) — accept more API calls for cleaner phase boundaries, or keep fixed 12-scene partitions and rely on prompt text at a mid-batch boundary?
3. **Per-phase reference images** — this multiplies the operator's Flow work (4 phases × 5 characters = 20 reference sheets). Worth it, or restrict variants to characters who visibly age?
4. **Setup payoff window** (§20) — widen to the phase now as part of P1, or treat as a separate fix? It is an existing bug independent of this feature.
5. **`story-craft.ts:161`** (§2.1) — the missed heartwarming dialogue-register line. Fix immediately as a one-line patch, or fold into this work?

---

*Plan only. No production code modified. No story generated. No API tokens spent.*

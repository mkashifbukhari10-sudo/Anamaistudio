# AnamStudio — Full Fixing Plan

Order as agreed: **Flow-side continuity → 8s migration → dialogue interaction →
cross-scene thread → gate fixes.**

Grounded in `analysis-full-project.md` and `audit-continuous-film.md`. Every
phase is offline-testable against the six stories in `test-output/`. No API calls
anywhere in this plan — the one place a real generation is needed is marked as a
**checkpoint for you to run**, not for me.

Already shipped and not repeated here: Phase A (seam identity) and Phase B (beat
clock).

---

## Governing constraints

- Do not weaken existing story quality. The blueprint, life journey, social
  graph, world registry, contracts and distinctiveness layers are working and
  are not touched except where named.
- Nothing hardcodes this story, its characters, language, genre or duration.
- Silent, action, montage and reaction scenes keep their silence. No phase
  forces dialogue anywhere.
- Report, don't auto-repair. P5 stays off.

---

## Phase 1 — Flow-side continuity *(biggest visible win)*

### The problem

The sample video proves that the worst breakage is not in the text. Across one
clip boundary (70.0s → 70.5s): the money bag's text changed from
`5,00,0000 / پانچ لاکھ` to `5,00,00,000 / پورچ کرٹس`, Aloo's face and proportions
changed, the man handing him the bag vanished, the crowd and background changed.
At 56.5s the Urdu banner became meaningless Devanagari.

**No prompt wording prevents this.** Veo renders each clip independently. Only
two things hold identity across clips: the previous clip's last frame uploaded as
the next clip's first-frame reference, and the character reference image attached
as an Ingredient.

The code already has both. What is wrong is the instruction: `buildFrameHandoff()`
tells the operator that a CUT needs **no frame upload**, and CUT is the large
majority of joins. And the per-scene operator package has no step naming which
character references to attach.

### Changes

**1.1 — Rewrite the frame-handoff policy** (`src/server/story/prompt-continuity.ts`)

Replace the binary CHAIN-uploads / CUT-doesn't with three cases:

| join | operator step |
|---|---|
| **CHAIN** | Upload the previous clip's last frame as the first-frame reference. Mandatory — the two clips must read as one take. |
| **CUT, same place / same characters / continuous time** | Upload the previous clip's last frame as a **style-and-identity reference**. The shot is a new angle, not a new world, and this is what stops the face and palette drifting. |
| **CUT, new place or time jump** | No frame upload — a genuine break. Character reference Ingredients still attached. |

The classification uses data already on the scene: `continuityState.location`
(and `placeId`), `timeOfDay`, `charactersPresent`, and the existing
`crossesIntoNewDay()` helper in `continuity-director.ts`.

**1.2 — Per-scene Ingredient list** (`server.ts`, `ProductionPackageModal.tsx`,
`src/server/dev/story-report.ts`)

Add `scene.referenceAssets`: for every character in `charactersPresent`, the
character's reference package id and name. Render it as a new **Step 1b — Attach
character references** in the operator package, listing exactly which Ingredients
this clip needs.

Today the package goes Step 1 Frame Handoff → Step 2 Positive Prompt → Step 3
Negative Prompt, and never names the references.

**1.3 — In-world text policy** (`src/server/story/prompt-continuity.ts`)

The banner and the money bag are the clearest failures in the video, and they are
a known Veo weakness: rendered text is unstable across generations.

- Add a `worldText` field on the scene: any text that must appear in frame
  (a banner, a sign, a price), stated once.
- Where the same `worldText` recurs across scenes, the prompt restates it
  **verbatim**, exactly as the locked character descriptions already do.
- Where a story does not need in-frame text, the field is empty and nothing
  changes.
- Add `misspelled text, garbled lettering, distorted script` to
  `VIDEO_NEGATIVE_PROMPT`.

This will not make Veo perfect at text, but restating it verbatim is the same
mechanism that holds character identity, and right now nothing restates it at all.

**1.4 — Background-cast note**

The crowd changing every clip is the same class of problem. Add the recurring
background population to the seam text when `continuityState` records it, so it
is restated rather than re-imagined.

### Exit criteria

- 0 joins where the operator is told "no frame upload needed" while the scene
  stays in the same place with the same cast.
- Every scene's operator package names its character reference Ingredients.
- Recurring `worldText` appears verbatim in every scene that shows it.
- Measured offline over all six stories; no API call.

### Tests

`tests/frame-handoff.test.ts` — join classification across the three cases,
including the same-place-new-angle case that is currently mishandled; asset list
completeness; `worldText` restatement; and that a genuine location change still
produces no upload step.

### Risk

This adds manual work for the operator (one upload per same-place cut). That is a
real cost and it is the correct trade: the alternative is the drift in the video.
The package will say plainly which joins need it and why.

---

## Phase 2 — 8-second migration

### The problem

Scenes move from 10s to 8s. `SECONDS_PER_SCENE` is a single constant, but the
duration preset table hardcodes scene counts that assume 10s, and every
calibrated threshold was tuned on 10s output.

### Changes

**2.1 — Duration table** (`src/shared/duration.ts`)

Set `SECONDS_PER_SCENE = 8`. Then **derive** the preset scene counts instead of
hardcoding them, and rewrite `calculateSceneCount()` to compute from seconds
rather than returning a literal per preset. Resulting counts:

| preset | @10s | @8s | | preset | @10s | @8s |
|---|---|---|---|---|---|---|
| 30s | 3 | 4 | | 6 min | 36 | **45** |
| 60s | 6 | 8 | | 7 min | 42 | 53 |
| 90s | 9 | 11 | | 8 min | 48 | 60 |
| 2 min | 12 | 15 | | 9 min | 54 | 68 |
| 4 min | 24 | 30 | | 10 min | 60 | **75** |
| 5 min | 30 | 38 | | | | |

Deriving rather than re-hardcoding means a future change to 6s or 12s is one
constant, not a table rewrite.

**2.2 — Consequences to absorb**

- **25% more scenes.** 10 minutes goes 60 → 75, which is 5 → 7 batches at
  `MAX_SCENES_PER_BATCH = 12`. Generation takes longer and costs more.
  `TEXT_TIMEOUT_MS` (420s) should be re-checked against the longer runs.
- **25% more joins to hold** — 75 instead of 60. Phase A and Phase 1 matter more,
  not less.
- **More clips for the operator to generate by hand.** This is the real cost of
  8s and should be a deliberate decision.

**2.3 — Envelope**

`wordEnvelope()` derives from `SECONDS_PER_SCENE`, so it moves automatically:

| | 10s | 8s |
|---|---|---|
| comfortable | 18 words | **15** |
| ceiling | 24 words | **19** |

**2.4 — Re-calibrate what was tuned at 10s**

Run the existing harnesses (`npm run calibrate`) against the 8s envelope and
re-derive, not hand-pick:
- `BEAT_LIMITS` per performance type and `RELOCATION_LIMIT` (`action-density.ts`)
- beat-density thresholds
- beat-clock floors `MIN_ACTION_SECONDS` / `MIN_SPEECH_SECONDS`, which bite
  harder in a shorter shot

P0–P2 similarity thresholds (`NEAR 0.48`, `FAR 0.60`, `UNVARIED 0.85`, …) measure
text similarity, not time, so they are **not** affected and stay unchanged.

**2.5 — Copy**

~14 UI strings (`DurationSelector`, `ScenePlannerSection`, `Sidebar`,
`StoryDisplay`, `FlowProductionMode`, `ProductionPackageModal`, `App.tsx`) and
the prompt strings at `blueprint.ts:650`, `:1003`, `:1171`,
`action-density.ts`, `performance-budget.ts`, `quality-section.ts:104`. All
should read from `SECONDS_PER_SCENE` rather than saying "10 seconds".

### Exit criteria

- No hardcoded scene count or "10 second" string anywhere; `grep` proves it.
- Every preset's scene count equals `round(seconds / SECONDS_PER_SCENE)`.
- Full suite green after re-calibration, with any threshold change recorded.

### Tests

Extend `tests/` with a duration suite asserting counts derive correctly at 8s,
10s and one other value, so the constant is genuinely portable.

---

## Phase 3 — Dialogue interaction *(not more words)*

### The problem, restated from measurement

At the **8s** envelope, across the two newest stories (66 speaking scenes):
**21/66 already overrun the ceiling**, 35/66 are at or above comfortable, and the
median is 16 words against a comfortable line of 15. The newest story raises 12
`dialogue-tight-for-shot` findings at 10 seconds.

**Writing more words would make every clip worse.** What makes a full scene still
feel empty:

- **17 of 34 dialogue scenes are single-speaker** — half the conversations are monologues
- **4 scenes are talking statues** — others present, silent, nothing planned
- **37% of turns (36/98) narrate the visible picture**
- **`accompanyingAction` / `facialExpression` are optional**, so listener
  behaviour is never planned
- **performance type drives nothing** — the report says so itself

### Changes

**3.1 — Make the performance track required** (`server.ts` schema)

`dialogueTurns[].required` becomes `["speaker", "line", "accompanyingAction", "facialExpression"]`.
The listener's behaviour stops being optional prose and becomes data the beat
clock can render — `renderBeatClock()` already emits `accompanyingAction` when
present.

**3.2 — Add `bystanders`** (per scene)

For each present, non-speaking character: what they are doing during the scene.
Empty when a character is alone, so solo scenes are untouched and nothing is
forced. Rendered into the prompt body and into the beat clock's action rows.

This is the structural fix for the four talking-statue scenes.

**3.3 — Make performance type drive density**

Replace the single global turn guidance with per-type guidance derived from
`wordEnvelope()` and the type:
- `dialogue-scene` — an exchange: **at least two speakers**, and a reply, not two
  statements
- `reaction`, `silent-emotional`, `establishing`, `montage-element` — sparse or
  silent, as now
- `action`, `comedy-beat`, `transition` — as the beat requires

`PERFORMANCE_TYPE_GUIDANCE` already exists in `performance-budget.ts`; this wires
it to density instead of leaving it descriptive.

**3.4 — Resolve the contradiction that is still live**

`server.ts:537` says "Four to six short turns"; the schema at `:278` says "three
or four". The model splits the difference at 3.5. One statement, derived from
`wordEnvelope()`, in one place.

**3.5 — Redundant-speech measure** (report only)

Flag turns whose content is already carried by `characterActions`, using the
existing `textSimilarity()`. **Not a style ban** — third-person self-reference is
a legitimate character voice and must not be outlawed. This measures whether the
words add information the picture doesn't already have.

### Exit criteria

- Talking-statue scenes: 4 → 0.
- Every dialogue-scene has ≥2 speakers, or is reclassified to its true type.
- Mean words per scene **does not rise** — the aim is interaction, not volume.
- Overruns at 8s fall from 21/66.
- No regression in scene-contract or action-density results.

### Tests

`tests/performance-track.test.ts` — required fields; `bystanders` empty for solo
scenes and populated otherwise; per-type density; silence preserved for silent
types; redundancy measure fires on a picture-narrating line and stays quiet on an
informative one.

---

## Phase 4 — Cross-scene conversation thread

### The problem

`story-craft.ts:435` already asks for exactly the right thing — a question asked
at the end of one scene answered at the start of the next. Measured: **3 of 35
joins** carry a thread. Speaker changes across joins happen 15/31 times, which is
chance. It is prose advice with no structural carrier.

### Changes

**4.1 — `openThread` on the seam**

An optional field: what is left hanging at the boundary — a question asked, a
line unfinished, a look held, a decision not yet answered. **Null for genuine
breaks**, so act boundaries and time jumps stay clean.

**4.2 — Carry it into the next scene's brief**

The batch prompt's seam block already transmits physical state
(`endState`, positions, props, lighting). Add the open thread, so the next scene
is told what it is answering — not just where the bodies are.

**4.3 — Emotional carry**

Alongside the thread, transmit the emotional state the audience is holding at the
seam. `continuityState.characterEmotions` exists; it reaches the planner but not
the next scene's dramatic brief.

### Exit criteria

- Joins carrying a thread rise measurably above the current 3/35.
- Act boundaries and deliberate time jumps still emit `null` and are unaffected.
- No increase in envelope overruns — a thread is a reply, not extra words.

### Tests

`tests/seam-thread.test.ts` — thread emitted and consumed; null at a real break;
a question at a scene end is answered at the next scene's start; no word inflation.

---

## Phase 5 — Gate corrections and parity

### Changes

**5.1 — Fix `dialogue-underfilled`** (`quality-gate.ts:409`)

It exists but is nearly inert: `info` severity, fires only when
`performanceType === "dialogue-scene"`, and only below a 20% speech fraction — so
an 8-word scene at 29% never trips it. Raise the floor to a level that catches
real thin scenes and lift the severity to `warn`.

**5.2 — New finding codes**

Joined to the existing 21, with severity consistent with current policy:
- `frame-handoff-missing` — same place, same cast, no reference upload instructed
- `world-text-unstable` — recurring in-frame text not restated verbatim
- `speaker-monologue` — a dialogue-scene with one speaker and others present
- `bystander-idle` — a present character with nothing planned
- `dialogue-restates-action` — speech carrying no information beyond the picture
- `beat-clock-overflows` — content that cannot fit the shot at a speakable rate
  (the clock already computes this and nothing consumes it)

**5.3 — Restore parity on single-scene regeneration**

`POST /api/regenerate-single-scene` currently runs **no** quality system — not
the gate, feasibility, contracts, action density, continuity or handoff
reconciliation. A regenerated scene is completely unchecked. Run the same
per-scene analysis the batch path runs.

**5.4 — Re-run and re-calibrate**

All six stories through the updated gate; re-calibrate anything the new signals
disturb; record results in `plan-story-quality.md`.

### Exit criteria

- Single-scene regeneration produces the same findings a batch scene would.
- New codes fire on the known-bad cases and stay silent on the known-good ones —
  the same standard the Validator Precision pass set.
- No increase in false positives on the six stories.

---

## Sequencing and checkpoints

```
Phase 1  Flow-side continuity   ─┐
                                 ├─ CHECKPOINT A  ← you generate one story
Phase 2  8s migration           ─┘                  and one Flow clip set
Phase 3  Dialogue interaction   ─┐
Phase 4  Cross-scene thread     ─┤
Phase 5  Gate + parity          ─┘─ CHECKPOINT B  ← you generate a full story
```

**Checkpoint A matters.** Phases A and B are shipped but **have never been seen in
a real generation**. Before building three more layers on top, one story should be
generated and a few clips actually produced in Flow, so the seam and the frame
handoff are confirmed to work on screen. I cannot run this — it needs the API and
Flow, both yours.

If Checkpoint A shows the seam still failing, Phases 3–5 should wait while that is
diagnosed, because they all assume the join is holding.

---

## What this plan does not do

- **No automatic repair.** P5 stays off. Every new signal reports.
- **No story-quality rewrite.** Blueprint, life journey, social graph, world
  registry, contracts and distinctiveness are working and are not touched.
- **No prompt section-order normalisation.** That needs the model to emit action,
  camera, light and sound as separate fields; it rides along with Phase 3's
  schema change rather than being attempted with regex on prose.
- **No forced dialogue.** Every density rule is per performance type, and silence
  stays a decision the scene already made.

---

## Standing item, unrelated to video quality

`src/server/auth/users.ts` still ships `admin` / `change-me-now`. `APP_USERS`
must be set before any deployment. This has been outstanding across several
phases.

---

## Phase 1 — IMPLEMENTED

Validated offline against six stored generations (186 scenes, 180 joins). No API
calls.

### What changed

| file | change |
|---|---|
| `src/server/story/frame-handoff.ts` | **New.** Join classification (CHAIN / IDENTITY / FRESH), operator instructions, per-scene reference assets, in-frame text reconciliation with a number guard. |
| `src/server/story/prompt-continuity.ts` | Old binary `buildFrameHandoff` removed (it needed both scenes' continuity state, which does not belong there). Garbled-lettering terms added to `VIDEO_NEGATIVE_PROMPT`. |
| `src/server/story/seam.ts` | Assembler takes a `worldText` section; `backgroundCast` added to the seam text. |
| `src/types.ts` | `FrameHandoffMode`, `FrameHandoff.mode`, `FrameHandoff.requiresFrameUpload`, `SceneReferenceAsset`, `ContinuityState.backgroundCast`. |
| `server.ts` | Both paths classify joins with full scene context; `worldText` and `backgroundCast` schema fields; `reconcileWorldText` pass before prompt assembly; `referenceAssets` per scene; section 6 instructions. |
| `ProductionPackageModal.tsx`, `story-report.ts` | Handoff mode shown; new **Step 1b — Attach character references**. |
| `tests/frame-handoff.test.ts` | **New.** 50 tests. |
| `tests/calibrate-world-text.ts` | **New.** Threshold calibration. |

### Result: frame coverage more than tripled

| join type | count | what the operator does |
|---|---|---|
| CHAIN | 32 (18%) | last frame becomes this clip's first frame |
| **IDENTITY** | **65 (36%)** | **NEW** — last frame attached as an identity reference |
| FRESH | 83 (46%) | genuine break, no upload |

**Before: 32/180 joins got a reference frame. Now: 97/180.**

The 65 IDENTITY joins are cuts that stay in the same place with the same cast —
previously told *"no frame upload needed; generate from the prompt alone"*. That
instruction was the direct cause of the drift measured in the sample video. 46%
are still genuine breaks, so the classifier is not over-applying.

### A hazard caught by calibration

The first version merged any two in-frame texts scoring above a hand-picked 0.6
similarity. Calibration showed the populations are **not separable** by
similarity alone:

```
"Inaam: 5 lakh rupay"  ::  "Inaam: 10 lakh rupay"   similarity 0.924
```

Nearly identical wording, a completely different prize. Merging those would have
written the wrong amount onto the screen for the rest of the film — a bug that
would have been invisible in tests and obvious in the finished video.

Fixed with a number guard that runs **before** the threshold: conflicting digits
mean different signs, whatever the wording. A numeral on one side and a spelled-out
word on the other ("use 5 lakh" / "usay paanch lakh") is a rewording, not a
conflict. With the guard in place the populations separate cleanly
(0.421 … 0.567) and the calibrated midpoint is **0.49**.

### Regression

`npx tsc --noEmit` clean. Full suite **792 passed, 0 failed** (742 + 50).
Phase A exit criteria still PASS. `npm run build` succeeds.

### Honest limits

- In-frame text will still sometimes garble. Restating it verbatim and naming
  the failure in the negative field are the only levers available from here; the
  identity reference frame does the rest.
- `worldText` and `backgroundCast` are new schema fields, so they only take
  effect on **newly generated** stories. Re-rendering an old story does not
  invent them.
- IDENTITY joins add manual work: one frame export and upload per same-place
  cut, 65 across a six-story sample. That is the cost of not having the drift.

### Next

Phase 2 (8s migration) — then **Checkpoint A**, where you generate one story and
produce a few clips in Flow to confirm the seam, the beat clock and the new frame
handoff hold on screen before Phases 3–5 build on top of them.

---

## Phase 2 — IMPLEMENTED

`SECONDS_PER_SCENE` is now **8**. Validated offline; no API calls.

### What changed

| file | change |
|---|---|
| `src/shared/duration.ts` | `SECONDS_PER_SCENE = 8`. Preset scene counts are **derived** from a new `seconds` field instead of being written by hand. `calculateSceneCount()` resolves through an alias table to a runtime, then derives. New `scenesForSeconds()`, `SHOT_LENGTH_LABEL`, `SHOT_LENGTH_PHRASE`. |
| `src/server/http-timeouts.ts` | `LONG_REQUEST_MS` 45 → **65 minutes**. |
| `server.ts` | Three system-instruction lines that told the model it was directing *10-second* shots; the schema's speakability ceiling now derives from `wordEnvelope()`; the turn-count guidance rewritten. |
| `blueprint.ts`, `performance-budget.ts`, `quality-section.ts`, `story-craft.ts`, `action-density.ts` | Prompt and report strings derive from the constant. |
| 8 UI components + `App.tsx` | All "~10s" copy derives; one real arithmetic bug fixed. |
| `tests/generation-guidance.test.ts`, `tests/beat-clock.test.ts` | Assertions that hardcoded the 10s numbers now assert the invariant instead. |

### Scene counts (derived, verified)

| preset | scenes | | preset | scenes |
|---|---|---|---|---|
| 30s | 4 | | 6 min | **45** |
| 60s | 8 | | 7 min | 53 |
| 90s | 11 | | 8 min | 60 |
| 2 min | 15 | | 9 min | 68 |
| 4 min | 30 | | 10 min | **75** |
| 5 min | 38 | | | |

45 × 8s = 6:00 exactly. The `1 minute` / `10 minutes` alias shadowing trap is
covered by a test.

### Three real defects found while migrating

**1. A timeout that would have cut long generations.** A ten-minute film is now
7 provider batches, not 5. At the provider's 420s per-attempt ceiling that is 49
minutes of batches alone — past the old 45-minute socket limit. The failure mode
is the worst kind: the socket drops *after* the tokens are spent. Raised to 65.

**2. An arithmetic bug, not just copy.** `ScenePlannerSection` computed total
runtime as `scenes.length * 10` inline. At 8s every timeline in that header
would have read 25% long. Now uses `formatTotalDuration()`.

**3. The system instruction's own first line.** `"directing consecutive
10-second shots"` — the single most load-bearing sentence in the prompt, plus
the batch prompt and the single-scene regeneration prompt. A pure grep sweep
found these; the UI copy would have looked finished without them.

### Envelope, and the contradiction resolved early

| | 10s | 8s |
|---|---|---|
| comfortable | 18 words | **15** |
| ceiling | 24 words | **19** |

The schema said "FOURTEEN TO TWENTY-TWO WORDS … three or four short turns" while
the system instruction said "Four to six short turns". Both were 10s literals and
both were now wrong, so rather than ship a knowingly false number this was fixed
here instead of in Phase 3. Both sites now derive from `wordEnvelope()`, and the
guidance asks for the budget to be spent on an **exchange** rather than on a turn
quota. **Plan item 3.4 is therefore already done.**

### Re-calibration: thresholds unchanged, and why

`npm run calibrate` at 8s:

| | result |
|---|---|
| scene distinctiveness | midpoint 0.50, committed 0.48 — unchanged |
| beat density | midpoint 0.45, committed 0.45 — unchanged |
| scene contract | BEFORE_AFTER 0.62, ACTIVITY 0.50 — both still inside their perfect ranges |
| action density | **0/10** false positives, **0/6** false negatives (English); **0/11** and **0/5** (Roman Urdu) |

These measure **text similarity and staging load, not time**, so the shot length
does not move them — which is what the plan predicted. `BEAT_LIMITS` and
`RELOCATION_LIMIT` still separate their fixtures cleanly, so they are left alone:
changing them without evidence would be hand-picking.

### The number Phase 3 has to fix

Beat-clock overflow across the six stories rose from 64/186 to **103/186**, and
mean speech share is now **1.01** — speech alone needs the whole shot.

| story | mean words | clock overflow | envelope overruns |
|---|---|---|---|
| Inspector Kheera (pre-Q5) | 38.1 | 36/36 | 36 |
| Roshni Ke Diye | 16.4 | 20/36 | 10 |
| Jahazi | 15.4 | 19/36 | 18 |
| Chhota Beej | 13.6 | 14/36 | 13 |
| Ek Bottle Ek Jhoot | 12.4 | 13/36 | 8 |

This is old 10s content measured against a shorter shot, so it is expected — but
it states the stake plainly: **if the pipeline generated at 8s without Phase 3,
roughly a third of scenes would overrun.** Phase 3's job is interaction and
cutting the 37% of speech that restates the picture, **not** more words.

### Regression

`npx tsc --noEmit` clean. Full suite **793 passed, 0 failed**. Phase A exit
criteria still PASS (180/180 joins). `npm run build` succeeds. Zero hardcoded
"10-second" strings remain in `src/` or `server.ts`.

### Next

**Checkpoint A** — generate one story and produce a few clips in Flow. Phases A,
B and 1 have never been seen on screen, and Phases 3–5 all assume the join holds.

---

## Phase 3 — IMPLEMENTED

Validated offline against six stored generations (186 scenes). No API calls.

### What changed

| file | change |
|---|---|
| `server.ts` | `dialogueTurns` now **requires** `facialExpression` and `accompanyingAction`. New per-scene `bystanders` array. Section 6 states that every person on screen is doing something. |
| `src/server/story/bystanders.ts` | **New.** Normalises the planned bystanders, renders the prompt line, and measures who is present, silent and unaccounted for. |
| `src/server/story/performance-budget.ts` | New **DENSITY FOLLOWS THE PERFORMANCE TYPE** block: a dialogue-scene must be an exchange with two or more speakers, silent types stay near zero, and speech must say what the picture cannot. |
| `src/server/story/seam.ts` | Assembler takes a `bystanders` section, placed after the clock and before the closing frame. |
| `src/types.ts` | `SceneBystander`. |
| `tests/performance-track.test.ts` | **New.** 29 tests. |

### The measure, and a correction to the audit

The audit reported **4** talking-statue scenes. That was Chhota Beej only, under a
narrow definition (a monologue with others present). Measured properly across all
six stories — any character who is present, never speaks, and has no planned
behaviour:

| | scenes | characters |
|---|---|---|
| raw | 71/186 | 108 |
| after excluding characters the action already choreographs | 59/186 | 87 |
| after ignoring placeholder speakers | **58/186** | **86** |

**The problem is roughly fourteen times larger than the audit said.** Nearly a
third of all scenes put someone on screen with nothing planned for them.

Two precision guards were added rather than shipping the raw number:

- **A character the action already describes is not idle.** "Kadoo Bi's hand
  sweeps along the shelf, leaving Beeju standing alone" accounts for both of
  them. Flagging that would push the model to write a second, competing account
  of the same behaviour — the duplicate-description failure this pipeline has
  already been bitten by once.
- **A placeholder speaker is not a speaker.** A turn attributed to
  "None / Visual Action" made a wordless scene look like it had speech, which
  then reported its entire silent cast as idle.

### 3.5 — REJECTED, and why

The plan called for a redundancy measure: 37% of turns restate the visible
action, so flag lines that duplicate `characterActions` using `textSimilarity()`.

**It cannot be built this way.** The pipeline writes `characterActions` in
**English**, because that is what the video model reads, and dialogue in the
**story's language**. Token and trigram overlap collapses across that boundary:

```
same meaning, different pairing:
  EN action :: RU line   0.093    <- the real pipeline
  RU action :: RU line   0.278
  EN action :: EN line   0.310
```

Calibrated against fixtures, the populations do not separate at all. The worst
real case — "Beeju gir gaya. Beeju phir chadhega." over a shot of Beeju falling
and climbing — scores **0.086**, while a genuinely informative line scores
**0.103**. A detector on those numbers is noise, and noise in a quality gate is
worse than no signal: it teaches the writer to dodge the measure.

The module was deleted. `tests/calibrate-redundancy.ts` is kept as the record of
the rejected approach and as a harness for any future cross-lingual measure,
which would need a model call or an embedding index — neither available offline.

What shipped instead is prompt guidance: *"Say what the picture CANNOT"*, with an
explicit protection that a character's own voice and way of speaking is theirs to
keep. The 37% is addressed by instruction, not by detection, and that limit is
stated rather than hidden.

### Guardrails held

Asserted directly in the suite:

- a solo scene never gets bystanders
- a fully silent scene is never flagged
- a scene where everyone speaks is never flagged
- a speaking character is never listed as a bystander
- no behaviour is invented where the scene planned none
- *"Never pad a scene to reach it"* and *"do not push speech into an establishing
  shot"* both still present

### Regression

`npx tsc --noEmit` clean. Full suite **822 passed, 0 failed**. Phase A exit
criteria still PASS (180/180). `npm run build` succeeds.

### Honest limits

- `bystanders`, `facialExpression` and `accompanyingAction` are schema changes,
  so they only take effect on **newly generated** stories. The 58/186 figure is
  the baseline the next generation has to beat, not a fixed result.
- The exchange rule and the density-by-type rules are **instructions**, not
  enforcement. Phase 5 adds the gate findings that measure whether they landed.
- Dialogue redundancy is not detected. It is guidance only.

### Next

Phase 4 (cross-scene conversation thread), then Phase 5 (gate + parity).
**Checkpoint A is still outstanding** — Phases A, B, 1, 2 and 3 have now all
shipped without any of them being seen on screen.

---

## Phase 4 — IMPLEMENTED

Validated offline. No API calls.

### What changed

| file | change |
|---|---|
| `src/server/story/seam-thread.ts` | **New.** Reads the thread a scene leaves open, builds the dramatic half of the next batch's brief, and flattens the per-character continuity maps. |
| `server.ts` | New `openThread` schema field, **required** with "None" as a valid answer. `buildPreviousContext()` now populates the three fields it never did. Thread block wired into the previous-scene brief. Section 6 tells the next scene to engage what it inherits. |
| `tests/seam-thread.test.ts` | **New.** 32 tests. |

### A bug found while wiring it

`buildPreviousContext()` declared `heldProps`, `characterPositions` and
`characterEmotions` on its return type and **never populated any of them**. The
prompt template had lines for all three:

```
${previousSceneContext.characterEmotions ? `- Emotional State: ...` : ""}
```

Every one of those was falsy, so **no prompt this pipeline has ever sent carried
the emotional state, the screen positions or the held props across a batch
boundary.** The next batch inherited where the bodies were — via `endState` — and
nothing about what anyone felt or held.

That is a large part of why phase 4's problem existed at all: the seam was
transmitting less than the code appeared to say it was. Fixed by reading them
off `continuityState` and flattening the per-character maps to prose.

### What the seam now carries

Before — physical only:

```
- Ending Visual State / Next Scene Handoff / Characters Present
- Environment & Lighting / Props
```

After, additionally:

```
- Held Props / Screen Positions / Emotional State      (declared before, never sent)
- STILL OPEN FROM SCENE #N: <the unfinished business>
  ... ENGAGE it - answer it, refuse it, interrupt it, or let someone
  change the subject on purpose. Do not restate it as if it were new,
  and do not quietly drop it.
- WHAT THE AUDIENCE IS HOLDING: <emotional state>
  Feeling carries across a cut. Do not reset anyone to neutral without
  a reason the audience can see.
```

### The guardrail this phase needed

The obvious way to get threads at every join is to demand one, which would turn
act breaks and time jumps into cliffhangers — mechanical in exactly the way the
craft rules already forbid. So:

- `openThread` is **required**, with **"None" a first-class answer**, correct at
  an act break, a time jump or a resolution.
- A closed beat with no emotional carry transmits **nothing at all** — asserted.
- The thread block never fabricates a thread out of emotions alone — asserted.
- The schema and section 6 both say a hook at every join is as mechanical as
  none, and the tests assert that wording is present in the source.

### Baseline

`openThread` is a new field, so the six stored stories carry none: the measured
starting point is **0 threads recorded**. The earlier "3 of 35 joins" figure came
from a question-mark heuristic over existing dialogue, not from this field. The
next generation is the first that can be measured properly.

### Regression

`npx tsc --noEmit` clean. Full suite **854 passed, 0 failed**. Phase A exit
criteria still PASS (180/180). `npm run build` succeeds.

### Honest limits

- Like Phases 1 and 3, this is a schema change: it only takes effect on **newly
  generated** stories.
- Whether the next scene actually *engages* the inherited thread is an
  instruction, not enforcement. Phase 5 adds the finding that measures it.
- Within a single batch the model already sees its own previous scenes; this
  block matters most at batch boundaries, which at 8 seconds now fall every 12
  scenes across up to 7 batches.

### Next

Phase 5 — gate corrections and single-scene parity. After that, **Checkpoint A**
is the only thing standing between six shipped phases and any evidence that they
work on screen.

---

## Phase 5 — IMPLEMENTED

Validated offline against six stored generations (186 scenes). No API calls.

### What changed

| file | change |
|---|---|
| `src/types.ts` | Five new `QualityFindingCode` values. |
| `src/server/story/quality-gate.ts` | New section **3b. Performance and production continuity**. `dialogue-underfilled` promoted from `info` to `warn`. |
| `src/server/story/performance-budget.ts` | `UNDERFILLED_FLOOR` 0.2 → **0.3**. |
| `server.ts` | `beatClock` stored on the scene so the gate can consume it. **Single-scene regeneration now runs the analysis it never ran.** |
| `tests/gate-phase5.test.ts` | **New.** 27 tests. |

### The five new findings

| code | fires when | severity |
|---|---|---|
| `speaker-monologue` | a dialogue-scene has one voice and a silent audience | warn |
| `bystander-idle` | someone is present, silent, absent from the action, unplanned | warn |
| `frame-handoff-missing` | a same-place, same-cast cut is told it needs no reference frame | warn |
| `world-text-unstable` | one sign appears with two different wordings | warn |
| `beat-clock-overflows` | the shot cannot perform its content at a speakable rate | repair |

Every one is checked against the case it must **not** fire on as well as the case
it must: a solo scene, a fully silent scene, a genuine location change, a cut
with no shared cast, a join already classified IDENTITY, two genuinely different
signs, and a scene with no data for the field at all.

### `dialogue-underfilled` — the floor was nearly inert

At 0.2 the floor meant "under four spoken words" in an eight-second shot, so it
caught only near-silent scenes and let a thin two-line exchange pass as healthy.
Measured across 175 speaking scenes:

| floor | scenes flagged |
|---|---|
| 0.20 (old) | 10/175 |
| **0.30 (new)** | **18/175** |
| 0.40 | 28/175 |

0.3 is roughly **half the comfortable envelope** — the point where a scene that
declared itself a dialogue scene is not holding a conversation. It stays a
fraction, like the two ceilings above it, so it moves with the shot length
instead of going stale as a word count.

### Single-scene regeneration: the parity gap closed

`POST /api/regenerate-single-scene` ran **no** quality system — not the gate, not
feasibility, contracts, action density or continuity. A regenerated scene could
overrun its shot, break screen direction or contradict its own contract and
nothing would say so.

It now runs continuity validation over a two-scene window and the gate over the
per-scene layers, returning `scene.qualityFindings` scoped to that scene.
Analysis failures are caught and logged: reporting must never fail a
regeneration the caller is waiting on.

### A consistency bug caught by cross-checking

The gate reported **59** idle-bystander scenes while the bystanders module
reported **58**. The placeholder-speaker guard — a turn attributed to
"None / Visual Action" is not a speaker — had been fixed in the module during
Phase 3 and not in the gate. Two implementations of one rule had drifted apart
within a single session. Aligned; both now report **58**.

### Gate output on the six stories

| finding | count |
|---|---|
| bystander-idle | **58** |
| dialogue-overruns-shot | 53 |
| dialogue-tight-for-shot | 29 |
| action-overloaded | 4 |
| uniform-dialogue-density | 1 |

The other four new codes report **0**, which is correct rather than encouraging:
`speaker-monologue` needs `contract.performanceType`, `frame-handoff-missing`
needs `frameHandoff`, `world-text-unstable` needs `worldText` and
`beat-clock-overflows` needs `beatClock` — none of which exist on stories
generated before these phases. **Degrade, never invent** working as intended: no
data produces no finding, not a clean bill of health.

The 53 `dialogue-overruns-shot` findings are the eight-second migration showing
its teeth on ten-second content, and are what Phase 3's exchange rules exist to
bring down.

### Re-calibration

`npm run calibrate` after all five phases: distinctiveness 0.48, beat density
0.45, contract 0.62 / 0.50 all still inside their ranges; action density
**0/10** and **0/6** false positives and negatives in English, **0/11** and
**0/5** in Roman Urdu; world text separable at 0.49. Nothing the new findings
touch disturbed an existing threshold.

### Regression

`npx tsc --noEmit` clean. Full suite **881 passed, 0 failed**. Phase A exit
criteria still PASS (180/180). `npm run build` succeeds.

---

## All five phases complete

| phase | shipped |
|---|---|
| A — seam identity | closing frame of N ≡ opening frame of N+1, 180/180 joins |
| B — beat clock | 0/36 → 186/186 prompts carry shot timing |
| 1 — Flow-side continuity | reference frames 32/180 → 97/180 joins; in-frame text reconciled |
| 2 — 8-second migration | scene counts derived; three real defects fixed |
| 3 — dialogue interaction | performance track required; 58/186 idle-bystander baseline |
| 4 — cross-scene thread | `openThread`; three seam fields that were never sent, now sent |
| 5 — gate + parity | five new codes; single-scene regeneration no longer unchecked |

**881 tests, 0 failing.** No API call was made in any phase.

### The one thing still outstanding

**Checkpoint A.** Seven phases have shipped and **not one has been seen on
screen.** Every measurement above is of prompts and plans, not of video. The
schema-dependent work — Phases 1, 3 and 4 — cannot even be measured until a
story is generated with the new fields.

Generate one story, produce three or four clips in Flow, and include at least
one **IDENTITY join** (a cut that stays in the same place), because that is the
join Phase 1 changed and the one the sample video showed drifting.

### Standing item

`src/server/auth/users.ts` still ships `admin` / `change-me-now`. `APP_USERS`
must be set before any deployment.

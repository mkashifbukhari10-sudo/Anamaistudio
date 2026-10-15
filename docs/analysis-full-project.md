# AnamStudio — Full Project Analysis

Date: 2026-09-19. No API calls were made. Evidence: the codebase, six generated
stories in `test-output/`, and frame-level analysis of the sample video
(`video.mp4`, 77.5s).

---

## 1. What the project is

A **prompt factory**, not a video generator. It plans a complete Roman Urdu /
Hindi / Urdu children's story with anthropomorphic vegetable characters and
emits, per scene, a self-contained Google Flow / Veo prompt that the operator
pastes in by hand.

31,055 lines of TypeScript. Vite + React 19 client, Express server, DeepSeek for
text. Three entrypoints (`dev-server.ts`, `prod-server.ts`, `api/index.ts`) all
consuming one `createApp()`.

**No dead modules** — every file under `src/server/story` and `src/server/dev` is
imported somewhere. The codebase is not carrying weight it doesn't use.

---

## 2. The pipeline, end to end

```
POST /api/generate-story
  │
  ├─ PHASE 1A  Narrative Blueprint        story first, scenes second
  │            social graph · world registry · life journey · beat density
  │            (beat density measured BEFORE any scene exists)
  │
  ├─ PHASE 1   Narrative, Character Bible, Chapters
  │
  ├─ PHASE 2   Scenes, in batches of 12   runSceneBatchPipeline
  │            each batch sees: previous scene's endState, the ledger,
  │            story memory, blueprint slice, planned moves, seam block
  │
  ├─ PHASE 3   validateAndStandardizeTimeline
  │            ├ scrub place ids
  │            ├ makeSelfContained        strip cross-scene references
  │            ├ ensureDialogueInPrompt   recover lines the model summarised
  │            ├ applyFrameBookends       ← Phase A: seam identity
  │            ├ buildBeatClock           ← Phase B: shot timing
  │            ├ normalizeTransitionType  CHAIN vs CUT
  │            └ buildFrameHandoff        the operator's frame-upload step
  │
  ├─ PHASE 4   Analysis, report-only, owns nothing
  │            continuity · story quality · feasibility · scene contracts
  │            action density · life journey · social facts · quality gate
  │
  └─ PHASE 5   Character reference packages (prompts for Flow "Ingredients")
```

**Layer ownership** is clean and worth preserving: FACTS (social graph, world
registry) / STATE (story memory, deltas) / PHYSICS (continuity state) / LIFE
STATE (life journey) / QUALITY (analysis, owns nothing).

### A real parity gap

The quality systems run **only in the batch path**. `POST /api/regenerate-single-scene`
gets `applyFrameBookends` and `buildBeatClock`, but **none** of:
`buildQualityGateReport`, `buildFeasibilityReport`, `buildSceneContractReport`,
`buildActionDensityReport`, `validateContinuity`, `reconcileHandoffs`.

So a regenerated scene is never checked. It can overrun its shot, break screen
direction or contradict its contract, and nothing will say so.

---

## 3. What the sample video actually shows

77.5s, 30fps, 9:16. Clip length **~8s** (period-8 boundaries carry 1.25x the jump
of non-boundaries — the strongest of 6/7/8/9/10s tested).

**Within-shot motion: median 6.3. At joins: 29–41.** The picture changes ~6x more
at a cut than during a shot.

### Story flow is fine. Visual continuity is not.

The narrative reads correctly: kitchen → cycle ride → wrestling poster → fight →
prize. Beats are in the right order.

What breaks is everything *inside the frame*. At the 70.0s → 70.5s join — half a
second, across one clip boundary:

| | before | after |
|---|---|---|
| Money bag text | `5,00,0000` / `پانچ لاکھ` | `5,00,00,000` / `پورچ کرٹس` (garbled; amount 100x off) |
| Aloo's face | rough skin, one brow shape | smooth, different brow, different mouth, different proportions |
| Old man handing the bag | present | **gone** |
| Crowd | one set | a different set |
| Background | village walls | different buildings + a tree |

Same at the 56.5s → 57.0s join: the Urdu banner
`جو کریلے کو ہرائے گا…` becomes meaningless Devanagari `ाजी मेलली`, and the
crowd characters change.

### The conclusion that matters

**These failures cannot be fixed by prompt text.** Character identity drift,
in-world text instability and background-cast churn happen because Veo generates
each clip independently. A perfect seam paragraph does not stop them.

They need the **Flow-side workflow**: the previous clip's last frame uploaded as
the next clip's first-frame reference, and the character reference image attached
on every clip.

The code already has both pieces — `buildFrameHandoff()` and
`buildCharacterReferencePackage()` — but `buildFrameHandoff` tells the operator
that a CUT needs **no frame upload**, and CUT is the large majority of joins.
That is editorially defensible and visually wrong, and the video is the proof.

**So the fix is in two halves, and only one of them is prompt engineering.**

---

## 4. Status against the four stated problems

### 4.1 "startState / endState theek nahi hain"

In the **data**, the chain is faithful — I compared all 36 pairs in Chhota Beej
and they inherit in detail. In the **artifact**, it was broken: the opening frame
was specified in 328 words and the closing frame in 54, so Veo was never told
where to end.

**Fixed in code (Phase A), not yet seen in output.** Scene N's closing frame and
scene N+1's opening frame are now one identical string — 180/180 joins across six
stories. No story has been generated since.

### 4.2 "8s scene mein dialogue words kam hain"

This one turned out to be the opposite of what it looks like. Measured on the two
newest stories (66 speaking scenes), against the **8-second** envelope
(comfortable 15 words, ceiling 19):

| | count |
|---|---|
| at or above comfortable | **35/66** |
| **over the ceiling** | **21/66** |
| 8 words or fewer (genuinely thin) | **15/66** |

Median is 16 words — already *above* the 8s comfortable line. The newest story
(*Ek Bottle Ek Jhoot*) already raises **12 `dialogue-tight-for-shot` findings at
10 seconds**. At 8s a third of its scenes would overrun.

**So "dialogue kam hai" is not a word-count problem.** The distribution is
bimodal: a quarter of scenes are too thin, a third are already too full. What
makes the full ones still feel empty is *what the words do*:

- **17 of 34 dialogue scenes are single-speaker.** Half the "conversations" are
  monologues.
- **4 scenes are talking statues** — other characters on screen, silent, doing
  nothing planned (S10, S13, S19, S35 in Chhota Beej).
- **37% of turns (36/98) narrate the picture.** "Beeju gir gaya" spoken while we
  watch Beeju fall. The words add no information the image doesn't already carry.
- **`accompanyingAction` and `facialExpression` are optional** in the schema
  (`server.ts:287`, required is `["speaker","line"]`), so what a listener does
  while someone speaks is never planned.
- **Performance type is classified but unused.** The report says it outright:
  *"Classification only at this stage — it does not yet drive dialogue density."*

### 4.3 "Story human behaving lagni chahiye"

The planning layer for this is genuinely strong and should not be touched: life
journey, social graph with reciprocals, relationship deltas, scene contracts,
scene distinctiveness, progression rails.

The weakness is at the seam between scenes: **only 3 of 35 joins carry a
conversational thread across** (a question asked at the end of one scene answered
at the start of the next). `story-craft.ts:435` asks for exactly this, but as
prose advice with no structural carrier, so it doesn't land.

### 4.4 "Connectivity"

Two different things, and they need different fixes:
- **Narrative connectivity** — handled by the blueprint layer, working.
- **Visual connectivity** — half fixed (seam text), half not fixable in text at
  all (§3).

---

## 5. The 8-second change: full impact

### 5.1 Scene counts change everywhere

`src/shared/duration.ts` is the single source of truth, but the preset table
**hardcodes scene counts that assume 10s**, and `calculateSceneCount()` hardcodes
a return per preset. Both must change:

| preset | @10s | @8s | extra scenes | batches (12/batch) |
|---|---|---|---|---|
| 30 seconds | 3 | 4 | +1 | 1 → 1 |
| 60 seconds | 6 | 8 | +2 | 1 → 1 |
| 90 seconds | 9 | 11 | +2 | 1 → 1 |
| 2 minutes | 12 | 15 | +3 | 1 → 2 |
| 4 minutes | 24 | 30 | +6 | 2 → 3 |
| 5 minutes | 30 | 38 | +8 | 3 → 4 |
| 6 minutes | 36 | **45** | +9 | 3 → 4 |
| 7 minutes | 42 | 53 | +11 | 4 → 5 |
| 8 minutes | 48 | 60 | +12 | 4 → 5 |
| 9 minutes | 54 | 68 | +14 | 5 → 6 |
| 10 minutes | 60 | **75** | +15 | 5 → **7** |

Consequences: **25% more scenes**, more batches (more generation time and cost),
**more seams to hold** (75 joins instead of 60), and more Flow clips for the
operator to generate by hand.

### 5.2 The speech envelope shrinks

| | 10s | 8s |
|---|---|---|
| comfortable | 18 words | **15** |
| ceiling | 24 words | **19** |

### 5.3 The direct tension

**8 seconds and "more dialogue" pull against each other.** At 8s there is *less*
room, and a third of current scenes already overrun it. Writing more words per
scene would make every clip worse, not better.

The resolution: at 8s the goal is not more words, it is **more interaction per
word** — two speakers instead of one, a planned listener reaction, and cutting
the 37% of speech that restates the picture. Removing a redundant line and
replacing it with a reply makes the same 15 words feel like a real conversation.

### 5.4 Everything calibrated at 10s needs re-checking

- `wordEnvelope()` — derived, changes automatically
- `BEAT_LIMITS` (action 4, dialogue-scene 3, reaction 2 …), `RELOCATION_LIMIT=2` —
  calibrated against 10s fixtures, must be re-calibrated
- Beat clock allocation — already duration-general, but its floors
  (`MIN_ACTION_SECONDS 0.5`, `MIN_SPEECH_SECONDS 0.6`) bite harder at 8s
- All P0–P4 thresholds were tuned on 10s output

### 5.5 Prose that hardcodes "ten seconds"

~14 UI strings (`DurationSelector`, `ScenePlannerSection`, `Sidebar`,
`StoryDisplay`, `FlowProductionMode`, `ProductionPackageModal`, `App.tsx`) and
several prompt strings (`blueprint.ts:650`, `:1003`, `:1171`,
`action-density.ts`, `performance-budget.ts`, `quality-section.ts:104`).

---

## 6. Corrections to my earlier audit

Three claims in `audit-continuous-film.md` were wrong, and they change the plan:

1. **"Nothing reports under-fill."** False. `dialogue-underfilled` exists
   (`quality-gate.ts:409`). But it is `info` severity, fires only when
   `performanceType === "dialogue-scene"`, and only below 20% speech fraction —
   so an 8-word scene at 29% never trips it. The finding exists; the threshold is
   too low to be useful.

2. **Performance type looked unpopulated.** It is populated — the real report
   shows 14 dialogue-scene, 9 action, 4 reaction, 3 transition, 3
   montage-element, 2 establishing, 1 silent-emotional. My test parser
   (`tests/parse-report.ts`) doesn't extract it, which is what I was reading.

3. **"The pipeline systematically under-fills."** True of Chhota Beej at 10s, not
   true generally. The newest story raises 12 `dialogue-tight-for-shot` findings.
   The real shape is bimodal, and at 8s the overrun side dominates.

---

## 7. Risks and gaps

| | |
|---|---|
| **Flow-side drift** | The largest remaining quality problem, and not solvable in prompt text (§3). |
| **Single-scene regeneration is unchecked** | No quality system runs on it (§2). |
| **`dialogue-underfilled` threshold too low** | Real thin scenes pass silently. |
| **Performance type is inert** | Classified, reported, drives nothing. |
| **No cross-scene dialogue carrier** | 3/35 joins carry a thread. |
| **Prompt section order still free-form** | `Action:` in 11/36, `Camera:` in 12/36; needs the schema change deferred to Phase C. |
| **Security (standing)** | `src/server/auth/users.ts` still ships `admin` / `change-me-now`. `APP_USERS` must be set before any deployment. |
| **8s multiplies seams** | 75 joins at 10 minutes instead of 60 — the seam fix matters more, not less. |

---

## 8. What is already done

| | |
|---|---|
| Phase A — Seam identity | Closing frame of N ≡ opening frame of N+1, 180/180 joins. Asymmetry 6.10 → 1.00. Duplicate opening frames 12 → 0. `At 10.0s` openings 24 → 0. |
| Phase B — Beat clock | Every prompt carries timed rows. 0/36 → 186/186. Silent scenes stay silent. +11% prompt size. |
| Tests | 742 passing, 0 failing. `tsc --noEmit` clean. Build succeeds. |

Neither has been seen in a real generation yet — no story has been produced since
they landed.

---

## 9. Priority order for the fix plan

1. **Flow-side continuity** — frame handoff on every join, reference image on
   every clip. Biggest visible win; the video proves it.
2. **8-second migration** — duration table, scene counts, envelope, re-calibrate
   thresholds, UI and prompt copy.
3. **Dialogue interaction** — required `accompanyingAction`/`facialExpression`,
   a `bystanders` field, make performance type drive density, cut
   picture-narrating speech.
4. **Cross-scene conversation thread** — a structural carrier for the thing
   `story-craft.ts:435` already asks for.
5. **Gate corrections** — raise the under-fill threshold, add codes for the new
   signals, restore parity on single-scene regeneration.

Detailed plan to follow.

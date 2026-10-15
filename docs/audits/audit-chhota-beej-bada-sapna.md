# Evidence Audit — "Chhota Beej, Bada Sapna" (36 scenes, Cinematic Emotional, 6 min)

**Artifact:** `test-output/2026-09-19T09-10-14-193Z__complete__chhota-beej-bada-sapna.md`
**Significance:** the **first fully-instrumented generation** — every layer P0→P4 ran and reported.
**Method:** all 36 scenes read sequentially; every gate finding re-derived from scene content; nothing assumed correct because a detector fired.

---

## A. Generation validity — fully non-degraded

| Check | Result |
|---|---|
| Scenes | 36/36, 0 failed batches |
| Provider calls | 5/5 ok |
| Planned moves (P1) | **36/36** |
| Scene contracts (P2) | **36/36 produced, 35/36 valid** |
| Evidence layers in gate | **7/7 present** |
| `degraded` | **false** |

First artifact in the project's history where the gate had complete evidence. Nothing below is inferred from a partial run.

---

## B. P0 — Distinctiveness

| Metric | Value | vs previous |
|---|---|---|
| Avg consecutive similarity | **0.242** | best measured (Roshni 0.254, Jahazi 0.262, Inspector 0.273) |
| Flagged pairs | **0** | — |
| Repetition runs | **0** | — |
| `staticScenes` / `fillerSuspects` | **[] / []** | — |
| Place concentration (max) | **33%** | best by far (Roshni 56%, Jahazi 56%, Inspector 50%) |

**Manual check for paraphrased repetition the detector could miss.** I looked specifically for the failure class:

- **Counting appears in six scenes** (S5, S11, S13, S27, S29, S33). This is a *motif*, not repetition: Kadoo Bi counts inventory (S5), counts seeds into soil (S11), Beeju counts the row and finds it short (S13), counts himself across the drain (S27), counts to the empty eighth place (S29), Kadoo Bi counts the finished row to eight (S33). Each instance carries a different meaning, and the arc of the film is literally *being counted*.
- **"Beeju dikh raha hai"** ("Beeju is visible") appears at **S19** (low point — he finally has the light, alone, and it is worthless) and **S30** (climax — he is completely visible and it is the exact thing preventing him growing). Same line, **inverted meaning**. Deliberate.
- **"Beeju gir gaya. Beeju phir chadhega/uthta hai"** — S2 (knocked off the packet) and S27 (slips on the drain). Callback with changed stakes.
- **S26–S28** are three consecutive crossing scenes — each has a different obstacle (water, drain grate, wall) and a different discovery (navigating blind, the habit works unwatched, effort without witnesses).

**Verdict: no repetition, and the detector's silence is correct.** The motifs are craft.

---

## C. P1 — Beat density

**36 materially different moves across 36 scenes · 0 stretched · 0 findings.**

15 beats over 36 scenes, allocated 1–3 scenes each. No beat carries more than 3. The resolution beats are 2 scenes each.

**Are 36 scenes narratively justified?** Reading all of them: **yes**. I could not identify a removable scene. The closest candidates:

- **S6 / S7** both present "what happens if you're not chosen" (the tin) and "the alternative life" (Roopa's jar) — but they are different *offers*, and both pay off later (tin at S25, jar at S17).
- **S19 / S20** are both low-point scenes — but S19 is "the thing I wanted is worthless" and S20 is "the place I was going is gone". Different losses.

That is a materially better result than the Roshni audit, where I found 1 removable and 2 compressible.

---

## D. P2 — Scene contracts

**35/36 valid. 1 warning, 4 notes.**

Progression kinds are well spread — **11 kinds**, top is `relationship`/`consequence`/`decision` at 14% each. No monotony.

I traced **planned move → goal → obstacle → outcome → before/after → actual scene** for every scene. The contracts are **honest**, not merely well-formed. Examples verified against text:

- **S13** planned *"Beeju counts the row for himself: seven"* → progression `discovery`, "he is certain the row passed him over" → "he sees the eighth place was never filled because he was not in the packet". Scene delivers exactly that, in dialogue: *"Aath nahi. Jagah khaali hai." / "Beeju wahan tha hi nahi."*
- **S30** planned *"He takes the place and finds the soil thin"* → `reversal`, "visibility is the best thing" → "something he now has to give up". Scene: he lies in the hollow and says *"Beeju dikh raha hai... Par Beeju bada nahi ho sakta."* The want is inverted on screen without narration.

### The two flagged contracts — both detector-side, not story-side

**S2 `activity-as-progression` (warning).** before: *"Beeju holds it, standing in the light"* → after: *"Motu holds it by size alone, and Beeju is back down on the bare board"*. The lexical rule fired because both sides name a cast member **and** contain a staging verb (`hold`). But the declared value is *"who holds the packet's top spot"* — the states legitimately describe **who holds it**. **False positive**: the detector cannot distinguish "X holds the position" (a state) from "X holds an object" (an activity).

**S26 `outcome-contradicts-progression` (warning).** kind=`obstacle`, outcome=`achieved`. Reading the scene: the gutter knocks Beeju off his feet (obstacle appears) *and* he gets up and finds the wall (goal achieved). **Both are true.** The contradiction table treats `obstacle + achieved` as impossible, but a scene can introduce an obstacle and still achieve its immediate goal — that is what an escalating-attempt scene *is*. **Calibration error in the rule, not a story fault.**

**The 4 `relationship-change-uncorroborated` notes (S2, S3, S16, S21)** are correctly raised: those scenes do claim relationship movement and emit no `socialChanges`. The social-plan report confirms the gap independently — **3 planned turning points, only 1 fulfilled**. This is the one place where the *story data* is genuinely thin, and it is a real finding.

---

## E. P3 — Generation guidance

**The quota behaviour is gone.** This is the clearest single improvement in the project:

| Story | Dominant turn count | Share | Std dev |
|---|---|---|---|
| Inspector Kheera (pre-Q5) | 6 turns | **92%** | 0.28 |
| Roshni Ke Diye (pre-Q5) | 6 turns | **67%** | 1.14 |
| **Chhota Beej (post-P3)** | **3 turns** | **36%** | **1.22** |

Average words/scene: **13.6**, speech filling **49%** of the shot — comfortably inside the 14–22 envelope, versus Inspector Kheera's 38.1 words at **136%**.

**Performance types match the actual scenes.** Distribution: dialogue-scene 13, action 9, reaction 4, transition 3, montage-element 3, establishing 2, silent-emotional 1. Spot-checked against content:

- **S8 `silent-emotional`, 0 turns** — Beeju turns from the counter, looks at the field, sits on the packet's lip. A decision made without a word. Correct, and the strongest use of the type.
- **S15 `transition`, 0 turns** — the tray leaves through the back door. Correct.
- **S10 `action`, 1 word** — the packet is carried away and Beeju says *"...Beeju?"* One word is the entire beat. Correct, and the report flags it `underfilled`, which is wrong (see O).

**Consecutive dramatic jobs differ.** No two adjacent scenes share kind + value + direction. The nearest pair is S8/S9 (both `decision`) but the values differ — "where Beeju stands for the loading" vs "Beeju's plan for being seen" — and the scenes are plainly different.

---

## F. P4 — Action density

### 5 scenes unclassified — and the reported reason is wrong

The report says: *"the action line is written in another language"*. **It is not.** All five are English:

| Scene | Verbs present | In vocabulary? |
|---|---|---|
| S7 | lean, call, hold | **none** |
| S20 | sprint, skid, stare | **none** |
| S33 | tip, press, count | **none** |
| S17 | travel, come to rest | gap |
| S22 | ask, raise, answer | gap |

**This is an English vocabulary gap, not a language problem** — and the message actively misleads. 14% of scenes went unmeasured with a misleading explanation.

### 3 flagged — only 1 genuine

| Scene | Live measure | My verdict |
|---|---|---|
| **S35** | 3 beats, limit 2 (establishing), 1 reloc | **GENUINE.** *"pulls the door shut, turns the key, climbs onto the cart, looks back once, drives away"* — five actions in a 10s establishing shot. Real overload. |
| **S23** | 3 beats, limit 2 (reaction), 1 reloc | **FALSE POSITIVE.** *"peels his hands off the glass, turns from her, walks two steps"* is one continuous turn-away. Entirely filmable in 10s. |
| **S25** | 1 beat, limit 3, **3 relocations** | **FALSE POSITIVE.** *"rolls onto his front and crosses the dark floor to the back door, passing beneath the tin, and squeezes under the door onto the step"* is **one continuous crawl**, ideal for a tracking shot. |

**S25 exposes a specific defect in the relocation counter:** it counts the *waypoints of a single traverse* as separate relocations. "to the back door", "beneath the tin", "under the door" are three destination phrases describing one journey. This is the precise failure mode I flagged as a watch-item after the Roman Urdu work, now confirmed on real output.

---

## G. P4 Quality Gate — the BLOCK explained

### The single blocking finding is 100% false positive

`chain-screen-direction-reversed` — S3, S10, S22, S23. I pulled the actual `screenDirection` values:

| Join | Previous | Current | Reversed? |
|---|---|---|---|
| S2→S3 | "left-to-right along the shelf" | "left-to-right along the shelf **toward the pot**" | **No — identical direction** |
| S9→S10 | "Beeju faces along the shelf **toward frame right**" | "Beeju faces **right** toward the work table" | **No — both right** |
| S21→S22 | "the pane divides the frame vertically **with** Beeju inside at frame left **and** Ankuri outside at frame right" | "the pane divides the frame vertically**,** Beeju inside at frame left**,** Ankuri outside at frame right" | **No — the same sentence repunctuated** |
| S22→S23 | (as above) | "the pan reads left-to-right across the room, from the glass to the back door" | **No — still rightward** |

**Root cause:** the Continuity Director compares `screenDirection` as a **prose string**, so any rewording reads as a reversal. S21→S22 is the proof — the two strings differ only in commas.

**This is the same defect class I identified in the Roshni audit for `location`**, now confirmed to also affect `camera`. P4 did not create it; P4 **promoted it to `block`**, which is worse: the most severe severity in the system is currently reserved for a string-comparison artifact.

### Remaining findings

| Finding | Count | Verdict |
|---|---|---|
| `action-overloaded` | 3 | 1 genuine (S35), 2 false positive |
| `contract-unusable` (S2) | 1 | False positive (see D) |
| `outcome-contradicts-progression` (S26) | 1 | Rule too strict (see D) |
| `relationship-change-uncorroborated` | 4 | **Genuine** — corroborated by social plan 1/3 |
| `dialogue-tight-for-shot` | 14 | Genuine as *information*; see J |

---

## H. Continuity — 25 warnings, most are noise

| Warning | Count | Verdict |
|---|---|---|
| Object state changes with no action | 10 | Mostly noise — "back door" ×6 across scenes where its state is simply not restated |
| Location changes on an unbroken join | 4 | **False positive** — S3, S10, S22, S23 all share their predecessor's `placeId`; prose comparison again |
| Screen direction flips | 4 | **False positive** (see G) |
| Held object disappears | 3 | **False positive — new class.** The "held prop" values are literally *"nothing in his hands"*, *"nothing, hands open at his sides"*. The validator is comparing a **description of emptiness** as though it were an object. |
| Time of day moves backwards | 2 | **False positive** — S29 (night) → S33 (dawn) is forward. The known missing `dayIndex`. |
| Character leaves without an exit | 2 | **False positive** — S3 Motu/Teeli are still on the shelf, out of a tighter two-shot. `framingTightened` failed because "medium" → "medium two-shot" doesn't register as tighter. |

**At least 15 of 25 warnings are demonstrably false.** The Continuity Director's signal-to-noise on this story is poor, and it is the single largest source of misleading output in the whole report.

---

## I. Story quality

**This is the best story the system has produced.**

**Premise (9/10).** A seed who wants to be *seen* can only grow by going *under the soil*. The want and the need are in direct **physical** opposition — you cannot state this theme without also filming it.

**Causality (9.5/10).** Airtight and ironic: Beeju performs on the shelf edge (S9) → the packet is lifted without him (S10) → the row is one seed short (S12–13) → that shortfall creates the eighth place (S29) → he fills it (S31). His flaw *creates* the opportunity that redeems him. The line *"Beeju wahan tha hi nahi"* (S13) reframes the entire first act.

**Character agency (9/10).** Every turn is his choice, including the disaster. Nothing happens *to* him that he did not cause.

**Arc (9/10).** Complete inversion, never narrated: S1 climbs out to be seen → S19 gets the light, alone, worthless → S30 gets total visibility and it is the obstacle → S31 covers himself with his own hands.

**Relationships (8/10).** Ankuri's withheld answer (S4) → finally given (S22: *"Aur teri awaaz suni. Woh company thi."*) is the emotional spine. Motu's payoff (S34) is superb: Beeju's chattering — irritating to the whole packet in Act 1 — becomes the thing that steadies a frightened seed in the dark. Roopa is thematically perfect but thin.

**Setup/payoff (9.5/10).** **7 planted, 7 paid**, each verified in text: sunbeam (S1→S19), the tin (S6→S25), the glass jar (S7→S17), "ek kam" (S12→S29→S33), the eighth place (S13→S29), Ankuri's new leaf (S4→S36), Beeju's chatter (S3→S34).

**Midpoint (9/10).** S13, at scene 13/36. **Low point (8.5/10).** S19–S20. **Climax (9/10).** S31 — he buries himself, talking, unwatched. **Resolution (9/10).** S33–S36, four scenes, image-led; the moral is never spoken.

**Ending compression (9/10).** 4/36 = 11%.

**One film, not 36 clips (9/10).** The counting motif, the two uses of *"Beeju dikh raha hai"*, and the voice continuing from under the soil in the final shot bind it.

**Overall: 8.5/10** — above the Inspector Kheera benchmark (8.3), far above the 4.5 repetitive baseline.

**Weakest dimensions:** dialogue density in Act 1 (S1–S7 all 71–82% speech), and the social-change data gap (1/3 planned turning points fulfilled).

---

## J. 10-second / Flow-Veo readiness

| Verdict | Count |
|---|---|
| Overruns | 1 (S22, 86%) |
| Tight (65–85%) | 14 |
| Comfortable | 14 |
| Underfilled | 5 |
| Silent | 2 |

**Only one scene exceeds the shot** — versus **35/36** in Inspector Kheera. That is the headline production improvement.

**The real risk is the 14 "tight" scenes, clustered in Act 1.** S1–S7 run 71–82% speech each. Individually fine; consecutively, seven near-wall-to-wall talking clips open the film with no room for visual performance. This is a *pacing* problem the per-scene checks cannot see, because each scene passes on its own.

**Genuine production blockers: one (S35).** The BLOCK is not a production blocker — it is a string-comparison artifact.

---

## K. Scenes genuinely needing attention

| Scene | Issue | Severity |
|---|---|---|
| **S35** | Five actions in a 10s establishing shot: shut door, turn key, climb cart, look back, drive away | **Real** |
| **S22** | 24 words = 86% of the shot, and it is the film's emotional turn — it needs pauses it does not have | **Real** |
| **S1–S7** | Seven consecutive scenes at 71–82% speech | **Real (pacing)** |
| **S2, S3, S16, S21** | Claim relationship change, emit no `socialChanges` | **Real (data)** |

**That is the complete list.** Every other finding in the report is detector noise.

---

## L. Comparison with previous evidence

| | Old baseline | Roshni (pre-P0) | Inspector (pre-P0) | Jahazi (post-P3) | **Chhota Beej (post-P4)** |
|---|---|---|---|---|---|
| Avg consecutive similarity | — | 0.254 | 0.273 | 0.262 | **0.242** |
| Repetition runs | many | 0 | 0 | 0 | **0** |
| Avg words/scene | — | 16.4 | **38.1** | — | **13.6** |
| Speech fraction | — | 59% | **136%** | — | **49%** |
| Dialogue overruns | — | 5 | **35/36** | — | **1** |
| Dominant turn count | — | 6 (67%) | 6 (92%) | 3.2 avg | **3 (36%)** |
| Beat density | n/a | degraded | degraded | 36/36, 0 stretch | **36/36, 0 stretch** |
| Contracts valid | n/a | n/a | n/a | 35/36 | **35/36** |
| Setups paid | — | 6/6 | — | — | **7/7** |
| Place concentration | — | 56% | 50% | 56% | **33%** |
| Story rating | 4.5 | 7.5 | 8.3 | — | **8.5** |

---

## M. What P0–P4 demonstrably improved

1. **Dialogue feasibility — decisive.** 35/36 overruns → **1**. Speech fraction 136% → **49%**. This was the top HIGH finding of the Roshni audit and it is fixed.
2. **The quota signature is gone.** 92% → 67% → **36%** at the dominant turn count.
3. **Silence is now used deliberately.** 2 silent + 5 underfilled scenes, each at a correct dramatic moment (S8 decision, S10 the packet taken, S15 the tray leaving).
4. **Performance types are real.** 7 types used, matching content, not rotated.
5. **Planned moves reach the scenes.** 36/36 coverage, 0 stretched beats — the P1/P3 chain works end to end.
6. **Contracts are honest**, not just well-formed — verified scene by scene.
7. **Visual variety.** Place concentration 56% → **33%**.
8. **Story quality rose** from 7.5 (Roshni) to **8.5**.

---

## N. What still fails

1. **The Continuity Director's prose comparisons** — `screenDirection`, `location`, `heldProps`, and the reframe guard. At least 15/25 warnings false.
2. **P4 promotes a false positive to `block`.** The most severe severity in the system currently fires on a repunctuated sentence.
3. **English staging vocabulary has gaps** — 5/36 scenes unmeasured, with a **misleading** explanation blaming language.
4. **The relocation counter over-counts one traverse** (S25).
5. **Act 1 dialogue clustering** — no check sees consecutive tightness.
6. **Social-change data is thin** — 1/3 planned turning points fulfilled.

---

## O. False positives / calibration problems discovered

| # | Problem | Evidence |
|---|---|---|
| **1** | `screenDirection` compared as prose | S21→S22 differ only by commas |
| **2** | `location` compared as prose on CHAIN | All 4 share the same `placeId` |
| **3** | `heldProps` treats "nothing in his hands" as an object | S2, S20, S25 |
| **4** | `framingTightened` misses "medium" → "medium two-shot" | S3 Motu/Teeli |
| **5** | `timeRank` has no day counter | S29 night → S33 dawn |
| **6** | Relocation counts waypoints of one traverse | S25: 3 relocations for one crawl |
| **7** | English staging vocabulary gaps | lean, call, hold, sprint, skid, stare, tip, press, count |
| **8** | Unclassified message blames language when the cause is vocabulary | all 5 scenes are English |
| **9** | `activity-as-progression` cannot tell "holds a position" from "holds an object" | S2 |
| **10** | `obstacle + achieved` treated as contradictory | S26 — a scene can do both |
| **11** | `dialogue-underfilled` fires on deliberate one-word beats | S10's *"...Beeju?"* is the whole point |

**Nine of the eleven are pre-existing validator defects that P4 surfaced. Two (6, 8) are P4's own.**

---

## P. Evidence-based recommendation for P5 scope

The evidence does **not** support building automatic repair next.

**Only one genuine production defect exists in 36 scenes (S35).** A repair pass would currently spend most of its API budget regenerating scenes that are already correct — S23 and S25 are false positives, and the BLOCK is entirely artifactual. Repair built on this signal would actively make the film worse.

**The measured priority order is:**

1. **Fix the false positives first.** Compare `placeId` not prose; compare `screenDirection` semantically (or drop it to `info` until it can be); ignore "nothing" as a held prop; fix the reframe rank; populate `dayIndex`. This is the single highest-value work available — it would remove ~15 of 25 continuity warnings and the entire BLOCK.
2. **Close the English vocabulary gap** and correct the misleading unclassified message.
3. **Fix the relocation traverse over-count.**
4. **Then** reconsider repair — against a signal that is trustworthy.

Put plainly: **the detectors are now louder than the problems.** The next phase should raise precision, not add automation on top of noise.

---

*Audit only. No code modified, no story regenerated, no API calls.*

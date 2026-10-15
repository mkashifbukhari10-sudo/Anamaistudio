# Evidence Audit — "Roshni Ke Diye" (36 scenes, Moral Story, 6 minutes)

**Date:** 2026-09-19
**Artifact:** `test-output/2026-09-18T20-49-16-997Z__complete__roshni-ke-diye.md`
**Method:** All 36 scenes read sequentially; P0/P1/P2 tooling run offline against the parsed report; no code modified, no API calls, nothing regenerated.

---

## 0. Two things that must be established before any conclusion

### 0.1 The attachment is not the story you named

You asked me to audit **"Inspector Kheera aur Gumshuda Cherry Tamatar."** The attached selection is **"Roshni Ke Diye"** — a different, *later* generation:

| Story | Generated | Mode |
|---|---|---|
| Chintu Matar | 2026-09-17 16:35 | Heartwarming, 6 scenes |
| Inspector Kheera | 2026-09-18 19:09 | Mystery, 36 scenes |
| **Roshni Ke Diye** | **2026-09-18 20:49** | **Moral Story, 36 scenes** |

Roshni Ke Diye is both the attachment and genuinely the latest. **I audited Roshni Ke Diye** and reference Inspector Kheera comparatively. If you meant the Mystery, say so and I will redo it.

### 0.2 This artifact cannot prove P0–P3 work, because it predates all of them

This is the single most important finding and it governs everything below.

**The story was generated on 2026-09-18. P0, P1, P2 and P3 were all implemented on 2026-09-19.** So was the Q5 dialogue correction.

Proof, from the artifact itself rather than from dates:

| Evidence | What it shows |
|---|---|
| Report contains no `## Beat density` section | P1 not present |
| Report contains no `## Scene contracts` / `## Scene execution` | P2, P3 not present |
| Report contains no `## Scene distinctiveness` / `## Dialogue feasibility` | P0 not present |
| Running P1 tooling on it: **`degraded: true`, 0/16 beats carry `whatEachSceneDoes`** | The beat sheet predates P1 |
| Running P2 tooling on it: **`degraded: true`, 0/36 scenes carry a contract** | The scenes predate P2 |
| Its Dialogue-density header still reads *"target 4-6 for a ten-second scene"* | Pre-Q5 wording |

**Therefore: nothing in this audit can confirm or refute P0–P3.** They remain entirely unproven against a model.

What this audit *can* do, and does, is two things worth having:

1. **Establish a measured baseline** — running the new tooling offline against real pre-improvement output, so the first post-P3 generation has something rigorous to be compared against.
2. **Judge the story on its merits**, which turns out to be more interesting than expected.

---

## 1. Measured baseline (new tooling, run offline on this story)

| Metric | Roshni Ke Diye | Inspector Kheera (for contrast) |
|---|---|---|
| **P0 avg consecutive similarity** | **0.254** (threshold 0.48) | 0.273 |
| **P0 flagged pairs** | **0** | 0 |
| **P0 repetition runs** | **0** | 0 |
| **P0 avg words/scene** | **16.4** (envelope 14–22) | 38.1 |
| **P0 speech fraction** | **0.59** | 1.36 |
| Overruns / tight / comfortable / underfilled / silent | 5 / 9 / 20 / 1 / 1 | 35 / 1 / 0 / 0 / 0 |
| **Turn-count std dev** | **1.14** | 0.28 |
| **Dominant turn count** | **6 turns in 24/36 scenes (67%)** | 6 turns in 33/36 (92%) |
| Place concentration | bhatti_kona 56%, aangan 33% | peti_kona 50% |
| Setups planted / paid off | **6 / 6** | 10 / ? |
| Continuity warnings / infos | 16 / 7, 10 scenes | — |
| Social plan fulfilled | 4/4 (11 unplanned) | — |
| `staticScenes` / `fillerSuspects` | **[] / []** | — |

**Read:** the repetition failure class is measurably **absent** from this story. Dialogue is far more speakable than the Mystery. But the 6-turn quota is still clearly visible at 67%.

---

## 2. The film as one continuous work

**Premise.** A potter family in Pipal Gali makes clay diyas for the Roshni Mela. The grandmother taps every diya on her thumbnail and listens; nobody has ever asked why. The mela is moved forward two days, a buyer puts 400 diyas and a clock on the household, and the granddaughter takes a shortcut that ruins the batch before it ever reaches the fire — then hides it.

**This is a strong premise.** The flaw is *physical and filmable* (half-kneaded clay, forced drying), the expertise is *visual and audible* (a ring versus a dull note), and the moral is baked into the craft rather than bolted on.

**Structure.**

| Scenes | Function |
|---|---|
| 1–4 | Establish the yard, the want (front shelf), the flaw in action |
| 5 | **Catalyst** — loudspeaker removes two days |
| 6–8 | Pressure internalised; commitment with a cost (400 by tomorrow) |
| 9–13 | The shortcut executes; three warnings overruled; Nani withdraws |
| 14–16 | Fire lit on unready clay; the household's exhaustion is the price |
| **17–18** | **Midpoint reversal** — a diya opens along a crack that predates the fire. Tamatar learns the batch is lost and says nothing |
| 19–21 | The cover-up becomes physical; blame re-planted on Mirchi |
| 22–25 | Public failure; the order is lost in silence |
| 26–27 | **Low point** — blame lands on the wrong child; Tamatar is thanked for work she ruined |
| 28–29 | Hope arrives with the skill handed over |
| **30** | **Climax** — she tells the truth, unprompted, in front of everyone |
| 31–34 | The yard works; she chooses the batch over her twelve peacock diyas |
| 35–36 | **Resolution**, two scenes |

The midpoint lands at scene 17–18 of 36 — almost exactly halfway. The low point is caused by the protagonist's flaw, not by accident or a villain. The climax is a **choice**, not an event. The resolution is **2 scenes out of 36 (5.6%)**.

**That last number matters.** The previously identified failure class included stretched celebrations. This film's ending is *compressed*, and the moral is never spoken aloud by any character.

**Causality.** The strongest dimension. The chain is airtight and physical:

> hurry (S4) → clay half-kneaded, diyas dried in full sun (S4) → dried further at the kiln mouth (S10) → dull note when tapped (S12) → warning overruled (S12–13) → fired hot the same night (S14) → cracks that predate the fire (S18) → public failure (S24)

Every link is *shown*, not stated. Nothing in the failure is coincidence or weather — and when Kaddu tries to blame the wood and the rain in S26, the audience already knows better. That is dramatic irony working properly.

---

## 3. Scene-by-scene necessity

Format: **change produced** → verdict.

| # | What changes | Necessary? | Notes |
|---|---|---|---|
| 1 | Want planted (front shelf); tap-test and Nani's hands planted | **Yes** | Efficient: world, want and two setups in 10s |
| 2 | Household shown at work; count planted; uneven peacock line planted | **Yes** | 40 action words — dense (§5) |
| 3 | Want stated aloud and granted; the slow peacock diya planted | **Yes** | This diya survives to S36 |
| 4 | The flaw executes; blame lands on Mirchi; tray planted | **Yes** | Best "show don't tell" in the film |
| 5 | **Catalyst** — two days removed | **Yes** | 28 words = 10.0s speech (§5) |
| 6 | Pressure moves inside the yard; Tamatar promises the batch | **Weak** | Kaddu says "Parson." twice more. Its unique content is one decision made in the body. **Softest scene in the film** |
| 7 | Commitment with a cost: 400 diyas, a clock, answered for everyone | **Yes** | 36 words = 12.9s — **worst overrun** |
| 8 | Tamatar claims the twelve by name; Nani's "Bhatti" unheard | **Yes** | |
| 9 | Making becomes counting; Baingan overruled (1st) | **Yes** | |
| 10 | Diyas dried at the kiln mouth — the batch is now lost | **Yes** | Pivotal and only 13 words. Correct restraint |
| 11 | Count reaches target; twelve laid on the ledge and covered | **Partly** | Baingan overruled again; largely repeats S9's dynamic. Justified only by the covered-ledge plant |
| 12 | **The dull note.** Last cheap chance lost | **Yes** | Pays off S1's tap test in negative |
| 13 | Nani spoken over a third time; she leaves the yard | **Yes** | Relationship break |
| 14 | Kiln lit on unready clay; Tamatar takes the fire | **Yes** | |
| 15 | She refuses to fetch Nani | **Yes** | Pride made explicit; 5 turns not 6 |
| 16 | Exhaustion established; child asleep in the cold | **Soft** | Unique content is thin; could compress with S15 |
| 17 | Nani returns in the dark and asks for the stack | **Yes** | 4 turns — density correctly drops |
| 18 | **Midpoint reversal.** Crack predates the fire; Tamatar hides it | **Yes** | 6 words total. Excellent restraint |
| 19 | Cover-up begins; Baingan chooses to cover for her daughter | **Yes** | |
| 20 | Evidence buried; tray set out where Mirchi will be blamed | **Yes** | **Silent scene, correctly** — but 43 action words (§5) |
| 21 | Blame re-planted on Mirchi without a word of accusation | **Yes** | Only 10 words; correct |
| 22 | Mooli arrives early with a cart | **Yes** | 31 words = 11.1s (§5) |
| 23 | Kaddu lifts the cloth himself, proudly | **Yes** | The reveal is taken out of Tamatar's control — a good choice |
| 24 | Public failure; Mooli cannot finish her conditional | **Yes** | |
| 25 | Order lost; Mooli leaves in silence | **Yes** | 4 words — **correct** under-fill, not a fault |
| 26 | **Low point A** — blame assembled and laid on Mirchi again | **Yes** | |
| 27 | **Low point B** — Tamatar thanked for the work she ruined | **Yes** | Strongest emotional beat in the film |
| 28 | Nani sits down inside the problem; clay offered | **Yes** | |
| 29 | The skill is handed over; the count is taught | **Yes** | |
| 30 | **Climax** — the truth told; Mirchi exonerated; Kaddu swallows his shout | **Yes** | 25 words including a 4-line confession (§5) |
| 31 | The yard redistributes itself without instruction | **Yes** | |
| 32 | The choice: the batch over her twelve. Never announced | **Yes** | Want surrendered silently — excellent |
| 33 | Routine changes hands; Nani's hands rest | **Yes** | Pays off S1 |
| 34 | Tamatar taps every diya herself | **Yes** | Pays off S2 |
| 35 | Mooli buys without a condition | **Yes** | Pays off S7 by absence |
| 36 | Final image: the slow diya at the front; Mirchi carries the tray whole | **Yes** | Three payoffs, nothing explained |

**Removable without hurting the film: S6.** **Compressible: S11 into S9, S16 into S15.** That is 1 clear cut and 2 merges out of 36 — roughly **8% soft**, which is good for long-form generated output.

`staticScenes` and `fillerSuspects` both came back **empty**, and having read all 36 I agree with that verdict within its limits.

---

## 4. Verifying the quality architecture against output

**Rule applied: a system is only credited if the output proves it.**

| System | Status | Evidence |
|---|---|---|
| **Narrative Progression** | ⚠️ **Not verifiable** | P2 contracts absent (0/36). Progression exists in the *prose* `storyFunction` and is genuinely good, but nothing machine-readable. This is exactly the gap P2 was built to close — and it is the gap P2 remains unproven against. |
| **Scene Necessity / Anti-Filler** | ✅ **Working, by older means** | 0 static scenes, 0 filler suspects, and my manual read found only 1 removable scene. But this was achieved by the blueprint/craft doctrine, **not** by P0–P3. |
| **Choice → Consequence** | ✅ **Working** | Not as a tracked system (that is P4, unbuilt) but *in the writing*: S4's blame → S21 re-plant → S26 second blame → S30 exoneration is a four-scene consequence chain that lands. |
| **Character Arc enforcement** | ⚠️ **Partial** | Four real arcs (Tamatar, Pyaz, Kaddu, Mirchi). **Baingan does not change** — her final line in S36 is the same hedge she opens with, and nothing marks that as deliberate. Nothing enforces or measures arc completion. |
| **Setup / payoff tracking** | ✅ **Proven** | 6 planted, **6 paid off**, and I verified each one in the scene text rather than trusting the ±1-window check: tap-test (S2→S34), slow peacock diya (S3→S36), counting tray (S4→S36), Nani's count (S2→S32), Mooli's conditional (S7→S35), Nani's hands (S1→S33). **All six genuinely land.** This is the strongest proven system in the audit. |
| **Escalation** | ✅ **Working** | Cost ratchets: two days → 400 diyas → a night's sleep → the order → a child's good name → the want itself. Slight plateau S9–S11. |
| **Resolution compression** | ✅ **Proven** | 2 scenes of 36 (5.6%). No stretched celebration. Directly contradicts the old failure class. |
| **Continuity** | ⚠️ **Mixed — mostly false positives** | 16 warnings. Breakdown in §7. |
| **Story Quality Gate** | ❌ **Does not exist yet** | P4. Nothing in this run gated, scored or repaired anything. |

---

## 5. Ten-second performance audit (all 36 scenes)

Rate used: **2.8 words/sec**, envelope **≤18 words comfortable, ≤24 ceiling**.

### 5.1 Dialogue overruns — speech alone exceeds the shot

| Scene | Turns | Words | Speech | % of shot | Also required physically |
|---|---|---|---|---|---|
| **S7** | 6 | **36** | **12.9s** | **129%** | Mooli snaps an accounts book open; Kaddu stands facing her; Tamatar steps out of a door behind him |
| **S22** | 6 | 31 | 11.1s | 111% | Mooli enters through a gate, crosses to the middle of the yard, stops; Kaddu steps forward |
| **S5** | 6 | 28 | 10.0s | 100% | Kaddu straightens from a wood bundle, walks to the middle of the lane, stands still; loudspeaker repeats |
| **S2** | 6 | 25 | 8.9s | 89% | Baingan takes a diya, turns it to the light, runs a thumb along the edge; Kaddu pugs clay; Mirchi swings on a rope |
| **S30** | 6 | 25 | 8.9s | 89% | Tamatar crosses to centre; Kaddu opens his mouth, closes it, lowers himself to the ground |

**S7 is impossible.** 12.9 seconds of speech in a 10-second clip, before any action.

**S30 is the more serious problem.** It is the climax. Tamatar's confession is four separate statements that need *air* between them — that is the entire point of the beat — and the scene has 8.9s of speech plus Kaddu's three-stage physical reaction. The most important ten seconds in the film is the one with the least room to breathe.

### 5.2 Action overload — too many distinct physical beats for one clip

Veo generates **one primary visual beat** per clip. These request three or four:

| Scene | Action words | Distinct beats requested |
|---|---|---|
| **S20** | **43** | slides diyas to the back → carries an armful across the yard → pushes them under a wood stack → sets the tray down in the open. **Four locations of action.** |
| **S13** | 44 | Kaddu steps between two women → sets a bucket down → Pyaz lowers a diya → lifts a thali → walks out of the yard |
| **S9** | 42 | Tamatar walks the full plank in five strides → lifts diyas out → lays them at speed → Kaddu holds a tape → Baingan holds a brush |
| **S8** | 41 | Kaddu lowers off a plank → Tamatar names her twelve → Pyaz speaks from a doorway → steps back inside |

**S20 is the sharpest irony in the audit:** it is the one scene that correctly chose silence, and it is the most physically overloaded scene in the film. Silence was used to buy room for *four* actions instead of one.

### 5.3 Correctly judged scenes

Not every low-dialogue scene is a fault, and the report should say so:

- **S25** (4 words): Mooli walks out in silence past the tray. The under-fill *is* the beat. **Correct.**
- **S20** (0 words): a cover-up needs no dialogue. **Silence correct**, action wrong.
- **S18** (6 words): the midpoint reversal, almost wordless. **Excellent.**
- **S17** (10 words), **S21** (10), **S36** (8): density drops exactly where the drama wants quiet.

**This is the most encouraging finding in the whole audit.** Despite a prompt demanding 4–6 turns everywhere, the model dropped to 4 turns and to silence *precisely at the reversal, the cover-up, the exit and the final image*. Good instinct was leaking through a bad rule.

### 5.4 Summary

- **5 scenes cannot be performed as written** (dialogue overrun)
- **9 scenes are tight** (65–85% speech)
- **4 scenes are action-overloaded** independent of dialogue
- **20 scenes are comfortable**
- **2 scenes are correctly quiet**

---

## 6. Dialogue, quantitative and qualitative

### 6.1 Voice distinctness — the standout success

Every character has a **mechanical** rule, not an adjective:

| Character | Rule | Lines |
|---|---|---|
| Pyaz (Nani) | Single words only: *"Tap." "Suno." "Dhair." "Baith."* | 22 (11%) |
| Baingan | Hedge + tag question: *"Dekho… X, hai na?"* | 33 (17%) |
| Kaddu | Echoes the other person's noun flatly: *"Parson." "Chaar sau." "Khatam."* | 40 (21%) |
| Mirchi | One-word questions: *"Taabi?" "Garam?" "Andar?"* | 14 (7%) |
| Mooli | Everything as a conditional: *"Agar… to…"* | 11 (6%) |
| Tamatar | Catchphrase: *"Main sambhaal loongi"* | 73 (37%) |

Strip the names and you can still tell who is speaking. The `voiceSignature` system is working **extremely** well — this is the best-evidenced success in the audit.

**Craft highlight:** Tamatar's catchphrase appears in S3, S8, S18, S27 — and S27's `storyFunction` explicitly notes it comes out *"emptied of meaning"*, so that her plain *"Maine kiya"* in S30 lands as a break. That is deliberate, tracked, and it works.

### 6.2 Repetition — mostly motif, partly monotony

The exact-repeat list looks alarming until you read it:

| Repeated | Count | Verdict |
|---|---|---|
| "Tap" | 8 | **Motif.** Pyaz's entire voice; the film's central image |
| "Taabi?" | 7 | **Motif.** Mirchi's blame thread |
| "Dekho" | 6 | **Voice signature** |
| "Suno" | 5 | **Motif.** Pays off in S36's *"Sun rahi hoon"* |
| "Main sambhaal loongi" | 4 | **Deliberate**, and broken on purpose |
| **"Parson" ×4 (S5–S6)** | 4 | ⚠️ **Monotony.** Kaddu says it twice in S5 and twice in S6 |
| "Chaar sau" | 3 | Borderline |

**The real dialogue problem is not repetition — it is that some voices are too mechanical to sustain.** Kaddu speaks 40 lines and almost all of them are one- or two-word echoes. Across a 6-minute film that stops reading as character and starts reading as a tic.

### 6.3 Other checks

- **Exposition:** minimal. Nobody explains the clay process; it is shown.
- **Moral stated aloud:** **no.** The moral exists only in metadata. S36 ends on an image and four words.
- **Dialogue describing visible action:** rare. S10's *"Garam?" / "Door raho"* is the only clear instance.
- **Generic motivational filler:** **none found.** No "hum kar sakte hain" register anywhere.
- **Speaker balance:** Tamatar 37% is high but she is in 100% of scenes and drives the film.

---

## 7. Flow/Veo production readiness

### 7.1 Continuity: 16 warnings — and most are validator faults, not story faults

| Warning | Count | My verdict |
|---|---|---|
| **Camera: screen direction flips across an unbroken join** | **7** | ✅ **REAL AND SERIOUS** |
| Location changes on an unbroken join | 4 | ❌ **False positive** |
| Time of day moves backwards | 3 | ❌ **False positive** |
| Object state changes with no action | 1 | Likely real |
| Character leaves without an exit | 1 | Likely real |

**The 4 "location changes on a CHAIN" are false positives.** Every CHAIN scene (11, 13, 15, 18, 20, 21, 24) sits in `place_bhatti_kona` — the `placeId` never changes. The validator compares the *prose* `location` string, which legitimately varies ("Bhatti kona, at the kiln mouth" vs "…at the cooling ledge"). The same root cause produces the fact report's *"Place identity drifts"* warnings for S2/S3/S4, where `place_aangan` is described as "under the neem tree", then "at the drying plank along the south wall". **Same place, different corner of it — correctly written, wrongly flagged.**

**The 3 "time moves backwards" are false positives.** The film legitimately runs morning → night → midnight → first light → next night → sunrise. The `timeRank` check has no day counter. The `StoryTimeMarker` / `dayIndex` design that fixes this was specified in the Life Journey plan and the type exists in `types.ts` — **but it is never populated by the scene pipeline.** Designed, not wired.

**The 7 screen-direction flips are real and they matter.** A CHAIN join requires the previous clip's last frame to be uploaded as this clip's first frame. If screen direction reverses across that join, the frame handoff is physically impossible and the operator will get a jump. This is the most actionable production finding in the audit.

### 7.2 Clip assembly

- **Prompt length:** 2.6k–5.1k characters. Long, but that is the deliberate self-contained design.
- **Prompts are self-contained:** no cross-scene references found.
- **CHAIN usage:** 7 of 36 (19%). All within one place. Reasonable restraint.
- **Character consistency:** locked visual descriptions restated per prompt, as designed.
- **Visual variety:** 89% of the film is two locations (kiln corner 56%, courtyard 33%). Defensible for a domestic story, but 20 consecutive-ish scenes in one corner is a real risk of visual monotony across assembled clips — and the distinctiveness engine deliberately weights place *low*, so it will never flag this.
- **One primary visual beat:** **violated in at least 4 scenes** (§5.2).

---

## 8. Against the previously identified failure class

The old class: *repeated scenes, repeated dialogue, static progression, technically valid but dramatically unnecessary clips.*

| Symptom | Present? | Evidence |
|---|---|---|
| Near-duplicate consecutive scenes | **No** | 0 flagged pairs, 0 runs, avg similarity 0.254 vs 0.48 threshold |
| Repeated dialogue as filler | **No** | Repeats are motifs with tracked payoffs |
| Static progression | **No** | `staticScenes: []`; manual read confirms |
| Dramatically unnecessary clips | **Almost none** | 1 removable (S6), 2 compressible |
| Stretched resolution | **No** | 2 scenes of 36 |

**The underlying failure class is genuinely absent from this story.**

Two honest caveats:

1. **n = 1**, and this is a Moral Story — a mode whose doctrine pushes hardest toward earned consequence. Inspector Kheera (Mystery) also scored clean on repetition, which helps, but two stories in two modes is not proof across eleven modes.
2. **This was achieved by the pre-P0 architecture** — the blueprint's causal beat spine, the craft doctrine, `voiceSignature`, setup/payoff. **P0–P3 contributed nothing to this output.** The repetition detectors were built to catch a failure that, on this evidence, the *planning* layer had already largely solved.

That is worth sitting with: the detectors may be guarding a door that the blueprint already closed. Their value will be in catching regressions and in modes not yet tested — not in fixing a live problem.

---

## 9. Ratings (strict)

| Dimension | Score | Justification |
|---|---|---|
| Core premise | **8.0** | Specific, filmable, culturally grounded; flaw is physical not psychological. Not highly original |
| Story structure | **8.5** | Midpoint at 17/36, flaw-caused low point, choice-driven climax, compressed ending |
| Narrative progression | **8.0** | Nearly every scene turns something; verified by reading all 36 |
| Causality | **9.0** | Airtight physical chain; dramatic irony in S26 earned properly |
| Character agency | **9.0** | Protagonist causes the disaster, the cover-up, and the recovery |
| Character arcs | **7.0** | Four real arcs; **Baingan static and unmarked** |
| Relationships | **8.0** | Tamatar↔Pyaz excellent; Mirchi thread lands |
| Dialogue | **7.5** | Outstanding distinctness; mechanically monotone in places; 5 unspeakable scenes |
| Emotional progression | **8.0** | S27 (thanked for ruined work) is a genuinely sophisticated beat |
| Escalation | **8.0** | Steady ratchet; plateau S9–S11 |
| Setup / payoff | **9.0** | 6/6, manually verified in text |
| Scene necessity | **7.0** | 1 removable, 2 compressible |
| Anti-repetition | **8.0** | 0 flagged pairs; but 67% of scenes at exactly 6 turns |
| Pacing | **7.5** | Good; slack at S9–S11 and S15–S16 |
| **10-second performance feasibility** | **5.0** | **5 overruns, 9 tight, 4 action-overloaded. Weakest dimension** |
| Continuity | **6.5** | 7 real CHAIN screen-direction flips; 7 validator false positives |
| Climax | **8.0** | Right beat, right form — but overloaded to perform |
| Resolution | **8.5** | Two scenes, image-led, moral unspoken |
| Flow/Veo readiness | **6.0** | Self-contained prompts; broken frame handoffs; multi-beat clips; 2-location film |
| **Overall film experience** | **7.5** | A good film with a production problem, not a story problem |

---

## 10. Issues by severity

### BLOCKER
*(none — nothing prevents this from being produced)*

### HIGH

| # | Issue | Evidence |
|---|---|---|
| H1 | **Dialogue exceeds performable length in 5 scenes** | S7 129%, S22 111%, S5 100%, S2 89%, S30 89% |
| H2 | **The climax is the least performable important scene** | S30: 25 words including a 4-beat confession + Kaddu's 3-stage reaction |
| H3 | **CHAIN joins with reversed screen direction** | 7 occurrences; frame handoff physically impossible |
| H4 | **Action overload — 3–4 distinct beats per clip** | S20 (43 action words, 4 beats), S13 (44), S9 (42), S8 (41) |

### MEDIUM

| # | Issue | Evidence |
|---|---|---|
| M1 | **Uniform dialogue density** | 24/36 scenes at exactly 6 turns; std dev 1.14 |
| M2 | **Baingan has no arc** | Same hedge in S2 and S36; nothing marks it deliberate |
| M3 | **Validator false positives** — prose location comparison | 4 CHAIN + 3 fact-report warnings on stable `placeId`s |
| M4 | **Validator false positives** — overnight time | 3 warnings; `dayIndex` designed but never wired |
| M5 | **Soft scenes** | S6 removable; S11, S16 compressible |
| M6 | **Two locations carry 89% of the film** | Distinctiveness weights place low by design, so it will never flag this |

### LOW

| # | Issue |
|---|---|
| L1 | Kaddu's voice (40 echo lines) tips from character into tic |
| L2 | "Parson" ×4 across S5–S6 |
| L3 | S9–S11 escalation plateau |
| L4 | Fact-report info: entities cared for by non-cast |

---

## 11. Conclusions

### What is PROVEN fixed

- **The repetition failure class.** 0 flagged pairs, 0 runs, 0 static scenes, across 36 scenes, confirmed by manual reading.
- **Setup/payoff.** 6/6, each verified in the text.
- **Resolution compression.** 5.6% of runtime.
- **Voice distinctness.** Six mechanically separable voices.
- **Moral not stated aloud.**

**Crucial qualifier: all of this was achieved by the pre-P0 architecture.** P0–P3 are *not* proven by this artifact and contributed nothing to it.

### What is only PARTIALLY fixed

- **Dialogue density.** Average 16.4 words is inside the envelope, but 67% of scenes sit at the old quota of exactly 6 turns. The Q5 correction is not in this output.
- **Scene necessity.** ~92% of scenes earn their place; three do not.
- **Continuity reporting.** The validators fire, but roughly half of what they report is noise.

### What STILL FAILS

- **Ten-second performance feasibility** — the weakest dimension at 5.0/10.
- **Action density per clip** — not measured by anything currently built, in any phase.
- **CHAIN screen-direction integrity** — detected, reported, never acted on.
- **Arc completion** — not measured at all.

### What prevents this from being a genuine 9+

In order of impact:

1. **Performance feasibility (H1, H2, H4).** A 9/10 film has to be *producible*. Five scenes cannot be spoken in their shot and four cannot be staged as one beat. The climax is among both.
2. **CHAIN handoff breakage (H3).** Seven joins that cannot be assembled as designed.
3. **Baingan's flat arc (M2).** One of six characters ends exactly where she started, with nothing signalling intent.
4. **Three soft scenes (M5).**
5. **Mechanical voice monotony (L1).**

### STORY vs SCENE EXECUTION vs FLOW/VEO

| Category | Issues |
|---|---|
| **STORY problems** | M2 (Baingan's arc), M5 (S6/S11/S16), L3 (S9–S11 plateau) — **3 issues, all MEDIUM/LOW** |
| **SCENE EXECUTION problems** | H1, H2, M1, L1, L2 — dialogue length, density uniformity, voice monotony |
| **FLOW/VEO production problems** | H3, H4, M6 — screen direction, action density, location concentration |
| **VALIDATOR problems** | M3, M4 — false positives that will mask real findings |

**The story layer is in good shape. The failures are concentrated in execution and production.**

### What kind of fix does each need?

| Issue | Already addressed? | Fix type |
|---|---|---|
| H1 dialogue overruns | **Yes — Q5 + P3**, unproven | Verify with a real generation |
| H2 climax overload | Partly — P3 choreography | Prompt + possibly a per-scene weight check |
| **H3 CHAIN screen direction** | Detected since before P0, never surfaced | **Validator → gate (P4)**. The finding exists; nothing consumes it |
| **H4 action density** | **No. Not covered by any phase** | **New measure.** Architecture + validator. The closest analogue is the speakability envelope — an *action* envelope is the missing twin |
| M1 uniform density | **Yes — Q5 + P3**, unproven | Verify; `turnsStdDev` already measures it |
| **M2 arc completion** | **No** | Validator (P4 metric) + prompt |
| **M3 prose location drift** | No | **Validator fix** — compare `placeId`, not prose |
| **M4 overnight time** | Designed (`StoryTimeMarker`), never wired | **Implementation gap** — populate `scene.storyTime` |
| M6 location concentration | Measured, deliberately unweighted | Tuning / report-only, probably correct as-is |

**Summary of fix types:** two need **new architecture** (H4 action density, M2 arc completion), two need **validator corrections** (M3, M4), one needs **wiring work already designed** (M4), one needs a **gate to consume an existing finding** (H3), and the rest are **already implemented but unverified** (H1, M1).

---

## 12. The single most important recommendation

**Generate one story with P0–P3 active before building anything else.**

Everything in §11 that is marked "already addressed but unproven" — the dialogue overruns, the density uniformity, the progression rail, the planned-move delivery, the contract honesty — resolves to *the same unknown*. This audit could not test any of it because the artifact predates all of it.

A single post-P3 generation would produce, for the first time: a **Beat density** section, a **Scene contracts** section, a **Scene distinctiveness** section, a **Dialogue feasibility** table and a **Scene execution** table. That artifact would answer more open questions than any further analysis of pre-P3 output can.

The baseline in §1 is recorded here specifically so that comparison is possible.

---

*Audit only. No code modified, no story regenerated, no API calls, no tokens spent.*

import { Type } from "@google/genai";

/**
 * STORY INTELLIGENCE / CINEMATIC DIRECTOR ENGINE
 *
 * Story first, scenes second. Before a single shot is planned, the pipeline
 * commissions a narrative blueprint: cast with wants/needs/flaws, relationships
 * that evolve, a causal beat sheet, and planted setups with payoffs.
 *
 * Everything here is CONSUMED by the generation pipeline:
 *   - the blueprint is generated in its own phase (server.ts, Phase 1A)
 *   - the Character Bible + screenplay phase is written against it (Phase 1B)
 *   - every scene batch receives a scoped slice plus long-term story memory
 *   - the finished timeline is measured against it (quality report)
 *
 * Nothing in this file is decorative prompt text.
 */

// ---------------------------------------------------------------------------
// Adaptive scale: cast size and beat count follow the runtime, never a default.
// ---------------------------------------------------------------------------

export interface CastTarget {
  min: number;
  max: number;
}

/** A meaningful cast sized to the story, never a hardcoded pair. */
export function targetCastSize(sceneCount: number): CastTarget {
  if (sceneCount <= 6) return { min: 2, max: 3 };
  if (sceneCount <= 9) return { min: 3, max: 4 };
  if (sceneCount <= 12) return { min: 3, max: 5 };
  if (sceneCount <= 24) return { min: 4, max: 6 };
  if (sceneCount <= 36) return { min: 5, max: 7 };
  return { min: 5, max: 8 };
}

/**
 * Beat budget. The 18-beat spine is a ceiling and a vocabulary, not a quota:
 * shorter runtimes use fewer, and every beat must earn its place.
 */
export function targetBeatCount(sceneCount: number): number {
  if (sceneCount <= 6) return 6;
  if (sceneCount <= 9) return 8;
  if (sceneCount <= 12) return 10;
  if (sceneCount <= 24) return 14;
  if (sceneCount <= 36) return 16;
  return 18;
}

/**
 * The adaptable spine. Offered as craft vocabulary the director may merge,
 * reorder or omit - explicitly NOT a checklist to fill.
 */
const BEAT_SPINE = [
  "Opening Image - the world and its everyday rhythm",
  "Character Introduction - who wants what, and the flaw that will cost them",
  "Relationship Baseline - how the cast treats each other before pressure",
  "Catalyst - the event that breaks the ordinary",
  "Refusal / Hesitation - the flaw resists the call",
  "Commitment - a choice with a cost",
  "Trials - early attempts that partly work",
  "Relationship Strain - the first crack between characters",
  "Midpoint Reversal - the story's understanding of the problem changes",
  "Escalation - stakes compound from the midpoint decision",
  "Complication - an earlier choice comes back",
  "Setback - the plan fails for a reason the flaw caused",
  "Emotional Low Point - what the character fears most becomes true",
  "Spark of Hope - a planted element returns and reframes the problem",
  "Gathering - the cast reunites, changed",
  "Climax - the flaw is faced directly under maximum pressure",
  "Resolution - the cost paid and the need met",
  "Epilogue Image - the world echoed back, visibly different",
];

// ---------------------------------------------------------------------------
// Blueprint schema (Phase 1A structured output)
// ---------------------------------------------------------------------------

export const BLUEPRINT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    logline: { type: Type.STRING, description: "One sentence: protagonist, want, obstacle, stakes" },
    theme: { type: Type.STRING, description: "The human truth the story argues for" },
    centralQuestion: { type: Type.STRING, description: "The dramatic question answered by the climax" },
    toneKeywords: { type: Type.STRING, description: "Three to five words describing tone" },
    castPlan: {
      type: Type.ARRAY,
      description: "Every character the story genuinely needs, each with a distinct dramatic function",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          veggieType: { type: Type.STRING },
          importance: { type: Type.STRING, description: "MAIN, SUPPORTING or MINOR" },
          narrativePurpose: { type: Type.STRING, description: "Why the story collapses without them" },
          want: { type: Type.STRING, description: "External, visible goal" },
          need: { type: Type.STRING, description: "Internal truth they must learn" },
          flaw: { type: Type.STRING, description: "The trait that causes the setback" },
          strength: { type: Type.STRING },
          voiceSignature: {
            type: Type.STRING,
            description: "How this character's dialogue is recognisable without a name tag: vocabulary, sentence length, rhythm, verbal habits",
          },
          arcStart: { type: Type.STRING },
          arcMidpoint: { type: Type.STRING },
          arcEnd: { type: Type.STRING },
          approxDialogueShare: { type: Type.INTEGER, description: "Rough percentage of spoken lines, all characters summing to about 100" },
        },
        required: ["name", "veggieType", "importance", "narrativePurpose", "want", "need", "flaw", "voiceSignature", "arcStart", "arcMidpoint", "arcEnd", "approxDialogueShare"],
      },
    },
    relationships: {
      type: Type.ARRAY,
      description: "Pairings that visibly change over the runtime",
      items: {
        type: Type.OBJECT,
        properties: {
          characterA: { type: Type.STRING },
          characterB: { type: Type.STRING },
          startingDynamic: { type: Type.STRING },
          sourceOfFriction: { type: Type.STRING },
          turningPointBeat: { type: Type.INTEGER, description: "Beat number where the dynamic shifts" },
          howItEvolves: { type: Type.STRING, description: "The staged progression, not a summary" },
          endingDynamic: { type: Type.STRING },
        },
        required: ["characterA", "characterB", "startingDynamic", "sourceOfFriction", "turningPointBeat", "howItEvolves", "endingDynamic"],
      },
    },
    beats: {
      type: Type.ARRAY,
      description: "The causal spine. Each beat is caused by the previous one.",
      items: {
        type: Type.OBJECT,
        properties: {
          beatNumber: { type: Type.INTEGER },
          name: { type: Type.STRING, description: "Named for THIS story, not a generic label" },
          chapterNumber: { type: Type.INTEGER },
          sceneStart: { type: Type.INTEGER },
          sceneEnd: { type: Type.INTEGER },
          purpose: { type: Type.STRING },
          causeFromPrevious: { type: Type.STRING, description: "The specific prior event that forces this beat" },
          consequence: { type: Type.STRING, description: "What this beat makes unavoidable next" },
          escalation: { type: Type.STRING, description: "How pressure is higher than the previous beat" },
          emotionalTemperature: { type: Type.STRING },
          charactersInFocus: { type: Type.ARRAY, items: { type: Type.STRING } },
          relationshipShift: { type: Type.STRING },
        },
        required: ["beatNumber", "name", "chapterNumber", "sceneStart", "sceneEnd", "purpose", "causeFromPrevious", "consequence", "escalation", "emotionalTemperature", "charactersInFocus"],
      },
    },
    setups: {
      type: Type.ARRAY,
      description: "Foreshadowing: props, images, lines or promises planted early and paid off later",
      items: {
        type: Type.OBJECT,
        properties: {
          element: { type: Type.STRING },
          type: { type: Type.STRING, description: "prop, line, image or promise" },
          plantScene: { type: Type.INTEGER },
          payoffScene: { type: Type.INTEGER },
          meaning: { type: Type.STRING, description: "What it means differently at payoff than at planting" },
        },
        required: ["element", "type", "plantScene", "payoffScene", "meaning"],
      },
    },
    chapters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapterNumber: { type: Type.INTEGER },
          title: { type: Type.STRING },
          sceneRange: { type: Type.STRING, description: "e.g. 13-24" },
          summary: { type: Type.STRING },
          beatNumbers: { type: Type.ARRAY, items: { type: Type.INTEGER } },
        },
        required: ["chapterNumber", "title", "sceneRange", "summary"],
      },
    },
  },
  required: ["logline", "theme", "centralQuestion", "castPlan", "relationships", "beats", "setups", "chapters"],
};

// ---------------------------------------------------------------------------
// Phase 1A prompts
// ---------------------------------------------------------------------------

export interface BlueprintContext {
  topic: string;
  language: string;
  duration: string;
  storyMode: string;
  animationStyle: string;
  targetSceneCount: number;
  numChapters: number;
  lockedCharacters?: any[];
}

export function buildBlueprintSystemInstruction(ctx: BlueprintContext): string {
  const cast = targetCastSize(ctx.targetSceneCount);
  const beats = targetBeatCount(ctx.targetSceneCount);

  return `You are a master animation story architect - the story department that works BEFORE any shot is planned. You are writing the structural blueprint for a ${ctx.duration} animated children's film ("${ctx.storyMode}" mode) told with anthropomorphic vegetable characters.

You are NOT writing scenes. You are deciding what the story IS, who it needs, and why each moment causes the next.

==================================================
1. CAST - SIZED BY THE STORY, NEVER BY DEFAULT
==================================================
- This runtime (${ctx.targetSceneCount} scenes) needs ${cast.min} to ${cast.max} characters.
- NEVER default to two characters. A duo is only correct if the story is genuinely about exactly two people.
- Every character must answer: "what collapses if I remove them?" Delete anyone who is decoration.
- Classify each as MAIN (drives the spine), SUPPORTING (changes the outcome at least once) or MINOR (colours the world, appears in a handful of scenes).
- Give every MAIN and SUPPORTING character a WANT (external, visible, actable) and a NEED (the internal truth they resist), plus a FLAW that will directly cause the setback later.
- Give every character a VOICE SIGNATURE: how their lines are recognisable with the name removed - vocabulary, sentence length, rhythm, a verbal habit. Two characters must never be interchangeable.
- Assign each an approximate dialogue share. MAIN characters do not have to split lines evenly, but no character with speaking presence may be silent for the whole middle of the film.

==================================================
2. RELATIONSHIPS THAT EVOLVE
==================================================
- Define the pairings that carry the emotional load.
- Each must have a starting dynamic, a genuine source of friction, a beat where it turns, and a different ending dynamic.
- "They are friends and stay friends" is not a relationship arc. Something between them must be tested and come out changed.

==================================================
3. CAUSAL BEAT SPINE (${beats} BEATS - ADAPTABLE, NOT FORMULAIC)
==================================================
Craft vocabulary you may merge, reorder, or omit as this story requires:
${BEAT_SPINE.map((b, i) => `  ${i + 1}. ${b}`).join("\n")}

RULES:
- Aim for about ${beats} beats. Use FEWER if the story is complete without them. Never invent a beat to hit a number - an unnecessary beat becomes filler.
- Name each beat for THIS story ("The Watering Can Runs Dry"), never with the generic label above.
- Every beat states causeFromPrevious: the specific earlier EVENT that forces it. "Then they went to the pond" is not causation. "Because the pipe burst in beat 3, the pond is now their only water" is.
- Every beat states its consequence: what it makes unavoidable next.
- Every beat states escalation: how pressure, cost or risk is higher than the beat before. Stakes must ratchet, never plateau.
- Assign each beat a scene range. Ranges must be contiguous and must cover scenes 1 to ${ctx.targetSceneCount} exactly once, with no gaps or overlaps.
- The midpoint must genuinely REVERSE something - what the characters believe the problem is, or who they think can solve it. It is not merely "the middle".
- The emotional low point must be caused by a MAIN character's flaw, not by bad luck or a random villain.
- No random twists. Any surprise must be inevitable in hindsight because it was planted earlier.

==================================================
4. FORESHADOWING AND MEANINGFUL PROPS
==================================================
- Plant elements early that return with changed meaning later: a prop, an image, a spoken promise, a habit.
- Every setup must name the scene where it is planted and the scene where it pays off, and what it means differently at payoff.
- Props must matter. A basket that is only carried is set dressing; a basket that becomes the thing that saves someone is a story element.
- Only plant what you will pay off. Do not leave promises open.

==================================================
5. PACING - NO STRETCHED PLOTS, NO FILLER
==================================================
- ${ctx.targetSceneCount} scenes is ${ctx.duration} of screen time. Scale the AMBITION of the story to fill it - more obstacles, deeper relationships, a genuine second act - not the same thin plot slowed down.
- If the idea is too small for this runtime, deepen it with a second relationship line or a complication that raises cost. Never repeat the same beat with different words.
- Chapters (${ctx.numChapters}) group beats; each chapter must end on a change of state, not a pause.

LANGUAGE: Story-facing text (beat names, chapter titles, logline) in ${ctx.language}. Structural analysis fields (purpose, causeFromPrevious, consequence, escalation, voiceSignature) in English so the scene department can execute them precisely.`;
}

export function buildBlueprintPrompt(ctx: BlueprintContext): string {
  const cast = targetCastSize(ctx.targetSceneCount);
  const beats = targetBeatCount(ctx.targetSceneCount);

  let prompt = `Design the complete narrative blueprint.

- Topic / Idea: "${ctx.topic}"
- Story Mode: ${ctx.storyMode}
- Runtime: ${ctx.duration} = exactly ${ctx.targetSceneCount} scenes of 10 seconds each
- Chapters: ${ctx.numChapters}
- Beat budget: about ${beats} beats (use fewer if the story is complete without them)
- Cast: ${cast.min}-${cast.max} characters, each dramatically necessary
- Language: ${ctx.language}
- Animation Style: ${ctx.animationStyle}

Beat scene ranges must tile scenes 1 to ${ctx.targetSceneCount} with no gaps and no overlaps.
Setups must reference scene numbers inside 1 to ${ctx.targetSceneCount}.
`;

  if (ctx.lockedCharacters && ctx.lockedCharacters.length > 0) {
    prompt += `\nLOCKED CHARACTERS - these must appear in the cast with these exact names and vegetable types. Build their goals, flaws and arcs around the existing identities:\n${JSON.stringify(
      ctx.lockedCharacters.map((c: any) => ({ name: c.name, veggieType: c.veggieType, role: c.role })),
      null,
      2
    )}\n`;
  }

  return prompt;
}

// ---------------------------------------------------------------------------
// Scoped slice handed to each scene batch
// ---------------------------------------------------------------------------

export interface BlueprintSlice {
  logline: string;
  theme: string;
  centralQuestion: string;
  castPlan: any[];
  relationships: any[];
  activeBeats: any[];
  previousBeat: any | null;
  nextBeat: any | null;
  relevantSetups: any[];
  chapters: any[];
}

/**
 * Give a batch exactly the structure it needs: the beats it must dramatise,
 * the beat before and after (so cause and consequence stay intact across the
 * batch seam), and the setups it must plant or pay off.
 */
export function sliceBlueprintForRange(blueprint: any, startScene: number, endScene: number): BlueprintSlice | null {
  if (!blueprint || typeof blueprint !== "object") return null;

  const beats: any[] = Array.isArray(blueprint.beats) ? blueprint.beats : [];
  const sorted = [...beats].sort((a, b) => (a?.beatNumber || 0) - (b?.beatNumber || 0));

  const activeBeats = sorted.filter(
    (b) => Number(b?.sceneEnd) >= startScene && Number(b?.sceneStart) <= endScene
  );

  const firstActiveIdx = activeBeats.length > 0 ? sorted.indexOf(activeBeats[0]) : -1;
  const lastActiveIdx = activeBeats.length > 0 ? sorted.indexOf(activeBeats[activeBeats.length - 1]) : -1;

  const setups: any[] = Array.isArray(blueprint.setups) ? blueprint.setups : [];
  const relevantSetups = setups.filter((s) => {
    const plant = Number(s?.plantScene);
    const payoff = Number(s?.payoffScene);
    // Anything planted or paid off nearby, plus anything already planted that
    // is still open, so the batch never forgets an outstanding promise.
    const inWindow = (n: number) => n >= startScene - 2 && n <= endScene + 2;
    return inWindow(plant) || inWindow(payoff) || (plant < startScene && payoff >= startScene);
  });

  const chapters: any[] = Array.isArray(blueprint.chapters) ? blueprint.chapters : [];

  return {
    logline: blueprint.logline || "",
    theme: blueprint.theme || "",
    centralQuestion: blueprint.centralQuestion || "",
    castPlan: Array.isArray(blueprint.castPlan) ? blueprint.castPlan : [],
    relationships: Array.isArray(blueprint.relationships) ? blueprint.relationships : [],
    activeBeats,
    previousBeat: firstActiveIdx > 0 ? sorted[firstActiveIdx - 1] : null,
    nextBeat: lastActiveIdx >= 0 && lastActiveIdx < sorted.length - 1 ? sorted[lastActiveIdx + 1] : null,
    relevantSetups,
    chapters,
  };
}

// ---------------------------------------------------------------------------
// Long-term story memory
// ---------------------------------------------------------------------------

export interface StoryMemory {
  scenesCompleted: number;
  lastSceneNumber: number;
  storySoFar: string[];
  beatsCompleted: string[];
  dialogueCounts: Record<string, number>;
  recentDialogue: string[];
  activeProps: string;
  openSetups: any[];
  emotionalTrajectory: string[];
}

function truncate(value: any, max: number): string {
  const text = typeof value === "string" ? value : "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Compact running memory of everything already dramatised. This is what keeps
 * a 60-scene film feeling like one continuous work instead of five unrelated
 * twelve-scene episodes: each batch sees the whole story so far, not just the
 * previous shot's end state.
 */
export function buildStoryMemory(scenesSoFar: any[], blueprint: any): StoryMemory | null {
  if (!Array.isArray(scenesSoFar) || scenesSoFar.length === 0) return null;

  const ordered = [...scenesSoFar].sort((a, b) => (a?.sceneNumber || 0) - (b?.sceneNumber || 0));
  const last = ordered[ordered.length - 1];

  const storySoFar = ordered.map((s) => {
    const fn = s?.storyFunction ? ` | changed: ${truncate(s.storyFunction, 90)}` : "";
    return `S${s?.sceneNumber}: ${truncate(s?.purpose || s?.visualDescription || s?.characterActions, 100)}${fn}`;
  });

  const dialogueCounts: Record<string, number> = {};
  const allLines: string[] = [];
  ordered.forEach((s) => {
    const turns = Array.isArray(s?.dialogueTurns) ? s.dialogueTurns : [];
    turns.forEach((t: any) => {
      const speaker = (t?.speaker || "").trim();
      if (speaker) dialogueCounts[speaker] = (dialogueCounts[speaker] || 0) + 1;
      if (t?.line) allLines.push(`${speaker}: ${t.line}`);
    });
  });

  const beatsCompleted: string[] = [];
  const beats: any[] = blueprint && Array.isArray(blueprint.beats) ? blueprint.beats : [];
  beats.forEach((b) => {
    if (Number(b?.sceneEnd) <= (last?.sceneNumber || 0)) {
      beatsCompleted.push(`Beat ${b.beatNumber} (${b.name}) - ${truncate(b.consequence, 90)}`);
    }
  });

  const setups: any[] = blueprint && Array.isArray(blueprint.setups) ? blueprint.setups : [];
  const openSetups = setups.filter(
    (s) => Number(s?.plantScene) <= (last?.sceneNumber || 0) && Number(s?.payoffScene) > (last?.sceneNumber || 0)
  );

  const emotionalTrajectory = ordered
    .slice(-4)
    .map((s) => `S${s?.sceneNumber}: ${truncate(s?.facialExpressions, 70)}`);

  return {
    scenesCompleted: ordered.length,
    lastSceneNumber: last?.sceneNumber || 0,
    storySoFar,
    beatsCompleted,
    dialogueCounts,
    recentDialogue: allLines.slice(-10),
    activeProps: truncate(last?.props, 200),
    openSetups,
    emotionalTrajectory,
  };
}

// ---------------------------------------------------------------------------
// Prompt blocks injected into the existing scene-batch prompt
// ---------------------------------------------------------------------------

/** Director's craft rules appended to the scene system instruction. */
export function buildStoryIntelligenceDirectives(params: {
  startScene: number;
  endScene: number;
  totalScenes: number;
  language: string;
  slice: BlueprintSlice | null;
}): string {
  const { slice, language, totalScenes } = params;
  if (!slice) return "";

  const castVoices = slice.castPlan
    .map(
      (c: any) =>
        `  - ${c.name} (${c.importance}): wants ${c.want}; needs ${c.need}; flaw: ${c.flaw}. VOICE: ${c.voiceSignature}. Target share of lines: ~${c.approxDialogueShare}%.`
    )
    .join("\n");

  return `

==================================================
STORY INTELLIGENCE - YOU ARE EXECUTING A BLUEPRINT
==================================================
LOGLINE: ${slice.logline}
THEME: ${slice.theme}
CENTRAL QUESTION: ${slice.centralQuestion}

CAST VOICES (dialogue must be recognisable WITHOUT the speaker name):
${castVoices}

DIALOGUE LAWS:
1. Distribute lines across the characters actually present, guided by their target shares. Do not let two characters monopolise a ${totalScenes}-scene film while the rest stand silent.
2. Every line must sound like its speaker's VOICE SIGNATURE above. If a line could be swapped between two characters unchanged, rewrite it.
3. Never repeat a line, a sentiment or an exchange that has already occurred earlier in the film. Check the STORY SO FAR and RECENT DIALOGUE before writing.
4. Dialogue advances or complicates - it never narrates what the audience can already see.
5. Speak in ${language}; keep speaker tags and populate 'dialogueTurns'.

ANTI-FILLER LAW (STRICT):
- Every scene MUST change something: a fact learned, a relationship shifted, a decision made, a resource lost or gained, a location or emotional state moved.
- State that change in the scene's 'storyFunction' field. If you cannot name a real change, the scene is filler - replace it with one that earns its ten seconds.
- Never pad by repeating an earlier beat with new wording, adding aimless travel, or restating the moral.

CAUSALITY LAW:
- Each scene is CAUSED by the one before it and CAUSES the one after. "And then" is failure; "and therefore" / "but so" is correct.
- Escalate: the pressure at the end of this batch must exceed the pressure at its start.
- No random twists. Any surprise must have been planted earlier in the blueprint's setups.

RELATIONSHIP LAW:
- Relationships evolve on-screen through behaviour, not narration. Show the shift in how characters address, interrupt, protect or withhold from each other.

BEAT DISCIPLINE:
- Each scene belongs to exactly one beat. Record it in 'beatNumber'.
- Serve the beat's purpose, causeFromPrevious, consequence and escalation as written in the blueprint below. Do not drift into a different beat's material.`;
}

/** The blueprint + memory block appended to the scene batch user prompt. */
export function buildBlueprintPromptBlock(slice: BlueprintSlice | null, memory: StoryMemory | null): string {
  const sections: string[] = [];

  if (slice) {
    sections.push(`NARRATIVE BLUEPRINT FOR THIS RANGE
=================================
BEATS TO DRAMATISE:
${JSON.stringify(slice.activeBeats, null, 2)}

${slice.previousBeat ? `BEAT IMMEDIATELY BEFORE (this batch must continue its consequence):\n${JSON.stringify(slice.previousBeat, null, 2)}\n` : ""}
${slice.nextBeat ? `BEAT IMMEDIATELY AFTER (this batch must set it up):\n${JSON.stringify(slice.nextBeat, null, 2)}\n` : ""}
RELATIONSHIP ARCS (must visibly progress, not reset):
${JSON.stringify(slice.relationships, null, 2)}

SETUPS TO PLANT OR PAY OFF IN THIS RANGE (foreshadowing is mandatory where listed):
${JSON.stringify(slice.relevantSetups, null, 2)}`);
  }

  if (memory) {
    sections.push(`LONG-TERM STORY MEMORY (${memory.scenesCompleted} scenes already exist - this is ONE continuous film)
=================================
STORY SO FAR (every scene already dramatised):
${memory.storySoFar.join("\n")}

BEATS ALREADY COMPLETED:
${memory.beatsCompleted.length > 0 ? memory.beatsCompleted.join("\n") : "None yet."}

LINES SPOKEN PER CHARACTER SO FAR (balance the remaining dialogue against this):
${JSON.stringify(memory.dialogueCounts)}

RECENT DIALOGUE - DO NOT REPEAT THESE LINES OR THEIR SENTIMENTS:
${memory.recentDialogue.join("\n")}

EMOTIONAL TRAJECTORY (continue it, do not reset it):
${memory.emotionalTrajectory.join("\n")}

PROPS IN PLAY AT SCENE ${memory.lastSceneNumber}: ${memory.activeProps}

OPEN SETUPS STILL AWAITING PAYOFF:
${memory.openSetups.length > 0 ? JSON.stringify(memory.openSetups, null, 2) : "None outstanding."}`);
  }

  return sections.length > 0 ? `\n${sections.join("\n\n")}\n` : "";
}

// ---------------------------------------------------------------------------
// Quality measurement of the finished timeline
// ---------------------------------------------------------------------------

export interface StoryQualityReport {
  sceneCount: number;
  beatCount: number;
  beatsCovered: number;
  scenesWithoutBeat: number[];
  castSize: number;
  castParticipation: Array<{ name: string; scenesPresent: number; sharePercent: number }>;
  dialogueDistribution: Array<{ speaker: string; lines: number; sharePercent: number }>;
  silentCharacters: string[];
  repeatedDialogueLines: Array<{ line: string; occurrences: number }>;
  scenesMissingStoryFunction: number[];
  staticScenes: number[];
  fillerSuspects: number[];
  setupsPlanted: number;
  setupsPaidOff: number;
  unpaidSetups: string[];
  relationshipsTracked: number;
}

function normalise(line: string): string {
  return String(line || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Measures the delivered timeline against the blueprint. Purely observational -
 * it never rewrites a scene - so the caller can report honestly on cast use,
 * dialogue balance, filler and unpaid setups.
 */
export function buildStoryQualityReport(
  scenes: any[],
  blueprint: any,
  characters: any[]
): StoryQualityReport {
  const list = Array.isArray(scenes) ? scenes : [];
  const sceneCount = list.length;
  const beats: any[] = blueprint && Array.isArray(blueprint.beats) ? blueprint.beats : [];
  const setups: any[] = blueprint && Array.isArray(blueprint.setups) ? blueprint.setups : [];
  const cast: any[] = Array.isArray(characters) ? characters : [];

  // Beat coverage
  const beatsSeen = new Set<number>();
  const scenesWithoutBeat: number[] = [];
  list.forEach((s) => {
    const beatNumber = Number(s?.beatNumber);
    if (Number.isFinite(beatNumber) && beatNumber > 0) beatsSeen.add(beatNumber);
    else scenesWithoutBeat.push(s?.sceneNumber);
  });

  // Cast participation
  const presence: Record<string, number> = {};
  cast.forEach((c: any) => { if (c?.name) presence[c.name] = 0; });
  list.forEach((s) => {
    const present: string[] = Array.isArray(s?.charactersPresent) ? s.charactersPresent : [];
    const seen = new Set<string>();
    present.forEach((raw) => {
      const match = cast.find((c: any) => {
        const a = String(c?.name || "").toLowerCase();
        const b = String(raw || "").toLowerCase();
        return a && b && (a === b || a.includes(b) || b.includes(a));
      });
      const key = match?.name || String(raw || "").trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        presence[key] = (presence[key] || 0) + 1;
      }
    });
  });

  const castParticipation = Object.entries(presence)
    .map(([name, scenesPresent]) => ({
      name,
      scenesPresent,
      sharePercent: sceneCount > 0 ? Math.round((scenesPresent / sceneCount) * 100) : 0,
    }))
    .sort((a, b) => b.scenesPresent - a.scenesPresent);

  // Dialogue distribution + repetition
  const lineCounts: Record<string, number> = {};
  const seenLines = new Map<string, number>();
  list.forEach((s) => {
    const turns = Array.isArray(s?.dialogueTurns) ? s.dialogueTurns : [];
    turns.forEach((t: any) => {
      const speaker = String(t?.speaker || "").trim();
      if (speaker) lineCounts[speaker] = (lineCounts[speaker] || 0) + 1;
      const key = normalise(t?.line);
      if (key.length >= 12) seenLines.set(key, (seenLines.get(key) || 0) + 1);
    });
  });

  const totalLines = Object.values(lineCounts).reduce((sum, n) => sum + n, 0);
  const dialogueDistribution = Object.entries(lineCounts)
    .map(([speaker, lines]) => ({
      speaker,
      lines,
      sharePercent: totalLines > 0 ? Math.round((lines / totalLines) * 100) : 0,
    }))
    .sort((a, b) => b.lines - a.lines);

  const spoke = new Set(Object.keys(lineCounts).map((s) => s.toLowerCase()));
  const silentCharacters = cast
    .map((c: any) => c?.name)
    .filter((name: string) => {
      if (!name) return false;
      const lower = String(name).toLowerCase();
      return ![...spoke].some((s) => s === lower || s.includes(lower) || lower.includes(s));
    });

  const repeatedDialogueLines = [...seenLines.entries()]
    .filter(([, n]) => n > 1)
    .map(([line, occurrences]) => ({ line, occurrences }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 20);

  // Filler detection
  const scenesMissingStoryFunction: number[] = [];
  const staticScenes: number[] = [];
  list.forEach((s) => {
    const fn = String(s?.storyFunction || "").trim();
    if (fn.length < 12) scenesMissingStoryFunction.push(s?.sceneNumber);
    const start = normalise(s?.startState);
    const end = normalise(s?.endState);
    if (start && end && start === end) staticScenes.push(s?.sceneNumber);
  });

  const fillerSuspects = [...new Set([...scenesMissingStoryFunction, ...staticScenes])].sort((a, b) => a - b);

  // Setups and payoffs. A setup counts as paid off only when a DISTINCTIVE
  // token of it turns up at the scene the blueprint promised. Character names
  // are excluded - a setup identified only by who is present is not verifiable.
  const castTokens = new Set<string>(
    cast.flatMap((c: any) => normalise(c?.name).split(" ")).filter(Boolean)
  );
  const STOPWORDS = new Set([
    "the", "and", "that", "with", "from", "this", "their", "about", "into", "over",
    "when", "what", "then", "than", "they", "them", "there", "here", "have", "will",
  ]);

  const sceneText = new Map<number, string>();
  list.forEach((s: any) => {
    sceneText.set(
      Number(s?.sceneNumber),
      normalise(
        [s?.setupOrPayoff, s?.props, s?.characterActions, s?.dialogue, s?.visualDescription, s?.storyFunction, s?.endState]
          .filter(Boolean)
          .join(" ")
      )
    );
  });

  let setupsPaidOff = 0;
  const unpaidSetups: string[] = [];
  setups.forEach((s: any) => {
    const tokens = normalise(s?.element)
      .split(" ")
      .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !castTokens.has(w));

    const payoff = Number(s?.payoffScene);
    const window = [payoff - 1, payoff, payoff + 1]
      .map((n) => sceneText.get(n) || "")
      .join(" ");

    const found = tokens.length > 0 && tokens.some((t) => window.includes(t));
    if (found) setupsPaidOff += 1;
    else unpaidSetups.push(String(s?.element || ""));
  });

  return {
    sceneCount,
    beatCount: beats.length,
    beatsCovered: beatsSeen.size,
    scenesWithoutBeat,
    castSize: cast.length,
    castParticipation,
    dialogueDistribution,
    silentCharacters,
    repeatedDialogueLines,
    scenesMissingStoryFunction,
    staticScenes,
    fillerSuspects,
    setupsPlanted: setups.length,
    setupsPaidOff,
    unpaidSetups,
    relationshipsTracked: blueprint && Array.isArray(blueprint.relationships) ? blueprint.relationships.length : 0,
  };
}

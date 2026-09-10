import express from "express";
import { Type } from "@google/genai";
import dotenv from "dotenv";
import {
  calculateSceneCount as calculateTargetSceneCount,
  formatSceneTimeRange as formatTimeRange,
  formatTotalDuration,
} from "./src/shared/duration.js";
import { generateText, generateImage } from "./src/server/ai/index.js";
import {
  BLUEPRINT_SCHEMA,
  buildBlueprintPrompt,
  buildBlueprintPromptBlock,
  buildBlueprintSystemInstruction,
  buildStoryIntelligenceDirectives,
  buildStoryMemory,
  buildStoryQualityReport,
  sliceBlueprintForRange,
  targetBeatCount,
  targetCastSize,
} from "./src/server/story/blueprint.js";

dotenv.config();

// Partition any target scene count into balanced batches of max 12 scenes
function partitionSceneRanges(totalScenes: number, maxChunkSize: number = 12): Array<{ start: number; end: number }> {
  if (totalScenes <= maxChunkSize) {
    return [{ start: 1, end: totalScenes }];
  }
  const numChunks = Math.ceil(totalScenes / maxChunkSize);
  const baseSize = Math.floor(totalScenes / numChunks);
  const remainder = totalScenes % numChunks;

  const ranges: Array<{ start: number; end: number }> = [];
  let currentStart = 1;
  for (let i = 0; i < numChunks; i++) {
    const size = baseSize + (i < remainder ? 1 : 0);
    const currentEnd = currentStart + size - 1;
    ranges.push({ start: currentStart, end: currentEnd });
    currentStart = currentEnd + 1;
  }
  return ranges;
}

function buildCharacterReferencePackage(char: any, animationStyle: string = "Cute 3D"): any {
  const style = animationStyle || "Cute 3D";
  const name = char.name || "Veggie Character";
  const type = char.veggieType || "Vegetable";
  const body = char.bodyShape || "anthropomorphic toddler proportions";
  const face = char.faceDesign || "friendly round cheeks with rosy blush";
  const eyes = char.eyeStyleAndColor || "large expressive dark brown Pixar-style eyes";
  const mouth = char.mouthStyle || "wide cheerful smile";
  const features = char.veggieFeatures || "fresh leafy green top";
  const clothing = char.clothing || "colorful dungarees with round buttons";
  const shoes = char.shoes || "tiny matching sneakers";
  const accessories = char.accessories || "none";
  const colors = char.mainColors || "bright vibrant palette";

  const fullBodyPrompt = `Full-body character reference of ${name}, a cute anthropomorphic ${type} in ${style} animation style. Clean neutral light gray studio background, soft cinematic studio key lighting, centered turnaround view from head to feet. Body proportions: ${body}. Facial features: ${face}, eyes: ${eyes}, mouth: ${mouth}. Botanical anatomy: ${features}. Wardrobe: ${clothing}, shoes: ${shoes}, accessories: ${accessories}. Color palette: ${colors}. Standing in a relaxed neutral A-pose with clear silhouette and crisp edge definition. Masterpiece 3D children's animation character asset, high resolution, no background elements or story environment.`;

  const frontFacingPrompt = `Front-facing character reference portrait of ${name}, anthropomorphic ${type}, ${style} children's animation feature film quality. Direct frontal close-up angle centered on face and upper torso against a clean neutral off-white background. Showing detailed face design: ${face}, expressive eyes: ${eyes}, mouth: ${mouth}, green vegetable crown/stem: ${features}, collar and upper clothing: ${clothing}, accessories: ${accessories}. Symmetrical camera composition, soft even rim lighting, sharp texture detail, character model reference standard.`;

  const characterSheetPrompt = `Professional 3D animation character model sheet of ${name} the anthropomorphic ${type}. Multiple views of the EXACT SAME character on a single clean neutral background: Front view, 3/4 front view, Side profile view, and Back view. Maintaining 100% identical body proportions (${body}), face (${face}, ${eyes}), vegetable anatomy (${features}), clothing (${clothing}), shoes (${shoes}), and palette (${colors}) across all 4 turnaround angles. Studio model sheet for Google Flow / Veo animation reference, uniform lighting, high consistency.`;

  const expressionSheetPrompt = `Animation character expression sheet for ${name} (${type}), ${style} style. A grid showcasing 6 distinct emotional expressions of the SAME identical character: (1) Happy beaming smile, (2) Sad downturned pout with teary eyes, (3) Wide-eyed surprised gasp with raised eyebrows, (4) Excited cheering with starry eyes, (5) Worried / cautious look with tilted head, (6) Big laughing chuckle. Core visual identity is 100% locked: identical ${body}, ${features}, ${eyes}, ${clothing}, and ${colors}. Only facial muscles and mouth/brow shapes alter dynamically.`;

  const flowVeoInstructions = `CRITICAL FLOW / VEO VISUAL CONSISTENCY INSTRUCTIONS FOR ${name.toUpperCase()} (${type.toUpperCase()}):
1. ANATOMY & PROPORTIONS: Must strictly maintain ${body}. Do NOT alter torso height, limb proportions, or vegetable shape.
2. BOTANICAL FEATURES: Fixed stem/leaf crown (${features}). Do NOT remove or modify leaf counts or sprout styles.
3. FACIAL IDENTITY: ${face} with ${eyes} and ${mouth}. Eye color and catchlights must remain identical in every frame.
4. LOCKED WARDROBE: Outfit must always be ${clothing}, footwear must always be ${shoes}, accessories: ${accessories}. Never switch clothing styles or colors.
5. COLOR PALETTE: Strictly adhere to ${colors}.
6. ANIMATION FLAVOR: ${style} Pixar/Illumination feel with squash-and-stretch physics.
7. USAGE RULE: Treat this reference package as the authoritative visual Ingredient in Google Flow / Veo video generation. All scene generations must align with this locked asset.`;

  const negativePrompt = `Avoid in all generations of ${name}: photorealistic human skin, realistic produce photographs, changed clothing, alternate colors, wrong eye color, different body shape, adult proportions, extra limbs, missing leaves, missing shoes, random accessories, realistic textures, dark gritty horror lighting, blurry artifacts, text, watermarks, logo overlays, deformed face, character redesign.`;

  return {
    characterId: char.id || `char_${type.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    characterName: name,
    veggieType: type,
    fullBodyPrompt,
    frontFacingPrompt,
    characterSheetPrompt,
    expressionSheetPrompt,
    flowVeoInstructions,
    negativePrompt,
  };
}

// Scene schema for structured generation
const SCENE_PROPERTIES = {
  sceneNumber: { type: Type.INTEGER, description: "Sequential scene number 1, 2, ..." },
  timeRange: { type: Type.STRING, description: "Continuous time range e.g. 0:00 – 0:10" },
  duration: { type: Type.STRING, description: "Fixed 10s" },
  chapterNumber: { type: Type.INTEGER, description: "Associated chapter number" },
  beatNumber: { type: Type.INTEGER, description: "Blueprint beat number this scene belongs to" },
  beatName: { type: Type.STRING, description: "Blueprint beat name this scene serves" },
  storyFunction: {
    type: Type.STRING,
    description: "What materially CHANGES in this scene - a fact learned, relationship shifted, decision made, resource lost or gained. If nothing changes the scene is filler and must be rewritten.",
  },
  setupOrPayoff: { type: Type.STRING, description: "Foreshadowing planted or paid off here, or 'None'" },
  chapterTitle: { type: Type.STRING, description: "Associated chapter title" },
  purpose: { type: Type.STRING, description: "Narrative beat purpose" },
  charactersPresent: {
    type: Type.ARRAY,
    items: { type: Type.STRING },
    description: "Array of vegetable characters in this shot",
  },
  characterActions: { type: Type.STRING, description: "Exactly ONE primary visual action in this 10-second shot" },
  facialExpressions: { type: Type.STRING, description: "Eye and mouth expressions and emotional state carrying forward" },
  dialogue: { type: Type.STRING, description: "Multi-character spoken conversation formatted with speaker names, e.g. Gajar: \"...\" \\n Tamatar: \"...\" in target language, or 'None / Visual Action'" },
  dialogueTurns: {
    type: Type.ARRAY,
    description: "Multi-character dialogue turns with speaker, line, facialExpression, and accompanyingAction",
    items: {
      type: Type.OBJECT,
      properties: {
        speaker: { type: Type.STRING },
        line: { type: Type.STRING },
        facialExpression: { type: Type.STRING },
        accompanyingAction: { type: Type.STRING },
      },
      required: ["speaker", "line"],
    },
  },
  environment: { type: Type.STRING, description: "Setting, backdrop, weather, lighting" },
  props: { type: Type.STRING, description: "Interactive items, explicitly specifying held props vs placed props" },
  cameraShot: { type: Type.STRING, description: "Camera framing (e.g. Low-Angle Medium Close-Up)" },
  cameraMovement: { type: Type.STRING, description: "Camera motion maintaining directional continuity" },
  lighting: { type: Type.STRING, description: "Lighting direction, color temperature, and mood" },
  animationDirection: { type: Type.STRING, description: "Movement physics and style" },
  soundEffects: { type: Type.STRING, description: "Foley audio cues" },
  backgroundMusicMood: { type: Type.STRING, description: "Score mood" },
  continuityFromPrevious: { type: Type.STRING, description: "Continuity transition from previous scene" },
  continuityIntoNext: { type: Type.STRING, description: "Continuity transition into next scene" },
  characterConsistencyNotes: { type: Type.STRING, description: "Locked Character Bible wardrobe and color checklist" },
  visualDescription: { type: Type.STRING, description: "Short 1-sentence visual summary" },
  startState: { type: Type.STRING, description: "Exact visual starting state inheriting Scene N-1 endState (positions, poses, held props, lighting)" },
  endState: { type: Type.STRING, description: "Exact visual ending state at 10.0s (positions, held props, open/closed doors, expressions)" },
  nextSceneHandoff: { type: Type.STRING, description: "Specific visual & physical handoff contract that MUST be inherited by Scene N+1" },
  finalVideoPrompt: { type: Type.STRING, description: "Complete production prompt in English for Google Flow/Veo starting with CONTINUE DIRECTLY FROM PREVIOUS SHOT (or Opening) with explicit continuity negative constraints" },
};

const REQUIRED_SCENE_FIELDS = [
  "sceneNumber",
  "timeRange",
  "duration",
  "purpose",
  "beatNumber",
  "storyFunction",
  "charactersPresent",
  "characterActions",
  "facialExpressions",
  "dialogue",
  "environment",
  "props",
  "cameraShot",
  "cameraMovement",
  "lighting",
  "animationDirection",
  "soundEffects",
  "backgroundMusicMood",
  "continuityFromPrevious",
  "continuityIntoNext",
  "characterConsistencyNotes",
  "visualDescription",
  "startState",
  "endState",
  "nextSceneHandoff",
  "finalVideoPrompt",
];

// Helper to generate a batch of scenes for a given range with continuous film handoffs
async function generateScenesBatch(
  params: {
    startScene: number;
    endScene: number;
    totalScenes: number;
    title: string;
    topic: string;
    language: string;
    duration: string;
    storyMode: string;
    animationStyle: string;
    fullStoryText: string;
    characters: any[];
    chapters: any[];
    previousSceneContext?: {
      sceneNumber: number;
      endState: string;
      nextSceneHandoff: string;
      charactersPresent: string[];
      environment: string;
      lighting: string;
      props: string;
      heldProps?: string;
      characterPositions?: string;
      characterEmotions?: string;
    } | null;
    blueprint?: any;
    storyMemory?: any;
  }
): Promise<any[]> {
  const {
    startScene,
    endScene,
    totalScenes,
    title,
    topic,
    language,
    duration,
    storyMode,
    animationStyle,
    fullStoryText,
    characters,
    chapters,
    previousSceneContext,
    blueprint,
    storyMemory,
  } = params;

  // Story-first: the beats this range must dramatise, plus the beat either
  // side of it so cause and consequence survive the batch seam.
  const blueprintSlice = sliceBlueprintForRange(blueprint, startScene, endScene);

  const count = endScene - startScene + 1;
  const startTime = formatTimeRange(startScene).split("–")[0].trim();
  const endTime = formatTimeRange(endScene).split("–")[1].trim();

  const systemInstruction = `You are a world-class children's animation director and cinematographer directing consecutive 10-second shots for the animated film "${title}".
Animation Style: ${animationStyle}
Story Mode: ${storyMode}
Language: ${language}

CORE PHILOSOPHY — ONE CONTINUOUS ANIMATED FILM, NOT DISCONNECTED CLIPS:
You are NOT producing independent AI video clips. You are planning consecutive shots of ONE UNIFIED, CONTINUOUS CINEMATIC FILM.

MANDATORY CONTINUITY & SHOT-TO-SHOT LAWS:
1. SHOT-TO-SHOT HANDOFF:
   - For Scene 1: Establish the opening positions, physical poses, held props, environment, and lighting.
   - For Scene N (N > 1): Scene N's 'startState' MUST BE IDENTICAL to Scene N-1's 'endState'.
   - The action occurring at 10.0 seconds of Scene N-1 MUST continue fluidly at 0.0 seconds of Scene N.
2. STRICT NO-RESET RULE:
   - NEVER automatically reset character pose, screen position (left/right/center), held props, emotions, environment, weather, lighting, or camera direction.
   - If a character begins walking to the right, they DO NOT suddenly appear on the left in the next shot unless an explicit camera reverse shot is motivated.
3. PHYSICAL & PROP CONTINUITY:
   - If a character picks up or holds a prop (e.g. basket, umbrella, watering can, lantern, map), they CONTINUE HOLDING IT in subsequent scenes until an explicit action sets it down.
   - If a gate or door is opened, it STAYS OPEN in subsequent scenes until closed.
4. EMOTIONAL CONTINUITY:
   - Emotions (fear, curiosity, relief, laughter, tears) persist across shots. They never reset to a generic neutral smile without a clear narrative trigger.
5. NATURAL MULTI-CHARACTER CONVERSATIONAL INTELLIGENCE:
   - When 2 or more characters are present, distribute dialogue naturally with speaker prefixes (e.g. "Gajar: \\"...\\" \\n Tamatar: \\"...\\"").
   - Characters must talk TO each other: asking questions, answering, reacting emotionally, giving suggestions, and expressing care.
   - Synchronize physical movement with speech: each character's line matches what they are physically doing and their facial expressions. Populate 'dialogueTurns'.
6. GOOGLE FLOW / VEO VIDEO PROMPT REQUIREMENTS:
   - For Scene 1: Begin with "OPENING ESTABLISHING SHOT:".
   - For Scene N (N > 1): MUST BEGIN WITH "CONTINUE DIRECTLY FROM PREVIOUS SHOT [Scene ${startScene > 1 ? "N-1" : "..."}]: [Detail exact starting poses, character screen positions, and held props]...".
   - Include character visual details from Character Bible, motivated camera movement, lighting, synchronized dialogue in ${language}, Foley sound effects, and exact ending posture.
   - ALWAYS conclude with continuity negative constraints: "Avoid: character teleportation, sudden wardrobe or color changes, vanishing props, pose resets, emotional resets, reversed screen direction, unmotivated cuts."`
    + buildStoryIntelligenceDirectives({
      startScene,
      endScene,
      totalScenes,
      language,
      slice: blueprintSlice,
    });

  let continuityContextPrompt = "";
  if (previousSceneContext) {
    continuityContextPrompt = `
CRITICAL PREVIOUS SCENE CONTINUITY (Scene #${previousSceneContext.sceneNumber} Just Finished):
- Ending Visual State: ${previousSceneContext.endState}
- Next Scene Handoff Directive: ${previousSceneContext.nextSceneHandoff}
- Characters Present & Staging: ${previousSceneContext.charactersPresent?.join(", ")}
- Environment & Lighting: ${previousSceneContext.environment} | Lighting: ${previousSceneContext.lighting}
- Props: ${previousSceneContext.props}
${previousSceneContext.heldProps ? `- Held Props: ${previousSceneContext.heldProps}` : ""}
${previousSceneContext.characterPositions ? `- Screen Positions: ${previousSceneContext.characterPositions}` : ""}
${previousSceneContext.characterEmotions ? `- Emotional State: ${previousSceneContext.characterEmotions}` : ""}

YOUR SCENE #${startScene} START STATE MUST EXACTLY INHERIT AND CONTINUE FROM THIS PREVIOUS STATE!
`;
  }

  const prompt = `Generate sequential 10-second shots for Scene ${startScene} to Scene ${endScene} (covering ${startTime} to ${endTime} of the ${totalScenes}-scene (${duration}) timeline).

STORY TITLE: ${title}
TOPIC: ${topic}
MODE: ${storyMode}
DURATION: ${duration} (Total ${totalScenes} scenes)
LANGUAGE: ${language}
${continuityContextPrompt}
STORY NARRATIVE SCRIPT:
${fullStoryText}

CHAPTER BREAKDOWN:
${JSON.stringify(chapters || [], null, 2)}

MASTER CHARACTER BIBLE (STRICT VISUAL IDENTITIES):
${JSON.stringify(characters || [], null, 2)}
${buildBlueprintPromptBlock(blueprintSlice, storyMemory || null)}

Ensure every scene contains complete 'startState', 'endState', 'nextSceneHandoff', multi-character dialogue in ${language} with 'dialogueTurns', and production Google Flow / Veo prompts.
Generate exactly ${count} scenes numbered ${startScene} to ${endScene}.`;

  const response = await generateText({
    prompt,
    options: {
      systemInstruction,
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: SCENE_PROPERTIES,
              required: REQUIRED_SCENE_FIELDS,
            },
          },
        },
        required: ["scenes"],
      },
    },
  });

  // A failed batch MUST surface as an error. Returning [] here used to make the
  // timeline standardiser silently fabricate placeholder scenes in its place.
  const rawJson = response.text;
  if (!rawJson) {
    throw new Error(`Scenes ${startScene}-${endScene}: the model returned an empty response.`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    console.error("Failed to parse scenes batch JSON:", err);
    throw new Error(`Scenes ${startScene}-${endScene}: the model returned malformed JSON.`);
  }

  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
    throw new Error(`Scenes ${startScene}-${endScene}: the model returned no scenes.`);
  }

  return parsed.scenes;
}

// ==========================================
// SEQUENTIAL SCENE BATCH ORCHESTRATOR
// ==========================================

/** A range of scene numbers that could not be generated. */
interface SceneBatchFailure {
  startScene: number;
  endScene: number;
  sceneNumbers: number[];
  reason: string;
}

interface SceneBatchOutcome {
  scenes: any[];
  failures: SceneBatchFailure[];
}

/** One retry pass: a failed batch is split in half and each half tried once. */
const MAX_BATCH_SPLIT_DEPTH = 1;
/** Ranges smaller than this are not worth splitting further. */
const MIN_SPLITTABLE_BATCH = 4;

function expandSceneNumbers(start: number, end: number): number[] {
  const numbers: number[] = [];
  for (let n = start; n <= end; n++) numbers.push(n);
  return numbers;
}

/**
 * Run every scene batch sequentially, threading continuity from the last
 * SUCCESSFULLY generated scene into the next batch.
 *
 * Failure policy:
 *   - A batch that fails is retried once as two smaller halves (bounded by
 *     MAX_BATCH_SPLIT_DEPTH), which is the single most effective remedy for a
 *     large batch timing out. The prompt template is unchanged; only the scene
 *     range it already takes as input gets smaller.
 *   - Whatever still fails is recorded and reported. It is never replaced with
 *     invented content, and scenes that did succeed are always kept.
 */
async function runSceneBatchPipeline(params: {
  targetSceneCount: number;
  title: string;
  topic: string;
  language: string;
  duration: string;
  storyMode: string;
  animationStyle: string;
  fullStoryText: string;
  characters: any[];
  chapters: any[];
  logLabel: string;
  blueprint?: any;
}): Promise<SceneBatchOutcome> {
  const { targetSceneCount, logLabel } = params;
  const scenes: any[] = [];
  const failures: SceneBatchFailure[] = [];

  const buildPreviousContext = () => {
    const last = scenes.length > 0 ? scenes[scenes.length - 1] : null;
    if (!last) return null;
    return {
      sceneNumber: last.sceneNumber,
      endState: last.endState || last.characterActions,
      nextSceneHandoff: last.nextSceneHandoff || last.continuityIntoNext,
      charactersPresent: last.charactersPresent,
      environment: last.environment,
      lighting: last.lighting,
      props: last.props,
    };
  };

  const attemptRange = async (start: number, end: number, depth: number): Promise<void> => {
    try {
      const batchScenes = await generateScenesBatch({
        startScene: start,
        endScene: end,
        totalScenes: targetSceneCount,
        title: params.title,
        topic: params.topic,
        language: params.language,
        duration: params.duration,
        storyMode: params.storyMode,
        animationStyle: params.animationStyle,
        fullStoryText: params.fullStoryText,
        characters: params.characters,
        chapters: params.chapters,
        // Continuity always inherits the last scene that actually exists.
        previousSceneContext: buildPreviousContext(),
        blueprint: params.blueprint,
        // Long-term memory of every scene so far, not just the previous shot.
        storyMemory: buildStoryMemory(scenes, params.blueprint),
      });
      scenes.push(...batchScenes);
    } catch (err: any) {
      const reason = err?.message || String(err);
      const size = end - start + 1;

      if (depth < MAX_BATCH_SPLIT_DEPTH && size >= MIN_SPLITTABLE_BATCH) {
        const mid = start + Math.floor((size - 1) / 2);
        console.log(
          `[${logLabel}] Scenes ${start}-${end} failed (${reason}). Retrying as ${start}-${mid} and ${mid + 1}-${end}...`
        );
        await attemptRange(start, mid, depth + 1);
        await new Promise((resolve) => setTimeout(resolve, 300));
        await attemptRange(mid + 1, end, depth + 1);
        return;
      }

      console.error(`[${logLabel}] Scenes ${start}-${end} could not be generated: ${reason}`);
      failures.push({
        startScene: start,
        endScene: end,
        sceneNumbers: expandSceneNumbers(start, end),
        reason,
      });
    }
  };

  const sceneBatches = partitionSceneRanges(targetSceneCount, 12);
  console.log(`[${logLabel}] Executing ${sceneBatches.length} batch(es) sequentially:`, sceneBatches);

  for (let bIdx = 0; bIdx < sceneBatches.length; bIdx++) {
    const range = sceneBatches[bIdx];
    console.log(
      `[${logLabel}] Generating batch ${bIdx + 1}/${sceneBatches.length} (scenes ${range.start} to ${range.end}) with continuity handoff...`
    );
    await attemptRange(range.start, range.end, 0);
    if (bIdx < sceneBatches.length - 1) {
      // Breather between batches to avoid rate limit spikes
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }

  return { scenes, failures };
}

/** Honest account of what the pipeline produced, attached to the API response. */
function buildSceneGenerationReport(
  targetSceneCount: number,
  standardizedScenes: any[],
  failures: SceneBatchFailure[]
) {
  const present = new Set<number>(standardizedScenes.map((s: any) => s.sceneNumber));
  const missingSceneNumbers: number[] = [];
  for (let n = 1; n <= targetSceneCount; n++) {
    if (!present.has(n)) missingSceneNumbers.push(n);
  }

  return {
    targetSceneCount,
    generatedSceneCount: standardizedScenes.length,
    missingSceneCount: missingSceneNumbers.length,
    missingSceneNumbers,
    isComplete: missingSceneNumbers.length === 0,
    failedBatches: failures,
  };
}

// ==========================================
// AUTOMATED 10-DIMENSION CONTINUITY VALIDATOR
// ==========================================
function validateSceneContinuity(scenes: any[], characters: any[]): void {
  if (!scenes || scenes.length <= 1) return;

  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const curr = scenes[i];
    const issues: any[] = [];

    // 1. Character Continuity Check
    const prevChars = new Set<string>((prev.charactersPresent || []).map((c: string) => c.toLowerCase()));
    const currChars = new Set<string>((curr.charactersPresent || []).map((c: string) => c.toLowerCase()));

    // Check vanished characters without exit
    prevChars.forEach((charName) => {
      if (!currChars.has(charName)) {
        const exitMentioned =
          (prev.characterActions || "").toLowerCase().includes("exit") ||
          (prev.characterActions || "").toLowerCase().includes("leave") ||
          (prev.characterActions || "").toLowerCase().includes("walks away") ||
          (curr.characterActions || "").toLowerCase().includes("off-screen") ||
          (curr.characterActions || "").toLowerCase().includes("alone");
        if (!exitMentioned && prev.charactersPresent.length > 1) {
          issues.push({
            sceneNumber: curr.sceneNumber,
            dimension: "character",
            title: `Character Presence Discontinuity (${charName})`,
            previousState: `Scene ${prev.sceneNumber}: ${charName} was present on screen.`,
            currentState: `Scene ${curr.sceneNumber}: ${charName} is omitted without an on-screen exit.`,
            suggestedFix: `Either include ${charName} in the background/group or add an explicit exit action in Scene ${prev.sceneNumber}.`,
            severity: "info",
          });
        }
      }
    });

    // 2. Prop Continuity Check (held props persistence)
    const keyProps = ["basket", "umbrella", "lantern", "key", "watering can", "map", "towel", "book", "bag", "flower", "stick"];
    keyProps.forEach((propKeyword) => {
      const prevHasProp = (prev.props || "").toLowerCase().includes(propKeyword) || (prev.endState || "").toLowerCase().includes(propKeyword);
      const currHasProp = (curr.props || "").toLowerCase().includes(propKeyword) || (curr.startState || "").toLowerCase().includes(propKeyword);
      const propDropped = (prev.endState || "").toLowerCase().includes("places") || (prev.endState || "").toLowerCase().includes("drops") || (curr.characterActions || "").toLowerCase().includes("puts down");

      if (prevHasProp && !currHasProp && !propDropped) {
        issues.push({
          sceneNumber: curr.sceneNumber,
          dimension: "prop",
          title: `Prop Discontinuity (${propKeyword})`,
          previousState: `Scene ${prev.sceneNumber}: "${propKeyword}" was in active use or held at the end of the shot.`,
          currentState: `Scene ${curr.sceneNumber}: "${propKeyword}" is not listed in starting state or active props.`,
          suggestedFix: `Specify that the character continues holding the ${propKeyword} or explicitly show them placing it down.`,
          severity: "warning",
        });
      }
    });

    // 3. Location Continuity Check
    const prevLoc = (prev.environment || "").toLowerCase();
    const currLoc = (curr.environment || "").toLowerCase();
    const isDramaticJump =
      (prevLoc.includes("garden") && currLoc.includes("kitchen")) ||
      (prevLoc.includes("outdoor") && currLoc.includes("inside bedroom")) ||
      (prevLoc.includes("farm") && currLoc.includes("castle"));

    if (isDramaticJump) {
      const transitionMentioned = (prev.endState || "").toLowerCase().includes("enter") || (curr.startState || "").toLowerCase().includes("arrive") || (curr.characterActions || "").toLowerCase().includes("walked into");
      if (!transitionMentioned) {
        issues.push({
          sceneNumber: curr.sceneNumber,
          dimension: "location",
          title: "Sudden Location Jump without Staged Transition",
          previousState: `Scene ${prev.sceneNumber}: ${prev.environment}`,
          currentState: `Scene ${curr.sceneNumber}: ${curr.environment}`,
          suggestedFix: `Show the character walking through the doorway or arriving at the new location to bridge the scene transition.`,
          severity: "warning",
        });
      }
    }

    // 4. Action & Handoff Continuity Check
    if (curr.startState && prev.endState) {
      const hasOverlap = curr.startState.toLowerCase().includes(prev.sceneNumber.toString()) ||
        curr.startState.toLowerCase().includes("continue") ||
        curr.startState.toLowerCase().includes("direct") ||
        curr.startState.length > 20;
      if (!hasOverlap) {
        issues.push({
          sceneNumber: curr.sceneNumber,
          dimension: "action",
          title: "Vague Shot-to-Shot Action Handoff",
          previousState: `Scene ${prev.sceneNumber} End: ${prev.endState}`,
          currentState: `Scene ${curr.sceneNumber} Start: ${curr.startState}`,
          suggestedFix: `Directly inherit the end posture and positions from Scene ${prev.sceneNumber}.`,
          severity: "info",
        });
      }
    }

    // 5. Emotional Continuity Check
    const prevEmotions = (prev.facialExpressions || "").toLowerCase();
    const currEmotions = (curr.facialExpressions || "").toLowerCase();
    const wasDistressed = prevEmotions.includes("terrified") || prevEmotions.includes("crying") || prevEmotions.includes("panicked");
    const isCheerfullySmiling = currEmotions.includes("joyful laugh") || currEmotions.includes("beaming smile") || currEmotions.includes("celebrating");

    if (wasDistressed && isCheerfullySmiling) {
      issues.push({
        sceneNumber: curr.sceneNumber,
        dimension: "emotion",
        title: "Sudden Emotional Reset without Narrative Beat",
        previousState: `Scene ${prev.sceneNumber}: Character was distressed/panicked ("${prev.facialExpressions}").`,
        currentState: `Scene ${curr.sceneNumber}: Character is immediately cheerful ("${curr.facialExpressions}").`,
        suggestedFix: `Transition from relief or lingering concern before jumping straight to joyful celebration.`,
        severity: "warning",
      });
    }

    // Attach issues to current scene
    curr.continuityIssues = issues;
  }
}

// Timeline Validation & Standardizer Function
function validateAndStandardizeTimeline(
  rawScenes: any[],
  targetSceneCount: number,
  storyContext: {
    title: string;
    language: string;
    storyMode: string;
    animationStyle: string;
    fullStoryText: string;
    chapters: any[];
    characters: any[];
  }
): any[] {
  const { title, language, animationStyle, chapters, characters } = storyContext;
  const validScenes: any[] = [];
  const sceneMap = new Map<number, any>();

  // Map known scenes by sceneNumber
  rawScenes.forEach((s) => {
    if (s && typeof s.sceneNumber === "number" && s.sceneNumber >= 1 && s.sceneNumber <= targetSceneCount) {
      sceneMap.set(s.sceneNumber, s);
    }
  });

  const numChapters = chapters && chapters.length > 0 ? chapters.length : 5;
  const mainChar = characters && characters[0];
  const charName = mainChar?.name || "Gajar";

  for (let num = 1; num <= targetSceneCount; num++) {
    const expectedTimeRange = formatTimeRange(num);
    const chapterIdx = Math.min(numChapters, Math.floor(((num - 1) / targetSceneCount) * numChapters) + 1);
    const chapterObj = chapters && chapters[chapterIdx - 1];
    // Neutral label only - do not invent a themed chapter name the model never wrote.
    const chapterTitle = chapterObj?.title || `Chapter ${chapterIdx}`;

    const scene = sceneMap.get(num);

    // NEVER fabricate a scene the model did not produce. A missing scene number
    // is reported through the generation report instead of being back-filled
    // with template content that reads like a real, generated shot.
    if (!scene) {
      continue;
    }

    // The previous scene that actually exists - the timeline may have gaps.
    const prevScene = validScenes.length > 0 ? validScenes[validScenes.length - 1] : null;

    {
      // Standardize and ensure continuity fields on the generated scene
      scene.sceneNumber = num;
      scene.timeRange = expectedTimeRange;
      scene.duration = "10s";
      scene.chapterNumber = scene.chapterNumber || chapterIdx;
      scene.chapterTitle = scene.chapterTitle || chapterTitle;

      if (!scene.startState) {
        scene.startState = num === 1
          ? "Film Opening: Characters established in initial garden positions."
          : `Direct continuation from Scene ${prevScene?.sceneNumber ?? num - 1}: ${prevScene?.endState || prevScene?.characterActions || "Continuing previous posture."}`;
      }

      if (!scene.endState) {
        scene.endState = `At 10.0s mark: ${scene.characterActions}. Characters hold finishing posture for Scene ${num + 1} handoff.`;
      }

      if (!scene.nextSceneHandoff) {
        scene.nextSceneHandoff = num < targetSceneCount
          ? `Scene ${num + 1} must inherit character positions, held props, and screen direction from this scene's conclusion.`
          : "Film resolution.";
      }

      if (!scene.continuityFromPrevious) {
        scene.continuityFromPrevious = prevScene
          ? `Continuation from Scene ${prevScene.sceneNumber} (${formatTimeRange(prevScene.sceneNumber)})`
          : "Opening scene";
      }
      if (!scene.continuityIntoNext) {
        scene.continuityIntoNext = num < targetSceneCount ? `Transitions into Scene ${num + 1} (${formatTimeRange(num + 1)})` : "Final resolution";
      }

      // Parse dialogueTurns if not present
      if (!Array.isArray(scene.dialogueTurns) || scene.dialogueTurns.length === 0) {
        const turns: any[] = [];
        const rawLines = (scene.dialogue || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
        rawLines.forEach((line: string) => {
          const colonIdx = line.indexOf(":");
          if (colonIdx > 0) {
            const spk = line.substring(0, colonIdx).trim().replace(/^[\*\-_]+|[\*\-_]+$/g, "");
            const speech = line.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
            turns.push({
              speaker: spk,
              line: speech,
              facialExpression: scene.facialExpressions || "Expressive",
              accompanyingAction: scene.characterActions || "Speaking actively",
            });
          }
        });
        if (turns.length > 0) {
          scene.dialogueTurns = turns;
        } else if (scene.dialogue && scene.dialogue !== "None / Visual Action") {
          scene.dialogueTurns = [{
            speaker: scene.charactersPresent?.[0] || charName,
            line: scene.dialogue.replace(/^["']|["']$/g, ""),
            facialExpression: scene.facialExpressions,
            accompanyingAction: scene.characterActions,
          }];
        }
      }

      // Ensure Flow/Veo prompt has continuity directive
      if (prevScene && scene.finalVideoPrompt && !scene.finalVideoPrompt.toUpperCase().includes("CONTINUE DIRECTLY FROM PREVIOUS SHOT")) {
        scene.finalVideoPrompt = `CONTINUE DIRECTLY FROM PREVIOUS SHOT [Scene ${prevScene.sceneNumber}]: Inherit ${prevScene.endState || "finishing posture"}. ${scene.finalVideoPrompt}`;
      }
    }

    // Assign Transition Contract (Part 11)
    scene.transitionContract = {
      previousSceneEnd: prevScene
        ? prevScene.endState || prevScene.characterActions || "Previous action completed."
        : "Film Opening: Initial staging established.",
      thisSceneStart: scene.startState,
      thisSceneAction: scene.characterActions,
      thisSceneEnd: scene.endState,
      nextSceneHandoff: scene.nextSceneHandoff,
    };

    validScenes.push(scene);
  }

  // Sort strictly by sceneNumber
  validScenes.sort((a, b) => a.sceneNumber - b.sceneNumber);

  // Run the 10-dimension continuity validator across the entire timeline
  validateSceneContinuity(validScenes, characters);

  return validScenes;
}

/**
 * Builds the API application.
 *
 * Pure factory: no port listener, no static file serving, no Vite. The same
 * app is therefore usable as a Vercel Function handler (api/index.ts), or
 * wrapped by dev-server.ts locally, or by prod-server.ts when self-hosting.
 */
export function createApp() {
  const app = express();

  // Vercel caps a Function request/response body at 4.5 MB. Keeping Express
  // aligned means an oversized payload fails the same way in every runtime.
  app.use(express.json({ limit: "4.5mb" }));

  // On Vercel every /api/* path is rewritten to this one function. Depending
  // on how the request arrives the handler may or may not still carry the
  // /api prefix, so normalise it before the route table below is consulted.
  app.use((req, _res, next) => {
    if (req.url !== "/api" && !req.url.startsWith("/api/")) {
      req.url = `/api${req.url.startsWith("/") ? req.url : `/${req.url}`}`;
    }
    next();
  });

  // API Health Check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "Veggie Story Studio" });
  });

  // Story Generation API Endpoint with Cinematic Long-Form Story Engine
  app.post("/api/generate-story", async (req, res) => {
    try {
      const {
        language,
        topic,
        duration,
        storyMode,
        customMinutes,
        animationStyle,
        lockedCharacters,
      } = req.body;

      if (!topic || typeof topic !== "string" || !topic.trim()) {
        return res.status(400).json({ error: "Story topic is required." });
      }

      const selectedLanguage = language || "Roman Urdu";
      const selectedDuration = duration || "60 seconds";
      const selectedMode = storyMode || "Cinematic Emotional";
      const selectedStyle = animationStyle || "Cute 3D";
      const targetSceneCount = calculateTargetSceneCount(selectedDuration, customMinutes);
      const isLongForm = targetSceneCount >= 20 || selectedDuration.includes("4 minute") || selectedDuration.includes("5 minute");
      const targetTimelineDuration = formatTotalDuration(targetSceneCount);

      console.log(`[Generate Story] Topic: "${topic}", Duration: ${selectedDuration}, Target Scenes: ${targetSceneCount}, Mode: ${selectedMode}`);

      // ==========================================
      // PHASE 1: Generate Deep Narrative, Character Bible & Chapters
      // ==========================================
      // Dynamic narrative scale:
      const narrativeWordCount =
        targetSceneCount >= 54
          ? "1800–2400 words"
          : targetSceneCount >= 36
          ? "1300–1700 words"
          : targetSceneCount >= 24
          ? "900–1250 words"
          : targetSceneCount >= 12
          ? "450–650 words"
          : "200–350 words";

      const numChapters =
        targetSceneCount >= 54
          ? 12
          : targetSceneCount >= 36
          ? 8
          : targetSceneCount >= 24
          ? 6
          : targetSceneCount >= 12
          ? 4
          : 3;

      // ==========================================
      // PHASE 1A: Narrative Blueprint (story first, scenes second)
      // ==========================================
      const castTarget = targetCastSize(targetSceneCount);
      const beatTarget = targetBeatCount(targetSceneCount);
      console.log(
        `[Phase 1A] Designing narrative blueprint: ~${beatTarget} beats, ${castTarget.min}-${castTarget.max} characters, ${targetSceneCount} scenes.`
      );

      const blueprintContext = {
        topic: topic.trim(),
        language: selectedLanguage,
        duration: selectedDuration,
        storyMode: selectedMode,
        animationStyle: selectedStyle,
        targetSceneCount,
        numChapters,
        lockedCharacters:
          lockedCharacters && Array.isArray(lockedCharacters) && lockedCharacters.length > 0
            ? lockedCharacters
            : undefined,
      };

      const blueprintResponse = await generateText({
        prompt: buildBlueprintPrompt(blueprintContext),
        options: {
          systemInstruction: buildBlueprintSystemInstruction(blueprintContext),
          temperature: 0.8,
          responseMimeType: "application/json",
          responseSchema: BLUEPRINT_SCHEMA,
        },
      });

      if (!blueprintResponse.text) {
        throw new Error("The story architect returned an empty narrative blueprint. Please try again.");
      }

      let narrativeBlueprint: any;
      try {
        narrativeBlueprint = JSON.parse(blueprintResponse.text);
      } catch (err) {
        console.error("Failed to parse narrative blueprint JSON:", err);
        throw new Error("The narrative blueprint came back malformed. Please try again.");
      }

      const blueprintCast: any[] = Array.isArray(narrativeBlueprint.castPlan) ? narrativeBlueprint.castPlan : [];
      const blueprintBeats: any[] = Array.isArray(narrativeBlueprint.beats) ? narrativeBlueprint.beats : [];
      if (blueprintCast.length === 0 || blueprintBeats.length === 0) {
        throw new Error("The narrative blueprint was incomplete (no cast or no beats). Please try again.");
      }

      console.log(
        `[Phase 1A] Blueprint ready: ${blueprintCast.length} characters, ${blueprintBeats.length} beats, ` +
          `${(narrativeBlueprint.setups || []).length} setups, ${(narrativeBlueprint.relationships || []).length} relationship arcs.`
      );

      const phase1SystemInstruction = `You are a master children's animation director and screenplay writer (Pixar / Illumination quality).
You are creating the master screenplay, narrative, and Character Bible for a ${selectedDuration} (~${targetSceneCount} scenes) animated vegetable story.

STORY MODE: "${selectedMode}"
- Cinematic Emotional: Deep emotional stakes, heartfelt connection, vulnerable character moments, grand orchestral beats, and a tearfully joyful resolution.
- Cinematic: Sweeping movie-grade pacing, dramatic camera framing, atmospheric lighting.
- Heartwarming: Gentle, tender moments of vegetable care, cozy comfort, and empathy.
- Moral Story / Friendship / Adventure / Funny / Mystery / Fantasy: Infuse authentic virtues and character arcs.

==================================================
THE CAST IS ALREADY DECIDED BY THE STORY (CRITICAL):
==================================================
- The story department has already designed this film's cast around what the narrative needs. NEVER default or hardcode to 2 characters, and never add, remove or rename anyone.
- Use EXACTLY the ${blueprintCast.length} characters in the blueprint below, with their exact names, vegetable types and importance tiers.
- Generate the full 18-attribute Character Bible for EVERY single character in the cast.
- Each character's design must EXPRESS their dramatic role: their want, need and flaw should be legible in body shape, wardrobe, colour palette and typical expressions. A character whose flaw is stubbornness should look planted; one whose need is to be seen should be dressed to disappear.
- 'speakingStyle' and 'voicePersonality' must match the VOICE SIGNATURE the blueprint assigns them, so the scene department can write lines that are recognisable without a name tag.
- Every character must have an authoritative 'lockedVisualDescription' for Google Flow / Veo animation.

==================================================
SCREENPLAY - WRITE THE BLUEPRINT, DO NOT RE-PLOT IT:
==================================================
- The beat sheet below is the spine. Write the screenplay so every beat lands in its assigned scene range, in order.
- Preserve the causal chain: each beat happens BECAUSE of the previous one. Use "and therefore" / "but so" logic, never "and then".
- Dramatise the relationship arcs: their friction must be visible in how the characters speak to each other, and the turning point must actually turn.
- Plant every setup in its plant scene and pay it off in its payoff scene, with changed meaning.
- The emotional low point must be caused by a main character's flaw. Do not resolve it with luck, a new character, or an unearned change of heart.
- Give each character dialogue in proportion to their blueprint share, in their own voice. No two characters may sound interchangeable.
- NO FILLER: never restate a beat with new wording, never add aimless travel or repeated reassurance to reach length. If the story feels thin for ${selectedDuration}, deepen conflict and relationships rather than stretching events.
${
  targetSceneCount >= 24
    ? `For this long-form story (~${targetSceneCount} scenes, ${selectedDuration}):
- Structure the narrative across the ${numChapters} chapters defined in the blueprint, each ending on a change of state.
- Provide a full-length screenplay script (${narrativeWordCount}) with rich dialogue, character growth, and emotional progression carrying the beats above.`
    : `Structure the narrative across the ${numChapters} blueprint chapters with rich dialogue and emotional beats (${narrativeWordCount}).`
}

LANGUAGE: If "Hindi", write story, dialogues, moral in Devanagari Hindi. If "Urdu", write in Urdu script. If "Roman Urdu", write in fluent Roman Urdu.`;

      let phase1Prompt = `Create the master screenplay and Character Bible:
- Topic / Idea: "${topic.trim()}"
- Story Mode: ${selectedMode}
- Target Duration: ${selectedDuration} (Target Scene Count: ${targetSceneCount} scenes of ~10s each)
- Language: ${selectedLanguage}
- Animation Style: ${selectedStyle}
- Is Long-Form Cinematic: ${isLongForm ? `YES (${numChapters} Chapters with deep multi-act narrative arc)` : "Standard"}
- Cast: exactly ${blueprintCast.length} characters, as designed by the story department below

APPROVED NARRATIVE BLUEPRINT - THIS IS THE STORY. EXECUTE IT.
LOGLINE: ${narrativeBlueprint.logline}
THEME: ${narrativeBlueprint.theme}
CENTRAL QUESTION: ${narrativeBlueprint.centralQuestion}

CAST (names, types and dramatic design are fixed):
${JSON.stringify(blueprintCast, null, 2)}

RELATIONSHIP ARCS (must visibly evolve across the screenplay):
${JSON.stringify(narrativeBlueprint.relationships || [], null, 2)}

CAUSAL BEAT SHEET (each beat caused by the previous, mapped to scene ranges):
${JSON.stringify(blueprintBeats, null, 2)}

SETUPS AND PAYOFFS (plant and pay off exactly as specified):
${JSON.stringify(narrativeBlueprint.setups || [], null, 2)}

CHAPTERS:
${JSON.stringify(narrativeBlueprint.chapters || [], null, 2)}
`;

      if (lockedCharacters && Array.isArray(lockedCharacters) && lockedCharacters.length > 0) {
        phase1Prompt += `\nLOCKED MASTER CHARACTERS (Must use exact visual specifications):\n${JSON.stringify(
          lockedCharacters,
          null,
          2
        )}\n`;
      }

      const phase1Response = await generateText({
        prompt: phase1Prompt,
        options: {
          systemInstruction: phase1SystemInstruction,
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Catchy animated movie-like story title in chosen language" },
              tagline: { type: Type.STRING, description: "Short fun tagline or subtitle" },
              language: { type: Type.STRING, description: "Selected language" },
              duration: { type: Type.STRING, description: "Selected duration" },
              storyMode: { type: Type.STRING, description: "Story mode applied" },
              animationStyle: { type: Type.STRING, description: "Animation style applied" },
              isLongForm: { type: Type.BOOLEAN, description: "Whether this is a long-form cinematic story" },
              chapters: {
                type: Type.ARRAY,
                description: "List of story chapters",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    chapterNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    sceneRange: { type: Type.STRING },
                    summary: { type: Type.STRING },
                  },
                  required: ["chapterNumber", "title", "sceneRange"],
                },
              },
              characters: {
                type: Type.ARRAY,
                description: "List of anthropomorphic vegetable characters with full 18-point Character Bible",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    veggieType: { type: Type.STRING },
                    role: { type: Type.STRING },
                    importance: {
                      type: Type.STRING,
                      description: "MAIN, SUPPORTING, or MINOR",
                    },
                    personality: { type: Type.STRING },
                    agePersonalityFeel: { type: Type.STRING },
                    bodyShape: { type: Type.STRING },
                    faceDesign: { type: Type.STRING },
                    eyeStyleAndColor: { type: Type.STRING },
                    mouthStyle: { type: Type.STRING },
                    veggieFeatures: { type: Type.STRING },
                    clothing: { type: Type.STRING },
                    shoes: { type: Type.STRING },
                    accessories: { type: Type.STRING },
                    mainColors: { type: Type.STRING },
                    voicePersonality: { type: Type.STRING },
                    speakingStyle: { type: Type.STRING },
                    movementStyle: { type: Type.STRING },
                    typicalExpressions: { type: Type.STRING },
                    lockedVisualDescription: { type: Type.STRING },
                    emoji: { type: Type.STRING },
                    catchphrase: { type: Type.STRING },
                  },
                  required: [
                    "name",
                    "veggieType",
                    "role",
                    "personality",
                    "agePersonalityFeel",
                    "bodyShape",
                    "faceDesign",
                    "eyeStyleAndColor",
                    "mouthStyle",
                    "veggieFeatures",
                    "clothing",
                    "shoes",
                    "accessories",
                    "mainColors",
                    "voicePersonality",
                    "speakingStyle",
                    "movementStyle",
                    "typicalExpressions",
                    "lockedVisualDescription",
                    "emoji",
                  ],
                },
              },
              storySections: {
                type: Type.ARRAY,
                description: "Story sections and narrative chapters",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    chapterTitle: { type: Type.STRING },
                    scenePromptHint: { type: Type.STRING },
                  },
                  required: ["title", "content"],
                },
              },
              fullStoryText: {
                type: Type.STRING,
                description: "Complete read-aloud narrative script with dialogues and sound effects",
              },
              moral: {
                type: Type.STRING,
                description: "The wholesome moral / lesson of the story in the chosen language",
              },
              funQuestion: {
                type: Type.STRING,
                description: "An engaging discussion question for kids",
              },
            },
            required: [
              "title",
              "language",
              "duration",
              "characters",
              "chapters",
              "storySections",
              "fullStoryText",
              "moral",
            ],
          },
        },
      });

      const phase1RawJson = phase1Response.text;
      if (!phase1RawJson) {
        throw new Error("No response received from Gemini for story generation.");
      }

      const storyData = JSON.parse(phase1RawJson);
      storyData.duration = selectedDuration;
      storyData.storyMode = storyData.storyMode || selectedMode;
      storyData.isLongForm = isLongForm;
      storyData.animationStyle = storyData.animationStyle || selectedStyle;

      // The blueprint is the story of record; chapters come from it so beat and
      // scene ranges stay aligned with what the scene department receives.
      storyData.narrativeBlueprint = narrativeBlueprint;
      if (Array.isArray(narrativeBlueprint.chapters) && narrativeBlueprint.chapters.length > 0) {
        storyData.chapters = narrativeBlueprint.chapters;
      }

      const findArc = (name: string) =>
        blueprintCast.find((c: any) => {
          const a = String(c?.name || "").toLowerCase();
          const b = String(name || "").toLowerCase();
          return a && b && (a === b || a.includes(b) || b.includes(a));
        });

      storyData.characters = (storyData.characters || []).map((char: any, idx: number) => {
        const arc = findArc(char.name);
        return {
          ...char,
          id: char.id || `char_${char.veggieType?.toLowerCase().replace(/[^a-z0-9]/g, "") || "veggie"}_${idx + 1}`,
          // Importance is a story decision, so the blueprint wins over position.
          importance: arc?.importance || char.importance || (idx < 2 ? "MAIN" : idx < 4 ? "SUPPORTING" : "MINOR"),
          isLocked: true,
          // Dramatic design travels with the character into every scene prompt.
          want: arc?.want,
          need: arc?.need,
          flaw: arc?.flaw,
          strength: arc?.strength,
          voiceSignature: arc?.voiceSignature,
          narrativePurpose: arc?.narrativePurpose,
          arcStart: arc?.arcStart,
          arcMidpoint: arc?.arcMidpoint,
          arcEnd: arc?.arcEnd,
          approxDialogueShare: arc?.approxDialogueShare,
        };
      });
      storyData.charactersLocked = true;

      // ==========================================
      // PHASE 2: Generate All 10-Second Scenes via Orchestrated Batches (Supports up to 60 Scenes)
      // ==========================================
      console.log(`[Phase 2] Generating ${targetSceneCount} production scenes for "${storyData.title}"...`);

      const { scenes: generatedScenes, failures: sceneFailures } = await runSceneBatchPipeline({
        targetSceneCount,
        title: storyData.title,
        topic: topic.trim(),
        language: selectedLanguage,
        duration: selectedDuration,
        storyMode: selectedMode,
        animationStyle: selectedStyle,
        fullStoryText: storyData.fullStoryText,
        characters: storyData.characters,
        chapters: storyData.chapters,
        blueprint: narrativeBlueprint,
        logLabel: "Phase 2",
      });

      // Nothing usable came back. Fail loudly rather than shipping an empty or
      // invented timeline.
      if (generatedScenes.length === 0) {
        const firstReason = sceneFailures[0]?.reason || "no scenes were returned";
        throw new Error(
          `Scene generation failed for all ${sceneFailures.length} batch(es) of the ${targetSceneCount}-scene timeline. ${firstReason}`
        );
      }

      // ==========================================
      // PHASE 3: Strict Timeline Validation & Standardization
      // ==========================================
      storyData.scenes = validateAndStandardizeTimeline(generatedScenes, targetSceneCount, {
        title: storyData.title,
        language: selectedLanguage,
        storyMode: selectedMode,
        animationStyle: selectedStyle,
        fullStoryText: storyData.fullStoryText,
        chapters: storyData.chapters,
        characters: storyData.characters,
      });

      storyData.estimatedScenesCount = storyData.scenes.length;
      storyData.storyQuality = buildStoryQualityReport(
        storyData.scenes,
        narrativeBlueprint,
        storyData.characters
      );
      console.log(
        `[Story Quality] cast=${storyData.storyQuality.castSize} beats=${storyData.storyQuality.beatsCovered}/${storyData.storyQuality.beatCount} ` +
          `speakers=${storyData.storyQuality.dialogueDistribution.length} repeatedLines=${storyData.storyQuality.repeatedDialogueLines.length} ` +
          `fillerSuspects=${storyData.storyQuality.fillerSuspects.length} setups=${storyData.storyQuality.setupsPaidOff}/${storyData.storyQuality.setupsPlanted}`
      );
      storyData.sceneGeneration = buildSceneGenerationReport(
        targetSceneCount,
        storyData.scenes,
        sceneFailures
      );

      if (storyData.sceneGeneration.isComplete) {
        console.log(`[Generate Story] Successfully generated ${storyData.scenes.length} scenes (Timeline: 0:00 – ${targetTimelineDuration}).`);
      } else {
        console.warn(
          `[Generate Story] PARTIAL: ${storyData.sceneGeneration.generatedSceneCount} of ${targetSceneCount} scenes generated. Missing: ${storyData.sceneGeneration.missingSceneNumbers.join(", ")}. No placeholder scenes were inserted.`
        );
      }

      // Automatically generate Character Reference Studio packages for each character
      storyData.characterReferences = storyData.characters.map((char: any) =>
        buildCharacterReferencePackage(char, storyData.animationStyle || selectedStyle)
      );

      return res.json({ success: true, data: storyData });
    } catch (error: any) {
      console.error("Error generating veggie story:", error);
      return res.status(500).json({
        error: error.message || "Failed to generate story. Please check the server logs.",
      });
    }
  });

  // Dedicated 10-Second Scene Planner Regeneration Endpoint (All Scenes)
  app.post("/api/regenerate-scenes", async (req, res) => {
    try {
      const {
        story,
        characters,
        language,
        duration,
        storyMode,
        customMinutes,
        animationStyle,
        fullStoryText,
        topic,
        narrativeBlueprint,
      } = req.body;

      const currentText = fullStoryText || story?.fullStoryText;
      if (!currentText && !topic) {
        return res.status(400).json({ error: "Story text or topic is required to regenerate scenes." });
      }

      const selectedLanguage = language || story?.language || "Roman Urdu";
      const selectedDuration = duration || story?.duration || "60 seconds";
      const selectedMode = storyMode || story?.storyMode || "Cinematic Emotional";
      const selectedStyle = animationStyle || story?.animationStyle || "Cute 3D";
      const targetSceneCount = calculateTargetSceneCount(selectedDuration, customMinutes);
      const storyTitle = story?.title || topic;
      const storyChapters = story?.chapters || [];
      const storyChars = characters || story?.characters || [];
      // Reuse the approved blueprint so regenerated scenes serve the same
      // beats, arcs and setups as the story they belong to.
      const storyBlueprint = narrativeBlueprint || story?.narrativeBlueprint || null;

      console.log(`[Regenerate Scenes] Title: "${storyTitle}", Duration: ${selectedDuration}, Target Scenes: ${targetSceneCount}`);

      const { scenes: generatedScenes, failures: sceneFailures } = await runSceneBatchPipeline({
        targetSceneCount,
        title: storyTitle,
        topic: topic || storyTitle,
        language: selectedLanguage,
        duration: selectedDuration,
        storyMode: selectedMode,
        animationStyle: selectedStyle,
        fullStoryText: currentText || topic,
        characters: storyChars,
        chapters: storyChapters,
        blueprint: storyBlueprint,
        logLabel: "Regenerate Scenes",
      });

      if (generatedScenes.length === 0) {
        const firstReason = sceneFailures[0]?.reason || "no scenes were returned";
        throw new Error(
          `Scene regeneration failed for all ${sceneFailures.length} batch(es) of the ${targetSceneCount}-scene timeline. ${firstReason}`
        );
      }

      const standardizedScenes = validateAndStandardizeTimeline(generatedScenes, targetSceneCount, {
        title: storyTitle,
        language: selectedLanguage,
        storyMode: selectedMode,
        animationStyle: selectedStyle,
        fullStoryText: currentText || topic,
        chapters: storyChapters,
        characters: storyChars,
      });

      const sceneGeneration = buildSceneGenerationReport(
        targetSceneCount,
        standardizedScenes,
        sceneFailures
      );

      if (!sceneGeneration.isComplete) {
        console.warn(
          `[Regenerate Scenes] PARTIAL: ${sceneGeneration.generatedSceneCount} of ${targetSceneCount} scenes generated. Missing: ${sceneGeneration.missingSceneNumbers.join(", ")}. No placeholder scenes were inserted.`
        );
      }

      // Standard envelope: { success, data }. Top-level keys kept temporarily for compatibility.
      const storyQuality = buildStoryQualityReport(standardizedScenes, storyBlueprint, storyChars);

      return res.json({
        success: true,
        scenes: standardizedScenes,
        data: { scenes: standardizedScenes, sceneGeneration, storyQuality },
      });
    } catch (error: any) {
      console.error("Error regenerating scenes:", error);
      return res.status(500).json({
        error: error.message || "Failed to regenerate scenes.",
      });
    }
  });

  // Dedicated Single Scene Regeneration Endpoint with Strict Continuity Handoff
  app.post("/api/regenerate-single-scene", async (req, res) => {
    try {
      const {
        sceneNumber,
        targetSceneNumber,
        existingScene,
        currentSceneData,
        prevScene,
        previousScenePrompt,
        nextScene,
        nextScenePrompt,
        characters,
        language,
        duration,
        storyMode,
        animationStyle,
        fullStoryText,
        topic,
        narrativeBlueprint,
      } = req.body;

      const sceneNum = sceneNumber || targetSceneNumber || existingScene?.sceneNumber || currentSceneData?.sceneNumber || 1;
      const expectedTimeRange = formatTimeRange(sceneNum);
      const selectedLanguage = language || "Roman Urdu";
      const selectedMode = storyMode || "Cinematic Emotional";
      const selectedStyle = animationStyle || "Cute 3D";
      // A regenerated shot must still serve its beat, arcs and setups.
      const singleSceneSlice = sliceBlueprintForRange(narrativeBlueprint, sceneNum, sceneNum);

      const prevEnd = prevScene?.endState || prevScene?.characterActions || previousScenePrompt || "Opening shot of the film";
      const nextStart = nextScene?.startState || nextScene?.characterActions || nextScenePrompt || "Concluding resolution of the film";

      const systemInstruction = `You are a world-class children's animation director regenerating a SINGLE 10-second shot (Scene #${sceneNum} covering ${expectedTimeRange}).
Animation Style: ${selectedStyle}
Story Mode: ${selectedMode}
Language: ${selectedLanguage}

CORE DIRECTIVE — TRUE SHOT-TO-SHOT CONTINUITY BRIDGE:
This scene sits between Scene ${sceneNum - 1} and Scene ${sceneNum + 1}. You must bridge them seamlessly:
1. START STATE: Must exactly continue from Previous Scene End State:
   "${prevEnd}"
2. END STATE: Must lead directly into Next Scene Start State:
   "${nextStart}"
3. NO RESET: Retain character screen positions, held props, lighting, environment, and persistent emotional momentum.
4. MULTI-CHARACTER DIALOGUE: Format natural conversation with speaker tags in ${selectedLanguage}. Synchronize speech with physical actions and facial expressions. Populate 'dialogueTurns'.
5. FLOW / VEO PROMPT: English prompt starting with "CONTINUE DIRECTLY FROM PREVIOUS SHOT [Scene ${sceneNum - 1}]:" with motivated camera motion, lighting, Character Bible details, and continuity negative constraints.`
        + buildStoryIntelligenceDirectives({
          startScene: sceneNum,
          endScene: sceneNum,
          totalScenes: sceneNum,
          language: selectedLanguage,
          slice: singleSceneSlice,
        });

      const prompt = `Regenerate Scene #${sceneNum}:
Time Range: ${expectedTimeRange}
Duration: 10s
Story Context: ${fullStoryText || topic}
Characters Bible: ${JSON.stringify(characters || [], null, 2)}
PREVIOUS SCENE END STATE (MUST INHERIT): ${prevEnd}
NEXT SCENE START STATE (MUST HAND OFF INTO): ${nextStart}
Current Existing Scene Content: ${JSON.stringify(existingScene || currentSceneData || {}, null, 2)}
${buildBlueprintPromptBlock(singleSceneSlice, null)}
`;

      const response = await generateText({
        prompt,
        options: {
          systemInstruction,
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scene: {
                type: Type.OBJECT,
                properties: SCENE_PROPERTIES,
                required: REQUIRED_SCENE_FIELDS,
              },
            },
            required: ["scene"],
          },
        },
      });

      const rawJson = response.text;
      if (!rawJson) {
        throw new Error("No response received from Gemini.");
      }

      const parsed = JSON.parse(rawJson);
      const scene = parsed.scene;
      scene.sceneNumber = sceneNum;
      scene.timeRange = expectedTimeRange;
      scene.duration = "10s";

      if (!scene.startState) {
        scene.startState = `Direct continuation from Scene ${sceneNum - 1}: ${prevEnd}`;
      }
      if (!scene.endState) {
        scene.endState = `At 10.0s: ${scene.characterActions}. Finishing posture prepares for Scene ${sceneNum + 1}.`;
      }
      if (!scene.nextSceneHandoff) {
        scene.nextSceneHandoff = `Scene ${sceneNum + 1} must inherit character positions and held props.`;
      }

      scene.transitionContract = {
        previousSceneEnd: prevEnd,
        thisSceneStart: scene.startState,
        thisSceneAction: scene.characterActions,
        thisSceneEnd: scene.endState,
        nextSceneHandoff: scene.nextSceneHandoff,
      };

      return res.json({ success: true, scene, data: { scene } });
    } catch (error: any) {
      console.error("Error regenerating single scene:", error);
      return res.status(500).json({
        error: error.message || "Failed to regenerate scene.",
      });
    }
  });

  // Dedicated Timeline Continuity Validation Endpoint
  app.post("/api/validate-continuity", (req, res) => {
    try {
      const { scenes, characters } = req.body;
      if (!Array.isArray(scenes)) {
        return res.status(400).json({ error: "Scenes array is required." });
      }
      const cloned = JSON.parse(JSON.stringify(scenes));
      validateSceneContinuity(cloned, characters || []);
      return res.json({ success: true, data: { scenes: cloned } });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || "Failed to validate continuity." });
    }
  });

  // Dedicated Character Bible Regeneration API Endpoint
  app.post("/api/regenerate-characters", async (req, res) => {
    try {
      const { language, topic, storyMode, animationStyle, lockedCharacters } = req.body;

      if (!topic || typeof topic !== "string" || !topic.trim()) {
        return res.status(400).json({ error: "Story topic is required." });
      }

      const selectedLanguage = language || "Roman Urdu";
      const selectedMode = storyMode || "Cinematic Emotional";
      const selectedStyle = animationStyle || "Cute 3D";
      const systemInstruction = `You are a master character designer for animated vegetable children's stories in ${selectedStyle} style and mode "${selectedMode}".
Generate a comprehensive, reusable "Character Bible" for all characters suitable for the story topic.

DYNAMIC CAST SIZING:
- DO NOT default or hardcode to 2 characters!
- Analyze the narrative scope and story topic ("${topic.trim()}"). Provide a dynamic cast of 3 to 6 characters (protagonists, supporting friends, mentors, or community members).
- Every character must have a clear narrative purpose and role.
- Classify each character with an 'importance': 'MAIN' | 'SUPPORTING' | 'MINOR'.

For EVERY character, generate all 18 attributes:
1. Character name
2. Vegetable type
3. Role in the story
4. Importance ('MAIN', 'SUPPORTING', or 'MINOR')
5. Personality
6. Age/personality feel
7. Body shape and proportions
8. Face design
9. Eye style and color
10. Mouth/expression style
11. Vegetable-specific physical features
12. Clothing
13. Shoes
14. Accessories
15. Main colors
16. Voice personality
17. Speaking style
18. Movement style
Plus a 'lockedVisualDescription', typical emotional expressions, and an emoji.

CRITICAL:
- Each character must have a LOCKED visual identity.
- If existing locked characters are provided, preserve them exactly.`;

      let prompt = `Generate/update the Character Bible for:
- Topic: "${topic.trim()}"
- Story Mode: ${selectedMode}
- Language context: ${selectedLanguage}
- Animation Style: ${selectedStyle}
- Cast Requirement: Dynamic cast with clear MAIN, SUPPORTING, and MINOR characters.
`;

      if (lockedCharacters && Array.isArray(lockedCharacters) && lockedCharacters.length > 0) {
        prompt += `\nLOCKED CHARACTERS TO PRESERVE:\n${JSON.stringify(lockedCharacters, null, 2)}\n`;
      }

      const response = await generateText({
        prompt,
        options: {
          systemInstruction,
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              characters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    veggieType: { type: Type.STRING },
                    role: { type: Type.STRING },
                    importance: {
                      type: Type.STRING,
                      description: "MAIN, SUPPORTING, or MINOR",
                    },
                    personality: { type: Type.STRING },
                    agePersonalityFeel: { type: Type.STRING },
                    bodyShape: { type: Type.STRING },
                    faceDesign: { type: Type.STRING },
                    eyeStyleAndColor: { type: Type.STRING },
                    mouthStyle: { type: Type.STRING },
                    veggieFeatures: { type: Type.STRING },
                    clothing: { type: Type.STRING },
                    shoes: { type: Type.STRING },
                    accessories: { type: Type.STRING },
                    mainColors: { type: Type.STRING },
                    voicePersonality: { type: Type.STRING },
                    speakingStyle: { type: Type.STRING },
                    movementStyle: { type: Type.STRING },
                    typicalExpressions: { type: Type.STRING },
                    lockedVisualDescription: { type: Type.STRING },
                    emoji: { type: Type.STRING },
                    catchphrase: { type: Type.STRING },
                  },
                  required: [
                    "name",
                    "veggieType",
                    "role",
                    "personality",
                    "agePersonalityFeel",
                    "bodyShape",
                    "faceDesign",
                    "eyeStyleAndColor",
                    "mouthStyle",
                    "veggieFeatures",
                    "clothing",
                    "shoes",
                    "accessories",
                    "mainColors",
                    "voicePersonality",
                    "speakingStyle",
                    "movementStyle",
                    "typicalExpressions",
                    "lockedVisualDescription",
                    "emoji",
                  ],
                },
              },
            },
            required: ["characters"],
          },
        },
      });

      const rawJson = response.text;
      if (!rawJson) {
        throw new Error("No response received from Gemini.");
      }

      const parsed = JSON.parse(rawJson);
      const characters = (parsed.characters || []).map((char: any, idx: number) => ({
        ...char,
        id: char.id || `char_${char.veggieType?.toLowerCase().replace(/[^a-z0-9]/g, "") || "veggie"}_${idx + 1}`,
        importance: char.importance || (idx < 2 ? "MAIN" : idx < 4 ? "SUPPORTING" : "MINOR"),
        isLocked: true,
      }));

      // Standard envelope: { success, data }. Top-level keys kept temporarily for compatibility.
      return res.json({ success: true, characters, data: { characters } });
    } catch (error: any) {
      console.error("Error regenerating characters:", error);
      return res.status(500).json({
        error: error.message || "Failed to regenerate character bible.",
      });
    }
  });

  // Dedicated Character Reference Studio Packages Regeneration Endpoint (All Characters)
  app.post("/api/regenerate-character-references", async (req, res) => {
    try {
      const { characters, animationStyle } = req.body;

      if (!characters || !Array.isArray(characters) || characters.length === 0) {
        return res.status(400).json({ error: "Characters array is required." });
      }

      const style = animationStyle || "Cute 3D";
      const references = characters.map((char: any) =>
        buildCharacterReferencePackage(char, style)
      );

      // Standard envelope: { success, data }. Top-level keys kept temporarily for compatibility.
      return res.json({ success: true, characterReferences: references, data: { characterReferences: references } });
    } catch (error: any) {
      console.error("Error regenerating character references:", error);
      return res.status(500).json({
        error: error.message || "Failed to regenerate character reference packages.",
      });
    }
  });

  // Dedicated Single Character Reference Package Regeneration Endpoint
  app.post("/api/regenerate-single-character-reference", async (req, res) => {
    try {
      const { character, animationStyle } = req.body;

      if (!character || !character.name) {
        return res.status(400).json({ error: "Character data is required." });
      }

      const style = animationStyle || "Cute 3D";
      const reference = buildCharacterReferencePackage(character, style);

      // Standard envelope: { success, data }. Top-level keys kept temporarily for compatibility.
      return res.json({ success: true, reference, data: { reference } });
    } catch (error: any) {
      console.error("Error regenerating single reference:", error);
      return res.status(500).json({
        error: error.message || "Failed to regenerate character reference.",
      });
    }
  });

  // Character Reference Studio Direct Image Generation Endpoint (Optional Preview Asset)
  app.post("/api/generate-character-image", async (req, res) => {
    try {
      const { prompt, characterName } = req.body;

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Image generation prompt is required." });
      }

      console.log(`[Generate Character Image] Requesting visual asset for "${characterName}"...`);

      const response = await generateImage({ prompt });

      if (response.imageDataUrl) {
        const dataUrl = response.imageDataUrl;
        // Standard envelope: { success, data }. Top-level keys kept temporarily for compatibility.
        return res.json({ success: true, imageUrl: dataUrl, data: { imageUrl: dataUrl } });
      }

      return res.status(503).json({
        error: "Image generation model did not return image data. The prompt is ready to copy.",
      });
    } catch (error: any) {
      console.warn("Character image generation error:", error);
      return res.status(503).json({
        error: error.message || "Image model currently busy. Reference prompt is ready to copy.",
      });
    }
  });

  return app;
}

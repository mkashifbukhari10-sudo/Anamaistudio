import { Type } from "../ai/schema.js";
import { buildCraftDoctrine, buildSceneCraftRules, storyScale } from "./story-craft.js";
import { buildRecurringSeriesBlock, type RecurringSeriesBible } from "./recurring-series.js";
import { buildLedger } from "./continuity-director.js";
import {
  buildDialogueRegisterBlock,
  buildPlannedChangesBlock,
  buildSocialFactsBlock,
  buildSocialStateBlock,
  foldSocialDeltas,
  isEmptyGraph,
  normalizeSocialDeltas,
} from "./social-graph.js";
import { buildWorldFactsBlock, isEmptyRegistry } from "./world-registry.js";
import type { SocialGraph, SocialStateEntry, WorldRegistry } from "../../types.js";

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

/**
 * Normalise the user's cast-size control to an exact count, or undefined.
 *
 * 'Auto', absent values and anything unparseable all fall through to undefined,
 * which restores runtime-based sizing. Accepts a wider integer range than the
 * UI offers so an API caller is not artificially limited.
 */
export function normalizeCharacterCount(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "string" && raw.trim().toLowerCase() === "auto") return undefined;

  const parsed = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(parsed)) return undefined;

  const rounded = Math.round(parsed);
  if (rounded < 2 || rounded > 12) return undefined;
  return rounded;
}

/**
 * A meaningful cast sized to the story, never a hardcoded pair.
 *
 * An explicit count pins min and max to the same number, which the prompt
 * builders read as "exactly N". Size only: who those characters are stays
 * entirely up to the story.
 */
export function targetCastSize(sceneCount: number, explicitCount?: number | null): CastTarget {
  const exact = normalizeCharacterCount(explicitCount);
  if (exact !== undefined) return { min: exact, max: exact };

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
    worldRegistry: {
      type: Type.OBJECT,
      description:
        "The PERSISTENT WORLD: places with fixed identities, and the animals, people, belongings and infrastructure that recur in them. Facts, not scenery - once established they must stay consistent for the whole film. Invent only what THIS story needs. CRITICAL: nothing here is a story character and nothing here consumes the cast size.",
      properties: {
        places: {
          type: Type.ARRAY,
          description:
            "Locations with a persistent identity, so they are referenced rather than re-invented each scene. Include only places the story actually visits or refers to.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description:
                  "Stable id, ALWAYS prefixed 'place_', e.g. 'place_courtyard', 'place_kitchen'. Never reuse a household id here - households and places are different things with separate id namespaces.",
              },
              name: { type: Type.STRING, description: "How the story refers to it, e.g. 'the courtyard'" },
              belongsToHousehold: { type: Type.STRING, description: "Household id that owns it, if any" },
              fixedFeatures: {
                type: Type.ARRAY,
                description:
                  "Things ALWAYS true of this place that must never change between scenes, e.g. 'a neem tree at the north wall, a charpai beneath it'",
                items: { type: Type.STRING },
              },
              connectsTo: { type: Type.ARRAY, description: "Ids of places reachable from here", items: { type: Type.STRING } },
            },
            required: ["id", "name", "fixedFeatures"],
          },
        },
        entities: {
          type: Type.ARRAY,
          description:
            "Animals, neighbours, shopkeepers, belongings and infrastructure that recur. NONE of these are story characters and NONE consume the cast size. Include only what the story needs; an empty list is correct for stories with no recurring world objects.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "Stable id, ALWAYS prefixed 'entity_', e.g. 'entity_goat'" },
              kind: { type: Type.STRING, description: "One of: animal, villager, belonging, infrastructure" },
              name: { type: Type.STRING, description: "Name, only where the story needs one" },
              tier: {
                type: Type.STRING,
                description:
                  "RECURRING only if it will ACTUALLY APPEAR in named scenes and needs continuity - it must have real planned presence, not just make the world feel furnished. BACKGROUND for visual texture that needs no tracking. If you cannot say which scenes it appears in, it is BACKGROUND or it should be omitted.",
              },
              ownerHouseholdId: { type: Type.STRING, description: "The 'household_' id that owns it, if any" },
              homePlaceId: { type: Type.STRING, description: "The 'place_' id where it normally is" },
              caredForBy: { type: Type.STRING, description: "Character responsible for it, if any" },
              speech: {
                type: Type.STRING,
                description:
                  "ANIMALS ONLY, decided once for the whole world: 'speaking' (talks in words), 'expressive' (no words, but readable in face and body), or 'mute' (an ordinary animal). Choose deliberately - it is a world rule and can never change later.",
              },
              storyRelevance: { type: Type.STRING, description: "Why it matters, if it does" },
              plannedAppearances: {
                type: Type.STRING,
                description:
                  "REQUIRED for RECURRING: which scenes or beats this entity actually appears in and what it does there, e.g. 'scenes 2-3 being fed, scene 10 when the family leaves'. If you cannot name where it appears, it is not RECURRING - mark it BACKGROUND or leave it out entirely.",
              },
            },
            required: ["id", "kind", "tier"],
          },
        },
      },
      required: ["places", "entities"],
    },
    socialGraph: {
      type: Type.OBJECT,
      description:
        "The IMMUTABLE social facts of this story: who each character is to every other, who lives together, life stages and everyday responsibilities. These are FACTS, not personality templates - a label records WHO someone is to another, never HOW they behave. Invent them from this story's topic and needs; never reuse a default family or a stock arrangement.",
      properties: {
        bonds: {
          type: Type.ARRAY,
          description:
            "Directional relationships. State the FORWARD direction for each pair; the reciprocal is derived from 'inverse'. Cover every pair whose relationship matters, INCLUDING stable ones that never change - a parent-child bond is a fact even when it carries no arc.",
          items: {
            type: Type.OBJECT,
            properties: {
              from: { type: Type.STRING, description: "Character name this bond points FROM" },
              to: { type: Type.STRING, description: "Character name this bond points TO" },
              type: {
                type: Type.STRING,
                description:
                  "The CANONICAL relationship of 'from' to 'to', in plain English regardless of the story's language: parent, child, older sibling, younger sibling, grandparent, grandchild, cousin, friend, neighbour, classmate, teacher, student, shopkeeper. NEVER a name or a term of address - writing 'Ammi is Mooli's Ammi' or 'Baji is Mooli's Baji' is circular and carries no information. Characters may still be NAMED and ADDRESSED however the story's language does; this field records the underlying relationship, not what they are called. A LABEL ONLY - it must never imply a temperament.",
              },
              inverse: {
                type: Type.STRING,
                description:
                  "The canonical reciprocal, also in plain English: 'parent' -> 'child', 'older sibling' -> 'younger sibling', 'teacher' -> 'student'. For symmetric bonds repeat the word: 'classmate' -> 'classmate'.",
              },
              authority: {
                type: Type.STRING,
                description:
                  "Direction of care or responsibility, structural only: 'cares-for' (from is responsible for to), 'peer', or 'defers-to' (to is responsible for from). Set it from what THIS story establishes, not from the relationship label - an older sibling is only 'cares-for' if the story actually gives them that responsibility, otherwise they are a 'peer'. This is NOT a statement about strictness or warmth.",
              },
              sharedHistory: {
                type: Type.STRING,
                description: "One line of shared past if the story has one, otherwise omit",
              },
            },
            required: ["from", "to", "type", "inverse"],
          },
        },
        households: {
          type: Type.ARRAY,
          description:
            "Groups who live together, if this story has any. Invent the arrangement the story needs - do not assume any particular family structure. Omit entirely for stories where nobody shares a home.",
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description:
                  "Stable id, ALWAYS prefixed 'household_', e.g. 'household_1'. A household is a GROUP OF PEOPLE, never a location - the place they live is a separate 'place_' entry.",
              },
              name: { type: Type.STRING, description: "How the story refers to it, e.g. 'the house past the tube well'" },
              memberIds: { type: Type.ARRAY, description: "Character names living here", items: { type: Type.STRING } },
            },
            required: ["id", "name", "memberIds"],
          },
        },
        characterSocial: {
          type: Type.ARRAY,
          description: "Per-character social attributes. One entry per cast member.",
          items: {
            type: Type.OBJECT,
            properties: {
              characterId: { type: Type.STRING, description: "Character name" },
              lifeStage: {
                type: Type.STRING,
                description:
                  "Where they are in life, invented for this story: e.g. 'small child', 'schoolchild', 'young adult', 'parent with grown children', 'elder'. Informs capability and what they are trusted with - NOT temperament.",
              },
              householdId: { type: Type.STRING, description: "Household they belong to, if any" },
              responsibilities: {
                type: Type.ARRAY,
                description: "What they are counted on for in everyday life, if the story establishes any",
                items: { type: Type.STRING },
              },
            },
            required: ["characterId", "lifeStage"],
          },
        },
        plannedChanges: {
          type: Type.ARRAY,
          description:
            "The relationship TURNING POINTS this story will actually dramatise - moments where how two characters stand with each other genuinely shifts. Plan only the ones that matter: a 12-scene story typically has one to three, a long film more. Many relationships legitimately never change and belong nowhere in this list. NEVER plan a change to the relationship TYPE itself - a parent does not stop being a parent. Leave empty only if no relationship changes in this story at all.",
          items: {
            type: Type.OBJECT,
            properties: {
              characterA: { type: Type.STRING },
              characterB: { type: Type.STRING },
              dimension: {
                type: Type.STRING,
                description: "What shifts, named for this story: trust, tension, understanding, closeness, a promise, a responsibility, an unresolved disagreement",
              },
              atBeat: { type: Type.INTEGER, description: "Beat number where this shift happens" },
              intendedChange: { type: Type.STRING, description: "What it becomes, in one line" },
            },
            required: ["characterA", "characterB", "dimension", "atBeat", "intendedChange"],
          },
        },
      },
      required: ["bonds", "characterSocial", "plannedChanges"],
    },
    relationships: {
      type: Type.ARRAY,
      description:
        "Relationship ARCS: pairings whose dynamic visibly changes over the runtime. This is the CHANGE layer on top of socialGraph, which holds the fixed facts. A pair may appear in socialGraph only (a stable bond with no arc), or in both.",
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
  required: ["logline", "theme", "centralQuestion", "castPlan", "socialGraph", "worldRegistry", "relationships", "beats", "setups", "chapters"],
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
  /**
   * Exact cast size when the user pinned one. Undefined means Auto, which
   * keeps runtime-based sizing. Controls SIZE only.
   */
  characterCount?: number;
  lockedCharacters?: any[];
  /**
   * OPTIONAL recurring-series mode. Undefined on the normal path, which keeps
   * generation fully dynamic. Supplied only when a caller is writing an
   * episode of a series the user has defined.
   */
  seriesBible?: RecurringSeriesBible;
}

/**
 * The cast-size paragraph.
 *
 * With an explicit count the number is a hard requirement, but everything
 * ABOUT those characters stays invented. The anti-filler line matters most
 * here: a pinned cast must not become a reason to pad the story with
 * characters who have nothing to do.
 */
function buildCastSizeDirective(cast: CastTarget, exactCast: number | undefined, sceneCount: number): string {
  if (exactCast === undefined) {
    return `- This runtime (${sceneCount} scenes) needs ${cast.min} to ${cast.max} characters. Decide the exact number from what THIS story requires.
- NEVER default to two characters. A duo is only correct if the story is genuinely about exactly two people.`;
  }

  return `- EXACT CAST SIZE: this story must contain EXACTLY ${exactCast} characters. Not ${exactCast - 1}, not ${exactCast + 1}. The user set this deliberately and it is a hard requirement.
- The number is fixed; WHO they are is not. Invent all ${exactCast} characters from this topic, duration, language and mode, exactly as you would otherwise.
- Give every one of the ${exactCast} a real function: a distinct role in the plot, a relationship with at least one other character, and participation that matters to the outcome.
- PARTICIPATION IS NOT EQUAL SCREEN TIME. A cast of ${exactCast} will naturally have leads and smaller parts, and that is correct. Weight presence by what the story needs, never by fairness.
- DO NOT invent filler dialogue or filler action to give everyone a turn. A character who speaks only twice but changes the outcome is doing their job; a character padded with lines to fill a quota is damaging the film.
- If a character has nothing to do, that is a signal to give them a real dramatic purpose - a competing want, a secret, a relationship that shifts - never to invent filler scenes for them.
- If ${exactCast} characters is more than this ${sceneCount}-scene runtime can develop deeply, keep the PLOT simple and let some characters carry a single clear function each. Simplify the story, never drop a character.`;
}

export function buildBlueprintSystemInstruction(ctx: BlueprintContext): string {
  const exactCast = normalizeCharacterCount(ctx.characterCount);
  const cast = targetCastSize(ctx.targetSceneCount, ctx.characterCount);
  const castSizeDirective = buildCastSizeDirective(cast, exactCast, ctx.targetSceneCount);
  const beats = targetBeatCount(ctx.targetSceneCount);

  // Recurring-series mode is opt-in and caller-supplied. With no bible passed
  // — the normal path — nothing is prepended and generation is fully dynamic.
  const seriesBlock = ctx.seriesBible ? `${buildRecurringSeriesBlock(ctx.seriesBible)}\n\n` : "";

  return `${seriesBlock}${buildCraftDoctrine({
    storyMode: ctx.storyMode,
    targetSceneCount: ctx.targetSceneCount,
    duration: ctx.duration,
    language: ctx.language,
  })}

You are a master animation story architect - the story department that works BEFORE any shot is planned. You are writing the structural blueprint for a ${ctx.duration} animated children's film ("${ctx.storyMode}" mode) told with anthropomorphic vegetable characters.

You are NOT writing scenes. You are deciding what the story IS, who it needs, and why each moment causes the next. Invent the world, the cast and the shape this particular topic requires.

You are NOT writing scenes. You are deciding what the story IS, who it needs, and why each moment causes the next.

==================================================
1. CAST - ${exactCast ? "SIZE SET BY THE USER" : "SIZED BY THE STORY, NEVER BY DEFAULT"}
==================================================
${castSizeDirective}
- Every character must answer: "what collapses if I remove them?" Delete anyone who is decoration.
- Classify each as MAIN (drives the spine), SUPPORTING (changes the outcome at least once) or MINOR (colours the world, appears in a handful of scenes).
- Give every MAIN and SUPPORTING character a WANT (external, visible, actable) and a NEED (the internal truth they resist), plus a FLAW that will directly cause the setback later.
- FILMABLE TEST on every want: if you cannot photograph it, it is a theme, not a want. Rewrite it until it is a concrete, visible objective with something at stake.
- Give every character a VOICE SIGNATURE: a MECHANICAL rule invented for this character - sentence length, a syntax habit, what they do with questions, a construction they repeat, something they never say. Not an adjective: "optimistic" and "anxious" produce identical dialogue, while "never finishes a sentence" produces distinguishable dialogue. Derive it from who this character is in THIS story.
- Two characters must never be interchangeable. With the names removed, a reader must still know who is speaking.
- Assign each an approximate dialogue share. MAIN characters do not have to split lines evenly, but no character with speaking presence may be silent for the whole middle of the film.

==================================================
1b. THE WORLD - PLACES AND WHAT LIVES IN THEM
==================================================
Fill 'worldRegistry' with the persistent world THIS story needs. Invent it from the topic; never reuse a default setting, layout, animal or culture.

THREE TIERS, AND THEY ARE NOT INTERCHANGEABLE:
  A. STORY CAST ('castPlan') - has a WANT and an ARC. These are the only entries that count toward the cast size above.
  B. RECURRING ENTITIES ('worldRegistry.entities', tier RECURRING) - a household animal, a shopkeeper, a school bell, a cart. Appears repeatedly, needs continuity, has NO dramatic arc. Does NOT count toward cast size and gets no character design.
  C. BACKGROUND ('worldRegistry.entities', tier BACKGROUND) - people at the well, birds, passing traffic. Texture only. Does NOT count and gets no design.

- THE RULE: if it has a want and an arc it is a CHARACTER; otherwise it is an ENTITY. Never pad 'castPlan' with animals or bystanders, and never quietly promote a talking entity into the cast.
- If an animal or a neighbour genuinely IS a protagonist of this story - it carries a want and changes - then put it in 'castPlan' deliberately, and it DOES count toward the cast size. That is a decision, not an accident.
- PLACES: give every location the story actually uses an id and its 'fixedFeatures' - the things always true of it. Scenes reference the id instead of re-describing the place, which is what stops the same room drifting across the film.
- REGISTER EACH DISTINCT RECURRING LOCATION SEPARATELY. A kitchen, a courtyard, an animal shed, a school and a shop are different places and each needs its own 'place_' entry when the story returns to it. Do NOT collapse them into one entry for the whole home. Do NOT register a location the story visits once in passing.
- ANIMALS: decide 'speech' ONCE - speaking, expressive, or an ordinary mute animal. It is a rule of this world and can never change later. Do not default to talking animals; most village animals are not.
- DO NOT REGISTER AN ANIMAL OR ENTITY JUST TO MAKE THE WORLD LOOK RURAL. Mark it RECURRING only if it genuinely appears in the story you are planning. If it is only atmosphere, mark it BACKGROUND or leave it out. A registered animal that never appears is a broken promise to the audience.
- OWNERSHIP AND HOME: say which household owns an animal or belonging, where it normally is, and who cares for it. These are facts that later scenes must respect.
- Only register what the story needs. A two-hander in a single room needs one place and no entities. An empty 'entities' list is correct far more often than a long one.
- SIZE TO THE RUNTIME (${ctx.targetSceneCount} scenes): ${
    ctx.targetSceneCount < 8
      ? "at this length, ONE place and almost certainly NO entities. Do not build a world you have no room to show."
      : ctx.targetSceneCount < 24
      ? "at this length, one or two places and at most a couple of entities."
      : ctx.targetSceneCount < 48
      ? "at this length, a handful of places and the entities the story actually returns to."
      : "at this length a fuller world is worth establishing - recurring places, household animals, neighbours - but every entry must still appear in the film."
  }

==================================================
2a. SOCIAL FACTS - WHO EVERYONE IS TO EACH OTHER
==================================================
- Fill 'socialGraph' with the FIXED social truth of this story, separate from any arc.
- Cover EVERY pair whose relationship matters, INCLUDING stable ones that never change. A parent-child bond is a fact even when it carries no arc; leaving it out is how a parent silently becomes a friend later.
- State each bond in ONE direction with its 'inverse'. The reciprocal is completed automatically and must agree.
- USE CANONICAL RELATIONSHIP WORDS, not names or terms of address. If a character is named "Ammi" or called "Baji", the bond type is still 'parent' or 'older sibling'. "Ammi is Mooli's Ammi" is circular and tells the scene department nothing. The dialogue can and should use whatever the language naturally uses.
- Invent the arrangement THIS story needs. Do not assume a family story, and do not assume any particular family structure when there is one. Two strangers, three classmates, a shopkeeper and a regular customer are all valid social graphs.
- A RELATIONSHIP LABEL IS A FACT, NOT A PERSONALITY TEMPLATE. It records who someone IS to another, never how they behave. Do NOT write a strict father, a nurturing mother, a wise elder, a stern teacher or a naive child because of a label. Their behaviour comes from the want, need, flaw, strength, life stage and situation you design for them individually - the same as any other character.
- Give every cast member a 'lifeStage'. It informs what they can reach, carry, understand and are trusted with. It does NOT make anyone childish, wise or authoritative by default.
- Add 'responsibilities' only where the story establishes them. These are everyday duties, and they are a rich source of ordinary conflict and affection.
- Only create households if people in this story actually live together. Omit them otherwise.
- PLAN THE RELATIONSHIP TURNING POINTS in 'socialGraph.plannedChanges'. Identify the specific beats where how two characters stand with each other genuinely shifts - someone gives in, forgives, refuses, understands, takes on another's burden, or breaks a promise. The scene department will emit the matching socialChange when it dramatises that beat. Plan only what really changes: a relationship that stays the same all story belongs nowhere in this list, and inventing shifts to fill the field is worse than leaving it empty.
- SIZE TO THE RUNTIME (${ctx.targetSceneCount} scenes): ${
    ctx.targetSceneCount < 8
      ? "at this length record only the bonds between characters who actually share a scene, and skip households entirely unless the story is about a home."
      : "record every bond that matters, including stable ones, plus households where people share a home."
  }

==================================================
2b. RELATIONSHIPS THAT EVOLVE
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
- ESCALATING ATTEMPTS: where the runtime and the mode support it (see the scale and mode guidance above), structure the middle as escalating attempts at the want - each failing differently and costing more than the last. Do NOT force a fixed number of attempts onto a runtime too short to carry them, or onto a mode that escalates by revelation or by repetition instead.
- Whichever beat resolves the story must COST something: a resource, a relationship, a belief, or an admission the character resisted making. A win that costs nothing plays flat.
- ENDING: decide whether this story is stronger granting the want or denying it while delivering the need. Both are legitimate; choose deliberately and say which in the beat's purpose.
- Prefer a final beat whose meaning lands in an IMAGE or an ACTION over one that lands in a line of dialogue. A character explaining what they learned is almost always weaker than a character simply acting differently.

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
  const exactCast = normalizeCharacterCount(ctx.characterCount);
  const cast = targetCastSize(ctx.targetSceneCount, ctx.characterCount);
  const beats = targetBeatCount(ctx.targetSceneCount);

  let prompt = `Design the complete narrative blueprint.

- Topic / Idea: "${ctx.topic}"
- Story Mode: ${ctx.storyMode}
- Runtime: ${ctx.duration} = exactly ${ctx.targetSceneCount} scenes of 10 seconds each
- Chapters: ${ctx.numChapters}
- Beat budget: about ${beats} beats (use fewer if the story is complete without them)
- Cast: ${exactCast !== undefined ? `EXACTLY ${exactCast} characters (user-selected), each given a real dramatic function` : `${cast.min}-${cast.max} characters, each dramatically necessary`}
- Language: ${ctx.language}
- Animation Style: ${ctx.animationStyle}

Beat scene ranges must tile scenes 1 to ${ctx.targetSceneCount} with no gaps and no overlaps.
Setups must reference scene numbers inside 1 to ${ctx.targetSceneCount}.
`;

  // Opt-in only: a caller may pin characters (a continuing series, a user's
  // saved cast, a regeneration). With none supplied the cast is invented.
  if (ctx.lockedCharacters && ctx.lockedCharacters.length > 0) {
    prompt += `\nLOCKED CHARACTERS - these must appear in the cast with these exact names and types. Build their goals, flaws and arcs around the existing identities:\n${JSON.stringify(
      ctx.lockedCharacters.map((c: any) => ({
        name: c.name,
        veggieType: c.veggieType,
        role: c.role,
        voiceRule: c.speakingStyle || c.personality || undefined,
      })),
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
  /** Immutable social facts, carried into every batch so bonds cannot drift. */
  socialGraph: SocialGraph | null;
  /** Persistent places and entities, carried whole for the same reason. */
  worldRegistry: WorldRegistry | null;
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
    // Facts are never sliced by scene range: every batch gets the whole graph,
    // which is precisely what stops a relationship being reinterpreted later.
    socialGraph: blueprint.socialGraph ?? null,
    worldRegistry: blueprint.worldRegistry ?? null,
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
  /**
   * Where relationships currently stand, folded from every delta so far.
   * Latest value per pair-and-dimension, never the full history.
   */
  socialState: SocialStateEntry[];
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
/**
 * Every object the film is currently tracking - held and set down - folded
 * across all scenes so far. Falls back to the last scene's prop line when no
 * structured state is available.
 */
function describeLedgerProps(scenesSoFar: any[]): string {
  const ledger = buildLedger(scenesSoFar || []);
  const held = [...ledger.characters.values()]
    .filter((c) => c.holding)
    .map((c) => `${c.name} holds ${c.holding}`);
  const placed = [...ledger.placedProps];
  const parts = [...held, ...placed.map((p) => `set down: ${p}`)];
  return parts.length > 0 ? truncate(parts.join("; "), 400) : "";
}

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
    // Accumulated across every scene, not just the last one, so an object
    // introduced early is still tracked when it matters forty scenes later.
    activeProps: describeLedgerProps(scenesSoFar) || truncate(last?.props, 200),
    openSetups,
    emotionalTrajectory,
    // Folded, not accumulated: a 60-scene story carries a short current-state
    // list rather than a growing history of every shift.
    socialState: foldSocialDeltas(normalizeSocialDeltas(ordered)),
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
export function buildBlueprintPromptBlock(
  slice: BlueprintSlice | null,
  memory: StoryMemory | null,
  charactersPresent?: string[]
): string {
  const sections: string[] = [];

  // Social facts lead, before any arc or beat. They are the frame everything
  // else is read inside, and they are identical in every batch by design.
  const graph: SocialGraph | null = slice?.socialGraph ?? null;
  if (graph && !isEmptyGraph(graph)) {
    sections.push(buildSocialFactsBlock(graph));
    const register = buildDialogueRegisterBlock(graph, charactersPresent);
    if (register) sections.push(register);
  }

  // World facts sit beside social facts: also unsliced, also identical in
  // every batch, so a place cannot be re-imagined late in the film.
  const registry: WorldRegistry | null = slice?.worldRegistry ?? null;
  if (registry && !isEmptyRegistry(registry)) {
    sections.push(buildWorldFactsBlock(registry));

    // Entities with a planned appearance in this range, so a RECURRING entity
    // actually recurs instead of being registered and forgotten.
    const plan = registry.entities
      .filter((e) => e.tier === "RECURRING" && e.plannedAppearances)
      .map((e) => `  - ${e.name || e.id}: ${e.plannedAppearances}`);
    if (plan.length > 0) {
      sections.push(
        `RECURRING ENTITIES WITH PLANNED APPEARANCES:\n${plan.join("\n")}\n` +
          `- Where the plan places one of these inside this scene range, it must actually be present and behave consistently with its recorded facts.\n` +
          `- Do not force it into scenes outside its plan.`
      );
    }
  }

  if (graph && !isEmptyGraph(graph)) {
    const beatNumbers = (slice?.activeBeats ?? [])
      .map((b: any) => Number(b?.beatNumber))
      .filter((n: number) => Number.isFinite(n));
    const plannedBlock = buildPlannedChangesBlock(graph, beatNumbers);
    if (plannedBlock) sections.push(plannedBlock);
  }

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

${buildSocialStateBlock(memory.socialState)}

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

/**
 * STORY CRAFT DOCTRINE — genre- and scale-adaptive.
 *
 * Craft principles only. There is no fixed world here, no standing cast, no
 * house worldview and no prescribed voices: the engine invents all of that per
 * request, from the user's topic, duration, language and story mode.
 *
 * The rules below are the kind a story editor applies to ANY script — want vs
 * need, filmable goals, escalation, cost, distinct voices, earned endings — and
 * they are emitted differently depending on what is actually being written. A
 * 30-second slapstick short and a ten-minute mystery need different structural
 * advice, so forcing one formula on both would damage the shorter and flatten
 * the stranger.
 *
 * Nothing in this module names a character, a place or a lesson.
 */

export interface CraftContext {
  storyMode: string;
  targetSceneCount: number;
  duration: string;
  language: string;
  /**
   * True when this batch contains the story's last scene. The closing scene is
   * where summarising dialogue appears most often, so it gets an extra guard.
   */
  includesFinalScene?: boolean;
  /**
   * Forward-compatible with a future Setting control. 'auto' (the default)
   * means the topic decides. A named setting narrows guidance; it never seeds.
   */
  setting?: StorySetting;
}

// ---------------------------------------------------------------------------
// SCALE
//
// Runtime decides how much structure a story can carry. A three-scene film
// cannot support a three-attempt escalation, and insisting on one produces
// filler; a sixty-scene film that only tries once is a thin plot stretched.
// ---------------------------------------------------------------------------

export type StoryScale = "micro" | "short" | "standard" | "long";

export function storyScale(sceneCount: number): StoryScale {
  if (sceneCount < 8) return "micro";
  if (sceneCount < 24) return "short";
  if (sceneCount < 48) return "standard";
  return "long";
}

const SCALE_DOCTRINE: Record<StoryScale, string> = {
  micro: `SCALE - MICRO (very short):
- ONE want, ONE obstacle, ONE turn. Nothing else fits.
- No subplot, no second relationship line, no cast the audience must track.
- A single attempt that fails and a single response that resolves it is the whole shape. Do NOT force a three-attempt escalation into this runtime - there is no room and it becomes filler.
- The ending can be a single image. At this length an image is often stronger than any line.`,

  short: `SCALE - SHORT:
- ONE clear want, TWO escalating obstacles, one genuine turn.
- At most one relationship carries emotional weight. A second dilutes both.
- Two attempts is usually the right shape; a third only if it genuinely raises the cost rather than repeating the second.`,

  standard: `SCALE - STANDARD:
- A full want-to-need arc with room for three escalating attempts, where the genre supports it.
- One relationship line that starts somewhere and ends somewhere different.
- A midpoint that reverses what the characters believe the problem is, or who can solve it.`,

  long: `SCALE - LONG:
- A full arc plus a genuine second act: a subplot or a second relationship line that intersects the main one and changes its outcome.
- Scale the AMBITION to fill the runtime - more obstacles, deeper relationships, higher cost - never the same thin plot slowed down.
- Every chapter must end on a change of state, not a pause.
- If the premise is too small for this length, deepen it with a complication that raises cost. Never repeat a beat with different words.`,
};

// ---------------------------------------------------------------------------
// GENRE
//
// Different modes escalate differently. A mystery does not escalate by trying
// harder; it escalates by the answer getting worse. Slapstick escalates by
// repetition with variation. Applying one structural template to all of them
// is what makes generated stories feel identical regardless of prompt.
// ---------------------------------------------------------------------------

interface GenreShape {
  escalation: string;
  ending: string;
  dialogue: string;
}

const DEFAULT_SHAPE: GenreShape = {
  escalation:
    "Escalate by raising cost: each attempt should risk or lose something the previous one did not.",
  ending:
    "Resolve by change, not by luck. What the protagonist does differently at the end must be traceable to what they learned.",
  dialogue: "Natural spoken rhythm. Characters talk to each other, not to the audience.",
};

const GENRE_SHAPES: Array<{ match: RegExp; shape: GenreShape }> = [
  {
    match: /mystery/i,
    shape: {
      escalation:
        "Escalate by REVELATION, not by effort: question, clue, a false answer confidently believed, then the real answer that reframes everything before it. Do not use a try-fail-try-harder spine here - it flattens a mystery.",
      ending:
        "The revelation must be surprising and, in hindsight, inevitable - every clue fairly planted on screen. The final beat lands when the audience re-reads an earlier image correctly.",
      dialogue:
        "Characters withhold. What is NOT said carries the tension. Let a line imply more than it states.",
    },
  },
  {
    match: /funny|slapstick|comedy/i,
    shape: {
      escalation:
        "Escalate by REPETITION WITH VARIATION: the same mistake returns bigger and at a worse moment. Comic escalation runs on rhythm and on the audience seeing it coming before the character does.",
      ending:
        "The biggest consequence lands last. Whatever indignity occurs is repaired before the end - nobody is left humiliated.",
      dialogue:
        "Short, punchy, well-timed. The funniest line is usually the shortest. Reactions carry more comedy than jokes.",
    },
  },
  {
    match: /adventure|quest/i,
    shape: {
      escalation:
        "Escalate PHYSICALLY and geographically: each obstacle is harder, further and costlier than the last, and closes a route back.",
      ending:
        "The final obstacle must be beaten with something established earlier - a skill, an ally or an object introduced before it was needed.",
      dialogue: "Active and forward-driving. Decisions spoken aloud under pressure.",
    },
  },
  {
    match: /moral/i,
    shape: {
      escalation:
        "Escalate by making the right choice progressively more expensive. The lesson only means something if following it costs the character something real.",
      ending:
        "DRAMATISE the lesson, never announce it. The character ACTS differently, and the audience understands why without being told. A closing line that summarises the moral is the weakest possible ending - use an image or an action instead.",
      dialogue: "Plain and sincere. Avoid characters lecturing one another.",
    },
  },
  {
    match: /fantasy/i,
    shape: {
      escalation:
        "Escalate within fixed rules: establish what is possible early and never break it to solve a problem. Magic may CAUSE problems; it must not conveniently resolve them.",
      ending:
        "The resolution must obey the rules established in the first act. A power that appears only when needed voids the stakes retroactively.",
      dialogue: "Grounded and concrete even when the world is not. Wonder reads best against plain speech.",
    },
  },
  {
    match: /emotional|heartwarming|friendship/i,
    shape: {
      escalation:
        "Escalate by RELATIONAL cost: each beat puts more of the relationship at risk, and the low point must be caused by a character's flaw rather than by external accident.",
      ending:
        "The strongest ending here is an ACTION, not a speech - something given up, something handed over, a gesture that costs the character. Let the image carry the feeling.",
      dialogue:
        "Understated. People in real feeling say less, not more. Resist having characters narrate their own emotions.",
    },
  },
  {
    match: /simple kids/i,
    shape: {
      escalation:
        "Escalate simply and visibly: the problem gets bigger in a way a young child can SEE. One clear cause per step.",
      ending:
        "Warm, clear and complete. Resolve fully - no ambiguity, no unanswered question at this age.",
      dialogue: "Very short lines. Simple, concrete vocabulary. One idea per line.",
    },
  },
];

export function genreShape(storyMode: string): GenreShape {
  const found = GENRE_SHAPES.find((g) => g.match.test(storyMode || ""));
  return found ? found.shape : DEFAULT_SHAPE;
}

// ---------------------------------------------------------------------------
// UNIVERSAL CRAFT
//
// These hold regardless of genre, scale or language.
// ---------------------------------------------------------------------------

const UNIVERSAL_CRAFT = `WANT AND NEED:
- Every MAIN character has a WANT: external, visible and ACTABLE, with something at stake if they miss it.
- FILMABLE TEST: if you cannot photograph it, it is a theme and not a want. "Wants to be braver" fails the test. "Wants to carry the lantern to the far gate before the light goes" passes it. Rewrite any want that fails.
- Every MAIN character also has a NEED: the internal truth they resist. The story works by pressuring the want until the need surfaces.
- The want does NOT have to be granted. Denying the want while delivering the need is frequently the stronger ending - decide which this story earns.

CONSEQUENCE AND COST:
- Every turning point must COST something: a resource, a relationship, a belief, an admission the character did not want to make.
- A victory that costs nothing teaches nothing and plays flat.
- The emotional low point must be caused by a MAIN character's FLAW, not by bad luck, coincidence or a villain who simply shows up.

DISTINCT VOICES - INVENT THEM, DO NOT DESCRIBE THEM:
- Give each speaking character a MECHANICAL voice rule derived from who THIS character is: sentence length, a syntax habit, what they do with questions, a recurring construction, what they never say.
- Adjectives do not create voice. "Optimistic" and "anxious" produce two characters who sound identical. A rule like "never finishes a sentence" or "answers a question with a question" produces dialogue that is actually distinguishable.
- Derive these from the story you are telling. Do not reuse voice rules between stories.
- VOICE TEST: with the names removed, a reader must still be able to tell who is speaking. If two characters could be swapped unnoticed, rewrite them.

THE LESSON IS DRAMATISED, NEVER ANNOUNCED (ABSOLUTE):
- No character, and no narration, may state, summarise, explain or label what the story means. Not in the last scene, not anywhere.
- THE TEST, applied to every line you write: could this line appear in a one-sentence summary of the story's message? If yes, DELETE IT and replace it with something the character DOES.
- A second test: strip the line out. If the audience would still understand the meaning from the actions, images and reactions alone, the line was decoration explaining what was already clear - cut it.
- Meaning is carried by CHOICE, ACTION, CONSEQUENCE, SACRIFICE, REACTION and FINAL IMAGERY. A character who gives something up, turns back, hands something over, or simply stops - shows the audience everything a summarising line would flatten.
- This applies in EVERY language. Do not translate an explaining line into the target language and consider it solved; a summary is a summary in any language.
- Silence is NOT required. Ordinary dialogue in the final scene is welcome when it is what these characters would actually say to each other in that moment - a question, a small practical remark, a name spoken. What is forbidden is dialogue that TELLS THE AUDIENCE WHAT TO THINK.
- The character may realise something. They may not narrate the realisation.

ENDINGS:
- Endings must be EARNED: traceable to a decision the character made, not delivered by rescue, coincidence or an authority figure arriving to fix it.
- Any surprise must be inevitable in hindsight - planted earlier, in plain sight.

ANTI-FILLER:
- Every scene must DO something. It must achieve at least ONE of: a fact learned; a relationship shifted; a decision taken; a resource gained or lost; a character revealed; what is normal here established; a setup planted or paid off; an emotion changed; a responsibility established; anticipation built.
- That list is deliberately wide: a quiet scene qualifies easily. What does NOT qualify is a scene that happens because it would realistically happen. A scene achieving nothing on the list is filler and must be cut or rewritten.
- Never repeat a beat with different words to fill runtime.
- Every character must answer "what collapses if I remove them?" Delete anyone who is decoration.

ANTAGONISM:
- Opposition works best when it is REASONABLE. Give whoever opposes the protagonist a want that makes sense from their own position.
- A character who is simply bad is the least interesting obstacle available.`;

// ---------------------------------------------------------------------------
// SETTING
//
// Forward-compatible with a future Setting control (Auto / Village / City /
// School / Home / Fantasy). Nothing is wired to a UI yet: 'auto' means the
// topic decides, which is today's behaviour. A named setting only NARROWS the
// capability text - it never seeds content, and no setting is the default.
// ---------------------------------------------------------------------------

export type StorySetting = "auto" | string;

const SETTING_HINTS: Array<{ match: RegExp; hint: string }> = [
  {
    match: /village|rural|farm|countryside/i,
    hint: "This story's world is rural. Establish the parts of it the story actually uses and keep them consistent.",
  },
  { match: /city|urban|town/i, hint: "This story's world is urban. Let its density, noise and pace shape ordinary life." },
  { match: /school/i, hint: "This story centres on school life. Let timetables, classmates and small institutional rules shape it." },
  { match: /home|household|family/i, hint: "This story stays close to home. Let domestic space and shared routine carry it." },
  { match: /fantasy|magic/i, hint: "This world is fantastical. Everyday life still has rules - establish them and never break them for convenience." },
];

function settingHint(setting?: string): string {
  const value = String(setting ?? "auto").trim();
  if (!value || value.toLowerCase() === "auto") return "";
  const found = SETTING_HINTS.find((s) => s.match.test(value));
  return found ? found.hint : `This story's world is: ${value}. Establish it coherently and hold it.`;
}

// ---------------------------------------------------------------------------
// EVERYDAY LIFE
//
// CAPABILITY, never content. Nothing below seeds a village, a culture, a
// family, an animal, a layout or a routine. It tells the Story Director that
// ordinary life is legitimate material and what a lived-in world CAN contain,
// then leaves every choice to the story.
// ---------------------------------------------------------------------------

const EVERYDAY_SCALE: Record<StoryScale, string> = {
  micro: `- At this length: ONE moment of ordinary life, in ONE place. Do not establish a household, a routine or a village you have no room to use.`,
  short: `- At this length: one or two places and a small slice of routine. Establish only what the story touches.`,
  standard: `- At this length: a household or a small circle, a few places, and a routine the story can return to and vary.`,
  long: `- At this length: a genuinely lived-in world. Recurring places, established routines, responsibilities that recur, neighbours and community life, and change over the course of the film.`,
};

function buildEverydayLifeDoctrine(ctx: CraftContext): string {
  const scale = storyScale(ctx.targetSceneCount);
  const hint = settingHint(ctx.setting);

  return `--------------------------------------------------
EVERYDAY LIFE - CAPABILITY, NOT A CHECKLIST
--------------------------------------------------
${hint ? `${hint}\n` : ""}- Ordinary life is legitimate story material. A morning, a meal, a walk to school, a chore shared or dodged, a visit to a neighbour - any of these can carry a scene without danger, a villain, a twist or a lesson.
- Not every story is a family story, and not every story is an everyday story. Use this only where the topic calls for it.
${EVERYDAY_SCALE[scale]}

QUIET SCENES ARE VALID - BUT THEY STILL EARN THEIR PLACE:
- A scene with no conflict is fine. A scene with no PURPOSE is not.
- A quiet scene must do at least ONE of: reveal character; develop a relationship; establish what normal looks like here; plant or pay off something; change an emotion; advance a small goal; create a consequence; establish a responsibility; build anticipation for what is coming.
- What it must never be: a scene that exists because it is realistic. Breakfast that reveals nothing is filler with a plate in front of it.
- Small stakes are still stakes. A chore forgotten, a promise half-kept, a seat taken by someone else - these carry real feeling at this scale, and they do not need to escalate into danger.

IF THIS STORY'S WORLD IS RURAL OR A VILLAGE, it MAY draw on any of the following - these are POSSIBILITIES to choose from, never a checklist to complete:
  homes and the spaces inside them; a courtyard or shared outdoor space; fields, gardens or crops; paths between houses; a school; a shop or market; water sources; shade and gathering places; neighbouring households; household and agricultural work; seasons and weather; meals; visits; festivals and gatherings; animals kept by families.
- Choose ONLY what this story uses. A story about two children and a lost slipper needs a doorway and a path, not an entire village.
- Whatever you choose becomes a FACT in the World Registry and must then stay consistent for the whole film.

ANIMALS, IF THE STORY HAS ANY:
- Decide ownership, where the animal normally stays, who feeds or cares for it, and its speech mode - ONCE, in the World Registry.
- Most animals in an ordinary world do NOT talk. A talking animal is a deliberate rule of the world, never a default.
- An animal can carry a scene through a chore, a small problem or an attachment. It does not need a dramatic arc to matter, and giving it one turns it into a character who counts toward the cast.

WORLD COHERENCE:
- Architecture, clothing, food, work, transport, school life, objects and social behaviour must all belong to ONE world. Never mix details from unrelated places or periods.
- If the topic or language establishes a particular region or culture, keep it consistently throughout.
- If nothing establishes one, invent a single coherent world and hold it. Do NOT default to any particular country, region, religion or ethnicity.`;
}

// ---------------------------------------------------------------------------
// SCENE-LEVEL CRAFT
// ---------------------------------------------------------------------------

/**
 * Rules for writing individual short scenes.
 *
 * Kept separate from the blueprint doctrine because it is consumed by the
 * scene department, which runs per batch rather than once per story.
 */
export function buildSceneCraftRules(ctx: CraftContext): string {
  const shape = genreShape(ctx.storyMode);
  const isFinalScene = Boolean(ctx.includesFinalScene);
  const isYoung = /simple kids|funny|slapstick/i.test(ctx.storyMode || "");
  const lineLength = isYoung
    ? "SIX TO TEN WORDS per line"
    : "roughly EIGHT TO FOURTEEN WORDS per line";

  return `- A scene needs a PURPOSE, not necessarily a CONFLICT. A quiet everyday moment is valid when it reveals character, develops a relationship, establishes what normal looks like here, plants or pays off something, shifts an emotion, establishes a responsibility or builds anticipation. It is NOT valid when it merely depicts something realistic.
   - ONE PRIMARY EMOTIONAL BEAT PER SCENE. A short scene carries one feeling. A scene attempting two carries neither.
   - LINE LENGTH: ${lineLength}. No speeches. Long lines wreck the pacing of a short shot and defeat lip-sync.
   - DIALOGUE REGISTER for this story: ${shape.dialogue}
   - OBEY EACH CHARACTER'S OWN VOICE RULE as defined in the blueprint's cast plan. Apply it mechanically and consistently in every line they speak.
   - VOICE TEST: with the speaker names removed, a reader must still know who is speaking. If two lines could be swapped between characters, rewrite them.
   - DO NOT have characters narrate their own emotions or explain the story's meaning. Show it in action, expression and behaviour.
   - THE LESSON IS NEVER SPOKEN. Before writing any line, apply this test: could this line appear in a one-sentence summary of what the story means? If yes, delete it and replace it with something the character DOES. This holds in every language - translating an explaining line does not fix it.
   - Characters talk TO each other - asking, answering, reacting, deciding - never to the audience.${
     isFinalScene
       ? `
   - THIS IS THE FINAL SCENE. It is where summarising dialogue appears most often, so guard it hardest: no character may say what they learned, what matters most, or what the story was about. Close on a CHOICE, an ACTION, a REACTION or an IMAGE. Ordinary dialogue is still allowed - a question, a name, a small practical remark - as long as it does not tell the audience what to think.`
       : ""
   }`;
}

// ---------------------------------------------------------------------------
// ASSEMBLY
// ---------------------------------------------------------------------------

/**
 * The craft doctrine for one request, assembled from its scale and genre.
 *
 * Used by the blueprint stage. Contains no fixed story content - only the
 * principles, selected and phrased for what is actually being written.
 */
export function buildCraftDoctrine(ctx: CraftContext): string {
  const scale = storyScale(ctx.targetSceneCount);
  const shape = genreShape(ctx.storyMode);

  return `==================================================
STORY CRAFT DOCTRINE - adapted to THIS request
==================================================
Mode: ${ctx.storyMode} | Runtime: ${ctx.duration} (${ctx.targetSceneCount} scenes) | Scale: ${scale.toUpperCase()}

Invent everything this story needs - world, cast, relationships, conflict,
structure and ending - from the topic and the controls above. The rules below
are craft standards for judging your own choices, not content to reproduce.

--------------------------------------------------
${SCALE_DOCTRINE[scale]}

--------------------------------------------------
SHAPE FOR THIS MODE (${ctx.storyMode}):
- ESCALATION: ${shape.escalation}
- ENDING: ${shape.ending}
- DIALOGUE: ${shape.dialogue}

${buildEverydayLifeDoctrine(ctx)}

--------------------------------------------------
${UNIVERSAL_CRAFT}
==================================================`;
}

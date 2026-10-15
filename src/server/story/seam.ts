/**
 * SEAM IDENTITY — one frame, one text, two uses.
 *
 * Flow renders every clip alone, so the only thing joining two clips is whether
 * the operator's two prompts describe the same instant at the boundary. They
 * did not. Measured over a real 36-scene generation, the frame a clip had to
 * START from was specified in 328 words and the frame it had to LAND on in 54 -
 * a 6.1x asymmetry. Veo was never told to produce the state the next clip was
 * told to open on, so every one of the 35 joins carried a visible jump.
 *
 * The fix is not a better instruction, it is shared data. One description of the
 * instant between clip N and clip N+1 is rendered ONCE and used twice: as scene
 * N's closing frame and as scene N+1's opening frame, the same text both times.
 * Symmetry stops being something the model is asked to achieve and becomes a
 * property of the artifact.
 *
 * This module owns that text. It does NOT own the body of the prompt - style,
 * character identity, action, dialogue, camera and sound stay the model's work.
 */

/**
 * Clip-relative timestamps.
 *
 * 'endState' is authored as an ENDING ("Exact visual ending state at 10.0s"),
 * and the old pipeline pasted it verbatim as an OPENING - so 24 of 36 prompts
 * began by telling Veo that frame one occurs at the ten-second mark, then
 * described ten seconds of action after it. A seam text is used at both ends of
 * a join, so it cannot carry a timestamp from either side.
 *
 * Numeric rather than hardcoded to 10, because SECONDS_PER_SCENE is a constant
 * that can change and stories of other durations must clean equally well.
 */
const CLIP_TIMESTAMP_PATTERNS: RegExp[] = [
  /^\s*At\s+(?:the\s+)?[\d.]+\s*(?:s|sec|secs|second|seconds)\b\s*(?:mark)?\s*[:,-]?\s*/i,
  /^\s*At\s+(?:the\s+)?[\d.]+[\s-]*second\s+mark\b\s*[:,-]?\s*/i,
  /^\s*By\s+(?:the\s+)?(?:end|close)\s+of\s+(?:the\s+)?(?:shot|clip|scene)\b\s*[:,-]?\s*/i,
  /^\s*At\s+(?:the\s+)?(?:end|close)\s+of\s+(?:the\s+)?(?:shot|clip|scene)\b\s*[:,-]?\s*/i,
];

/**
 * Sentences that talk ABOUT the next scene rather than describing the frame.
 *
 * Fallback end states are assembled as "... Characters hold finishing posture
 * for Scene 12 handoff." That is production scaffolding: it names a scene
 * number, which section 6 forbids in a Flow prompt, and it describes an
 * intention rather than an image. Stripped wholesale rather than reworded,
 * because nothing in it is visual.
 */
const HANDOFF_SENTENCE_PATTERNS: RegExp[] = [
  /[^.]*\bfor\s+Scene\s*#?\d+\s+handoff\b[^.]*\.\s*/gi,
  /[^.]*\bprepares?\s+(?:the\s+\w+\s+)?for\s+Scene\s*#?\d+\b[^.]*\.\s*/gi,
  /[^.]*\bScene\s*#?\d+\s+must\s+inherit\b[^.]*\.\s*/gi,
  /[^.]*\bhandoff\s+(?:to|for)\s+Scene\s*#?\d+\b[^.]*\.\s*/gi,
  /[^.]*\bready\s+for\s+(?:the\s+)?next\s+(?:scene|shot|clip)\b[^.]*\.\s*/gi,
];

/** Labels the model uses for a frame statement. All four appear in real output. */
const FRAME_LABEL =
  /(?:\b(?:Opening|First|Closing|Final|Last)\s+frame\b(?:\s*,\s*described\s+exactly)?|The\s+shot\s+(?:opens|ends)\s+on)\s*[:,-]?\s*/gi;

/**
 * A frame statement short enough to be only a frame statement.
 *
 * The model sometimes runs the opening frame and the entire character bible
 * together in one block ("First frame: a tiny round mustard-seed character named
 * Beeju ... <300 words of locked visual description>"). Removing that span would
 * delete the identity anchor that holds the character stable across independent
 * generations - the single most expensive thing to lose. So a long span, or one
 * carrying a bible marker, keeps its content and loses only its label.
 */
const SAFE_STATEMENT_CHARS = 400;

/**
 * The cap for a statement known to be an injected endState prefix.
 *
 * Those ran to four or five sentences in real output, past the general cap,
 * which left their tail sitting unlabelled in the body restating the frame the
 * assembler had just attached. They cannot be a bible, so they get more room.
 */
const INJECTED_PREFIX_CHARS = 1200;
const BIBLE_MARKER = /\bCHARACTER\b\s*:|\blocked\s+visual\b|\bcharacter\s+bible\b/i;

/**
 * Where a frame statement stops and the prompt body starts.
 *
 * A frame statement often runs several sentences ("... body tipped forward.
 * Behind him Motu's silhouette is rising into view. The camera has drifted a
 * step to the right."), so stopping at the first full stop leaves most of the
 * duplicate behind. Sentences are consumed until one of these markers shows the
 * body has begun - the style declaration and the character bible both reliably
 * open it - or until the character cap is reached.
 */
const BODY_START_MARKER =
  /\b(?:cute\s+3d|pixar|animation\s+style|animated\s+(?:shot|scene)|palette|CHARACTER\s*:|camera\s*:|action\s*:|sound\s*:|foley|score\s*:)/i;

/**
 * What kind of thing this prompt is asking for, stated before anything else.
 *
 * Exists because a generation came back as a comic page rather than a shot. The
 * prompt necessarily carries several parts - style, identity, action, timing,
 * sound - and a stack of parts can be read as a page layout. This says it is one
 * continuous piece of film before any of the parts are read.
 */
const SHOT_DECLARATION_BODY =
  "A single continuous live-action-style animated film shot, filmed in one " +
  "unbroken take by one moving camera. The whole frame is one picture at all " +
  "times: no panels, no split screen, no grid, no storyboard, no comic layout, " +
  "no inset frames, and no written words or speech balloons drawn over the " +
  "picture.";

/**
 * How speech is rendered, on the dialogue-bearing default.
 *
 * A wordless pack replaces this through `applyFrameBookends`, and must say
 * something rather than nothing: a video model handed silence with no
 * instruction invents mouth movement, and - measured in a real generation -
 * also invents drawn speech balloons. The declaration is the one place in the
 * prompt where that is settled before any content is read.
 */
export const DEFAULT_SPEECH_DECLARATION =
  "All dialogue is SPOKEN aloud by the characters and lip-synced.";

export const SHOT_DECLARATION = `${SHOT_DECLARATION_BODY} ${DEFAULT_SPEECH_DECLARATION}`;

/** The declaration with this film's own account of speech. */
export function shotDeclaration(speech?: string): string {
  const clause = String(speech ?? "").trim() || DEFAULT_SPEECH_DECLARATION;
  return `${SHOT_DECLARATION_BODY} ${clause}`;
}

/**
 * How the two seam frames are introduced.
 *
 * The seam TEXT either side of a join stays byte-identical - that is Phase A's
 * whole point - so only the lead-in differs, and both read as direction rather
 * than as form fields.
 */
export const OPENING_LEAD = "The shot opens on: ";
export const CLOSING_LEAD = "The shot ends on: ";

/** Whitespace and orphaned punctuation left behind by a removal. */
function tidy(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/^[\s,:;.\-–—]+/, "")
    .trim();
}

/**
 * The description of the instant a clip ends - usable unchanged as the next
 * clip's opening frame.
 *
 * Prefers the authored 'endState', which is where the pipeline's continuity
 * actually lives and which chains faithfully today. Falls back to composing one
 * from 'continuityState' only when the end state is missing or too thin to
 * describe a frame, so that a seam always exists and the two sides of a join
 * can never disagree by one side being absent.
 */
export function buildSeamText(scene: any): string {
  const fromEndState = normaliseFrameText(scene?.endState);
  if (fromEndState.length >= 40) return fromEndState;

  const composed = composeFromContinuity(scene);
  if (composed.length >= 40) return composed;

  // Last resort: the action itself, stated as a resting image.
  const action = normaliseFrameText(scene?.characterActions);
  return action || fromEndState || composed;
}

/**
 * Strips clip-relative time, forward references and frame labels from a piece of
 * state prose, leaving a tense-neutral description of an image.
 */
export function normaliseFrameText(raw: unknown): string {
  let text = String(raw ?? "").trim();
  if (!text) return "";

  FRAME_LABEL.lastIndex = 0;
  text = text.replace(FRAME_LABEL, "");

  for (const pattern of CLIP_TIMESTAMP_PATTERNS) {
    text = text.replace(pattern, "");
  }

  for (const pattern of HANDOFF_SENTENCE_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, "");
  }

  text = tidy(text);
  return text.replace(/[\s.]+$/, "");
}

/**
 * A frame description assembled from the structured continuity snapshot.
 *
 * Only used when 'endState' cannot carry the seam. Ordered the way a shot is
 * read - who is where, holding what, feeling what, then the world around them,
 * then the camera - so the fallback still reads as a frame rather than a dump.
 */
function composeFromContinuity(scene: any): string {
  const cs = scene?.continuityState;
  if (!cs || typeof cs !== "object") return "";

  const parts: string[] = [];
  const push = (value: unknown) => {
    const s = String(value ?? "").trim().replace(/[\s.]+$/, "");
    if (s && !/^(none|n\/a|-+)$/i.test(s)) parts.push(s);
  };

  push(cs.characterPositions);
  push(cs.characterPoses);
  push(cs.heldProps);
  push(cs.characterEmotions);
  push(cs.placedProps);
  push(cs.location);
  push(cs.environmentState);
  push(cs.lighting);
  push(cs.cameraPosition);
  // The background population, when the scene recorded one. A crowd that is not
  // restated is re-invented: in a finished film the onlookers behind a fight
  // changed completely between two consecutive clips of the same match.
  push(cs.backgroundCast);

  return tidy(parts.join(". "));
}

/**
 * Removes the model's own frame statements so the code-owned frames are the only
 * ones in the prompt.
 *
 * Content is never discarded on a guess: a span that is long or carries the
 * character bible keeps its text and loses only the label, so at worst a
 * redundant sentence survives as ordinary description. Deleting a bible would
 * break character identity; leaving a sentence in costs a few words.
 */
/**
 * The end of the frame statement beginning at 'from'.
 *
 * Consumes whole sentences while they still look like frame description, and
 * stops at the first sign the body has begun. Bounded by SAFE_STATEMENT_CHARS so
 * a prompt that never shows a body marker cannot lose an unlimited span.
 */
function findStatementEnd(text: string, from: number): number {
  let cursor = from;

  // An injected endState prefix is known not to be a bible, so it is allowed to
  // run to the body marker rather than being cut off at the general cap.
  const cap = /^\s*At\s+(?:the\s+)?[\d.]+\s*(?:s|sec|secs|second|seconds)\b/i.test(text.slice(from, from + 40))
    ? INJECTED_PREFIX_CHARS
    : SAFE_STATEMENT_CHARS;

  while (cursor - from < cap) {
    const rest = text.slice(cursor);
    const terminator = rest.search(/\.(?:\s|$)/);
    if (terminator < 0) return text.length;

    const sentenceEnd = cursor + terminator + 1;
    const sentence = text.slice(cursor, sentenceEnd);

    // This sentence already belongs to the body - stop before it.
    if (BODY_START_MARKER.test(sentence) || BIBLE_MARKER.test(sentence)) {
      return cursor > from ? cursor : sentenceEnd;
    }

    cursor = sentenceEnd;
  }

  return cursor;
}

export function stripFrameStatements(prompt: string): string {
  let text = String(prompt ?? "");
  const removals: Array<[number, number]> = [];

  FRAME_LABEL.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FRAME_LABEL.exec(text)) !== null) {
    const start = match.index;
    const afterLabel = start + match[0].length;
    const end = findStatementEnd(text, afterLabel);
    const span = text.slice(afterLabel, end);

    // A frame statement that opens with a clip timestamp is the old injected
    // endState prefix - "Opening frame: At 10.0s Beeju stands ...". It is never
    // a character bible, so it can be removed whole however long it runs.
    // Without this it survives the length cap unlabelled and sits in the body
    // restating the frame the assembler just attached.
    const isInjectedPrefix = /^\s*At\s+(?:the\s+)?[\d.]+\s*(?:s|sec|secs|second|seconds)\b/i.test(span);

    if ((span.length <= SAFE_STATEMENT_CHARS || isInjectedPrefix) && !BIBLE_MARKER.test(span)) {
      removals.push([start, end]);
    } else {
      // Keep the content, drop the label only.
      removals.push([start, afterLabel]);
    }
  }

  for (const [start, end] of removals.reverse()) {
    text = text.slice(0, start) + " " + text.slice(end);
  }

  return tidy(text);
}

/**
 * Assembles the prompt with code-owned frames at both ends.
 *
 * The opening is the previous scene's seam text and the closing is this scene's,
 * so for every adjacent pair the closing frame of one prompt and the opening
 * frame of the next are the same string. That identity is the whole point: it is
 * what the 6.1x asymmetry measurement said was missing.
 */
export function applyFrameBookends(
  prompt: string,
  frames: {
    opening?: string;
    closing?: string;
    clock?: string;
    worldText?: string;
    bystanders?: string;
    style?: string;
    /**
     * This film's account of how speech is rendered. Omitted means the
     * dialogue-bearing default, so every existing caller is unchanged.
     */
    speech?: string;
  }
): string {
  // The style preamble is stripped BEFORE the frame statements, because a
  // batch often opens with style and frame fused into one sentence.
  const body = stripFrameStatements(stripStylePreamble(prompt));
  const opening = String(frames.opening ?? "").trim().replace(/[\s.]+$/, "");
  const closing = String(frames.closing ?? "").trim().replace(/[\s.]+$/, "");
  const clock = String(frames.clock ?? "").trim();
  const worldText = String(frames.worldText ?? "").trim();
  const bystanders = String(frames.bystanders ?? "").trim();
  const style = String(frames.style ?? "").trim();

  const sections: string[] = [];
  // Said FIRST, before anything else. A real generation came back as a
  // four-panel comic page with the dialogue drawn in speech balloons: the
  // prompt is a stack of labelled sections and the model was reading it as a
  // layout brief. This states what kind of thing is being made before it reads
  // any of the parts.
  sections.push(shotDeclaration(frames.speech));
  // Second, before any content: what this film looks like. Byte-identical in
  // every scene, so three batches cannot render three different-looking films.
  if (style) sections.push(style);
  if (opening) sections.push(`${OPENING_LEAD}${opening}.`);
  if (body) sections.push(collapseInline(body));
  // Stated as a fact about the scene rather than as "render this text", which
  // pulled toward an illustrated page. The wording is identical in every scene
  // showing this sign - the repetition that holds character identity, applied
  // to the least stable thing the model renders.
  if (worldText) {
    sections.push(`The lettering visible in the shot reads exactly "${worldText}".`);
  }
  // The clock sits between the body and the closing frame: after the shot has
  // been described, before the frame it lands on. Prose, NOT rows - a
  // timestamped list is the shape of a storyboard and was being rendered as one.
  if (clock) sections.push(clock);
  // Everyone on screen who is not speaking. After the clock because it runs
  // throughout rather than at a moment, and stated at all because a present
  // character with nothing planned renders as a statue.
  if (bystanders) sections.push(bystanders);
  if (closing) sections.push(`${CLOSING_LEAD}${closing}.`);

  return sections.join("\n\n").trim();
}

/** Prose sections are single-spaced; only the clock keeps its line breaks. */
function collapseInline(text: string): string {
  return text.replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * The two frames a scene's prompt is bookended with.
 *
 * Scene 1 has no predecessor, so its opening comes from its own 'startState' -
 * the film's first image, which is equally a fact the prompt should state
 * absolutely rather than leave to the model's paraphrase.
 */
export function buildSceneFrames(
  scene: any,
  prevScene?: any | null
): { opening: string; closing: string } {
  const opening = prevScene
    ? buildSeamText(prevScene)
    : normaliseFrameText(scene?.startState);

  return { opening, closing: buildSeamText(scene) };
}

/* ------------------------------------------------------------------------- *
 * STYLE LOCK — one visual style sentence for the whole film.
 *
 * WHY THIS EXISTS
 *
 * Section 6 of the batch instruction asks the model to write "the animation
 * style and palette" as part of the prompt body. It does - and it writes a
 * fresh one per batch, because each batch is an independent completion that
 * never sees the prose the previous batch chose. A real 36-scene generation
 * came back with the style sentence changing at EXACTLY the 12-scene batch
 * boundaries:
 *
 *   scenes  1-12  "Stylized 3D cartoon animation"        dialogue in "double"
 *   scenes 13-24  "Children's 3D cartoon animation style" dialogue in 'single'
 *   scenes 25-36  "Stylized cartoon 3D animation"         dialogue in "double"
 *
 * Veo reads three different style instructions and renders three visually
 * different films, with the seams landing at 2:00 and 4:00 - a defect no amount
 * of frame handoff can repair, because the two clips either side of the seam
 * were told to look like different things.
 *
 * The fix is the same shape as SEAM IDENTITY: stop asking the model to achieve
 * consistency and make it a property of the artifact. One sentence, derived
 * from the film's declared animationStyle, rendered byte-identical into every
 * prompt, and the model's own attempt stripped so there are not two competing
 * style statements in the same prompt.
 * ------------------------------------------------------------------------- */

/**
 * Words that mark the leading segment of a prompt as a style preamble rather
 * than as content. Only ever tested against the first dozen words, so a later
 * mention of "3D" or "animated" inside the action cannot trigger a strip.
 */
const STYLE_KEYWORD =
  /\b(?:animation|animated|cartoon|anime|claymation|stop[-\s]?motion|watercolou?r|cel[-\s]?shaded|CGI|CG|3D|2D|Pixar|Illumination|painterly|storybook|art\s+style|visual\s+style|rendered)\b/i;

/**
 * Connectives that hand a style phrase over to real content:
 * "Stylized 3D cartoon animation OF an anthropomorphic Baigan mother ...".
 * Cutting at the connective keeps the character description that follows;
 * cutting the whole sentence would delete it.
 */
const STYLE_CONNECTIVE = /\s+(?:of|showing|depicting|featuring|portraying)\s+/i;

/** How far into the prompt a style preamble may reach before it is left alone. */
const STYLE_PREAMBLE_REACH = 120;

/**
 * Removes a model-written style preamble from the head of a prompt body.
 *
 * Deliberately conservative: if the leading words carry no style keyword, or if
 * neither a sentence end nor a connective appears within STYLE_PREAMBLE_REACH
 * characters, the text is returned untouched. Deleting a sentence that turned
 * out to hold the setting or the cast costs far more than leaving a duplicate
 * style phrase in place.
 */
export function stripStylePreamble(prompt: string): string {
  let text = String(prompt ?? "").replace(/^\s+/, "");

  // Two passes, because a batch occasionally emits a bare style label followed
  // by a second, fuller one: "Cartoon style. Stylized 3D animation. Inside ...".
  for (let pass = 0; pass < 2; pass++) {
    const head = text.split(/\s+/).slice(0, 12).join(" ");
    if (!STYLE_KEYWORD.test(head)) break;

    const window = text.slice(0, STYLE_PREAMBLE_REACH);
    const sentence = /[.!?]\s+/.exec(window);
    const connective = STYLE_CONNECTIVE.exec(window);

    // Whichever boundary comes first wins. "Stylized 3D cartoon animation.
    // Close-up on the purple hands of an anthropomorphic mother" must cut at
    // the period, not at the " of " sixty characters later.
    const sentenceAt = sentence ? sentence.index : Infinity;
    const connectiveAt = connective ? connective.index : Infinity;
    if (sentenceAt === Infinity && connectiveAt === Infinity) break;

    let rest: string;
    if (sentenceAt <= connectiveAt) {
      rest = text.slice(sentenceAt + sentence![0].length);
    } else {
      rest = text.slice(connectiveAt + connective![0].length);
    }

    rest = rest.replace(/^\s+/, "");
    if (!rest) break;
    text = rest.charAt(0).toUpperCase() + rest.slice(1);
    text = repairProperNounOpening(text);
  }

  return text;
}

/**
 * Words that may open a sentence with a capital without being a proper noun.
 * Without this, "A warm, humble kitchen corner." would be mistaken for a place
 * label and given a preposition it does not need.
 */
const SENTENCE_OPENER = /^(?:a|an|the|his|her|its|their|this|that|two|three|one)$/i;

/**
 * Re-attaches a preposition when the style cut leaves a bare place label.
 *
 * "Children's 3D cartoon animation OF Dhobi Chabootra, a warm round taro root
 * mother kneels ..." cuts at the connective - correct when what follows is a
 * character - and leaves "Dhobi Chabootra, a warm round taro root mother
 * kneels ...", which opens on a place name dangling as an appositive. Two real
 * prompts shipped that way.
 *
 * A label is recognised by having NO lowercase word before the first comma
 * inside the opening few words: "Dhobi Chabootra," qualifies, "A warm, humble
 * kitchen corner." does not, and a long character description never reaches its
 * comma inside the window at all.
 */
function repairProperNounOpening(text: string): string {
  const comma = text.indexOf(",");
  if (comma < 0) return text;

  const head = text.slice(0, comma).trim();
  const words = head.split(/\s+/);
  if (words.length === 0 || words.length > 4) return text;
  if (SENTENCE_OPENER.test(words[0])) return text;

  // Every word capitalised (or a number) means a name, not a sentence.
  const allProper = words.every((w) => /^[0-9]/.test(w) || /^[A-ZÀ-ɏ]/.test(w));
  if (!allProper) return text;

  return `At ${text}`;
}

/**
 * The film's one style sentence.
 *
 * Derived from the declared animationStyle and nothing else, so every scene of
 * a given film produces the identical string while two different films stay
 * free to look different. Phrased style-agnostically - it names no rendering
 * technique of its own - because the style may be "Cartoon", "Watercolor" or
 * "Anime" and a hardcoded "stylized 3D" would fight all but the first.
 */
export function buildStyleLock(animationStyle: unknown): string {
  const style = String(animationStyle ?? "").trim() || "Cute 3D";
  return (
    `Visual style, identical in every shot of this film: ${style}. ` +
    `The rendering technique, character proportions, line quality, lighting warmth ` +
    `and colour palette are the same from the first shot to the last.`
  );
}

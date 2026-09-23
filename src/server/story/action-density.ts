import { tokenize, normalise } from "./scene-distinctiveness.js";

/**
 * ACTION DENSITY — can this be staged as ONE single clip?
 *
 * Dialogue was only half the feasibility problem. A real 36-scene generation
 * produced scenes whose speech fitted comfortably but whose staging did not:
 *
 *   "Tamatar slides the worst cracked diyas to the back of the cooling ledge,
 *    carries an armful across the yard and pushes them under the wood stack,
 *    then sets the chipped wooden tray down in the open."
 *
 * That is four sequential actions in three locations. Flow/Veo renders ONE
 * primary visual beat per clip; asked for four, it produces a blur or picks
 * one and drops the rest — and the scene that was silent precisely so it could
 * carry all of them ends up carrying none.
 *
 * THE MEASURE IS NOT A VERB COUNT. Counting verbs would flag the busiest
 * writing rather than the least renderable, and would punish exactly the
 * continuous physical performance that makes a good action shot. The
 * distinction that matters is:
 *
 *   SEQUENTIAL  - "she picks it up, THEN carries it across, THEN puts it down"
 *                 Three beats. One clip cannot hold them.
 *
 *   SIMULTANEOUS - "she paints WHILE he pugs clay AND the child swings"
 *                 One beat with background life. Entirely renderable, and it
 *                 is what a lived-in shot looks like.
 *
 * So simultaneity markers ('while', 'as', 'behind her') are read as parallel
 * staging and never counted as extra beats; only sequential markers are.
 *
 * PRECISION OVER RECALL, deliberately. A false positive here tells a writer
 * their good scene is broken, which is the fastest way to get a check switched
 * off. When the structure cannot be classified confidently, nothing is
 * reported. Report-only, pure, and it never throws.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * Markers that mean "and after that" - a new beat in time.
 *
 * Ordered longest-first so "and then" is consumed before the bare "and".
 */
const SEQUENTIAL_MARKERS = [
  " and then ",
  ", and then ",
  ", then ",
  " then ",
  " before turning ",
  " and afterwards ",
  ", afterwards ",
  " after that ",
  " and finally ",
  ", finally ",
  " and next ",
];

/**
 * Markers that mean "at the same time" - parallel staging, not a new beat.
 *
 * Everything after one of these belongs to a simultaneous actor. A shot can
 * hold several of these at once; that is what a busy, living frame is.
 */
const SIMULTANEOUS_MARKERS = [
  " while ",
  " as ",
  " meanwhile ",
  " at the same time ",
  " behind her ",
  " behind him ",
  " behind them ",
  " in the background ",
];

/**
 * Verb stems that carry a stageable physical beat.
 *
 * Stems because `tokenize` stems. Deliberately narrower than the contract
 * module's list: this one is used to decide whether a CLAUSE contains real
 * staging, so verbs of perception and speech are excluded - looking and
 * speaking do not need their own beat.
 */
const STAGEABLE_VERB_STEMS = new Set([
  "walk", "run", "cross", "carri", "carry", "lift", "set", "put", "place",
  "push", "pull", "drop", "throw", "catch", "open", "close", "shut", "pick",
  "take", "hand", "give", "slide", "shove", "kneel", "stand", "sit", "rise",
  "climb", "step", "turn", "enter", "exit", "leav", "reach", "pour", "fill",
  "cover", "uncover", "wrap", "tie", "untie", "hide", "bury", "stack", "lay",
  "swing", "knead", "shape", "tap", "strike", "light", "blow", "wipe", "sweep",
  // Added from confirmed gaps in a real 36-scene generation, where five
  // English action lines went unmeasured because none of their verbs were
  // listed. Each of these was observed staging a real beat:
  //   lean/call/hold (S7) · sprint/skid/stare (S20) · tip/press/count (S33)
  //   travel/rest (S17) · raise (S22)
  "hold", "lean", "call", "sprint", "skid", "stare", "tip", "press", "count",
  "travel", "rest", "raise", "lower", "crouch", "peel", "squeeze",
  "roll", "haul", "scoop", "drag", "shake", "tilt", "point", "wave", "nod",
  "sprinkle", "scatter", "gather", "fold", "unfold", "hang", "lock",
  // Stemmed forms for verbs ending in a silent -e.
  //
  // `tokenize` strips "-es", so "raises" becomes "rais" and "shakes" becomes
  // "shak" - neither matches the dictionary form. This affected the ORIGINAL
  // vocabulary too ("slides" -> "slid", "places" -> "plac"), silently costing
  // beats on scenes that were otherwise measured, and it is why one real scene
  // stayed unclassified after the vocabulary was first widened.
  "rais", "star", "shak", "wav", "squeez", "slid", "plac", "shov", "ris",
  "shap", "strik", "sprinkl", "crouch",
]);

/**
 * Verbs of LOCOMOTION - the actor's whole body moves somewhere else.
 *
 * Kept separate from the stageable list. Manipulating an object in one spot
 * ("slides", "lifts", "pushes") is one performance; travelling between spots
 * is what turns a performance into an edit.
 */
const LOCOMOTION_VERB_STEMS = new Set([
  "walk", "run", "cross", "go", "come", "step", "return", "enter", "exit",
  "leav", "head", "carri", "carry", "lead", "climb", "march", "hurri", "hurry",
]);

/**
 * Destination phrases. A locomotion verb PLUS one of these is a relocation.
 *
 * Requiring both is what stops "lifts the diya out from under the cloth hem"
 * counting as travel - that phrase names where an object came FROM, not where
 * a character went. Matching the preposition alone produced exactly that false
 * positive during calibration.
 */
const DESTINATION_MARKERS = [
  "across the", "over to", "into the", "in through", "out into", "out of the",
  "through the", "back to", "back through", "back inside", "back outside",
  "to the back", "to the front", "toward", "towards", "away to", "up to",
  "down to", "onto the", "past the", "around to", "inside", "outside",
];

// ---------------------------------------------------------------------------
// Roman Urdu
//
// The measure was English-only, so on a real Roman Urdu generation all 36
// scenes came back unclassified - correct fail-safe behaviour, but it meant
// P4 could not evaluate the language these stories are actually written in.
//
// TWO STRUCTURAL DIFFERENCES drive everything below.
//
//   1. WORD ORDER. Roman Urdu is verb-final: "aangan paar karti hai" puts the
//      staging verb at the END. The English rule - a segment is a beat when it
//      OPENS with a stageable verb - cannot work here, so the Roman Urdu path
//      asks whether the segment CONTAINS one instead.
//
//   2. PARTICIPLES BIND. "tokri uthate hue ... chalti hai" is ONE beat - she
//      walks WHILE carrying. "utha kar ... patakta hai" is likewise one
//      continuous compound action. Only finite verbs joined by 'aur' or a
//      comma are separate beats. Getting this wrong would turn every ordinary
//      compound action into a false overload.
//
// The vocabulary is drawn from real generated output rather than invented, and
// is deliberately narrow: staging verbs only, no verbs of speech or thought,
// and no attempt at general morphology.
// ---------------------------------------------------------------------------

/** Function words that identify the language without needing a verb. */
const ROMAN_URDU_MARKERS = [
  "hai", "hain", "kar", "karta", "karti", "ke", "ki", "ka", "se", "par",
  "aur", "mein", "ko", "jabki", "usi", "waqt", "apni", "apne", "uska",
  "uske", "woh", "phir", "taraf", "hue", "raha", "rahi", "apna", "deta",
  "deti", "dete", "uski", "unka", "unke", "lagta", "lagti", "wapas",
];

/**
 * True when the action line is written in Roman Urdu rather than English.
 *
 * Needs several markers, not one: an English line can legitimately contain a
 * Roman Urdu proper noun or prop name without being Roman Urdu.
 */
export function looksRomanUrdu(text: string): boolean {
  const tokens = normalise(text).split(" ").filter(Boolean);
  if (tokens.length === 0) return false;

  const hits = tokens.filter((t) => ROMAN_URDU_MARKERS.includes(t)).length;
  if (hits >= 3) return true;

  // A short line can carry only two grammar words and still obviously be Roman
  // Urdu - "Sultan apna shawl takht par rakh deta hai" has just 'par' and
  // 'hai'. Two grammar words PLUS a known staging verb is enough, and is far
  // stronger evidence than three grammar words alone.
  if (hits >= 2) {
    const folded = tokens.map(foldRomanUrdu);
    if (folded.some((t) => matchesStem(t, RU_STAGEABLE_STEMS))) return true;
  }

  return false;
}

/**
 * Collapse the spelling variation these generations actually produce.
 *
 * Doubled vowels are written inconsistently for the same word - "nikaal" and
 * "nikal", "baithta" and "baithhta". Collapsing them is safe because no
 * distinction in this vocabulary depends on vowel length.
 *
 * Consonant digraphs are deliberately NOT collapsed: "chal" (walk) and "chhal"
 * (deceive) are different words, and folding chh->ch would merge them. Where a
 * digraph genuinely varies, both spellings are listed explicitly instead.
 */
function foldRomanUrdu(token: string): string {
  return token
    .replace(/aa+/g, "a")
    .replace(/ee+/g, "i")
    .replace(/ii+/g, "i")
    .replace(/oo+/g, "u")
    .replace(/uu+/g, "u")
    .replace(/y$/, "i");
}

/**
 * Staging verb stems, folded. Matched as a PREFIX with a bounded suffix, which
 * covers -ta/-ti/-te/-ata/-kar/-kay inflection without pretending to model the
 * grammar.
 *
 * Grouped by the action family each one serves.
 */
const RU_STAGEABLE_STEMS = [
  // move / walk / cross / run / stop
  "chal", "chala", "jat", "jata", "jati", "aat", "aata", "aati", "daud",
  "par kar", "pahunch", "ruk", "thahar", "badh", "barh", "mud", "palat",
  // enter / leave / climb / descend
  "ghus", "nikal", "utar", "charh", "chadh", "laut", "wapas",
  // stand / sit / kneel / lie
  "khar", "khad", "baith", "leta", "jhuk", "uth",
  // pick up / put down / place / carry
  "utha", "rakh", "dhar", "patak", "gira", "dal", "bhar", "lad",
  // give / take / hand
  "de", "det", "le", "let", "thama", "pakad", "pakar", "sompa",
  // open / close
  "khol", "band", "dhak", "lagat",
  // push / pull / drag / throw
  "dhakel", "khinch", "kheench", "phenk", "chhor", "chor", "tan",
  // reach / extend / gesture
  "barha", "badha", "phaila", "ishara",
  // hide / cover / wrap
  "chhupa", "chupa", "dhamp", "lapet", "samet",
  // turn / look
  "ghum", "dekh", "takta", "jhank", "mur",
  // cut / tear / tie / other object handling
  "kaat", "phar", "bandh", "khod", "gin", "naap", "chhant", "chant",
  "hat", "sarak", "sarka", "uchhal",
].map(foldRomanUrdu);

/** The subset that means the whole body travels somewhere else. */
const RU_LOCOMOTION_STEMS = [
  "chal", "chala", "jat", "jata", "jati", "aat", "aata", "aati", "daud",
  "par kar", "pahunch", "ghus", "nikal", "utar", "charh", "chadh", "laut",
  "badh", "barh", "mud", "palat", "sarak",
].map(foldRomanUrdu);

/** Destination phrases. Postpositional, so these follow the place name. */
const RU_DESTINATION_MARKERS = [
  "ki taraf", "ke taraf", "ki tarf", "ke pas", "ke pass", "ke qarib",
  "andar", "bahar", "upar", "niche", "nichay", "tak", "par kar", "wapas",
].map(foldRomanUrdu);

/**
 * "at the same time" - parallel staging, never a new beat.
 *
 * 'usi waqt' and 'jabki' are the two the generator actually reaches for, and
 * both appeared repeatedly in real output.
 */
const RU_SIMULTANEOUS_MARKERS = [
  " jabki ", " usi waqt ", " us waqt ", " ke sath sath ", " ke saath saath ",
  " peechay khara ", " peeche khara ", " background mein ",
];

/**
 * Sequential joiners. 'aur' and a comma separate finite clauses.
 *
 * Crucially NOT here: " kar " and " hue ". Those are participles that BIND a
 * compound action into one beat - "utha kar patakta hai" is one movement, and
 * splitting on them would turn ordinary staging into a false overload.
 */
const RU_SEQUENTIAL_MARKERS = [" phir ", ", phir ", " uske baad ", " fir ", " aur phir "];

/**
 * The proper name a segment opens with, if any.
 *
 * Used to tell "the same person does another thing" from "someone else is also
 * doing something". A leading capitalised word that is not a sentence-initial
 * ordinary word is the most reliable signal available without parsing.
 */
function firstProperName(segment: string): string | null {
  const first = segment.trim().split(/\s+/)[0] ?? "";
  const word = first.replace(/[^\p{L}]/gu, "");
  if (word.length < 3) return null;
  if (word[0] !== word[0].toUpperCase() || word[0] === word[0].toLowerCase()) return null;
  // Articles and pronouns that legitimately open a clause are not actors.
  if (["The", "A", "An", "She", "He", "They", "It", "Woh", "Uske", "Usi", "Ek"].includes(word)) {
    return null;
  }
  return word.toLowerCase();
}

function ruTokens(text: string): string[] {
  return normalise(text).split(" ").filter(Boolean).map(foldRomanUrdu);
}

/** Prefix match with a bounded suffix, so inflection is covered but not invented. */
function matchesStem(token: string, stems: string[]): boolean {
  return stems.some(
    (stem) => token.startsWith(stem) && token.length <= stem.length + 4
  );
}

/**
 * Words matched on the RAW token, before vowel folding.
 *
 * "paar" (across) folds to "par", which is also the commonest postposition in
 * the language ("mez par" = on the table). Folding would make it match
 * everywhere, so these few are compared unfolded instead. This is why the
 * folding rule is applied per-word rather than to the whole line.
 */
const RU_EXACT_LOCOMOTION = new Set(["paar", "par kar", "paar kar"]);

function ruHasStageableVerb(segment: string): boolean {
  const raw = normalise(segment).split(" ").filter(Boolean);
  if (raw.some((t) => RU_EXACT_LOCOMOTION.has(t))) return true;
  return ruTokens(segment).some((t) => matchesStem(t, RU_STAGEABLE_STEMS));
}

function ruCountRelocations(segments: string[]): number {
  let count = 0;
  for (const segment of segments) {
    const raw = normalise(segment).split(" ").filter(Boolean);
    const tokens = ruTokens(segment);

    // "paar karti hai" (crosses) is travel on its own, the way "crosses" is in
    // the English path - no destination phrase needed.
    if (raw.some((t) => RU_EXACT_LOCOMOTION.has(t))) {
      count++;
      continue;
    }

    if (!tokens.some((t) => matchesStem(t, RU_LOCOMOTION_STEMS))) continue;
    const folded = ` ${tokens.join(" ")} `;
    if (RU_DESTINATION_MARKERS.some((m) => folded.includes(m))) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * Sequential beats above which a clip is overloaded, by performance type.
 *
 * CALIBRATED - `tests/calibrate-action-density.ts` sweeps these against
 * fixtures of renderable and unrenderable staging. See plan-story-quality.md
 * §28 for the record.
 *
 * The values differ because the types genuinely differ: an `action` scene is
 * SUPPOSED to be one continuous physical progression and can carry more
 * linked movement, while a `montage-element` is one compressed image and an
 * `establishing` shot is a camera move with a subject.
 */
export const BEAT_LIMITS: Record<string, number> = {
  action: 4,
  "dialogue-scene": 3,
  "comedy-beat": 3,
  transition: 3,
  reaction: 2,
  establishing: 2,
  "silent-emotional": 2,
  "montage-element": 2,
};

/** Used when the scene declares no performance type (older stories). */
export const DEFAULT_BEAT_LIMIT = 4;

/**
 * Relocations at or above which the actor is touring the set.
 *
 * One move inside a clip is ordinary staging. TWO means three locations in
 * ten seconds, which is an edit whatever the performance type.
 */
export const RELOCATION_LIMIT = 2;

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

export interface ActionDensity {
  sceneNumber: number;
  performanceType?: string;
  /** Beats that must happen one after another. The number that matters. */
  sequentialBeats: number;
  /** Parallel staging - background life, never counted against the scene. */
  simultaneousStrands: number;
  /** Distinct place changes requested inside the clip. */
  relocations: number;
  /** The clause text of each sequential beat, for the report. */
  beatTexts: string[];
  limit: number;
  overloaded: boolean;
  /** False when the text could not be classified confidently. */
  confident: boolean;
  /**
   * WHY it could not be classified. The report previously said "the action
   * line is written in another language" for every unclassified scene, which
   * was wrong on a real story where all five were English with verbs the
   * vocabulary simply did not list - a misleading explanation is worse than
   * none.
   */
  reason?: "insufficient-evidence" | "unrecognised-phrasing" | "unsupported-language";
}

/**
 * Function words that mark a line as English.
 *
 * Used only to tell "English we could not parse" from "a language we do not
 * support", so the report can say which.
 */
const ENGLISH_MARKERS = [
  "the", "and", "with", "from", "into", "onto", "his", "her", "their", "its",
  "then", "while", "over", "under", "across", "down", "back", "out", "off",
];

function looksEnglish(text: string): boolean {
  const tokens = normalise(text).split(" ").filter(Boolean);
  return tokens.filter((t) => ENGLISH_MARKERS.includes(t)).length >= 3;
}

/**
 * Split an action line into candidate beats.
 *
 * Splits on sequential markers AND on plain clause boundaries (", " / " and "),
 * because English writes a sequence of beats that way far more often than it
 * writes "then". Splitting alone would over-count, so a segment is only
 * promoted to a beat when it BEGINS with a stageable verb - which is what
 * distinguishes "carries an armful across the yard" (a new beat) from "with
 * its broken corner facing the yard" (a description of the same beat).
 */
function splitIntoSegments(text: string, extraMarkers: string[] = []): string[] {
  let parts = [text];
  for (const marker of [...SEQUENTIAL_MARKERS, ...extraMarkers, ", ", " and ", " aur "]) {
    const next: string[] = [];
    for (const part of parts) next.push(...part.split(marker));
    parts = next;
  }
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Stems that are common NOUNS as well as staging verbs.
 *
 * "with his head down" is not the verb 'to head somewhere'; "the wet step" is
 * not the verb 'to step'. Matching these as verbs produced two phantom
 * relocations inside a single continuous crawl on a real scene, which is what
 * made that scene look like a three-location tour.
 */
const NOUN_OR_VERB_STEMS = new Set([
  "head", "step", "rest", "light", "hand", "point", "place", "turn", "drop",
  "shape", "press", "count", "call", "tip", "roll", "cover", "stack", "wave",
  "swing", "lean", "stare", "set", "lay", "pick", "catch", "shake", "tilt",
]);

/**
 * Verb-form check for the ambiguous stems.
 *
 * A noun/verb word only counts as a verb when the ORIGINAL word carries a verb
 * inflection, or opens the clause. Deliberately strict: missing a bare
 * present-tense verb costs one uncounted beat, while the reverse invents
 * journeys that were never staged.
 */
function looksLikeVerbUse(rawWord: string, index: number): boolean {
  if (index === 0) return true;
  return /(?:s|es|ed|ing)$/i.test(rawWord);
}

/**
 * Does this segment contain a verb from `stems`, respecting noun/verb ambiguity?
 *
 * Walks the raw words so inflection is still visible; `tokenize` alone has
 * already stripped it.
 */
function containsVerb(segment: string, stems: Set<string> | string[]): boolean {
  const set = stems instanceof Set ? stems : new Set(stems);
  const rawWords = normalise(segment).split(" ").filter(Boolean);

  return rawWords.some((raw, index) => {
    const stemmed = tokenize(raw)[0];
    if (!stemmed || !set.has(stemmed)) return false;
    if (!NOUN_OR_VERB_STEMS.has(stemmed)) return true;
    return looksLikeVerbUse(raw, index);
  });
}

/**
 * True when a segment OPENS with a stageable verb.
 *
 * Checking the opening rather than anywhere in the segment is the whole point:
 * a verb buried mid-clause is usually part of the preceding action, while a
 * verb at the front is a new thing happening.
 */
function beginsWithStageableVerb(segment: string): boolean {
  if (isParticipialContinuation(segment)) return false;
  const tokens = tokenize(segment);
  if (tokens.length === 0) return false;
  // Allow a leading subject ("Tamatar slides...") by checking the first two.
  //
  // Deliberately NOT routed through `containsVerb`. The noun/verb
  // disambiguation is needed for relocation counting, where "with his head
  // down" and "the wet step" invented journeys that were never staged - but
  // applying the same strictness here suppressed four of six genuine overload
  // fixtures. Beat detection was already calibrated at 0 false positives and
  // 0 false negatives, so it stays exactly as it was.
  return tokens.slice(0, 2).some((t) => STAGEABLE_VERB_STEMS.has(t));
}

/**
 * True when a segment opens with an -ing participle.
 *
 * "...crosses the floor to the back door, PASSING beneath the tin, and squeezes
 * under the door" describes ONE continuous traverse: the passing happens
 * during the crossing, it is not a second journey. Counting it separately
 * turned a single crawl into three relocations on a real scene.
 *
 * This is the English counterpart of the Roman Urdu rule that `kar` and `hue`
 * bind a compound action - the same idea, expressed by the grammar each
 * language actually uses.
 */
function isParticipialContinuation(segment: string): boolean {
  const first = segment.trim().split(/\s+/)[0] ?? "";
  const word = first.replace(/[^\p{L}]/gu, "").toLowerCase();
  if (word.length < 5 || !word.endsWith("ing")) return false;
  // Only when the -ing word is itself a staging verb; "Nothing happens" must
  // not be read as a participle.
  return STAGEABLE_VERB_STEMS.has(word.slice(0, -3)) || LOCOMOTION_VERB_STEMS.has(word.slice(0, -3));
}

/**
 * Count places the actor travels to: a locomotion verb plus a destination,
 * inside one segment. Both are required (see DESTINATION_MARKERS).
 */
/**
 * Verbs that mean travel on their own, whatever preposition follows.
 *
 * "crosses to the crate stack" is unambiguously the actor moving across the
 * set, but "to the" is far too loose to put in DESTINATION_MARKERS - it would
 * match "sets it down to the left". These verbs carry the meaning themselves.
 */
const INHERENTLY_TRAVELLING = new Set(["cross", "return", "head", "march"]);

function countRelocations(segments: string[]): number {
  let count = 0;
  for (const segment of segments) {
    // A waypoint passed DURING a journey is not a second journey.
    if (isParticipialContinuation(segment)) continue;

    if (!containsVerb(segment, LOCOMOTION_VERB_STEMS)) continue;

    if (containsVerb(segment, INHERENTLY_TRAVELLING)) {
      count++;
      continue;
    }

    const lowered = ` ${normalise(segment)} `;
    if (DESTINATION_MARKERS.some((m) => lowered.includes(m))) count++;
  }
  return count;
}

/**
 * Measure one scene's staging load.
 *
 * Reads `characterActions` primarily, with `animationDirection` folded in
 * because a direction line can add staging the action line did not mention.
 * Never reads the Flow prompt: that deliberately restates everything, so it
 * would inflate every scene equally and tell us nothing.
 */
export function measureActionDensity(scene: any): ActionDensity {
  const sceneNumber = Number(scene?.sceneNumber) || 0;
  const performanceType = String(scene?.contract?.performanceType ?? "").trim().toLowerCase() || undefined;
  const limit = (performanceType && BEAT_LIMITS[performanceType]) ?? DEFAULT_BEAT_LIMIT;

  const action = String(scene?.characterActions ?? "").trim();
  const direction = String(scene?.animationDirection ?? "").trim();
  const text = [action, direction].filter(Boolean).join(". ");

  const empty: ActionDensity = {
    sceneNumber,
    performanceType,
    sequentialBeats: 0,
    simultaneousStrands: 0,
    relocations: 0,
    beatTexts: [],
    limit,
    overloaded: false,
    confident: false,
  };

  // Too short to classify. Saying nothing is the correct answer.
  const actionWordCount = normalise(action).split(" ").filter(Boolean).length;
  if (actionWordCount < 6) return { ...empty, reason: "insufficient-evidence" };

  // LANGUAGE.
  //
  // Two vocabularies, chosen per scene. The English path is unchanged; the
  // Roman Urdu path exists because a real generation wrote every action line
  // in Roman Urdu and the English-only measure returned "0 beats, not
  // overloaded" for all 36 scenes - a confident "clean" that actually meant
  // "blind", which is the worst thing a checker can say.
  //
  // Anything neither vocabulary recognises stays UNCLASSIFIED rather than
  // being reported as fine.
  const isRomanUrdu = looksRomanUrdu(action);

  const recognised = isRomanUrdu
    ? ruHasStageableVerb(action)
    : tokenize(action).some((t) => STAGEABLE_VERB_STEMS.has(t) || LOCOMOTION_VERB_STEMS.has(t));

  if (!recognised) {
    // Say which of the three it actually is. "We do not support this language"
    // is only claimed when neither vocabulary recognises the GRAMMAR either.
    const knownLanguage = isRomanUrdu || looksEnglish(action);
    return {
      ...empty,
      reason: knownLanguage ? "unrecognised-phrasing" : "unsupported-language",
    };
  }

  // Parallel strands first: everything after a simultaneity marker is staged
  // AT THE SAME TIME and belongs to the background, not to the beat count.
  const simultaneousMarkers = isRomanUrdu
    ? [...SIMULTANEOUS_MARKERS, ...RU_SIMULTANEOUS_MARKERS]
    : SIMULTANEOUS_MARKERS;

  const lowered = ` ${action.toLowerCase()} `;
  let simultaneousStrands = 0;
  let primary = action;
  for (const marker of simultaneousMarkers) {
    if (lowered.includes(marker)) {
      const cut = primary.toLowerCase().indexOf(marker);
      if (cut > 0) {
        simultaneousStrands++;
        primary = primary.slice(0, cut);
      }
    }
  }

  // Sequential beats within the PRIMARY strand only.
  //
  // The promotion rule differs by language because the word order does. English
  // is verb-initial in a clause, so a beat OPENS with its verb and checking the
  // opening guards against descriptive tails. Roman Urdu is verb-FINAL, so the
  // same check would find nothing; there the segment is asked whether it
  // CONTAINS a staging verb at all.
  const segments = isRomanUrdu
    ? splitIntoSegments(primary, RU_SEQUENTIAL_MARKERS)
    : splitIntoSegments(primary);

  // A DIFFERENT ACTOR is parallel staging, not a later beat.
  //
  // "Razia ... rakh deti hai aur Sultan der tak khara reh kar ..." is two
  // people acting at once in one frame, which a single shot holds easily. Only
  // the primary actor's own chain of actions has to happen sequentially.
  //
  // Language-neutral: it keys off a capitalised name opening a segment, which
  // works the same way in both vocabularies.
  const primaryActor = firstProperName(segments[0] ?? "");
  const ownSegments: string[] = [];
  let parallelActors = 0;

  for (const segment of segments) {
    const actor = firstProperName(segment);
    if (primaryActor && actor && actor !== primaryActor) {
      parallelActors++;
      continue;
    }
    ownSegments.push(segment);
  }

  simultaneousStrands += parallelActors;

  const beatTexts = ownSegments.filter(isRomanUrdu ? ruHasStageableVerb : beginsWithStageableVerb);
  const sequentialBeats = beatTexts.length;

  const relocations = isRomanUrdu ? ruCountRelocations(ownSegments) : countRelocations(ownSegments);

  // Two independent routes to "this needs an edit":
  //   - the actor visits two or more new places inside ten seconds, or
  //   - the shot needs more beats than its type can hold AND the actor moves
  //     at least once between them.
  // The second requires movement because a run of manipulations in ONE spot
  // is a performance, however many verbs it uses - which is what keeps
  // "lifts, taps, holds, sets down" renderable.
  const overloaded = relocations >= RELOCATION_LIMIT || (sequentialBeats > limit && relocations >= 1);

  return {
    sceneNumber,
    performanceType,
    sequentialBeats,
    simultaneousStrands,
    relocations,
    beatTexts: beatTexts.map((t) => (t.length > 90 ? `${t.slice(0, 89)}…` : t)),
    limit,
    overloaded,
    confident: true,
  };
}

export interface ActionDensityReport {
  scenes: ActionDensity[];
  overloaded: number[];
  /** Scenes whose staging could not be classified. */
  unclassified: number[];
  /** Unclassified scenes grouped by WHY, so the report can explain itself. */
  unclassifiedByReason: Record<string, number[]>;
  averageSequentialBeats: number;
  maxSequentialBeats: number;
}

/** Measure a whole timeline. Never throws; malformed input returns empties. */
export function buildActionDensityReport(scenes: any[]): ActionDensityReport {
  try {
    const list = (Array.isArray(scenes) ? scenes : []).filter(
      (s) => s !== null && typeof s === "object"
    );
    const measured = list.map(measureActionDensity);
    const confident = measured.filter((m) => m.confident);

    return {
      scenes: measured,
      overloaded: measured.filter((m) => m.overloaded).map((m) => m.sceneNumber),
      unclassified: measured.filter((m) => !m.confident).map((m) => m.sceneNumber),
      unclassifiedByReason: measured
        .filter((m) => !m.confident)
        .reduce((acc: Record<string, number[]>, m) => {
          const key = m.reason ?? "unrecognised-phrasing";
          (acc[key] ||= []).push(m.sceneNumber);
          return acc;
        }, {}),
      averageSequentialBeats:
        confident.length > 0
          ? Math.round((confident.reduce((s, m) => s + m.sequentialBeats, 0) / confident.length) * 100) / 100
          : 0,
      maxSequentialBeats: confident.reduce((max, m) => Math.max(max, m.sequentialBeats), 0),
    };
  } catch {
    return { scenes: [], overloaded: [], unclassified: [], unclassifiedByReason: {}, averageSequentialBeats: 0, maxSequentialBeats: 0 };
  }
}

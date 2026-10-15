import type { RecurringSeriesBible } from "../story/recurring-series.js";

/**
 * STORY PACKS — the domain layer.
 *
 * Everything in the pipeline below this file works on scenes, characters,
 * places and beats. None of it knows what KIND of thing the cast is: the seam,
 * the beat clock, the quality gate, the continuity director, the scene
 * contracts, the world registry and the social graph carry zero domain
 * vocabulary, which is why a second domain costs a pack rather than a fork.
 *
 * A pack supplies only the things that genuinely differ between one film world
 * and another: what the cast is made of, what its anatomy is called, how a
 * reference sheet for it reads, and whether its characters speak.
 *
 * Adding a third world is a new file here plus one line in index.ts.
 */

/**
 * How much of the performance is carried by speech.
 *
 *   full   - characters converse; the speakability envelope, dialogue
 *            feasibility, monologue detection and speech-fraction findings all
 *            apply as written.
 *   sparse - carried by action, with occasional short lines or single words.
 *            The envelope's lower bound is relaxed, because a three-word scene
 *            is the intent rather than a fault.
 *   none   - wordless. Foley and score carry the shot. Speech-derived findings
 *            are suppressed instead of firing on every scene, and the shot
 *            declaration stops promising lip-synced dialogue.
 */
export type DialogueMode = "full" | "sparse" | "none";

/** Fallbacks for a reference sheet when the Character Bible omits a field. */
export interface PackCharacterDefaults {
  characterName: string;
  characterType: string;
  bodyShape: string;
  faceDesign: string;
  eyeStyleAndColor: string;
  mouthStyle: string;
  /** The domain-specific anatomy: a leaf crown, a plumage pattern, a pelt. */
  features: string;
  clothing: string;
  shoes: string;
  accessories: string;
  mainColors: string;
}

export interface StoryPack {
  /** Stable id. Travels in the API payload and is stored on the story. */
  id: string;
  /** UI name. */
  label: string;
  /** One line under the label in the picker. */
  tagline: string;

  // -------------------------------------------------------------------------
  // What the cast is
  // -------------------------------------------------------------------------
  /**
   * The cast, as a prompt names it.
   * e.g. "anthropomorphic vegetable characters"
   */
  castDescription: string;
  /**
   * The film, as a prompt names it.
   * e.g. "animated vegetable story"
   */
  filmDescription: string;
  /**
   * One character's kind, as a schema field label.
   * e.g. "Vegetable type"
   */
  characterTypeLabel: string;
  /**
   * The domain anatomy, as a schema field label.
   * e.g. "Vegetable-specific physical features"
   */
  featuresLabel: string;
  /**
   * The same anatomy, as a reference-prompt label.
   * e.g. "Botanical anatomy"
   */
  anatomyLabel: string;
  /**
   * The anatomy again, as the portrait prompt names it.
   * e.g. "green vegetable crown/stem"
   *
   * Three separate labels for one concept looks redundant, and it is - but the
   * three phrasings are what the vegetable prompts have always sent, and
   * collapsing them into one would change generated output. They are pack
   * fields so the wording stays exactly where it was.
   */
  portraitAnatomyLabel: string;
  /**
   * The anatomy as the model-sheet prompt names it.
   * e.g. "vegetable anatomy"
   */
  sheetAnatomyLabel: string;
  /**
   * The silhouette that must not be altered, as rule 1 of the locked asset
   * instructions names it. e.g. "vegetable shape"
   */
  bodyShapeNoun: string;

  // -------------------------------------------------------------------------
  // Reference-image vocabulary
  // -------------------------------------------------------------------------
  defaults: PackCharacterDefaults;
  /**
   * The Flow consistency rule for the domain anatomy — rule 2 of the locked
   * asset instructions, where the thing that must not drift is named.
   */
  featureLockRule: string;
  /**
   * Domain-specific additions to a character's negative prompt, e.g. the
   * "missing leaves" that only means something for a vegetable.
   */
  referenceNegatives: string[];
  /**
   * What a reference image of this cast must never collapse into, e.g.
   * "realistic produce photographs" for vegetables, "real chicken photography"
   * for poultry.
   */
  realismNegatives: string[];

  // -------------------------------------------------------------------------
  // Story-mode flavour
  // -------------------------------------------------------------------------
  /**
   * The "Heartwarming" mode descriptor, in this world's terms. The other modes
   * are domain-neutral and stay in the shared instruction.
   */
  heartwarmingFlavour: string;

  // -------------------------------------------------------------------------
  // Speech
  // -------------------------------------------------------------------------
  dialogue: DialogueMode;
  /**
   * The sentence in the shot declaration that settles how speech is rendered.
   *
   * A dialogue pack promises lip-synced speech. A wordless pack must say so
   * explicitly, because a video model given no instruction about speech will
   * invent mouth movement and, worse, drawn speech balloons.
   */
  speechDeclaration: string;

  // -------------------------------------------------------------------------
  // Optional
  // -------------------------------------------------------------------------
  /** Topic suggestions for the picker. */
  suggestions?: string[];
  /**
   * A standing cast and fixed world, for a pack that is a series rather than a
   * generator of new worlds. Fed into the blueprint's already-wired
   * `seriesBible` hook.
   */
  seriesBible?: RecurringSeriesBible;
  /**
   * Extra doctrine appended to the blueprint system instruction — the craft
   * rules that only make sense in this world.
   */
  extraDoctrine?: string;
}

/** True when this pack's films carry no spoken lines at all. */
export function isWordless(pack: StoryPack): boolean {
  return pack.dialogue === "none";
}

/** True when speech-derived quality findings should be trusted for this pack. */
export function speechFindingsApply(pack: StoryPack): boolean {
  return pack.dialogue === "full";
}

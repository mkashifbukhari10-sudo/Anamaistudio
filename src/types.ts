export type StoryLanguage = 'Hindi' | 'Urdu' | 'Roman Urdu';

export type StoryDuration =
  | '30 seconds'
  | '60 seconds'
  | '90 seconds'
  | '2 minutes'
  | '4 minutes'
  | '5 minutes'
  | '6 minutes'
  | '7 minutes'
  | '8 minutes'
  | '9 minutes'
  | '10 minutes'
  | 'Custom'
  | string;

export type CharacterImportance = 'MAIN' | 'SUPPORTING' | 'MINOR';

export type StoryMode =
  | 'Cinematic Emotional'
  | 'Cinematic'
  | 'Heartwarming'
  | 'Emotional'
  | 'Friendship'
  | 'Moral Story'
  | 'Adventure'
  | 'Funny & Slapstick'
  | 'Mystery'
  | 'Fantasy'
  | 'Simple Kids Story';

export type AnimationStyle = 'Cute 3D' | 'Cartoon' | 'Cinematic 3D';

/**
 * User control over cast size.
 *
 * 'Auto' keeps the runtime-based sizing the story engine already applies. A
 * number pins the cast to exactly that many characters; it constrains SIZE
 * only, never who those characters are - identities, roles, personalities and
 * world stay fully dynamic.
 */
export type CharacterCount = 'Auto' | 2 | 3 | 4 | 5 | 6;

export const CHARACTER_COUNT_OPTIONS: CharacterCount[] = ['Auto', 2, 3, 4, 5, 6];

export interface CharacterBibleEntry {
  id: string;
  name: string;
  veggieType: string;
  role: string;
  personality: string;
  agePersonalityFeel: string;
  bodyShape: string;
  faceDesign: string;
  eyeStyleAndColor: string;
  mouthStyle: string;
  veggieFeatures: string;
  clothing: string;
  shoes: string;
  accessories: string;
  mainColors: string;
  voicePersonality: string;
  speakingStyle: string;
  movementStyle: string;
  typicalExpressions: string;
  lockedVisualDescription: string;
  emoji: string;
  catchphrase?: string;
  isLocked?: boolean;
  importance?: CharacterImportance;
  // Dramatic design merged from the narrative blueprint (optional, additive).
  want?: string;
  need?: string;
  flaw?: string;
  strength?: string;
  voiceSignature?: string;
  narrativePurpose?: string;
  arcStart?: string;
  arcMidpoint?: string;
  arcEnd?: string;
  approxDialogueShare?: number;
}

export type Character = CharacterBibleEntry;

export interface DialogueTurn {
  speaker: string;
  line: string;
  facialExpression?: string;
  accompanyingAction?: string;
}

/**
 * How Scene N joins to Scene N-1 in the editing timeline.
 *
 * CUT   - a normal edit: new angle, location or moment. The viewer expects a
 *         visual break, so the two clips do not need matching pixels.
 * CHAIN - the action flows unbroken across the join. To make the seam
 *         invisible the last frame of the previous clip has to be uploaded as
 *         this clip's first-frame reference in Flow; prompt text alone cannot
 *         reproduce the same face, palette and lighting twice.
 */
export type ShotTransitionType = 'CUT' | 'CHAIN';

/**
 * The manual step the operator performs in Flow / Higgsfield before pasting
 * this scene's prompt. Emitted per scene so the whole timeline can be worked
 * through without deciding, shot by shot, which joins need frame chaining.
 */
/**
 * What the operator does with the previous clip's last frame.
 *
 * CHAIN    - it becomes this clip's FIRST frame (one unbroken take).
 * IDENTITY - it goes in as a style-and-identity reference on a cut that stays in
 *            the same place with the same people. This is the case the old
 *            binary CHAIN/CUT policy missed, and where character faces, in-frame
 *            text and background crowds were measurably drifting.
 * FRESH    - no upload; the scene has moved to a new place or a new day.
 */
export type FrameHandoffMode = 'CHAIN' | 'IDENTITY' | 'FRESH';

export interface FrameHandoff {
  type: ShotTransitionType;
  /** Human-readable workflow step shown in the UI and the export. */
  instruction: string;
  /** For CHAIN: the scene whose final frame becomes this scene's first frame. */
  sourceSceneNumber?: number;
  /** Which of the three handoffs this join needs. */
  mode?: FrameHandoffMode;
  /** True when the operator must export and upload a frame before generating. */
  requiresFrameUpload?: boolean;
}

/** A character reference package this scene needs attached as a Flow Ingredient. */
export interface SceneReferenceAsset {
  characterId: string;
  characterName: string;
}

/**
 * A character who is present in the scene but does not speak in it.
 *
 * Planned explicitly because the alternative was measured: four scenes in a real
 * generation put characters on screen, gave them no line and nothing to do, and
 * the prompt had nothing to say about them. Flow renders that as people standing
 * still while somebody else talks.
 */
export interface SceneBystander {
  character: string;
  doing: string;
}

export interface SceneTransitionContract {
  previousSceneEnd: string;
  thisSceneStart: string;
  thisSceneAction: string;
  thisSceneEnd: string;
  nextSceneHandoff: string;
  transitionType?: ShotTransitionType;
  /** Set when the engine rewrote this scene's opening to match the previous end. */
  reconciled?: boolean;
}

/**
 * Words a model uses to mean "there is no dialogue here".
 *
 * A real generation emitted the literal string "None" as a spoken line, which
 * would have reached the Flow export as dialogue. Matched only as a WHOLE
 * value, never as a substring, so a real line that happens to contain the word
 * is untouched.
 */
export const EMPTY_DIALOGUE_VALUES = [
  'none',
  'n/a',
  'na',
  'null',
  'nil',
  'no dialogue',
  'none / visual action',
  'visual action',
  'no dialogue / visual action',
  'silent',
  '-',
  '--',
];

/**
 * Where the camera is, and what it is doing, at a scene's final frame.
 *
 * Tracked so the next shot can be motivated by this one rather than chosen in
 * isolation: a camera still moving at the cut should continue or settle, and
 * screen direction should hold across an unbroken join.
 */
export interface CameraState {
  shotSize: string;
  angle: string;
  movement: string;
  /** True when the camera is still in motion as the scene ends. */
  stillMovingAtCut?: boolean;
  /** Which way the action reads across frame, e.g. "left-to-right". */
  screenDirection: string;
}

/**
 * What became of an object that stopped being held.
 *
 * Structural support for the most common continuity break observed in real
 * generations: a prop in someone's hand in one scene, simply gone in the next.
 * The model records the disposition as part of the scene's actual state, so
 * nothing has to be invented afterwards to explain it.
 */
export interface PropDisposition {
  prop: string;
  disposition: string;
  detail: string;
}

/** One character's complete physical and emotional state at a given frame. */
export interface CharacterSnapshot {
  name: string;
  position: string;
  pose: string;
  emotion: string;
  /** What they are holding, and in which hand. "nothing" when empty-handed. */
  holding: string;
}

export interface ContinuityState {
  /**
   * Which registered Place this is. The single integration point between the
   * World Registry and physical continuity: it lets the validator compare
   * place IDENTITY instead of comparing prose.
   */
  placeId?: string;
  location: string;
  timeOfDay: string;
  weather: string;
  lighting: string;
  characterPositions: Record<string, string>;
  characterEmotions: Record<string, string>;
  heldProps: Record<string, string>;
  placedProps: string[];
  /** What became of objects that stopped being held during this scene. */
  propDispositions?: PropDisposition[];
  openClosedObjects?: string[];
  environmentState: string;
  /**
   * The background population - a watching crowd, passers-by, animals.
   *
   * Restated across scenes for the same reason locked character descriptions
   * are: an unnamed crowd is re-invented by the video model in the next shot.
   */
  backgroundCast?: string;
  storyGoals?: string;
  unresolvedConflicts?: string;
  /** Per-character snapshot, preserved alongside the flattened maps above. */
  characters?: CharacterSnapshot[];
  cameraState?: CameraState;
}

export interface ContinuityIssue {
  sceneNumber: number;
  dimension: 'character' | 'location' | 'prop' | 'action' | 'emotion' | 'dialogue' | 'camera' | 'lighting' | 'time' | 'wardrobe';
  title: string;
  previousState: string;
  currentState: string;
  suggestedFix: string;
  severity: 'warning' | 'info';
}

export interface ScenePlannerItem {
  sceneNumber: number;
  timeRange: string;
  duration: string;
  chapterNumber?: number;
  chapterTitle?: string;
  beatNumber?: number;
  beatName?: string;
  storyFunction?: string;
  setupOrPayoff?: string;
  purpose: string;
  charactersPresent: string[];
  characterActions: string;
  facialExpressions: string;
  dialogue: string;
  environment: string;
  props: string;
  cameraShot: string;
  cameraMovement: string;
  lighting: string;
  animationDirection: string;
  soundEffects: string;
  backgroundMusicMood: string;
  continuityFromPrevious: string;
  continuityIntoNext: string;
  characterConsistencyNotes: string;
  visualDescription: string;
  /**
   * The positive prompt, pasted into Flow / Veo on its own. Self-contained:
   * it describes the opening frame in absolute terms rather than referring to
   * a previous shot the model cannot see.
   */
  finalVideoPrompt: string;
  /** Visual-artifact suppression list for Flow's dedicated negative field. */
  negativePrompt?: string;
  /** How this scene joins the previous one. Drives frameHandoff. */
  transitionType?: ShotTransitionType;
  /** CUT vs CHAIN, plus the frame-upload step when the join must be seamless. */
  frameHandoff?: FrameHandoff;
  // Shot-to-Shot Continuity Handoff System
  startState?: string;
  primaryAction?: string;
  endState?: string;
  nextSceneHandoff?: string;
  transitionContract?: SceneTransitionContract;
  continuityState?: ContinuityState;
  dialogueTurns?: DialogueTurn[];
  /**
   * The situation at this scene's FIRST frame. Populated only for CHAIN joins,
   * where it is copied from the previous scene's end state - the opening of an
   * unbroken take is not a new invention, it is the previous frame.
   */
  openingState?: ContinuityState;
  continuityIssues?: ContinuityIssue[];
  /**
   * Where this scene sits in STORY time, as opposed to the screen time in
   * timeRange. Defaults to phase 1 / day 0 when no journey was planned.
   */
  /**
   * The scene's dramatic contract: what it is trying to do and what changes.
   * Optional - absent on every story generated before this layer existed.
   */
  contract?: SceneContract;
  storyTime?: StoryTimeMarker;
  /**
   * Set by the engine from the blueprint, never authored per scene: a model
   * free to declare its own jumps produces exactly the random time jumps this
   * architecture exists to prevent.
   */
  timeJumpBefore?: TimeJump;
}

export interface CharacterReferencePackage {
  characterId: string;
  characterName: string;
  veggieType: string;
  fullBodyPrompt: string;
  frontFacingPrompt: string;
  characterSheetPrompt: string;
  expressionSheetPrompt: string;
  flowVeoInstructions: string;
  negativePrompt: string;
  generatedImageUrl?: string;
  isGeneratingImage?: boolean;
}

export interface StoryChapter {
  chapterNumber?: number;
  title: string;
  sceneRange?: string;
  summary?: string;
  actNumber?: string | number;
  targetScenes?: string;
  narrativeFocus?: string;
}

export interface StorySection {
  title: string;
  content: string;
  chapterTitle?: string;
  scenePromptHint?: string;
}

export interface ProductionChecklistStatus {
  characterReferencesReady: boolean;
  characterIdentitiesLocked: boolean;
  storyDurationValidated: boolean;
  sceneCountValidated: boolean;
  timelineValidated: boolean;
  dialogueValidated: boolean;
  continuityValidated: boolean;
  videoPromptsGenerated: boolean;
  audioDirectionGenerated: boolean;
  readyForFlow: boolean;
}

export interface TimelineValidationReport {
  selectedDuration: string;
  expectedSceneCount: number;
  actualSceneCount: number;
  expectedTimeline: string;
  actualTimeline: string;
  characterCount: number;
  characterBibleCount: number;
  referenceCount: number;
  isValid: boolean;
  notes: string[];
}

export type StudioTab = 'story' | 'characters' | 'references' | 'scenes' | 'flow-production' | 'checklist';

/**
 * Honest account of what the scene pipeline produced. Missing scenes are
 * reported here rather than being back-filled with placeholder content.
 */
export interface CharacterArcPlan {
  name: string;
  veggieType: string;
  importance: CharacterImportance;
  narrativePurpose: string;
  want: string;
  need: string;
  flaw: string;
  strength?: string;
  voiceSignature: string;
  arcStart: string;
  arcMidpoint: string;
  arcEnd: string;
  approxDialogueShare: number;
}

export interface RelationshipArc {
  characterA: string;
  characterB: string;
  startingDynamic: string;
  sourceOfFriction: string;
  turningPointBeat: number;
  howItEvolves: string;
  endingDynamic: string;
}

export interface StoryBeat {
  beatNumber: number;
  name: string;
  chapterNumber: number;
  sceneStart: number;
  sceneEnd: number;
  purpose: string;
  causeFromPrevious: string;
  consequence: string;
  escalation: string;
  emotionalTemperature: string;
  charactersInFocus: string[];
  relationshipShift?: string;
  /**
   * How many MATERIALLY DIFFERENT scenes this beat's material contains.
   *
   * A claim, never trusted on its own - it is checked against
   * , because a model asked for a number will supply the
   * number it was allocated.
   */
  distinctScenesNeeded?: number;
  /**
   * One line per allocated scene, saying what that scene DOES.
   *
   * This is the verifiable half: paraphrases of one move are detectable,
   * a bare count is not. Optional, so older blueprints still normalise -
   * they simply report as unverifiable rather than as clean.
   */
  whatEachSceneDoes?: string[];
}

export interface StorySetup {
  element: string;
  type: string;
  plantScene: number;
  payoffScene: number;
  meaning: string;
}

/** The narrative blueprint built before any scene is planned. */
export interface NarrativeBlueprint {
  logline: string;
  theme: string;
  centralQuestion: string;
  toneKeywords?: string;
  castPlan: CharacterArcPlan[];
  relationships: RelationshipArc[];
  beats: StoryBeat[];
  setups: StorySetup[];
  chapters: StoryChapter[];
  /**
   * OPTIONAL time-spanning plan. Absent on the normal path, which keeps the
   * story a single continuous situation exactly as before.
   */
  lifeJourney?: LifeJourney;
  /** Beat-density measurement. Report only; never rewrites the beat sheet. */
  beatDensity?: any;
}

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

export interface SceneBatchFailure {
  startScene: number;
  endScene: number;
  sceneNumbers: number[];
  reason: string;
}

export interface SceneGenerationReport {
  targetSceneCount: number;
  generatedSceneCount: number;
  missingSceneCount: number;
  missingSceneNumbers: number[];
  isComplete: boolean;
  failedBatches: SceneBatchFailure[];
}

/**
 * A directional social fact between two characters.
 *
 * `type` is a LABEL, never a personality template. "father" records who someone
 * IS to another, not how they behave: behaviour keeps coming from personality,
 * want, need, flaw, life stage, current emotion, responsibilities and situation,
 * exactly as it does today. A bond constrains nothing about temperament.
 */
export interface SocialBond {
  /** Character id or name this bond points FROM. */
  from: string;
  /** Character id or name this bond points TO. */
  to: string;
  /** Dynamic label invented for this story: "father", "classmate", "neighbour". */
  type: string;
  /** What `to` is to `from` in return: the reciprocal label. */
  inverse: string;
  /**
   * Direction of care or responsibility - structural, not behavioural.
   * Says who is responsible for whom, never who is strict or gentle.
   */
  authority?: 'cares-for' | 'peer' | 'defers-to';
  /** One line of shared past, if the story has one. Feeds dialogue shorthand. */
  sharedHistory?: string;
}

/** A group of characters who live together. Structure is invented per story. */
export interface Household {
  id: string;
  /** How the story refers to it, e.g. "the house past the tube well". */
  name: string;
  memberIds: string[];
  /** Populated in Phase 2 when the World Registry exists. */
  dwellingPlaceId?: string;
}

/** Social attributes attached to a cast member. */
export interface CharacterSocial {
  characterId: string;
  /** Dynamic: "small child", "young adult", "elder". Never an enum. */
  lifeStage?: string;
  householdId?: string;
  /** What this character is responsible for in everyday life. */
  responsibilities?: string[];
}

/**
 * A recorded change in how two characters stand with each other.
 *
 * STATE, never FACT. A delta can say trust dropped or a promise was made; it
 * can never say who someone is to another. Relationship facts live in
 * `SocialGraph` and are structurally unreachable from here — deltas are stored
 * separately and nothing folds them back into the graph.
 */
export interface RelationshipDelta {
  sceneNumber: number;
  /** The two characters, order-insensitive. */
  between: [string, string];
  /** Dynamic, only what this story needs: "trust", "tension", "a promise". */
  dimension: string;
  /** What changed, in one line. */
  change: string;
}

/** Current social state, folded from deltas — latest value per pair+dimension. */
export interface SocialStateEntry {
  between: [string, string];
  dimension: string;
  current: string;
  sinceScene: number;
}

/**
 * A location with a persistent identity.
 *
 * Without this, `ContinuityState.location` is only a per-scene string, so the
 * same kitchen is re-invented sixty times and drifts. A Place is established
 * once and referenced by id thereafter.
 */
export interface Place {
  id: string;
  /** How the story refers to it, e.g. "the courtyard". */
  name: string;
  /** Household that owns it, when it belongs to one. */
  belongsToHousehold?: string;
  /**
   * Things that are ALWAYS true of this place and must not change between
   * scenes: "a neem tree at the north wall, a charpai beneath it".
   */
  fixedFeatures: string[];
  /** Ids of places reachable from here, for believable movement. */
  connectsTo?: string[];
}

/**
 * Something that recurs in the world without being a story character.
 *
 * Animals, neighbours, shopkeepers, belongings and infrastructure live here.
 * Crucially, entities do NOT consume the user's Character Count: that governs
 * the dramatic cast only. An entity becomes a character only by deliberate
 * promotion into castPlan, at which point it does count.
 */
export interface WorldEntity {
  id: string;
  kind: 'animal' | 'villager' | 'belonging' | 'infrastructure';
  name?: string;
  /** RECURRING appears repeatedly and needs continuity; BACKGROUND is texture. */
  tier: 'RECURRING' | 'BACKGROUND';
  ownerHouseholdId?: string;
  /** Place this normally lives, is kept, or is found. */
  homePlaceId?: string;
  /** Character responsible for it, if any. */
  caredForBy?: string;
  /**
   * Animals only. Decided once for the whole world and then fixed, so a cow
   * cannot talk in one scene and be an ordinary animal in the next.
   */
  speech?: 'speaking' | 'expressive' | 'mute';
  storyRelevance?: string;
  /**
   * Which scenes this entity is planned to appear in. Required for RECURRING:
   * two real generations registered an animal as RECURRING that never appeared,
   * so an entity with no plan is downgraded to BACKGROUND rather than becoming
   * a promise the story never keeps.
   */
  plannedAppearances?: string;
}

/**
 * The persistent world: places and the things that live in them.
 *
 * Facts, like the social graph. Established at blueprint time, injected into
 * scene batches, never rewritten by scene generation.
 */
export interface WorldRegistry {
  places: Place[];
  entities: WorldEntity[];
}

/**
 * The immutable social layer of a story.
 *
 * Established once at blueprint time and injected verbatim into every scene
 * batch, which is what stops relationships drifting across a long timeline.
 * Scene generation reads it and never rewrites it.
 */
/** A relationship turning point the blueprint plans to dramatise. */
export interface PlannedSocialChange {
  characterA: string;
  characterB: string;
  dimension: string;
  atBeat: number;
  intendedChange: string;
}

export interface SocialGraph {
  bonds: SocialBond[];
  households: Household[];
  characterSocial: CharacterSocial[];
  /** Planned turning points. Scene generation emits the matching delta. */
  plannedChanges: PlannedSocialChange[];
}

/**
 * An identity or social-fact problem found by the fact validator.
 *
 * Distinct from ContinuityIssue, which covers physical state. This covers who
 * someone is, where a place is, and who owns what.
 */
export interface FactIssue {
  kind: 'relationship' | 'household' | 'life-stage' | 'place' | 'entity' | 'cast';
  sceneNumber?: number;
  title: string;
  detail: string;
  suggestedFix: string;
  severity: 'warning' | 'info';
}

export interface FactReport {
  issues: FactIssue[];
  warnings: number;
  infos: number;
}

export interface VeggieStory {
  id?: string;
  title: string;
  tagline?: string;
  language: string;
  duration: string;
  storyMode?: StoryMode;
  animationStyle?: string;
  /** Cast-size control used for this story, so regeneration reuses it. */
  characterCount?: CharacterCount;
  isLongForm?: boolean;
  estimatedScenesCount?: number;
  chapters?: StoryChapter[];
  characters: CharacterBibleEntry[];
  characterReferences?: CharacterReferencePackage[];
  scenes: ScenePlannerItem[];
  storySections: StorySection[];
  fullStoryText: string;
  moral: string;
  funQuestion?: string;
  charactersLocked?: boolean;
  sceneGeneration?: SceneGenerationReport;
  narrativeBlueprint?: NarrativeBlueprint;
  storyQuality?: StoryQualityReport;
  continuityReport?: ContinuityReport;
  /** Immutable social facts, persisted so regeneration cannot destroy them. */
  socialGraph?: SocialGraph;
  /** Persistent places and world entities, persisted for the same reason. */
  worldRegistry?: WorldRegistry;
  /** Identity and social fact findings. Report only - nothing auto-fixed. */
  factReport?: FactReport;
  /** Whether planned relationship turning points were actually dramatised. */
  socialPlanReport?: {
    planned: number;
    fulfilled: number;
    unfulfilled: number;
    unplanned: number;
  };
  /** Time shape requested for this story, so regeneration reuses it. */
  storyScope?: StoryScope;
  /** The planned journey, persisted so regeneration inherits it. */
  lifeJourney?: LifeJourney;
  /** Per-phase appearance. Empty or absent for single-phase stories. */
  appearanceVariants?: CharacterAppearanceVariant[];
  /** Report only - nothing about the journey is auto-corrected. */
  lifeJourneyReport?: LifeJourneyReport;
  /** Speakability of each scene. Report only; nothing is ever truncated. */
  dialogueFeasibility?: any;
  /** Beat-density measurement from blueprint time. Report only. */
  beatDensity?: any;
  /** Scene-contract validation. Report only; nothing is rewritten. */
  contractReport?: SceneContractReport;
  /** Staging load per scene. Report only. */
  actionDensity?: any;
  /** The P4 quality gate. Report only - never blocks or repairs. */
  qualityGate?: StoryQualityGateReport;
}

/** Continuity outcome for a generated story. Report only - nothing auto-fixed. */
export interface ContinuityReport {
  /** Unbroken joins whose opening was reset to the previous ending. */
  reconciledJoins: number;
  warnings: number;
  infos: number;
  scenesWithIssues: number;
}

export interface TopicSuggestion {
  label: string;
  topic: string;
  emoji: string;
  language: StoryLanguage;
  vibe: string;
  suggestedMode?: StoryMode;
  category?: 'Friendship' | 'Adventure' | 'Moral Story' | 'Comedy & Fun' | 'Mystery & Magic';
  characters?: string[];
}

// ===========================================================================
// LIFE JOURNEY
//
// A fourth state layer, for stories that span time rather than a situation.
//
// The existing three layers cannot hold this data. Making an occupation a FACT
// freezes it for the film and makes any change a validation error; making it
// per-scene STATE lets it drift and re-asserts it sixty times. So:
//
//   LIFE STATE is what is true of a character or household for the span of one
//   LIFE PHASE. It is immutable WITHIN a phase, and changes ONLY at a declared
//   time jump, by a change planned at blueprint time.
//
// That definition is the whole design. Inside a phase life state behaves
// exactly like a fact, so every existing validator keeps working untouched;
// all the new logic lives at phase boundaries, which are explicit and few.
//
// Everything here is OPTIONAL. A story with no LifeJourney has one implicit
// phase covering every scene, and every system behaves exactly as it did
// before this layer existed.
// ===========================================================================

/**
 * How a story is shaped in TIME.
 *
 * Deliberately orthogonal to StoryMode: a Life Journey mystery and a Single
 * Episode heartwarming story are both reachable. This is not a twelfth mode
 * and does not compete with the existing eleven.
 */
export type StoryScope = 'Auto' | 'Single Episode' | 'Life Journey';

export const STORY_SCOPE_OPTIONS: StoryScope[] = ['Auto', 'Single Episode', 'Life Journey'];

/**
 * Coarse size of a time jump.
 *
 * Code reads this to decide what state may legitimately change across the
 * boundary; the story-facing wording lives in `span`.
 */
export type TimeJumpMagnitude =
  | 'within-day'
  | 'overnight'
  | 'days'
  | 'weeks'
  | 'months'
  | 'seasons'
  | 'years';

/** A declared jump in story time between two consecutive scenes. */
export interface TimeJump {
  /** The jump happens between this scene and the next one. */
  afterScene: number;
  /**
   * Named for this story, never an enum: "that evening", "the next monsoon",
   * "four winters later".
   */
  span: string;
  magnitude: TimeJumpMagnitude;
  /**
   * How the jump is SHOWN on screen. Required, because a jump the audience
   * cannot see is a continuity break wearing a label.
   */
  screenTreatment: string;
  /** One line per thing the audience must understand has changed. */
  whatChanged: string[];
}

/** What is true of one character for the span of one life phase. */
export interface CharacterLifeState {
  characterId: string;
  /**
   * Overrides CharacterSocial.lifeStage from phase 2 onward. Phase 1's life
   * state IS CharacterSocial, so there is no second source of truth.
   */
  lifeStage: string;
  /** Only where the story establishes them. Omitted rather than invented. */
  occupation?: string;
  education?: string;
  skills?: string[];
  responsibilities?: string[];
  /**
   * Feeds the appearance variant. Describes SCALE and BEARING only - height,
   * build, posture, wear. Never identity.
   */
  physicalMaturity?: string;
}

/** What is true of a household for the span of one life phase. */
export interface HouseholdLifeState {
  householdId: string;
  /** How this household earns. Invented per story; never defaulted. */
  livelihood?: string;
  /** Qualitative and story-relevant only. Never a number, never a currency. */
  circumstances?: string;
  dwellingPlaceId?: string;
  /** Things the household owns that matter. These survive time jumps. */
  possessions?: string[];
  /** What presses on them this phase. The engine of ordinary drama. */
  pressures?: string[];
}

/**
 * One span of the story across which life state is constant.
 *
 * A phase is a contiguous run of CHAPTERS. Its scene range is DERIVED from
 * those chapters and never authored independently, so scene ranges keep a
 * single source of truth in the beat sheet.
 */
export interface LifePhase {
  phaseNumber: number;
  /** Named for THIS story, never a generic label. */
  title: string;
  chapterNumbers: number[];
  sceneStart: number;
  sceneEnd: number;
  /** The jump that OPENS this phase. Absent on phase 1. */
  entryJump?: TimeJump;
  characterStates: CharacterLifeState[];
  householdStates: HouseholdLifeState[];
  /** Place ids genuinely in use this phase. A place may enter and leave. */
  activePlaceIds: string[];
  /** Conditions of the wider world this phase, if the story uses any. */
  worldConditions?: string[];
}

/** How an aspiration ends. Not every one is achieved, and that is often better. */
export type AspirationOutcome = 'achieved' | 'redirected' | 'relinquished' | 'denied';

/**
 * A long-horizon goal.
 *
 * Deliberately NOT a `want`. A want is filmable and immediate by design, and
 * the craft doctrine applies a hard filmable test to it. A life goal fails
 * that test on purpose - so it lives here, and each phase's `want` is how it
 * gets dramatised in that phase.
 */
export interface Aspiration {
  characterId: string;
  goal: string;
  whyItMatters: string;
  /** What pursuing it costs the people around them. */
  costToOthers: string;
  obstacles: string[];
  resolvesAtPhase: number;
  outcome: AspirationOutcome;
}

/**
 * A concrete, visible step on the way. The anti-instant-success structure.
 *
 * `provingSceneNumbers` is the mechanism: a milestone must point at scenes
 * that ALREADY showed the work. Forward references are dropped during
 * normalisation, because a milestone cannot be earned by the future.
 */
export interface Milestone {
  phaseNumber: number;
  atScene: number;
  /** Dynamic: "first sale", "taught to read", "the loan repaid". */
  kind: string;
  description: string;
  provingSceneNumbers: number[];
  /** What it costs. A milestone that costs nothing plays flat. */
  cost: string;
}

/**
 * A repeated activity of ordinary life, recorded so it can be VARIED.
 *
 * `variationAcrossStory` is required: a routine that cannot say how it differs
 * each time it appears is filler by definition.
 */
export interface Routine {
  id: string;
  activity: string;
  characterIds: string[];
  placeId: string;
  householdId?: string;
  phaseNumbers: number[];
  variationAcrossStory: string;
}

/** The whole layer. Absent means an ordinary single-episode story. */
export interface LifeJourney {
  /** Why THIS topic wants a journey. Guards against reflexive use. */
  whyThisShape: string;
  phases: LifePhase[];
  timeJumps: TimeJump[];
  aspirations: Aspiration[];
  milestones: Milestone[];
  routines: Routine[];
  /** The film's argument in structural terms: the two ends of the story. */
  openingLife: string;
  closingLife: string;
}

/**
 * Per-phase appearance.
 *
 * `identityAnchors` is assembled by CODE from the Character Bible, never by
 * the model - which is what makes identity drift across phases structurally
 * impossible rather than merely discouraged. The model supplies only
 * `ageAppearance` and `wardrobe`.
 */
export interface CharacterAppearanceVariant {
  characterId: string;
  phaseNumber: number;
  /** May change: scale, build, posture, bearing, grooming, wear. */
  ageAppearance: string;
  /** May change: clothing, shoes, accessories. */
  wardrobe: string;
  /** Copied verbatim from the bible: type, face, eyes, features, palette. */
  identityAnchors: string;
  /** Assembled from the three above, for this phase's Flow prompts. */
  lockedVisualDescriptionForPhase: string;
}

/**
 * Where a scene sits in STORY time, as opposed to screen time.
 *
 * `dayIndex` is the whole fix for time-of-day checks: it is monotonic within a
 * phase, so "night then next morning" is a new day rather than time running
 * backwards. Absent markers default to phase 1 / day 0, which reproduces the
 * behaviour that existed before this layer.
 */
export interface StoryTimeMarker {
  phaseNumber: number;
  dayIndex: number;
  /** Optional story-facing label: "the morning after the results". */
  label?: string;
}

/** A life-journey problem found during normalisation or validation. */
export interface LifeJourneyIssue {
  kind:
    | 'phase'
    | 'time-jump'
    | 'life-state'
    | 'aspiration'
    | 'milestone'
    | 'routine'
    | 'scope';
  phaseNumber?: number;
  sceneNumber?: number;
  title: string;
  detail: string;
  suggestedFix: string;
  severity: 'warning' | 'info';
}

/** Report-only account of the planned journey. Nothing is auto-corrected. */
export interface LifeJourneyReport {
  /** 1 when no journey was planned. */
  phaseCount: number;
  scenesPerPhase: Array<{ phaseNumber: number; title: string; scenes: number }>;
  timeJumpCount: number;
  milestoneCount: number;
  unearnedMilestones: number[];
  aspirationsResolved: number;
  aspirationsUnresolved: number;
  routineCount: number;
  issues: LifeJourneyIssue[];
  warnings: number;
  infos: number;
}

// ===========================================================================
// SCENE PROGRESSION CONTRACT
//
// What a scene is TRYING to do, and what materially changes because it exists.
//
// The gap this closes: `storyFunction` is prose, validated by a length check,
// so twelve scenes claiming "Golu keeps going, determined" all pass. Prose
// cannot be compared by code, which is why every anti-filler rule aimed at it
// was unenforceable. These fields are typed and comparable.
//
// `storyFunction` is KEPT and unchanged - it becomes the human-readable gloss
// alongside the machine-readable contract, not a thing replaced by it.
//
// OWNERSHIP BOUNDARY. The contract records a scene's DRAMATIC CLAIM and
// nothing else. It must never duplicate:
//   - ContinuityState        (physical positions, props, lighting, camera)
//   - socialChanges          (relationship deltas - STATE, owned by the graph)
//   - StoryMemory            (derived, never stored)
//   - Life State             (per-phase truth, owned by the journey layer)
//   - the Character Bible    (identity)
//   - StorySetup             (the setup/payoff source of truth)
// A progression may say trust moved from guarded to slightly restored; the
// relationship FACT and the delta that records it stay where they already live.
//
// Every field is OPTIONAL. A story generated before this layer existed renders
// and reports exactly as it did, and contract-dependent checks report
// themselves as unverifiable rather than as clean.
// ===========================================================================

/**
 * What kind of change a scene produces.
 *
 * The typed replacement for a prose claim. Deliberately wide: a quiet scene
 * that shifts an emotion or lands a small piece of information is doing its
 * job, and nothing here requires danger, dialogue or a reversal.
 */
export type NarrativeChangeKind =
  | 'information'   // something is learned
  | 'decision'      // a choice is made
  | 'consequence'   // an earlier choice lands
  | 'relationship'  // how two characters stand shifts
  | 'emotional'     // an emotional state genuinely turns
  | 'obstacle'      // something new blocks the goal
  | 'discovery'     // something is found or revealed
  | 'escalation'    // cost or pressure rises
  | 'setup'         // something is planted
  | 'payoff'        // something planted returns changed
  | 'reversal'      // the understanding of the problem inverts
  | 'progress'      // measurable movement toward the goal
  | 'setback';      // measurable movement away

export const NARRATIVE_CHANGE_KINDS: NarrativeChangeKind[] = [
  'information', 'decision', 'consequence', 'relationship', 'emotional',
  'obstacle', 'discovery', 'escalation', 'setup', 'payoff', 'reversal',
  'progress', 'setback',
];

/** What happened to the scene's own goal. */
export type SceneOutcome = 'achieved' | 'partial' | 'denied' | 'deferred' | 'reversed';

export const SCENE_OUTCOMES: SceneOutcome[] = [
  'achieved', 'partial', 'denied', 'deferred', 'reversed',
];

/**
 * What kind of ten seconds this is.
 *
 * P2 SCOPE: CLASSIFICATION ONLY. It records what the scene is; it does not
 * yet drive any generation-density rule. The Performance Budget Director that
 * consumes it arrives in P3.
 */
export type PerformanceType =
  | 'dialogue-scene'
  | 'action'
  | 'establishing'
  | 'reaction'
  | 'silent-emotional'
  | 'montage-element'
  | 'comedy-beat'
  | 'transition';

export const PERFORMANCE_TYPES: PerformanceType[] = [
  'dialogue-scene', 'action', 'establishing', 'reaction',
  'silent-emotional', 'montage-element', 'comedy-beat', 'transition',
];

export type RepetitionIntentKind =
  | 'callback'
  | 'montage-element'
  | 'parallel-scene'
  | 'running-gag'
  | 'ritual';

export const REPETITION_INTENT_KINDS: RepetitionIntentKind[] = [
  'callback', 'montage-element', 'parallel-scene', 'running-gag', 'ritual',
];

/**
 * A deliberate echo of an earlier scene.
 *
 * Declaring one is NOT a way to switch off repetition findings. The
 * declaration has to be valid - it must point BACKWARD at a scene that exists,
 * and it must say what materially differs this time - and even a valid
 * declaration is withdrawn when the two scenes turn out to be near-identical.
 * Repetition in children's storytelling works through variation; an unchanged
 * repeat is not a callback, it is the same scene twice.
 */
export interface RepetitionIntent {
  kind: RepetitionIntentKind;
  /** Must be an EARLIER scene number that exists in this story. */
  echoesScene: number;
  /** REQUIRED. What materially differs this time. */
  variation: string;
}

/**
 * The value this scene turns.
 *
 * `before` and `after` must describe the SAME VALUE at two different states -
 * "trust: guarded -> slightly restored". They must not describe two
 * activities: "Golu enters the room -> Golu talks to Mooli" is what the scene
 * SHOWS, not what it CHANGES, and that distinction is the whole point of the
 * field.
 */
export interface SceneProgression {
  kind: NarrativeChangeKind;
  /** The value at stake, named for this story: "trust", "the deadline", "hope". */
  value: string;
  /** Where that value stands entering the scene. */
  before: string;
  /** Where it stands leaving it. Must be a different state of the same value. */
  after: string;
}

/** One scene's dramatic contract. Every field optional at the story level. */
export interface SceneContract {
  /**
   * What the focal character or group is trying to accomplish IN THIS SCENE.
   * Not the whole-story goal.
   */
  goal: string;
  /**
   * What prevents easy completion here. May be internal, interpersonal,
   * situational or physical - a quiet scene does not need invented danger.
   */
  obstacle: string;
  outcome: SceneOutcome;
  progression: SceneProgression;
  performanceType: PerformanceType;
  repetitionIntent?: RepetitionIntent;
}

/** One problem found in one scene's contract. Report only. */
export interface ContractIssue {
  sceneNumber: number;
  code:
    | 'missing-contract'
    | 'missing-goal'
    | 'missing-obstacle'
    | 'invalid-outcome'
    | 'invalid-kind'
    | 'invalid-performance-type'
    | 'missing-progression'
    | 'identical-before-after'
    | 'near-identical-before-after'
    | 'generic-progression'
    | 'activity-as-progression'
    | 'progression-restates-action'
    | 'duplicate-contract'
    | 'repetition-intent-forward-reference'
    | 'repetition-intent-unknown-scene'
    | 'repetition-intent-no-variation'
    | 'repetition-intent-invalid-kind';
  severity: 'warning' | 'info';
  title: string;
  detail: string;
  suggestedFix: string;
}

/** Deterministic account of the contracts across a finished story. */
export interface SceneContractReport {
  sceneCount: number;
  scenesWithValidContract: number[];
  scenesMissingContract: number[];
  scenesWithInvalidContract: number[];
  progressionKinds: Array<{ kind: string; scenes: number; sharePercent: number }>;
  performanceTypes: Array<{ type: string; scenes: number; sharePercent: number }>;
  /** Scenes whose before/after do not describe a real value change. */
  unchangedProgressions: number[];
  /** Scenes whose repetitionIntent is unusable. */
  invalidRepetitionIntents: number[];
  issues: ContractIssue[];
  /** True when NO scene carried a contract - old stories land here. */
  degraded: boolean;
  warnings: number;
  infos: number;
}

// ===========================================================================
// STORY QUALITY GATE (P4)
//
// Turns the measurements produced by P0-P3 into explainable findings.
//
// REPORT ONLY, permanently. `block` means "a severe quality failure was
// detected", never "this story was withheld" - a generation the user paid
// tokens for is always delivered. Nothing here rewrites a scene, mutates story
// state, or repairs anything; repair is P5 and is not built.
//
// The gate OWNS no story data. It reads the analysis layers and emits
// findings. FACTS stay with the social graph and world registry, STATE with
// StoryMemory and the deltas, PHYSICS with ContinuityState, LIFE STATE with
// the journey layer. Quality analysis must not become a fifth state system.
// ===========================================================================

export type QualitySeverity = 'block' | 'repair' | 'warn' | 'info';

/**
 * Stable finding codes.
 *
 * Stable because a report a person reads across generations needs the same
 * name for the same problem, and because P5 will eventually key its repair
 * decisions off them.
 */
export type QualityFindingCode =
  // --- repetition (consumes P0) ---
  | 'repetition-run'
  | 'near-duplicate-scenes'
  | 'unvaried-declared-recurrence'
  // --- contract honesty (consumes P2 + P3) ---
  | 'consecutive-same-dramatic-job'
  | 'planned-move-not-executed'
  | 'outcome-contradicts-progression'
  | 'relationship-change-uncorroborated'
  | 'contract-unusable'
  // --- ten-second feasibility (consumes P0 + P4) ---
  | 'dialogue-overruns-shot'
  | 'dialogue-tight-for-shot'
  | 'dialogue-underfilled'
  | 'uniform-dialogue-density'
  | 'action-overloaded'
  // --- production feasibility (consumes the Continuity Director) ---
  | 'chain-screen-direction-reversed'
  | 'chain-join-unrenderable'
  // --- necessity ---
  | 'scene-necessity-doubtful'
  // --- performance (consumes the performance track) ---
  | 'speaker-monologue'
  | 'bystander-idle'
  // --- production continuity (consumes the frame handoff + world text) ---
  | 'frame-handoff-missing'
  | 'world-text-unstable'
  // --- shot timing (consumes the beat clock) ---
  | 'beat-clock-overflows'
  // --- story level (consumes P1 + existing quality report) ---
  | 'beat-stretched'
  | 'premise-too-small'
  | 'unresolved-setup'
  | 'progression-monotony'
  | 'place-concentration-pathological';

export interface QualityFinding {
  code: QualityFindingCode;
  severity: QualitySeverity;
  /** Scenes this finding is about. Empty for story-level findings. */
  sceneNumbers: number[];
  title: string;
  /** The measurement that produced it, stated so a person can check it. */
  detail: string;
  suggestedFix: string;
}

export interface StoryQualityGateReport {
  findings: QualityFinding[];
  blocked: number;
  /** Scenes a future repair pass would target. P5 is not built. */
  repairCandidates: number[];
  warnings: number;
  infos: number;
  /**
   * True when the evidence needed for the contract-dependent checks was
   * absent, so those checks were SKIPPED rather than passed.
   */
  degraded: boolean;
  /** Which analysis layers actually had data. */
  evidence: {
    distinctiveness: boolean;
    feasibility: boolean;
    actionDensity: boolean;
    contracts: boolean;
    plannedMoves: boolean;
    beatDensity: boolean;
    continuity: boolean;
  };
  /**
   * Continuity warnings NOT treated as quality failures.
   *
   * The continuity validator has known false-positive classes (prose-level
   * location comparison, overnight time). Folding those into quality findings
   * would bury the real ones, so they are counted separately and left alone.
   */
  continuityNoise: number;
}

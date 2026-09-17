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
export interface FrameHandoff {
  type: ShotTransitionType;
  /** Human-readable workflow step shown in the UI and the export. */
  instruction: string;
  /** For CHAIN: the scene whose final frame becomes this scene's first frame. */
  sourceSceneNumber?: number;
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

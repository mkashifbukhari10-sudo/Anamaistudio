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

export interface SceneTransitionContract {
  previousSceneEnd: string;
  thisSceneStart: string;
  thisSceneAction: string;
  thisSceneEnd: string;
  nextSceneHandoff: string;
}

export interface ContinuityState {
  location: string;
  timeOfDay: string;
  weather: string;
  lighting: string;
  characterPositions: Record<string, string>;
  characterEmotions: Record<string, string>;
  heldProps: Record<string, string>;
  placedProps: string[];
  openClosedObjects?: string[];
  environmentState: string;
  storyGoals?: string;
  unresolvedConflicts?: string;
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
  finalVideoPrompt: string;
  // Shot-to-Shot Continuity Handoff System
  startState?: string;
  primaryAction?: string;
  endState?: string;
  nextSceneHandoff?: string;
  transitionContract?: SceneTransitionContract;
  continuityState?: ContinuityState;
  dialogueTurns?: DialogueTurn[];
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

export interface VeggieStory {
  id?: string;
  title: string;
  tagline?: string;
  language: string;
  duration: string;
  storyMode?: StoryMode;
  animationStyle?: string;
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

import { VeggieStory, TimelineValidationReport, ProductionChecklistStatus } from '../types';
import { calculateSceneCount, formatClock } from '../shared/duration';

/**
 * Duration and scene-count math is owned by shared/duration.ts so the server
 * and the client always agree. These thin wrappers keep this module's existing
 * public API intact for its callers.
 */
export function getExpectedSceneCount(duration: string): number {
  return calculateSceneCount(duration);
}

export function formatTimeRange(totalSeconds: number): string {
  return formatClock(totalSeconds);
}

export function validateTimeline(story: VeggieStory): TimelineValidationReport {
  const expectedSceneCount = getExpectedSceneCount(story.duration);
  const actualSceneCount = story.scenes?.length || 0;
  const expectedTotalSeconds = expectedSceneCount * 10;
  const actualTotalSeconds = actualSceneCount * 10;

  const expectedTimeline = `0:00 – ${formatTimeRange(expectedTotalSeconds)}`;
  const actualTimeline = actualSceneCount > 0 ? `0:00 – ${formatTimeRange(actualTotalSeconds)}` : '0:00 – 0:00';

  const characterCount = story.characters?.length || 0;
  const characterBibleCount = story.characters?.filter(c => c.lockedVisualDescription)?.length || 0;
  const referenceCount = story.characterReferences?.length || 0;

  const notes: string[] = [];
  let isValid = true;

  if (actualSceneCount !== expectedSceneCount) {
    notes.push(`Scene count (${actualSceneCount}) differs from target (${expectedSceneCount}).`);
    if (actualSceneCount < expectedSceneCount * 0.7) {
      isValid = false;
    }
  } else {
    notes.push(`Scene count matches target exactly (${actualSceneCount} of ${expectedSceneCount} scenes).`);
  }

  if (characterCount === 0) {
    isValid = false;
    notes.push('No characters found in Character Bible.');
  } else {
    notes.push(`Dynamic cast validated: ${characterCount} characters in Master Bible.`);
  }

  if (referenceCount < characterCount) {
    notes.push(`Character references generated for ${referenceCount} of ${characterCount} characters.`);
  } else {
    notes.push(`Complete reference assets generated for all ${characterCount} characters.`);
  }

  return {
    selectedDuration: story.duration,
    expectedSceneCount,
    actualSceneCount,
    expectedTimeline,
    actualTimeline,
    characterCount,
    characterBibleCount,
    referenceCount,
    isValid,
    notes,
  };
}

export function computeProductionChecklist(story: VeggieStory): ProductionChecklistStatus {
  const characters = story.characters || [];
  const scenes = story.scenes || [];
  const references = story.characterReferences || [];

  const characterReferencesReady = references.length >= characters.length && characters.length > 0;
  const characterIdentitiesLocked = characters.length > 0 && characters.every(c => c.lockedVisualDescription && c.lockedVisualDescription.trim().length > 10);
  const storyDurationValidated = !!story.duration;
  const expectedScenes = getExpectedSceneCount(story.duration);
  const sceneCountValidated = scenes.length >= Math.min(expectedScenes, 3);
  const timelineValidated = scenes.length > 0 && scenes[scenes.length - 1].timeRange?.includes('–');
  const dialogueValidated = scenes.length > 0 && scenes.some(s => s.dialogue && s.dialogue.trim().length > 0);
  const continuityValidated = scenes.length > 0 && scenes.every(s => !!s.continuityIntoNext && !!s.continuityFromPrevious);
  const videoPromptsGenerated = scenes.length > 0 && scenes.every(s => s.finalVideoPrompt && s.finalVideoPrompt.trim().length > 20);
  const audioDirectionGenerated = scenes.length > 0 && scenes.every(s => !!s.soundEffects && !!s.backgroundMusicMood);

  const readyForFlow =
    characterReferencesReady &&
    characterIdentitiesLocked &&
    sceneCountValidated &&
    timelineValidated &&
    videoPromptsGenerated;

  return {
    characterReferencesReady,
    characterIdentitiesLocked,
    storyDurationValidated,
    sceneCountValidated,
    timelineValidated,
    dialogueValidated,
    continuityValidated,
    videoPromptsGenerated,
    audioDirectionGenerated,
    readyForFlow,
  };
}

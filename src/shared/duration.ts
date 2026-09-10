/**
 * Single source of truth for duration presets, scene-count calculation and
 * timeline formatting.
 *
 * Imported by BOTH the Express server (server.ts) and the React client
 * (utils/validation.ts, components/DurationSelector.tsx). Keep it free of any
 * React, Node or Gemini imports so it stays portable across both bundles.
 *
 * Every scene is a fixed 10-second shot, so scene count and runtime are two
 * views of the same number.
 */

export const SECONDS_PER_SCENE = 10;

export interface DurationPreset {
  /** Canonical value stored on the story and sent to the API. */
  id: string;
  label: string;
  shortLabel: string;
  /** Short marketing descriptor shown under the label. */
  tag: string;
  /** Fixed scene count for this preset (0 for the Custom entry). */
  scenesCount: number;
  /** Narrative length hint shown in the picker. */
  wordCount: string;
  isLongForm?: boolean;
  /** True for the Custom entry, whose scene count is computed at runtime. */
  isCustom?: boolean;
}

/**
 * The canonical preset list. Order is significant: it drives the picker grid.
 */
export const DURATION_PRESETS: DurationPreset[] = [
  { id: '30 seconds', label: '30 Seconds', shortLabel: '30s', tag: 'Quick Scene Beat', scenesCount: 3, wordCount: '~80-110 words' },
  { id: '60 seconds', label: '60 Seconds', shortLabel: '60s', tag: 'Standard Story', scenesCount: 6, wordCount: '~160-220 words' },
  { id: '90 seconds', label: '90 Seconds', shortLabel: '90s', tag: 'Extended Sequence', scenesCount: 9, wordCount: '~260-320 words' },
  { id: '2 minutes', label: '2 Minutes', shortLabel: '2m', tag: 'Short Feature', scenesCount: 12, wordCount: '~360-450 words' },
  { id: '4 minutes', label: '4 Minutes', shortLabel: '4m', tag: 'Long-Form Tale', scenesCount: 24, wordCount: '~750-950 words', isLongForm: true },
  { id: '5 minutes', label: '5 Minutes', shortLabel: '5m', tag: 'Animated Movie', scenesCount: 30, wordCount: '~950-1200 words', isLongForm: true },
  { id: '6 minutes', label: '6 Minutes', shortLabel: '6m', tag: 'Multi-Act Quest', scenesCount: 36, wordCount: '~1200-1450 words', isLongForm: true },
  { id: '7 minutes', label: '7 Minutes', shortLabel: '7m', tag: 'Full Narrative Arc', scenesCount: 42, wordCount: '~1400-1700 words', isLongForm: true },
  { id: '8 minutes', label: '8 Minutes', shortLabel: '8m', tag: 'Feature Story', scenesCount: 48, wordCount: '~1600-1950 words', isLongForm: true },
  { id: '9 minutes', label: '9 Minutes', shortLabel: '9m', tag: 'Cinematic Movie', scenesCount: 54, wordCount: '~1800-2150 words', isLongForm: true },
  { id: '10 minutes', label: '10 Minutes', shortLabel: '10m', tag: 'Masterpiece Short Film', scenesCount: 60, wordCount: '~2000-2400 words', isLongForm: true },
  { id: 'Custom', label: 'Custom', shortLabel: 'Custom', tag: 'Tailored Runtime', scenesCount: 0, wordCount: 'Calculated dynamically', isCustom: true },
];

/** Bounds of the Custom duration stepper, in minutes. */
export const CUSTOM_MINUTES_MIN = 1;
export const CUSTOM_MINUTES_MAX = 10;
export const CUSTOM_MINUTES_STEP = 0.5;

/** Quick-pick minute buttons offered next to the Custom slider. */
export const CUSTOM_QUICK_MINUTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** True when a stored duration value represents a Custom runtime. */
export function isCustomDuration(duration: string): boolean {
  return duration === 'Custom' || (duration || '').startsWith('Custom:');
}

/** Clamp a Custom minute value to the supported range. */
export function clampCustomMinutes(minutes: number): number {
  return Math.min(CUSTOM_MINUTES_MAX, Math.max(CUSTOM_MINUTES_MIN, minutes));
}

/** Scene count for an arbitrary Custom runtime, in minutes. */
export function calculateCustomSceneCount(minutes: number): number {
  return Math.max(2, Math.round((minutes * 60) / SECONDS_PER_SCENE));
}

/** Look up a preset by its canonical id. */
export function findDurationPreset(duration: string): DurationPreset | undefined {
  return DURATION_PRESETS.find((preset) => preset.id === duration);
}

/**
 * Resolve a duration value to a target scene count.
 *
 * Matching order is preserved from the original server implementation:
 * preset ladder, then Custom, then a loose "N min" fallback, then a loose
 * "N sec" fallback, then the 6-scene default.
 */
export function calculateSceneCount(durationStr: string, customMinutes?: number): number {
  const norm = (durationStr || '').toLowerCase().trim();

  if (norm.includes('30 second') || norm === '30s') return 3;
  if (norm.includes('60 second') || norm === '60s' || norm.includes('1 minute') || norm === '1m') return 6;
  if (norm.includes('90 second') || norm === '90s') return 9;
  if (norm.includes('2 minute') || norm === '2m') return 12;
  if (norm.includes('4 minute') || norm === '4m') return 24;
  if (norm.includes('5 minute') || norm === '5m') return 30;
  if (norm.includes('6 minute') || norm === '6m') return 36;
  if (norm.includes('7 minute') || norm === '7m') return 42;
  if (norm.includes('8 minute') || norm === '8m') return 48;
  if (norm.includes('9 minute') || norm === '9m') return 54;
  if (norm.includes('10 minute') || norm === '10m') return 60;

  if (norm.startsWith('custom') || customMinutes) {
    let mins = customMinutes;
    if (!mins) {
      const match = norm.match(/(\d+(\.\d+)?)/);
      mins = match ? parseFloat(match[1]) : 3;
    }
    return calculateCustomSceneCount(mins);
  }

  const matchMin = norm.match(/(\d+(\.\d+)?)\s*min/);
  if (matchMin) {
    return calculateCustomSceneCount(parseFloat(matchMin[1]));
  }

  const matchSec = norm.match(/(\d+)\s*(?:sec|second)/);
  if (matchSec) {
    return Math.max(2, Math.round(parseInt(matchSec[1], 10) / SECONDS_PER_SCENE));
  }

  return 6;
}

/** Format an absolute number of seconds as a `m:ss` clock value. */
export function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Continuous timeline slot for a 1-based scene number, e.g. `0:10 – 0:20`. */
export function formatSceneTimeRange(sceneNumber: number): string {
  const startSec = (sceneNumber - 1) * SECONDS_PER_SCENE;
  const endSec = sceneNumber * SECONDS_PER_SCENE;
  return `${formatClock(startSec)} – ${formatClock(endSec)}`;
}

/** Total runtime of a timeline holding `sceneCount` fixed-length scenes. */
export function formatTotalDuration(sceneCount: number): string {
  return formatClock(sceneCount * SECONDS_PER_SCENE);
}

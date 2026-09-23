/**
 * Single source of truth for duration presets, scene-count calculation and
 * timeline formatting.
 *
 * Imported by BOTH the Express server (server.ts) and the React client
 * (utils/validation.ts, components/DurationSelector.tsx). Keep it free of any
 * React, Node or provider imports so it stays portable across both bundles.
 *
 * Every scene is one fixed-length shot, so scene count and runtime are two views
 * of the same number. Each preset therefore states its RUNTIME and derives its
 * scene count - the counts used to be written out by hand, which meant changing
 * the shot length silently left eleven wrong numbers behind.
 */

/**
 * The length of one shot, in seconds.
 *
 * Everything else in this file, the speakability envelope in
 * performance-budget.ts, the beat clock and every prompt string derive from
 * this, so the shot length is a one-line change.
 *
 * Moved 10 -> 8 -> 10. Eight seconds was tried to match Veo's native clip
 * length, but measured against real stories it left too little room: mean
 * spoken words landed at 11.1 against a 15-word envelope, and a third of
 * scenes overran. Ten seconds gives a conversation space to happen in.
 */
export const SECONDS_PER_SCENE = 10;

/** Scene count for a runtime. The only place this arithmetic lives. */
export function scenesForSeconds(seconds: number): number {
  return Math.max(2, Math.round(seconds / SECONDS_PER_SCENE));
}

export interface DurationPreset {
  /** Canonical value stored on the story and sent to the API. */
  id: string;
  label: string;
  shortLabel: string;
  /** Short marketing descriptor shown under the label. */
  tag: string;
  /** Runtime in seconds. The scene count derives from this. */
  seconds: number;
  /** Derived: how many fixed-length shots fill this runtime. */
  scenesCount: number;
  /** Narrative length hint shown in the picker. Tracks RUNTIME, not shot count. */
  wordCount: string;
  isLongForm?: boolean;
  /** True for the Custom entry, whose scene count is computed at runtime. */
  isCustom?: boolean;
}

/** A preset before its scene count is filled in. */
type PresetSeed = Omit<DurationPreset, 'scenesCount'>;

const PRESET_SEEDS: PresetSeed[] = [
  { id: '30 seconds', label: '30 Seconds', shortLabel: '30s', tag: 'Quick Scene Beat', seconds: 30, wordCount: '~80-110 words' },
  { id: '60 seconds', label: '60 Seconds', shortLabel: '60s', tag: 'Standard Story', seconds: 60, wordCount: '~160-220 words' },
  { id: '90 seconds', label: '90 Seconds', shortLabel: '90s', tag: 'Extended Sequence', seconds: 90, wordCount: '~260-320 words' },
  { id: '2 minutes', label: '2 Minutes', shortLabel: '2m', tag: 'Short Feature', seconds: 120, wordCount: '~360-450 words' },
  { id: '4 minutes', label: '4 Minutes', shortLabel: '4m', tag: 'Long-Form Tale', seconds: 240, wordCount: '~750-950 words', isLongForm: true },
  { id: '5 minutes', label: '5 Minutes', shortLabel: '5m', tag: 'Animated Movie', seconds: 300, wordCount: '~950-1200 words', isLongForm: true },
  { id: '6 minutes', label: '6 Minutes', shortLabel: '6m', tag: 'Multi-Act Quest', seconds: 360, wordCount: '~1200-1450 words', isLongForm: true },
  { id: '7 minutes', label: '7 Minutes', shortLabel: '7m', tag: 'Full Narrative Arc', seconds: 420, wordCount: '~1400-1700 words', isLongForm: true },
  { id: '8 minutes', label: '8 Minutes', shortLabel: '8m', tag: 'Feature Story', seconds: 480, wordCount: '~1600-1950 words', isLongForm: true },
  { id: '9 minutes', label: '9 Minutes', shortLabel: '9m', tag: 'Cinematic Movie', seconds: 540, wordCount: '~1800-2150 words', isLongForm: true },
  { id: '10 minutes', label: '10 Minutes', shortLabel: '10m', tag: 'Masterpiece Short Film', seconds: 600, wordCount: '~2000-2400 words', isLongForm: true },
  { id: 'Custom', label: 'Custom', shortLabel: 'Custom', tag: 'Tailored Runtime', seconds: 0, wordCount: 'Calculated dynamically', isCustom: true },
];

/**
 * The canonical preset list. Order is significant: it drives the picker grid.
 *
 * Scene counts are derived, never written by hand.
 */
export const DURATION_PRESETS: DurationPreset[] = PRESET_SEEDS.map((seed) => ({
  ...seed,
  scenesCount: seed.isCustom ? 0 : scenesForSeconds(seed.seconds),
}));

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
  return scenesForSeconds(minutes * 60);
}

/** Look up a preset by its canonical id. */
export function findDurationPreset(duration: string): DurationPreset | undefined {
  return DURATION_PRESETS.find((preset) => preset.id === duration);
}

/**
 * The loose spellings each preset answers to.
 *
 * Kept as a table so the runtime is stated once. The previous version returned a
 * hardcoded scene count per branch, which is why the shot length could not be
 * changed without rewriting eleven literals.
 */
const DURATION_ALIASES: Array<{ seconds: number; matches: (norm: string) => boolean }> = [
  { seconds: 30, matches: (n) => n.includes('30 second') || n === '30s' },
  { seconds: 60, matches: (n) => n.includes('60 second') || n === '60s' || n.includes('1 minute') || n === '1m' },
  { seconds: 90, matches: (n) => n.includes('90 second') || n === '90s' },
  { seconds: 120, matches: (n) => n.includes('2 minute') || n === '2m' },
  { seconds: 240, matches: (n) => n.includes('4 minute') || n === '4m' },
  { seconds: 300, matches: (n) => n.includes('5 minute') || n === '5m' },
  { seconds: 360, matches: (n) => n.includes('6 minute') || n === '6m' },
  { seconds: 420, matches: (n) => n.includes('7 minute') || n === '7m' },
  { seconds: 480, matches: (n) => n.includes('8 minute') || n === '8m' },
  { seconds: 540, matches: (n) => n.includes('9 minute') || n === '9m' },
  { seconds: 600, matches: (n) => n.includes('10 minute') || n === '10m' },
];

/**
 * Resolve a duration value to a target scene count.
 *
 * Matching order is preserved from the original server implementation:
 * preset ladder, then Custom, then a loose "N min" fallback, then a loose
 * "N sec" fallback, then the 60-second default.
 */
export function calculateSceneCount(durationStr: string, customMinutes?: number): number {
  const norm = (durationStr || '').toLowerCase().trim();

  // The 10-minute alias must not be shadowed by the 1-minute one, so the table
  // is scanned in its declared order and '10 minute' is tested before '1m'
  // can match it - '1m' is an exact-equality test for exactly this reason.
  const alias = DURATION_ALIASES.find((entry) => entry.matches(norm));
  if (alias) return scenesForSeconds(alias.seconds);

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
    return scenesForSeconds(parseInt(matchSec[1], 10));
  }

  return scenesForSeconds(60);
}

/** Format an absolute number of seconds as a `m:ss` clock value. */
export function formatClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.round(totalSeconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Continuous timeline slot for a 1-based scene number, e.g. `0:08 – 0:16`. */
export function formatSceneTimeRange(sceneNumber: number): string {
  const startSec = (sceneNumber - 1) * SECONDS_PER_SCENE;
  const endSec = sceneNumber * SECONDS_PER_SCENE;
  return `${formatClock(startSec)} – ${formatClock(endSec)}`;
}

/** Total runtime of a timeline holding `sceneCount` fixed-length scenes. */
export function formatTotalDuration(sceneCount: number): string {
  return formatClock(sceneCount * SECONDS_PER_SCENE);
}

/** How a shot's length reads in prose. Derived, never written out. */
export const SHOT_LENGTH_LABEL = `${SECONDS_PER_SCENE}s`;
export const SHOT_LENGTH_PHRASE = `${SECONDS_PER_SCENE}-second`;

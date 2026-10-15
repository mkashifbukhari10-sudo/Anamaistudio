/**
 * Single source of truth for the STORY PACKS the studio offers.
 *
 * Imported by BOTH the Express server (src/server/packs/*) and the React client
 * (components/PackSelector.tsx). Keep it free of any React, Node or provider
 * imports so it stays portable across both bundles — the same rule
 * shared/duration.ts follows, and for the same reason.
 *
 * A pack's full server-side definition — prompt vocabulary, reference-sheet
 * defaults, craft doctrine — lives in src/server/packs/. What lives HERE is
 * only the part the picker needs and the part both sides must agree on: the
 * id, how it is named to the user, and whether its films carry speech.
 *
 * Adding a pack: add an entry here, then a definition in src/server/packs/.
 */

/** The ids, as they travel in the API payload and are stored on a story. */
export type PackId = 'vegetables' | 'poultry';

/** How much of the performance is carried by speech. */
export type PackDialogueMode = 'full' | 'sparse' | 'none';

export interface PackDescriptor {
  id: PackId;
  /** Name in the picker. */
  label: string;
  /** One line under the label. */
  tagline: string;
  /** Short badge, like the duration presets' tags. */
  badge: string;
  /** What this world is, for the picker's body text. */
  description: string;
  emoji: string;
  dialogue: PackDialogueMode;
  /**
   * What the Character Bible's domain-anatomy field is called in the UI.
   * "Veggie Features" is wrong on a hen, and it is printed in the production
   * package a person reads.
   */
  anatomyFieldLabel: string;
  /** What one cast member's kind is called in the UI. */
  typeFieldLabel: string;
  /**
   * The topic the form starts on for this world. Switching world replaces it,
   * but only while the operator has not typed one of their own - a vegetable
   * premise sitting in a wordless farmyard film is the wrong starting point.
   */
  defaultTopic: string;
}

/**
 * The pack list. Order drives the picker, and the FIRST entry is the default
 * for any story that does not name one — which is every story generated before
 * packs existed.
 */
export const PACKS: PackDescriptor[] = [
  {
    id: 'vegetables',
    label: 'Vegetable Village',
    tagline: 'Anthropomorphic vegetable cast, spoken story',
    badge: 'Original',
    description:
      'A village of anthropomorphic vegetables who talk. Full spoken dialogue in your chosen language, with the complete conversation and performance planning.',
    emoji: '🥕',
    dialogue: 'full',
    anatomyFieldLabel: 'Veggie Features',
    typeFieldLabel: 'Vegetable Type',
    defaultTopic: 'Gajar aur Tamatar ki dosti',
  },
  {
    id: 'poultry',
    label: 'Farmyard Chicks',
    tagline: 'Hen, eggs and chicks — wordless, Foley-driven',
    badge: 'Wordless',
    description:
      'A mother hen, her eggs and her chicks. Carried entirely by action, faces, Foley and score with no spoken lines at all, so the film travels across every language.',
    emoji: '🐣',
    dialogue: 'none',
    anatomyFieldLabel: 'Plumage & Beak',
    typeFieldLabel: 'Bird / Animal',
    defaultTopic: 'Murghi aur uske choozay',
  },
];

export const DEFAULT_PACK: PackDescriptor = PACKS[0];
export const DEFAULT_PACK_ID: PackId = PACKS[0].id;

/** Resolve an id to a descriptor, falling back to the default. */
export function findPack(id: string | undefined | null): PackDescriptor {
  const wanted = String(id ?? '').trim().toLowerCase();
  if (!wanted) return DEFAULT_PACK;
  return PACKS.find((p) => p.id === wanted) ?? DEFAULT_PACK;
}

/** True when this pack's films carry no spoken lines at all. */
export function isPackWordless(id: string | undefined | null): boolean {
  return findPack(id).dialogue === 'none';
}

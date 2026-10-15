import type { StoryPack } from "./types.js";
import { VEGETABLE_PACK } from "./vegetables.js";
import { POULTRY_PACK } from "./poultry.js";

export type { StoryPack, DialogueMode, PackCharacterDefaults } from "./types.js";
export { isWordless, speechFindingsApply } from "./types.js";
export { VEGETABLE_PACK } from "./vegetables.js";
export { POULTRY_PACK } from "./poultry.js";
export { buildCharacterReferencePackage } from "./reference.js";
export { normalizePackCharacter, normalizePackCast, characterTypeOf } from "./character.js";
export { buildPackSceneDoctrine } from "./scene-doctrine.js";

/**
 * The pack registry.
 *
 * Order is significant: it drives the picker, and the FIRST entry is the
 * default for any request that does not name a pack. Vegetables must stay
 * first, so every existing client keeps the behaviour it has today.
 */
export const STORY_PACKS: StoryPack[] = [VEGETABLE_PACK, POULTRY_PACK];

export const DEFAULT_PACK_ID = STORY_PACKS[0].id;

/**
 * Resolve a pack id to a pack, falling back to the default.
 *
 * Deliberately forgiving. An unknown id is a client that is older than the
 * pack list or a typo in a hand-made request, and in both cases producing the
 * default film is better than failing a generation the caller is waiting on.
 * The fallback is logged by the caller, not here, so this stays pure.
 */
export function resolvePack(id: unknown): StoryPack {
  const wanted = String(id ?? "").trim().toLowerCase();
  if (!wanted) return STORY_PACKS[0];
  return STORY_PACKS.find((p) => p.id === wanted) ?? STORY_PACKS[0];
}

/** True when the id names a pack that exists. */
export function isKnownPack(id: unknown): boolean {
  const wanted = String(id ?? "").trim().toLowerCase();
  return STORY_PACKS.some((p) => p.id === wanted);
}

/** The picker's rows: id, label and tagline only. */
export function listPacks(): Array<{ id: string; label: string; tagline: string; dialogue: string }> {
  return STORY_PACKS.map((p) => ({
    id: p.id,
    label: p.label,
    tagline: p.tagline,
    dialogue: p.dialogue,
  }));
}

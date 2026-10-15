import type { StoryPack } from "./types.js";
import { findPack } from "../../shared/packs.js";

/** Name, tagline and id come from the shared descriptor the picker also reads. */
const UI = findPack("vegetables");

/**
 * PACK 1 — anthropomorphic vegetables.
 *
 * The original and default world. Every string here was lifted VERBATIM out of
 * the hardcoded prompts in app.ts and blueprint.ts, so extracting the pack
 * cannot change what the vegetable path sends to the model. The reference-sheet
 * output is pinned byte-for-byte by tests/story-pack.test.ts against a baseline
 * captured before the extraction.
 *
 * Do not "improve" the wording here while reviewing the pack mechanism. Any
 * change to these strings changes generated output, and this file's whole
 * purpose is to prove the mechanism is inert.
 */
export const VEGETABLE_PACK: StoryPack = {
  id: UI.id,
  label: UI.label,
  tagline: UI.tagline,

  castDescription: "anthropomorphic vegetable characters",
  filmDescription: "animated vegetable story",
  characterTypeLabel: "Vegetable type",
  featuresLabel: "Vegetable-specific physical features",
  anatomyLabel: "Botanical anatomy",
  portraitAnatomyLabel: "green vegetable crown/stem",
  sheetAnatomyLabel: "vegetable anatomy",
  bodyShapeNoun: "vegetable shape",

  defaults: {
    characterName: "Veggie Character",
    characterType: "Vegetable",
    bodyShape: "anthropomorphic toddler proportions",
    faceDesign: "friendly round cheeks with rosy blush",
    eyeStyleAndColor: "large expressive dark brown Pixar-style eyes",
    mouthStyle: "wide cheerful smile",
    features: "fresh leafy green top",
    clothing: "colorful dungarees with round buttons",
    shoes: "tiny matching sneakers",
    accessories: "none",
    mainColors: "bright vibrant palette",
  },

  featureLockRule:
    "BOTANICAL FEATURES: Fixed stem/leaf crown ({features}). Do NOT remove or modify leaf counts or sprout styles.",

  referenceNegatives: ["missing leaves", "missing shoes"],
  realismNegatives: ["photorealistic human skin", "realistic produce photographs"],

  heartwarmingFlavour:
    "Heartwarming: Gentle, tender moments of vegetable care, cozy comfort, and empathy.",

  dialogue: "full",
  speechDeclaration:
    "All dialogue is SPOKEN aloud by the characters and lip-synced.",
};

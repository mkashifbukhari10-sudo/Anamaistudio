import type { StoryPack } from "./types.js";
import { VEGETABLE_PACK } from "./vegetables.js";

/**
 * Character reference packages — the prompts for Flow's "Ingredients" slot.
 *
 * Moved here verbatim from app.ts, where it was a private function inside a
 * 2500-line route file and therefore untestable. The only change is that the
 * five domain words it used to hardcode now come from the pack.
 *
 * The vegetable pack's output is pinned byte-for-byte against a baseline
 * captured before the move (tests/story-pack.test.ts), because these strings
 * are what the image model actually receives: rewording them silently changes
 * every reference image the studio has ever produced.
 */
export function buildCharacterReferencePackage(
  char: any,
  animationStyle: string = "Cute 3D",
  pack: StoryPack = VEGETABLE_PACK
): any {
  const d = pack.defaults;
  const style = animationStyle || "Cute 3D";
  const name = char.name || d.characterName;
  // Accept both the new field and the historical one, so a story generated
  // before the rename still renders its reference sheets.
  const type = char.characterType || char.veggieType || d.characterType;
  const body = char.bodyShape || d.bodyShape;
  const face = char.faceDesign || d.faceDesign;
  const eyes = char.eyeStyleAndColor || d.eyeStyleAndColor;
  const mouth = char.mouthStyle || d.mouthStyle;
  const features = char.characterFeatures || char.veggieFeatures || d.features;
  const clothing = char.clothing || d.clothing;
  const shoes = char.shoes || d.shoes;
  const accessories = char.accessories || d.accessories;
  const colors = char.mainColors || d.mainColors;

  const fullBodyPrompt = `Full-body character reference of ${name}, a cute anthropomorphic ${type} in ${style} animation style. Clean neutral light gray studio background, soft cinematic studio key lighting, centered turnaround view from head to feet. Body proportions: ${body}. Facial features: ${face}, eyes: ${eyes}, mouth: ${mouth}. ${pack.anatomyLabel}: ${features}. Wardrobe: ${clothing}, shoes: ${shoes}, accessories: ${accessories}. Color palette: ${colors}. Standing in a relaxed neutral A-pose with clear silhouette and crisp edge definition. Masterpiece 3D children's animation character asset, high resolution, no background elements or story environment.`;

  const frontFacingPrompt = `Front-facing character reference portrait of ${name}, anthropomorphic ${type}, ${style} children's animation feature film quality. Direct frontal close-up angle centered on face and upper torso against a clean neutral off-white background. Showing detailed face design: ${face}, expressive eyes: ${eyes}, mouth: ${mouth}, ${pack.portraitAnatomyLabel}: ${features}, collar and upper clothing: ${clothing}, accessories: ${accessories}. Symmetrical camera composition, soft even rim lighting, sharp texture detail, character model reference standard.`;

  const characterSheetPrompt = `Professional 3D animation character model sheet of ${name} the anthropomorphic ${type}. Multiple views of the EXACT SAME character on a single clean neutral background: Front view, 3/4 front view, Side profile view, and Back view. Maintaining 100% identical body proportions (${body}), face (${face}, ${eyes}), ${pack.sheetAnatomyLabel} (${features}), clothing (${clothing}), shoes (${shoes}), and palette (${colors}) across all 4 turnaround angles. Studio model sheet for Google Flow / Veo animation reference, uniform lighting, high consistency.`;

  const expressionSheetPrompt = `Animation character expression sheet for ${name} (${type}), ${style} style. A grid showcasing 6 distinct emotional expressions of the SAME identical character: (1) Happy beaming smile, (2) Sad downturned pout with teary eyes, (3) Wide-eyed surprised gasp with raised eyebrows, (4) Excited cheering with starry eyes, (5) Worried / cautious look with tilted head, (6) Big laughing chuckle. Core visual identity is 100% locked: identical ${body}, ${features}, ${eyes}, ${clothing}, and ${colors}. Only facial muscles and mouth/brow shapes alter dynamically.`;

  const flowVeoInstructions = `CRITICAL FLOW / VEO VISUAL CONSISTENCY INSTRUCTIONS FOR ${name.toUpperCase()} (${type.toUpperCase()}):
1. ANATOMY & PROPORTIONS: Must strictly maintain ${body}. Do NOT alter torso height, limb proportions, or ${pack.bodyShapeNoun}.
2. ${pack.featureLockRule.replace("{features}", features)}
3. FACIAL IDENTITY: ${face} with ${eyes} and ${mouth}. Eye color and catchlights must remain identical in every frame.
4. LOCKED WARDROBE: Outfit must always be ${clothing}, footwear must always be ${shoes}, accessories: ${accessories}. Never switch clothing styles or colors.
5. COLOR PALETTE: Strictly adhere to ${colors}.
6. ANIMATION FLAVOR: ${style} Pixar/Illumination feel with squash-and-stretch physics.
7. USAGE RULE: Treat this reference package as the authoritative visual Ingredient in Google Flow / Veo video generation. All scene generations must align with this locked asset.`;

  const negativePrompt = `Avoid in all generations of ${name}: ${pack.realismNegatives.join(", ")}, changed clothing, alternate colors, wrong eye color, different body shape, adult proportions, extra limbs, ${pack.referenceNegatives.join(", ")}, random accessories, realistic textures, dark gritty horror lighting, blurry artifacts, text, watermarks, logo overlays, deformed face, character redesign.`;

  return {
    characterId: char.id || `char_${type.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
    characterName: name,
    // Both names: the new one for the pack era, the old one so the existing
    // Character Reference Studio keeps rendering without a client change.
    characterType: type,
    veggieType: type,
    fullBodyPrompt,
    frontFacingPrompt,
    characterSheetPrompt,
    expressionSheetPrompt,
    flowVeoInstructions,
    negativePrompt,
  };
}

import type { StoryPack } from "./types.js";
import { findPack } from "../../shared/packs.js";

/** Name, tagline and id come from the shared descriptor the picker also reads. */
const UI = findPack("poultry");

/**
 * PACK 2 — farmyard poultry. Wordless.
 *
 * A mother hen, her eggs and her chicks, in the register of the farmyard
 * animation shorts that circulate on YouTube and Reels: hatching, feeding,
 * straying, a threat, a rescue, a reunion. Carried by action, Foley and score
 * with NO spoken lines, which is what lets the genre travel across languages.
 *
 * ---------------------------------------------------------------------------
 * ASSUMPTIONS — stated because they were not sourced from reference videos.
 *
 * Reference links were not available when this pack was written, so the format
 * below is reasoned from the genre description rather than measured from real
 * examples. Each of these is a dial, not a fact, and each is cheap to change:
 *
 *   1. SHAPE. A continuous 4-6 minute story with one arc, not a loopable
 *      30-second short. (Driven by the stated 4- and 6-minute targets.)
 *   2. CAST. Mother hen as protagonist; chicks as a small named group; rooster
 *      optional; one antagonist force per film.
 *   3. THREAT. Present in most films but NOT mandatory - a film that is only
 *      hatching and feeding is a legitimate episode, and making jeopardy
 *      compulsory would produce the same mechanical writing the seam-thread
 *      module warns about.
 *   4. SPEECH. Fully wordless. If the references turn out to carry occasional
 *      words ("Mama!"), change `dialogue` to "sparse" - the pipeline already
 *      handles that mode.
 *   5. IDENTITY. Chicks are individuals with fixed distinguishing marks, not an
 *      interchangeable flock. See CHICK COUNT below for why this matters.
 * ---------------------------------------------------------------------------
 */
export const POULTRY_PACK: StoryPack = {
  id: UI.id,
  label: UI.label,
  tagline: UI.tagline,

  castDescription: "a family of farmyard birds - a mother hen, her chicks, and the birds and animals of their yard",
  filmDescription: "wordless animated farmyard story",
  characterTypeLabel: "Bird or animal kind (hen, rooster, chick, duck, cat, hawk)",
  featuresLabel: "Plumage, comb, beak and claw features",
  anatomyLabel: "Plumage and beak anatomy",
  portraitAnatomyLabel: "comb, wattle and beak",
  sheetAnatomyLabel: "plumage anatomy",
  bodyShapeNoun: "bird silhouette",

  defaults: {
    characterName: "Farmyard Bird",
    characterType: "Hen",
    bodyShape: "rounded hen proportions, low centre of gravity, short sturdy legs",
    faceDesign: "soft feathered cheeks with a small bright comb",
    eyeStyleAndColor: "large glossy amber eyes with a dark ring and a clear catchlight",
    mouthStyle: "short tapered beak, expressive at the corners",
    features: "layered russet body feathers, a single upright red comb, a pale yellow beak and scaled yellow feet",
    // A hen is not dressed. The genre's charm is feathers, not wardrobe, so the
    // clothing slots carry the natural equivalents rather than being blanked -
    // the reference prompt reads the same fields for every pack.
    clothing: "no clothing - natural plumage only",
    shoes: "bare scaled feet, no footwear",
    accessories: "none",
    mainColors: "warm russet, cream and straw-gold with a red comb",
  },

  featureLockRule:
    "PLUMAGE & BEAK: Fixed feather pattern, comb shape and beak colour ({features}). Do NOT change feather colour blocks, comb size or the number of tail feathers between shots.",

  referenceNegatives: [
    "human clothing on the birds",
    "changed comb shape",
    "changed feather colour",
    "wrong number of tail feathers",
    "human hands or human faces",
  ],
  realismNegatives: [
    "real chicken photography",
    "documentary farm footage",
    "photorealistic feathers",
    "slaughterhouse or butchery imagery",
  ],

  heartwarmingFlavour:
    "Heartwarming: Gentle, tender moments of a mother bird's care - brooding, feeding, sheltering under a wing - cozy comfort, and empathy.",

  dialogue: "none",
  // The counterpart of the vegetable pack's lip-sync promise. Stated at least
  // as firmly, because a video model given silence with no instruction invents
  // mouth movement, and - measured in a real generation of the other pack - it
  // also invents drawn speech balloons.
  speechDeclaration:
    "NO character speaks and NO words are said: there is no dialogue, no narration and no lyrics. The birds vocalise only as real birds do - clucks, soft brooding purrs, sharp alarm calls and the high peeping of chicks - and these are never shaped into words. The whole story is carried by action, by what the faces do, by Foley and by score. No speech balloons, no subtitles and no written words of any kind appear in the picture.",

  suggestions: [
    "Teen ande, aur ek jo sab se baad mein toota",
    "Choti choozi jo apni maa se bichhar gayi",
    "Murghi aur baaz ka saaya",
    "Ek anda jo kabhi nahi toota",
    "Choozay ne pehli baar baarish dekhi",
    "Murgha jo subah bulana bhool gaya",
  ],

  // -------------------------------------------------------------------------
  // The craft rules that only matter in a wordless farmyard film.
  // -------------------------------------------------------------------------
  extraDoctrine: `
==================================================
WORDLESS FARMYARD FILM - WHAT CARRIES THE STORY
==================================================
NOBODY SPEAKS. Not one line, in any scene. Do not write dialogue, narration,
captions or song lyrics, and do not plan a scene whose point only lands if
someone explains it. Leave 'dialogueTurns' empty in every scene.

What carries meaning instead, in order of strength:

- WHAT A BODY DOES. A hen who has counted her chicks and found one missing
  shows it by stopping, lifting a wing and looking back - not by announcing it.
  Every emotional turn must be stageable as a physical action.
- WHAT A FACE DOES. Write the look: the moment the eyes find the gap, the
  moment they find the chick. The reaction IS the dialogue of this film.
- WHAT IS HEARD. Every scene must specify its Foley and score, because sound is
  now half the performance and an unspecified soundscape renders as silence.
  Name the sounds: straw, the shell's first crack, the peeping, wingbeat, wind,
  a distant hawk's cry, the yard going quiet.
- WHAT CHANGES IN THE FRAME. A thing moved, uncovered, broken, carried or
  closed. Prefer a visible change of state to a visible emotion about it.

ACTION LINES IN ENGLISH, ALWAYS. 'characterActions' and 'visualDescription'
must be written in English even when the story's language is Roman Urdu, Hindi
or Urdu. In a film with dialogue, an action line in another language costs a
little measurement accuracy. In THIS film action is the only channel there is,
so a non-English action line means the shot cannot be measured for density,
pacing or staging at all - the quality layer reads English staging verbs. Names
of characters and places stay in the story's language; the verbs around them do
not.

==================================================
CHICK COUNT - FIXED, STATED, AND NEVER RE-INVENTED
==================================================
Decide the number of chicks ONCE, in the blueprint, and write that number into
the world facts. It must be the same in every scene of the film.

This is the single most likely way this film falls apart. The video model
generates each clip independently and re-invents anything it was not told
precisely - measured in a real generation of the other pack, an unnamed
background crowd changed completely across a single cut, and in-frame lettering
garbled at the same join. A loose group of small identical birds is exactly
that kind of detail, and the audience counts chicks without being asked to.

Therefore:
- NAME THE CHICKS AND PUT THEM IN THE CAST. Each chick the story follows is a
  character with its own entry in the Character Bible and its own locked visual
  description, exactly like the hen. They are not background. A real generation
  did this unprompted and it is why its chicks held: three named chicks, each
  carrying one fixed mark into all 24 shots.
- Give each one ONE fixed distinguishing mark, described the SAME way in every
  scene: "a dark charcoal smudge over his right eye", "a cream-coloured belly
  patch and a heavy waddling stance", "ultra-tiny, pale-cream down and a pale
  pearl beak". A chick the story asks us to care about must be findable in the
  frame without being pointed at.
- Any chicks BEYOND the named ones are background, and their number and look go
  in 'continuityState.backgroundCast' for every scene they appear in.
- When a chick is separated, say explicitly how many remain with the hen.
  "The hen and the chicks" is the phrasing that produces a different number of
  chicks in the next shot.

==================================================
THE JOIN, WITHOUT DIALOGUE
==================================================
'openThread' still carries the dramatic half of every join, but in this film it
is never a question someone asked. It is something unfinished that the AUDIENCE
can see: the gate is still open · a chick is missing and the hen has not
noticed the gap yet · the hawk's shadow has passed but nothing has moved · the
last egg has not cracked. The next scene must ENGAGE it - resolve it, worsen
it, or show someone notice it at last. Set it to 'None' at a genuine act break
or resolution; a hook at every join is as mechanical as none at all.
`.trim(),
};

/**
 * Fixture corpus for action density.
 *
 * RENDERABLE - staging a single ten-second clip can actually hold. These
 *              matter more than the overloaded ones: a check that flags a good
 *              continuous action shot, or a busy frame with background life,
 *              would push every scene toward emptiness.
 *
 * OVERLOADED - staging that needs an edit. Several sequential beats, usually
 *              with the actor changing place between them.
 *
 * The hard distinction is NOT "how many verbs". It is:
 *   one continuous compound action, possibly with simultaneous background
 *      vs
 *   several independent beats that must happen one after another.
 *
 * Several renderable fixtures are deliberately verb-heavy for that reason.
 */

export interface ActionFixture {
  name: string;
  expectation: "overloaded" | "renderable";
  why: string;
  scene: any;
}

function scene(n: number, characterActions: string, performanceType?: string, animationDirection?: string): any {
  return {
    sceneNumber: n,
    characterActions,
    animationDirection: animationDirection ?? "",
    contract: performanceType ? { performanceType } : undefined,
  };
}

// ===========================================================================
// OVERLOADED — must be flagged
// ===========================================================================

export const OVERLOADED_FIXTURES: ActionFixture[] = [
  {
    name: "cover-up-tour",
    expectation: "overloaded",
    why: "Four sequential beats across three parts of the yard. Taken from the shape of a real generated scene.",
    scene: scene(
      1,
      "Tamatar slides the worst cracked diyas to the back of the cooling ledge, carries an armful across the yard and pushes them under the wood stack, then sets the chipped wooden tray down in the open with its broken corner facing the yard.",
      "silent-emotional"
    ),
  },
  {
    name: "fetch-and-return",
    expectation: "overloaded",
    why: "Leaves, collects, comes back, hands over — a four-beat errand in one clip.",
    scene: scene(
      2,
      "Gajar walks out of the kitchen into the lane, lifts the water pot from the step, carries it back through the doorway and then hands it to Mooli at the counter.",
      "action"
    ),
  },
  {
    name: "search-three-places",
    expectation: "overloaded",
    why: "Three locations searched sequentially.",
    scene: scene(
      3,
      "Kheera pulls the sacks away from the wall, crosses to the crate stack and lifts the top crate down, then opens the cupboard under the counter and reaches inside.",
      "action"
    ),
  },
  {
    name: "dialogue-scene-with-errand",
    expectation: "overloaded",
    why: "A talking scene that also asks for a three-beat errand — the limit is lower for dialogue scenes.",
    scene: scene(
      4,
      "Bhindi sets her cup down on the table, walks across the room to the shelf and takes the ledger down, then carries it back and opens it in front of her brother.",
      "dialogue-scene"
    ),
  },
  {
    name: "montage-element-overpacked",
    expectation: "overloaded",
    why: "A montage element must be one compressed image, not a sequence.",
    scene: scene(
      5,
      "Karela lifts the shutter, steps out into the lane and sweeps the step, then goes back inside and sets the stool down behind the counter.",
      "montage-element"
    ),
  },
  {
    name: "unclassified-tour",
    expectation: "overloaded",
    why: "No performance type declared — the default limit must still catch a five-beat tour.",
    scene: scene(
      6,
      "Aloo picks the lamp up off the floor, carries it through the doorway into the yard, sets it on the wall, walks back to the step and then pulls the door closed behind him."
    ),
  },
];

// ===========================================================================
// RENDERABLE — must NOT be flagged
// ===========================================================================

export const RENDERABLE_FIXTURES: ActionFixture[] = [
  {
    name: "busy-frame-with-background",
    expectation: "renderable",
    why: "One primary action plus two SIMULTANEOUS background strands. A living frame, entirely renderable.",
    scene: scene(
      10,
      "Baingan takes the white-outlined peacock diya out of Tamatar's hands and turns it against the light, running her thumb along the painted edge, while Kaddu keeps pugging clay at the pit and Mirchi swings on the neem rope.",
      "dialogue-scene"
    ),
  },
  {
    name: "continuous-compound-action",
    expectation: "renderable",
    why: "Verb-heavy but one unbroken movement in one place.",
    scene: scene(
      11,
      "Pyaz lifts the front diya out from under the cloth hem, taps it once against her thumbnail, holds it beside her ear and sets it back down on the bricks.",
      "action"
    ),
  },
  {
    name: "single-decisive-action",
    expectation: "renderable",
    why: "One beat, clearly staged.",
    scene: scene(
      12,
      "Kaddu leads Mooli across the yard to the cooling ledge and lifts the cotton cloth off the whole batch with one sweep of his arm.",
      "action"
    ),
  },
  {
    name: "silent-emotional-stillness",
    expectation: "renderable",
    why: "Almost no staging. Silence with one small gesture.",
    scene: scene(
      13,
      "Mooli dries the same plate twice and sets it down on the rack without looking up.",
      "silent-emotional"
    ),
  },
  {
    name: "reaction-held",
    expectation: "renderable",
    why: "A held face and one movement.",
    scene: scene(14, "Mooli's eyes widen and her hand stops halfway to the counting tray.", "reaction"),
  },
  {
    name: "establishing-camera-led",
    expectation: "renderable",
    why: "The camera does the work; one subject acts.",
    scene: scene(
      15,
      "The shutter rolls up on an empty lane and Karela steps into the doorway with the stool under his arm.",
      "establishing"
    ),
  },
  {
    name: "two-actors-simultaneous",
    expectation: "renderable",
    why: "Two people acting at once in one frame is one beat, not two.",
    scene: scene(
      16,
      "Tamatar kneads and shapes one diya after another at the edge of the pit while Kaddu silently carries each finished row to the drying plank.",
      "action"
    ),
  },
  {
    name: "walk-and-talk",
    expectation: "renderable",
    why: "One continuous movement with speech over it.",
    scene: scene(
      17,
      "Mooli steps in through the open gate and stops in the middle of the yard with her accounts book at her side.",
      "dialogue-scene"
    ),
  },
  {
    name: "comedy-two-beat",
    expectation: "renderable",
    why: "Setup and payoff is two beats, which comedy needs and can hold.",
    scene: scene(
      18,
      "Tinku stacks six crates in his arms and immediately drops every one of them.",
      "comedy-beat"
    ),
  },
  {
    name: "short-action-unclassifiable",
    expectation: "renderable",
    why: "Too short to classify — the measure must stay silent rather than guess.",
    scene: scene(19, "Golu sits down.", "reaction"),
  },
];

export const ALL_ACTION_FIXTURES: ActionFixture[] = [...OVERLOADED_FIXTURES, ...RENDERABLE_FIXTURES];

// ===========================================================================
// ROMAN URDU
//
// The language these stories are actually generated in. Every line below is
// either taken from, or written in the style of, real generated output rather
// than invented from a phrasebook.
//
// The distinction the classifier has to hold is the same one it holds in
// English, but expressed differently:
//
//   "tokri uthate HUE ... chalti hai"   - participle: walks WHILE carrying. ONE beat.
//   "utha KAR ... patakta hai"          - conjunctive: one continuous movement.
//   "uthati hai, ... karti hai, PHIR"   - finite verbs in series. SEPARATE beats.
//
// Getting that wrong would turn ordinary compound staging into a false overload,
// which is the fastest way to make the check worthless.
// ===========================================================================

export const ROMAN_URDU_RENDERABLE: ActionFixture[] = [
  {
    name: "ru-single-action",
    expectation: "renderable",
    why: "One finite verb, one small physical beat.",
    scene: scene(30, "Sultan apna bhoora shawl takht par rakh deta hai.", "silent-emotional"),
  },
  {
    name: "ru-continuous-participle",
    expectation: "renderable",
    why: "'uthate hue ... chalti hai' - she walks WHILE carrying. One continuous action.",
    scene: scene(31, "Tamatar tokri uthate hue darwaze ki taraf chalti hai.", "action"),
  },
  {
    name: "ru-conjunctive-compound",
    expectation: "renderable",
    why: "'utha kar ... patakta hai' binds one movement, the way 'picks up and sets down' does.",
    scene: scene(
      32,
      "Nazar Bitto ke haathon se patangon ke bundle utha kar unhe pharsh par halke se patakta hai.",
      "action"
    ),
  },
  {
    name: "ru-simultaneous-jabki",
    expectation: "renderable",
    why: "'jabki' marks parallel staging - a busy frame, not a sequence.",
    scene: scene(
      33,
      "Razia shelf ke neeche se lea ka tin kholti hai, jabki Sultan apna shawl takht par rakh kar darwaze ki taraf mudta hai.",
      "dialogue-scene"
    ),
  },
  {
    name: "ru-simultaneous-usi-waqt",
    expectation: "renderable",
    why: "'usi waqt' is the generator's most common simultaneity marker.",
    scene: scene(
      34,
      "Nikku nal ke neeche se bhara hua paani ka drum uthata hai aur usi waqt Chintu ki chhapri patang uske saamne hawa mein uchhalti hai.",
      "action"
    ),
  },
  {
    name: "ru-different-actors",
    expectation: "renderable",
    why: "Two named actors joined by 'aur' act at the same time in one frame.",
    scene: scene(
      35,
      "Razia chup-chaap shelf se kagaz ki roll utaar kar takht par rakh deti hai aur Sultan der tak khara reh kar use dekhta hai.",
      "dialogue-scene"
    ),
  },
  {
    name: "ru-reaction",
    expectation: "renderable",
    why: "A held reaction with one small movement.",
    scene: scene(36, "Nikku charpai par baith jata hai aur apne haath dekhta hai.", "reaction"),
  },
  {
    name: "ru-silent-emotional",
    expectation: "renderable",
    why: "Stillness with a single gesture.",
    scene: scene(37, "Bitto darwaze ke kinare khari reh kar apni chunni ka kinara pakadti hai.", "silent-emotional"),
  },
  {
    name: "ru-dialogue-with-small-action",
    expectation: "renderable",
    why: "A talking scene with one piece of physical business.",
    scene: scene(38, "Sultan takht par baith kar apni patang ka naap leta hai.", "dialogue-scene"),
  },
  {
    name: "ru-spelling-variants",
    expectation: "renderable",
    why: "Doubled vowels written inconsistently for the same words.",
    scene: scene(39, "Razia tokree utha kar kamray ke andar chalee jaatee hai.", "action"),
  },
  {
    name: "ru-mixed-language",
    expectation: "renderable",
    why: "Mixed English and Roman Urdu, still one continuous action.",
    scene: scene(40, "Nikku picks up the tin dabba aur darwaze ki taraf chalta hai.", "action"),
  },
];

export const ROMAN_URDU_OVERLOADED: ActionFixture[] = [
  {
    name: "ru-five-sequential-beats",
    expectation: "overloaded",
    why: "Five finite verbs in series, closed with 'phir'. The canonical failure.",
    scene: scene(
      50,
      "Tamatar tokri uthati hai, aangan paar karti hai, almari kholti hai, tokri andar rakhti hai, phir darwaza band karti hai.",
      "action"
    ),
  },
  {
    name: "ru-pick-cross-hide-return",
    expectation: "overloaded",
    why: "Pick up, cross, hide, return - four beats and two relocations.",
    scene: scene(
      51,
      "Nikku dabba uthata hai, aangan paar karta hai, usse almari ke andar chhupa deta hai aur wapas chhat par chala jata hai.",
      "action"
    ),
  },
  {
    name: "ru-multiple-relocations",
    expectation: "overloaded",
    why: "Room to stairs to roof inside one clip.",
    scene: scene(
      52,
      "Razia khali tin mez par patak kar seedhi ki taraf mudti hai aur chhat par upar chali jati hai.",
      "action"
    ),
  },
  {
    name: "ru-overloaded-montage",
    expectation: "overloaded",
    why: "A montage element must be one image; this is a sequence.",
    scene: scene(
      53,
      "Sultan darwaza kholta hai, bahar nikalta hai, patang uthata hai aur wapas andar aa jata hai.",
      "montage-element"
    ),
  },
  {
    name: "ru-staging-plus-dialogue",
    expectation: "overloaded",
    why: "Several major physical beats inside a talking scene.",
    scene: scene(
      54,
      "Bitto order-book kholti hai, takht ke paas jati hai, charkhi uthati hai aur usse Nikku ke haath mein thama deti hai.",
      "dialogue-scene"
    ),
  },
];

export const ALL_ROMAN_URDU_FIXTURES: ActionFixture[] = [
  ...ROMAN_URDU_RENDERABLE,
  ...ROMAN_URDU_OVERLOADED,
];

/** Action lines in a language neither vocabulary knows. Must stay unclassified. */
export const UNREADABLE_ACTIONS: string[] = [
  "Le personnage traverse la cour et ouvre la porte lentement avant de sortir.",
  "Die Figur geht durch den Hof und öffnet langsam die Tür bevor sie hinausgeht.",
  "人物穿过院子慢慢打开门然后走了出去并关上了它",
];

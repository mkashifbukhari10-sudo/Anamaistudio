/**
 * Fixture corpus for Beat Density.
 *
 * BAD      - beat sheets that plan a stretch. Written with genuine paraphrase
 *            variation, because the production failure is never copy-paste; it
 *            is the same dramatic move described eight different ways.
 *
 * NEGATIVE - legitimate multi-scene beats that must NOT be flagged. Escalating
 *            attempts, mystery clues, a varied montage, an evolving emotional
 *            conversation, a Life Journey routine and a multi-scene climax.
 *            These matter more: a check that punishes a real escalation
 *            sequence would push the blueprint toward thinner beats, which is
 *            the opposite of the goal.
 *
 * The distinction the threshold has to find is NOT "do these sentences share
 * words" — an escalation sequence repeats its verb by definition. It is
 * "does each sentence describe a different CHANGE".
 */

export interface BeatFixture {
  name: string;
  expectation: "flag" | "clean";
  why: string;
  targetSceneCount: number;
  beats: any[];
}

function beat(
  beatNumber: number,
  name: string,
  sceneStart: number,
  moves: string[],
  declared?: number
): any {
  return {
    beatNumber,
    name,
    chapterNumber: beatNumber,
    sceneStart,
    sceneEnd: sceneStart + moves.length - 1,
    purpose: name,
    distinctScenesNeeded: declared ?? moves.length,
    whatEachSceneDoes: moves,
  };
}

// ===========================================================================
// BAD — planned stretches that must be caught
// ===========================================================================

const stretchedCelebration: BeatFixture = {
  name: "stretched-celebration",
  expectation: "flag",
  why: "Eight closing scenes, all the same move: the village is happy about the same thing.",
  targetSceneCount: 8,
  beats: [
    beat(1, "Sab khush", 1, [
      "The villagers cheer together around the saved cart",
      "The villagers keep cheering happily around the rescued cart",
      "Everyone celebrates joyfully beside the cart they saved",
      "The crowd goes on celebrating around the saved cart",
      "The villagers continue cheering with joy near the cart",
      "Everybody keeps celebrating happily around the rescued cart",
      "The village carries on cheering beside the saved cart",
      "The villagers celebrate on around the cart they rescued",
    ]),
  ],
};

const falseDistinctnessClaim: BeatFixture = {
  name: "false-distinctness-claim",
  expectation: "flag",
  why: "The beat declares all six scenes distinct while describing one move six ways — the specific lie this check exists to catch.",
  targetSceneCount: 6,
  beats: [
    beat(
      1,
      "Talaash",
      1,
      [
        "Kheera searches the shed and finds nothing",
        "Kheera looks through the shed and finds nothing there",
        "Kheera hunts around the shed without finding anything",
        "Kheera searches the shed again and turns up nothing",
        "Kheera keeps looking through the shed and finds nothing",
        "Kheera goes through the shed once more and finds nothing",
      ],
      6
    ),
  ],
};

const repeatedAttemptsNoEscalation: BeatFixture = {
  name: "repeated-attempts-no-escalation",
  expectation: "flag",
  why: "Five attempts at the same obstacle where nothing about the cost, the knowledge or the situation changes.",
  targetSceneCount: 5,
  beats: [
    beat(1, "Koshish", 1, [
      "Golu tries to push the gate open and it does not move",
      "Golu pushes at the gate again and it still does not move",
      "Golu tries the gate once more and it will not budge",
      "Golu shoves the gate again and it stays shut",
      "Golu pushes the gate one more time and it does not open",
    ]),
  ],
};

const repeatedTravel: BeatFixture = {
  name: "repeated-travel",
  expectation: "flag",
  why: "Six scenes of the same journey with no change in situation.",
  targetSceneCount: 6,
  beats: [
    beat(1, "Safar", 1, [
      "They walk along the road toward the town",
      "They keep walking down the road toward town",
      "They continue along the road heading for the town",
      "They carry on walking the road to the town",
      "They walk further along the road to town",
      "They go on walking down the road toward the town",
    ]),
  ],
};

const thinBeatStretchedLong: BeatFixture = {
  name: "thin-beat-stretched-long-runtime",
  expectation: "flag",
  why: "A 24-scene film whose middle beat holds twelve scenes of one conversation — the premise is too small for the runtime.",
  targetSceneCount: 24,
  beats: [
    beat(1, "Ghar ki subah", 1, [
      "The family wakes and the day's work is set out",
      "Mooli is told she is too small to come along",
      "The others leave without her through the gate",
      "Mooli finds the list they forgot on the step",
      "Mooli decides to wait rather than run after them",
      "The others realise they are missing the list",
    ]),
    beat(2, "Baat cheet", 7, [
      "They talk about what to do without the list",
      "They discuss how to manage without the list",
      "They keep talking about managing without the list",
      "They go on discussing what to do about the missing list",
      "They continue to talk over the problem of the list",
      "They talk further about how to cope without the list",
      "They keep discussing the missing list between them",
      "They carry on talking about what to do about it",
      "They go on talking over the lost list together",
      "They continue discussing the list they left behind",
      "They talk on about the problem of the missing list",
      "They keep on discussing what to do without it",
    ]),
    beat(3, "Wapsi", 19, [
      "They turn back toward the house for the list",
      "Mooli holds the list out as they come through the gate",
      "Gajar takes the list without saying much",
      "Mooli is asked to come along next time",
      "The family sets off again with Mooli included",
      "The gate closes on an empty, quiet yard",
    ]),
  ],
};

const repeatedReactionBeat: BeatFixture = {
  name: "repeated-reaction-beat",
  expectation: "flag",
  why: "Four scenes of the same character absorbing the same news.",
  targetSceneCount: 4,
  beats: [
    beat(1, "Khabar", 1, [
      "Mooli takes in the news with shock",
      "Mooli absorbs the shocking news again",
      "Mooli is still taking in the shocking news",
      "Mooli goes on absorbing the news in shock",
    ]),
  ],
};

// ===========================================================================
// NEGATIVE — legitimate multi-scene beats
// ===========================================================================

const escalatingAttempts: BeatFixture = {
  name: "escalating-attempts",
  expectation: "clean",
  why: "Four attempts at one obstacle where each failure costs something new and changes what they know.",
  targetSceneCount: 4,
  beats: [
    beat(1, "Chaar koshishein", 1, [
      "Golu pushes the gate alone and learns the far side is chained",
      "Golu and Tinku lever it with the cart pole, and the pole snaps",
      "They burn the rope through, and the smoke brings the watchman",
      "Golu gives up the shortcut and takes the long road, losing the afternoon",
    ]),
  ],
};

const mysteryClues: BeatFixture = {
  name: "mystery-clues",
  expectation: "clean",
  why: "An investigation where each scene changes what is known.",
  targetSceneCount: 5,
  beats: [
    beat(1, "Suraagh", 1, [
      "Kheera finds a chalk mark nobody admits to making",
      "The weighing ledger shows a crate that was never delivered",
      "Rasili Bi remembers the bell ringing at the wrong hour",
      "The hollow crate stack proves the child was never inside",
      "Kheera realises the thela left before the gate was chained",
    ]),
  ],
};

const variedMontage: BeatFixture = {
  name: "varied-montage",
  expectation: "clean",
  why: "A seasonal montage where the same activity carries a different meaning each time.",
  targetSceneCount: 4,
  beats: [
    beat(1, "Chaar mausam", 1, [
      "Spring: the first seedlings go into wet soil and the work feels light",
      "Summer: weeding under white heat, and the labour starts to cost",
      "Autumn: the basket comes up half full and the season disappoints",
      "Winter: the bare rows are walked once and then left alone",
    ]),
  ],
};

const evolvingConversation: BeatFixture = {
  name: "evolving-emotional-conversation",
  expectation: "clean",
  why: "One conversation across five scenes where the relationship genuinely moves each time.",
  targetSceneCount: 5,
  beats: [
    beat(1, "Ek guftagu", 1, [
      "Aloo asks about the shop and Gajar changes the subject",
      "Gajar admits the work has been gone for two months",
      "Aloo is angry that he was not told, and says so badly",
      "Gajar explains what he was afraid would happen if he told them",
      "Aloo offers to take the morning shift, and neither mentions it again",
    ]),
  ],
};

const lifeJourneyRoutine: BeatFixture = {
  name: "life-journey-routine-variation",
  expectation: "clean",
  why: "A recurring ritual whose meaning changes across the film.",
  targetSceneCount: 4,
  beats: [
    beat(1, "Shutter", 1, [
      "The siblings raise the shutter together, counting out loud",
      "Karela raises it alone and does not count",
      "The shutter sticks, and neither of them fixes it",
      "The shutter stays down, and they walk past it together",
    ]),
  ],
};

const multiSceneClimax: BeatFixture = {
  name: "multi-scene-climax",
  expectation: "clean",
  why: "A climax across five scenes where the situation materially changes at every step.",
  targetSceneCount: 5,
  beats: [
    beat(1, "Aakhri raat", 1, [
      "The water reaches the lower field and the sandbags run out",
      "Golu chooses to flood his own plot to save the shared channel",
      "The channel holds, but the cart is swept off the bank",
      "Tinku goes in after the cart against Golu's shout",
      "They pull Tinku out and let the cart go",
    ]),
  ],
};

const wellPacedFilm: BeatFixture = {
  name: "well-paced-full-film",
  expectation: "clean",
  why: "A whole 12-scene beat sheet where every scene has its own job.",
  targetSceneCount: 12,
  beats: [
    beat(1, "Shuruaat", 1, [
      "The morning routine shows what normal looks like here",
      "The letter arrives and nobody opens it",
      "Mooli opens it and learns the fee is due on Friday",
    ]),
    beat(2, "Dabaav", 4, [
      "Gajar counts the tin and comes up short",
      "Mooli offers her own savings and is refused",
      "The neighbour's offer of a loan is turned down out of pride",
    ]),
    beat(3, "Faisla", 7, [
      "Gajar decides to sell the weighing scale",
      "Mooli realises what the scale meant to him",
      "The scale is carried out and the shop looks wrong without it",
    ]),
    beat(4, "Anjaam", 10, [
      "The fee is paid and the receipt is folded away",
      "Gajar weighs by hand for the first time, badly",
      "Mooli starts learning to weigh by hand beside him",
    ]),
  ],
};

// ===========================================================================
// BACKWARD COMPATIBILITY
// ===========================================================================

/** An old blueprint: real beats, no density fields at all. */
export const LEGACY_BEATS: any[] = [
  { beatNumber: 1, name: "Shuruaat", chapterNumber: 1, sceneStart: 1, sceneEnd: 6, purpose: "establish" },
  { beatNumber: 2, name: "Dabaav", chapterNumber: 2, sceneStart: 7, sceneEnd: 12, purpose: "pressure" },
];

/** Half-migrated: one beat carries the fields, one does not. */
export const PARTIAL_BEATS: any[] = [
  {
    beatNumber: 1,
    name: "Shuruaat",
    chapterNumber: 1,
    sceneStart: 1,
    sceneEnd: 3,
    whatEachSceneDoes: [
      "The morning routine shows what normal looks like",
      "The letter arrives and nobody opens it",
      "Mooli opens it and learns the fee is due",
    ],
    distinctScenesNeeded: 3,
  },
  { beatNumber: 2, name: "Dabaav", chapterNumber: 2, sceneStart: 4, sceneEnd: 6, purpose: "pressure" },
];

export const BAD_BEAT_FIXTURES: BeatFixture[] = [
  stretchedCelebration,
  falseDistinctnessClaim,
  repeatedAttemptsNoEscalation,
  repeatedTravel,
  thinBeatStretchedLong,
  repeatedReactionBeat,
];

export const NEGATIVE_BEAT_FIXTURES: BeatFixture[] = [
  escalatingAttempts,
  mysteryClues,
  variedMontage,
  evolvingConversation,
  lifeJourneyRoutine,
  multiSceneClimax,
  wellPacedFilm,
];

export const ALL_BEAT_FIXTURES: BeatFixture[] = [...BAD_BEAT_FIXTURES, ...NEGATIVE_BEAT_FIXTURES];

/**
 * Fixture corpus for Scene Contract validation.
 *
 * BAD        - contracts that claim a change without producing one.
 * LEGITIMATE - real contracts, deliberately including SMALL changes. A quiet
 *              emotional shift, an establishing scene that lands one piece of
 *              information, a wordless beat: none of these need danger,
 *              dialogue or a reversal to be valid, and a validator that
 *              demanded those would push every story toward melodrama.
 */

export interface ContractFixture {
  name: string;
  expectation: "flag" | "clean";
  why: string;
  /** Codes the fixture is specifically meant to trigger. */
  expectCodes?: string[];
  scenes: any[];
  characters?: any[];
}

const CAST = [{ name: "Golu" }, { name: "Mooli" }, { name: "Gajar" }];

function scene(
  sceneNumber: number,
  contract: any,
  extra: Record<string, unknown> = {}
): any {
  return {
    sceneNumber,
    storyFunction: "gloss retained alongside the contract",
    characterActions: (extra.characterActions as string) ?? "Golu stands by the gate holding the rope",
    charactersPresent: ["Golu", "Mooli"],
    continuityState: { placeId: "place_gate" },
    ...extra,
    contract,
  };
}

// ===========================================================================
// BAD
// ===========================================================================

const identicalBeforeAfter: ContractFixture = {
  name: "identical-before-after",
  expectation: "flag",
  expectCodes: ["identical-before-after"],
  why: "The value is in the same state at both ends — activity with no event.",
  characters: CAST,
  scenes: [
    scene(1, {
      goal: "Golu wants to get the gate open before dark",
      obstacle: "The chain is locked and he has no key",
      outcome: "denied",
      performanceType: "action",
      progression: { kind: "obstacle", value: "access to the field", before: "blocked", after: "blocked" },
    }),
  ],
};

const paraphrasedNoChange: ContractFixture = {
  name: "paraphrased-before-after",
  expectation: "flag",
  expectCodes: ["near-identical-before-after"],
  why: "Two wordings of one state — the classic way an exact-match check is dodged.",
  characters: CAST,
  scenes: [
    scene(1, {
      goal: "Golu wants Mooli to trust him with the errand",
      obstacle: "She remembers the last time he forgot",
      outcome: "partial",
      performanceType: "dialogue-scene",
      progression: {
        kind: "relationship",
        value: "trust",
        before: "Mooli is guarded and holding back",
        after: "Mooli is holding back and guarded",
      },
    }),
  ],
};

const activityAsProgression: ContractFixture = {
  name: "activity-as-progression",
  expectation: "flag",
  expectCodes: ["activity-as-progression"],
  why: "Two actions listed where a value at two states belongs — the user's own example shape.",
  characters: CAST,
  scenes: [
    scene(1, {
      goal: "Golu wants to speak to Mooli",
      obstacle: "She is busy with the crates",
      outcome: "achieved",
      performanceType: "dialogue-scene",
      progression: {
        kind: "information",
        value: "the errand",
        before: "Golu enters the room",
        after: "Golu talks to Mooli",
      },
    }),
  ],
};

const progressionMirrorsAction: ContractFixture = {
  name: "progression-mirrors-action",
  expectation: "flag",
  expectCodes: ["progression-restates-action"],
  why: "The claimed change is the scene's own action line restated.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Golu wants to move the crates before the rain",
        obstacle: "There are more crates than time",
        outcome: "partial",
        performanceType: "action",
        progression: {
          kind: "progress",
          value: "the crates",
          before: "Golu lifts the heavy crate onto the cart by the gate",
          after: "Golu lifts another heavy crate onto the cart by the gate",
        },
      },
      { characterActions: "Golu lifts the heavy crate onto the cart by the gate" }
    ),
  ],
};

const emptyGoal: ContractFixture = {
  name: "empty-goal",
  expectation: "flag",
  expectCodes: ["missing-goal", "generic-progression"],
  why: "No scene goal and a non-answer for the value states.",
  characters: CAST,
  scenes: [
    scene(1, {
      goal: "",
      obstacle: "",
      outcome: "achieved",
      performanceType: "establishing",
      progression: { kind: "information", value: "mood", before: "normal", after: "same" },
    }),
  ],
};

const invalidOutcome: ContractFixture = {
  name: "invalid-outcome",
  expectation: "flag",
  expectCodes: ["invalid-outcome", "invalid-kind"],
  why: "Outcome and kind outside the allowed vocabularies.",
  characters: CAST,
  scenes: [
    scene(1, {
      goal: "Mooli wants the list back",
      obstacle: "Gajar has already folded it away",
      outcome: "sort-of",
      performanceType: "dialogue-scene",
      progression: { kind: "vibes", value: "the list", before: "with Gajar", after: "back with Mooli" },
    }),
  ],
};

const forwardCallback: ContractFixture = {
  name: "callback-to-future-scene",
  expectation: "flag",
  expectCodes: ["repetition-intent-forward-reference"],
  why: "A callback can only echo something the audience has already seen.",
  characters: CAST,
  scenes: [
    scene(2, {
      goal: "Golu tries the crate stack again",
      obstacle: "The stack is taller this time",
      outcome: "achieved",
      performanceType: "comedy-beat",
      progression: { kind: "payoff", value: "Golu's competence", before: "doubted", after: "quietly proven" },
      repetitionIntent: { kind: "callback", echoesScene: 7, variation: "This time he manages it and nobody is watching" },
    }),
  ],
};

const unknownSceneCallback: ContractFixture = {
  name: "callback-to-nonexistent-scene",
  expectation: "flag",
  expectCodes: ["repetition-intent-unknown-scene"],
  why: "The echoed scene is not in the story at all.",
  characters: CAST,
  scenes: [
    scene(1, {
      goal: "Set the crates down",
      obstacle: "Nobody helps",
      outcome: "achieved",
      performanceType: "action",
      progression: { kind: "progress", value: "the load", before: "carried", after: "set down" },
    }),
    scene(5, {
      goal: "Golu tries the crate stack again",
      obstacle: "The stack is taller",
      outcome: "achieved",
      performanceType: "comedy-beat",
      progression: { kind: "payoff", value: "Golu's competence", before: "doubted", after: "quietly proven" },
      repetitionIntent: { kind: "callback", echoesScene: 3, variation: "This time it works and nobody sees it" },
    }),
  ],
};

const unvariedIntent: ContractFixture = {
  name: "repetition-intent-without-variation",
  expectation: "flag",
  expectCodes: ["repetition-intent-no-variation"],
  why: "A declared echo that cannot say what differs is not a callback.",
  characters: CAST,
  scenes: [
    scene(1, {
      goal: "Raise the shutter",
      obstacle: "It sticks",
      outcome: "achieved",
      performanceType: "establishing",
      progression: { kind: "information", value: "the shop day", before: "not begun", after: "open" },
    }),
    scene(4, {
      goal: "Raise the shutter",
      obstacle: "It sticks",
      outcome: "achieved",
      performanceType: "establishing",
      progression: { kind: "information", value: "the shop day", before: "not begun", after: "open" },
      repetitionIntent: { kind: "ritual", echoesScene: 1, variation: "same" },
    }),
  ],
};

const duplicateContracts: ContractFixture = {
  name: "duplicate-contracts-across-scenes",
  expectation: "flag",
  expectCodes: ["duplicate-contract"],
  why: "The same claim copied across several scenes — one change, three slots.",
  characters: CAST,
  scenes: [
    scene(1, {
      goal: "Golu wants to reach the far gate",
      obstacle: "The slope is long",
      outcome: "partial",
      performanceType: "action",
      progression: { kind: "progress", value: "distance to the gate", before: "far off", after: "slightly closer" },
    }),
    scene(2, {
      goal: "Golu wants to reach the far gate",
      obstacle: "The slope is long",
      outcome: "partial",
      performanceType: "action",
      progression: { kind: "progress", value: "distance to the gate", before: "far off", after: "slightly closer" },
    }),
    scene(3, {
      goal: "Golu wants to reach the far gate",
      obstacle: "The slope is long",
      outcome: "partial",
      performanceType: "action",
      progression: { kind: "progress", value: "distance to the gate", before: "far off", after: "slightly closer" },
    }),
  ],
};

// ===========================================================================
// LEGITIMATE — including deliberately SMALL changes
// ===========================================================================

const quietEmotionalShift: ContractFixture = {
  name: "quiet-emotional-shift",
  expectation: "clean",
  why: "A small, genuine emotional turn with no danger and almost no dialogue.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Mooli wants to get through the evening without being asked about it",
        obstacle: "Gajar keeps leaving space for her to speak",
        outcome: "deferred",
        performanceType: "silent-emotional",
        progression: {
          kind: "emotional",
          value: "Mooli's willingness to be seen",
          before: "closed off, answering in single words",
          after: "still quiet, but she stays in the room",
        },
      },
      { characterActions: "Mooli dries the same plate twice while Gajar waits", dialogueTurns: [] }
    ),
  ],
};

const relationshipImprovement: ContractFixture = {
  name: "relationship-improvement",
  expectation: "clean",
  why: "Trust moves a small, specific distance.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Golu wants Mooli to let him carry the tin",
        obstacle: "She has not let anyone carry it since the spill",
        outcome: "partial",
        performanceType: "dialogue-scene",
        progression: {
          kind: "relationship",
          value: "trust between Mooli and Golu",
          before: "guarded, everything done herself",
          after: "slightly restored, she lets him take one handle",
        },
      },
      { characterActions: "Mooli shifts her grip and Golu takes the far handle" }
    ),
  ],
};

const discovery: ContractFixture = {
  name: "discovery",
  expectation: "clean",
  why: "Information genuinely changes.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Gajar wants to know who moved the ledger",
        obstacle: "Everyone was out at the time",
        outcome: "reversed",
        performanceType: "reaction",
        progression: {
          kind: "discovery",
          value: "who was in the shop",
          before: "assumed nobody was there after dark",
          after: "the wet footprints say otherwise",
        },
      },
      { characterActions: "Gajar crouches and touches the dark patch on the floor" }
    ),
  ],
};

const setback: ContractFixture = {
  name: "setback",
  expectation: "clean",
  why: "The story moves backward, which is still movement.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Golu wants to pay the fee before the office closes",
        obstacle: "The tin is lighter than he remembered",
        outcome: "denied",
        performanceType: "reaction",
        progression: {
          kind: "setback",
          value: "the fee",
          before: "believed to be nearly covered",
          after: "short by more than a week's work",
        },
      },
      { characterActions: "Golu counts the coins twice and stops" }
    ),
  ],
};

const decision: ContractFixture = {
  name: "decision",
  expectation: "clean",
  why: "A choice with a cost.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Gajar wants to keep the scale and pay the fee both",
        obstacle: "There is only enough for one",
        outcome: "achieved",
        performanceType: "dialogue-scene",
        progression: {
          kind: "decision",
          value: "what the family will give up",
          before: "undecided, hoping something else turns up",
          after: "the weighing scale goes",
        },
      },
      { characterActions: "Gajar lifts the scale down from its shelf" }
    ),
  ],
};

const consequence: ContractFixture = {
  name: "consequence",
  expectation: "clean",
  why: "An earlier choice lands.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Gajar wants to weigh the order the way he always has",
        obstacle: "The scale is gone and his hands are not accurate",
        outcome: "denied",
        performanceType: "action",
        progression: {
          kind: "consequence",
          value: "Gajar's standing with his customers",
          before: "unquestioned for twenty years",
          after: "a customer checks his weighing for the first time",
        },
      },
      { characterActions: "Gajar balances the bundle on his palm and hesitates" }
    ),
  ],
};

const establishingSmallInfo: ContractFixture = {
  name: "establishing-with-small-information",
  expectation: "clean",
  why: "An establishing shot landing ONE small thing. Small must be enough.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Show what a normal morning looks like here",
        obstacle: "Nothing yet — the pressure has not arrived",
        outcome: "achieved",
        performanceType: "establishing",
        progression: {
          kind: "information",
          value: "what the audience knows about this household",
          before: "nothing established",
          after: "the shutter, the scale and who opens up are known",
        },
      },
      { characterActions: "The shutter rolls up on an empty lane", dialogueTurns: [] }
    ),
  ],
};

const comedyCallbackVaried: ContractFixture = {
  name: "comedy-callback-with-variation",
  expectation: "clean",
  why: "A valid callback: backward reference, real variation, genuine change.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Golu wants to carry every crate in one trip",
        obstacle: "There are six of them",
        outcome: "denied",
        performanceType: "comedy-beat",
        progression: { kind: "setup", value: "Golu's competence", before: "untested", after: "publicly doubted" },
      },
      { characterActions: "Golu stacks six crates and drops all of them" }
    ),
    scene(
      6,
      {
        goal: "Golu wants to carry every crate in one trip",
        obstacle: "There are still six of them",
        outcome: "achieved",
        performanceType: "comedy-beat",
        progression: { kind: "payoff", value: "Golu's competence", before: "publicly doubted", after: "quietly proven" },
        repetitionIntent: {
          kind: "callback",
          echoesScene: 1,
          variation: "Identical attempt, opposite outcome, and this time nobody is watching him do it",
        },
      },
      { characterActions: "Golu stacks six crates and walks them across the yard" }
    ),
  ],
};

const montageVaried: ContractFixture = {
  name: "montage-with-variation",
  expectation: "clean",
  why: "Montage elements that each carry a different meaning.",
  characters: CAST,
  scenes: [
    scene(
      1,
      {
        goal: "Get the first seedlings in",
        obstacle: "The soil is still cold",
        outcome: "achieved",
        performanceType: "montage-element",
        progression: { kind: "progress", value: "the season's work", before: "not begun", after: "planted and hopeful" },
      },
      { characterActions: "Gajar presses seedlings into wet soil", dialogueTurns: [] }
    ),
    scene(
      3,
      {
        goal: "Keep the rows clear through the heat",
        obstacle: "The heat is worse than last year",
        outcome: "partial",
        performanceType: "montage-element",
        progression: { kind: "escalation", value: "the season's work", before: "planted and hopeful", after: "costing more than it should" },
        repetitionIntent: {
          kind: "montage-element",
          echoesScene: 1,
          variation: "The same rows months on, tall and punishing instead of bare and hopeful",
        },
      },
      { characterActions: "Gajar pulls weeds between tall rows under a white sky", dialogueTurns: [] }
    ),
  ],
};

const lifeJourneyRitual: ContractFixture = {
  name: "life-journey-ritual-with-phase-variation",
  expectation: "clean",
  why: "A ritual returning across phases, visibly changed.",
  characters: [{ name: "Karela" }, { name: "Bhindi" }],
  scenes: [
    scene(
      1,
      {
        goal: "Open the shop the way they always do",
        obstacle: "Nothing — this is the ordinary morning",
        outcome: "achieved",
        performanceType: "establishing",
        progression: { kind: "information", value: "how these two work together", before: "unknown", after: "in step, counting out loud" },
      },
      { characterActions: "Karela and Bhindi raise the shutter together", charactersPresent: ["Karela", "Bhindi"] }
    ),
    scene(
      9,
      {
        goal: "Open the shop",
        obstacle: "He is doing it alone now",
        outcome: "achieved",
        performanceType: "silent-emotional",
        progression: { kind: "consequence", value: "how these two work together", before: "in step, counting out loud", after: "one of them, silently" },
        repetitionIntent: {
          kind: "ritual",
          echoesScene: 1,
          variation: "The same shutter a year on, raised alone and without the counting",
        },
      },
      { characterActions: "Karela raises the shutter by himself, slower than before", charactersPresent: ["Karela"], dialogueTurns: [] }
    ),
  ],
};

export const BAD_CONTRACT_FIXTURES: ContractFixture[] = [
  identicalBeforeAfter,
  paraphrasedNoChange,
  activityAsProgression,
  progressionMirrorsAction,
  emptyGoal,
  invalidOutcome,
  forwardCallback,
  unknownSceneCallback,
  unvariedIntent,
  duplicateContracts,
];

export const LEGITIMATE_CONTRACT_FIXTURES: ContractFixture[] = [
  quietEmotionalShift,
  relationshipImprovement,
  discovery,
  setback,
  decision,
  consequence,
  establishingSmallInfo,
  comedyCallbackVaried,
  montageVaried,
  lifeJourneyRitual,
];

export const ALL_CONTRACT_FIXTURES: ContractFixture[] = [
  ...BAD_CONTRACT_FIXTURES,
  ...LEGITIMATE_CONTRACT_FIXTURES,
];

/** Scenes with no contract at all — the backward-compatibility case. */
export const CONTRACTLESS_SCENES: any[] = [
  { sceneNumber: 1, storyFunction: "Golu sets out", characterActions: "Golu walks to the gate", charactersPresent: ["Golu"], continuityState: { placeId: "place_gate" } },
  { sceneNumber: 2, storyFunction: "Mooli follows", characterActions: "Mooli catches up at the turn", charactersPresent: ["Mooli"], continuityState: { placeId: "place_lane" } },
];

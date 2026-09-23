/**
 * Fixture corpus for the Scene Distinctiveness Engine.
 *
 * Two populations, and the threshold has to separate them:
 *
 *   BAD      - stretched films that MUST be flagged. Deliberately written with
 *              real paraphrase variation, because a detector that only catches
 *              copy-paste is worthless: the failure in production is the same
 *              scene said a different way.
 *
 *   NEGATIVE - legitimate craft that must NOT be flagged. Montage, callbacks,
 *              rituals, silence, one-room stories, quiet family stories and a
 *              mystery revisiting a location. These matter more than the bad
 *              fixtures: a detector that punishes good work will be turned off.
 *
 * The bad fixtures deliberately span different verbs and shapes (jogging,
 * walking, talking, celebrating, searching, reacting) so the engine cannot be
 * tuned to one failure and call it solved.
 */

export interface FixtureScene {
  sceneNumber: number;
  purpose: string;
  storyFunction: string;
  characterActions: string;
  dialogueTurns: Array<{ speaker: string; line: string }>;
  charactersPresent: string[];
  facialExpressions: string;
  cameraShot: string;
  cameraMovement: string;
  finalVideoPrompt: string;
  continuityState: {
    placeId: string;
    location: string;
    characterEmotions: Record<string, string>;
    cameraState: { shotSize: string; movement: string; screenDirection: string };
  };
  contract?: { repetitionIntent?: { kind: string; echoesScene: number; variation: string } };
}

export interface Fixture {
  name: string;
  expectation: "flag" | "clean";
  why: string;
  scenes: FixtureScene[];
  characters?: any[];
  setups?: any[];
  lifeJourney?: any;
}

interface SceneSpec {
  purpose: string;
  fn: string;
  action: string;
  lines: Array<[string, string]>;
  cast?: string[];
  emotion?: string;
  shot?: string;
  move?: string;
  place?: string;
  location?: string;
  prompt?: string;
  intent?: { kind: string; echoesScene: number; variation: string };
}

function scene(n: number, s: SceneSpec): FixtureScene {
  const cast = s.cast ?? ["Golu", "Tinku"];
  const emotion = s.emotion ?? "determined";
  const emotions: Record<string, string> = {};
  cast.forEach((c) => (emotions[c] = emotion));

  return {
    sceneNumber: n,
    purpose: s.purpose,
    storyFunction: s.fn,
    characterActions: s.action,
    dialogueTurns: s.lines.map(([speaker, line]) => ({ speaker, line })),
    charactersPresent: cast,
    facialExpressions: emotion,
    cameraShot: s.shot ?? "medium",
    cameraMovement: s.move ?? "slow push in",
    finalVideoPrompt:
      s.prompt ??
      `${s.action} ${cast.join(" and ")} at ${s.location ?? "the path"}, ${emotion}, ${s.shot ?? "medium"} shot.`,
    continuityState: {
      placeId: s.place ?? "place_path",
      location: s.location ?? "the path",
      characterEmotions: emotions,
      cameraState: {
        shotSize: s.shot ?? "medium",
        movement: s.move ?? "slow push in",
        screenDirection: "left-to-right",
      },
    },
    contract: s.intent ? { repetitionIntent: s.intent } : undefined,
  };
}

// ===========================================================================
// BAD — must be flagged
// ===========================================================================

const repeatedJogging: Fixture = {
  name: "repeated-jogging",
  expectation: "flag",
  why: "Eight scenes of the same goal, the same physical action and the same emotional state, reworded each time.",
  scenes: [
    scene(1, { purpose: "Golu sets out to reach the far gate", fn: "Golu begins jogging toward the far gate, determined to arrive before sundown", action: "Golu jogs along the dusty path, arms pumping steadily", lines: [["Golu", "Hum pahunch jayenge."], ["Tinku", "Haan, zaroor pahunchenge."]] }),
    scene(2, { purpose: "Golu keeps jogging toward the gate", fn: "Golu continues jogging onward toward the far gate, still determined to get there", action: "Golu keeps jogging up the dusty path, arms swinging steadily", lines: [["Golu", "Bas thoda aur."], ["Tinku", "Haan, thoda aur bacha hai."]] }),
    scene(3, { purpose: "Golu jogs further along the path", fn: "Golu jogs further toward the distant gate, determination unchanged", action: "Golu jogs steadily along the path, arms moving in rhythm", lines: [["Golu", "Hum kar sakte hain."], ["Tinku", "Hum zaroor kar sakte hain."]] }),
    scene(4, { purpose: "Golu presses on toward the gate", fn: "Golu presses on jogging toward the far gate, still set on arriving", action: "Golu presses on jogging up the dusty track, arms pumping", lines: [["Golu", "Rukna nahi hai."], ["Tinku", "Bilkul, rukenge nahi."]] }),
    scene(5, { purpose: "Golu continues his run to the gate", fn: "Golu carries on jogging toward the gate, his determination holding", action: "Golu carries on jogging along the track, arms steady", lines: [["Golu", "Hum pahunchenge."], ["Tinku", "Haan hum pahunchenge."]] }),
    scene(6, { purpose: "Golu jogs on toward the far gate", fn: "Golu jogs onward to the far gate, determined as before", action: "Golu jogs onward on the dusty path, arms pumping evenly", lines: [["Golu", "Thoda aur chalte hain."], ["Tinku", "Chalo, thoda aur."]] }),
    scene(7, { purpose: "Golu keeps running toward the gate", fn: "Golu keeps jogging for the gate, still determined to reach it", action: "Golu keeps jogging along the path, arms swinging", lines: [["Golu", "Bas pahunchne wale hain."], ["Tinku", "Haan bas pahunchne wale."]] }),
    scene(8, { purpose: "Golu jogs the last stretch", fn: "Golu jogs the last stretch toward the far gate, determination intact", action: "Golu jogs the final stretch of dusty path, arms pumping", lines: [["Golu", "Hum kar sakte hain na?"], ["Tinku", "Haan, kar sakte hain."]] }),
  ],
};

const repeatedWalking: Fixture = {
  name: "repeated-walking",
  expectation: "flag",
  why: "Same stall as repeated-jogging with a different verb — proves the engine is not tuned to one action word.",
  scenes: [
    scene(1, { purpose: "Bhindi walks to the market", fn: "Bhindi sets off walking to the market, hoping to sell her basket", action: "Bhindi walks slowly down the lane carrying her basket", lines: [["Bhindi", "Bazaar door nahi hai."], ["Mooli", "Nahi, zyada door nahi."]], cast: ["Bhindi", "Mooli"], place: "place_lane", location: "the lane" }),
    scene(2, { purpose: "Bhindi keeps walking to the market", fn: "Bhindi continues walking to the market, still hoping to sell the basket", action: "Bhindi continues walking down the lane with her basket", lines: [["Bhindi", "Bas pahunchne wale hain."], ["Mooli", "Haan, qareeb hai."]], cast: ["Bhindi", "Mooli"], place: "place_lane", location: "the lane" }),
    scene(3, { purpose: "Bhindi walks further toward the market", fn: "Bhindi walks further toward the market, her hope of selling unchanged", action: "Bhindi walks further along the lane holding her basket", lines: [["Bhindi", "Thoda aur chalna hai."], ["Mooli", "Chalte raho."]], cast: ["Bhindi", "Mooli"], place: "place_lane", location: "the lane" }),
    scene(4, { purpose: "Bhindi carries on to the market", fn: "Bhindi carries on walking to the market, still meaning to sell", action: "Bhindi carries on walking the lane, basket on her arm", lines: [["Bhindi", "Aa gaya kya?"], ["Mooli", "Bas thoda aur."]], cast: ["Bhindi", "Mooli"], place: "place_lane", location: "the lane" }),
    scene(5, { purpose: "Bhindi walks the last of the lane", fn: "Bhindi walks the last of the lane toward the market, hope unchanged", action: "Bhindi walks the last of the lane with her basket", lines: [["Bhindi", "Ab qareeb hai."], ["Mooli", "Haan, qareeb."]], cast: ["Bhindi", "Mooli"], place: "place_lane", location: "the lane" }),
  ],
};

const repeatedTableTalk: Fixture = {
  name: "repeated-table-talk",
  expectation: "flag",
  why: "Static dialogue scenes: same place, same emotional state, same subject, nothing turning.",
  scenes: [
    scene(1, { purpose: "The family discusses the missing key", fn: "The family talks about the missing key without resolving anything", action: "Aloo and Gajar sit at the table talking about the key", lines: [["Aloo", "Chaabi kahan gayi?"], ["Gajar", "Pata nahi kahan gayi."]], cast: ["Aloo", "Gajar"], place: "place_kitchen", location: "the kitchen", emotion: "worried", shot: "medium", move: "static" }),
    scene(2, { purpose: "The family keeps discussing the key", fn: "The family continues talking about the missing key, still unresolved", action: "Aloo and Gajar remain at the table discussing the key", lines: [["Aloo", "Chaabi mili nahi."], ["Gajar", "Nahi, abhi tak nahi mili."]], cast: ["Aloo", "Gajar"], place: "place_kitchen", location: "the kitchen", emotion: "worried", shot: "medium", move: "static" }),
    scene(3, { purpose: "The family talks about the key again", fn: "The family talks again about the missing key with nothing decided", action: "Aloo and Gajar sit at the table still talking about the key", lines: [["Aloo", "Kahan rakhi thi chaabi?"], ["Gajar", "Yaad nahi kahan rakhi."]], cast: ["Aloo", "Gajar"], place: "place_kitchen", location: "the kitchen", emotion: "worried", shot: "medium", move: "static" }),
    scene(4, { purpose: "The key conversation continues", fn: "The conversation about the missing key continues without progress", action: "Aloo and Gajar keep sitting at the table talking about the key", lines: [["Aloo", "Chaabi ke bina kya karenge?"], ["Gajar", "Pata nahi kya karenge."]], cast: ["Aloo", "Gajar"], place: "place_kitchen", location: "the kitchen", emotion: "worried", shot: "medium", move: "static" }),
  ],
};

const repeatedCelebration: Fixture = {
  name: "repeated-celebration",
  expectation: "flag",
  why: "A stretched resolution — six scenes of arrival and cheering after the story is already over.",
  scenes: [
    scene(1, { purpose: "Everyone celebrates the harvest", fn: "The villagers celebrate the saved harvest together, joyful", action: "The villagers cheer and raise their arms around the cart", lines: [["Golu", "Hum ne kar dikhaya!"], ["Tinku", "Haan, kar dikhaya!"]], place: "place_square", location: "the square", emotion: "joyful", shot: "wide" }),
    scene(2, { purpose: "The celebration continues", fn: "The villagers keep celebrating the saved harvest, still joyful", action: "The villagers keep cheering and lifting their arms near the cart", lines: [["Golu", "Kitna acha lag raha hai!"], ["Tinku", "Bahut acha lag raha hai!"]], place: "place_square", location: "the square", emotion: "joyful", shot: "wide" }),
    scene(3, { purpose: "More celebrating in the square", fn: "The villagers go on celebrating the harvest, joy unchanged", action: "The villagers go on cheering with arms raised by the cart", lines: [["Golu", "Sab mil kar kiya!"], ["Tinku", "Sab ne mil kar kiya!"]], place: "place_square", location: "the square", emotion: "joyful", shot: "wide" }),
    scene(4, { purpose: "The square is still celebrating", fn: "The square continues to celebrate the saved harvest, joyful still", action: "The villagers continue cheering and waving around the cart", lines: [["Golu", "Aaj ka din yaad rahega!"], ["Tinku", "Haan, yaad rahega!"]], place: "place_square", location: "the square", emotion: "joyful", shot: "wide" }),
    scene(5, { purpose: "Celebration carries on", fn: "The celebration of the harvest carries on, everyone joyful", action: "The villagers carry on cheering with raised arms at the cart", lines: [["Golu", "Hum jeet gaye!"], ["Tinku", "Haan hum jeet gaye!"]], place: "place_square", location: "the square", emotion: "joyful", shot: "wide" }),
  ],
};

const repeatedSearching: Fixture = {
  name: "repeated-searching",
  expectation: "flag",
  why: "Same goal, same obstacle, no escalation — searching that never narrows.",
  scenes: [
    scene(1, { purpose: "They search the shed for the lamp", fn: "They search the shed for the missing lamp and do not find it", action: "Kheera lifts sacks and looks behind the crates", lines: [["Kheera", "Yahan nahi hai."], ["Dhania", "Aage dekhte hain."]], cast: ["Kheera", "Dhania"], place: "place_shed", location: "the shed", emotion: "searching" }),
    scene(2, { purpose: "They keep searching the shed", fn: "They keep searching the shed for the lamp without finding it", action: "Kheera moves sacks aside and checks behind the crates again", lines: [["Kheera", "Yahan bhi nahi."], ["Dhania", "Aur dekhte hain."]], cast: ["Kheera", "Dhania"], place: "place_shed", location: "the shed", emotion: "searching" }),
    scene(3, { purpose: "The search of the shed goes on", fn: "The search for the lamp in the shed goes on with no result", action: "Kheera shifts more sacks and searches behind the stacked crates", lines: [["Kheera", "Kuch nahi mila."], ["Dhania", "Phir dekhte hain."]], cast: ["Kheera", "Dhania"], place: "place_shed", location: "the shed", emotion: "searching" }),
    scene(4, { purpose: "Still searching the shed", fn: "They are still searching the shed for the lamp and still not finding it", action: "Kheera pulls sacks away and looks behind the crates once more", lines: [["Kheera", "Yahan bhi kuch nahi."], ["Dhania", "Chalo aage dekhte hain."]], cast: ["Kheera", "Dhania"], place: "place_shed", location: "the shed", emotion: "searching" }),
  ],
};

const repeatedReactionShots: Fixture = {
  name: "repeated-reaction-shots",
  expectation: "flag",
  why: "Identical framing and emotional state with almost no content — reaction shots used as padding.",
  scenes: [
    scene(1, { purpose: "Mooli reacts to the news", fn: "Mooli takes in the news with visible shock", action: "Mooli's eyes widen as she hears the news", lines: [["Mooli", "Kya?"]], cast: ["Mooli"], place: "place_yard", location: "the yard", emotion: "shocked", shot: "close", move: "static" }),
    scene(2, { purpose: "Mooli reacts again", fn: "Mooli takes in the news again, still visibly shocked", action: "Mooli's eyes widen further as the news settles", lines: [["Mooli", "Kya kaha?"]], cast: ["Mooli"], place: "place_yard", location: "the yard", emotion: "shocked", shot: "close", move: "static" }),
    scene(3, { purpose: "Mooli still reacting", fn: "Mooli is still absorbing the news, shock unchanged", action: "Mooli's eyes stay wide as she absorbs the news", lines: [["Mooli", "Sach mein?"]], cast: ["Mooli"], place: "place_yard", location: "the yard", emotion: "shocked", shot: "close", move: "static" }),
    scene(4, { purpose: "Mooli reacts once more", fn: "Mooli reacts to the news once more, still shocked", action: "Mooli's widened eyes hold as she takes in the news", lines: [["Mooli", "Yeh kaise?"]], cast: ["Mooli"], place: "place_yard", location: "the yard", emotion: "shocked", shot: "close", move: "static" }),
  ],
};

const genericMotivational: Fixture = {
  name: "generic-motivational",
  expectation: "flag",
  why: "Interchangeable encouragement — lines that would fit any story with the same theme.",
  scenes: [
    scene(1, { purpose: "They encourage each other before the climb", fn: "They encourage each other to keep going and believe in themselves", action: "Golu and Tinku stand at the foot of the slope looking up", lines: [["Golu", "Hum kar sakte hain, himmat mat haro."], ["Tinku", "Haan, hum zaroor kar sakte hain."]], place: "place_slope", location: "the slope", emotion: "hopeful" }),
    scene(2, { purpose: "They encourage each other again", fn: "They encourage each other again to keep trying and not give up", action: "Golu and Tinku pause on the slope and look at each other", lines: [["Golu", "Himmat mat haro, hum kar lenge."], ["Tinku", "Hum zaroor kar lenge, bas koshish karo."]], place: "place_slope", location: "the slope", emotion: "hopeful" }),
    scene(3, { purpose: "More encouragement on the slope", fn: "They go on encouraging each other to believe and keep going", action: "Golu and Tinku stop again on the slope facing each other", lines: [["Golu", "Koshish karte raho, sab ho jayega."], ["Tinku", "Haan, sab ho jayega."]], place: "place_slope", location: "the slope", emotion: "hopeful" }),
    scene(4, { purpose: "Encouragement continues", fn: "They keep encouraging one another to have courage and continue", action: "Golu and Tinku stand together on the slope once more", lines: [["Golu", "Himmat rakho, hum jeetenge."], ["Tinku", "Hum zaroor jeetenge."]], place: "place_slope", location: "the slope", emotion: "hopeful" }),
  ],
};

// ===========================================================================
// NEGATIVE — must stay clean
// ===========================================================================

const legitimateMontage: Fixture = {
  name: "legitimate-montage",
  expectation: "clean",
  why: "A declared montage: the same ritual across a season, each element doing something different.",
  scenes: [
    scene(1, { purpose: "Spring: the first seedlings go in", fn: "The first seedlings are planted and the season's work begins", action: "Gajar presses seedlings into wet spring soil", lines: [["Gajar", "Pehli qatar lag gayi."]], cast: ["Gajar"], place: "place_field", location: "the field", emotion: "hopeful", shot: "wide" }),
    scene(2, { purpose: "Summer: the rows are weeded in hard heat", fn: "The rows are weeded under punishing heat and the work starts to cost", action: "Gajar pulls weeds between tall rows under a white summer sky", lines: [["Gajar", "Garmi zyada hai."]], cast: ["Gajar"], place: "place_field", location: "the field", emotion: "tired", shot: "medium", intent: { kind: "montage-element", echoesScene: 1, variation: "Same field, months later; hope has become labour and the plants are tall" } }),
    scene(3, { purpose: "Autumn: the harvest comes in short", fn: "The harvest is gathered and turns out smaller than the work deserved", action: "Gajar lifts a half-filled basket from the brown autumn rows", lines: [["Gajar", "Itna hi hua."]], cast: ["Gajar"], place: "place_field", location: "the field", emotion: "resigned", shot: "close", intent: { kind: "montage-element", echoesScene: 2, variation: "The same rows bare and brown; the basket is half full and the season is spent" } }),
  ],
};

const legitimateCallback: Fixture = {
  name: "legitimate-callback",
  expectation: "clean",
  why: "A comedy callback: the same gag returning with a reversed outcome.",
  scenes: [
    scene(1, { purpose: "Tinku tries to carry too many crates", fn: "Tinku overloads himself with crates and drops every one of them", action: "Tinku stacks six crates in his arms and immediately drops them", lines: [["Tinku", "Main sab utha sakta hoon!"], ["Golu", "Nahi utha sakte."]], place: "place_yard", location: "the yard", emotion: "eager", shot: "wide" }),
    scene(2, { purpose: "Golu finds the missing ledger", fn: "Golu finds the ledger under the fallen crates, changing what they know", action: "Golu lifts a fallen crate and finds a cloth-bound ledger beneath it", lines: [["Golu", "Yeh yahan kaise aaya?"], ["Tinku", "Maine nahi rakha."]], place: "place_yard", location: "the yard", emotion: "surprised", shot: "close" }),
    scene(3, { purpose: "Tinku tries the crates again and succeeds", fn: "Tinku carries the crates successfully this time, and nobody notices", action: "Tinku stacks six crates in his arms and walks them across the yard", lines: [["Tinku", "Dekho! Dekh rahe ho?"], ["Golu", "Nahi dekh raha."]], place: "place_yard", location: "the yard", emotion: "triumphant", shot: "wide", intent: { kind: "callback", echoesScene: 1, variation: "Identical attempt, opposite outcome, and this time nobody is watching" } }),
  ],
};

const legitimateRitual: Fixture = {
  name: "legitimate-ritual",
  expectation: "clean",
  why: "A Life Journey routine recurring across phases with declared variation.",
  scenes: [
    scene(1, { purpose: "The shutters go up together", fn: "The siblings raise the shop shutters together for the first time", action: "Karela and Bhindi raise the metal shutter together", lines: [["Karela", "Ek, do, teen."], ["Bhindi", "Uth gaya."]], cast: ["Karela", "Bhindi"], place: "place_shop", location: "the shop", emotion: "hopeful", shot: "wide" }),
    scene(2, { purpose: "A customer changes the day", fn: "A first paying customer arrives and the shop's prospects shift", action: "A customer sets a torn shirt on the counter", lines: [["Karela", "Kal tak ho jayega."]], cast: ["Karela"], place: "place_shop", location: "the shop", emotion: "busy", shot: "medium" }),
    scene(3, { purpose: "Karela raises the shutters alone", fn: "Karela raises the shutter alone now, and the difference is the whole point", action: "Karela raises the metal shutter by himself, slower than before", lines: [["Karela", "Ek, do, teen."]], cast: ["Karela"], place: "place_shop", location: "the shop", emotion: "tired", shot: "wide" }),
  ],
  lifeJourney: {
    routines: [
      {
        id: "routine_shutters",
        activity: "raising the shutters",
        placeId: "place_shop",
        phaseNumbers: [1, 2],
        variationAcrossStory: "First together and counting; later alone and slower; finally not at all",
      },
    ],
  },
};

const legitimateSilence: Fixture = {
  name: "legitimate-silence",
  expectation: "clean",
  why: "Wordless emotional scenes — no dialogue must never read as duplicate dialogue.",
  scenes: [
    scene(1, { purpose: "Aloo sees the empty chair", fn: "Aloo registers that the chair is empty and understands what it means", action: "Aloo stops in the doorway and looks at an empty chair", lines: [], cast: ["Aloo"], place: "place_room", location: "the room", emotion: "still", shot: "wide" }),
    scene(2, { purpose: "Aloo picks up the folded shawl", fn: "Aloo lifts the shawl and decides to keep it rather than pack it away", action: "Aloo lifts a folded shawl from the chair and holds it", lines: [], cast: ["Aloo"], place: "place_room", location: "the room", emotion: "grieving", shot: "close" }),
    scene(3, { purpose: "Aloo opens the shutters", fn: "Aloo opens the shutters and lets the room be used again", action: "Aloo pushes the wooden shutters open and light crosses the floor", lines: [], cast: ["Aloo"], place: "place_room", location: "the room", emotion: "steady", shot: "medium" }),
  ],
};

const singleLocationStory: Fixture = {
  name: "single-location-story",
  expectation: "clean",
  why: "One room for the whole film — a legitimate form. Place concentration alone must not flag.",
  scenes: [
    scene(1, { purpose: "The power goes out during the meal", fn: "The lights fail mid-meal and the family is left in the dark", action: "The bulb dies and the family freezes over their plates", lines: [["Aloo", "Bijli gayi."], ["Gajar", "Mombatti kahan hai?"]], cast: ["Aloo", "Gajar"], place: "place_room", location: "the room", emotion: "startled", shot: "wide" }),
    scene(2, { purpose: "A secret slips out in the dark", fn: "Gajar admits in the dark that the job is gone, which nobody knew", action: "Gajar speaks toward the dark without looking up", lines: [["Gajar", "Kaam khatam ho gaya."], ["Aloo", "Kab?"]], cast: ["Aloo", "Gajar"], place: "place_room", location: "the room", emotion: "exposed", shot: "close", move: "static" }),
    scene(3, { purpose: "Aloo decides what to do about it", fn: "Aloo decides to take the morning shift himself and says nothing about it", action: "Aloo stands, gathers the plates and sets them by the basin", lines: [["Aloo", "Subah main jaunga."]], cast: ["Aloo", "Gajar"], place: "place_room", location: "the room", emotion: "resolved", shot: "medium", move: "slow pan" }),
    scene(4, { purpose: "The light returns and nothing is mentioned", fn: "The bulb returns and both of them pretend the conversation did not happen", action: "The bulb flickers back and both look at their plates", lines: [["Gajar", "Aa gayi."], ["Aloo", "Haan."]], cast: ["Aloo", "Gajar"], place: "place_room", location: "the room", emotion: "guarded", shot: "wide" }),
  ],
};

const quietFamilyStory: Fixture = {
  name: "quiet-family-story",
  expectation: "clean",
  why: "Small stakes, no villain, no danger — each scene turns something anyway.",
  scenes: [
    scene(1, { purpose: "Mooli is left out of the errand", fn: "Mooli is told she is too small to come, and takes it badly", action: "Mooli watches the others leave through the gate without her", lines: [["Mooli", "Main bhi aa sakti hoon."], ["Gajar", "Agli baar."]], cast: ["Mooli", "Gajar"], place: "place_gate", location: "the gate", emotion: "left out", shot: "medium" }),
    scene(2, { purpose: "Mooli finds something they forgot", fn: "Mooli discovers the list they forgot, which gives her something they need", action: "Mooli picks a folded paper off the step and reads it", lines: [["Mooli", "Yeh toh reh gaya."]], cast: ["Mooli"], place: "place_step", location: "the step", emotion: "curious", shot: "close" }),
    scene(3, { purpose: "Mooli chooses not to run after them", fn: "Mooli decides to wait with the list rather than chase them, which is new for her", action: "Mooli sits on the step, holding the paper, and does not follow", lines: [["Mooli", "Wapas aayenge."]], cast: ["Mooli"], place: "place_step", location: "the step", emotion: "settled", shot: "wide", move: "static" }),
    scene(4, { purpose: "They come back needing her", fn: "They return needing the list, and Mooli hands it over without gloating", action: "Mooli holds out the folded paper as they come back through the gate", lines: [["Gajar", "Woh parchi..."], ["Mooli", "Yeh rahi."]], cast: ["Mooli", "Gajar"], place: "place_gate", location: "the gate", emotion: "even", shot: "medium" }),
  ],
};

const mysteryRevisits: Fixture = {
  name: "mystery-revisits",
  expectation: "clean",
  why: "An investigation returning to one location, learning something different each time.",
  scenes: [
    scene(1, { purpose: "Kheera examines the crate corner", fn: "Kheera finds a chalk mark at the crate corner and does not yet know its meaning", action: "Kheera crouches by the stacked crates and marks the paving with chalk", lines: [["Kheera", "Yeh nishan naya hai."], ["Dhania", "Kal nahi tha?"]], cast: ["Kheera", "Dhania"], place: "place_corner", location: "the crate corner", emotion: "flat", shot: "close" }),
    scene(2, { purpose: "Kheera returns and the mark has moved", fn: "Kheera returns to find the chalk mark moved, which means someone was here since", action: "Kheera stands over the paving where the chalk line has shifted", lines: [["Kheera", "Nishan sarak gaya."], ["Dhania", "Kaun aaya tha?"]], cast: ["Kheera", "Dhania"], place: "place_corner", location: "the crate corner", emotion: "alert", shot: "medium" }),
    scene(3, { purpose: "Kheera reads the corner correctly at last", fn: "Kheera realises the crates were restacked, reversing who he suspects", action: "Kheera pulls the top crate down and finds the stack is hollow", lines: [["Kheera", "Peti khali hai."], ["Dhania", "Toh phir andar kya tha?"]], cast: ["Kheera", "Dhania"], place: "place_corner", location: "the crate corner", emotion: "cold", shot: "wide" }),
  ],
};

export const BAD_FIXTURES: Fixture[] = [
  repeatedJogging,
  repeatedWalking,
  repeatedTableTalk,
  repeatedCelebration,
  repeatedSearching,
  repeatedReactionShots,
  genericMotivational,
];

export const NEGATIVE_FIXTURES: Fixture[] = [
  legitimateMontage,
  legitimateCallback,
  legitimateRitual,
  legitimateSilence,
  singleLocationStory,
  quietFamilyStory,
  mysteryRevisits,
];

export const ALL_FIXTURES: Fixture[] = [...BAD_FIXTURES, ...NEGATIVE_FIXTURES];

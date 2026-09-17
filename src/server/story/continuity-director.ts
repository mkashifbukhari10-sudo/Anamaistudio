import type {
  CameraState,
  CharacterSnapshot,
  ContinuityIssue,
  ContinuityState,
} from "../../types.js";

/**
 * THE CONTINUITY DIRECTOR
 *
 * Turns a sequence of independently generated scenes into one continuous film.
 *
 * The governing idea: a scene's END STATE is a fact. It already happened. The
 * next scene does not get to re-imagine the situation - it inherits it. So the
 * end state is captured as STRUCTURED data rather than prose, because prose
 * cannot be compared: "at frame left holding the bucket, worried" and "near the
 * wall, determined" are indistinguishable to code, and a reset slips through.
 *
 * Three jobs, in order:
 *   1. NORMALISE - fold the model's raw output into a typed ContinuityState.
 *   2. LEDGER    - accumulate world state across every scene so far, so the
 *                  engine knows what exists, where it is and who holds it.
 *   3. RECONCILE - on an unbroken (CHAIN) join, make the opening match the
 *                  previous ending. Then REPORT anything left that a human
 *                  should look at, without regenerating anything.
 *
 * Nothing here knows about any particular story, world, cast or genre. Every
 * check works by comparing one scene's state to the next, whatever they contain.
 */

// ---------------------------------------------------------------------------
// 1. NORMALISATION
// ---------------------------------------------------------------------------

/** Trim, and treat the model's various ways of saying "nothing" as empty. */
function clean(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const lowered = text.toLowerCase();
  if (lowered === "none" || lowered === "nothing" || lowered === "n/a" || lowered === "-") return "";
  return text;
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => clean(entry)).filter(Boolean);
}

function normalizeCamera(raw: any): CameraState | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const shotSize = clean(raw.shotSize);
  const angle = clean(raw.angle);
  const movement = clean(raw.movement);
  const screenDirection = clean(raw.screenDirection);
  if (!shotSize && !angle && !movement && !screenDirection) return undefined;
  return {
    shotSize,
    angle,
    movement,
    stillMovingAtCut: Boolean(raw.stillMovingAtCut),
    screenDirection,
  };
}

/**
 * Fold the model's array-shaped output into the typed ContinuityState.
 *
 * The model emits characters as an ARRAY because a response schema cannot
 * describe a map with arbitrary keys. The flattened Record views are rebuilt
 * here so the rest of the app keeps the shape it already expects, while the
 * per-character snapshots are preserved for comparison.
 */
export function normalizeContinuityState(raw: any): ContinuityState | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const characters: CharacterSnapshot[] = Array.isArray(raw.characters)
    ? raw.characters
        .map((entry: any) => ({
          name: clean(entry?.name),
          position: clean(entry?.position),
          pose: clean(entry?.pose),
          emotion: clean(entry?.emotion),
          holding: clean(entry?.holding),
        }))
        .filter((c: CharacterSnapshot) => Boolean(c.name))
    : [];

  const characterPositions: Record<string, string> = {};
  const characterEmotions: Record<string, string> = {};
  const heldProps: Record<string, string> = {};

  for (const c of characters) {
    if (c.position) characterPositions[c.name] = c.position;
    if (c.emotion) characterEmotions[c.name] = c.emotion;
    if (c.holding) heldProps[c.name] = c.holding;
  }

  return {
    // The one integration point with the World Registry: place IDENTITY, so
    // continuity can compare ids rather than prose. Physical state stays here.
    placeId: clean(raw.placeId) || undefined,
    location: clean(raw.location),
    timeOfDay: clean(raw.timeOfDay),
    weather: clean(raw.weather),
    lighting: clean(raw.lighting),
    characterPositions,
    characterEmotions,
    heldProps,
    placedProps: cleanList(raw.placedProps),
    openClosedObjects: cleanList(raw.openClosedObjects),
    environmentState: clean(raw.environmentState),
    characters,
    cameraState: normalizeCamera(raw.camera ?? raw.cameraState),
  };
}

// ---------------------------------------------------------------------------
// 2. THE LEDGER
//
// Long-term world state. Scene memory answers "what happened"; the ledger
// answers "what is true right now" - where everyone is, what they hold, what
// has been set down, what is open, what time it is. Without it, a prop
// introduced in scene 4 and needed in scene 40 leaves no trace.
// ---------------------------------------------------------------------------

export interface ContinuityLedger {
  lastSceneNumber: number;
  characters: Map<string, CharacterSnapshot>;
  placedProps: Set<string>;
  openClosedObjects: Map<string, string>;
  location: string;
  timeOfDay: string;
  weather: string;
  lighting: string;
  environmentState: string;
  camera: CameraState | undefined;
}

export function createLedger(): ContinuityLedger {
  return {
    lastSceneNumber: 0,
    characters: new Map(),
    placedProps: new Set(),
    openClosedObjects: new Map(),
    location: "",
    timeOfDay: "",
    weather: "",
    lighting: "",
    environmentState: "",
    camera: undefined,
  };
}

/**
 * Advance the ledger by one scene.
 *
 * Later facts overwrite earlier ones, but a field the scene left blank does NOT
 * erase what was already known - an omission is silence, not a change. That
 * distinction is what lets state survive a scene that simply did not mention it.
 */
export function foldSceneIntoLedger(ledger: ContinuityLedger, scene: any): ContinuityLedger {
  const state: ContinuityState | undefined = scene?.continuityState;
  ledger.lastSceneNumber = Number(scene?.sceneNumber) || ledger.lastSceneNumber;

  if (!state) return ledger;

  for (const snapshot of state.characters ?? []) {
    const existing = ledger.characters.get(snapshot.name);
    ledger.characters.set(snapshot.name, {
      name: snapshot.name,
      position: snapshot.position || existing?.position || "",
      pose: snapshot.pose || existing?.pose || "",
      emotion: snapshot.emotion || existing?.emotion || "",
      holding: snapshot.holding || existing?.holding || "",
    });
  }

  for (const prop of state.placedProps ?? []) ledger.placedProps.add(prop);

  for (const entry of state.openClosedObjects ?? []) {
    // Accepts "gate: open" or a bare phrase like "the gate is open".
    const [name, value] = entry.includes(":") ? entry.split(":") : [entry, entry];
    ledger.openClosedObjects.set(name.trim(), value.trim());
  }

  if (state.location) ledger.location = state.location;
  if (state.timeOfDay) ledger.timeOfDay = state.timeOfDay;
  if (state.weather) ledger.weather = state.weather;
  if (state.lighting) ledger.lighting = state.lighting;
  if (state.environmentState) ledger.environmentState = state.environmentState;
  if (state.cameraState) ledger.camera = state.cameraState;

  return ledger;
}

/** Build a ledger from a run of scenes. */
export function buildLedger(scenes: any[]): ContinuityLedger {
  const ledger = createLedger();
  for (const scene of [...(scenes ?? [])].sort((a, b) => (a?.sceneNumber || 0) - (b?.sceneNumber || 0))) {
    foldSceneIntoLedger(ledger, scene);
  }
  return ledger;
}

/**
 * The ledger as a prompt block: the world as it stands, stated as fact.
 *
 * Handed to the scene department so a new batch opens from the established
 * situation instead of reinventing it.
 */
export function buildLedgerBlock(ledger: ContinuityLedger): string {
  if (ledger.lastSceneNumber === 0) return "";

  const lines: string[] = [];

  for (const c of ledger.characters.values()) {
    const parts = [c.position, c.pose, c.emotion ? `feeling ${c.emotion}` : "", c.holding ? `holding ${c.holding}` : "empty-handed"]
      .filter(Boolean)
      .join(", ");
    lines.push(`- ${c.name}: ${parts}`);
  }

  const world: string[] = [];
  if (ledger.location) world.push(`Location: ${ledger.location}`);
  if (ledger.timeOfDay) world.push(`Time: ${ledger.timeOfDay}`);
  if (ledger.weather) world.push(`Weather: ${ledger.weather}`);
  if (ledger.lighting) world.push(`Lighting: ${ledger.lighting}`);
  if (ledger.environmentState) world.push(`Environment: ${ledger.environmentState}`);
  if (ledger.placedProps.size > 0) world.push(`Objects set down in the world: ${[...ledger.placedProps].join("; ")}`);
  if (ledger.openClosedObjects.size > 0) {
    world.push(
      `Open/closed: ${[...ledger.openClosedObjects.entries()].map(([k, v]) => `${k} is ${v}`).join("; ")}`
    );
  }
  if (ledger.camera) {
    const cam = ledger.camera;
    world.push(
      `Camera ended on: ${[cam.shotSize, cam.angle, cam.movement].filter(Boolean).join(", ")}` +
        (cam.screenDirection ? `, action reading ${cam.screenDirection}` : "") +
        (cam.stillMovingAtCut ? " (STILL MOVING at the cut - the next shot must continue or settle this motion)" : "")
    );
  }

  return `WORLD STATE AS OF THE END OF SCENE ${ledger.lastSceneNumber} - THIS IS FACT, INHERIT IT:
${lines.length > 0 ? `Characters:\n${lines.join("\n")}` : "Characters: not yet established."}
${world.length > 0 ? world.map((w) => `- ${w}`).join("\n") : ""}
Do NOT reinvent any of the above. The next scene begins from exactly this situation.`;
}

// ---------------------------------------------------------------------------
// 3. RECONCILIATION
//
// On an unbroken join the previous ending is authoritative, so the opening is
// rewritten to match it. Only CHAIN joins are reconciled: a CUT is a deliberate
// edit, and silently overwriting one would destroy intentional transitions.
// ---------------------------------------------------------------------------

export interface HandoffReconciliation {
  sceneNumber: number;
  previousSceneNumber: number;
  reason: string;
}

/** Distinctive words, used to tell a restatement from a re-imagining. */
function keywords(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 4);
}

/**
 * True when `opening` already restates `priorEnd`.
 *
 * Compared on distinctive words rather than exact text, because the model
 * paraphrases rather than echoing verbatim.
 */
function alreadyInherits(opening: string, priorEnd: string): boolean {
  const expected = keywords(priorEnd);
  if (expected.length === 0) return true;
  const got = new Set(keywords(opening));
  const hits = expected.filter((word) => got.has(word)).length;
  return hits / expected.length >= 0.5;
}

/**
 * Make every CHAIN join continuous.
 *
 * Rewrites the opening prose to the previous ending, and carries forward any
 * state the scene left blank. Mutates in place and returns what it changed, so
 * reconciliations can be surfaced rather than happening invisibly.
 */
export function reconcileHandoffs(scenes: any[]): HandoffReconciliation[] {
  const applied: HandoffReconciliation[] = [];
  if (!Array.isArray(scenes) || scenes.length < 2) return applied;

  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1];
    const curr = scenes[i];
    if (!prev || !curr) continue;

    // A CUT is a deliberate edit. Leave it alone; the validator reports on it.
    if (String(curr.transitionType || "").toUpperCase() !== "CHAIN") continue;

    const priorEnd = clean(prev.endState);
    if (!priorEnd) continue;

    if (!alreadyInherits(clean(curr.startState), priorEnd)) {
      curr.startState = priorEnd;
      curr.reconciled = true;
      applied.push({
        sceneNumber: curr.sceneNumber,
        previousSceneNumber: prev.sceneNumber,
        reason: "Unbroken join opened on a different situation; opening reset to the previous scene's ending.",
      });
    }

    // Carry forward anything the scene did not restate. Silence is not a change.
    const prevState: ContinuityState | undefined = prev.continuityState;
    const currState: ContinuityState | undefined = curr.continuityState;
    if (prevState && currState) {
      if (!currState.location && prevState.location) currState.location = prevState.location;
      if (!currState.timeOfDay && prevState.timeOfDay) currState.timeOfDay = prevState.timeOfDay;
      if (!currState.weather && prevState.weather) currState.weather = prevState.weather;
      if (!currState.lighting && prevState.lighting) currState.lighting = prevState.lighting;
      if (!currState.environmentState && prevState.environmentState) {
        currState.environmentState = prevState.environmentState;
      }
      if ((currState.placedProps ?? []).length === 0 && (prevState.placedProps ?? []).length > 0) {
        currState.placedProps = [...prevState.placedProps];
      }
    }
  }

  return applied;
}

// ---------------------------------------------------------------------------
// 4. VALIDATION - REPORT ONLY
//
// Works entirely by diffing one scene's state against the next, so it applies
// to any prop, any location and any cast without a keyword list. Nothing here
// regenerates anything: issues are attached for human review.
// ---------------------------------------------------------------------------

/** Rough ordering of a day, used only to spot time running backwards. */
const TIME_ORDER = [
  "dawn", "sunrise", "early morning", "morning", "late morning", "midday", "noon",
  "afternoon", "late afternoon", "golden hour", "sunset", "dusk", "twilight",
  "evening", "night", "midnight",
];

function timeRank(timeOfDay: string): number {
  const lowered = String(timeOfDay || "").toLowerCase();
  let best = -1;
  TIME_ORDER.forEach((label, index) => {
    if (lowered.includes(label)) best = Math.max(best, index);
  });
  return best;
}

function issue(
  sceneNumber: number,
  dimension: ContinuityIssue["dimension"],
  title: string,
  previousState: string,
  currentState: string,
  suggestedFix: string,
  severity: ContinuityIssue["severity"]
): ContinuityIssue {
  return { sceneNumber, dimension, title, previousState, currentState, suggestedFix, severity };
}

/**
 * Compare consecutive scenes and attach continuity issues.
 *
 * Severity reflects how confident the check is, because this output is read by
 * a person deciding whether to regenerate: `warning` is a probable break,
 * `info` is worth a look. An unbroken join is held to a much stricter standard
 * than a cut, where change is the point.
 */
export function validateContinuity(scenes: any[]): void {
  if (!Array.isArray(scenes) || scenes.length <= 1) return;

  const ordered = [...scenes].sort((a, b) => (a?.sceneNumber || 0) - (b?.sceneNumber || 0));
  let repeatedShotRun = 0;

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const curr = ordered[i];
    const issues: ContinuityIssue[] = [];
    const isChain = String(curr.transitionType || "").toUpperCase() === "CHAIN";
    const joinLabel = isChain ? "unbroken join" : "cut";

    const prevState: ContinuityState | undefined = prev.continuityState;
    const currState: ContinuityState | undefined = curr.continuityState;

    // --- Character presence -------------------------------------------------
    const prevChars = new Set((prev.charactersPresent || []).map((c: string) => String(c).toLowerCase()));
    const currChars = new Set((curr.charactersPresent || []).map((c: string) => String(c).toLowerCase()));
    const exitDeclared = /\b(exit|leave|leaves|walks away|off-screen|departs)\b/i.test(
      `${prev.characterActions || ""} ${prev.endState || ""} ${curr.characterActions || ""}`
    );

    prevChars.forEach((name) => {
      if (!currChars.has(name) && prevChars.size > 1 && !exitDeclared) {
        issues.push(
          issue(
            curr.sceneNumber,
            "character",
            `Character leaves without an exit (${name})`,
            `Scene ${prev.sceneNumber}: present on screen.`,
            `Scene ${curr.sceneNumber}: absent, with no exit shown.`,
            `Either keep ${name} in frame or show them leaving in Scene ${prev.sceneNumber}.`,
            isChain ? "warning" : "info"
          )
        );
      }
    });

    if (prevState && currState) {
      // --- Held props ------------------------------------------------------
      for (const [who, held] of Object.entries(prevState.heldProps || {})) {
        const stillHeld = (currState.heldProps || {})[who];
        if (stillHeld && stillHeld.toLowerCase() === held.toLowerCase()) continue;

        const wasSetDown = (currState.placedProps || []).some((p) =>
          p.toLowerCase().includes(held.toLowerCase().split(",")[0].trim())
        );
        const actionExplains = /\b(puts? down|places?|drops?|hands?|gives?|throws?|sets? down)\b/i.test(
          `${prev.characterActions || ""} ${curr.characterActions || ""} ${prev.endState || ""}`
        );

        if (!wasSetDown && !actionExplains) {
          issues.push(
            issue(
              curr.sceneNumber,
              "prop",
              `Held object disappears (${held})`,
              `Scene ${prev.sceneNumber}: ${who} was holding ${held}.`,
              `Scene ${curr.sceneNumber}: ${stillHeld ? `${who} now holds ${stillHeld}.` : `${who} is holding nothing.`}`,
              `Keep ${who} holding it, or show them putting it down.`,
              "warning"
            )
          );
        }
      }

      // --- Position / emotion across an unbroken join -----------------------
      if (isChain) {
        for (const [who, where] of Object.entries(prevState.characterPositions || {})) {
          const nowAt = (currState.characterPositions || {})[who];
          if (nowAt && nowAt.toLowerCase() !== where.toLowerCase()) {
            issues.push(
              issue(
                curr.sceneNumber,
                "character",
                `Position jumps across an unbroken join (${who})`,
                `Scene ${prev.sceneNumber} ends: ${who} at ${where}.`,
                `Scene ${curr.sceneNumber} opens: ${who} at ${nowAt}.`,
                `On a CHAIN join the opening must match the previous ending, or the join should be a CUT.`,
                "warning"
              )
            );
          }
        }

        for (const [who, mood] of Object.entries(prevState.characterEmotions || {})) {
          const nowFeeling = (currState.characterEmotions || {})[who];
          if (nowFeeling && nowFeeling.toLowerCase() !== mood.toLowerCase()) {
            issues.push(
              issue(
                curr.sceneNumber,
                "emotion",
                `Emotion resets across an unbroken join (${who})`,
                `Scene ${prev.sceneNumber} ends: ${mood}.`,
                `Scene ${curr.sceneNumber} opens: ${nowFeeling}.`,
                `Feeling carries through an unbroken join. Let it shift during the scene, not at the seam.`,
                "info"
              )
            );
          }
        }

        if (prevState.location && currState.location && prevState.location.toLowerCase() !== currState.location.toLowerCase()) {
          issues.push(
            issue(
              curr.sceneNumber,
              "location",
              "Location changes on an unbroken join",
              `Scene ${prev.sceneNumber}: ${prevState.location}`,
              `Scene ${curr.sceneNumber}: ${currState.location}`,
              `An unbroken join cannot change place. Make this a CUT, or bridge the move on screen.`,
              "warning"
            )
          );
        }

        if (prevState.lighting && currState.lighting && prevState.lighting.toLowerCase() !== currState.lighting.toLowerCase()) {
          issues.push(
            issue(
              curr.sceneNumber,
              "lighting",
              "Lighting changes on an unbroken join",
              `Scene ${prev.sceneNumber}: ${prevState.lighting}`,
              `Scene ${curr.sceneNumber}: ${currState.lighting}`,
              `Light should not jump mid-action unless something in the scene changes it.`,
              "info"
            )
          );
        }
      }

      // --- Time runs backwards ---------------------------------------------
      const prevRank = timeRank(prevState.timeOfDay);
      const currRank = timeRank(currState.timeOfDay);
      if (prevRank >= 0 && currRank >= 0 && currRank < prevRank) {
        issues.push(
          issue(
            curr.sceneNumber,
            "time",
            "Time of day moves backwards",
            `Scene ${prev.sceneNumber}: ${prevState.timeOfDay}`,
            `Scene ${curr.sceneNumber}: ${currState.timeOfDay}`,
            `Time should move forward unless the story declares a flashback.`,
            "warning"
          )
        );
      }

      // --- Open / closed objects -------------------------------------------
      const prevOpen = new Map(
        (prevState.openClosedObjects || []).map((entry) => {
          const [k, v] = entry.includes(":") ? entry.split(":") : [entry, entry];
          return [k.trim().toLowerCase(), v.trim().toLowerCase()];
        })
      );
      for (const entry of currState.openClosedObjects || []) {
        const [k, v] = entry.includes(":") ? entry.split(":") : [entry, entry];
        const before = prevOpen.get(k.trim().toLowerCase());
        if (before && before !== v.trim().toLowerCase()) {
          const actionExplains = /\b(opens?|closes?|shuts?|pulls?|pushes?)\b/i.test(
            `${curr.characterActions || ""} ${prev.characterActions || ""}`
          );
          if (!actionExplains) {
            issues.push(
              issue(
                curr.sceneNumber,
                "prop",
                `Object state changes with no action (${k.trim()})`,
                `Scene ${prev.sceneNumber}: ${before}`,
                `Scene ${curr.sceneNumber}: ${v.trim()}`,
                `Show someone changing it, or keep it as it was.`,
                "warning"
              )
            );
          }
        }
      }

      // --- Camera ------------------------------------------------------------
      const prevCam = prevState.cameraState;
      const currCam = currState.cameraState;
      if (prevCam && currCam) {
        if (
          prevCam.shotSize &&
          currCam.shotSize &&
          prevCam.shotSize.toLowerCase() === currCam.shotSize.toLowerCase() &&
          (prevCam.movement || "").toLowerCase() === (currCam.movement || "").toLowerCase()
        ) {
          repeatedShotRun += 1;
          if (repeatedShotRun >= 2) {
            issues.push(
              issue(
                curr.sceneNumber,
                "camera",
                "Same shot repeated three or more times",
                `Scene ${prev.sceneNumber}: ${prevCam.shotSize}, ${prevCam.movement || "static"}`,
                `Scene ${curr.sceneNumber}: identical framing and movement.`,
                `Vary shot size or movement so the sequence reads as directed rather than repetitive.`,
                "info"
              )
            );
          }
        } else {
          repeatedShotRun = 0;
        }

        if (
          isChain &&
          prevCam.screenDirection &&
          currCam.screenDirection &&
          prevCam.screenDirection.toLowerCase() !== currCam.screenDirection.toLowerCase()
        ) {
          issues.push(
            issue(
              curr.sceneNumber,
              "camera",
              "Screen direction flips across an unbroken join",
              `Scene ${prev.sceneNumber}: action reads ${prevCam.screenDirection}.`,
              `Scene ${curr.sceneNumber}: action reads ${currCam.screenDirection}.`,
              `Crossing the line mid-action disorients the viewer. Hold direction, or motivate the cross on screen.`,
              "warning"
            )
          );
        }

        if (prevCam.stillMovingAtCut && !currCam.movement) {
          issues.push(
            issue(
              curr.sceneNumber,
              "camera",
              "Camera motion stops dead at the cut",
              `Scene ${prev.sceneNumber} ends mid-move: ${prevCam.movement}.`,
              `Scene ${curr.sceneNumber} opens static.`,
              `Continue the move into this shot, or let the previous scene settle before it ends.`,
              "info"
            )
          );
        }
      }
    }

    // --- Prose handoff, when structured state is unavailable -----------------
    if ((!prevState || !currState) && isChain && prev.endState && curr.startState) {
      if (!alreadyInherits(clean(curr.startState), clean(prev.endState))) {
        issues.push(
          issue(
            curr.sceneNumber,
            "action",
            `Opening does not inherit the previous ${joinLabel}`,
            `Scene ${prev.sceneNumber} ends: ${prev.endState}`,
            `Scene ${curr.sceneNumber} opens: ${curr.startState}`,
            `Open from the previous ending: same positions, poses, held objects and eyelines.`,
            "warning"
          )
        );
      }
    }

    curr.continuityIssues = issues;
  }
}

/** Counts for the generation log and the UI summary. */
export function summariseContinuity(scenes: any[]): {
  warnings: number;
  infos: number;
  scenesWithIssues: number;
} {
  let warnings = 0;
  let infos = 0;
  let scenesWithIssues = 0;

  for (const scene of scenes ?? []) {
    const issues: ContinuityIssue[] = scene?.continuityIssues || [];
    if (issues.length > 0) scenesWithIssues += 1;
    for (const item of issues) {
      if (item.severity === "warning") warnings += 1;
      else infos += 1;
    }
  }

  return { warnings, infos, scenesWithIssues };
}

import type { FactIssue, FactReport, SocialGraph, WorldRegistry } from "../../types.js";

/**
 * FACT VALIDATION — identity and social truth, report only.
 *
 * The third validator in the system, and it deliberately checks a different
 * thing from the other two:
 *
 *   Continuity Director  - PHYSICS. Where someone stands, what they hold, the
 *                          light, the camera. Per-frame, changes every scene.
 *   THIS MODULE          - IDENTITY AND FACTS. Who someone is to another, who
 *                          lives where, which place this is, who owns the goat,
 *                          whether that animal can speak at all.
 *
 * No physical state is examined here and none should be: a position or a prop
 * belongs to the Continuity Director, and checking it twice would mean two
 * systems disagreeing about the same thing.
 *
 * Nothing is regenerated. Every finding is attached for human review, matching
 * the report-only contract the Continuity Director already follows.
 *
 * Checks are STRUCTURAL - comparing declared facts against each other and
 * against what scenes actually did. They do not attempt to read meaning out of
 * prose, because a validator that guesses produces false alarms that train
 * people to ignore it.
 */

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function key(name: string): string {
  return clean(name).toLowerCase().replace(/\s+/g, " ");
}

function issue(
  kind: FactIssue["kind"],
  title: string,
  detail: string,
  suggestedFix: string,
  severity: FactIssue["severity"],
  sceneNumber?: number
): FactIssue {
  return { kind, title, detail, suggestedFix, severity, sceneNumber };
}

// ---------------------------------------------------------------------------
// SOCIAL FACTS
// ---------------------------------------------------------------------------

function checkSocialGraph(graph: SocialGraph, castNames: Set<string>): FactIssue[] {
  const issues: FactIssue[] = [];
  const byPair = new Map<string, { type: string; from: string; to: string }>();

  for (const bond of graph.bonds) {
    const forward = `${key(bond.from)}->${key(bond.to)}`;

    // The same ordered pair declared twice with different labels: one of them
    // is wrong and nothing downstream can tell which.
    const seen = byPair.get(forward);
    if (seen && key(seen.type) !== key(bond.type)) {
      issues.push(
        issue(
          "relationship",
          `Conflicting relationship labels (${bond.from} → ${bond.to})`,
          `Declared both as "${seen.type}" and as "${bond.type}".`,
          `A pair can only be one thing to each other. Remove the incorrect bond.`,
          "warning"
        )
      );
    } else {
      byPair.set(forward, { type: bond.type, from: bond.from, to: bond.to });
    }

    for (const who of [bond.from, bond.to]) {
      if (castNames.size > 0 && !castNames.has(key(who))) {
        issues.push(
          issue(
            "relationship",
            `Relationship references someone outside the cast (${who})`,
            `"${bond.from} → ${bond.to}" (${bond.type}) names ${who}, who is not in the cast.`,
            `Either add them to the cast or to the world registry, or drop the bond.`,
            "info"
          )
        );
      }
    }
  }

  // Reciprocity: enforced at build time, re-checked here because a graph can
  // also arrive from a client on a regeneration path.
  for (const bond of graph.bonds) {
    const reverse = graph.bonds.find((b) => key(b.from) === key(bond.to) && key(b.to) === key(bond.from));

    if (!reverse) {
      issues.push(
        issue(
          "relationship",
          `Relationship has no reciprocal (${bond.from} → ${bond.to})`,
          `${bond.from} is ${bond.to}'s ${bond.type}, but nothing records what ${bond.to} is to ${bond.from}.`,
          `Add the reciprocal bond so both directions are fixed.`,
          "warning"
        )
      );
      continue;
    }

    if (bond.inverse && key(reverse.type) !== key(bond.inverse)) {
      issues.push(
        issue(
          "relationship",
          `Reciprocal relationship contradicts its pair (${bond.to} → ${bond.from})`,
          `"${bond.from} is ${bond.to}'s ${bond.type}" implies "${bond.inverse}", but the reverse says "${reverse.type}".`,
          `Align the reciprocal with the forward bond.`,
          "warning"
        )
      );
    }
  }

  // Households: one home each, and members who actually exist.
  const homeOf = new Map<string, string>();
  for (const household of graph.households) {
    for (const member of household.memberIds) {
      const existing = homeOf.get(key(member));
      if (existing && existing !== household.id) {
        issues.push(
          issue(
            "household",
            `Character belongs to two households (${member})`,
            `Listed in both "${existing}" and "${household.id}".`,
            `A character lives in one household unless the story shows them moving.`,
            "warning"
          )
        );
      } else {
        homeOf.set(key(member), household.id);
      }

      if (castNames.size > 0 && !castNames.has(key(member))) {
        issues.push(
          issue(
            "household",
            `Household lists someone outside the cast (${member})`,
            `"${household.name}" includes ${member}, who is not a story character.`,
            `Move them to the world registry as a background villager, or add them to the cast.`,
            "info"
          )
        );
      }
    }
  }

  // Life stage: one per character, and consistent with their household record.
  const stageOf = new Map<string, string>();
  for (const social of graph.characterSocial) {
    const who = key(social.characterId);

    if (social.lifeStage) {
      const existing = stageOf.get(who);
      if (existing && key(existing) !== key(social.lifeStage)) {
        issues.push(
          issue(
            "life-stage",
            `Character has two different life stages (${social.characterId})`,
            `Recorded as both "${existing}" and "${social.lifeStage}".`,
            `A character has one life stage for the whole film.`,
            "warning"
          )
        );
      } else {
        stageOf.set(who, social.lifeStage);
      }
    }

    if (social.householdId) {
      const household = graph.households.find((h) => h.id === social.householdId);
      if (!household) {
        issues.push(
          issue(
            "household",
            `Character assigned to a household that does not exist (${social.characterId})`,
            `Points at "${social.householdId}", which is not defined.`,
            `Define the household or clear the reference.`,
            "info"
          )
        );
      } else if (!household.memberIds.some((m) => key(m) === who)) {
        issues.push(
          issue(
            "household",
            `Household membership disagrees with itself (${social.characterId})`,
            `${social.characterId} claims household "${household.id}", which does not list them as a member.`,
            `Add them to the member list, or clear the assignment.`,
            "warning"
          )
        );
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// WORLD FACTS
// ---------------------------------------------------------------------------

function checkWorldRegistry(registry: WorldRegistry, castNames: Set<string>): FactIssue[] {
  const issues: FactIssue[] = [];
  const placeIds = new Set(registry.places.map((p) => p.id));

  const seenNames = new Map<string, string>();
  for (const place of registry.places) {
    const existing = seenNames.get(key(place.name));
    if (existing) {
      issues.push(
        issue(
          "place",
          `Two places share a name ("${place.name}")`,
          `Ids "${existing}" and "${place.id}" are both called "${place.name}".`,
          `Scenes cannot tell them apart. Rename one or merge them.`,
          "warning"
        )
      );
    } else {
      seenNames.set(key(place.name), place.id);
    }
  }

  const ownerOf = new Map<string, string>();
  for (const entity of registry.entities) {
    const label = entity.name || entity.id;

    if (entity.homePlaceId && !placeIds.has(entity.homePlaceId)) {
      issues.push(
        issue(
          "entity",
          `Entity lives in a place that does not exist (${label})`,
          `Home place "${entity.homePlaceId}" is not in the registry.`,
          `Register the place, or clear the reference.`,
          "info"
        )
      );
    }

    if (entity.ownerHouseholdId) {
      const existing = ownerOf.get(entity.id);
      if (existing && existing !== entity.ownerHouseholdId) {
        issues.push(
          issue(
            "entity",
            `Ownership changed (${label})`,
            `Recorded as owned by both "${existing}" and "${entity.ownerHouseholdId}".`,
            `Ownership is a fact. Show it changing hands on screen, or pick one.`,
            "warning"
          )
        );
      } else {
        ownerOf.set(entity.id, entity.ownerHouseholdId);
      }
    }

    if (entity.caredForBy && castNames.size > 0 && !castNames.has(key(entity.caredForBy))) {
      issues.push(
        issue(
          "entity",
          `Entity cared for by someone outside the cast (${label})`,
          `Carer "${entity.caredForBy}" is not a story character.`,
          `Assign a cast member, or record the carer as a background villager.`,
          "info"
        )
      );
    }

    // A cast member and an entity sharing a name makes every later reference
    // ambiguous, and is the usual route to an entity drifting into the cast.
    if (entity.name && castNames.has(key(entity.name))) {
      issues.push(
        issue(
          "cast",
          `An entity shares a name with a story character ("${entity.name}")`,
          `"${entity.name}" exists both in the cast and in the world registry.`,
          `Rename one. If this is genuinely a main character, keep it in the cast only - and it counts toward the character count.`,
          "warning"
        )
      );
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// WHAT THE SCENES ACTUALLY DID
// ---------------------------------------------------------------------------

function checkScenes(
  scenes: any[],
  graph: SocialGraph | null,
  registry: WorldRegistry | null,
  castNames: Set<string>
): FactIssue[] {
  const issues: FactIssue[] = [];
  const placeById = new Map((registry?.places ?? []).map((p) => [p.id, p]));
  const entityByName = new Map(
    (registry?.entities ?? []).filter((e) => e.name).map((e) => [key(e.name!), e])
  );
  const bondedPairs = new Set(
    (graph?.bonds ?? []).map((b) => [key(b.from), key(b.to)].sort().join("|"))
  );

  // A place's first observed description becomes the reference for the rest.
  const firstSeenLocation = new Map<string, { sceneNumber: number; location: string }>();

  for (const scene of scenes ?? []) {
    const sceneNumber = Number(scene?.sceneNumber) || 0;
    const state = scene?.continuityState;
    const placeId = clean(state?.placeId);

    if (placeId && registry) {
      const place = placeById.get(placeId);

      if (!place) {
        issues.push(
          issue(
            "place",
            `Scene uses an unregistered place id ("${placeId}")`,
            `Scene ${sceneNumber} sets placeId "${placeId}", which is not in the world registry.`,
            `Register the place so it keeps a stable identity, or use the correct id.`,
            "warning",
            sceneNumber
          )
        );
      } else {
        const location = clean(state?.location);
        const first = firstSeenLocation.get(placeId);

        if (!first) {
          if (location) firstSeenLocation.set(placeId, { sceneNumber, location });
        } else if (
          location &&
          key(location) !== key(first.location) &&
          !key(location).includes(key(place.name)) &&
          !key(place.name).includes(key(location))
        ) {
          issues.push(
            issue(
              "place",
              `Place identity drifts ("${place.name}")`,
              `Scene ${first.sceneNumber} described ${placeId} as "${first.location}"; scene ${sceneNumber} describes it as "${location}".`,
              `The same place must read the same way each time. Keep its fixed features and description stable.`,
              "warning",
              sceneNumber
            )
          );
        }
      }
    }

    // An animal that cannot speak must not appear as a speaker. This is the
    // single most visible world-rule break available, and it is exactly
    // checkable: speech mode is a fact, and dialogue names its speaker.
    const turns = Array.isArray(scene?.dialogueTurns) ? scene.dialogueTurns : [];
    for (const turn of turns) {
      const speaker = key(clean(turn?.speaker));
      if (!speaker) continue;

      const entity = entityByName.get(speaker);
      if (entity && entity.speech && entity.speech !== "speaking") {
        issues.push(
          issue(
            "entity",
            `A non-speaking animal speaks (${entity.name})`,
            `Scene ${sceneNumber} gives ${entity.name} a line, but its speech mode is "${entity.speech}".`,
            `Either express it through action and expression instead, or change its speech mode in the registry for the whole film.`,
            "warning",
            sceneNumber
          )
        );
      }

      if (entity && (entity.kind === "belonging" || entity.kind === "infrastructure")) {
        issues.push(
          issue(
            "entity",
            `A non-character object speaks (${entity.name})`,
            `Scene ${sceneNumber} gives a line to "${entity.name}", which is registered as ${entity.kind}.`,
            `Objects do not speak. Move the line to a character, or re-register the entity.`,
            "warning",
            sceneNumber
          )
        );
      }
    }

    // Social deltas must be between people the story actually knows, and must
    // never be used to redefine a relationship.
    const changes = Array.isArray(scene?.socialChanges) ? scene.socialChanges : [];
    for (const change of changes) {
      const a = clean(change?.characterA);
      const b = clean(change?.characterB);
      if (!a || !b) continue;

      if (castNames.size > 0 && (!castNames.has(key(a)) || !castNames.has(key(b)))) {
        issues.push(
          issue(
            "relationship",
            `Relationship change names someone outside the cast`,
            `Scene ${sceneNumber} records a change between ${a} and ${b}.`,
            `Social state applies to story characters. Check the names.`,
            "info",
            sceneNumber
          )
        );
      }

      // Any attempt to restate the relationship itself rather than its state.
      if (/^(relationship|bond|kinship|who they are)$/i.test(clean(change?.dimension))) {
        issues.push(
          issue(
            "relationship",
            `A scene tried to redefine a relationship`,
            `Scene ${sceneNumber} recorded dimension "${change.dimension}" between ${a} and ${b}: "${change.change}".`,
            `Relationship facts are fixed and this had no effect. Record what CHANGED between them instead - trust, tension, a promise.`,
            "warning",
            sceneNumber
          )
        );
      }

      if (graph && bondedPairs.size > 0 && !bondedPairs.has([key(a), key(b)].sort().join("|"))) {
        issues.push(
          issue(
            "relationship",
            `Relationship change between an unrecorded pair (${a} and ${b})`,
            `Scene ${sceneNumber} shifts something between them, but no bond records what they are to each other.`,
            `Add the bond to the social graph so the pair has a fixed footing.`,
            "info",
            sceneNumber
          )
        );
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------

/**
 * Validate a story's identity and social facts. Report only.
 *
 * Returns findings; changes nothing. Severity reflects confidence, because a
 * person reads this to decide whether to regenerate: `warning` is a probable
 * break, `info` is worth a glance.
 */
export function validateStoryFacts(params: {
  scenes?: any[];
  socialGraph?: SocialGraph | null;
  worldRegistry?: WorldRegistry | null;
  castNames?: string[];
}): FactReport {
  const { scenes = [], socialGraph = null, worldRegistry = null, castNames = [] } = params;
  const cast = new Set(castNames.map(key).filter(Boolean));

  const issues: FactIssue[] = [
    ...(socialGraph ? checkSocialGraph(socialGraph, cast) : []),
    ...(worldRegistry ? checkWorldRegistry(worldRegistry, cast) : []),
    ...checkScenes(scenes, socialGraph, worldRegistry, cast),
  ];

  return {
    issues,
    warnings: issues.filter((i) => i.severity === "warning").length,
    infos: issues.filter((i) => i.severity === "info").length,
  };
}

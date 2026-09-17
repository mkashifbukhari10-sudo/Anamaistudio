import type { Place, WorldEntity, WorldRegistry } from "../../types.js";

/**
 * THE WORLD REGISTRY — persistent places and the things that live in them.
 *
 * The companion to the social graph. Where that layer answers "who is this
 * person to that one", this answers "what is this place, and what belongs
 * here". Both are FACTS: established once at blueprint time, injected into
 * every scene batch, never rewritten by scene generation.
 *
 * It exists because `ContinuityState.location` is only a per-scene string. The
 * physical layer tracks what is IN a location; nothing tracked WHICH location
 * it was, so the same courtyard was re-invented every scene and drifted. A
 * Place has an id and a set of fixed features, and scenes reference it.
 *
 * ---------------------------------------------------------------------------
 * THE THREE TIERS, AND WHY CHARACTER COUNT IS SAFE
 *
 *   A. STORY CAST      - a want and an arc. Lives in castPlan.
 *                        COUNTS toward the user's Character Count.
 *   B. RECURRING ENTITY - a household cow, the shopkeeper, the school bell.
 *                        Recurs, needs continuity, has no dramatic arc.
 *                        DOES NOT COUNT. No Character Bible.
 *   C. BACKGROUND      - villagers at the well, birds, passing carts.
 *                        Texture only. DOES NOT COUNT. No Character Bible.
 *
 * The rule in one line: if it has a want and an arc it is a character; other-
 * wise it is an entity. Promotion from B to A is deliberate - the Story
 * Director moves it into castPlan - and only then does it consume a slot.
 * ---------------------------------------------------------------------------
 *
 * Nothing here seeds a world. No canonical village, no default animals, no
 * fixed architecture, culture or layout. Every place and entity is invented per
 * story, and this module only preserves what the story chose.
 */

// ---------------------------------------------------------------------------
// NORMALISATION
// ---------------------------------------------------------------------------

function clean(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const lowered = text.toLowerCase();
  if (lowered === "none" || lowered === "n/a" || lowered === "-") return "";
  return text;
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(clean).filter(Boolean);
}

function slug(value: string, fallback: string): string {
  const base = clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return base || fallback;
}

/**
 * Force an id into its own namespace.
 *
 * Households, places and entities previously shared one flat string space, and
 * a real generation put the household id "ghar_1" into a scene's placeId while
 * the registered place was "ghar". Namespacing makes that class of mistake
 * impossible to express: a household id can no longer look like a place id.
 */
export function namespaceId(raw: unknown, prefix: "place" | "entity" | "household", fallback: string): string {
  const base = slug(String(raw ?? ""), "");
  const stripped = base.replace(/^(place|entity|household)_/, "");
  return `${prefix}_${stripped || fallback}`;
}

function normalizeKind(raw: unknown): WorldEntity["kind"] {
  const value = clean(raw).toLowerCase();
  if (value === "animal" || value === "villager" || value === "belonging" || value === "infrastructure") {
    return value;
  }
  // Unrecognised kinds become belongings rather than being dropped: losing a
  // tracked object is worse than filing it imperfectly.
  return "belonging";
}

function normalizeTier(raw: unknown): WorldEntity["tier"] {
  return clean(raw).toUpperCase() === "RECURRING" ? "RECURRING" : "BACKGROUND";
}

/**
 * Animal speech mode, decided once for the whole world.
 *
 * Left undefined for non-animals. For animals an unset value defaults to
 * 'expressive': a talking animal is a significant world rule that should be a
 * deliberate choice, never something that appears by accident.
 */
function normalizeSpeech(raw: unknown, kind: WorldEntity["kind"]): WorldEntity["speech"] | undefined {
  if (kind !== "animal") return undefined;
  const value = clean(raw).toLowerCase();
  if (value === "speaking" || value === "expressive" || value === "mute") return value;
  return "expressive";
}

function normalizePlaces(raw: unknown): Place[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();

  return raw
    .map((p: any, index: number) => ({
      id: namespaceId(p?.id || p?.name, "place", String(index + 1)),
      name: clean(p?.name),
      belongsToHousehold: clean(p?.belongsToHousehold) || undefined,
      fixedFeatures: cleanList(p?.fixedFeatures),
      connectsTo: cleanList(p?.connectsTo),
    }))
    .filter((p) => {
      if (!p.name || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
}

function normalizeEntities(raw: unknown): WorldEntity[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();

  return raw
    .map((e: any, index: number) => {
      const kind = normalizeKind(e?.kind);
      return {
        id: namespaceId(e?.id || e?.name, "entity", String(index + 1)),
        kind,
        name: clean(e?.name) || undefined,
        tier: normalizeTier(e?.tier),
        ownerHouseholdId: clean(e?.ownerHouseholdId) || undefined,
        homePlaceId: clean(e?.homePlaceId) ? namespaceId(e.homePlaceId, "place", "") : undefined,
        caredForBy: clean(e?.caredForBy) || undefined,
        speech: normalizeSpeech(e?.speech, kind),
        storyRelevance: clean(e?.storyRelevance) || undefined,
        plannedAppearances: clean(e?.plannedAppearances) || undefined,
      };
    })
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
}

/**
 * Build the registry, dropping references that point nowhere.
 *
 * A dangling homePlaceId is worse than none: it invites the model to invent a
 * place to match an id it cannot resolve.
 */
export function buildWorldRegistry(raw: any): WorldRegistry {
  const places = normalizePlaces(raw?.places);
  const placeIds = new Set(places.map((p) => p.id));
  const entities = normalizeEntities(raw?.entities);

  for (const entity of entities) {
    if (entity.homePlaceId && !placeIds.has(entity.homePlaceId)) {
      entity.homePlaceId = undefined;
    }
  }

  for (const place of places) {
    place.connectsTo = (place.connectsTo ?? [])
      .map((c) => namespaceId(c, "place", ""))
      .filter((c) => placeIds.has(c));
  }

  // RECURRING is a promise that the entity appears. Without a plan it is not a
  // promise the story can keep, so it becomes BACKGROUND - which carries no
  // continuity burden and no expectation.
  for (const entity of entities) {
    if (entity.tier === "RECURRING" && !entity.plannedAppearances) {
      entity.tier = "BACKGROUND";
      console.log(
        `[World] "${entity.name || entity.id}" had no planned appearances - downgraded RECURRING -> BACKGROUND.`
      );
    }
  }

  return { places, entities };
}

/**
 * Fill in entity facts the story implies but did not state.
 *
 * Only unambiguous inferences: a household animal in a one-household story
 * belongs to that household; an entity whose owner has exactly one place lives
 * there. Anything ambiguous is left for the Fact Validator to report rather
 * than guessed at.
 */
export function completeEntityFacts(
  registry: WorldRegistry,
  householdIds: string[]
): string[] {
  const fixes: string[] = [];
  const onlyHousehold = householdIds.length === 1 ? householdIds[0] : undefined;

  for (const entity of registry.entities) {
    if (entity.tier !== "RECURRING") continue;
    const label = entity.name || entity.id;

    if (!entity.ownerHouseholdId && onlyHousehold && (entity.kind === "animal" || entity.kind === "belonging")) {
      entity.ownerHouseholdId = onlyHousehold;
      fixes.push(`${label} owned by ${onlyHousehold}`);
    }

    if (!entity.homePlaceId && entity.ownerHouseholdId) {
      const owned = registry.places.filter((p) => p.belongsToHousehold === entity.ownerHouseholdId);
      if (owned.length === 1) {
        entity.homePlaceId = owned[0].id;
        fixes.push(`${label} lives at ${owned[0].id}`);
      }
    }
  }

  return fixes;
}

export function isEmptyRegistry(registry: WorldRegistry | undefined | null): boolean {
  if (!registry) return true;
  return registry.places.length === 0 && registry.entities.length === 0;
}

/** Look up a place by id, tolerating a missing or wrong namespace prefix. */
export function findPlace(registry: WorldRegistry | undefined | null, placeId: string): Place | undefined {
  if (!registry || !clean(placeId)) return undefined;
  const wanted = namespaceId(placeId, "place", "");
  return registry.places.find((p) => p.id === wanted);
}

/**
 * Decide which registered Place a scene actually happens in.
 *
 * A real generation sent the HOUSEHOLD id as a scene's placeId while the
 * registered place had a different id, and the old logic accepted it because it
 * only filled in EMPTY values. A wrong id is worse than a missing one: it
 * points confidently at nothing.
 *
 * So a supplied id is now treated as a claim to be verified, never as truth:
 *   1. empty          -> resolve from the location text
 *   2. valid place id -> accept
 *   3. anything else  -> reject it (a household id can never be a place) and
 *                        fall back to resolving from the location text
 *
 * Returns what it settled on plus why, so a correction is visible rather than
 * silent, and an unresolvable id is left undefined for the validator to report.
 */
export function resolveScenePlace(
  registry: WorldRegistry | undefined | null,
  rawPlaceId: unknown,
  rawLocation: unknown
): { placeId?: string; location?: string; corrected: boolean; reason?: string } {
  const location = clean(rawLocation);
  if (!registry || registry.places.length === 0) return { location: location || undefined, corrected: false };

  const supplied = clean(rawPlaceId);

  // 1. A valid id in the right field. Still repair the location if the model
  //    ALSO wrote an id there instead of a human-readable description.
  const direct = supplied ? findPlace(registry, supplied) : undefined;
  if (direct) {
    const locationIsAnId = Boolean(findPlace(registry, location));
    return {
      placeId: direct.id,
      location: locationIsAnId ? direct.name : location || direct.name,
      corrected: locationIsAnId,
      reason: locationIsAnId ? `location held the place id "${location}"; replaced with "${direct.name}"` : undefined,
    };
  }

  // 2. The id landed in the LOCATION field - observed in a real generation,
  //    where every scene had location "place_kitchen" and an empty placeId.
  const fromLocationId = findPlace(registry, location);
  if (fromLocationId) {
    return {
      placeId: fromLocationId.id,
      location: fromLocationId.name,
      corrected: true,
      reason:
        `place id was in the location field ("${location}"); moved to placeId and location restored to "${fromLocationId.name}"`,
    };
  }

  // 3. A human-readable place name in the location field.
  const byName = resolvePlaceId(registry, location);
  if (byName) {
    return {
      placeId: byName,
      location: location,
      corrected: Boolean(supplied),
      reason: supplied ? `"${supplied}" is not a registered place; resolved to "${byName}" from the location text` : undefined,
    };
  }

  // 4. Nothing resolvable. A wrong id is worse than none, so it is dropped -
  //    a household id can never stand in for a place.
  return {
    location: location || undefined,
    corrected: Boolean(supplied),
    reason: supplied ? `"${supplied}" is not a registered place and the location text matched none` : undefined,
  };
}

/**
 * Resolve a free-text location to a registered place id.
 *
 * Scene output may name a place rather than reference its id. Matching by name
 * keeps the link intact without forcing the model to remember identifiers.
 */
export function resolvePlaceId(registry: WorldRegistry | undefined | null, location: string): string | undefined {
  if (!registry || !clean(location)) return undefined;
  const needle = clean(location).toLowerCase();

  const exact = registry.places.find((p) => p.name.toLowerCase() === needle);
  if (exact) return exact.id;

  const contained = registry.places.find(
    (p) => needle.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(needle)
  );
  return contained?.id;
}

// ---------------------------------------------------------------------------
// PROMPT ASSEMBLY
// ---------------------------------------------------------------------------

function describeEntity(entity: WorldEntity): string {
  const bits: string[] = [];
  if (entity.ownerHouseholdId) bits.push(`belongs to ${entity.ownerHouseholdId}`);
  if (entity.caredForBy) bits.push(`cared for by ${entity.caredForBy}`);
  if (entity.homePlaceId) bits.push(`normally at ${entity.homePlaceId}`);
  if (entity.kind === "animal" && entity.speech) {
    const mode =
      entity.speech === "speaking"
        ? "SPEAKS in words"
        : entity.speech === "mute"
        ? "makes no sound beyond ordinary animal noise"
        : "does not speak but is expressive in face and body";
    bits.push(mode);
  }
  if (entity.storyRelevance) bits.push(entity.storyRelevance);

  const label = entity.name ? `${entity.name} (${entity.kind})` : entity.kind;
  return `  - ${label}${bits.length > 0 ? `: ${bits.join("; ")}` : ""}`;
}

/**
 * The world as established fact.
 *
 * Injected verbatim into every scene batch alongside the social facts, so a
 * place cannot be re-imagined and an animal cannot change hands.
 */
export function buildWorldFactsBlock(registry: WorldRegistry): string {
  if (isEmptyRegistry(registry)) return "";

  const sections: string[] = [];

  if (registry.places.length > 0) {
    sections.push(
      `PLACES - each has a fixed identity. Reference them, do not reinvent them:\n` +
        registry.places
          .map((p) => {
            const owner = p.belongsToHousehold ? ` [${p.belongsToHousehold}]` : "";
            const features = p.fixedFeatures.length > 0 ? `\n      always true here: ${p.fixedFeatures.join("; ")}` : "";
            const links = (p.connectsTo ?? []).length > 0 ? `\n      reachable from here: ${p.connectsTo!.join(", ")}` : "";
            return `  - [${p.id}] ${p.name}${owner}${features}${links}`;
          })
          .join("\n")
    );
  }

  const recurring = registry.entities.filter((e) => e.tier === "RECURRING");
  const background = registry.entities.filter((e) => e.tier === "BACKGROUND");

  if (recurring.length > 0) {
    sections.push(
      `RECURRING WORLD ENTITIES - these persist and must stay consistent:\n${recurring.map(describeEntity).join("\n")}`
    );
  }

  if (background.length > 0) {
    sections.push(
      `BACKGROUND LIFE - texture that makes the world feel inhabited. Use freely, never give them arcs:\n${background
        .map(describeEntity)
        .join("\n")}`
    );
  }

  return `==================================================
WORLD FACTS - ESTABLISHED AND PERSISTENT
==================================================
${sections.join("\n\n")}

HOW TO USE THE WORLD:
- A place keeps its identity. When a scene happens somewhere listed above, set 'continuityState.placeId' to that id and keep its fixed features true. Never re-describe a place with different furniture, layout or surroundings.
- Ownership, home location and who cares for what are FACTS. An animal does not change households, and a belonging does not migrate without someone moving it on screen.
- An animal's speech mode is fixed for the whole film. One that does not speak never speaks; one that does never falls silent.
- RECURRING entities must not appear and vanish arbitrarily. If one is normally somewhere, that is where it is unless the story moves it.
- BACKGROUND life exists to make the world feel lived-in. Use it for atmosphere and never give it a storyline.
- NONE of the entities above are story characters. They have no dramatic arc and must not take over scenes from the cast.
- You may introduce a NEW place or entity when the story genuinely needs one. Once introduced it becomes a fact on the same terms and must stay consistent afterwards.
==================================================`;
}

/** Counts for the generation log. */
export function summariseWorldRegistry(registry: WorldRegistry): string {
  const animals = registry.entities.filter((e) => e.kind === "animal").length;
  const recurring = registry.entities.filter((e) => e.tier === "RECURRING").length;
  return (
    `${registry.places.length} place(s), ${registry.entities.length} entit(ies) ` +
    `(${recurring} recurring, ${animals} animal(s))`
  );
}

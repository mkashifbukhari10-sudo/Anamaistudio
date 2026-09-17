import type {
  CharacterSocial,
  Household,
  RelationshipDelta,
  SocialBond,
  SocialGraph,
  SocialStateEntry,
} from "../../types.js";

/**
 * THE SOCIAL LAYER — immutable facts about who people are to each other.
 *
 * Three kinds of information live in this application and must not be confused:
 *
 *   FACTS   — A is B's father; B and C are classmates; A, B and D share a home.
 *             Established once at blueprint time, injected verbatim into every
 *             scene batch, never rewritten. THIS MODULE.
 *   STATE   — how close they are today, whether a promise still stands.
 *             Changes over the story. Phase 3.
 *   PHYSICS — where someone is standing, what they are holding, the light.
 *             Changes every scene. Already owned by the Continuity Director.
 *
 * A bond is a LABEL, not a personality template. "father" says who someone IS
 * to another; it says nothing about how they behave. Behaviour continues to
 * come from personality, want, need, flaw, strength, life stage, current
 * emotion, responsibilities, relationship history and the situation at hand.
 * Nothing in this file encodes temperament, and nothing should.
 *
 * Nothing here names a character, a family, a place or a culture. Every label,
 * household and life stage is invented per story by the Story Director.
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

/** Case- and space-insensitive identity, so "Nanhi" and "nanhi " are one person. */
function key(name: string): string {
  return clean(name).toLowerCase().replace(/\s+/g, " ");
}

function bondKey(bond: SocialBond): string {
  return `${key(bond.from)}->${key(bond.to)}`;
}

function normalizeAuthority(raw: unknown): SocialBond["authority"] | undefined {
  const value = clean(raw).toLowerCase().replace(/[\s_]+/g, "-");
  if (value === "cares-for" || value === "peer" || value === "defers-to") return value;
  return undefined;
}

/** The mirror of a care direction, so a reciprocal bond stays consistent. */
function mirrorAuthority(authority: SocialBond["authority"]): SocialBond["authority"] {
  if (authority === "cares-for") return "defers-to";
  if (authority === "defers-to") return "cares-for";
  return authority;
}

// ---------------------------------------------------------------------------
// RECIPROCITY
//
// The core guarantee. If the blueprint says A is B's father, then B is A's
// child - and BOTH directions must exist as data, because a scene batch that
// only ever sees one direction is exactly where a parent quietly becomes a
// friend forty scenes later.
//
// The reciprocal LABEL comes from the model's own `inverse` field rather than a
// kinship table, because a hardcoded table would bake in one language and one
// culture's family structure. This module enforces that the pair EXISTS and
// agrees; it never decides what "father" reciprocates to.
// ---------------------------------------------------------------------------

export interface ReciprocityFix {
  from: string;
  to: string;
  reason: string;
}

/**
 * Normalise bonds, drop the malformed, and complete every missing reciprocal.
 *
 * Returns the repaired list plus a record of what was added or corrected, so
 * the repairs are visible in the log rather than silent.
 */
export function enforceReciprocity(rawBonds: unknown): {
  bonds: SocialBond[];
  fixes: ReciprocityFix[];
} {
  const fixes: ReciprocityFix[] = [];
  const input: SocialBond[] = Array.isArray(rawBonds)
    ? rawBonds
        .map((b: any) => ({
          from: clean(b?.from),
          to: clean(b?.to),
          type: clean(b?.type),
          inverse: clean(b?.inverse),
          authority: normalizeAuthority(b?.authority),
          sharedHistory: clean(b?.sharedHistory) || undefined,
        }))
        .filter((b) => b.from && b.to && b.type && key(b.from) !== key(b.to))
    : [];

  const byKey = new Map<string, SocialBond>();
  for (const bond of input) {
    // First declaration of a pair wins. A later contradiction is a drift
    // signal, not a correction, and Phase 5 reports it.
    if (!byKey.has(bondKey(bond))) byKey.set(bondKey(bond), bond);
  }

  for (const bond of [...byKey.values()]) {
    const reverseKey = `${key(bond.to)}->${key(bond.from)}`;
    const existing = byKey.get(reverseKey);

    if (!existing) {
      // The model gave one direction only. Complete the pair from its own
      // stated inverse, falling back to the forward label for symmetric bonds
      // ("classmate", "neighbour") where inverse and type are the same word.
      const reciprocalType = bond.inverse || bond.type;
      byKey.set(reverseKey, {
        from: bond.to,
        to: bond.from,
        type: reciprocalType,
        inverse: bond.type,
        authority: mirrorAuthority(bond.authority),
        sharedHistory: bond.sharedHistory,
      });
      fixes.push({
        from: bond.to,
        to: bond.from,
        reason: `added missing reciprocal of "${bond.from} is ${bond.to}'s ${bond.type}" as "${reciprocalType}"`,
      });
      continue;
    }

    // The pair exists but disagrees about what it reciprocates to. The forward
    // bond is authoritative; the reverse is aligned to it.
    if (bond.inverse && key(existing.type) !== key(bond.inverse)) {
      fixes.push({
        from: existing.from,
        to: existing.to,
        reason: `reciprocal said "${existing.type}" but "${bond.from} is ${bond.to}'s ${bond.type}" implies "${bond.inverse}" - aligned to the forward bond`,
      });
      existing.type = bond.inverse;
      existing.inverse = bond.type;
    }

    if (!existing.authority && bond.authority) {
      existing.authority = mirrorAuthority(bond.authority);
    }
  }

  return { bonds: [...byKey.values()], fixes };
}

// ---------------------------------------------------------------------------
// GRAPH ASSEMBLY
// ---------------------------------------------------------------------------

function normalizeHouseholds(raw: unknown): Household[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h: any, index: number) => ({
      id: clean(h?.id) || `household_${index + 1}`,
      name: clean(h?.name) || `household ${index + 1}`,
      memberIds: cleanList(h?.memberIds ?? h?.members),
      dwellingPlaceId: clean(h?.dwellingPlaceId) || undefined,
    }))
    .filter((h) => h.memberIds.length > 0);
}

function normalizeCharacterSocial(raw: unknown): CharacterSocial[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c: any) => ({
      characterId: clean(c?.characterId ?? c?.name),
      lifeStage: clean(c?.lifeStage) || undefined,
      householdId: clean(c?.householdId) || undefined,
      responsibilities: cleanList(c?.responsibilities),
    }))
    .filter((c) => Boolean(c.characterId));
}

/** Build the immutable social layer from raw blueprint output. */
export function buildSocialGraph(raw: any): SocialGraph {
  const { bonds, fixes } = enforceReciprocity(raw?.bonds);

  if (fixes.length > 0) {
    console.log(
      `[Social] Completed ${fixes.length} relationship fact(s): ` +
        fixes.map((f) => `${f.from}->${f.to}`).join(", ")
    );
  }

  return {
    bonds,
    households: normalizeHouseholds(raw?.households),
    characterSocial: normalizeCharacterSocial(raw?.characterSocial),
  };
}

/** True when the graph carries nothing worth injecting. */
export function isEmptyGraph(graph: SocialGraph | undefined | null): boolean {
  if (!graph) return true;
  return (
    graph.bonds.length === 0 &&
    graph.households.length === 0 &&
    graph.characterSocial.length === 0
  );
}

// ---------------------------------------------------------------------------
// PROMPT ASSEMBLY
// ---------------------------------------------------------------------------

/** Every bond involving a given character, for the dialogue-register block. */
function bondsFor(graph: SocialGraph, name: string): SocialBond[] {
  return graph.bonds.filter((b) => key(b.from) === key(name));
}

/**
 * The social facts, stated as facts.
 *
 * Injected verbatim into every scene batch. Identical text every time is the
 * point: a batch that sees the same authoritative list cannot reinterpret a
 * parent as a friend.
 */
export function buildSocialFactsBlock(graph: SocialGraph): string {
  if (isEmptyGraph(graph)) return "";

  const sections: string[] = [];

  if (graph.households.length > 0) {
    sections.push(
      `HOUSEHOLDS - who lives together:\n` +
        graph.households
          .map((h) => `  - ${h.name}: ${h.memberIds.join(", ")}`)
          .join("\n")
    );
  }

  if (graph.bonds.length > 0) {
    // Only the forward direction of each pair is printed, with the reciprocal
    // in brackets - the full symmetric list would double the tokens and read
    // as repetition rather than as fact.
    const printed = new Set<string>();
    const lines: string[] = [];

    for (const bond of graph.bonds) {
      const pair = [key(bond.from), key(bond.to)].sort().join("|");
      if (printed.has(pair)) continue;
      printed.add(pair);

      const care =
        bond.authority === "cares-for"
          ? `  [${bond.from} is responsible for ${bond.to}]`
          : bond.authority === "defers-to"
          ? `  [${bond.to} is responsible for ${bond.from}]`
          : "";
      const history = bond.sharedHistory ? `  (shared history: ${bond.sharedHistory})` : "";

      lines.push(
        `  - ${bond.from} is ${bond.to}'s ${bond.type}; ${bond.to} is ${bond.from}'s ${bond.inverse || bond.type}.${care}${history}`
      );
    }

    sections.push(`RELATIONSHIPS - directional and permanent:\n${lines.join("\n")}`);
  }

  const withStage = graph.characterSocial.filter((c) => c.lifeStage);
  if (withStage.length > 0) {
    sections.push(
      `LIFE STAGES:\n` + withStage.map((c) => `  - ${c.characterId}: ${c.lifeStage}`).join("\n")
    );
  }

  const withDuties = graph.characterSocial.filter((c) => (c.responsibilities ?? []).length > 0);
  if (withDuties.length > 0) {
    sections.push(
      `RESPONSIBILITIES - what each one is counted on for:\n` +
        withDuties.map((c) => `  - ${c.characterId}: ${c.responsibilities!.join("; ")}`).join("\n")
    );
  }

  return `==================================================
SOCIAL FACTS - ESTABLISHED AND IMMUTABLE
==================================================
${sections.join("\n\n")}

HOW TO USE THESE FACTS:
- They are FIXED. Never change, soften, re-label or reinterpret a relationship. A parent does not become a friend, a teacher does not become a sibling, a household does not quietly gain or lose members.
- A relationship label is a FACT, NOT A PERSONALITY TEMPLATE. It records WHO someone is to another, never HOW they behave. Do not make a father strict, a mother nurturing, an elder wise, a teacher stern or a child naive because of the label.
- Behaviour comes from the character's own personality, want, need, flaw, strength, life stage, current emotion, responsibilities, history with the other person, and the situation in this scene - exactly as it would if no label existed.
- Two characters with the same relationship label in two different stories should behave completely differently.
- Life stage informs capability and concern, not temperament: what someone can reach, carry, understand or is trusted with. It does not make anyone childish or wise by default.
==================================================`;
}

/**
 * How speech shifts by who is being addressed.
 *
 * Deliberately gives no phrases, honorifics or templates: those would be a
 * cultural and linguistic hardcode. It states the principle and the inputs, and
 * the Story Director invents the register per pair, per story, per language.
 */
export function buildDialogueRegisterBlock(graph: SocialGraph, presentCharacters?: string[]): string {
  if (isEmptyGraph(graph) || graph.bonds.length === 0) return "";

  const names =
    presentCharacters && presentCharacters.length > 0
      ? presentCharacters
      : [...new Set(graph.bonds.map((b) => b.from))];

  const pairs: string[] = [];
  for (const name of names) {
    for (const bond of bondsFor(graph, name)) {
      if (presentCharacters && !presentCharacters.some((p) => key(p) === key(bond.to))) continue;
      pairs.push(`  - ${bond.from} speaking to ${bond.to} (their ${bond.type})`);
    }
  }

  if (pairs.length === 0) return "";

  return `RELATIONSHIP-AWARE DIALOGUE:
- A character does NOT speak the same way to everyone. The same child sounds different addressing a parent, a sibling, a friend and a teacher - in word choice, sentence length, directness, how much they explain, what they leave unsaid, and what they dare to ask.
- Pairs speaking in this batch:
${pairs.join("\n")}
- Derive each register from: the bond, who is responsible for whom, both life stages, their shared history, the speaker's own voice rule, and their state in THIS scene. Invent it for this story.
- Do NOT use stock phrases, fixed honorifics, or a template for "how children address parents". Whatever register you invent must fit this language and this story, and must stay consistent once established.
- The speaker's individual voice rule still applies underneath. Register modulates it; it does not replace it.`;
}

/** Compact fact list for the Character Bible stage. */
export function buildSocialContextForBible(graph: SocialGraph): string {
  if (isEmptyGraph(graph)) return "";

  const lines: string[] = [];
  const printed = new Set<string>();

  for (const bond of graph.bonds) {
    const pair = [key(bond.from), key(bond.to)].sort().join("|");
    if (printed.has(pair)) continue;
    printed.add(pair);
    lines.push(`- ${bond.from} is ${bond.to}'s ${bond.type}`);
  }

  for (const c of graph.characterSocial) {
    const bits = [c.lifeStage ? `life stage: ${c.lifeStage}` : "", (c.responsibilities ?? []).length > 0 ? `responsible for: ${c.responsibilities!.join("; ")}` : ""]
      .filter(Boolean)
      .join(" | ");
    if (bits) lines.push(`- ${c.characterId} — ${bits}`);
  }

  if (lines.length === 0) return "";

  return `ESTABLISHED SOCIAL FACTS (design each character consistently with these, but do NOT let a relationship label dictate personality):\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// SOCIAL STATE — the CHANGE layer
//
// Everything above this line is FACT: who people are to each other, fixed for
// the whole film. Everything below is STATE: how they stand with each other
// right now, which moves as the story moves.
//
// The separation is structural, not merely a convention. Deltas are stored in
// their own list and folded into their own view; no function here writes to a
// SocialGraph. Scene generation therefore CANNOT rewrite a relationship fact,
// however it fills its output - the worst it can do is record a state change
// nobody asked for, which is visible and harmless.
//
// Long stories fold rather than accumulate: only the LATEST value per
// pair-and-dimension is carried forward, so a 60-scene film injects a short
// current-state list instead of a growing history.
// ---------------------------------------------------------------------------

/** Order-insensitive identity for a pair, so A-B and B-A are one relationship. */
function pairKey(a: string, b: string): string {
  return [key(a), key(b)].sort().join("|");
}

/** Read scene-emitted social changes into typed deltas, dropping the malformed. */
export function normalizeSocialDeltas(scenes: any[]): RelationshipDelta[] {
  if (!Array.isArray(scenes)) return [];

  const deltas: RelationshipDelta[] = [];

  for (const scene of scenes) {
    const sceneNumber = Number(scene?.sceneNumber) || 0;
    const raw = Array.isArray(scene?.socialChanges) ? scene.socialChanges : [];

    for (const entry of raw) {
      const a = clean(entry?.characterA);
      const b = clean(entry?.characterB);
      const dimension = clean(entry?.dimension);
      const change = clean(entry?.change);
      if (!a || !b || !dimension || !change || key(a) === key(b)) continue;
      deltas.push({ sceneNumber, between: [a, b], dimension, change });
    }
  }

  return deltas.sort((x, y) => x.sceneNumber - y.sceneNumber);
}

/**
 * Fold a delta history into current state.
 *
 * Latest wins per pair-and-dimension. A story that only ever tracks "trust"
 * between two characters carries exactly one line, no matter how many scenes
 * touched it.
 */
export function foldSocialDeltas(deltas: RelationshipDelta[]): SocialStateEntry[] {
  const latest = new Map<string, SocialStateEntry>();

  for (const delta of [...deltas].sort((a, b) => a.sceneNumber - b.sceneNumber)) {
    const id = `${pairKey(delta.between[0], delta.between[1])}::${key(delta.dimension)}`;
    latest.set(id, {
      between: delta.between,
      dimension: delta.dimension,
      current: delta.change,
      sinceScene: delta.sceneNumber,
    });
  }

  return [...latest.values()].sort((a, b) => b.sinceScene - a.sinceScene);
}

/**
 * Current social state as a prompt block.
 *
 * Deliberately says nothing about who anyone IS - that is the facts block's
 * job, and repeating it here would invite the model to treat a relationship
 * as negotiable.
 */
export function buildSocialStateBlock(state: SocialStateEntry[]): string {
  if (!state || state.length === 0) return "";

  const lines = state.map(
    (s) => `  - ${s.between[0]} and ${s.between[1]} — ${s.dimension}: ${s.current} (since scene ${s.sinceScene})`
  );

  return `WHERE RELATIONSHIPS STAND NOW (state, not facts - carry it forward):
${lines.join("\n")}
- This is how these characters currently stand with each other. Play the scene from here; do not reset to how they began.
- These are FEELINGS AND SITUATIONS between people, never their relationship. Who someone is to another never changes.`;
}

/** Counts for the generation log. */
export function summariseSocialGraph(graph: SocialGraph): string {
  const pairs = new Set(graph.bonds.map((b) => [key(b.from), key(b.to)].sort().join("|")));
  return `${pairs.size} relationship(s), ${graph.households.length} household(s), ${graph.characterSocial.length} character profile(s)`;
}

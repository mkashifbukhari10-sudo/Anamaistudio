/**
 * Character field normalisation across the pack rename.
 *
 * The schema sent to the model used to name two fields `veggieType` and
 * `veggieFeatures`. Those names are wrong for any pack that is not vegetables,
 * and not harmlessly wrong: this codebase has already watched a model copy its
 * own schema notation into generated output (`"<Gulgul>: ..."` shipped in
 * fifteen prompts), so a field literally called `veggieType` is a standing
 * invitation to put a vegetable in a film about hens.
 *
 * The model therefore receives the neutral names `characterType` and
 * `characterFeatures`.
 *
 * The CLIENT, however, reads `veggieType` in about fifteen places across seven
 * components, and a miss there shows up as a blank Character Bible field
 * rather than as a failing test. So nothing is renamed on the way out: every
 * character leaves this function carrying BOTH spellings of both fields, with
 * whichever one the model filled copied across. The client needs no change,
 * and new code can use the neutral names.
 *
 * Remove the legacy half only once no reader of `veggieType` remains.
 */

/** A character object carrying both the neutral and the legacy field names. */
export function normalizePackCharacter<T extends Record<string, any>>(char: T): T {
  if (!char || typeof char !== "object") return char;

  const type = char.characterType ?? char.veggieType ?? "";
  const features = char.characterFeatures ?? char.veggieFeatures ?? "";

  return {
    ...char,
    characterType: type,
    veggieType: type,
    characterFeatures: features,
    veggieFeatures: features,
  };
}

/** The same, for a whole cast. Non-array input yields an empty cast. */
export function normalizePackCast(cast: unknown): any[] {
  if (!Array.isArray(cast)) return [];
  return cast.map((c) => normalizePackCharacter(c));
}

/**
 * The type a character declares, under either spelling.
 *
 * Used where only the value is wanted and rewriting the object would be
 * wasteful — id derivation, log lines, prompt interpolation.
 */
export function characterTypeOf(char: any): string {
  return String(char?.characterType ?? char?.veggieType ?? "").trim();
}

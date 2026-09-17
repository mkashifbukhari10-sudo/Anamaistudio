/**
 * OPTIONAL recurring-series mode.
 *
 * Off unless a caller explicitly supplies a bible. There is no default series,
 * no built-in cast and no exported instance of this type anywhere in the app —
 * the normal generation path never touches this module, and story generation
 * behaves identically whether or not this file exists.
 *
 * It exists so that a future "series" feature (a user building their own show
 * with a standing cast across episodes) has somewhere to plug in. Everything
 * here is supplied BY THE CALLER, per series. Nothing is hardcoded.
 *
 * To use it later: build a RecurringSeriesBible from user-authored data and
 * pass it as `seriesBible` on the blueprint context. Absent that, generation is
 * fully dynamic.
 */

export interface RecurringCharacter {
  name: string;
  /** Character type/species/archetype — whatever the series uses. */
  characterType?: string;
  /** Dramatic function in the ensemble. */
  role?: string;
  /**
   * Mechanical speech constraint, e.g. "answers a question with a question".
   * Authored per series; never defaulted.
   */
  voiceRule?: string;
  /** Permanent visual description, so reference images stay stable. */
  lockedVisualDescription?: string;
  [key: string]: unknown;
}

export interface RecurringSeriesBible {
  title: string;
  logline?: string;
  audience?: string;
  /** The series' fixed worldview, if it has one. */
  belief?: string;
  worldRules?: string[];
  recurringCast?: RecurringCharacter[];
  /** Recurring episode shapes this series uses. */
  formats?: Array<{ name: string; shape: string }>;
  /** Series-specific prohibitions. */
  never?: string[];
  /** A worked excerpt the model should imitate for tone and quality. */
  goldStandard?: string;
  /** Guest characters allowed on top of the recurring cast. Undefined = unlimited. */
  maxGuestCharacters?: number;
}

/**
 * Render a caller-supplied bible as a prompt block.
 *
 * Only the sections the caller actually filled in are emitted, so a thin bible
 * constrains the model lightly and a detailed one constrains it tightly. That
 * is the caller's choice to make, not this module's.
 */
export function buildRecurringSeriesBlock(bible: RecurringSeriesBible): string {
  const sections: string[] = [];

  sections.push(`SERIES: "${bible.title}" — this episode belongs to an existing series.`);
  if (bible.logline) sections.push(`Logline: ${bible.logline}`);
  if (bible.audience) sections.push(`Audience: ${bible.audience}`);
  if (bible.belief) {
    sections.push(
      `WHAT THIS SERIES BELIEVES: ${bible.belief}\nEvery episode must be arguable as an expression of that line.`
    );
  }

  if (bible.worldRules?.length) {
    sections.push(`THE WORLD (fixed):\n${bible.worldRules.map((r) => `- ${r}`).join("\n")}`);
  }

  if (bible.recurringCast?.length) {
    const cast = bible.recurringCast
      .map((c) => {
        const lines = [`  ${c.name}${c.characterType ? ` (${c.characterType})` : ""}`];
        if (c.role) lines.push(`      Role: ${c.role}`);
        if (c.voiceRule) lines.push(`      VOICE RULE (obey exactly): ${c.voiceRule}`);
        return lines.join("\n");
      })
      .join("\n\n");

    const guestRule =
      typeof bible.maxGuestCharacters === "number"
        ? `You may add at most ${bible.maxGuestCharacters} guest character(s) for this episode only.`
        : `You may add guest characters for this episode as the story requires.`;

    sections.push(
      `RECURRING CAST — these appear in every episode with these exact names and voices:\n\n${cast}\n\n${guestRule}`
    );
  }

  if (bible.formats?.length) {
    sections.push(
      `EPISODE FORMATS — pick the one that fits, or blend:\n${bible.formats
        .map((f) => `- ${f.name}: ${f.shape}`)
        .join("\n")}`
    );
  }

  if (bible.never?.length) {
    sections.push(`NEVER (series rules):\n${bible.never.map((r) => `- ${r}`).join("\n")}`);
  }

  if (bible.goldStandard) {
    sections.push(
      `GOLD STANDARD — match this quality, voice and ending discipline:\n${bible.goldStandard}`
    );
  }

  return `==================================================
RECURRING SERIES BIBLE (FIXED FOR THIS SERIES)
==================================================
${sections.join("\n\n--------------------------------------------------\n")}
==================================================`;
}

/**
 * The recurring cast in the shape the character pipeline expects, so a series'
 * standing characters keep their locked visual descriptions across episodes.
 */
export function recurringCastAsLockedCharacters(bible: RecurringSeriesBible): any[] {
  return (bible.recurringCast ?? []).map((c) => ({
    ...c,
    name: c.name,
    veggieType: c.characterType,
    role: c.role,
    personality: c.voiceRule,
    speakingStyle: c.voiceRule,
    lockedVisualDescription: c.lockedVisualDescription,
    isLocked: true,
  }));
}

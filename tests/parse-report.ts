import fs from "fs";

/**
 * Parse a saved AnamStudio test report back into scene objects.
 *
 * Lets the P0 metrics run against REAL generated stories with no API call —
 * the saved Markdown in `test-output/` is the only machine-readable record of
 * a generation once it has finished, and calibrating a repetition detector
 * against synthetic fixtures alone would be calibrating against my own
 * assumptions about what repetition looks like.
 *
 * Development tooling. Best-effort and lossy by design: it recovers the fields
 * the distinctiveness and feasibility engines read, and silently skips anything
 * the report did not print.
 */

export interface ParsedReport {
  title: string;
  language: string;
  storyMode: string;
  duration: string;
  sceneCount: number;
  scenes: any[];
  characters: any[];
  setups: any[];
}

function section(md: string, heading: string): string {
  const start = md.indexOf(`\n## ${heading}`);
  if (start < 0) return "";
  const after = md.indexOf("\n## ", start + 4);
  return md.slice(start, after < 0 ? undefined : after);
}

function headerValue(md: string, label: string): string {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n·]+)`);
  const m = md.match(re);
  return m ? m[1].trim() : "";
}

/** Pull a `**Label:** value` line out of one scene block. */
function field(block: string, label: string): string {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\n\\*\\*|\\n\\n---|$)`);
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

/** The first fenced block of a given language after a label. */
function fencedAfter(block: string, label: string, lang: string): string {
  const idx = block.indexOf(`**${label}:**`);
  if (idx < 0) return "";
  const fence = block.indexOf("```" + lang, idx);
  if (fence < 0) return "";
  const start = fence + 3 + lang.length;
  const end = block.indexOf("```", start);
  return end < 0 ? "" : block.slice(start, end).trim();
}

function parseDialogue(block: string): Array<{ speaker: string; line: string }> {
  const idx = block.indexOf("**Dialogue:**");
  if (idx < 0) return [];
  const rest = block.slice(idx);
  const stop = rest.indexOf("\n\n**Start state:**");
  const chunk = stop < 0 ? rest : rest.slice(0, stop);

  const turns: Array<{ speaker: string; line: string }> = [];
  const re = /^- \*\*(.+?):\*\*\s*"([\s\S]*?)"\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) {
    turns.push({ speaker: m[1].trim(), line: m[2].trim() });
  }
  return turns;
}

export function parseReport(path: string): ParsedReport {
  const md = fs.readFileSync(path, "utf8");

  const title = (md.match(/^# AnamStudio test report — (.+)$/m) || [, ""])[1].trim();
  const durationLine = md.match(/- \*\*Duration:\*\* (.+)$/m)?.[1] ?? "";
  const language = (durationLine.match(/\*\*Language:\*\* ([^·]+)/) || [, ""])[1].trim();
  const storyMode = (durationLine.match(/\*\*Mode:\*\* ([^·]+)/) || [, ""])[1].trim();
  const duration = durationLine.split("·")[0].trim();

  // Character bible and setups are printed as JSON fences.
  let characters: any[] = [];
  const bible = section(md, "Character bible");
  const bibleFence = bible.match(/```json\n([\s\S]*?)```/);
  if (bibleFence) {
    try {
      characters = JSON.parse(bibleFence[1]);
    } catch {
      characters = [];
    }
  }

  let setups: any[] = [];
  const blueprint = section(md, "Narrative blueprint");
  const bpFence = blueprint.match(/```json\n([\s\S]*?)```/);
  if (bpFence) {
    try {
      setups = JSON.parse(bpFence[1])?.setups ?? [];
    } catch {
      setups = [];
    }
  }

  // Scenes.
  const scenesSection = section(md, "Scenes");
  const blocks = scenesSection.split(/\n### Scene /).slice(1);

  const scenes = blocks.map((raw) => {
    const block = `### Scene ${raw}`;
    const headerMatch = block.match(/^### Scene (\d+) — ([^\[]*)\[([A-Z]+)\]/);
    const sceneNumber = headerMatch ? Number(headerMatch[1]) : 0;

    let continuityState: any = {};
    const csFence = fencedAfter(block, "continuityState (final frame)", "json");
    if (csFence) {
      try {
        continuityState = JSON.parse(csFence);
      } catch {
        continuityState = {};
      }
    }

    const placeLine = block.match(/\*\*placeId:\*\* `([^`]*)`/);

    return {
      sceneNumber,
      timeRange: headerMatch ? headerMatch[2].trim() : "",
      transitionType: headerMatch ? headerMatch[3] : "CUT",
      purpose: field(block, "Purpose"),
      storyFunction: field(block, "Story function"),
      setupOrPayoff: field(block, "Setup/Payoff"),
      charactersPresent: field(block, "Characters present")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s !== "-"),
      characterActions: field(block, "Action"),
      dialogueTurns: parseDialogue(block),
      startState: field(block, "Start state"),
      endState: field(block, "End state"),
      nextSceneHandoff: field(block, "Next handoff"),
      finalVideoPrompt: fencedAfter(block, "Flow/Veo prompt", "text"),
      continuityState: {
        ...continuityState,
        placeId: continuityState?.placeId || placeLine?.[1] || "",
      },
      // The saved report does not print cameraShot / cameraMovement as their
      // own fields; whatever cameraState survived in continuityState is used.
      cameraShot: continuityState?.cameraState?.shotSize ?? "",
      cameraMovement: continuityState?.cameraState?.movement ?? "",
      facialExpressions: "",
    };
  });

  return {
    title,
    language: language || "Roman Urdu",
    storyMode,
    duration,
    sceneCount: scenes.length,
    scenes,
    characters,
    setups,
  };
}

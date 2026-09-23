#!/usr/bin/env node
/**
 * Stamps the ANAMSTUDIO mark onto Flow/Veo clips.
 *
 * WHY THIS IS A POST STEP, NOT A PROMPT INSTRUCTION
 *
 * Veo cannot hold text steady. A finished film in this project rendered a money
 * bag reading "5,00,0000 / پانچ لاکھ" and, half a second later across one clip
 * boundary, "5,00,00,000 / پورچ کرٹس"; an Urdu banner became meaningless
 * Devanagari. Two letters asked for in 36 separate generations would come back
 * as 36 different logos, in 36 positions.
 *
 * VIDEO_NEGATIVE_PROMPT also suppresses "text overlay, watermark, logo" on
 * purpose, so asking for one in the positive prompt would fight the pipeline.
 *
 * Composited afterwards the mark is pixel-identical in every frame, exactly
 * placed, and free.
 *
 * USAGE
 *   node scripts/brand-clips.mjs <folder>            stamp every clip in place
 *   node scripts/brand-clips.mjs <folder> --out DIR  write to DIR instead
 *   node scripts/brand-clips.mjs <file.mp4>          stamp one clip
 *   node scripts/brand-clips.mjs <folder> --dry-run  print commands, run nothing
 *
 * OPTIONS
 *   --opacity N   0-1, default 0.45
 *   --size N      mark height as a fraction of clip height, default 0.055
 *   --inset N     margin from the corner as a fraction of height, default 0.04
 *   --text S      what the mark says, default "KAHANI NAGAR"
 *
 * REQUIRES ffmpeg on PATH:  winget install ffmpeg
 */
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join, resolve, extname, basename, dirname } from "node:path";

const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".mkv"]);

/** Bold fonts that ship with Windows, in order of preference. */
const FONT_CANDIDATES = [
  "C:/Windows/Fonts/segoeuib.ttf",
  "C:/Windows/Fonts/arialbd.ttf",
  "C:/Windows/Fonts/seguisb.ttf",
];

/**
 * What the mark SAYS.
 *
 * This used to be the two letters "AS", which looked tidy and was useless. A
 * watermark has exactly one job the moment a clip is re-shared away from the
 * page that made it: tell whoever is now watching where to find more. "AS"
 * tells them nothing and is unsearchable, so every re-share was a dead end -
 * and on a platform where re-sharing is the whole distribution mechanism, that
 * is the single most expensive thing a two-character mark can cost you.
 *
 * It is the PAGE name, not the studio name, because the page is the thing a
 * viewer can actually go and follow.
 */
const DEFAULT_MARK = "KAHANI NAGAR";

/**
 * A wordmark needs far less height than a monogram.
 *
 * 5.5% of frame height is right for two letters and absurd for twelve - it
 * would run a third of the way across the picture. Scaled by length so the
 * default is sensible whatever the mark says; --size still overrides.
 */
function defaultSizeFor(text) {
  return text.trim().length <= 3 ? 0.055 : 0.03;
}

function parseArgs(argv) {
  const opts = { opacity: 0.45, size: null, inset: 0.04, dryRun: false, out: null, text: DEFAULT_MARK };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--opacity") opts.opacity = Number(argv[++i]);
    else if (a === "--size") opts.size = Number(argv[++i]);
    else if (a === "--inset") opts.inset = Number(argv[++i]);
    else if (a === "--text") opts.text = String(argv[++i] ?? "");
    else rest.push(a);
  }
  if (opts.size === null) opts.size = defaultSizeFor(opts.text);
  return { opts, target: rest[0] };
}

function haveFfmpeg() {
  const probe = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  return probe.status === 0;
}

function pickFont() {
  return FONT_CANDIDATES.find((f) => existsSync(f)) || null;
}

/**
 * ffmpeg's filter parser treats ':' as an argument separator, so a Windows
 * font path has to be escaped as 'C\:/Windows/...' - the single most common
 * reason drawtext silently fails on Windows.
 */
function escapeFontPath(p) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/**
 * drawtext treats ':' and '\' as syntax and "'" ends the text argument, so a
 * mark carrying any of them silently truncates or fails the whole filter.
 */
function escapeDrawText(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "");
}

function buildFilter({ opacity, size, inset, text }, fontPath) {
  const font = escapeFontPath(fontPath);
  return [
    `drawtext=fontfile='${font}'`,
    `text='${escapeDrawText(text)}'`,
    `fontcolor=white@${opacity}`,
    `fontsize=h*${size}`,
    // Top-left, inset from BOTH edges by the same fraction of height so the
    // margin looks equal regardless of aspect ratio.
    `x=h*${inset}`,
    `y=h*${inset}`,
  ].join(":");
}

function collectClips(target) {
  const full = resolve(target);
  if (!existsSync(full)) {
    console.error(`Not found: ${full}`);
    process.exit(1);
  }
  if (statSync(full).isFile()) return [full];

  return readdirSync(full)
    .filter((f) => VIDEO_EXT.has(extname(f).toLowerCase()))
    .filter((f) => !f.includes("-branded"))
    .map((f) => join(full, f))
    .sort();
}

const { opts, target } = parseArgs(process.argv.slice(2));

if (!target) {
  console.error("Usage: node scripts/brand-clips.mjs <folder|file> [--out DIR] [--dry-run]");
  process.exit(1);
}

if (!opts.dryRun && !haveFfmpeg()) {
  console.error("ffmpeg is not on PATH.\n  Install it once with:  winget install ffmpeg");
  console.error("  Then reopen the terminal and run this again.");
  process.exit(1);
}

const font = pickFont();
if (!font) {
  console.error(`No bold font found. Looked for:\n  ${FONT_CANDIDATES.join("\n  ")}`);
  process.exit(1);
}

const clips = collectClips(target);
if (clips.length === 0) {
  console.error(`No video files in ${resolve(target)}`);
  process.exit(1);
}

const filter = buildFilter(opts, font);
const outDir = opts.out ? resolve(opts.out) : null;
if (outDir && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });

console.log(`Brand mark "${opts.text}" — ${clips.length} clip(s)`);
console.log(`  opacity ${opts.opacity} · height ${opts.size * 100}% · inset ${opts.inset * 100}% · top-left`);
console.log(`  font ${font}\n`);

let done = 0;
let failed = 0;

for (const clip of clips) {
  const name = basename(clip, extname(clip));
  const dest = outDir
    ? join(outDir, `${name}${extname(clip)}`)
    : join(dirname(clip), `${name}-branded${extname(clip)}`);

  const args = [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", clip,
    "-vf", filter,
    // Audio is copied, never re-encoded: the dialogue is the whole point of
    // these clips and must not lose a generation of quality to a watermark.
    "-c:a", "copy",
    "-c:v", "libx264", "-crf", "18", "-preset", "medium",
    dest,
  ];

  if (opts.dryRun) {
    console.log(`  ffmpeg ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}\n`);
    continue;
  }

  process.stdout.write(`  ${basename(clip)} ... `);
  try {
    execFileSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    console.log("ok");
    done++;
  } catch (err) {
    console.log("FAILED");
    console.error(`    ${String(err.stderr || err.message).trim().split("\n").slice(-2).join("\n    ")}`);
    failed++;
  }
}

if (!opts.dryRun) {
  console.log(`\n${done} stamped${failed ? `, ${failed} failed` : ""}.`);
  console.log(outDir ? `Written to ${outDir}` : `Written alongside the originals as *-branded.mp4`);
}

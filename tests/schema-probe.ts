/**
 * Extracts the scene schema from server.ts for measurement.
 *
 * server.ts builds an Express app at import time, so the schema is re-parsed
 * from source here rather than imported - a measurement script must not start
 * a server as a side effect.
 */
import fs from "fs";
import path from "path";

function extractObjectLiteral(source: string, startMarker: string): any {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`marker not found: ${startMarker}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return { text: source.slice(open, end + 1) };
}

const src = fs.readFileSync(path.resolve(process.cwd(), "server.ts"), "utf8");

const sceneSchema = extractObjectLiteral(src, "const SCENE_PROPERTIES");
const contract = extractObjectLiteral(src, "  contract: {");

// Measured as source text, which is what actually travels in the prompt after
// the schema is described - close enough for a cost decision, and it avoids
// evaluating server.ts.
export const SCENE_SCHEMA_FOR_MEASUREMENT = {
  withContract: sceneSchema.text,
  withoutContract: sceneSchema.text.replace(contract.text, ""),
  contractOnly: contract.text,
};

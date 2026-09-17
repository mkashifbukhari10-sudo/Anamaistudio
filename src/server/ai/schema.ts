/**
 * Schema vocabulary and translation.
 *
 * The application declares response schemas with an OpenAPI-style uppercase
 * type vocabulary ("OBJECT", "STRING", "ARRAY"). That vocabulary originally
 * came from `@google/genai`'s `Type` enum, but it is just a string enum, so it
 * is reproduced here and the dependency is gone. 258 schema declarations across
 * the Story Director keep working untouched.
 *
 * `toJsonSchema` translates that vocabulary into standard JSON Schema for
 * providers that expect it.
 */

/** Schema type vocabulary. Values match the OpenAPI-style names already in use. */
export const Type = {
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT",
} as const;

export type SchemaType = (typeof Type)[keyof typeof Type];

const TYPE_MAP: Record<string, string> = {
  STRING: "string",
  NUMBER: "number",
  INTEGER: "integer",
  BOOLEAN: "boolean",
  ARRAY: "array",
  OBJECT: "object",
};

/**
 * Translate an application schema into standard JSON Schema.
 *
 * Descriptions are preserved: they carry most of the Story Director's
 * instructions ("NEVER write MAIN here", "the exact situation as the shot
 * ends"), and dropping them would quietly remove craft guidance the engine
 * depends on.
 */
export function toJsonSchema(schema: unknown): any {
  if (!schema || typeof schema !== "object") return schema;

  const source = schema as Record<string, any>;
  const out: Record<string, any> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === "type" && typeof value === "string") {
      out.type = TYPE_MAP[value] ?? String(value).toLowerCase();
      continue;
    }

    if (key === "properties" && value && typeof value === "object") {
      out.properties = Object.fromEntries(
        Object.entries(value).map(([name, child]) => [name, toJsonSchema(child)])
      );
      continue;
    }

    if (key === "items") {
      out.items = toJsonSchema(value);
      continue;
    }

    out[key] = value;
  }

  return out;
}

/**
 * Build a compact skeleton showing the SHAPE a schema expects.
 *
 * DeepSeek's JSON-mode documentation asks for an example of the desired format
 * in addition to the word "json". The schema alone describes the contract but
 * not what a reply looks like, so this derives the example mechanically from
 * whatever schema it is handed - no Story Director schema is duplicated by hand.
 *
 * Arrays collapse to a single element: the point is to show structure, not
 * volume, and repeating elements would bloat every prompt.
 */
export function buildSchemaExample(schema: unknown, depth = 0): unknown {
  if (!schema || typeof schema !== "object" || depth > 6) return "<value>";

  const node = schema as Record<string, any>;
  const type = String(node.type ?? "").toUpperCase();

  if (type === "OBJECT") {
    const properties = node.properties ?? {};
    const required: string[] = Array.isArray(node.required) ? node.required : [];
    // Prefer required fields; fall back to the first few so the shape is still
    // legible for objects that declare nothing required.
    const names = required.length > 0 ? required : Object.keys(properties).slice(0, 8);
    const out: Record<string, unknown> = {};
    for (const name of names) {
      if (properties[name]) out[name] = buildSchemaExample(properties[name], depth + 1);
    }
    return out;
  }

  if (type === "ARRAY") return [buildSchemaExample(node.items, depth + 1)];
  if (type === "INTEGER" || type === "NUMBER") return 0;
  if (type === "BOOLEAN") return true;
  return "<string>";
}

/** Keep the example from dominating the prompt on very large schemas. */
const MAX_EXAMPLE_CHARS = 4000;

/**
 * Render a schema as the instruction block a JSON-mode provider needs.
 *
 * DeepSeek accepts `response_format: json_object` but takes no schema argument,
 * so the contract has to travel in the prompt. Three things are required for
 * JSON mode to engage reliably, per DeepSeek's own guide: the literal word
 * "json", an explicit instruction, and an example of the desired format.
 */
export function describeSchemaForPrompt(schema: unknown): string {
  if (!schema) return "";

  let example = "";
  try {
    const rendered = JSON.stringify(buildSchemaExample(schema), null, 1);
    if (rendered && rendered.length <= MAX_EXAMPLE_CHARS) {
      example = `\n\nFor reference, a reply of the required json shape looks like this (values are placeholders):\n\n${rendered}`;
    }
  } catch {
    // An example is a helpful extra, never a precondition. The schema below
    // remains the authoritative contract either way.
  }

  return `You MUST reply with a single valid json object and nothing else.
No prose before or after it, no markdown code fences.
It must conform exactly to this JSON Schema - every "required" field must be present, and every description is an instruction you must follow:

${JSON.stringify(toJsonSchema(schema), null, 1)}${example}`;
}

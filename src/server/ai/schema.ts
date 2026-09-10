import type { AIResponseSchema } from "./types.js";

/**
 * Convert the app's Gemini-style response schemas into standard JSON Schema.
 *
 * The schemas built in server.ts use @google/genai's `Type` enum, which is a
 * plain string enum of OpenAPI type names ("OBJECT", "STRING", "ARRAY", ...).
 * Lowercasing those names is the whole translation, which is why the call
 * sites never had to change.
 */
export function toJsonSchema(schema: AIResponseSchema | undefined): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  return convert(schema) as Record<string, unknown>;
}

function convert(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(convert);
  }
  if (!node || typeof node !== "object") {
    return node;
  }

  const source = node as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === "type" && typeof value === "string") {
      out.type = value.toLowerCase();
      continue;
    }
    if (key === "properties" && value && typeof value === "object") {
      const props: Record<string, unknown> = {};
      for (const [propName, propValue] of Object.entries(value as Record<string, unknown>)) {
        props[propName] = convert(propValue);
      }
      out.properties = props;
      continue;
    }
    out[key] = convert(value);
  }

  return out;
}

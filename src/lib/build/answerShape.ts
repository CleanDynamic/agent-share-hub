// CA-13 Part 7: "Returns a fixed shape", pure. A shape forced on an ordinary model's answer: a JSON schema (Claude's
// `output_config.format`, a strict tool, OpenAI's `response_format`, Gemini's `responseSchema`) or a grammar on a local
// model. It belongs to a prompt or an agent. Nothing here runs anything or calls a provider.

export type ShapeHow = "json-schema" | "strict-tools" | "grammar" | "pattern" | "choices";

export const SHAPE_HOWS: readonly ShapeHow[] = ["json-schema", "strict-tools", "grammar", "pattern", "choices"];
export const SHAPE_HOW_LABEL: Record<ShapeHow, string> = {
  "json-schema": "A JSON schema",
  "strict-tools": "A strict tool",
  grammar: "A grammar",
  pattern: "A pattern",
  choices: "A set of choices",
};

export const SHAPE_TEXT_MAX = 20_000;
export const SHAPE_WHERE_MAX = 40;
/** Where it was constrained: the three APIs the site writes a fragment for, and the local ways, shown as suggestions. */
export const SHAPE_WHERE_SUGGESTIONS: readonly string[] = ["Claude API", "OpenAI", "Gemini", "llama.cpp", "Outlines", "vLLM"];

export interface OutputShape {
  how: ShapeHow;
  where?: string;
  schema?: string;
  sample?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** `payload.output_shape`, read defensively; null for a value with no known `how`. */
export function outputShapeOf(raw: unknown): OutputShape | null {
  if (!isRecord(raw) || !SHAPE_HOWS.includes(raw.how as ShapeHow)) return null;
  const where = typeof raw.where === "string" && raw.where.trim() ? raw.where.trim().slice(0, SHAPE_WHERE_MAX) : undefined;
  const schema = typeof raw.schema === "string" && raw.schema.trim() ? raw.schema.slice(0, SHAPE_TEXT_MAX) : undefined;
  const sample = typeof raw.sample === "string" && raw.sample.trim() ? raw.sample.slice(0, SHAPE_TEXT_MAX) : undefined;
  return { how: raw.how as ShapeHow, ...(where ? { where } : null), ...(schema ? { schema } : null), ...(sample ? { sample } : null) };
}

/** Why a shape cannot be saved, or null. Fixed words only. */
export function shapeRefusal(shape: OutputShape): string | null {
  if (!SHAPE_HOWS.includes(shape.how)) return "Say how the answer was shaped.";
  if ((shape.schema ?? "").length > SHAPE_TEXT_MAX || (shape.sample ?? "").length > SHAPE_TEXT_MAX) return `The schema and the sample are at most ${SHAPE_TEXT_MAX.toLocaleString("en-GB")} characters each.`;
  if ((shape.where ?? "").length > SHAPE_WHERE_MAX) return `Where is at most ${SHAPE_WHERE_MAX} characters.`;
  if ((shape.how === "json-schema" || shape.how === "strict-tools") && !(shape.schema ?? "").trim()) return "This answer shape needs its schema.";
  return null;
}

const parsed = (schema: string | undefined): unknown | undefined => {
  if (!schema) return undefined;
  try {
    return JSON.parse(schema);
  } catch {
    return undefined;
  }
};

/** The schema's `title`, else "JSON". */
export function schemaName(schema: string | undefined): string {
  const value = parsed(schema);
  return isRecord(value) && typeof value.title === "string" && value.title.trim() ? value.title.trim() : "JSON";
}

/** The chip next to the app and model: "Returns JSON · Order". Other ways say their own words. */
export function shapeChip(shape: OutputShape): string {
  if (shape.how === "json-schema" || shape.how === "strict-tools") return `Returns JSON · ${schemaName(shape.schema)}`;
  if (shape.how === "grammar") return "Returns a fixed shape · grammar";
  if (shape.how === "pattern") return "Returns a fixed shape · pattern";
  return "Returns one of a set of choices";
}

/** Which of the three APIs the site writes an exact fragment for. */
export type ShapeApi = "claude" | "openai" | "gemini";

export function apiOf(where: string | undefined): ShapeApi | null {
  const said = (where ?? "").toLowerCase();
  if (/claude|anthropic/.test(said)) return "claude";
  if (/openai|gpt|chatgpt/.test(said)) return "openai";
  if (/gemini|google/.test(said)) return "gemini";
  return null;
}

/**
 * "Copy the setting": the exact request fragment for Claude's `output_config.format` (type "json_schema"), OpenAI's
 * `response_format` (type "json_schema") or Gemini's `responseSchema`; for any other provider, just the schema.
 */
export function shapeFragment(shape: OutputShape): { text: string; exact: boolean } {
  const schema = parsed(shape.schema);
  const api = apiOf(shape.where);
  if (schema === undefined || !(shape.how === "json-schema" || shape.how === "strict-tools") || api === null) return { text: shape.schema ?? "", exact: false };
  const fragment =
    api === "claude"
      ? { output_config: { format: { type: "json_schema", schema } } }
      : api === "openai"
        ? { response_format: { type: "json_schema", json_schema: { name: schemaName(shape.schema).replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 64) || "answer", strict: true, schema } } }
        : { generationConfig: { responseMimeType: "application/json", responseSchema: schema } };
  return { text: JSON.stringify(fragment, null, 2), exact: true };
}

/** Files named like `order.schema.json`, for the schema to be picked from. */
export const schemaFileNames = (names: readonly (string | null | undefined)[]): string[] => names.filter((name): name is string => Boolean(name) && /\.schema\.json$/i.test(name as string));

/** The words a copied step ends with: "Answer in this shape:" and the schema. */
export const SHAPE_COPY_LEAD = "Answer in this shape:";

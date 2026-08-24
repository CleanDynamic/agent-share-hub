// =============================================================================
// NeoScale — generate-build-layers: the model call
// =============================================================================
// PROVIDER-AGNOSTIC BY RESOLUTION, NOT BY ABSTRACTION. Nothing in this
// repository called an LLM before NS-P22 — generate-ai-pdf builds its PDF with
// pdf-lib, and src/lib/llm.ts deliberately keeps keys out of the bundle by
// copying a prompt to the clipboard — so there was no existing secret to
// inherit. Rather than hardcode a provider the deployment may not have, this
// picks whichever key is actually set:
//
//   LOVABLE_API_KEY    -> the Lovable AI gateway (OpenAI-shaped)
//   ANTHROPIC_API_KEY  -> the Anthropic Messages API
//   OPENAI_API_KEY     -> the OpenAI chat completions API
//
// in that order, unless BUILD_LAYERS_PROVIDER names one. BUILD_LAYERS_MODEL
// overrides the model id for whichever provider is chosen. With no key set at
// all the function answers 503 naming the secrets it looked for, which is a
// deployment fact a caller can act on — not a 500.
//
// WHAT IS RECORDED. build_layers.model_used is written as `provider:model`,
// e.g. `anthropic:claude-opus-5`, on every row. A layer whose provenance is
// only "some model, once" is not reviewable, and NS-P23 is a review pass.
//
// JSON ONLY, AND VERIFIED. The request asks for JSON and the reply is parsed
// tolerantly (a code fence is stripped, a preamble is skipped), but nothing
// the model returns is trusted: every step is renumbered, every string is
// clipped, and every node_ref is looked up in the ref map built from the real
// tree. A ref that does not resolve becomes null. That is the whole guarantee
// behind acceptance 6.
// =============================================================================

import type { Layer, Step } from "./types.ts";

export type Provider = "lovable" | "anthropic" | "openai";

export interface ResolvedModel {
  provider: Provider;
  model: string;
  key: string;
  /** What lands in build_layers.model_used. */
  label: string;
}

/** A model call that failed in a way the caller should report, not swallow. */
export class ModelError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "ModelError";
    this.status = status;
  }
}

const DEFAULT_MODELS: Record<Provider, string> = {
  // The gateway a Lovable project provisions for itself. Fast and cheap, which
  // matters when a creator regenerates while editing.
  lovable: "google/gemini-2.5-flash",
  anthropic: "claude-opus-5",
  openai: "gpt-4o-mini",
};

const KEY_NAMES: Record<Provider, string> = {
  lovable: "LOVABLE_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

const ORDER: Provider[] = ["lovable", "anthropic", "openai"];

/** Whichever provider this deployment actually has a key for, or null. */
export function resolveModel(
  env: (name: string) => string | undefined,
): ResolvedModel | null {
  const forced = env("BUILD_LAYERS_PROVIDER")?.trim().toLowerCase();
  const candidates = ORDER.filter((p) => !forced || p === forced);

  for (const provider of candidates) {
    const key = env(KEY_NAMES[provider])?.trim();
    if (!key) continue;
    const model = env("BUILD_LAYERS_MODEL")?.trim() || DEFAULT_MODELS[provider];
    return { provider, model, key, label: `${provider}:${model}` };
  }
  return null;
}

/** The sentence a caller gets when no key is set anywhere. */
export function missingKeyMessage(env: (name: string) => string | undefined): string {
  const forced = env("BUILD_LAYERS_PROVIDER")?.trim().toLowerCase();
  const looked = ORDER.filter((p) => !forced || p === forced).map((p) => KEY_NAMES[p]);
  return `No language model key is configured for this deployment. Set one of ` +
    `${looked.join(", ")} in Supabase Dashboard > Edge Functions > Secrets. ` +
    `Explanation layers are generated from the record, so this function cannot ` +
    `answer without one.`;
}

// --- prompts -----------------------------------------------------------------

const SYSTEM_PROMPT = [
  "You write the explanation layers that sit on top of a NeoScale build record.",
  "",
  "A build record is a typed tree of nodes plus the ordered sequence of events",
  "that produced it. You are given a compact description of one. Everything you",
  "write comes from that description. Never invent a step, a tool, a setting, a",
  "URL or a number that is not in it. If the record does not say, do not say.",
  "",
  "Every node in the description carries a short ref like n7. When a step is",
  "about one particular node, set node_ref to that exact ref. When a step is",
  "not about any single node, set node_ref to null. Never invent a ref.",
  "",
  "A node marked GAP is a hole the creator admitted to, not a working part.",
  "Never write a step that tells someone to rely on it.",
  "",
  "Write plain English a non-technical reader follows. Do not use the words",
  "agent, agentic, LLM, RAG, pipeline or system prompt in your own sentences —",
  "write AI assistant, ready-made setup, automation, or connect your apps",
  "instead. You may still quote a node's own title exactly as it is written.",
  "",
  "Reply with JSON and nothing else. No preamble, no code fence, no commentary:",
  "",
  '{"steps":[{"n":1,"title":"...","body":"...","node_ref":"n3"}]}',
  "",
  "n      the step number, starting at 1 and rising by 1",
  "title  a short line, under 80 characters",
  "body   one short paragraph of one to three sentences",
].join("\n");

const LAYER_PROMPTS: Record<Layer, string> = {
  run: [
    "LAYER: run it.",
    "",
    "Write the ordered steps someone follows to reproduce this build. Do this,",
    "then this. No understanding required: no theory, no background, no",
    "explanation of why anything is the way it is. Each step is one thing the",
    "reader does, in the order they do it. Where the record gives a concrete",
    "value — a link, a model name, a setting, a file — put that value in the",
    "step rather than describing it in the abstract.",
    "",
    "Between 3 and 12 steps.",
  ].join("\n"),
  understand: [
    "LAYER: understand it.",
    "",
    "Explain what each step of this build does and why, in plain language. A",
    "reader who finishes should be able to explain the build to someone else.",
    "Say what each part is for and what would go wrong without it, not which",
    "button to press. Where the record shows a decision, a breakage or a gap,",
    "say what it changed.",
    "",
    "Between 3 and 12 steps.",
  ].join("\n"),
};

function userPrompt(layer: Layer, description: string): string {
  return `${LAYER_PROMPTS[layer]}\n\nTHE RECORD\n\n${description}`;
}

// --- the call ----------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 8_000;

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new ModelError("The model did not answer within 90 seconds.", 504);
    }
    throw new ModelError(`The model could not be reached: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  if (!response.ok) {
    // Pass the provider's own status through where it is meaningful: a 401 is
    // a wrong key and a 429 is a rate limit, and both are worth telling apart
    // from "generation failed".
    const status = response.status === 401 || response.status === 403
      ? 502
      : response.status === 429
      ? 429
      : 502;
    throw new ModelError(
      `The model returned ${response.status}: ${text.slice(0, 400)}`,
      status,
    );
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ModelError("The model returned a body that is not JSON.");
  }
}

/** Anthropic Messages API. No sampling parameters — they are rejected there. */
async function callAnthropic(
  resolved: ResolvedModel,
  layer: Layer,
  description: string,
): Promise<string> {
  const data = await postJson(
    "https://api.anthropic.com/v1/messages",
    {
      "x-api-key": resolved.key,
      "anthropic-version": "2023-06-01",
    },
    {
      model: resolved.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: userPrompt(layer, description) }],
    },
  );

  if (data.stop_reason === "refusal") {
    const details = data.stop_details as { explanation?: string } | undefined;
    throw new ModelError(
      `The model declined to answer${details?.explanation ? `: ${details.explanation}` : "."}`,
    );
  }
  if (data.stop_reason === "max_tokens") {
    throw new ModelError(
      "The model hit its output limit before finishing, so the layer would be truncated.",
    );
  }

  const blocks = Array.isArray(data.content) ? data.content : [];
  const text = blocks
    .filter((b): b is { type: string; text: string } =>
      !!b && typeof b === "object" && (b as { type?: string }).type === "text"
    )
    .map((b) => b.text)
    .join("");

  if (!text.trim()) throw new ModelError("The model returned no text.");
  return text;
}

/** OpenAI chat completions, and the Lovable gateway, which speaks the same shape. */
async function callChatCompletions(
  resolved: ResolvedModel,
  layer: Layer,
  description: string,
): Promise<string> {
  const url = resolved.provider === "lovable"
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const body: Record<string, unknown> = {
    model: resolved.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt(layer, description) },
    ],
  };
  // Only asked of OpenAI itself: the gateway fronts several model families and
  // rejects the parameter for the ones that do not implement it.
  if (resolved.provider === "openai") {
    body.response_format = { type: "json_object" };
  }

  const data = await postJson(url, { Authorization: `Bearer ${resolved.key}` }, body);

  const choices = Array.isArray(data.choices) ? data.choices : [];
  const message = (choices[0] as { message?: { content?: unknown } } | undefined)?.message;
  const content = message?.content;

  const text = typeof content === "string"
    ? content
    : Array.isArray(content)
    ? content
      .map((part) =>
        part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
          ? (part as { text: string }).text
          : ""
      )
      .join("")
    : "";

  if (!text.trim()) throw new ModelError("The model returned no text.");
  return text;
}

// --- parsing and validation --------------------------------------------------

const MAX_STEPS = 20;
const MAX_TITLE_CHARS = 120;
const MAX_BODY_CHARS = 1_200;

/**
 * The JSON object inside whatever the model actually sent. A fenced block, a
 * sentence of preamble and a trailing apology are all survivable; anything
 * without a balanced object is not.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    // fall through
  }

  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      // fall through
    }
  }
  throw new ModelError("The model did not return usable JSON.");
}

function clip(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/**
 * Model output in, storable steps out. Steps are renumbered from 1 so the
 * stored order is the stored numbering, whatever the model counted. Every
 * node_ref is resolved against the real tree: unknown becomes null.
 */
export function normaliseSteps(
  parsed: unknown,
  refs: Map<string, string>,
): Step[] {
  const raw = (parsed as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(raw)) {
    throw new ModelError('The model\'s JSON has no "steps" array.');
  }

  const steps: Step[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;

    const title = typeof entry.title === "string" ? clip(entry.title, MAX_TITLE_CHARS) : "";
    const body = typeof entry.body === "string" ? clip(entry.body, MAX_BODY_CHARS) : "";
    if (title === "" && body === "") continue;

    const ref = typeof entry.node_ref === "string" ? entry.node_ref.trim() : "";
    const nodeId = refs.get(ref) ?? null;

    steps.push({
      n: steps.length + 1,
      title: title || `Step ${steps.length + 1}`,
      body,
      node_ref: nodeId,
    });
    if (steps.length >= MAX_STEPS) break;
  }

  if (steps.length === 0) {
    throw new ModelError("The model returned no usable steps.");
  }
  return steps;
}

/** One layer, generated. Throws ModelError; never returns partial content. */
export async function generateLayer(
  resolved: ResolvedModel,
  layer: Layer,
  description: string,
  refs: Map<string, string>,
): Promise<Step[]> {
  const text = resolved.provider === "anthropic"
    ? await callAnthropic(resolved, layer, description)
    : await callChatCompletions(resolved, layer, description);
  return normaliseSteps(extractJson(text), refs);
}

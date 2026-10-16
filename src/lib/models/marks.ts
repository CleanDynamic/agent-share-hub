// Which logo names a tool, a model or a lab (UI-P83).
//
// Pure: it returns a key, and `components/brand/ModelMark.tsx` owns the files. Order matters, and it is the order a
// reader would use: the tool a build was made with first (Claude Code is not Claude), then the model, through
// `normaliseModel` so every spelling a client sends resolves, then the lab on its own (the Gallery's Labs list).
// Anything the site has no logo for is `null` and the name stands alone.

import { toolFor, type LogoKey } from "@/lib/tools/registry";

import { normaliseModel, type Lab } from "./registry";

export type { LogoKey };

export type MarkKey = LogoKey;

export interface MarkQuery {
  tool?: string | null;
  model?: string | null;
  lab?: string | null;
}

/** Lower case, runs of whitespace, `-` and `_` as one space, trimmed. */
const loose = (raw: string | null | undefined): string =>
  typeof raw === "string" ? raw.trim().toLowerCase().replace(/[\s_-]+/g, " ") : "";

/** A model is shown with its maker's product mark, not the company's. */
const MODEL_MARKS: Readonly<Record<Lab, MarkKey | null>> = {
  Anthropic: "claude-color",
  OpenAI: "openai",
  Google: "gemini-color",
  xAI: "grok",
  DeepSeek: "deepseek-color",
  Meta: "meta-color",
  TypeSafe: null,
};

const LAB_MARKS: Readonly<Record<string, MarkKey>> = {
  anthropic: "anthropic",
  openai: "openai",
  google: "google-color",
  xai: "xai",
  deepseek: "deepseek-color",
  meta: "meta-color",
};

export function markFor({ tool, model, lab }: MarkQuery): MarkKey | null {
  const byTool = toolFor(tool)?.logo;
  if (byTool) return byTool;

  const version = normaliseModel(model);
  if (version) return MODEL_MARKS[version.lab];

  return LAB_MARKS[loose(lab)] ?? null;
}

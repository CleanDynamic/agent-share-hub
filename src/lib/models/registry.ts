// The model versions the product names, and the lookup that turns whatever a
// client sent into one of them.
//
// THE PRODUCT OWNER KEEPS THIS LIST CURRENT. The lineup below is as of
// October 2026. Adding a version is one line in MODEL_VERSIONS; nothing else
// has to change. A model that is not here is never an error: modelLabel shows
// the text the client sent, so an unlisted model still reads correctly on a
// page and only lacks the "new" mark and its lab.
//
// This is a constant, not a table. import_sessions.model stores the text as the
// client sent it and is never rewritten to match; this file only decides what
// to call it.

export type Lab = "Anthropic" | "OpenAI" | "Google" | "xAI" | "DeepSeek";

export const LABS: readonly Lab[] = ["Anthropic", "OpenAI", "Google", "xAI", "DeepSeek"];

export interface ModelVersion {
  id: string;
  name: string;
  lab: Lab;
  isNew: boolean;
  /** Other spellings clients send. Matched after the normalisation below. */
  aliases: string[];
}

export const MODEL_VERSIONS: readonly ModelVersion[] = [
  {
    id: "sonnet-5-5",
    name: "Sonnet 5.5",
    lab: "Anthropic",
    isNew: true,
    aliases: ["claude-sonnet-5-5", "claude-sonnet-5.5", "sonnet-5.5", "Sonnet 5.5", "claude sonnet 5.5"],
  },
  {
    id: "opus-5-5",
    name: "Opus 5.5",
    lab: "Anthropic",
    isNew: true,
    aliases: ["claude-opus-5-5", "claude-opus-5.5", "opus-5.5", "Opus 5.5", "claude opus 5.5"],
  },
  {
    id: "haiku-5-5",
    name: "Haiku 5.5",
    lab: "Anthropic",
    isNew: false,
    aliases: ["claude-haiku-5-5", "claude-haiku-5.5", "haiku-5.5", "Haiku 5.5", "claude haiku 5.5"],
  },
  {
    id: "opus-5",
    name: "Opus 5",
    lab: "Anthropic",
    isNew: false,
    aliases: ["claude-opus-5", "Opus 5", "claude opus 5"],
  },
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    lab: "OpenAI",
    isNew: false,
    aliases: ["gpt-6-astra", "gpt6-astra", "GPT-6 Astra", "gpt 6 astra", "astra"],
  },
  {
    id: "gpt-6-1-sol",
    name: "GPT-6.1 Sol",
    lab: "OpenAI",
    isNew: true,
    aliases: ["gpt-6.1-sol", "gpt_6_1_sol", "GPT-6.1 Sol", "gpt 6.1 sol", "sol"],
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    lab: "OpenAI",
    isNew: false,
    aliases: ["gpt-6-luna", "GPT-6 Luna", "gpt 6 luna", "luna"],
  },
  {
    id: "gpt-5-6",
    name: "GPT-5.6",
    lab: "OpenAI",
    isNew: false,
    aliases: ["gpt-5.6", "gpt_5_6", "GPT-5.6", "gpt 5.6"],
  },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    lab: "Google",
    isNew: false,
    aliases: ["gemini-4-argon", "Gemini 4 Argon", "gemini 4 argon", "argon"],
  },
  {
    id: "gemini-3-8-flash",
    name: "Gemini 3.8 Flash",
    lab: "Google",
    isNew: false,
    aliases: ["gemini-3.8-flash", "gemini_3_8_flash", "Gemini 3.8 Flash", "gemini 3.8 flash"],
  },
  {
    id: "grok-4-7",
    name: "Grok 4.7",
    lab: "xAI",
    isNew: false,
    aliases: ["grok-4.7", "grok_4_7", "Grok 4.7", "grok 4.7"],
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    lab: "DeepSeek",
    isNew: false,
    aliases: ["deepseek-v4-pro", "deepseek_v4_pro", "DeepSeek V4 Pro", "deepseek v4 pro", "deepseek-v4.pro"],
  },
];

/** Vendor words clients put in front of a version. Dropped before matching. */
const VENDOR_PREFIX = /^(?:claude|gpt|gemini)-/;

/** A dated snapshot suffix, as in claude-sonnet-5-5-20261001. */
const DATE_SUFFIX = /-\d{8}$/;

/**
 * The comparison key: lower case, `-`, `_`, `.` and spaces all one separator,
 * a leading vendor word and a trailing snapshot date removed.
 */
function modelKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(DATE_SUFFIX, "")
    .replace(VENDOR_PREFIX, "");
}

const BY_KEY: ReadonlyMap<string, ModelVersion> = (() => {
  const map = new Map<string, ModelVersion>();
  for (const version of MODEL_VERSIONS) {
    for (const spelling of [version.id, version.name, ...version.aliases]) {
      const key = modelKey(spelling);
      // The first version to claim a key keeps it, so list order decides a clash.
      if (key && !map.has(key)) map.set(key, version);
    }
  }
  return map;
})();

/** The named version a client's text means, or null when it is not one we name. */
export function normaliseModel(raw: string | null | undefined): ModelVersion | null {
  if (typeof raw !== "string") return null;
  const key = modelKey(raw);
  if (!key) return null;
  return BY_KEY.get(key) ?? null;
}

/**
 * What to show for a stored model: the version's name when known, otherwise
 * the text as sent, trimmed. An unknown model never breaks a page.
 */
export function modelLabel(raw: string | null | undefined): string {
  const version = normaliseModel(raw);
  if (version) return version.name;
  return typeof raw === "string" ? raw.trim() : "";
}

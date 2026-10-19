// The model versions the product names, and the lookup that turns whatever a
// client sent into one of them.
//
// THE PRODUCT OWNER KEEPS THIS LIST CURRENT. The lineup below is as found on
// 19 October 2026 (CA-02 Appendix A). Adding a version is one line in MODEL_VERSIONS; nothing else
// has to change. A model that is not here is never an error: modelLabel shows
// the text the client sent, so an unlisted model still reads correctly on a
// page and only lacks the "new" mark and its lab.
//
// This is a constant, not a table. import_sessions.model stores the text as the
// client sent it and is never rewritten to match; this file only decides what
// to call it.

export type Lab =
  | "Anthropic"
  | "OpenAI"
  | "Google"
  | "xAI"
  | "DeepSeek"
  | "Meta"
  | "TypeSafe"
  | "Moonshot"
  | "Z.ai"
  | "NVIDIA"
  | "Perplexity"
  | "Cursor"
  | "Cognition"
  | "Microsoft"
  | "Base44"
  | "Midjourney"
  | "Kuaishou"
  | "Suno"
  | "ElevenLabs"
  | "ByteDance"
  | "Alibaba"
  | "MiniMax"
  | "Black Forest Labs"
  | "Ideogram"
  | "Higgsfield";

/** Every lab, in order. Use TEXT_LABS for a filter or a menu. */
export const LABS: readonly Lab[] = [
  "Anthropic",
  "OpenAI",
  "Google",
  "xAI",
  "DeepSeek",
  "Meta",
  "TypeSafe",
  "Moonshot",
  "Z.ai",
  "NVIDIA",
  "Perplexity",
  "Cursor",
  "Cognition",
  "Microsoft",
  "Base44",
  "Midjourney",
  "Kuaishou",
  "Suno",
  "ElevenLabs",
  "ByteDance",
  "Alibaba",
  "MiniMax",
  "Black Forest Labs",
  "Ideogram",
  "Higgsfield",
];

/** What a model makes. "decision" is a model that classifies and routes, not one you chat with (Jev). */
export type Modality = "text" | "image" | "video" | "audio" | "music" | "decision";

/** "legacy" still runs but is no longer offered; "retired" no longer runs. Both still label old builds. */
export type ModelStatus = "current" | "preview" | "legacy" | "retired";

export interface ModelVersion {
  id: string;
  name: string;
  lab: Lab;
  modality: Modality;
  status: ModelStatus;
  isNew: boolean;
  /** Other spellings clients send. Matched after the normalisation below. */
  aliases: string[];
}

export const MODEL_VERSIONS: readonly ModelVersion[] = [
  {
    id: "sonnet-5-5",
    name: "Sonnet 5.5",
    lab: "Anthropic",
    modality: "text",
    status: "current",
    isNew: true,
    aliases: ["claude-sonnet-5-5", "claude-sonnet-5.5", "sonnet-5.5", "Sonnet 5.5", "claude sonnet 5.5"],
  },
  {
    id: "opus-5-5",
    name: "Opus 5.5",
    lab: "Anthropic",
    modality: "text",
    status: "current",
    isNew: true,
    aliases: ["claude-opus-5-5", "claude-opus-5.5", "opus-5.5", "Opus 5.5", "claude opus 5.5"],
  },
  {
    id: "fable-5-1",
    name: "Fable 5.1",
    lab: "Anthropic",
    modality: "text",
    status: "current",
    isNew: true,
    aliases: ["claude-fable-5-1", "claude-fable-5.1", "fable-5.1", "claude fable 5.1"],
  },
  {
    id: "haiku-5-5",
    name: "Haiku 5.5",
    lab: "Anthropic",
    modality: "text",
    status: "current",
    isNew: false,
    aliases: ["claude-haiku-5-5", "claude-haiku-5.5", "haiku-5.5", "Haiku 5.5", "claude haiku 5.5"],
  },
  {
    id: "opus-5",
    name: "Opus 5",
    lab: "Anthropic",
    modality: "text",
    status: "current",
    isNew: false,
    aliases: ["claude-opus-5", "Opus 5", "claude opus 5"],
  },
  { id: "fable-5", name: "Fable 5", lab: "Anthropic", modality: "text", status: "current", isNew: false, aliases: ["claude-fable-5"] },
  { id: "sonnet-5", name: "Sonnet 5", lab: "Anthropic", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "opus-4-8", name: "Opus 4.8", lab: "Anthropic", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "opus-4-7", name: "Opus 4.7", lab: "Anthropic", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "opus-4-6", name: "Opus 4.6", lab: "Anthropic", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "sonnet-4-6", name: "Sonnet 4.6", lab: "Anthropic", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "sonnet-4-5", name: "Sonnet 4.5", lab: "Anthropic", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "haiku-4-5", name: "Haiku 4.5", lab: "Anthropic", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "claude-4-sonnet", name: "Claude 4 Sonnet", lab: "Anthropic", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "claude-4-opus", name: "Claude 4 Opus", lab: "Anthropic", modality: "text", status: "legacy", isNew: false, aliases: [] },
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    lab: "OpenAI",
    modality: "text",
    status: "current",
    isNew: false,
    aliases: ["gpt-6-astra", "gpt6-astra", "GPT-6 Astra", "gpt 6 astra", "astra"],
  },
  {
    id: "gpt-6-1-sol",
    name: "GPT-6.1 Sol",
    lab: "OpenAI",
    modality: "text",
    status: "current",
    isNew: true,
    aliases: ["gpt-6.1-sol", "gpt_6_1_sol", "GPT-6.1 Sol", "gpt 6.1 sol", "sol"],
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    lab: "OpenAI",
    modality: "text",
    status: "current",
    isNew: false,
    aliases: ["gpt-6-luna", "GPT-6 Luna", "gpt 6 luna", "luna"],
  },
  {
    id: "gpt-5-6",
    name: "GPT-5.6",
    lab: "OpenAI",
    modality: "text",
    status: "legacy",
    isNew: false,
    aliases: ["gpt-5.6", "gpt_5_6", "GPT-5.6", "gpt 5.6"],
  },
  { id: "gpt-6-sol", name: "GPT-6 Sol", lab: "OpenAI", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gpt-6-pro", name: "GPT-6 Pro", lab: "OpenAI", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gpt-5-6-sol", name: "GPT-5.6 Sol", lab: "OpenAI", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gpt-5-6-sol-pro", name: "GPT-5.6 Sol Pro", lab: "OpenAI", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gpt-5-6-terra", name: "GPT-5.6 Terra", lab: "OpenAI", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gpt-5-6-luna", name: "GPT-5.6 Luna", lab: "OpenAI", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gpt-5-6-cyber", name: "GPT-5.6 Cyber", lab: "OpenAI", modality: "text", status: "preview", isNew: false, aliases: ["gpt-5.6-cyber"] },
  { id: "gpt-5-5", name: "GPT-5.5", lab: "OpenAI", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "gpt-5-5-pro", name: "GPT-5.5 Pro", lab: "OpenAI", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "gpt-5-4", name: "GPT-5.4", lab: "OpenAI", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "gpt-5-4-mini", name: "GPT-5.4 mini", lab: "OpenAI", modality: "text", status: "legacy", isNew: false, aliases: [] },
  /* GPT-5.4 nano and GPT-5 mini are in GitHub Copilot's list (its 2026-10-14 release), not in Appendix A. */
  { id: "gpt-5-4-nano", name: "GPT-5.4 nano", lab: "OpenAI", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "gpt-5-mini", name: "GPT-5 mini", lab: "OpenAI", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "gpt-5-3-codex", name: "GPT-5.3-Codex", lab: "OpenAI", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "gpt-oss-120b", name: "GPT-OSS-120b", lab: "OpenAI", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gpt-image-2-5-sunburst", name: "GPT Image 2.5 Sunburst", lab: "OpenAI", modality: "image", status: "current", isNew: false, aliases: ["gpt-image-2.5-sunburst"] },
  { id: "gpt-image-2-5-flare", name: "GPT Image 2.5 Flare", lab: "OpenAI", modality: "image", status: "current", isNew: false, aliases: ["gpt-image-2.5-flare"] },
  { id: "gpt-image-2", name: "GPT Image 2", lab: "OpenAI", modality: "image", status: "legacy", isNew: false, aliases: [] },
  { id: "sora-2", name: "Sora 2", lab: "OpenAI", modality: "video", status: "retired", isNew: false, aliases: [] },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    lab: "Google",
    modality: "text",
    status: "preview",
    isNew: false,
    aliases: ["gemini-4-argon", "Gemini 4 Argon", "gemini 4 argon", "argon"],
  },
  {
    id: "gemini-3-8-flash",
    name: "Gemini 3.8 Flash",
    lab: "Google",
    modality: "text",
    status: "current",
    isNew: false,
    aliases: ["gemini-3.8-flash", "gemini_3_8_flash", "Gemini 3.8 Flash", "gemini 3.8 flash"],
  },
  { id: "gemini-3-7-flash", name: "Gemini 3.7 Flash", lab: "Google", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gemini-3-6-flash", name: "Gemini 3.6 Flash", lab: "Google", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gemini-3-5-flash", name: "Gemini 3.5 Flash", lab: "Google", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gemini-3-5-flash-lite", name: "Gemini 3.5 Flash-Lite", lab: "Google", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "gemini-3-1-pro", name: "Gemini 3.1 Pro", lab: "Google", modality: "text", status: "preview", isNew: false, aliases: [] },
  { id: "gemini-3-flash", name: "Gemini 3 Flash", lab: "Google", modality: "text", status: "preview", isNew: false, aliases: [] },
  { id: "gemini-3-1-flash-lite", name: "Gemini 3.1 Flash-Lite", lab: "Google", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "nano-banana-2", name: "Nano Banana 2", lab: "Google", modality: "image", status: "current", isNew: false, aliases: ["Gemini 3.1 Flash Image"] },
  { id: "nano-banana-pro", name: "Nano Banana Pro", lab: "Google", modality: "image", status: "current", isNew: false, aliases: ["Gemini 3 Pro Image"] },
  { id: "nano-banana-2-lite", name: "Nano Banana 2 Lite", lab: "Google", modality: "image", status: "current", isNew: false, aliases: ["Gemini 3.1 Flash Lite Image"] },
  { id: "nano-banana", name: "Nano Banana", lab: "Google", modality: "image", status: "legacy", isNew: false, aliases: ["Gemini 2.5 Flash Image"] },
  { id: "veo-3-1", name: "Veo 3.1", lab: "Google", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "veo-3-1-fast", name: "Veo 3.1 Fast", lab: "Google", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "veo-3-1-lite", name: "Veo 3.1 Lite", lab: "Google", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "gemini-omni-flash", name: "Gemini Omni Flash", lab: "Google", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "lyria-3-pro", name: "Lyria 3 Pro", lab: "Google", modality: "music", status: "preview", isNew: false, aliases: [] },
  {
    id: "grok-4-7",
    name: "Grok 4.7",
    lab: "xAI",
    modality: "text",
    status: "current",
    isNew: false,
    aliases: ["grok-4.7", "grok_4_7", "Grok 4.7", "grok 4.7"],
  },
  { id: "grok-4-6", name: "Grok 4.6", lab: "xAI", modality: "text", status: "current", isNew: false, aliases: ["grok-4.6"] },
  { id: "grok-4-5", name: "Grok 4.5", lab: "xAI", modality: "text", status: "current", isNew: false, aliases: ["grok-4.5"] },
  { id: "grok-4-3", name: "Grok 4.3", lab: "xAI", modality: "text", status: "legacy", isNew: false, aliases: [] },
  { id: "grok-imagine-image-2-0", name: "Grok Imagine Image 2.0", lab: "xAI", modality: "image", status: "current", isNew: false, aliases: ["grok-imagine-image-2.0"] },
  { id: "grok-imagine-video-1-5", name: "Grok Imagine Video 1.5", lab: "xAI", modality: "video", status: "current", isNew: false, aliases: [] },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    lab: "DeepSeek",
    modality: "text",
    status: "current",
    isNew: false,
    aliases: ["deepseek-v4-pro", "deepseek_v4_pro", "DeepSeek V4 Pro", "deepseek v4 pro", "deepseek-v4.pro"],
  },
  { id: "deepseek-v4-1-flash", name: "DeepSeek V4.1 Flash", lab: "DeepSeek", modality: "text", status: "current", isNew: false, aliases: ["deepseek-flash", "deepseek-v4-flash"] },
  {
    id: "muse-wonder",
    name: "Muse Wonder",
    lab: "Meta",
    modality: "text",
    status: "preview",
    isNew: true,
    aliases: ["muse-wonder-1.0", "meta muse wonder"],
  },
  { id: "muse-wonder-full", name: "Muse Wonder Full", lab: "Meta", modality: "text", status: "preview", isNew: false, aliases: [] },
  {
    id: "muse-spark-1-3",
    name: "Muse Spark 1.3",
    lab: "Meta",
    modality: "text",
    status: "current",
    isNew: false,
    aliases: ["muse-spark-1.3", "muse spark 1.3", "muse spark"],
  },
  { id: "muse-spark-1-2", name: "Muse Spark 1.2", lab: "Meta", modality: "text", status: "current", isNew: false, aliases: ["muse-spark-1.2"] },
  { id: "muse-spark-open", name: "Muse Spark Open", lab: "Meta", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "muse-image", name: "Muse Image", lab: "Meta", modality: "image", status: "current", isNew: false, aliases: ["muse-image-1.0"] },
  {
    id: "jev",
    name: "Jev",
    lab: "TypeSafe",
    modality: "decision",
    status: "preview",
    isNew: true,
    aliases: ["typesafe jev"],
  },
  { id: "kimi-k3", name: "Kimi K3", lab: "Moonshot", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "glm-5-3", name: "GLM 5.3", lab: "Z.ai", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "nemotron-3-ultra", name: "Nemotron 3 Ultra", lab: "NVIDIA", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "sonar-2", name: "Sonar 2", lab: "Perplexity", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "composer-2-5", name: "Composer 2.5", lab: "Cursor", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "swe-1-6", name: "SWE-1.6", lab: "Cognition", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "swe-1-6-fast", name: "SWE-1.6 Fast", lab: "Cognition", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "swe-1-5", name: "SWE-1.5", lab: "Cognition", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "mai-code-1-1-flash", name: "MAI-Code-1.1-Flash", lab: "Microsoft", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "base-1", name: "Base 1", lab: "Base44", modality: "text", status: "current", isNew: false, aliases: [] },
  { id: "midjourney-v8-2", name: "Midjourney V8.2", lab: "Midjourney", modality: "image", status: "current", isNew: false, aliases: [] },
  { id: "midjourney-v8-1", name: "Midjourney V8.1", lab: "Midjourney", modality: "image", status: "current", isNew: false, aliases: [] },
  { id: "midjourney-v7", name: "Midjourney V7", lab: "Midjourney", modality: "image", status: "current", isNew: false, aliases: [] },
  { id: "niji-7", name: "Niji 7", lab: "Midjourney", modality: "image", status: "current", isNew: false, aliases: [] },
  { id: "niji-6", name: "Niji 6", lab: "Midjourney", modality: "image", status: "legacy", isNew: false, aliases: [] },
  { id: "kling-3-0-turbo", name: "Kling 3.0 Turbo", lab: "Kuaishou", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "kling-o3", name: "Kling O3", lab: "Kuaishou", modality: "video", status: "current", isNew: false, aliases: ["Kling O3 Omni"] },
  { id: "kling-3-0", name: "Kling 3.0", lab: "Kuaishou", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "suno-v6", name: "Suno v6", lab: "Suno", modality: "music", status: "current", isNew: false, aliases: [] },
  { id: "suno-v6-wild", name: "Suno v6-wild", lab: "Suno", modality: "music", status: "current", isNew: false, aliases: [] },
  { id: "suno-v6-mini", name: "Suno v6-mini", lab: "Suno", modality: "music", status: "current", isNew: false, aliases: [] },
  { id: "suno-v5-5", name: "Suno v5.5", lab: "Suno", modality: "music", status: "current", isNew: false, aliases: [] },
  { id: "eleven-v4", name: "Eleven v4", lab: "ElevenLabs", modality: "audio", status: "current", isNew: false, aliases: ["eleven_v4"] },
  { id: "eleven-v4-turbo", name: "Eleven v4 Turbo", lab: "ElevenLabs", modality: "audio", status: "current", isNew: false, aliases: ["eleven_v4_turbo"] },
  { id: "eleven-v3", name: "Eleven v3", lab: "ElevenLabs", modality: "audio", status: "current", isNew: false, aliases: ["eleven_v3"] },
  { id: "eleven-flash-v2-5", name: "Eleven Flash v2.5", lab: "ElevenLabs", modality: "audio", status: "current", isNew: false, aliases: ["eleven_flash_v2_5"] },
  { id: "eleven-multilingual-v2", name: "Eleven Multilingual v2", lab: "ElevenLabs", modality: "audio", status: "current", isNew: false, aliases: ["eleven_multilingual_v2"] },
  { id: "scribe-v2", name: "Scribe v2", lab: "ElevenLabs", modality: "audio", status: "current", isNew: false, aliases: ["scribe_v2"] },
  { id: "eleven-music-v2-5", name: "Eleven Music v2.5", lab: "ElevenLabs", modality: "music", status: "current", isNew: false, aliases: ["music_v2_5"] },
  /* Qwen2.5 is in GitHub Copilot's list (its 2026-10-14 release), not in Appendix A. */
  { id: "qwen2-5", name: "Qwen2.5", lab: "Alibaba", modality: "text", status: "legacy", isNew: false, aliases: [] },
  /* Higgsfield and the models it hosts: the source is dated June 2026, so these are partial. */
  { id: "higgsfield-soul-2-0", name: "Higgsfield Soul 2.0", lab: "Higgsfield", modality: "image", status: "current", isNew: false, aliases: [] },
  { id: "seedance-2-5", name: "Seedance 2.5", lab: "ByteDance", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "seedance-2-0", name: "Seedance 2.0", lab: "ByteDance", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "seedream-5", name: "Seedream 5", lab: "ByteDance", modality: "image", status: "current", isNew: false, aliases: [] },
  { id: "wan-2-6", name: "WAN 2.6", lab: "Alibaba", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "happy-horse", name: "Happy Horse", lab: "Alibaba", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "hailuo-2-3", name: "Hailuo 2.3", lab: "MiniMax", modality: "video", status: "current", isNew: false, aliases: [] },
  { id: "flux-2", name: "Flux 2", lab: "Black Forest Labs", modality: "image", status: "current", isNew: false, aliases: [] },
  { id: "ideogram-4-5", name: "Ideogram 4.5", lab: "Ideogram", modality: "image", status: "current", isNew: false, aliases: [] },
];

/** A text model that is current or in preview: one a filter or a menu offers. */
export function isOfferedText(version: ModelVersion): boolean {
  return version.modality === "text" && (version.status === "current" || version.status === "preview");
}

/** The text models a filter or a menu offers, in list order; one lab's when `lab` is given. */
export function offeredTextModels(lab?: Lab): ModelVersion[] {
  return MODEL_VERSIONS.filter((version) => isOfferedText(version) && (lab === undefined || version.lab === lab));
}

/** The labs with at least one text model on offer, in LABS order. Drives every lab filter and menu. */
export const TEXT_LABS: readonly Lab[] = LABS.filter((lab) => offeredTextModels(lab).length > 0);

/** The version with this id, or null. */
export function modelById(id: string): ModelVersion | null {
  return MODEL_VERSIONS.find((version) => version.id === id) ?? null;
}

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

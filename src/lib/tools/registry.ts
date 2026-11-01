// Every AI tool the site knows: its name, its group, its logo and the other spellings people type.
//
// THE PRODUCT OWNER KEEPS THIS LIST CURRENT. Adding a tool is one entry in TOOLS. A tool with `logo: null` shows its
// name alone. Pure: `components/brand/ModelMark.tsx` owns the logo files, and `models/marks.ts` reads this list.
//
// CA-02: each tool also says what it is (`kind`), which models it offers (`models`, ids from the model registry), the
// Add items it can be named on (`steps`), and where that was read (`source`, `checked`). `kind` is for rules
// (`tools/modelRules.ts`), not layout: the picker still groups by `group`. A retired tool still labels old builds but
// is never offered for a new pick.
//
// CA-03 P7: `readsOutside` marks a tool that reads content its maker does not control. The list is held by a test, so a
// change to it is deliberate.
//
// CA-12 P13: TWO LISTS, USED CONSISTENTLY. An AI TOOL is where the AI work was done (ChatGPT, Claude Code, Cursor,
// Lovable ...): sessions, prompts, an agent's "Runs in" and code's "Written with" name one. An APP OR SERVICE is what the AI
// or the maker worked with (GitHub, Stripe, Supabase, Slack ...): a Tool tile, a manual step's "Where was it done?" and an
// agent's "Tools it can use" name one. A few are both (n8n, Notion, Figma): an AI workflow, and a place work happens.
// `TOOLS` is every entry, for looking a name up; `AI_TOOLS` and `APPS` are the two lists the pickers offer.

import { MODEL_VERSIONS } from "@/lib/models/registry";

export const LOGO_KEYS = [
  "openai",
  "gemini-color",
  "deepseek-color",
  "grok",
  "claude-color",
  "perplexity-color",
  "claudecode-color",
  "githubcopilot",
  "codex-color",
  "cursor",
  "devin-color",
  "antigravity-color",
  "aistudio",
  "lovable-color",
  "replit-color",
  "v0",
  "bolt-color",
  "manus",
  "openclaw-color",
  "hermesagent",
  "n8n-color",
  "zapier-color",
  "make-color",
  "comfyui-color",
  "midjourney",
  "nanobanana-color",
  "kling-color",
  "sora-color",
  "higgsfield",
  "suno",
  "elevenlabs",
  "notion",
  "notebooklm",
  "figma-color",
  "canva-color",
  "vercel",
  "mail",
  "anthropic",
  "google-color",
  "xai",
  "meta-color",
] as const;

export type LogoKey = (typeof LOGO_KEYS)[number];

export type ToolGroupKey =
  | "chat" | "coding" | "builders" | "agents" | "automation" | "image" | "video" | "audio" | "notes" | "design" | "other" | "services"
  | "runtime-decisions" | "runtime-context" | "runtime-frameworks" | "runtime-tracing";

/**
 * CA-13 rule 5: where a model or service sits. "workspace" is where work was done (every tool before CA-13); "runtime" is a
 * part of the finished product (Jev, ScaleDown, Deep Agents, LangSmith). Nobody has a session in a runtime model.
 */
export type ToolCategory = "workspace" | "runtime";

/** CA-12 P13: which picker lists a tool. */
export type ToolList = "ai" | "app";

export type ToolKind =
  | "chat" | "coding" | "builder" | "agent" | "automation"
  | "image" | "video" | "audio" | "notes" | "design" | "app" | "runtime";

export type ToolModels =
  | { mode: "fixed"; ids: string[]; other: boolean }    // the tool's own picker; other: true when it also takes your own key or a typed id
  | { mode: "any"; suggested: string[] }                // bring your own model: any provider, router or local server
  | { mode: "tiers"; tiers: string[] }                  // the tool names levels, not models (v0 Mini/Pro/Max, Bolt Standard/Max)
  | { mode: "hidden"; note: string }                    // the tool picks its own model and does not show it
  | { mode: "none" };                                   // the tool runs no model (Gmail, Vercel)

export type StepKey = "prompt" | "session" | "agent" | "file" | "tool" | "manual" | "result" | "code";

/** SV-27 P8: where a provider fits: a deployment kind, the model run's engine, or a model router. */
export type ProviderFit = "host" | "inference_server" | "memory" | "knowledge_base" | "relay" | "channel" | "voice" | "front_end" | "monitoring" | "billing" | "engine" | "router" | "network";

/** SV-27 P8: facts a harness's source page states. */
export interface ToolFacts {
  hosting?: "vendor" | "self-hosted";
  licence?: string;
  defaults?: { approval_mode?: "full" | "risky" | "every" | "reviewer"; sandbox?: "none" | "container" | "vm" | "vendor" };
  /** The month the source was read: "2026-10". */
  checked: string;
  /** The page the facts were read from. */
  source: string;
  /** SV-28: the default in the source's own words, where SV-27's words for the mode would say something else. */
  defaultWords?: string;
}

export interface Tool {
  /** CA-12 P13: the lists it is offered in. */
  lists: readonly ToolList[];
  /** CA-13: "runtime" for the Runtime models and services subcategory; "workspace" for everything else. */
  category: ToolCategory;
  /** What a payload stores: "claude-code". */
  id: string;
  /** What a page shows: "Claude Code". */
  name: string;
  group: ToolGroupKey;
  /** A key ModelMark draws; null shows the name alone. */
  logo: LogoKey | null;
  /** Other spellings people type. */
  aliases: string[];
  /** The connector's client id, where chats are imported from it. */
  client?: string;
  /** Files a coding tool reads from the project folder; a name ending in "/" is a folder. */
  projectFiles?: string[];
  /** The tool imports a workflow file (n8n, ComfyUI). */
  importsFile?: true;
  kind: ToolKind;
  models: ToolModels;
  /** The Add items this tool can be named on. */
  steps: StepKey[];
  /** Model roles the tool really has, for agents: ["main"] or ["main", "plans", "acts"]. */
  roles?: string[];
  status: "current" | "retired";
  /** Where the model list came from, and the date it was read. */
  source: string | null;
  checked: string | null;
  /** True when the list is incomplete or the source is older than a month. */
  partial?: true;
  /** True when no source confirmed the list: what is here is the best reading of the tool. */
  unverified?: true;
  /**
   * CA-03 P7: the tool reads content its maker does not control (email, web pages, other people's files), so what
   * it reads can steer an agent that uses it.
   */
  readsOutside?: true;
  /** CA-05 P8: the tool runs models on the maker's own computer, so how it was run (size, where) is worth saying. */
  local?: true;
  /**
   * SV-27 P8: what the tool's own source page states about it, filled only from that page and never from memory: who hosts it,
   * its licence, its defaults for approvals and sandbox, and the month the page was read. A fact with no source stays empty.
   * (Named `facts`, not `checked`: `checked` is already the date the model list was read.)
   */
  facts?: ToolFacts;
  /**
   * SV-27 P8: the deployment kinds the tool is offered on (a Channel's provider, a Memory's, an inference server ...), the model
   * run's engine, or a model router. Named `deploys`, not `steps`: `steps` are the Add items a tool is named on.
   */
  deploys?: readonly ProviderFit[];
  /** SV-27 P8: the secret a copier needs for it, named and never stored ("TELEGRAM_BOT_TOKEN"). */
  secret?: string;
  /** CA-16: how a build made in this tool was made, as a Build method id in `lib/classify/taxonomy.ts`. Set for the tools the classification reads. */
  buildMethod?: BuildMethodId;
}

/** CA-16: the Build method values a tool can give (ids in the classification taxonomy). */
export type BuildMethodId = "chat-assistant" | "app-builder" | "ai-coding-agent" | "automation-platform" | "local-models";

/** Google AI Studio offers every current Google model, whatever it makes (Appendix B). */
const GOOGLE_AI_STUDIO_MODELS: ToolModels = {
  mode: "fixed",
  ids: MODEL_VERSIONS.filter((version) => version.lab === "Google" && (version.status === "current" || version.status === "preview")).map((version) => version.id),
  other: false,
};

export const TOOL_GROUPS: readonly { key: ToolGroupKey; label: string }[] = [
  { key: "chat", label: "Chat and research" },
  { key: "coding", label: "Coding agents and editors" },
  { key: "builders", label: "App builders" },
  { key: "agents", label: "Agents" },
  { key: "automation", label: "Automation and workflows" },
  { key: "image", label: "Image" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "notes", label: "Notes and docs" },
  { key: "design", label: "Design" },
  { key: "other", label: "Other apps" },
];

/** CA-13: the four groups of the Runtime models and services subcategory, in the order they show. */
export const RUNTIME_GROUPS: readonly { key: ToolGroupKey; label: string }[] = [
  { key: "runtime-decisions", label: "Decision models" },
  { key: "runtime-context", label: "Context helpers" },
  { key: "runtime-frameworks", label: "Agent frameworks" },
  { key: "runtime-tracing", label: "Tracing" },
];

/** CA-13: the subcategory's heading wherever it is offered. */
export const RUNTIME_HEADING = "Runtime models and services";

const ENTRIES: readonly Omit<Tool, "lists" | "category">[] = [
  {
    id: "chatgpt", name: "ChatGPT", group: "chat", logo: "openai", aliases: ["chat gpt", "chatgpt.com"], client: "chatgpt",
    buildMethod: "chat-assistant",
    kind: "chat",
    models: { mode: "fixed", ids: ["gpt-5-6-sol", "gpt-5-6-luna", "gpt-5-6-sol-pro", "gpt-6-pro", "gpt-6-sol", "gpt-6-luna", "gpt-6-astra", "gpt-5-6-terra", "gpt-image-2-5-sunburst"], other: false },
    steps: ["prompt", "session", "agent", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://www.ai-toolbox.co/chatgpt-models/chatgpt-models-explained-complete-comparison-2026",
    checked: "2026-10-19",
  },
  {
    id: "gemini", name: "Gemini", group: "chat", logo: "gemini-color", aliases: ["google gemini", "gemini.google.com"],
    buildMethod: "chat-assistant",
    kind: "chat",
    models: { mode: "fixed", ids: ["gemini-3-8-flash", "gemini-3-7-flash", "gemini-3-5-flash-lite", "nano-banana-2", "nano-banana-pro", "veo-3-1"], other: false },
    steps: ["prompt", "session", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://presenc.ai/research/google-gemini-model-lineage-2026",
    checked: "2026-10-19",
    partial: true,
  },
  {
    id: "deepseek", name: "DeepSeek", group: "chat", logo: "deepseek-color", aliases: ["deep seek", "chat.deepseek.com"],
    kind: "chat",
    models: { mode: "fixed", ids: ["deepseek-v4-pro", "deepseek-v4-1-flash"], other: false },
    steps: ["prompt", "session", "manual", "result"],
    status: "current",
    source: "https://api-docs.deepseek.com/updates/",
    checked: "2026-10-19",
  },
  {
    id: "grok", name: "Grok", group: "chat", logo: "grok", aliases: ["grok.com"],
    kind: "chat",
    models: { mode: "fixed", ids: ["grok-4-6", "grok-4-5", "grok-imagine-image-2-0", "grok-imagine-video-1-5"], other: false },
    steps: ["prompt", "session", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://www.ai-toolbox.co/grok-models/grok-models-explained-2026",
    checked: "2026-10-19",
  },
  {
    id: "claude", name: "Claude", group: "chat", logo: "claude-color", aliases: ["claude.ai"], client: "claude",
    buildMethod: "chat-assistant",
    kind: "chat",
    models: { mode: "fixed", ids: ["fable-5-1", "opus-5-5", "sonnet-5-5", "haiku-5-5", "opus-5", "sonnet-5", "fable-5", "opus-4-7", "opus-4-6", "sonnet-4-6"], other: false },
    steps: ["prompt", "session", "agent", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://support.claude.com/en/articles/8664678-change-the-model-effort-and-thinking-settings",
    checked: "2026-10-19",
    partial: true,
  },
  {
    id: "perplexity", name: "Perplexity", group: "chat", logo: "perplexity-color", aliases: ["perplexity ai", "perplexity.ai"],
    kind: "chat",
    models: { mode: "fixed", ids: ["sonar-2", "gpt-5-6-terra", "gpt-5-6-sol", "gemini-3-7-flash", "sonnet-5", "opus-5", "kimi-k3", "glm-5-3", "grok-4-6", "nemotron-3-ultra"], other: false },
    steps: ["prompt", "session", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://www.perplexity.ai/help-center/en/articles/10354919-what-advanced-ai-models-are-included-in-my-subscription",
    checked: "2026-10-19",
  },
  {
    id: "ollama", name: "Ollama", group: "chat", logo: null, aliases: ["ollama.com", "ollama.ai"],
    buildMethod: "local-models",
    kind: "chat",
    models: { mode: "any", suggested: [] },
    steps: ["prompt", "session", "agent", "result", "manual"],
    local: true,
    status: "current",
    source: null,
    checked: null,
    unverified: true,
  },
  {
    id: "lm-studio", name: "LM Studio", group: "chat", logo: null, aliases: ["lmstudio", "lm studio.ai", "lmstudio.ai"],
    kind: "chat",
    models: { mode: "any", suggested: [] },
    steps: ["prompt", "session", "agent", "result", "manual"],
    local: true,
    status: "current",
    source: null,
    checked: null,
    unverified: true,
  },
  {
    id: "character-ai", name: "Character.AI", group: "chat", logo: null, aliases: ["character ai", "c.ai"],
    kind: "chat",
    models: { mode: "hidden", note: "Character.AI picks its own model" },
    steps: ["prompt", "session", "manual"],
    status: "current",
    source: null,
    checked: null,
    unverified: true,
  },
  {
    id: "claude-code", name: "Claude Code", group: "coding", logo: "claudecode-color", aliases: ["claudecode"], client: "claude-code", projectFiles: ["CLAUDE.md", "SKILL.md"],
    buildMethod: "ai-coding-agent",
    kind: "coding",
    models: { mode: "fixed", ids: ["fable-5-1", "fable-5", "opus-5-5", "sonnet-5-5", "haiku-5-5", "opus-5", "sonnet-5", "opus-4-8", "opus-4-7", "opus-4-6", "sonnet-4-6", "sonnet-4-5", "haiku-4-5"], other: true },
    steps: ["prompt", "session", "agent", "code", "manual", "result"],
    roles: ["main", "plans", "acts"],
    status: "current",
    source: "https://code.claude.com/docs/en/model-config",
    checked: "2026-10-19",
    // SV-28: from https://code.claude.com/docs/en/permission-modes, read 2026-11: from v2.1.283, auto is the mode new interactive
    // terminal and VS Code sessions start in. In auto, a separate classifier model reviews each action before it runs (our
    // "reviewer"). The page names no default sandbox.
    facts: { defaults: { approval_mode: "reviewer" }, checked: "2026-11", source: "https://code.claude.com/docs/en/permission-modes", defaultWords: "auto, an AI reviewer that blocks risky actions rather than asking" },
  },
  {
    id: "github-copilot", name: "GitHub Copilot", group: "coding", logo: "githubcopilot", aliases: ["gh copilot"], projectFiles: [".github/copilot-instructions.md"],
    kind: "coding",
    models: { mode: "fixed", ids: ["gpt-6-1-sol", "gpt-6-astra", "gpt-6-sol", "gpt-6-luna", "gpt-5-6-sol", "gpt-5-6-terra", "gpt-5-6-luna", "gpt-5-5", "gpt-5-4", "gpt-5-4-mini", "gpt-5-3-codex", "fable-5-1", "fable-5", "opus-5-5", "opus-5", "opus-4-8", "sonnet-5-5", "sonnet-5", "sonnet-4-6", "haiku-5-5", "haiku-4-5", "gemini-4-argon", "gemini-3-8-flash", "gemini-3-7-flash", "grok-4-7", "grok-4-6", "grok-4-5", "kimi-k3", "mai-code-1-1-flash", "gpt-5-mini", "gpt-5-4-nano", "qwen2-5"], other: false },
    steps: ["prompt", "session", "agent", "code", "manual", "result"],
    status: "current",
    source: "https://github.com/rajbos/github-copilot-model-notifier/releases/tag/models-2026-10-14-081303",
    checked: "2026-10-19",
  },
  {
    id: "codex", name: "Codex", group: "coding", logo: "codex-color", aliases: ["openai codex", "codex cli"], projectFiles: ["AGENTS.md"],
    kind: "coding",
    models: { mode: "fixed", ids: ["gpt-6-1-sol", "gpt-6-astra", "gpt-6-luna", "gpt-6-sol", "gpt-5-6-sol", "gpt-5-6-terra", "gpt-5-6-luna"], other: false },
    steps: ["prompt", "session", "agent", "code", "manual", "result"],
    status: "current",
    source: "https://aidenapp.org/codex-models",
    checked: "2026-10-19",
  },
  {
    id: "cursor", name: "Cursor", group: "coding", logo: "cursor", aliases: ["cursor ai", "cursor.com"], client: "cursor", projectFiles: [".cursor/rules/"],
    buildMethod: "ai-coding-agent",
    kind: "coding",
    models: { mode: "fixed", ids: ["grok-4-7", "grok-4-6", "grok-4-5", "composer-2-5", "gpt-5-6-sol", "gpt-5-5", "opus-5", "fable-5"], other: true },
    steps: ["prompt", "session", "agent", "code", "manual", "result"],
    status: "current",
    source: "https://cursor.com/help/models-and-usage/available-models",
    checked: "2026-10-19",
    partial: true,
  },
  {
    id: "devin-desktop", name: "Devin Desktop", group: "coding", logo: "devin-color", aliases: ["windsurf", "windsurf ide"],
    kind: "coding",
    models: { mode: "fixed", ids: ["swe-1-6", "swe-1-6-fast", "swe-1-5", "claude-4-sonnet", "claude-4-opus"], other: true },
    steps: ["prompt", "session", "agent", "code", "manual", "result"],
    status: "current",
    source: "https://docs.windsurf.com/windsurf/models",
    checked: "2026-10-19",
  },
  {
    id: "antigravity", name: "Antigravity", group: "coding", logo: "antigravity-color", aliases: ["google antigravity"],
    kind: "coding",
    models: { mode: "fixed", ids: ["gemini-3-8-flash", "gemini-3-7-flash", "gemini-3-6-flash", "gemini-3-1-pro", "sonnet-5-5", "opus-5-5", "sonnet-4-6", "opus-4-6", "gpt-oss-120b"], other: false },
    steps: ["prompt", "session", "agent", "code", "manual", "result"],
    status: "current",
    source: "https://deepseekartifacts.com/blog/antigravity-models",
    checked: "2026-10-19",
  },
  {
    id: "muse-code", name: "Muse Code", group: "coding", logo: null, aliases: ["meta muse code"],
    kind: "coding",
    models: { mode: "fixed", ids: ["muse-wonder", "muse-wonder-full", "muse-spark-1-3", "muse-spark-1-2"], other: false },
    steps: ["prompt", "session", "agent", "code", "manual", "result"],
    status: "current",
    source: "https://dev.meta.ai/docs/models",
    checked: "2026-10-19",
  },
  {
    id: "google-ai-studio", name: "Google AI Studio", group: "builders", logo: "aistudio", aliases: ["ai studio", "aistudio.google.com"],
    kind: "builder",
    models: GOOGLE_AI_STUDIO_MODELS,
    steps: ["prompt", "session", "code", "manual", "result"],
    status: "current",
    source: "https://presenc.ai/research/google-gemini-model-lineage-2026",
    checked: "2026-10-19",
  },
  {
    id: "lovable", name: "Lovable", group: "builders", logo: "lovable-color", aliases: ["lovable.dev"],
    buildMethod: "app-builder",
    kind: "builder",
    models: { mode: "hidden", note: "Lovable picks the model that builds your app" },
    steps: ["prompt", "session", "file", "manual", "result"],
    status: "current",
    source: "https://docs.lovable.dev/features/ai",
    checked: "2026-10-19",
  },
  {
    id: "replit", name: "Replit", group: "builders", logo: "replit-color", aliases: ["replit agent"],
    kind: "builder",
    models: { mode: "fixed", ids: ["gpt-6-sol", "gpt-6-luna", "sonnet-5", "sonnet-4-6", "gpt-6-astra", "fable-5-1", "opus-5-5", "opus-4-8", "opus-5", "kimi-k3"], other: false },
    steps: ["prompt", "session", "code", "manual", "result"],
    status: "current",
    source: "https://docs.replit.com/features/agent/model-selector",
    checked: "2026-10-19",
  },
  {
    id: "v0", name: "v0", group: "builders", logo: "v0", aliases: ["v0.dev", "v0.app", "v0 by vercel"],
    buildMethod: "app-builder",
    kind: "builder",
    models: { mode: "tiers", tiers: ["v0 Mini", "v0 Pro", "v0 Max"] },
    steps: ["prompt", "session", "code", "manual", "result"],
    status: "current",
    source: "https://community.vercel.com/t/v0-model-selection-is-back-with-v0-mini-pro-and-max/29718",
    checked: "2026-10-19",
  },
  {
    id: "bolt", name: "Bolt", group: "builders", logo: "bolt-color", aliases: ["bolt.new"],
    buildMethod: "app-builder",
    kind: "builder",
    models: { mode: "tiers", tiers: ["Standard", "Max"] },
    steps: ["prompt", "session", "code", "manual", "result"],
    status: "current",
    source: "https://support.bolt.new/release-notes",
    checked: "2026-10-19",
  },
  {
    id: "base44", name: "Base44", group: "builders", logo: null, aliases: ["base 44"],
    kind: "builder",
    models: { mode: "fixed", ids: ["base-1", "sonnet-5-5", "opus-5-5", "fable-5-1", "haiku-5-5", "gemini-3-8-flash", "gemini-4-argon", "gpt-5-6-terra", "gpt-6-1-sol", "gpt-6-astra"], other: false },
    steps: ["prompt", "session", "manual", "result"],
    status: "current",
    source: "https://docs.base44.com/Building-your-app/AI-chat-modes",
    checked: "2026-10-19",
  },
  {
    id: "manus", name: "Manus", group: "agents", logo: "manus", aliases: ["manus ai", "manus.im"],
    kind: "agent",
    models: { mode: "hidden", note: "Manus picks its own model" },
    steps: ["agent", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://en.wikipedia.org/wiki/Manus_(AI_agent)",
    checked: "2026-10-19",
    unverified: true,
  },
  {
    id: "openclaw", name: "OpenClaw", group: "agents", logo: "openclaw-color", aliases: ["open claw"],
    kind: "agent",
    models: { mode: "any", suggested: ["opus-5-5", "sonnet-5-5", "gpt-6-1-sol", "gemini-3-8-flash", "grok-4-7"] },
    steps: ["agent", "session", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://docs.openclaw.ai/providers/models",
    checked: "2026-10-19",
    // SV-27 P8: from https://docs.openclaw.ai/tools/exec-approvals, read 2026-10: "An unconfigured node uses the same `full` /
    // `off` baseline as the Gateway." (security full, ask off: it runs commands without asking). The page names no default sandbox.
    facts: { defaults: { approval_mode: "full" }, checked: "2026-10", source: "https://docs.openclaw.ai/tools/exec-approvals" },
  },
  {
    id: "hermes-agent", name: "Hermes Agent", group: "agents", logo: "hermesagent", aliases: [],
    kind: "agent",
    models: { mode: "any", suggested: ["opus-5-5", "sonnet-5-5", "gpt-6-1-sol", "gemini-3-8-flash", "grok-4-7", "deepseek-v4-pro", "kimi-k3", "glm-5-3"] },
    steps: ["agent", "session", "manual", "result"],
    roles: ["main", "vision", "web summaries", "compression", "fallback"],
    readsOutside: true,
    status: "current",
    source: "https://hermes-agent.nousresearch.com/docs/integrations/providers",
    checked: "2026-10-19",
    // SV-27 P8: from https://hermes-agent.nousresearch.com/docs/user-guide/security/, read 2026-10: approvals.mode defaults to
    // "smart": an auxiliary model approves low-risk commands, denies dangerous ones and asks when uncertain (our "reviewer"). The
    // page names no default sandbox.
    facts: { defaults: { approval_mode: "reviewer" }, checked: "2026-10", source: "https://hermes-agent.nousresearch.com/docs/user-guide/security/" },
  },
  {
    id: "muse", name: "Muse", group: "agents", logo: null, aliases: ["meta muse", "muse by meta"],
    kind: "agent",
    models: { mode: "hidden", note: "Muse runs on Muse Spark" },
    steps: ["agent", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://techcrunch.com/2026/09/08/meta-debuts-its-muse-ai-agent-will-consumers-trust-it/",
    checked: "2026-10-19",
  },
  {
    id: "n8n", name: "n8n", group: "automation", logo: "n8n-color", aliases: ["n8n.io"], importsFile: true,
    buildMethod: "automation-platform",
    kind: "automation",
    models: { mode: "any", suggested: [] },
    steps: ["prompt", "agent", "file", "tool", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: null,
    checked: null,
    unverified: true,
  },
  {
    id: "zapier", name: "Zapier", group: "automation", logo: "zapier-color", aliases: ["zapier.com"],
    buildMethod: "automation-platform",
    kind: "automation",
    models: { mode: "any", suggested: [] },
    steps: ["agent", "tool", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: null,
    checked: null,
    unverified: true,
  },
  {
    id: "make", name: "Make", group: "automation", logo: "make-color", aliases: ["make.com", "integromat"],
    buildMethod: "automation-platform",
    kind: "automation",
    models: { mode: "any", suggested: [] },
    steps: ["agent", "tool", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: null,
    checked: null,
    unverified: true,
  },
  {
    id: "comfyui", name: "ComfyUI", group: "automation", logo: "comfyui-color", aliases: ["comfy ui"], importsFile: true,
    kind: "automation",
    models: { mode: "any", suggested: [] },
    steps: ["prompt", "file", "manual", "result"],
    status: "current",
    source: null,
    checked: null,
    unverified: true,
  },
  {
    id: "midjourney", name: "Midjourney", group: "image", logo: "midjourney", aliases: ["mid journey"],
    kind: "image",
    models: { mode: "fixed", ids: ["midjourney-v8-2", "midjourney-v8-1", "midjourney-v7", "niji-7"], other: false },
    steps: ["prompt", "manual", "result"],
    status: "current",
    source: "https://blakecrosley.com/guides/midjourney",
    checked: "2026-10-19",
  },
  {
    id: "nano-banana", name: "Nano Banana", group: "image", logo: "nanobanana-color", aliases: ["nano banana pro"],
    kind: "image",
    models: { mode: "fixed", ids: ["nano-banana-2", "nano-banana-pro", "nano-banana-2-lite", "nano-banana"], other: false },
    steps: ["prompt", "manual", "result"],
    status: "current",
    source: "https://www.solidaitech.com/2026/07/nano-banana-ai-google-guide.html",
    checked: "2026-10-19",
  },
  {
    id: "kling", name: "Kling", group: "video", logo: "kling-color", aliases: ["kling ai"],
    kind: "video",
    models: { mode: "fixed", ids: ["kling-3-0-turbo", "kling-o3", "kling-3-0"], other: false },
    steps: ["prompt", "manual", "result"],
    status: "current",
    source: "https://www.atlascloud.ai/blog/tips/kling-ai",
    checked: "2026-10-19",
  },
  {
    id: "sora", name: "Sora", group: "video", logo: "sora-color", aliases: ["openai sora"],
    kind: "video",
    models: { mode: "fixed", ids: ["sora-2"], other: false },
    steps: [],
    status: "retired",
    source: "https://en.wikipedia.org/wiki/Sora_(text-to-video_model)",
    checked: "2026-10-19",
  },
  {
    id: "higgsfield", name: "Higgsfield", group: "video", logo: "higgsfield", aliases: ["higgsfield ai"],
    kind: "video",
    models: { mode: "fixed", ids: ["higgsfield-soul-2-0", "seedance-2-5", "seedance-2-0", "veo-3-1", "kling-3-0", "wan-2-6", "hailuo-2-3", "gemini-omni-flash", "happy-horse", "grok-imagine-video-1-5", "nano-banana-2", "flux-2", "seedream-5", "gpt-image-2", "ideogram-4-5"], other: false },
    steps: ["prompt", "manual", "result"],
    status: "current",
    source: "https://higgsfield.ai/blog/best-ai-video-generators-2026",
    checked: "2026-10-19",
    partial: true,
  },
  {
    id: "veo", name: "Veo", group: "video", logo: null, aliases: ["google veo"],
    kind: "video",
    models: { mode: "fixed", ids: ["veo-3-1", "veo-3-1-fast", "veo-3-1-lite"], other: false },
    steps: ["prompt", "manual", "result"],
    status: "current",
    source: "https://presenc.ai/research/google-gemini-model-lineage-2026",
    checked: "2026-10-19",
  },
  {
    id: "suno", name: "Suno", group: "audio", logo: "suno", aliases: ["suno ai"],
    kind: "audio",
    models: { mode: "fixed", ids: ["suno-v6", "suno-v6-wild", "suno-v6-mini", "suno-v5-5"], other: false },
    steps: ["prompt", "manual", "result"],
    status: "current",
    source: "https://suno.com/release-notes",
    checked: "2026-10-19",
  },
  {
    id: "elevenlabs", name: "ElevenLabs", group: "audio", logo: "elevenlabs", aliases: ["eleven labs", "11labs"],
    kind: "audio",
    models: { mode: "fixed", ids: ["eleven-v4", "eleven-v4-turbo", "eleven-v3", "eleven-flash-v2-5", "eleven-multilingual-v2", "scribe-v2", "eleven-music-v2-5"], other: false },
    steps: ["prompt", "tool", "manual", "result"],
    status: "current",
    source: "https://elevenlabs.io/docs/overview/models",
    checked: "2026-10-19",
  },
  {
    id: "notion", name: "Notion", group: "notes", logo: "notion", aliases: ["notion ai"],
    kind: "notes",
    models: { mode: "fixed", ids: ["opus-5", "gpt-5-6-sol", "kimi-k3"], other: true },
    steps: ["prompt", "agent", "tool", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://www.notion.com/releases/2026-09-15",
    checked: "2026-10-19",
    partial: true,
  },
  {
    id: "gemini-notebook", name: "Gemini Notebook", group: "notes", logo: "notebooklm", aliases: ["notebooklm", "notebooklm.google"],
    kind: "notes",
    models: { mode: "hidden", note: "Gemini Notebook picks its own model" },
    steps: ["prompt", "file", "manual", "result"],
    readsOutside: true,
    status: "current",
    source: "https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/",
    checked: "2026-10-19",
  },
  {
    id: "gamma", name: "Gamma", group: "notes", logo: null, aliases: ["gamma.app"],
    kind: "notes",
    models: { mode: "hidden", note: "Gamma picks its own model" },
    steps: ["prompt", "manual", "result"],
    status: "current",
    source: null,
    checked: null,
    unverified: true,
  },
  {
    id: "figma", name: "Figma", group: "design", logo: "figma-color", aliases: ["figma make"],
    kind: "design",
    models: { mode: "fixed", ids: ["gpt-5-6-terra", "gpt-6-1-sol", "sonnet-4-5", "opus-5-5", "gemini-3-8-flash", "gemini-4-argon"], other: false },
    steps: ["prompt", "manual", "result"],
    status: "current",
    source: "https://help.figma.com/hc/en-us/articles/36400680326551-Select-an-AI-model-to-use-in-Figma-Make",
    checked: "2026-10-19",
  },
  {
    id: "canva", name: "Canva", group: "design", logo: "canva-color", aliases: ["canva ai"],
    kind: "design",
    models: { mode: "hidden", note: "Canva picks its own model" },
    steps: ["prompt", "manual", "result"],
    status: "current",
    source: null,
    checked: null,
    unverified: true,
  },
  {
    id: "vercel", name: "Vercel", group: "other", logo: "vercel", aliases: [],
    kind: "app",
    models: { mode: "none" },
    steps: ["tool", "manual"],
    status: "current",
    source: null,
    checked: null,
  },
  {
    id: "gmail", name: "Gmail", group: "other", logo: "mail", aliases: ["google mail"],
    kind: "app",
    models: { mode: "none" },
    steps: ["tool", "manual"],
    readsOutside: true,
    status: "current",
    source: null,
    checked: null,
  },
];

/** CA-12 P13: an app or service with no model, named on a Tool tile, a manual step or an agent's tools. */
const app = (id: string, name: string, aliases: string[], logo: LogoKey | null = null, readsOutside = false): Omit<Tool, "lists" | "category"> => ({
  id,
  name,
  group: "services",
  logo,
  aliases,
  kind: "app",
  models: { mode: "none" },
  steps: ["tool", "manual"],
  ...(readsOutside ? { readsOutside: true as const } : null),
  status: "current",
  source: null,
  checked: null,
});

/** CA-12 P13: apps and services that are not AI tools. A mark where one is already in the project, else the neutral square. */
const APP_ENTRIES: readonly Omit<Tool, "lists" | "category">[] = [
  app("github", "GitHub", ["github.com", "git hub"], null, true),
  app("gitlab", "GitLab", ["gitlab.com"], null, true),
  app("stripe", "Stripe", ["stripe.com"]),
  app("supabase", "Supabase", ["supabase.com"]),
  app("postgres", "Postgres", ["postgresql", "pg"]),
  app("netlify", "Netlify", ["netlify.com"]),
  app("cloudflare", "Cloudflare", ["cloudflare.com", "workers"]),
  app("slack", "Slack", ["slack.com"], null, true),
  app("google-drive", "Google Drive", ["gdrive", "drive"], null, true),
  app("google-sheets", "Google Sheets", ["gsheets", "sheets"]),
  app("linear", "Linear", ["linear.app"], null, true),
  app("jira", "Jira", ["atlassian jira"], null, true),
  app("airtable", "Airtable", ["airtable.com"]),
  app("shopify", "Shopify", ["shopify.com"]),
  app("twilio", "Twilio", ["twilio.com"]),
  app("resend", "Resend", ["resend.com"]),
  /* SV-27 P8: an integration an agent's MCP server reaches. */
  app("google-calendar", "Google Calendar", ["gcal", "calendar"], null, true),
];

/** CA-13: a model or service that is part of the finished product. A neutral glyph, no logo; it runs no session, so it fits no Add item. */
const runtime = (id: string, name: string, group: ToolGroupKey, aliases: string[]): Omit<Tool, "lists" | "category"> => ({
  id,
  name,
  group,
  logo: null,
  aliases,
  kind: "runtime",
  // An agent framework runs whatever model it is given; every other runtime model is not a place a prompt is run.
  models: group === "runtime-frameworks" ? { mode: "any", suggested: [] } : { mode: "none" },
  steps: group === "runtime-frameworks" ? ["agent"] : [],
  status: "current",
  source: null,
  checked: null,
  unverified: true,
});

/** CA-13 rule 5: the Runtime models and services subcategory. */
const RUNTIME_ENTRIES: readonly Omit<Tool, "lists" | "category">[] = [
  runtime("typesafe-jev", "TypeSafe Jev", "runtime-decisions", ["jev", "typesafe", "type safe jev"]),
  runtime("scaledown-summarize", "ScaleDown Summarize", "runtime-context", ["scaledown summarization"]),
  runtime("scaledown-compress", "ScaleDown Compress", "runtime-context", ["scaledown tool compression"]),
  runtime("scaledown-extract", "ScaleDown Extract", "runtime-context", ["scaledown extraction"]),
  runtime("scaledown-classify", "ScaleDown Classify", "runtime-context", ["scaledown classifier"]),
  runtime("deep-agents", "LangChain Deep Agents", "runtime-frameworks", ["deep agents", "deepagents", "langchain deep agents"]),
  runtime("langgraph", "LangGraph", "runtime-frameworks", ["lang graph"]),
  runtime("langsmith", "LangSmith", "runtime-tracing", ["lang smith", "smith.langchain.com"]),
  /* SV-27 P8. */
  runtime("crewai", "CrewAI", "runtime-frameworks", ["crew ai"]),
];

/**
 * SV-27 P8: providers a deployment names that are not tools anyone works in: offered only on the kinds they fit (`deploys`), in
 * no tool picker (`lists: []`). A neutral mark: no logo is fetched from outside.
 */
const provider = (id: string, name: string, aliases: string[], deploys: readonly ProviderFit[], secret?: string): Omit<Tool, "lists" | "category"> => ({
  id,
  name,
  group: "services",
  logo: null,
  aliases,
  kind: "runtime",
  models: { mode: "none" },
  steps: [],
  status: "current",
  source: null,
  checked: null,
  unverified: true,
  deploys,
  ...(secret ? { secret } : null),
});

const PROVIDER_ENTRIES: readonly Omit<Tool, "lists" | "category">[] = [
  provider("llama-cpp", "llama.cpp", ["llama-server", "llamacpp", "llama cpp", "llama server"], ["engine", "inference_server"]),
  provider("vllm", "vLLM", ["vllm server"], ["engine", "inference_server"]),
  provider("mlx", "MLX", ["mlx-lm", "apple mlx"], ["engine"]),
  provider("letta", "Letta", ["memgpt"], ["memory"], "LETTA_API_KEY"),
  provider("mem0", "Mem0", ["mem 0", "mem0ai"], ["memory"], "MEM0_API_KEY"),
  provider("telegram", "Telegram", ["telegram bot"], ["channel"], "TELEGRAM_BOT_TOKEN"),
  provider("whatsapp", "WhatsApp", ["whats app", "whatsapp business"], ["channel"], "WHATSAPP_ACCESS_TOKEN"),
  provider("hume", "Hume", ["hume ai", "evi"], ["voice"], "HUME_API_KEY"),
  provider("claude-design", "Claude Design", [], ["front_end"]),
  provider("grafana", "Grafana", [], ["monitoring"]),
  provider("prometheus", "Prometheus", [], ["monitoring"]),
  provider("langfuse", "Langfuse", ["lang fuse"], ["monitoring"], "LANGFUSE_SECRET_KEY"),
  provider("obsidian", "Obsidian", ["obsidian vault"], ["knowledge_base"]),
  provider("tailscale", "Tailscale", ["tail scale"], ["network"], "TS_AUTHKEY"),
  provider("openrouter", "OpenRouter", ["open router"], ["router"], "OPENROUTER_API_KEY"),
];

/** SV-27 P8: tools already in the list that a deployment also names, and where. */
const ALSO_DEPLOYS: Readonly<Record<string, { deploys: readonly ProviderFit[]; secret?: string }>> = {
  ollama: { deploys: ["inference_server"] },
  "lm-studio": { deploys: ["inference_server"] },
  elevenlabs: { deploys: ["voice"], secret: "ELEVENLABS_API_KEY" },
  slack: { deploys: ["channel"], secret: "SLACK_BOT_TOKEN" },
  stripe: { deploys: ["billing"], secret: "STRIPE_SECRET_KEY" },
  lovable: { deploys: ["front_end"] },
  notion: { deploys: ["knowledge_base"] },
  langsmith: { deploys: ["monitoring"], secret: "LANGSMITH_API_KEY" },
  gmail: { deploys: [] },
};

/** CA-12 P13: in both lists: an AI workflow or a place work happens. Everything else in the original list is an AI tool, bar the two apps. */
const IN_BOTH = new Set(["n8n", "zapier", "make", "elevenlabs", "notion", "figma"]);
const APP_ONLY = new Set(["vercel", "gmail"]);

const listsOf = (id: string): readonly ToolList[] => (APP_ONLY.has(id) ? ["app"] : IN_BOTH.has(id) ? ["ai", "app"] : ["ai"]);

/** Every entry, AI tool or app, for looking a name up. */
const withDeploys = (tool: Tool): Tool => (ALSO_DEPLOYS[tool.id] ? { ...tool, ...ALSO_DEPLOYS[tool.id] } : tool);

export const TOOLS: readonly Tool[] = [
  ...ENTRIES.map((entry): Tool => withDeploys({ ...entry, lists: listsOf(entry.id), category: "workspace" })),
  ...APP_ENTRIES.map((entry): Tool => withDeploys({ ...entry, lists: ["app"], category: "workspace" })),
  ...RUNTIME_ENTRIES.map((entry): Tool => withDeploys({ ...entry, lists: ["ai"], category: "runtime" })),
  /* SV-27 P8: in no picker list; offered only on the deployment kinds they fit. */
  ...PROVIDER_ENTRIES.map((entry): Tool => ({ ...entry, lists: [], category: "runtime" })),
];

/** SV-27 P8: the providers offered on a deployment kind, the model run's engine or a model router. */
export const providersFor = (fit: ProviderFit): Tool[] => TOOLS.filter((tool) => tool.deploys?.includes(fit) && tool.status === "current");

/**
 * CA-13 rule 5: THE ONE FILTER. Anything that picks where work was done (a session, a prompt, an agent's tool, "Written
 * with") reads its tools through this, so a runtime model is never offered there. Written once; use it everywhere.
 */
export const excludeRuntime = <T extends Pick<Tool, "category">>(tools: readonly T[]): T[] => tools.filter((tool) => tool.category !== "runtime");

/** CA-13: the Runtime models and services subcategory, in group order. The Decision dialog, helpers, "Runs in" and answer shapes show it first. */
export const RUNTIME_TOOLS: readonly Tool[] = RUNTIME_GROUPS.flatMap((group) => TOOLS.filter((tool) => tool.group === group.key));

/** CA-12 P13: where the AI work was done. Sessions, prompts, an agent's "Runs in" and code's "Written with" pick from this. */
export const AI_TOOLS: readonly Tool[] = TOOLS.filter((tool) => tool.lists.includes("ai"));

/** CA-13: AI tools where work is done: the list session and prompt pickers offer, with the runtime subcategory taken out. */
export const WORKSPACE_AI_TOOLS: readonly Tool[] = excludeRuntime(AI_TOOLS);

/** CA-12 P13: what the AI or the maker worked with. A Tool tile, a manual step's "Where was it done?" and an agent's tools pick from this. */
export const APPS: readonly Tool[] = TOOLS.filter((tool) => tool.lists.includes("app"));

export const APP_GROUP_LABEL = "Apps and services";

/** CA-12 P13: the apps the picker offers first. */
export const SUGGESTED_APPS: readonly string[] = ["github", "supabase", "stripe", "slack", "gmail", "google-drive"];

/** The picker's first rows. Never a retired tool. */
export const SUGGESTED_TOOLS: readonly string[] = ["chatgpt", "claude", "claude-code", "gemini", "cursor", "lovable"];

/** Lower case with spaces, `-`, `_` and `.` removed. */
const squash = (raw: string): string => raw.toLowerCase().replace(/[\s._-]+/g, "");

const BY_SPELLING: ReadonlyMap<string, Tool> = (() => {
  const map = new Map<string, Tool>();
  for (const tool of TOOLS) {
    for (const spelling of [tool.id, tool.name, ...tool.aliases]) {
      const key = squash(spelling);
      if (key && !map.has(key)) map.set(key, tool);
    }
  }
  return map;
})();

/** The tool whose id, name or other spelling matches, or null. */
export function toolFor(raw: string | null | undefined): Tool | null {
  if (typeof raw !== "string") return null;
  const key = squash(raw);
  return key ? (BY_SPELLING.get(key) ?? null) : null;
}

/** Whether a tool can be picked for something new: every tool but a retired one. */
export function isPickable(tool: Tool): boolean {
  return tool.status !== "retired";
}

/** That tool's name, or null. */
export function toolName(raw: string | null | undefined): string | null {
  return toolFor(raw)?.name ?? null;
}

/** The group's tools, in list order. */
export function toolsInGroup(key: ToolGroupKey): Tool[] {
  return TOOLS.filter((tool) => tool.group === key);
}

/** Whether a file name is this project file: the same name in any case, or the end of a path. A folder takes any path under it. */
export function matchesProjectFile(fileName: string, projectFile: string): boolean {
  const name = fileName.trim().replace(/\\/g, "/").toLowerCase();
  const want = projectFile.toLowerCase();
  if (!want.endsWith("/")) return name === want || name.endsWith(`/${want}`);
  // Cursor's rules are .mdc files, wherever they were picked up from.
  return name.endsWith(".mdc") || name.startsWith(want) || name.includes(`/${want}`);
}

/** The tool among `toolIds` whose project file this is, or null. */
export function projectFileOf(fileName: string, toolIds: readonly string[]): Tool | null {
  for (const id of toolIds) {
    const tool = TOOLS.find((candidate) => candidate.id === id);
    if (tool?.projectFiles?.some((projectFile) => matchesProjectFile(fileName, projectFile))) return tool;
  }
  return null;
}

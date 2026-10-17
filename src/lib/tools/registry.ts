// Every AI tool the site knows: its name, its group, its logo and the other spellings people type.
//
// THE PRODUCT OWNER KEEPS THIS LIST CURRENT. Adding a tool is one line in TOOLS. A tool with `logo: null` shows its
// name alone. Pure: `components/brand/ModelMark.tsx` owns the logo files, and `models/marks.ts` reads this list.

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

export type ToolGroupKey = "chat" | "coding" | "builders" | "agents" | "automation" | "image" | "video" | "audio" | "notes" | "design" | "other";

export interface Tool {
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
  /** App builders: the words readers see on the link to the maker's project there. */
  projectLink?: string;
}

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

export const TOOLS: readonly Tool[] = [
  { id: "chatgpt", name: "ChatGPT", group: "chat", logo: "openai", aliases: ["chat gpt", "chatgpt.com"], client: "chatgpt" },
  { id: "gemini", name: "Gemini", group: "chat", logo: "gemini-color", aliases: ["google gemini", "gemini.google.com"] },
  { id: "deepseek", name: "DeepSeek", group: "chat", logo: "deepseek-color", aliases: ["deep seek", "chat.deepseek.com"] },
  { id: "grok", name: "Grok", group: "chat", logo: "grok", aliases: ["grok.com"] },
  { id: "claude", name: "Claude", group: "chat", logo: "claude-color", aliases: ["claude.ai"], client: "claude" },
  { id: "perplexity", name: "Perplexity", group: "chat", logo: "perplexity-color", aliases: ["perplexity ai", "perplexity.ai"] },
  { id: "character-ai", name: "Character.AI", group: "chat", logo: null, aliases: ["character ai", "c.ai"] },
  { id: "claude-code", name: "Claude Code", group: "coding", logo: "claudecode-color", aliases: ["claudecode"], client: "claude-code" },
  { id: "github-copilot", name: "GitHub Copilot", group: "coding", logo: "githubcopilot", aliases: ["gh copilot"] },
  { id: "codex", name: "Codex", group: "coding", logo: "codex-color", aliases: ["openai codex", "codex cli"] },
  { id: "cursor", name: "Cursor", group: "coding", logo: "cursor", aliases: ["cursor ai", "cursor.com"], client: "cursor" },
  { id: "devin-desktop", name: "Devin Desktop", group: "coding", logo: "devin-color", aliases: ["windsurf", "windsurf ide"] },
  { id: "antigravity", name: "Antigravity", group: "coding", logo: "antigravity-color", aliases: ["google antigravity"] },
  { id: "google-ai-studio", name: "Google AI Studio", group: "builders", logo: "aistudio", aliases: ["ai studio", "aistudio.google.com"], projectLink: "Open the app in Google AI Studio" },
  { id: "lovable", name: "Lovable", group: "builders", logo: "lovable-color", aliases: ["lovable.dev"], projectLink: "Open the project in Lovable" },
  { id: "replit", name: "Replit", group: "builders", logo: "replit-color", aliases: ["replit agent"], projectLink: "Open the project in Replit" },
  { id: "v0", name: "v0", group: "builders", logo: "v0", aliases: ["v0.dev", "v0.app", "v0 by vercel"], projectLink: "Open the project in v0" },
  { id: "bolt", name: "Bolt", group: "builders", logo: "bolt-color", aliases: ["bolt.new"], projectLink: "Open the project in Bolt" },
  { id: "base44", name: "Base44", group: "builders", logo: null, aliases: ["base 44"], projectLink: "Open the app in Base44" },
  { id: "manus", name: "Manus", group: "agents", logo: "manus", aliases: ["manus ai", "manus.im"] },
  { id: "openclaw", name: "OpenClaw", group: "agents", logo: "openclaw-color", aliases: ["open claw"] },
  { id: "hermes-agent", name: "Hermes Agent", group: "agents", logo: "hermesagent", aliases: [] },
  { id: "muse", name: "Muse", group: "agents", logo: null, aliases: ["meta muse", "muse by meta"] },
  { id: "n8n", name: "n8n", group: "automation", logo: "n8n-color", aliases: ["n8n.io"] },
  { id: "zapier", name: "Zapier", group: "automation", logo: "zapier-color", aliases: ["zapier.com"] },
  { id: "make", name: "Make", group: "automation", logo: "make-color", aliases: ["make.com", "integromat"] },
  { id: "comfyui", name: "ComfyUI", group: "automation", logo: "comfyui-color", aliases: ["comfy ui"] },
  { id: "midjourney", name: "Midjourney", group: "image", logo: "midjourney", aliases: ["mid journey"] },
  { id: "nano-banana", name: "Nano Banana", group: "image", logo: "nanobanana-color", aliases: ["nano banana pro"] },
  { id: "kling", name: "Kling", group: "video", logo: "kling-color", aliases: ["kling ai"] },
  { id: "sora", name: "Sora", group: "video", logo: "sora-color", aliases: ["openai sora"] },
  { id: "higgsfield", name: "Higgsfield", group: "video", logo: "higgsfield", aliases: ["higgsfield ai"] },
  { id: "veo", name: "Veo", group: "video", logo: null, aliases: ["google veo"] },
  { id: "suno", name: "Suno", group: "audio", logo: "suno", aliases: ["suno ai"] },
  { id: "elevenlabs", name: "ElevenLabs", group: "audio", logo: "elevenlabs", aliases: ["eleven labs", "11labs"] },
  { id: "notion", name: "Notion", group: "notes", logo: "notion", aliases: ["notion ai"] },
  { id: "gemini-notebook", name: "Gemini Notebook", group: "notes", logo: "notebooklm", aliases: ["notebooklm", "notebooklm.google"] },
  { id: "gamma", name: "Gamma", group: "notes", logo: null, aliases: ["gamma.app"] },
  { id: "figma", name: "Figma", group: "design", logo: "figma-color", aliases: ["figma make"] },
  { id: "canva", name: "Canva", group: "design", logo: "canva-color", aliases: ["canva ai"] },
  { id: "vercel", name: "Vercel", group: "other", logo: "vercel", aliases: [] },
  { id: "gmail", name: "Gmail", group: "other", logo: "mail", aliases: ["google mail"] },
];

/** The picker's first rows. */
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

/** That tool's name, or null. */
export function toolName(raw: string | null | undefined): string | null {
  return toolFor(raw)?.name ?? null;
}

/** The group's tools, in list order. */
export function toolsInGroup(key: ToolGroupKey): Tool[] {
  return TOOLS.filter((tool) => tool.group === key);
}

/** A project link can be at most this long. */
export const PROJECT_LINK_MAX = 500;

/** The address trimmed if it is an https address of at most 500 characters, else null. */
export function cleanProjectLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > PROJECT_LINK_MAX) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

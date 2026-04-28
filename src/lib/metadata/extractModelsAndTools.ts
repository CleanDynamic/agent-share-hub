import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical AI model keys mapped to their search aliases.
 * Aliases are matched case-insensitively against prompt/system-prompt text.
 */
export const MODEL_ALIASES: Record<string, string[]> = {
  "gpt-4o": ["gpt-4o", "gpt 4o", "gpt4o"],
  "gpt-4": ["gpt-4", "gpt 4", "gpt4"],
  "gpt-3.5": ["gpt-3.5", "gpt 3.5", "gpt35"],
  "claude-sonnet-4": ["claude sonnet 4", "sonnet 4", "claude 4 sonnet"],
  "claude-opus-4": ["claude opus 4", "opus 4"],
  "claude-haiku-4": ["claude haiku", "haiku 4"],
  "gemini-2-flash": ["gemini flash", "gemini 2 flash", "gemini-flash"],
  "gemini-2-pro": ["gemini pro", "gemini 2 pro"],
  "llama-3": ["llama 3", "llama-3", "llama3"],
  "mistral-large": ["mistral large", "mistral-large"],
  "grok-2": ["grok 2", "grok-2", "grok2"],
  "deepseek-v3": ["deepseek", "deepseek v3", "deepseek-v3"],
  "qwen-2.5": ["qwen", "qwen 2.5"],
};

/**
 * Canonical tool keys mapped to their search aliases.
 */
export const TOOL_ALIASES: Record<string, string[]> = {
  zapier: ["zapier"],
  n8n: ["n8n"],
  make: ["make.com", "integromat"],
  huggingface: ["huggingface", "hugging face"],
  ollama: ["ollama"],
  "lm-studio": ["lm studio", "lmstudio"],
  jan: ["jan.ai", "jan ai"],
  llamacpp: ["llama.cpp", "llamacpp"],
  langchain: ["langchain"],
  langgraph: ["langgraph"],
  crewai: ["crewai", "crew ai"],
  autogen: ["autogen"],
  polymarket: ["polymarket"],
  zenrows: ["zenrows"],
  apify: ["apify"],
  browserless: ["browserless"],
  playwright: ["playwright"],
  puppeteer: ["puppeteer"],
  supabase: ["supabase"],
  firebase: ["firebase"],
  vercel: ["vercel"],
  cloudflare: ["cloudflare"],
  modal: ["modal.com", "modal labs"],
  replicate: ["replicate"],
  pinecone: ["pinecone"],
  weaviate: ["weaviate"],
  qdrant: ["qdrant"],
  chroma: ["chroma db", "chromadb"],
};

type BlockRow = {
  block_type: string | null;
  text_content: string | null;
  formatting: Record<string, unknown> | null;
};

type ItemRow = {
  article_body: unknown | null;
};

/**
 * Recursively walk any JSON value and collect all string leaves.
 * Used to flatten TipTap document JSON into searchable prose.
 */
function collectStrings(node: unknown, out: string[]): void {
  if (node == null) return;
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
    return;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      collectStrings(v, out);
    }
  }
}

/** Scan haystack for any alias of any canonical key, return matched keys. */
function matchAliases(
  haystack: string,
  aliases: Record<string, string[]>
): Set<string> {
  const matched = new Set<string>();
  if (!haystack) return matched;
  const lower = haystack.toLowerCase();
  for (const [canonical, variants] of Object.entries(aliases)) {
    for (const alias of variants) {
      if (lower.indexOf(alias.toLowerCase()) !== -1) {
        matched.add(canonical);
        break;
      }
    }
  }
  return matched;
}

/** Fetch all blocks + the article body in two parallel queries. */
async function fetchPostContent(
  contentItemId: string
): Promise<{ blocks: BlockRow[]; item: ItemRow | null }> {
  const [blocksRes, itemRes] = await Promise.all([
    supabase
      .from("content_blocks")
      .select("block_type, text_content, formatting")
      .eq("content_id", contentItemId),
    supabase
      .from("content_items")
      .select("article_body")
      .eq("id", contentItemId)
      .maybeSingle(),
  ]);

  return {
    blocks: (blocksRes.data as BlockRow[] | null) ?? [],
    item: (itemRes.data as ItemRow | null) ?? null,
  };
}

/**
 * Extract canonical model identifiers referenced by the post.
 * - Reads explicit Model blocks (formatting.modelName)
 * - Scans Prompt block prompt + systemPrompt text for aliases
 * - For blog-style posts (no blocks), scans article_body prose
 */
export async function extractModels(
  contentItemId: string
): Promise<string[]> {
  if (!contentItemId) return [];
  const { blocks, item } = await fetchPostContent(contentItemId);
  const found = new Set<string>();

  for (const b of blocks) {
    const fmt = (b.formatting ?? {}) as Record<string, unknown>;

    if (b.block_type === "model") {
      const name = typeof fmt.modelName === "string" ? fmt.modelName : null;
      if (name && name.trim()) found.add(name.trim());
    }

    if (b.block_type === "prompt") {
      const parts: string[] = [];
      if (typeof fmt.prompt === "string") parts.push(fmt.prompt);
      if (typeof fmt.systemPrompt === "string") parts.push(fmt.systemPrompt);
      if (b.text_content) parts.push(b.text_content);
      const matches = matchAliases(parts.join("\n"), MODEL_ALIASES);
      for (const m of matches) found.add(m);
    }
  }

  // Blog / prose fallback: scan article_body if there are no structured blocks.
  if (blocks.length === 0 && item?.article_body) {
    const strings: string[] = [];
    collectStrings(item.article_body, strings);
    const matches = matchAliases(strings.join("\n"), MODEL_ALIASES);
    for (const m of matches) found.add(m);
  }

  return Array.from(found).sort();
}

/**
 * Extract canonical tool identifiers referenced by the post.
 * - Reads explicit Tool blocks (formatting.name)
 * - Scans Prompt + Code block text for aliases
 * - Scans article_body prose for aliases
 */
export async function extractTools(contentItemId: string): Promise<string[]> {
  if (!contentItemId) return [];
  const { blocks, item } = await fetchPostContent(contentItemId);
  const found = new Set<string>();

  const proseChunks: string[] = [];

  for (const b of blocks) {
    const fmt = (b.formatting ?? {}) as Record<string, unknown>;

    if (b.block_type === "tool") {
      const name = typeof fmt.name === "string" ? fmt.name : null;
      if (name && name.trim()) found.add(name.trim());
    }

    if (b.block_type === "prompt") {
      if (typeof fmt.prompt === "string") proseChunks.push(fmt.prompt);
      if (typeof fmt.systemPrompt === "string")
        proseChunks.push(fmt.systemPrompt);
      if (b.text_content) proseChunks.push(b.text_content);
    }

    if (b.block_type === "code") {
      if (typeof fmt.code === "string") proseChunks.push(fmt.code);
      if (b.text_content) proseChunks.push(b.text_content);
    }
  }

  // Always include article_body prose if present.
  if (item?.article_body) {
    collectStrings(item.article_body, proseChunks);
  }

  const matches = matchAliases(proseChunks.join("\n"), TOOL_ALIASES);
  for (const m of matches) found.add(m);

  return Array.from(found).sort();
}

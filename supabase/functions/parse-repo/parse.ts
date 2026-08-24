// =============================================================================
// NeoScale — parse-repo (NS-P21): the reading
// =============================================================================
// Pure. A snapshot in, a ParseResult out. Imports only the shared intake
// substrate and types, touches no Deno API, performs no I/O — which is what
// lets the whole of it be exercised without a network or a running Supabase,
// and what let this envelope be checked against parse-transcript's and
// parse-lovable's before it was ever deployed.
//
// THE ENVELOPE IS parse-transcript's, UNCHANGED, and _shared/intake/envelope.ts
// was not edited. Every field NS-P13 returns is returned here with the same
// name, type and meaning. The two things this reader adds it adds by NARROWING
// the shared types rather than by redefining or amending them, which is what
// the substrate README asks for:
//
//   source_ref gains `repo`, `ref` and `file`. NS-P21's sixth acceptance test
//   is that a materialised node names the file it came from, and source_ref is
//   where build_nodes already keeps provenance. An intersection is assignable
//   to the shared SourceRef, so materialiseProposal consumes it unchanged and
//   the extra keys ride into the jsonb column through the spread it already
//   does.
//
//   summary gains `proposed_made_with`. made_with is a builds column exactly
//   like title and outcome, and ProposedField is how this envelope has always
//   modelled a proposed builds column. Same intersection, same reason.
//
// WHAT A REPOSITORY IS NOT. It is not a session. There is no ordered exchange
// to read, so `events` is ALWAYS EMPTY and the turn counts are all zero. That
// is not a gap to fill later: inventing events out of a file listing would put
// a sequence in front of a creator that never happened. The counts stay in the
// envelope because the envelope has them, and they answer honestly.
//
// A REPOSITORY IS A SUGGESTION SOURCE, NOT AN IMPORT TARGET. One code node for
// one unambiguous entrypoint, and nothing else of the source comes across.
// =============================================================================

import type {
  ParseOptions as SharedParseOptions,
  ParseResult as SharedParseResult,
  ParseSummary as SharedParseSummary,
  ParseWarning as SharedParseWarning,
  ProposedEvent as SharedProposedEvent,
  ProposedField as SharedProposedField,
  ProposedNode as SharedProposedNode,
  SourceRef as SharedSourceRef,
} from "../_shared/intake/index.ts";
import {
  createLocalIdMinter,
  guessed,
  sourceRefFor,
  verbatim,
} from "../_shared/intake/index.ts";
import {
  fileAt,
  hasPath,
  type RegistryTool,
  type RepoSnapshot,
} from "./snapshot.ts";

// -----------------------------------------------------------------------------
// Limits
// -----------------------------------------------------------------------------

/** A stack node past this is a dependency dump rather than a description. */
export const MAX_STACK_ENTRIES = 20;
/** Prerequisites past this stop being a checklist. */
export const MAX_PREREQUISITES = 14;
/** .env keys past this are configuration, not prerequisites. */
export const MAX_ENV_KEYS = 12;
/** An outcome is a sentence or two, not a README. */
export const MAX_OUTCOME_CHARS = 400;
/** One entrypoint, excerpted. NS-P21 forbids importing whole repositories. */
export const MAX_CODE_CHARS = 20_000;
export const MAX_TITLE_CHARS = 120;
export const MAX_REQUIREMENT_CHARS = 300;

// -----------------------------------------------------------------------------
// Types — the shared envelope, narrowed
// -----------------------------------------------------------------------------

/** The one shape this reader detects. Named for what was read, not for GitHub. */
export type DetectedFormat = "github-repo";

/**
 * This reader emits no events, so there is no event kind. `never` says that in
 * the type rather than in a comment, and an empty array satisfies it.
 */
export type EventKind = never;

/**
 * `{source, session_id, index}` plus where in the repository it came from.
 *
 * `index` is a READ ORDER, 1..N, over the items this reader proposes — not a
 * turn, because a repository has none. It stays in the envelope because it is
 * the key materialiseProposal derives an event link from, and with no events to
 * link to it correctly resolves to null for every node.
 *
 * `file` is null on exactly one node: the repo node, which is read out of the
 * repository record rather than out of a file. `repo` and `ref` are set on all
 * of them, so provenance is complete either way.
 */
export type SourceRef = SharedSourceRef<"repo"> & {
  /** `owner/repo`, as read. */
  repo: string;
  /** The commit-ish every read was pinned to: the default branch. */
  ref: string;
  /** Repo-relative path, or null for the repository record itself. */
  file: string | null;
};

export type ProposedEvent = SharedProposedEvent<"repo", EventKind>;

export type ProposedNode = Omit<SharedProposedNode<"repo">, "source_ref"> & {
  source_ref: SourceRef;
};

export type ProposedField = Omit<SharedProposedField<"repo">, "source_ref"> & {
  source_ref: SourceRef;
};

export type ParseWarning = SharedParseWarning;

/**
 * The shared summary, narrowed, plus the made_with candidates NS-P21 asks for.
 *
 * turn_count, user_turn_count and assistant_turn_count are all 0 and
 * detected_labels is empty on both sides. A repository has no turns and no
 * speakers; zero is the honest answer and the fields keep their names because
 * the client reads them by name.
 */
export type ParseSummary = Omit<
  SharedParseSummary<DetectedFormat, "repo">,
  "proposed_title" | "proposed_outcome"
> & {
  proposed_title: ProposedField | null;
  proposed_outcome: ProposedField | null;
  /**
   * Canonical tool names for builds.made_with, one field each so a creator can
   * drop any of them. Registry-matched where a match exists, which is what lets
   * the gallery facet join cleanly.
   */
  proposed_made_with: ProposedField[];
  /**
   * NS-P21's hard limit, made visible. `files_fetched` counts every GitHub
   * request this parse spent and can never exceed `fetch_budget`, so checking
   * the cap is reading one number rather than auditing the call sites — and a
   * creator looking at a thin proposal can see whether it ran out of reads.
   */
  files_fetched: number;
  fetch_budget: number;
};

export type ParseResult = Omit<
  SharedParseResult<DetectedFormat, "repo", EventKind>,
  "nodes" | "summary"
> & {
  nodes: ProposedNode[];
  summary: ParseSummary;
};

export type ParseOptions = SharedParseOptions;

/** One row of the stack node's `layers` list. Matches node_types.stack. */
export interface StackEntry {
  layer: string;
  tool: string;
  version: string | null;
}

// -----------------------------------------------------------------------------
// The tool table
// -----------------------------------------------------------------------------
// What a package name means, in the two terms the stack node holds: which layer
// it sits at, and what it is called in prose. Keyed by the name as a manifest
// spells it, lowercased.
//
// `registry` is the candidate list looked up in ai_tools_registry, and it is
// deliberately CONSERVATIVE. The `openai` package is not ChatGPT and mapping it
// there to force a match would put a wrong canonical name into made_with, so
// where the registry has no honest row the display name below is used as-is and
// made_with carries the creator's own spelling — which the gallery already
// supports for unmatched tools.
//
// `ai: true` is what makes an entry a made_with candidate.

interface ToolFacts {
  tool: string;
  layer: string;
  ai?: boolean;
  registry?: string[];
}

const KNOWN_TOOLS: Record<string, ToolFacts> = {
  // --- languages and runtimes ------------------------------------------------
  typescript: { tool: "TypeScript", layer: "language" },
  deno: { tool: "Deno", layer: "runtime" },
  bun: { tool: "Bun", layer: "runtime" },

  // --- frameworks -----------------------------------------------------------
  react: { tool: "React", layer: "framework" },
  next: { tool: "Next.js", layer: "framework" },
  nuxt: { tool: "Nuxt", layer: "framework" },
  vue: { tool: "Vue", layer: "framework" },
  svelte: { tool: "Svelte", layer: "framework" },
  "@sveltejs/kit": { tool: "SvelteKit", layer: "framework" },
  "@angular/core": { tool: "Angular", layer: "framework" },
  "solid-js": { tool: "Solid", layer: "framework" },
  astro: { tool: "Astro", layer: "framework" },
  "@remix-run/react": { tool: "Remix", layer: "framework" },
  django: { tool: "Django", layer: "framework" },
  flask: { tool: "Flask", layer: "framework" },
  fastapi: { tool: "FastAPI", layer: "framework" },
  streamlit: { tool: "Streamlit", layer: "framework" },
  gradio: { tool: "Gradio", layer: "framework" },
  rails: { tool: "Rails", layer: "framework" },
  laravel: { tool: "Laravel", layer: "framework" },
  "laravel/framework": { tool: "Laravel", layer: "framework" },
  symfony: { tool: "Symfony", layer: "framework" },

  // --- ui and styling -------------------------------------------------------
  tailwindcss: { tool: "Tailwind CSS", layer: "styling" },
  sass: { tool: "Sass", layer: "styling" },
  "styled-components": { tool: "styled-components", layer: "styling" },
  "@emotion/react": { tool: "Emotion", layer: "styling" },
  "@mui/material": { tool: "MUI", layer: "ui" },
  "@chakra-ui/react": { tool: "Chakra UI", layer: "ui" },
  "framer-motion": { tool: "Framer Motion", layer: "ui" },
  "lucide-react": { tool: "Lucide", layer: "ui" },
  "@radix-ui/react-dialog": { tool: "Radix UI", layer: "ui" },

  // --- build ----------------------------------------------------------------
  vite: { tool: "Vite", layer: "build" },
  webpack: { tool: "webpack", layer: "build" },
  esbuild: { tool: "esbuild", layer: "build" },
  rollup: { tool: "Rollup", layer: "build" },
  parcel: { tool: "Parcel", layer: "build" },
  turbo: { tool: "Turborepo", layer: "build" },

  // --- backend and hosting --------------------------------------------------
  express: { tool: "Express", layer: "backend" },
  fastify: { tool: "Fastify", layer: "backend" },
  hono: { tool: "Hono", layer: "backend" },
  koa: { tool: "Koa", layer: "backend" },
  "@nestjs/core": { tool: "NestJS", layer: "backend" },
  "github.com/gin-gonic/gin": { tool: "Gin", layer: "backend" },
  "github.com/labstack/echo/v4": { tool: "Echo", layer: "backend" },
  "@supabase/supabase-js": { tool: "Supabase", layer: "backend" },
  supabase: { tool: "Supabase", layer: "backend" },
  firebase: { tool: "Firebase", layer: "backend" },
  "firebase-admin": { tool: "Firebase", layer: "backend" },
  uvicorn: { tool: "Uvicorn", layer: "backend" },
  gunicorn: { tool: "Gunicorn", layer: "backend" },

  // --- data -----------------------------------------------------------------
  prisma: { tool: "Prisma", layer: "database" },
  "@prisma/client": { tool: "Prisma", layer: "database" },
  "drizzle-orm": { tool: "Drizzle", layer: "database" },
  mongoose: { tool: "Mongoose", layer: "database" },
  sqlalchemy: { tool: "SQLAlchemy", layer: "database" },
  psycopg2: { tool: "PostgreSQL", layer: "database" },
  "psycopg2-binary": { tool: "PostgreSQL", layer: "database" },
  pg: { tool: "PostgreSQL", layer: "database" },
  mysql2: { tool: "MySQL", layer: "database" },
  redis: { tool: "Redis", layer: "database" },
  chromadb: { tool: "Chroma", layer: "database" },
  "pinecone-client": { tool: "Pinecone", layer: "database" },
  "@pinecone-database/pinecone": { tool: "Pinecone", layer: "database" },
  "weaviate-client": { tool: "Weaviate", layer: "database" },
  "qdrant-client": { tool: "Qdrant", layer: "database" },
  pandas: { tool: "pandas", layer: "data" },
  numpy: { tool: "NumPy", layer: "data" },

  // --- testing --------------------------------------------------------------
  vitest: { tool: "Vitest", layer: "testing" },
  jest: { tool: "Jest", layer: "testing" },
  mocha: { tool: "Mocha", layer: "testing" },
  pytest: { tool: "pytest", layer: "testing" },
  "@playwright/test": { tool: "Playwright", layer: "testing" },
  playwright: { tool: "Playwright", layer: "testing" },
  cypress: { tool: "Cypress", layer: "testing" },

  // --- AI. Every one of these is a made_with candidate ----------------------
  "@anthropic-ai/sdk": {
    tool: "Anthropic API", layer: "ai", ai: true,
    registry: ["Anthropic API", "Anthropic", "Claude"],
  },
  anthropic: {
    tool: "Anthropic API", layer: "ai", ai: true,
    registry: ["Anthropic API", "Anthropic", "Claude"],
  },
  "anthropic-sdk": {
    tool: "Anthropic API", layer: "ai", ai: true,
    registry: ["Anthropic API", "Anthropic", "Claude"],
  },
  openai: { tool: "OpenAI", layer: "ai", ai: true, registry: ["OpenAI", "OpenAI API"] },
  "@ai-sdk/openai": { tool: "OpenAI", layer: "ai", ai: true, registry: ["OpenAI", "OpenAI API"] },
  "@ai-sdk/anthropic": {
    tool: "Anthropic API", layer: "ai", ai: true,
    registry: ["Anthropic API", "Anthropic", "Claude"],
  },
  ai: { tool: "Vercel AI SDK", layer: "ai", ai: true, registry: ["Vercel AI SDK"] },
  langchain: { tool: "LangChain", layer: "ai", ai: true, registry: ["LangChain"] },
  "langchain-core": { tool: "LangChain", layer: "ai", ai: true, registry: ["LangChain"] },
  "langchain-community": { tool: "LangChain", layer: "ai", ai: true, registry: ["LangChain"] },
  "langchain-openai": { tool: "LangChain", layer: "ai", ai: true, registry: ["LangChain"] },
  "langchain-anthropic": { tool: "LangChain", layer: "ai", ai: true, registry: ["LangChain"] },
  "@langchain/core": { tool: "LangChain", layer: "ai", ai: true, registry: ["LangChain"] },
  "@langchain/openai": { tool: "LangChain", layer: "ai", ai: true, registry: ["LangChain"] },
  "@langchain/anthropic": { tool: "LangChain", layer: "ai", ai: true, registry: ["LangChain"] },
  langgraph: { tool: "LangGraph", layer: "ai", ai: true, registry: ["LangGraph"] },
  "@langchain/langgraph": { tool: "LangGraph", layer: "ai", ai: true, registry: ["LangGraph"] },
  langsmith: { tool: "LangSmith", layer: "ai", ai: true, registry: ["LangSmith"] },
  llamaindex: { tool: "LlamaIndex", layer: "ai", ai: true, registry: ["LlamaIndex"] },
  "llama-index": { tool: "LlamaIndex", layer: "ai", ai: true, registry: ["LlamaIndex"] },
  ollama: { tool: "Ollama", layer: "ai", ai: true, registry: ["Ollama"] },
  openrouter: { tool: "OpenRouter", layer: "ai", ai: true, registry: ["OpenRouter"] },
  litellm: { tool: "LiteLLM", layer: "ai", ai: true, registry: ["LiteLLM"] },
  transformers: { tool: "Hugging Face Transformers", layer: "ai", ai: true, registry: ["Hugging Face"] },
  "huggingface-hub": { tool: "Hugging Face", layer: "ai", ai: true, registry: ["Hugging Face"] },
  "@huggingface/inference": { tool: "Hugging Face", layer: "ai", ai: true, registry: ["Hugging Face"] },
  "cohere-ai": { tool: "Cohere", layer: "ai", ai: true, registry: ["Cohere"] },
  cohere: { tool: "Cohere", layer: "ai", ai: true, registry: ["Cohere"] },
  "@mistralai/mistralai": { tool: "Mistral", layer: "ai", ai: true, registry: ["Mistral Le Chat", "Mistral"] },
  mistralai: { tool: "Mistral", layer: "ai", ai: true, registry: ["Mistral Le Chat", "Mistral"] },
  "@google/generative-ai": { tool: "Gemini", layer: "ai", ai: true, registry: ["Gemini"] },
  "google-generativeai": { tool: "Gemini", layer: "ai", ai: true, registry: ["Gemini"] },
  "groq-sdk": { tool: "Groq", layer: "ai", ai: true, registry: ["Groq"] },
  groq: { tool: "Groq", layer: "ai", ai: true, registry: ["Groq"] },
  replicate: { tool: "Replicate", layer: "ai", ai: true, registry: ["Replicate"] },
  "together-ai": { tool: "Together AI", layer: "ai", ai: true, registry: ["Together AI"] },
  crewai: { tool: "CrewAI", layer: "ai", ai: true, registry: ["CrewAI"] },
  pyautogen: { tool: "AutoGen", layer: "ai", ai: true, registry: ["AutoGen"] },
  autogen: { tool: "AutoGen", layer: "ai", ai: true, registry: ["AutoGen"] },
  "pydantic-ai": { tool: "PydanticAI", layer: "ai", ai: true, registry: ["PydanticAI"] },
  "haystack-ai": { tool: "Haystack", layer: "ai", ai: true, registry: ["Haystack"] },
  instructor: { tool: "Instructor", layer: "ai", ai: true, registry: ["Instructor"] },
  tiktoken: { tool: "tiktoken", layer: "ai", ai: true, registry: ["tiktoken"] },
  "sentence-transformers": { tool: "Sentence Transformers", layer: "ai", ai: true },
  torch: { tool: "PyTorch", layer: "ai", ai: true, registry: ["PyTorch"] },
  tensorflow: { tool: "TensorFlow", layer: "ai", ai: true, registry: ["TensorFlow"] },
};

/**
 * Names that describe the toolchain rather than the build, and would crowd a
 * stack node out of usefulness. Dropped before the cap is applied, so dropping
 * them buys room for something a reader cares about.
 */
const NOISE_EXACT = new Set([
  "react-dom", "tslib", "globals", "postcss", "autoprefixer", "eslint",
  "prettier", "npm", "pip", "setuptools", "wheel", "typing-extensions",
  "@vitejs/plugin-react", "@vitejs/plugin-react-swc", "vite-tsconfig-paths",
  "ts-node", "tsx", "nodemon", "rimraf", "cross-env", "dotenv",
]);

const NOISE_PREFIX = ["@types/", "@typescript-eslint/", "eslint-", "eslint@", "@eslint/", "prettier-"];

function isNoise(name: string): boolean {
  const lower = name.toLowerCase();
  if (NOISE_EXACT.has(lower)) return true;
  return NOISE_PREFIX.some((prefix) => lower.startsWith(prefix));
}

/** Reading order for the stack node, so it describes rather than lists. */
const LAYER_ORDER = [
  "language", "runtime", "framework", "ui", "styling", "build", "backend",
  "database", "data", "ai", "testing", "tooling", "dependency",
];

function layerRank(layer: string): number {
  const index = LAYER_ORDER.indexOf(layer);
  return index === -1 ? LAYER_ORDER.length : index;
}

// -----------------------------------------------------------------------------
// Small readers
// -----------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normaliseNewlines(raw: string): string {
  return raw.replace(/\r\n?/g, "\n");
}

function collapse(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function clip(raw: string, max: number): string {
  const text = raw.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * `^18.2.0` -> `18.2.0`, `>=3.10` -> `3.10`, `*` -> null.
 *
 * The range operator is dropped rather than kept: a stack node is read by a
 * person deciding whether they can run this, and "18.2.0" answers that where
 * "^18.2.0" makes them parse npm's grammar first. The manifest is still linked
 * from the node's source_ref for anyone who needs the exact constraint.
 */
function readVersion(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/^[\^~>=<\s]+/, "").replace(/[,\s].*$/, "").trim();
  if (!cleaned || cleaned === "*" || cleaned === "latest") return null;
  if (/^(?:workspace|file|link|git|github|https?):/i.test(raw.trim())) return null;
  return cleaned.slice(0, 40);
}

interface Dependency {
  name: string;
  version: string | null;
}

interface ManifestReading {
  /** The path this was read out of. Becomes source_ref.file. */
  file: string;
  /** The language or runtime the manifest itself proves. */
  base: StackEntry | null;
  dependencies: Dependency[];
  /** The project's own name and description, where the manifest carries them. */
  name: string | null;
  description: string | null;
}

function emptyReading(file: string): ManifestReading {
  return { file, base: null, dependencies: [], name: null, description: null };
}

// --- package.json -------------------------------------------------------------

function readPackageJson(text: string, file: string): ManifestReading {
  const reading = emptyReading(file);
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return reading;
  }
  if (!isRecord(root)) return reading;

  const engines = isRecord(root.engines) ? root.engines : {};
  reading.base = {
    layer: "runtime",
    tool: "Node.js",
    version: readVersion(engines.node),
  };
  if (typeof root.name === "string" && root.name.trim()) reading.name = root.name.trim();
  if (typeof root.description === "string" && root.description.trim()) {
    reading.description = root.description.trim();
  }

  for (const key of ["dependencies", "devDependencies"]) {
    const block = root[key];
    if (!isRecord(block)) continue;
    for (const [name, version] of Object.entries(block)) {
      reading.dependencies.push({ name, version: readVersion(version) });
    }
  }
  return reading;
}

// --- requirements.txt ---------------------------------------------------------

const REQUIREMENT_LINE = /^([A-Za-z0-9._-]+)\s*(?:\[[^\]]*\])?\s*(?:([=<>!~]+)\s*([^\s;,#]+))?/;

function readRequirementsTxt(text: string, file: string): ManifestReading {
  const reading = emptyReading(file);
  reading.base = { layer: "language", tool: "Python", version: null };

  for (const rawLine of normaliseNewlines(text).split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    // -r other.txt, -e ., --index-url …, and VCS installs carry no clean name.
    if (line.startsWith("-") || /^(?:git|https?|file)\+?:/i.test(line)) continue;

    const match = REQUIREMENT_LINE.exec(line);
    if (!match) continue;
    reading.dependencies.push({ name: match[1], version: readVersion(match[3]) });
  }
  return reading;
}

// --- pyproject.toml -----------------------------------------------------------
//
// Deliberately not a TOML parser. Four keys are wanted out of two known tables,
// and a targeted reader that returns nothing on an unfamiliar shape is a
// smaller thing to be wrong about than a hand-rolled TOML grammar.

function readPyprojectToml(text: string, file: string): ManifestReading {
  const reading = emptyReading(file);
  const lines = normaliseNewlines(text).split("\n");

  let table = "";
  let inArray: string | null = null;
  let pythonVersion: string | null = null;

  const stringValue = (raw: string): string | null => {
    const match = /^\s*["']([^"']*)["']\s*,?\s*$/.exec(raw);
    return match ? match[1] : null;
  };

  const pushRequirement = (spec: string) => {
    const match = REQUIREMENT_LINE.exec(spec.trim());
    if (!match) return;
    if (match[1].toLowerCase() === "python") {
      pythonVersion = readVersion(match[3]);
      return;
    }
    reading.dependencies.push({ name: match[1], version: readVersion(match[3]) });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (inArray) {
      if (line.startsWith("]")) {
        inArray = null;
        continue;
      }
      const value = stringValue(line);
      if (value) pushRequirement(value);
      continue;
    }

    const tableMatch = /^\[([^\]]+)\]/.exec(line);
    if (tableMatch) {
      table = tableMatch[1].trim();
      continue;
    }
    if (!line || line.startsWith("#")) continue;

    if (table === "project" || table === "tool.poetry") {
      const nameMatch = /^name\s*=\s*["']([^"']+)["']/.exec(line);
      if (nameMatch && !reading.name) reading.name = nameMatch[1];
      const descMatch = /^description\s*=\s*["']([^"']+)["']/.exec(line);
      if (descMatch && !reading.description) reading.description = descMatch[1];
    }

    if (table === "project") {
      const pyMatch = /^requires-python\s*=\s*["']([^"']+)["']/.exec(line);
      if (pyMatch) pythonVersion = readVersion(pyMatch[1]);

      if (/^dependencies\s*=\s*\[/.test(line)) {
        const inline = /\[(.*)\]/.exec(line);
        if (inline) {
          for (const part of inline[1].split(",")) {
            const value = stringValue(part) ?? part.replace(/["']/g, "").trim();
            if (value) pushRequirement(value);
          }
        } else {
          inArray = "dependencies";
        }
        continue;
      }
    }

    // Poetry spells dependencies as a table of key = constraint pairs.
    if (table === "tool.poetry.dependencies" || table === "tool.poetry.group.dev.dependencies") {
      const entry = /^([A-Za-z0-9._-]+)\s*=\s*(.+)$/.exec(line);
      if (!entry) continue;
      const constraint = /^["']([^"']*)["']/.exec(entry[2].trim());
      const version = constraint ? readVersion(constraint[1]) : null;
      if (entry[1].toLowerCase() === "python") {
        pythonVersion = version;
        continue;
      }
      reading.dependencies.push({ name: entry[1], version });
    }
  }

  reading.base = { layer: "language", tool: "Python", version: pythonVersion };
  return reading;
}

// --- go.mod -------------------------------------------------------------------

function readGoMod(text: string, file: string): ManifestReading {
  const reading = emptyReading(file);
  let goVersion: string | null = null;
  let inRequire = false;

  for (const rawLine of normaliseNewlines(text).split("\n")) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line) continue;

    if (inRequire) {
      if (line.startsWith(")")) {
        inRequire = false;
        continue;
      }
      const entry = /^(\S+)\s+(\S+)/.exec(line);
      if (entry) reading.dependencies.push({ name: entry[1], version: readVersion(entry[2]) });
      continue;
    }

    const moduleMatch = /^module\s+(\S+)/.exec(line);
    if (moduleMatch) {
      reading.name = moduleMatch[1].split("/").pop() ?? moduleMatch[1];
      continue;
    }
    const goMatch = /^go\s+(\S+)/.exec(line);
    if (goMatch) {
      goVersion = readVersion(goMatch[1]);
      continue;
    }
    if (/^require\s*\($/.test(line)) {
      inRequire = true;
      continue;
    }
    const single = /^require\s+(\S+)\s+(\S+)/.exec(line);
    if (single) reading.dependencies.push({ name: single[1], version: readVersion(single[2]) });
  }

  reading.base = { layer: "language", tool: "Go", version: goVersion };
  return reading;
}

// --- Gemfile ------------------------------------------------------------------

function readGemfile(text: string, file: string): ManifestReading {
  const reading = emptyReading(file);
  let rubyVersion: string | null = null;

  for (const rawLine of normaliseNewlines(text).split("\n")) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const ruby = /^ruby\s+["']([^"']+)["']/.exec(line);
    if (ruby) {
      rubyVersion = readVersion(ruby[1]);
      continue;
    }
    const gem = /^gem\s+["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?/.exec(line);
    if (gem) reading.dependencies.push({ name: gem[1], version: readVersion(gem[2]) });
  }

  reading.base = { layer: "language", tool: "Ruby", version: rubyVersion };
  return reading;
}

// --- composer.json ------------------------------------------------------------

function readComposerJson(text: string, file: string): ManifestReading {
  const reading = emptyReading(file);
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return reading;
  }
  if (!isRecord(root)) return reading;

  if (typeof root.name === "string" && root.name.trim()) reading.name = root.name.trim();
  if (typeof root.description === "string" && root.description.trim()) {
    reading.description = root.description.trim();
  }

  let phpVersion: string | null = null;
  for (const key of ["require", "require-dev"]) {
    const block = root[key];
    if (!isRecord(block)) continue;
    for (const [name, version] of Object.entries(block)) {
      if (name.toLowerCase() === "php") {
        phpVersion = readVersion(version);
        continue;
      }
      // ext-json, ext-mbstring and friends are PHP build flags, not tools.
      if (name.toLowerCase().startsWith("ext-")) continue;
      reading.dependencies.push({ name, version: readVersion(version) });
    }
  }

  reading.base = { layer: "language", tool: "PHP", version: phpVersion };
  return reading;
}

/** The six manifests NS-P21 names, each with the reader that understands it. */
const MANIFEST_READERS: { file: string; read: (text: string, file: string) => ManifestReading }[] = [
  { file: "package.json", read: readPackageJson },
  { file: "requirements.txt", read: readRequirementsTxt },
  { file: "pyproject.toml", read: readPyprojectToml },
  { file: "go.mod", read: readGoMod },
  { file: "Gemfile", read: readGemfile },
  { file: "composer.json", read: readComposerJson },
];

// -----------------------------------------------------------------------------
// Reading a README
// -----------------------------------------------------------------------------
// A README's first screen is badges, a centred logo and an HTML header block
// far more often than it is a sentence. Everything below exists to walk past
// that and reach the first line a person actually wrote.

const FENCE = /^\s*(?:```|~~~)/;
const ATX_HEADING = /^(#{1,6})\s+(.*)$/;
const SETEXT_UNDERLINE = /^[=-]{2,}\s*$/;
const HORIZONTAL_RULE = /^\s*(?:[-*_]\s*){3,}$/;

/** Markdown and HTML decoration off, the words left behind. */
function stripInline(line: string): string {
  return collapse(
    line
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")        // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")      // links keep their text
      .replace(/<[^>]+>/g, " ")                      // html tags
      .replace(/[`*_~]+/g, "")                       // emphasis and code ticks
      .replace(/^\s*>\s?/, ""),                      // blockquote marker
  );
}

/** A badge row, a logo block or a rule — decoration, never the description. */
function isDecoration(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (HORIZONTAL_RULE.test(trimmed)) return true;
  if (SETEXT_UNDERLINE.test(trimmed)) return true;
  if (/^\s*\|/.test(trimmed)) return true;           // table row
  const stripped = stripInline(trimmed);
  // Two or more word characters is the floor for "somebody wrote a sentence".
  return (stripped.match(/[A-Za-z0-9]/g) ?? []).length < 2;
}

function withoutFences(markdown: string): string[] {
  const lines = normaliseNewlines(markdown).replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const kept: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) kept.push(line);
  }
  return kept;
}

/**
 * The first paragraph a human wrote — headings, badges and HTML skipped.
 *
 * Returns null rather than a shrug when a README is nothing but decoration:
 * the caller falls back to the repository description, which is a better
 * outcome than a line of badge alt-text presented as one.
 */
export function firstParagraph(markdown: string): string | null {
  const lines = withoutFences(markdown);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (ATX_HEADING.test(line)) continue;
    if (isDecoration(line)) continue;
    // A line underlined with === or --- is a setext heading, not prose.
    if (index + 1 < lines.length && SETEXT_UNDERLINE.test(lines[index + 1])) {
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    for (let cursor = index; cursor < lines.length; cursor += 1) {
      const next = lines[cursor];
      if (!next.trim() || ATX_HEADING.test(next) || HORIZONTAL_RULE.test(next.trim())) break;
      if (cursor + 1 < lines.length && SETEXT_UNDERLINE.test(lines[cursor + 1])) break;
      const stripped = stripInline(next);
      if (stripped) paragraph.push(stripped);
    }

    const text = collapse(paragraph.join(" "));
    if (text) return text;
  }
  return null;
}

/** The README's H1, which is usually what the project calls itself. */
export function readmeTitle(markdown: string): string | null {
  const lines = withoutFences(markdown);
  for (let index = 0; index < lines.length; index += 1) {
    const atx = ATX_HEADING.exec(lines[index]);
    if (atx && atx[1].length === 1) {
      const text = stripInline(atx[2]);
      if (text) return text;
    }
    if (index + 1 < lines.length && SETEXT_UNDERLINE.test(lines[index + 1]) && !isDecoration(lines[index])) {
      const text = stripInline(lines[index]);
      if (text) return text;
    }
  }
  return null;
}

/** Heading text, comparable: lowercased, undecorated, no trailing punctuation. */
function headingKey(raw: string): string {
  return stripInline(raw).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The sections NS-P21 names, in preference order. The FIRST one present wins
 * and the rest are ignored: a repository with both Prerequisites and
 * Installation has already said which one holds the prerequisites, and reading
 * both would propose the same requirement twice under two headings.
 */
const PREREQUISITE_HEADINGS = [
  "prerequisites", "prerequisite", "requirements", "required", "requires",
  "before you begin", "before you start", "installation", "install",
  "setup", "set up", "getting started", "quick start", "quickstart",
];

interface Section {
  heading: string;
  lines: string[];
}

/** The first section whose heading matches, and everything under it. */
export function findSection(markdown: string, headings: string[]): Section | null {
  const lines = normaliseNewlines(markdown).replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const wanted = new Set(headings);

  for (let index = 0; index < lines.length; index += 1) {
    const atx = ATX_HEADING.exec(lines[index]);
    if (!atx) continue;
    const key = headingKey(atx[2]);
    if (!wanted.has(key)) continue;

    const level = atx[1].length;
    const body: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const heading = ATX_HEADING.exec(lines[cursor]);
      if (heading && heading[1].length <= level) break;
      body.push(lines[cursor]);
    }
    return { heading: stripInline(atx[2]), lines: body };
  }
  return null;
}

const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/;

/**
 * The section's bullets, with fenced blocks dropped.
 *
 * The fences are dropped deliberately: an Installation section's code blocks
 * are the commands you run, not the things you need first, and proposing
 * `npm install` as a prerequisite is noise a creator then has to clear.
 */
export function sectionBullets(section: Section): string[] {
  const items: string[] = [];
  let inFence = false;

  for (const line of section.lines) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const bullet = BULLET.exec(line);
    if (!bullet) continue;
    const text = stripInline(bullet[1]);
    if (text && (text.match(/[A-Za-z0-9]/g) ?? []).length >= 2) items.push(text);
  }
  return items;
}

/** A section with no bullets still says something. Its first paragraph. */
function sectionParagraph(section: Section): string | null {
  return firstParagraph(section.lines.join("\n"));
}

// -----------------------------------------------------------------------------
// Reading a .env.example
// -----------------------------------------------------------------------------

export interface EnvKey {
  key: string;
  /** The comment written on or above the line, where there is one. */
  comment: string | null;
}

const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*[=:]/;

export function readEnvKeys(text: string): EnvKey[] {
  const keys: EnvKey[] = [];
  const seen = new Set<string>();
  let pending: string | null = null;

  for (const rawLine of normaliseNewlines(text).split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      pending = null;
      continue;
    }
    if (line.startsWith("#")) {
      // A comment directly above a key explains it. Kept for `why`.
      const comment = line.replace(/^#+\s*/, "").trim();
      pending = comment || null;
      continue;
    }

    const match = ENV_LINE.exec(line);
    if (!match) {
      pending = null;
      continue;
    }

    const key = match[1];
    if (!seen.has(key)) {
      seen.add(key);
      const inline = /#\s*(.+)$/.exec(line);
      keys.push({ key, comment: inline ? inline[1].trim() : pending });
    }
    pending = null;
  }
  return keys;
}

// -----------------------------------------------------------------------------
// Canonical naming against ai_tools_registry
// -----------------------------------------------------------------------------

/**
 * name and slug, both lowercased, both pointing at the registry's own spelling.
 *
 * The registry is the authority on what a tool is CALLED so that made_with
 * joins cleanly — gallery_facets matches on lower(name) or lower(slug), and a
 * proposal that writes "anthropic" where the registry says "Anthropic API"
 * produces a facet nobody can filter on.
 */
export function buildRegistryIndex(registry: RegistryTool[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const tool of registry) {
    if (!tool?.name) continue;
    const canonical = tool.name;
    const nameKey = canonical.trim().toLowerCase();
    if (nameKey && !index.has(nameKey)) index.set(nameKey, canonical);
    if (tool.slug) {
      const slugKey = tool.slug.trim().toLowerCase();
      if (slugKey && !index.has(slugKey)) index.set(slugKey, canonical);
    }
  }
  return index;
}

/** The registry's spelling where it has one, the reader's where it does not. */
function canonicalise(
  index: Map<string, string>,
  candidates: string[],
  fallback: string,
): { tool: string; matched: boolean } {
  for (const candidate of candidates) {
    const hit = index.get(candidate.trim().toLowerCase());
    if (hit) return { tool: hit, matched: true };
  }
  return { tool: fallback, matched: false };
}

// -----------------------------------------------------------------------------
// Language for a code node
// -----------------------------------------------------------------------------

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "ts", tsx: "tsx", js: "js", mjs: "js", cjs: "js", jsx: "jsx",
  py: "python", sql: "sql", json: "json", yml: "yaml", yaml: "yaml",
  sh: "bash", bash: "bash", html: "html", css: "css",
};

/**
 * node_types.code.language is a CLOSED enum. An extension outside it is filed
 * as `other` with a warning rather than inventing a value the inspector cannot
 * render — the convention NS-P20's README asks the next parser to keep.
 */
function languageFor(path: string): { language: string; unmapped: boolean } {
  const extension = path.includes(".") ? path.split(".").pop()!.toLowerCase() : "";
  const language = LANGUAGE_BY_EXTENSION[extension];
  return language ? { language, unmapped: false } : { language: "other", unmapped: true };
}

// -----------------------------------------------------------------------------
// The entrypoint, and what makes one unambiguous
// -----------------------------------------------------------------------------
// Tiers, not a flat list. A tier with exactly one present path names the
// entrypoint; a tier with two is UNDECIDABLE and is skipped rather than guessed
// at, which is what NS-P21 means by "when it is unambiguous". github.ts imports
// this rather than keeping a second copy, so the file it fetches and the file
// this proposes are the same file by construction.

export const ENTRYPOINT_TIERS: string[][] = [
  ["src/main.ts", "src/main.tsx", "src/main.js", "src/main.jsx", "src/main.py", "src/main.go", "src/main.rs"],
  ["src/index.ts", "src/index.tsx", "src/index.js", "src/index.jsx"],
  ["app.py", "main.py", "main.go", "app.js", "server.js", "index.js", "index.ts", "manage.py"],
  ["src/app.ts", "src/app.tsx", "src/server.ts", "cmd/main.go"],
];

export function chooseEntrypoint(paths: Iterable<string>): { path: string | null; ambiguous: string[] } {
  const present = paths instanceof Set ? paths : new Set(paths);
  for (const tier of ENTRYPOINT_TIERS) {
    const found = tier.filter((candidate) => present.has(candidate));
    if (found.length === 1) return { path: found[0], ambiguous: [] };
    if (found.length > 1) return { path: null, ambiguous: found };
  }
  return { path: null, ambiguous: [] };
}

// -----------------------------------------------------------------------------
// What the tree alone proves
// -----------------------------------------------------------------------------
// A Dockerfile is a stack fact and costs no fetch to notice, because the tree
// request already listed it. These fill out a stack node for a repository whose
// manifest is thin, which is most of them.

const PATH_SIGNALS: { path: string; prefix?: boolean; tool: string; layer: string }[] = [
  { path: "Dockerfile", tool: "Docker", layer: "hosting" },
  { path: "docker-compose.yml", tool: "Docker", layer: "hosting" },
  { path: "docker-compose.yaml", tool: "Docker", layer: "hosting" },
  { path: "compose.yaml", tool: "Docker", layer: "hosting" },
  { path: "netlify.toml", tool: "Netlify", layer: "hosting" },
  { path: "vercel.json", tool: "Vercel", layer: "hosting" },
  { path: "fly.toml", tool: "Fly.io", layer: "hosting" },
  { path: "render.yaml", tool: "Render", layer: "hosting" },
  { path: "Procfile", tool: "Heroku", layer: "hosting" },
  { path: "supabase/config.toml", tool: "Supabase", layer: "backend" },
  { path: "tailwind.config.js", tool: "Tailwind CSS", layer: "styling" },
  { path: "tailwind.config.ts", tool: "Tailwind CSS", layer: "styling" },
  { path: ".github/workflows/", prefix: true, tool: "GitHub Actions", layer: "tooling" },
];

// -----------------------------------------------------------------------------
// The reading
// -----------------------------------------------------------------------------

/** A stack entry plus the two things the caller needs that the node does not hold. */
interface StackCandidate {
  entry: StackEntry;
  /** An AI SDK. Becomes a made_with candidate. */
  ai: boolean;
  /** The file that proved it. */
  file: string | null;
}

/**
 * A repository snapshot in, a proposal out.
 *
 * `registry` is ai_tools_registry, read by index.ts under the caller's RLS and
 * passed in rather than fetched here — the same reason everything else in this
 * file takes its input as an argument.
 */
export function parseRepo(
  snapshot: RepoSnapshot,
  registry: RegistryTool[],
  options: ParseOptions,
): ParseResult {
  const index = buildRegistryIndex(registry);
  const nextLocalId = createLocalIdMinter();
  const baseRef = sourceRefFor("repo", options.session_id);
  const slug = `${snapshot.owner}/${snapshot.repo}`;

  let readOrder = 0;
  /** Read order, not a turn. A repository has no turns — see SourceRef. */
  const refFor = (file: string | null): SourceRef => ({
    ...baseRef((readOrder += 1)),
    repo: slug,
    ref: snapshot.default_branch,
    file,
  });

  const nodes: ProposedNode[] = [];
  const warnings: ParseWarning[] = [];

  for (const skipped of snapshot.skipped) {
    warnings.push({
      code: skipped.reason === "too_large" ? "file_too_large" : "fetch_budget_spent",
      message: skipped.reason === "too_large"
        ? `${skipped.path} is ${Math.round(skipped.size / 1024)}KB, over the 200KB this reads. ` +
          `It was listed but not opened.`
        : `${skipped.path} was not read: this parse had already spent its ${snapshot.fetch_budget} ` +
          `file reads.`,
    });
  }
  if (snapshot.tree_truncated) {
    warnings.push({
      code: "tree_truncated",
      message: `${slug} is large enough that GitHub truncated its own file listing. Anything ` +
        `below the cut is invisible to this, so the stack may be incomplete.`,
    });
  }

  // --- the repo node ---------------------------------------------------------
  // Read from the repository record, so verbatim: nothing here is a guess.

  nodes.push({
    local_id: nextLocalId(),
    type: "repo",
    title: slug,
    note: snapshot.description,
    payload: {
      url: snapshot.url,
      default_branch: snapshot.default_branch,
      stars: snapshot.stars,
    },
    // The one node with no file: it came from the repository record itself.
    source_ref: refFor(null),
    ...verbatim(),
  });

  // --- the stack node --------------------------------------------------------

  const readings: ManifestReading[] = [];
  for (const manifest of MANIFEST_READERS) {
    const file = fileAt(snapshot, manifest.file);
    if (!file) continue;
    readings.push(manifest.read(file.text, manifest.file));
  }

  const candidates: StackCandidate[] = [];
  const takenKey = new Set<string>();

  const offer = (candidate: StackCandidate) => {
    const key = `${candidate.entry.layer}::${candidate.entry.tool.toLowerCase()}`;
    if (takenKey.has(key)) return;
    takenKey.add(key);
    candidates.push(candidate);
  };

  // The language or runtime each manifest proves, first: it is the one entry
  // every repository in that ecosystem has, and the one a reader needs most.
  for (const reading of readings) {
    if (reading.base) offer({ entry: reading.base, ai: false, file: reading.file });
  }

  // Then every direct dependency, known ones named and placed, unknown ones
  // carried through under the spelling their manifest used.
  const seenDependency = new Set<string>();
  for (const reading of readings) {
    for (const dependency of reading.dependencies) {
      const lower = dependency.name.trim().toLowerCase();
      if (!lower || seenDependency.has(lower)) continue;
      seenDependency.add(lower);
      if (isNoise(lower)) continue;

      const facts = KNOWN_TOOLS[lower];
      const fallback = facts?.tool ?? dependency.name;
      const lookups = facts?.registry ? [...facts.registry, facts.tool] : [fallback];
      const { tool } = canonicalise(index, lookups, fallback);

      offer({
        entry: { layer: facts?.layer ?? "dependency", tool, version: dependency.version },
        ai: facts?.ai === true,
        file: reading.file,
      });
    }
  }

  // And what the file listing alone proves, which costs no fetch to notice.
  for (const signal of PATH_SIGNALS) {
    const present = signal.prefix
      ? snapshot.paths.some((path) => path.startsWith(signal.path))
      : hasPath(snapshot, signal.path);
    if (!present) continue;
    const { tool } = canonicalise(index, [signal.tool], signal.tool);
    offer({ entry: { layer: signal.layer, tool, version: null }, ai: false, file: signal.path });
  }

  // Sorted by layer so the node reads as a description rather than a listing,
  // and truncated from the bottom — where the unplaced dependencies sit.
  const ordered = candidates
    .map((candidate, position) => ({ candidate, position }))
    .sort((a, b) => {
      const byLayer = layerRank(a.candidate.entry.layer) - layerRank(b.candidate.entry.layer);
      return byLayer !== 0 ? byLayer : a.position - b.position;
    })
    .map(({ candidate }) => candidate);

  const kept = ordered.slice(0, MAX_STACK_ENTRIES);
  if (ordered.length > kept.length) {
    warnings.push({
      code: "stack_truncated",
      message: `${slug} declares ${ordered.length} dependencies worth naming. The ` +
        `${MAX_STACK_ENTRIES} most descriptive are proposed; the rest are in the manifest.`,
    });
  }

  const manifestFiles = readings.map((reading) => reading.file);
  if (kept.length > 0) {
    const contributors = [...new Set(kept.map((candidate) => candidate.file).filter(Boolean))] as string[];
    nodes.push({
      local_id: nextLocalId(),
      type: "stack",
      title: "Stack",
      note: manifestFiles.length > 0
        ? `Read from ${manifestFiles.join(", ")}. Check the versions before you rely on them.`
        : `Read from the file listing — ${contributors.join(", ")} — rather than from a manifest.`,
      payload: {
        layers: kept.map((candidate) => candidate.entry),
        notes: null,
      },
      // The primary manifest. Every contributor is named in the note above.
      source_ref: refFor(manifestFiles[0] ?? contributors[0] ?? null),
      ...guessed(
        `Assembled from ${manifestFiles.length > 0 ? manifestFiles.join(", ") : "the file listing"}. ` +
          `The names and versions are read; which layer each tool sits at is matched, not declared.`,
      ),
    });
  } else {
    warnings.push({
      code: "no_stack_detected",
      message: `No manifest this reads was found in ${slug}. It looks for package.json, ` +
        `requirements.txt, pyproject.toml, go.mod, Gemfile and composer.json at the repository root.`,
    });
  }

  // --- prerequisites ---------------------------------------------------------
  // Two sources, both inferred: an .env.example key is evidence that something
  // must be set, not a statement that it must, and a bullet under Installation
  // is a step somebody wrote for their own repository rather than for a build
  // record. Every one of these is a candidate a creator confirms or drops.

  let prerequisites = 0;

  const envFile = snapshot.files.find((file) => /(^|\/)\.?env\.(example|sample|template|dist)$/i.test(file.path));
  if (envFile) {
    const keys = readEnvKeys(envFile.text).slice(0, MAX_ENV_KEYS);
    for (const entry of keys) {
      if (prerequisites >= MAX_PREREQUISITES) break;
      prerequisites += 1;
      nodes.push({
        local_id: nextLocalId(),
        type: "prerequisite",
        title: entry.key,
        note: null,
        payload: {
          requirement: `${entry.key} must be set in your environment.`,
          why: entry.comment ? clip(entry.comment, MAX_REQUIREMENT_CHARS) : null,
          optional: false,
        },
        source_ref: refFor(envFile.path),
        ...guessed(
          `${entry.key} is a key in ${envFile.path}. That file lists what the project reads ` +
            `from the environment, so this is very likely needed — but nothing in it says so.`,
        ),
      });
    }
    if (readEnvKeys(envFile.text).length > keys.length) {
      warnings.push({
        code: "env_keys_truncated",
        message: `${envFile.path} declares more than ${MAX_ENV_KEYS} keys. The first ${MAX_ENV_KEYS} ` +
          `are proposed; the rest are configuration rather than prerequisites.`,
      });
    }
  }

  const readmeFile = snapshot.files.find((file) => /(^|\/)readme(\.[a-z]+)?$/i.test(file.path));
  const readmeText = readmeFile?.text ?? null;

  if (readmeText) {
    const section = findSection(readmeText, PREREQUISITE_HEADINGS);
    if (section) {
      const bullets = sectionBullets(section);
      const items = bullets.length > 0
        ? bullets
        : [sectionParagraph(section)].filter((item): item is string => Boolean(item));

      for (const item of items) {
        if (prerequisites >= MAX_PREREQUISITES) break;
        prerequisites += 1;
        const requirement = clip(item, MAX_REQUIREMENT_CHARS);
        nodes.push({
          local_id: nextLocalId(),
          type: "prerequisite",
          title: clip(item, 70),
          note: null,
          payload: { requirement, why: null, optional: false },
          source_ref: refFor(readmeFile!.path),
          ...guessed(
            `Read from the "${section.heading}" section of ${readmeFile!.path}. That section is ` +
              `where a prerequisite is usually written down, which is why this is a candidate ` +
              `rather than a fact.`,
          ),
        });
      }
    }
  }

  // --- the entrypoint --------------------------------------------------------
  // ONE file. NS-P21 is explicit that a repository is not an import target, and
  // an entrypoint is proposed only where the tier rules make it unambiguous.

  const entrypoint = chooseEntrypoint(snapshot.paths);
  if (entrypoint.ambiguous.length > 0) {
    warnings.push({
      code: "entrypoint_ambiguous",
      message: `${entrypoint.ambiguous.join(" and ")} both look like the entrypoint. No code node ` +
        `was proposed rather than guessing between them — add the right one from the tray.`,
    });
  }

  if (entrypoint.path) {
    const file = fileAt(snapshot, entrypoint.path);
    if (file) {
      const truncated = file.text.length > MAX_CODE_CHARS;
      const { language, unmapped } = languageFor(entrypoint.path);
      if (unmapped) {
        warnings.push({
          code: "unmapped_code_language",
          message: `${entrypoint.path} has an extension the code node's language list does not ` +
            `carry, so it is filed as "other". The source is unchanged.`,
        });
      }
      nodes.push({
        local_id: nextLocalId(),
        type: "code",
        title: entrypoint.path,
        note: truncated
          ? `The first ${MAX_CODE_CHARS.toLocaleString("en-GB")} characters of ${entrypoint.path}. ` +
            `The whole file is in the repository.`
          : null,
        payload: {
          language,
          source: truncated ? file.text.slice(0, MAX_CODE_CHARS) : file.text,
          filename: entrypoint.path,
          entrypoint: true,
        },
        source_ref: refFor(entrypoint.path),
        ...guessed(
          `${entrypoint.path} is where a project of this shape usually starts. The file is read ` +
            `verbatim; that it is the entrypoint is a convention, not a declaration.`,
        ),
      });
    }
  }

  // --- the header: title, outcome, made_with ---------------------------------

  const manifestName = readings.find((reading) => reading.name)?.name ?? null;
  const manifestNameFile = readings.find((reading) => reading.name)?.file ?? null;
  const headingTitle = readmeText ? readmeTitle(readmeText) : null;

  let proposedTitle: ProposedField | null = null;
  if (headingTitle) {
    proposedTitle = {
      value: clip(headingTitle, MAX_TITLE_CHARS),
      source_ref: refFor(readmeFile!.path),
      ...verbatim(),
    };
  } else if (manifestName) {
    proposedTitle = {
      value: clip(manifestName, MAX_TITLE_CHARS),
      source_ref: refFor(manifestNameFile),
      ...verbatim(),
    };
  } else {
    // The slug, made readable. Assembled rather than read, so it says so.
    const humanised = snapshot.repo.replace(/[-_.]+/g, " ").trim();
    proposedTitle = {
      value: clip(humanised.charAt(0).toUpperCase() + humanised.slice(1), MAX_TITLE_CHARS),
      source_ref: refFor(null),
      ...guessed(
        `${slug} has no README heading and no manifest name, so this is the repository name with ` +
          `its hyphens taken out. Rename it to whatever you actually call this.`,
      ),
    };
  }

  const readmeOpening = readmeText ? firstParagraph(readmeText) : null;
  let proposedOutcome: ProposedField | null = null;
  if (readmeOpening) {
    proposedOutcome = {
      value: clip(readmeOpening, MAX_OUTCOME_CHARS),
      source_ref: refFor(readmeFile!.path),
      ...guessed(
        `The opening paragraph of ${readmeFile!.path}. A README says what a repository IS; an ` +
          `outcome says what someone GOT. Rewrite it in your own terms.`,
      ),
    };
  } else if (snapshot.description) {
    proposedOutcome = {
      value: clip(snapshot.description, MAX_OUTCOME_CHARS),
      source_ref: refFor(null),
      ...guessed(
        `${slug}'s GitHub description, because its README opens with no prose. It describes the ` +
          `repository rather than what you built with it.`,
      ),
    };
  } else {
    warnings.push({
      code: "no_outcome_found",
      message: `${slug} has no README paragraph and no description, so there was nothing to ` +
        `propose as an outcome. Write one — it is the line the gallery shows.`,
    });
  }

  // made_with, from the AI SDKs the manifests declare. Canonical names where
  // the registry has one, so the gallery facet joins rather than fragments.
  const madeWithSeen = new Set<string>();
  const proposedMadeWith: ProposedField[] = [];
  for (const candidate of kept) {
    if (!candidate.ai) continue;
    const key = candidate.entry.tool.toLowerCase();
    if (madeWithSeen.has(key)) continue;
    madeWithSeen.add(key);
    proposedMadeWith.push({
      value: candidate.entry.tool,
      source_ref: refFor(candidate.file),
      ...guessed(
        `${candidate.entry.tool} is a dependency in ${candidate.file ?? "the manifest"}. A ` +
          `repository depending on an SDK is strong evidence it was built with that model, but ` +
          `it is evidence rather than a statement.`,
      ),
    });
  }

  // --- the summary -----------------------------------------------------------
  // The turn counts are 0 and the labels empty because a repository has no
  // turns and no speakers. They keep their names because the client reads them
  // by name; zero is the honest answer, not a placeholder.

  const characterCount = snapshot.files.reduce((total, file) => total + file.text.length, 0);
  const lineCount = snapshot.files.reduce(
    (total, file) => total + normaliseNewlines(file.text).split("\n").length,
    0,
  );

  const events: ProposedEvent[] = [];

  return {
    events,
    nodes,
    summary: {
      session_id: options.session_id,
      source_hint: options.source_hint ?? null,
      detected_format: "github-repo",
      detected_labels: { user: [], assistant: [] },
      turn_count: 0,
      user_turn_count: 0,
      assistant_turn_count: 0,
      event_count: 0,
      node_count: nodes.length,
      character_count: characterCount,
      line_count: lineCount,
      proposed_title: proposedTitle,
      proposed_outcome: proposedOutcome,
      proposed_made_with: proposedMadeWith,
      files_fetched: snapshot.files_fetched,
      fetch_budget: snapshot.fetch_budget,
    },
    warnings,
  };
}

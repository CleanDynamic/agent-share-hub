// NS-P21 — parse-repo, checked against its own acceptance criteria.
//
// Two halves are tested here and they are tested differently:
//
//   parse.ts is pure — a snapshot in, a proposal out — so it is called
//   directly with a snapshot built in the test. No network, no Deno, no
//   Supabase.
//
//   github.ts does the fetching, so it is run against a FAKE GitHub: a stubbed
//   global fetch that answers the three endpoints the reader uses and COUNTS
//   the calls. That count is what makes acceptance 4 ("fetches no more than 40
//   files — instrument and check") a test rather than a claim.

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRegistryIndex,
  chooseEntrypoint,
  findSection,
  firstParagraph,
  parseRepo,
  readEnvKeys,
  readmeTitle,
  sectionBullets,
  MAX_STACK_ENTRIES,
} from "../../supabase/functions/parse-repo/parse.ts";
import type { RegistryTool, RepoSnapshot } from "../../supabase/functions/parse-repo/snapshot.ts";

const SESSION = "3f1c2f5e-1b0a-4b8e-9c3d-2a7f6e5d4c3b";

/** A small slice of ai_tools_registry, as index.ts reads it. */
const REGISTRY: RegistryTool[] = [
  { name: "Anthropic API", slug: "anthropic-api" },
  { name: "Claude", slug: "claude" },
  { name: "Ollama", slug: "ollama" },
  { name: "OpenRouter", slug: "openrouter" },
  { name: "Supabase", slug: "supabase" },
  { name: "n8n", slug: "n8n" },
];

const README = `<p align="center">
  <img src="logo.png" width="120" />
</p>

# Widget Factory

[![build](https://img.shields.io/badge/build-passing-green)](https://ci.example.com)
[![licence](https://img.shields.io/badge/licence-MIT-blue)](LICENSE)

Widget Factory turns a folder of photographs into a printable contact sheet,
using Claude to write a caption for each frame.

## Prerequisites

- Node.js 20 or newer
- An Anthropic API key
- \`exiftool\` on your PATH

## Installation

\`\`\`bash
npm install
npm run dev
\`\`\`
`;

const PACKAGE_JSON = JSON.stringify({
  name: "widget-factory",
  description: "Contact sheets, captioned.",
  engines: { node: ">=20" },
  dependencies: {
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    "@anthropic-ai/sdk": "^0.27.3",
    openai: "^4.67.1",
    "@supabase/supabase-js": "^2.49.1",
  },
  devDependencies: {
    typescript: "^5.5.3",
    vite: "^5.4.1",
    tailwindcss: "^3.4.11",
    "@types/react": "^18.3.3",
    eslint: "^9.9.0",
  },
});

const ENV_EXAMPLE = `# Your key from console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-xxxx

# Where the contact sheets are written
OUTPUT_DIR=./out
SUPABASE_URL=https://example.supabase.co
`;

function snapshotOf(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  const files = overrides.files ?? [
    { path: "README.md", text: README, size: README.length },
    { path: "package.json", text: PACKAGE_JSON, size: PACKAGE_JSON.length },
    { path: ".env.example", text: ENV_EXAMPLE, size: ENV_EXAMPLE.length },
    { path: "src/main.tsx", text: "export const main = () => null;\n", size: 32 },
  ];
  return {
    owner: "acme",
    repo: "widget-factory",
    url: "https://github.com/acme/widget-factory",
    default_branch: "main",
    stars: 412,
    description: "Contact sheets, captioned.",
    paths: overrides.paths ?? [...files.map((file) => file.path), "Dockerfile", ".github/workflows/ci.yml"],
    files,
    skipped: [],
    tree_truncated: false,
    files_fetched: 6,
    fetch_budget: 40,
    ...overrides,
  };
}

function proposalOf(overrides: Partial<RepoSnapshot> = {}) {
  return parseRepo(snapshotOf(overrides), REGISTRY, { session_id: SESSION, source_hint: "acme/widget-factory" });
}

describe("acceptance 1 — a public repository yields a repo node, a stack, and an inferred outcome", () => {
  it("proposes a repo node carrying url, default_branch and stars", () => {
    const repo = proposalOf().nodes.find((node) => node.type === "repo");
    expect(repo).toBeTruthy();
    expect(repo!.payload).toEqual({
      url: "https://github.com/acme/widget-factory",
      default_branch: "main",
      stars: 412,
    });
    // Read from the repository record, so not a guess.
    expect(repo!.inferred).toBe(false);
  });

  it("proposes one stack node with at least three entries", () => {
    const stack = proposalOf().nodes.filter((node) => node.type === "stack");
    expect(stack).toHaveLength(1);

    const layers = stack[0].payload.layers as { layer: string; tool: string; version: string | null }[];
    expect(layers.length).toBeGreaterThanOrEqual(3);
    expect(layers.map((entry) => entry.tool)).toEqual(
      expect.arrayContaining(["Node.js", "React", "Vite", "TypeScript", "Tailwind CSS"]),
    );
    // The version is read off the manifest with its range operator dropped.
    expect(layers.find((entry) => entry.tool === "React")?.version).toBe("18.3.1");
  });

  it("proposes an outcome from the README's first paragraph, marked inferred", () => {
    const outcome = proposalOf().summary.proposed_outcome;
    expect(outcome).toBeTruthy();
    expect(outcome!.value).toMatch(/^Widget Factory turns a folder of photographs/);
    expect(outcome!.inferred).toBe(true);
    expect(outcome!.inferred_reason).toBeTruthy();
    expect(outcome!.source_ref.file).toBe("README.md");
  });

  it("falls back to the repository description when the README opens with only badges", () => {
    const badgesOnly = "# Widget\n\n[![a](b)](c) [![d](e)](f)\n";
    const outcome = proposalOf({
      files: [{ path: "README.md", text: badgesOnly, size: badgesOnly.length }],
    }).summary.proposed_outcome;

    expect(outcome!.value).toBe("Contact sheets, captioned.");
    expect(outcome!.inferred).toBe(true);
    // The description is not a file, so there is no file to name.
    expect(outcome!.source_ref.file).toBeNull();
  });
});

describe("acceptance 2 — stack entries matching ai_tools_registry use its canonical names", () => {
  it("renames @anthropic-ai/sdk to the registry's spelling", () => {
    const layers = proposalOf().nodes.find((node) => node.type === "stack")!
      .payload.layers as { tool: string; layer: string }[];

    // The registry says "Anthropic API". The package is called @anthropic-ai/sdk.
    expect(layers.map((entry) => entry.tool)).toContain("Anthropic API");
    expect(layers.map((entry) => entry.tool)).not.toContain("@anthropic-ai/sdk");
    expect(layers.find((entry) => entry.tool === "Anthropic API")?.layer).toBe("ai");
  });

  it("keeps the reader's own name where the registry has no row", () => {
    // REGISTRY carries no OpenAI row, and mapping the SDK onto ChatGPT to force
    // a match would write a wrong canonical name into made_with.
    const layers = proposalOf().nodes.find((node) => node.type === "stack")!
      .payload.layers as { tool: string }[];
    expect(layers.map((entry) => entry.tool)).toContain("OpenAI");
    expect(layers.map((entry) => entry.tool)).not.toContain("ChatGPT");
  });

  it("matches on slug as well as name, case-insensitively", () => {
    const index = buildRegistryIndex(REGISTRY);
    expect(index.get("anthropic api")).toBe("Anthropic API");
    expect(index.get("anthropic-api")).toBe("Anthropic API");
    expect(index.get("n8n")).toBe("n8n");
  });

  it("proposes made_with from the AI SDKs, under the canonical names", () => {
    const madeWith = proposalOf().summary.proposed_made_with;
    const values = madeWith.map((field) => field.value);

    expect(values).toContain("Anthropic API");
    expect(values).toContain("OpenAI");
    // Not an AI SDK, so not a made_with candidate however useful it is.
    expect(values).not.toContain("React");
    for (const field of madeWith) {
      expect(field.inferred).toBe(true);
      expect(field.source_ref.file).toBe("package.json");
    }
  });
});

describe("acceptance 6 — every proposed node names where it came from", () => {
  it("names the file each node was read out of", () => {
    const nodes = proposalOf().nodes;
    const first = (type: string) => nodes.find((node) => node.type === type)!;

    expect(first("stack").source_ref.file).toBe("package.json");
    expect(first("code").source_ref.file).toBe("src/main.tsx");
    // Prerequisites come from two different files, and each names its own.
    const prerequisiteFiles = new Set(
      nodes.filter((node) => node.type === "prerequisite").map((node) => node.source_ref.file),
    );
    expect(prerequisiteFiles).toEqual(new Set([".env.example", "README.md"]));
    // The repository record is not a file. Everything else about it is recorded.
    expect(first("repo").source_ref.file).toBeNull();

    // No node is left without provenance of some kind.
    for (const node of nodes) {
      expect(node.source_ref.file === null ? node.type : "named").toMatch(/^(repo|named)$/);
    }
  });

  it("records the repository and the branch on every node", () => {
    for (const node of proposalOf().nodes) {
      expect(node.source_ref.source).toBe("repo");
      expect(node.source_ref.session_id).toBe(SESSION);
      expect(node.source_ref.repo).toBe("acme/widget-factory");
      expect(node.source_ref.ref).toBe("main");
      expect(typeof node.source_ref.index).toBe("number");
    }
  });
});

describe("prerequisites", () => {
  it("proposes one node per .env.example key, with the comment as the reason", () => {
    const prerequisites = proposalOf().nodes.filter((node) => node.type === "prerequisite");
    const keys = prerequisites.filter((node) => node.source_ref.file === ".env.example");

    expect(keys.map((node) => node.title)).toEqual([
      "ANTHROPIC_API_KEY",
      "OUTPUT_DIR",
      "SUPABASE_URL",
    ]);
    expect(keys[0].payload.why).toBe("Your key from console.anthropic.com");
    expect(keys[0].inferred).toBe(true);
  });

  it("proposes one node per bullet under Prerequisites, and no install commands", () => {
    const fromReadme = proposalOf()
      .nodes.filter((node) => node.type === "prerequisite" && node.source_ref.file === "README.md");

    expect(fromReadme.map((node) => node.payload.requirement)).toEqual([
      "Node.js 20 or newer",
      "An Anthropic API key",
      "exiftool on your PATH",
    ]);
    // The Installation section's fenced commands are steps, not prerequisites.
    expect(fromReadme.map((node) => node.payload.requirement)).not.toContain("npm install");
  });

  it("reads bullets out of Installation when there is no Prerequisites section", () => {
    const readme = "# Thing\n\nDoes a thing.\n\n## Installation\n\n- Python 3.11\n- A Postgres database\n";
    const fromReadme = proposalOf({
      files: [{ path: "README.md", text: readme, size: readme.length }],
    }).nodes.filter((node) => node.type === "prerequisite");

    expect(fromReadme.map((node) => node.payload.requirement)).toEqual([
      "Python 3.11",
      "A Postgres database",
    ]);
  });
});

describe("the entrypoint, and what makes one unambiguous", () => {
  it("proposes a code node for a single unambiguous entrypoint", () => {
    const code = proposalOf().nodes.find((node) => node.type === "code");
    expect(code).toBeTruthy();
    expect(code!.payload).toMatchObject({
      language: "tsx",
      filename: "src/main.tsx",
      entrypoint: true,
    });
  });

  it("proposes nothing, and says why, when two candidates tie", () => {
    const files = [
      { path: "package.json", text: PACKAGE_JSON, size: PACKAGE_JSON.length },
      { path: "src/main.ts", text: "a", size: 1 },
      { path: "src/main.tsx", text: "b", size: 1 },
    ];
    const proposal = proposalOf({ files, paths: files.map((file) => file.path) });

    expect(proposal.nodes.find((node) => node.type === "code")).toBeUndefined();
    expect(proposal.warnings.map((warning) => warning.code)).toContain("entrypoint_ambiguous");
  });

  it("prefers src/main over a root index.js", () => {
    expect(chooseEntrypoint(["src/main.ts", "index.js"]).path).toBe("src/main.ts");
    expect(chooseEntrypoint(["app.py", "README.md"]).path).toBe("app.py");
    expect(chooseEntrypoint(["README.md"]).path).toBeNull();
  });
});

describe("a repository is not a session", () => {
  it("proposes no events and reports zero turns", () => {
    const proposal = proposalOf();
    expect(proposal.events).toEqual([]);
    expect(proposal.summary.event_count).toBe(0);
    expect(proposal.summary.turn_count).toBe(0);
    expect(proposal.summary.user_turn_count).toBe(0);
    expect(proposal.summary.assistant_turn_count).toBe(0);
    expect(proposal.summary.detected_format).toBe("github-repo");
  });

  it("keeps the envelope's own field names and node_count", () => {
    const proposal = proposalOf();
    expect(proposal.summary.node_count).toBe(proposal.nodes.length);
    expect(proposal.summary.session_id).toBe(SESSION);
    expect(Array.isArray(proposal.warnings)).toBe(true);
  });
});

describe("the other manifests", () => {
  const cases: { file: string; text: string; tool: string; version: string | null; dependency: string }[] = [
    {
      file: "requirements.txt",
      text: "# app\nfastapi==0.115.0\nanthropic>=0.34\n-r dev.txt\n",
      tool: "Python", version: null, dependency: "FastAPI",
    },
    {
      file: "pyproject.toml",
      text: '[project]\nname = "thing"\nrequires-python = ">=3.11"\ndependencies = [\n  "flask>=3.0",\n  "openai==1.51.0",\n]\n',
      tool: "Python", version: "3.11", dependency: "Flask",
    },
    {
      file: "go.mod",
      text: "module example.com/thing\n\ngo 1.22\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.10.0\n)\n",
      tool: "Go", version: "1.22", dependency: "Gin",
    },
    {
      file: "Gemfile",
      text: 'source "https://rubygems.org"\nruby "3.3.0"\ngem "rails", "~> 7.1"\n',
      tool: "Ruby", version: "3.3.0", dependency: "Rails",
    },
    {
      file: "composer.json",
      text: JSON.stringify({ name: "acme/thing", require: { php: "^8.2", "laravel/framework": "^11.0", "ext-json": "*" } }),
      tool: "PHP", version: "8.2", dependency: "Laravel",
    },
  ];

  for (const testCase of cases) {
    it(`reads ${testCase.file}`, () => {
      const proposal = proposalOf({
        files: [{ path: testCase.file, text: testCase.text, size: testCase.text.length }],
        paths: [testCase.file],
      });
      const layers = proposal.nodes.find((node) => node.type === "stack")!
        .payload.layers as { tool: string; version: string | null }[];

      const base = layers.find((entry) => entry.tool === testCase.tool);
      expect(base, `${testCase.file} should prove ${testCase.tool}`).toBeTruthy();
      expect(base!.version).toBe(testCase.version);
      expect(layers.map((entry) => entry.tool)).toContain(testCase.dependency);
    });
  }

  it("drops toolchain noise so the cap buys room for real entries", () => {
    const layers = proposalOf().nodes.find((node) => node.type === "stack")!
      .payload.layers as { tool: string }[];
    const tools = layers.map((entry) => entry.tool);

    expect(tools).not.toContain("react-dom");
    expect(tools).not.toContain("@types/react");
    expect(tools).not.toContain("eslint");
    expect(layers.length).toBeLessThanOrEqual(MAX_STACK_ENTRIES);
  });

  it("notices what the file listing alone proves", () => {
    const tools = (proposalOf().nodes.find((node) => node.type === "stack")!
      .payload.layers as { tool: string }[]).map((entry) => entry.tool);
    expect(tools).toContain("Docker");
    expect(tools).toContain("GitHub Actions");
  });
});

describe("the README readers", () => {
  it("walks past an HTML header, an H1 and a badge row", () => {
    expect(firstParagraph(README)).toMatch(/^Widget Factory turns a folder/);
    expect(readmeTitle(README)).toBe("Widget Factory");
  });

  it("treats a setext heading as a heading", () => {
    expect(firstParagraph("Project Name\n============\n\nReal prose here.\n")).toBe("Real prose here.");
  });

  it("returns null when a README is nothing but decoration", () => {
    expect(firstParagraph("# Title\n\n[![a](b)](c)\n\n---\n")).toBeNull();
  });

  it("finds a section and stops at the next heading of the same level", () => {
    const section = findSection(README, ["prerequisites"]);
    expect(section).toBeTruthy();
    expect(sectionBullets(section!)).toHaveLength(3);
    expect(section!.lines.join("\n")).not.toMatch(/npm install/);
  });

  it("reads env keys with either separator, and dedupes", () => {
    expect(readEnvKeys("A=1\nexport B=2\nC: 3\nA=4\n").map((entry) => entry.key)).toEqual(["A", "B", "C"]);
  });
});

// -----------------------------------------------------------------------------
// The fetching half, against a fake GitHub
// -----------------------------------------------------------------------------
// github.ts is the only part of parse-repo that touches the network, and the
// two hard limits NS-P21 sets live in it. A stubbed fetch that COUNTS calls is
// what turns "fetches no more than 40 files" into something checked rather than
// asserted in a comment.

import {
  FetchBudget,
  parseRepoUrl,
  RepoReadError,
  readRepoSnapshot,
} from "../../supabase/functions/parse-repo/github.ts";

interface FakeRepo {
  record?: Record<string, unknown>;
  /** path -> [contents, byteSize]. Size defaults to the string's length. */
  tree: Record<string, string | [string, number]>;
  truncated?: boolean;
  /** Force a status for the repository record request. */
  recordStatus?: number;
  recordBody?: string;
}

function encode(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

/** Installs a fake api.github.com and returns the request log. */
function fakeGitHub(repo: FakeRepo): { calls: string[] } {
  const calls: string[] = [];

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);

    if (/\/git\/trees\//.test(url)) {
      return json({
        truncated: repo.truncated === true,
        tree: Object.entries(repo.tree).map(([path, value]) => ({
          path,
          type: "blob",
          size: Array.isArray(value) ? value[1] : value.length,
        })),
      });
    }

    const contents = /\/contents\/(.+)\?ref=/.exec(url);
    if (contents) {
      const path = decodeURIComponent(contents[1]);
      const value = repo.tree[path];
      if (value === undefined) return json({ message: "Not Found" }, 404);
      return json({ content: encode(Array.isArray(value) ? value[0] : value), encoding: "base64" });
    }

    // The repository record.
    if (repo.recordStatus && repo.recordStatus !== 200) {
      return new Response(repo.recordBody ?? '{"message":"Not Found"}', { status: repo.recordStatus });
    }
    return json({
      html_url: "https://github.com/acme/widget-factory",
      default_branch: "main",
      stargazers_count: 412,
      description: "Contact sheets, captioned.",
      private: false,
      ...repo.record,
    });
  });

  return { calls };
}

const COORDINATES = { owner: "acme", repo: "widget-factory" };

describe("acceptance 4 — the function fetches no more than 40 files", () => {
  beforeEach(() => {
    // headers() reads an optional token. There is no Deno in vitest.
    vi.stubGlobal("Deno", { env: { get: () => undefined } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("spends a request per file and never more than the budget", async () => {
    const github = fakeGitHub({
      tree: {
        "README.md": README,
        "package.json": PACKAGE_JSON,
        ".env.example": ENV_EXAMPLE,
        "src/main.tsx": "export const main = () => null;\n",
      },
    });

    const snapshot = await readRepoSnapshot(COORDINATES);

    // One record request, one tree request, four file reads.
    expect(github.calls).toHaveLength(6);
    expect(snapshot.files_fetched).toBe(6);
    expect(snapshot.files_fetched).toBeLessThanOrEqual(40);
    expect(snapshot.fetch_budget).toBe(40);
    expect(snapshot.files.map((file) => file.path).sort()).toEqual([
      ".env.example", "README.md", "package.json", "src/main.tsx",
    ]);
  });

  it("stays far under the cap on a repository of five thousand files", async () => {
    const tree: Record<string, string> = {
      "README.md": README,
      "package.json": PACKAGE_JSON,
      "requirements.txt": "flask==3.0.0\n",
      "pyproject.toml": '[project]\nname = "x"\n',
      "go.mod": "module x\n\ngo 1.22\n",
      Gemfile: 'ruby "3.3.0"\n',
      "composer.json": '{"require":{"php":"^8.2"}}',
      ".env.example": ENV_EXAMPLE,
      "src/main.tsx": "export const main = () => null;\n",
    };
    for (let index = 0; index < 5_000; index += 1) tree[`src/generated/file-${index}.ts`] = "x";

    const github = fakeGitHub({ tree });
    const snapshot = await readRepoSnapshot(COORDINATES);

    // The whole listing arrives in ONE request, so repository size does not
    // move the fetch count at all.
    expect(github.calls.filter((url) => url.includes("/git/trees/"))).toHaveLength(1);
    expect(snapshot.paths).toHaveLength(5_009);
    expect(snapshot.files_fetched).toBeLessThanOrEqual(40);
    expect(snapshot.files_fetched).toBe(11);
  });

  it("refuses to spend beyond the budget when one is nearly gone", async () => {
    const github = fakeGitHub({
      tree: {
        "README.md": README,
        "package.json": PACKAGE_JSON,
        ".env.example": ENV_EXAMPLE,
        "src/main.tsx": "export const main = () => null;\n",
      },
    });

    // Two requests establish the repository, leaving one read.
    const snapshot = await readRepoSnapshot(COORDINATES, new FetchBudget(3));

    expect(github.calls).toHaveLength(3);
    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.skipped.map((file) => file.reason)).toEqual([
      "budget_spent", "budget_spent", "budget_spent",
    ]);

    const proposal = parseRepo(snapshot, REGISTRY, { session_id: SESSION, source_hint: null });
    expect(proposal.warnings.map((warning) => warning.code)).toContain("fetch_budget_spent");
  });

  it("never opens a file over 200KB, and knows not to before fetching it", async () => {
    const github = fakeGitHub({
      tree: {
        "package.json": [PACKAGE_JSON, 4 * 1024 * 1024],
        "README.md": README,
      },
    });

    const snapshot = await readRepoSnapshot(COORDINATES);

    // The size came off the tree, so the 4MB file cost no request at all.
    expect(github.calls.some((url) => url.includes("/contents/package.json"))).toBe(false);
    expect(snapshot.skipped).toEqual([
      { path: "package.json", size: 4 * 1024 * 1024, reason: "too_large" },
    ]);

    const proposal = parseRepo(snapshot, REGISTRY, { session_id: SESSION, source_hint: null });
    expect(proposal.warnings.map((warning) => warning.code)).toContain("file_too_large");
  });

  it("decodes UTF-8 rather than reading the bytes as latin-1", async () => {
    const readme = "# Café\n\nBuilds contact sheets — with naïve captions, 日本語 included.\n";
    fakeGitHub({ tree: { "README.md": readme } });

    const snapshot = await readRepoSnapshot(COORDINATES);
    expect(snapshot.files[0].text).toBe(readme);

    const proposal = parseRepo(snapshot, REGISTRY, { session_id: SESSION, source_hint: null });
    expect(proposal.summary.proposed_outcome!.value).toContain("naïve");
    expect(proposal.summary.proposed_outcome!.value).toContain("日本語");
  });
});

describe("acceptance 3 — a private or missing repository is a sentence, not a 500", () => {
  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => undefined } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("answers 404 with a message covering all three reasons GitHub gives one", async () => {
    fakeGitHub({ tree: {}, recordStatus: 404 });

    await expect(readRepoSnapshot(COORDINATES)).rejects.toThrowError(RepoReadError);
    const error = await readRepoSnapshot(COORDINATES).catch((cause) => cause as RepoReadError);

    expect(error.status).toBe(404);
    expect(error.message).toMatch(/private, does not exist, or has been renamed/);
    // Never a 500.
    expect(error.status).toBeLessThan(500);
  });

  it("refuses a private repository even when a token can see it", async () => {
    fakeGitHub({ tree: {}, record: { private: true } });

    const error = await readRepoSnapshot(COORDINATES).catch((cause) => cause as RepoReadError);
    expect(error).toBeInstanceOf(RepoReadError);
    expect(error.status).toBe(403);
    expect(error.message).toMatch(/Private repositories are out of scope/);
  });

  it("turns a rate limit into a 429 that says to wait", async () => {
    fakeGitHub({ tree: {}, recordStatus: 403, recordBody: '{"message":"API rate limit exceeded"}' });

    const error = await readRepoSnapshot(COORDINATES).catch((cause) => cause as RepoReadError);
    expect(error.status).toBe(429);
    expect(error.message).toMatch(/rate-limiting/);
  });

  it("turns a GitHub outage into a 502 rather than a 500", async () => {
    fakeGitHub({ tree: {}, recordStatus: 503 });

    const error = await readRepoSnapshot(COORDINATES).catch((cause) => cause as RepoReadError);
    expect(error.status).toBe(502);
  });
});

describe("reading a repository URL", () => {
  it("takes the shapes a creator actually pastes", () => {
    const expected = { owner: "acme", repo: "widget-factory" };
    for (const url of [
      "https://github.com/acme/widget-factory",
      "https://github.com/acme/widget-factory/",
      "http://github.com/acme/widget-factory",
      "https://www.github.com/acme/widget-factory",
      "github.com/acme/widget-factory",
      "https://github.com/acme/widget-factory.git",
      "https://github.com/acme/widget-factory/tree/main/src",
      "https://github.com/acme/widget-factory#readme",
      "  https://github.com/acme/widget-factory?tab=readme  ",
    ]) {
      expect(parseRepoUrl(url), url).toEqual(expected);
    }
  });

  it("refuses what is not a repository URL", () => {
    for (const url of [
      "https://gitlab.com/acme/widget",
      "https://github.com/acme",
      "https://github.com/features/actions",
      "not a url at all",
      "",
    ]) {
      expect(parseRepoUrl(url), url).toBeNull();
    }
  });
});

describe("the fetch budget itself", () => {
  it("counts down, refuses at zero, and never goes negative", () => {
    const budget = new FetchBudget(2);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(false);
    expect(budget.spent).toBe(2);
    expect(budget.remaining).toBe(0);
  });

  it("defaults to the 40 NS-P21 sets", () => {
    expect(new FetchBudget().limit).toBe(40);
  });
});

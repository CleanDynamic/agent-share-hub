/* CA-18: one Details view for each kind of tile, full and empty, for the suites that compare what a modal and Details show. */

import { emptyDraft } from "@/lib/build/decisionDraft";
import type { BuildFacts, TileKind } from "@/lib/build/tileSections";
import type { DetailsView } from "@/pages/site/compose/DetailsPanel";

export type Fill = "full" | "empty";

export const TILE_REFS: Record<string, { number: string | null; name: string; kind: string | null; session: string | null }> = {
  p2: { number: "2", name: "Write the menu", kind: "Prompt", session: "Session 1" },
  p4: { number: "4", name: "Check the prices", kind: "Prompt", session: "Session 2" },
  f1: { number: null, name: "menu.pdf", kind: "File", session: null },
  t1: { number: null, name: "Gmail", kind: "Tool", session: null },
  r1: { number: "9", name: "The finished homepage", kind: "Result", session: "Session 2" },
};

export const buildFacts: BuildFacts = { ref: (id) => (TILE_REFS[id] ? { id, ...TILE_REFS[id] } : null) };

const inputs = {
  uses: [
    { use: { kind: "output" as const, node_id: "p2" }, label: "Output of 2", sub: "Write the menu · Session 1" },
    { use: { kind: "file" as const, node_id: "f1" }, label: "menu.pdf", sub: "File" },
  ],
  options: [],
  goesInto: [{ id: "p4", label: "4 · Check the prices" }, { id: "result", label: "Result" }],
};
const noInputs = { uses: [], options: [], goesInto: [] };

/** The view of a tile of this kind: `full` holds a value for every section it can, `empty` only what the tile needs to exist. */
export function tileView(kind: TileKind, fill: Fill = "full"): DetailsView {
  const full = fill === "full";
  const io = full ? inputs : noInputs;
  switch (kind) {
    case "prompt":
      return {
        kind: "prompt",
        id: "p3",
        number: "3",
        title: full ? "Fix the mobile layout" : null,
        defaultTitle: "Prompt 3",
        editable: true,
        place: "Prompt 3 · Session 2",
        sessionLine: "Session 2 · Claude Code",
        detailLine: "Sonnet 5.5 · 4 Mar · prompt 3 of 4",
        typed: full,
        model: full ? "Sonnet 5.5" : null,
        tool: full ? "Claude Code" : null,
        text: "The menu grid overflows on a phone. Stack it to one column below {breakpoint} and keep the header sticky.",
        words: 19,
        ...io,
        makes: full ? [{ id: "m1", name: "menu.css" }] : [],
        payload: full ? { reply: "Done. The grid is one column below 600px.", settings: { model: "sonnet-5-5", effort: "high", instructions: "Keep it short" }, variables: [{ name: "breakpoint", description: "The width in pixels" }] } : {},
      };
    case "manual":
      return { kind: "manual", id: "m1", number: "4", title: null, defaultTitle: "Manual step 4", tool: full ? "Figma" : "", text: full ? "Opened the file\nExported the logo" : "", picture: full ? { id: "pic", name: "logo.png" } : null, ...io, makes: [] };
    case "code":
      return { kind: "code", id: "c1", number: "5", title: null, defaultTitle: "Code 5", language: full ? "ts" : null, filename: full ? "src/menu.ts" : null, source: "export const menu = [];\nexport const price = 4;", lines: 2, tool: full ? "Claude Code" : null, model: full ? "Sonnet 5.5" : null, ...io, makes: [], payload: full ? { filename: "src/menu.ts", tool: "Claude Code", model: "sonnet-5-5" } : {} };
    case "check":
      return {
        kind: "check",
        id: "k1",
        number: "6",
        title: null,
        defaultTitle: "Check 6",
        check: full
          ? { tested: "Places a test order", passing: "The total shows £9.00", onFail: "The total showed 0.00", passed: 3, total: 4, runAt: "2026-10-12", runs: [{ at: "2026-10-12", passed: 3, total: 4 }], caseList: [{ input: "2 loaves", expected: "£9.00", actual: "£9.00", passed: true }] }
          : { tested: "Places a test order", passing: "", onFail: null, passed: null, total: null, runAt: null },
        uses: io.uses,
        options: [],
        goesInto: io.goesInto,
        payload: full ? { method: "automated", reviewer: "you", scoring: { how: "metric", target: "95% correct" }, model_tested: { model: "sonnet-5-5", version: "2026-09-30" }, evidence: { url: "https://example.com/run" } } : {},
      };
    case "decision":
      return { kind: "decision", id: "d1", number: "7", title: null, defaultTitle: "Decision 7", draft: { ...emptyDraft(), name: "Route", questions: [{ ...emptyDraft().questions[0], id: "team", instructions: "Which team?" }], calledFrom: full ? ["c1"] : [] }, codeTiles: [{ id: "c1", label: "route.ts", source: "" }], stepChoices: [{ id: "p2", label: "2 · Write the menu" }] };
    case "file":
      return { kind: "file", id: "f1", name: "menu.pdf", from: "opened in session 1", size: full ? "212 KB" : null, canDownload: true, usedBy: full ? [{ id: "p3", label: "3 · Fix the mobile layout" }] : [] };
    case "tool":
      return { kind: "tool", id: "t1", service: "Gmail", scopes: full ? "read, label, draft" : "", usedBy: full ? [{ id: "p3", label: "3 · Fix the mobile layout" }] : [], connection: full ? "mcp" : null, runsAt: full ? "web" : null, toolsUsed: full ? [{ name: "search", count: 4 }] : [], payload: full ? { permissions: "write", plan: "Free", setup: ["Sign in", "Allow access"], alternatives: ["Outlook"] } : {} };
    case "agent":
      return {
        kind: "agent",
        id: "a5",
        number: "5",
        name: null,
        defaultName: "Agent 5",
        model: "Opus 5.5",
        runs: full ? { how: "until", detail: "every item has a price" } : null,
        inside: "1 prompt",
        insideRows: full ? [{ id: "a5:p", label: "5.2 · Prompt 5.2" }] : [],
        instructions: full ? "Check the menu and reply with any item that has no price." : "",
        parent: null,
        setup: { harness: full ? "Claude Code" : null, models: [{ model: "opus-5-5", role: "main" }], tools: full ? ["Gmail"] : [], ...(full ? { memory: "Notes between runs" } : null) },
        ...io,
        payload: full ? { limits: ["Ten steps"], output: "A menu document", sample: "User: hello" } : {},
      };
    case "team":
      return { kind: "team", id: "tm3", number: "3", name: null, defaultName: "Team 3", model: null, runs: null, inside: "2 agents", insideRows: full ? [{ id: "a1", label: "3.1 · Lead" }] : [], instructions: "", parent: null, ...io, payload: full ? { pattern: "lead" } : {} };
    case "result":
      return { kind: "result", id: "r1", summary: full ? "The finished homepage" : "", url: full ? "https://plumandrye.example" : "", pictures: full ? [{ id: "pic", name: "home.png" }] : [], what: "link", payload: full ? { caption: "The homepage, as shipped" } : {} };
    case "system_prompt":
      return { kind: "system_prompt", id: "sp1", number: "1", title: "Brand voice", defaultTitle: "System prompt 1", payload: { text: "Write in plain British English with {tone}.", scope: { kind: "all" }, ...(full ? { version: "v2", model: "opus-5-5", variables: [{ name: "tone", description: "Warm" }] } : null) }, appliesTo: 3, prompts: [], session: null, ...io };
    case "retrieval":
      return { kind: "retrieval", id: "rt1", number: "3", title: "Search the categories", defaultTitle: "Retrieval 3", payload: { step: true, corpus: "categories", ...(full ? { embedding_model: "text-embedding-3-small", index: "pgvector", corpus_size: 6000, query: "The product's title", k: 30, recall: [{ k: 1, value: 0.38, source: "run" }, { k: 30, value: 0.992, source: "run" }], hybrid: true } : null) }, ...io };
    case "dataset":
      return { kind: "dataset", id: "ds1", number: "2", title: "Support tickets", defaultTitle: "Dataset 2", payload: { description: "1,200 anonymised tickets", use: "retrieval", ...(full ? { format: "CSV", record_count: 1200, columns: ["id", "team"], source: "Helpdesk", sample: ["1, Billing"], licence: "CC BY 4.0", chunk_strategy: "By paragraph", chunk_size: 512 } : null) }, ...io };
    case "repo":
      return { kind: "repo", id: "rp1", number: "8", title: null, defaultTitle: "GitHub repository 8", payload: { url: "https://github.com/owner/name", ownership: "third_party", ...(full ? { description: "The editor", author: "Owner", usage: ["dependency"], pin: { kind: "tag", value: "v2.10.0" }, path: "packages/x", modifications: "None", key_files: ["README.md"], run: ["npm install"] } : null) }, ...io };
    case "session":
      return {
        kind: "session",
        key: "s2",
        number: 2,
        tool: "Claude Code",
        model: full ? "Sonnet 5.5" : "",
        date: full ? "8 Oct 2026" : "",
        inBuild: 1,
        total: 1,
        status: "ready",
        checklist: [{ ordinal: 0, label: "Fix the mobile layout", stepId: "p3" }],
        ...(full ? { goal: { condition: "the tests pass", atMost: 40 }, extras: { cost: 1.2, currency: "GBP" as const, tokens: 4000, background: true, startedWith: "claude -p", ownCopy: "fix-totals", parallelWith: ["s1"] }, others: [{ key: "s1", label: "Session 1 · Claude" }], setup: [{ id: "su1", kind: "Skill", name: "Brand skill", description: null, notShared: false }] } : null),
      };
  }
}

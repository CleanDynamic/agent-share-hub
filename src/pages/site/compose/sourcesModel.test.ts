// UI-P64 — Sources' data: the session numbers, the prompts nested under them,
// where a file came from, what can still be added, and what a drop is.

import { describe, expect, it } from "vitest";

import { buildSteps, sessionGroups, TYPED_HERE } from "@/lib/build/graph";
import type { MakingSession } from "@/lib/build/making";
import type { SessionSummary } from "@/lib/build/sessions";
import type { NodeTree } from "@/lib/build/types";

import {
  capRows,
  dayMonth,
  fileForUpload,
  fileOrigin,
  fileProblem,
  filesInBuild,
  isSessionExport,
  notInBuild,
  SOURCES_VISIBLE,
  sessionHeading,
  sessionLine,
  sessionsInBuild,
  typeOfFile,
} from "./sourcesModel";

const BUILD = "00000000-0000-4000-8000-000000000007";

function node(over: Partial<NodeTree> & Pick<NodeTree, "id" | "type">): NodeTree {
  return {
    build_id: BUILD,
    parent_id: null,
    position: 1,
    title: null,
    note: null,
    payload: {},
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-10-06T09:00:00.000Z",
    children: [],
    ...over,
  } as NodeTree;
}

const prompt = (id: string, position: number, text: string, session: string | null, title: string | null = null): NodeTree =>
  node({
    id,
    type: "prompt",
    position,
    title,
    payload: { text },
    source_ref: session ? { import_session_id: session } : null,
  });

const file = (id: string, position: number, name: string): NodeTree =>
  node({ id, type: "document", position, payload: { title: name } });

const summary = (id: string, over: Partial<SessionSummary> = {}): SessionSummary => ({
  id,
  client: "claude",
  model: "claude-opus-5-5",
  targetBuildId: null,
  modelName: "Opus 5.5",
  firstPrompt: "First prompt",
  promptCount: 4,
  turnCount: 8,
  createdAt: "2026-10-04T10:00:00.000Z",
  buildId: null,
  status: "parsed",
  ...over,
});

const making = (id: string, client: string, started_at: string, model: string): MakingSession => ({
  id,
  started_at,
  client,
  model,
  prompts: 1,
  turns: 2,
});

/* Four sessions, as board V2-List draws them: 1, 2, 3 and 4 (which gave two prompts). */
const tree: NodeTree[] = [
  prompt("p1", 1, "Write a brand brief.", "s1", "Brand brief"),
  prompt("p2", 2, "Write homepage copy.", "s2", "Homepage copy"),
  prompt("p3", 3, "Suggest a palette.", "s3", "Palette"),
  prompt("p4", 4, "Build the homepage. Follow CLAUDE.md. Stack: Next.js.", "s4", "Build the homepage"),
  prompt("p5", 5, "Deploy it to Vercel.", "s4"),
  file("f1", 6, "CLAUDE.md"),
];

const sessions: MakingSession[] = [
  making("s1", "chatgpt", "2026-10-03T09:00:00.000Z", "gpt-6-astra"),
  making("s2", "claude", "2026-10-04T09:00:00.000Z", "claude-opus-5-5"),
  making("s3", "web", "2026-10-04T11:00:00.000Z", "gemini-4-argon"),
  making("s4", "claude-code", "2026-10-06T09:00:00.000Z", "claude-sonnet-5-5"),
];

const steps = buildSteps(tree);
const groups = sessionGroups(steps, sessions);

describe("sessionsInBuild", () => {
  it("numbers sessions by where their first step sits, as the List does", () => {
    const rows = sessionsInBuild({ steps, groups, attached: [], library: [] });
    expect(rows.map((row) => row.number)).toEqual([1, 2, 3, 4]);
    expect(rows.map((row) => row.sessionId)).toEqual(["s1", "s2", "s3", "s4"]);
    expect(rows.map((row) => row.number)).toEqual(groups.map((group) => group.number));
  });

  it("nests under each session the prompts it gave the build, numbered as the steps are", () => {
    const rows = sessionsInBuild({ steps, groups, attached: [], library: [] });
    expect(rows[0].prompts).toEqual([{ id: "p1", number: "1", title: "Brand brief", isDefault: false }]);
    expect(rows[3].prompts).toEqual([
      { id: "p4", number: "4", title: "Build the homepage", isDefault: false },
      { id: "p5", number: "5", title: "Prompt 5", isDefault: true },
    ]);
  });

  it("reads tool, model and date from the build's own record when the session is not at hand", () => {
    const [first] = sessionsInBuild({ steps, groups, attached: [], library: [] });
    expect(first.tool).toBe("ChatGPT");
    expect(sessionHeading(first)).toBe("Session 1 · ChatGPT");
    expect(first.date).toBe(dayMonth("2026-10-03T09:00:00.000Z"));
    expect(sessionLine(first)).toBe(`${first.model} · ${first.date}`);
  });

  it("prefers the session itself over the record's copy of it", () => {
    const rows = sessionsInBuild({
      steps,
      groups,
      attached: [],
      library: [summary("s2", { client: "claude-code", modelName: "Sonnet 5.5", createdAt: "2026-10-09T10:00:00.000Z" })],
    });
    expect(rows[1].tool).toBe("Claude Code");
    expect(rows[1].model).toBe("Sonnet 5.5");
    expect(rows[1].date).toBe(dayMonth("2026-10-09T10:00:00.000Z"));
  });

  it("follows the numbered sessions with one attached that has given no step yet, oldest first", () => {
    const rows = sessionsInBuild({
      steps,
      groups,
      attached: [summary("a1", { createdAt: "2026-10-07T10:00:00.000Z" }), summary("a2", { createdAt: "2026-10-08T10:00:00.000Z" }), summary("s1")],
      library: [],
    });
    expect(rows.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.slice(4).map((row) => row.sessionId)).toEqual(["a1", "a2"]);
    expect(rows[4].prompts).toEqual([]);
  });

  it("gives prompts written here a session of their own, dated 'typed here'", () => {
    const typed = buildSteps([prompt("t1", 1, "A prompt typed here.", null)]);
    const rows = sessionsInBuild({ steps: typed, groups: sessionGroups(typed, []), attached: [], library: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionId).toBeNull();
    expect(rows[0].key).toBe("typed-1");
    expect(rows[0].date).toBe(TYPED_HERE);
  });

  it("is empty for a build with nothing in it", () => {
    expect(sessionsInBuild({ steps: [], groups: [], attached: [], library: [] })).toEqual([]);
  });
});

describe("files", () => {
  it("says a file was opened in a session only when a prompt of that session writes its name", () => {
    expect(filesInBuild(tree, steps, groups)).toEqual([{ id: "f1", name: "CLAUDE.md", origin: "opened in session 4" }]);
    expect(fileOrigin("brief.pdf", steps, groups)).toBe("added by you");
  });

  it("matches the name word for word, not by guessing", () => {
    expect(fileOrigin("claude.md", steps, groups)).toBe("added by you");
  });

  it("keeps the order the files were added in", () => {
    const rows = filesInBuild([file("b", 3, "b.txt"), file("a", 2, "a.txt")], steps, groups);
    expect(rows.map((row) => row.name)).toEqual(["a.txt", "b.txt"]);
  });

  it("ignores nodes that are not files", () => {
    expect(filesInBuild(tree.filter((n) => n.type !== "document"), steps, groups)).toEqual([]);
  });
});

describe("notInBuild", () => {
  it("lists only waiting sessions that are in no build, newest first as given", () => {
    const rows = notInBuild([
      summary("w1", { createdAt: "2026-10-05T10:00:00.000Z", promptCount: 6, client: "web", modelName: null }),
      summary("c1", { status: "claimed", buildId: BUILD }),
      summary("c2", { status: "claimed", buildId: "other" }),
      summary("e1", { status: "expired" }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["w1"]);
    expect(rows[0].line).toBe(`${dayMonth("2026-10-05T10:00:00.000Z")} · 6 prompts`);
  });

  it("says '1 prompt' for one", () => {
    expect(notInBuild([summary("w", { promptCount: 1 })])[0].line.endsWith("· 1 prompt")).toBe(true);
  });
});

describe("capRows", () => {
  const rows = Array.from({ length: 9 }, (_, at) => at);
  it("shows six, then says how many are behind Show more", () => {
    expect(capRows(rows, false)).toEqual({ shown: rows.slice(0, SOURCES_VISIBLE), more: 3 });
    expect(SOURCES_VISIBLE).toBe(6);
  });
  it("shows them all once opened, and nothing hides when there are six or fewer", () => {
    expect(capRows(rows, true)).toEqual({ shown: rows, more: 0 });
    expect(capRows(rows.slice(0, 6), false).more).toBe(0);
  });
});

describe("a drop", () => {
  it("reads a .json or .zip as a session export, and anything else as a file", () => {
    expect(isSessionExport({ name: "chat.JSON", type: "" })).toBe(true);
    expect(isSessionExport({ name: "export.zip", type: "application/zip" })).toBe(true);
    expect(isSessionExport({ name: "CLAUDE.md", type: "" })).toBe(false);
    expect(isSessionExport({ name: "brief.pdf", type: "application/pdf" })).toBe(false);
  });

  it("fills in the type a browser leaves blank for a .md", () => {
    expect(typeOfFile({ name: "CLAUDE.md", type: "" })).toBe("text/markdown");
    expect(typeOfFile({ name: "notes.txt", type: "text/plain" })).toBe("text/plain");
    expect(typeOfFile({ name: "mystery", type: "" })).toBe("");
    const filled = fileForUpload(new File(["# hi"], "CLAUDE.md"));
    expect(filled.type).toBe("text/markdown");
    expect(filled.name).toBe("CLAUDE.md");
  });

  it("names why a file cannot be added, and lets the others through", () => {
    expect(fileProblem({ name: "CLAUDE.md", type: "", size: 120 })).toBeNull();
    expect(fileProblem({ name: "big.pdf", type: "application/pdf", size: 26 * 1024 * 1024 })).toBe("big.pdf is too big. The limit is 25 MB.");
    expect(fileProblem({ name: "run.exe", type: "application/x-msdownload", size: 10 })).toBe("run.exe isn't a kind of file that can be added.");
  });
});

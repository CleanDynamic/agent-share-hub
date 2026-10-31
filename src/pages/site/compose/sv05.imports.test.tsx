// SV-05 P3: an imported session that came back short says so, with Retry, and a library row is named by its first prompt.

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { missingPrompts, tileRows, type PromptTile } from "@/lib/build/addSession";
import { buildSteps, sessionGroups } from "@/lib/build/graph";
import type { SessionSummary } from "@/lib/build/sessions";
import type { NodeTree } from "@/lib/build/types";

import { SessionHead, type SessionOps } from "./SessionHead";
import { libraryName, librarySources, NO_APP, sourceSessions } from "./sourcesModel";

const IMPORT = "11111111-0000-4000-8000-000000000001";
const prompt = (index: number, text: string): PromptTile => ({ text, reply: null, sourceRef: { source: "transcript", session_id: "s", index } as PromptTile["sourceRef"] });
const PROMPTS = [prompt(1, "Make the poster")];
const summary = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: IMPORT,
  client: null,
  model: "claude-haiku-4-5",
  targetBuildId: null,
  modelName: "Haiku 4.5",
  firstPrompt: "Make the poster",
  promptCount: 1,
  turnCount: 2,
  createdAt: "2026-10-10T10:00:00Z",
  buildId: "b",
  draftIds: ["b"],
  ...overrides,
});
const asTree = (rows: ReturnType<typeof tileRows>): NodeTree[] => rows.map((row, at) => ({ ...row, id: `n${at}`, note: null, is_gap: false, event_id: null, created_at: "", children: [] }) as unknown as NodeTree);

describe("SV-05 P3 · an imported session with no tiles", () => {
  it("an import that wrote all of its prompts has nothing missing and no short line", () => {
    const tree = asTree(tileRows("b", IMPORT, null, PROMPTS, 0));
    expect(missingPrompts(tree, IMPORT, PROMPTS)).toEqual([]);
    const steps = buildSteps(tree as never[]);
    const rows = sourceSessions(sessionGroups(steps, [], {}, { [IMPORT]: { tool: null, date: "" } }, [IMPORT]), steps, [summary()]);
    expect(rows[0].imported).toBeUndefined();
  });

  it("one that wrote none says 0 of 1 prompts imported, with Retry", () => {
    const rows = sourceSessions(sessionGroups([], [], {}, { [IMPORT]: { tool: null, date: "" } }, [IMPORT]), [], [summary()]);
    expect(rows[0]).toMatchObject({ key: IMPORT, number: 1, imported: { have: 0, of: 1 } });
    const onRetryImport = vi.fn();
    const ops = { onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onRetryImport } as SessionOps;
    render(
      <MemoryRouter>
        <SessionHead session={rows[0]} phone={false} tiles={0} collapsed={false} controls="t" onToggle={() => undefined} first last ops={ops} editable />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("session-imported").textContent).toBe("0 of 1 prompts imported");
    fireEvent.click(screen.getByRole("button", { name: "Retry importing Session 1" }));
    expect(onRetryImport).toHaveBeenCalledWith(IMPORT);
  });

  it("Retry fills the session: the missing prompts are the ones written, and then none are missing", () => {
    const missing = missingPrompts([], IMPORT, PROMPTS);
    expect(missing).toEqual(PROMPTS);
    const filled = asTree(tileRows("b", IMPORT, null, missing, 0));
    expect(missingPrompts(filled, IMPORT, PROMPTS)).toEqual([]);
    const steps = buildSteps(filled as never[]);
    const rows = sourceSessions(sessionGroups(steps, [], {}, { [IMPORT]: { tool: null, date: "" } }, [IMPORT]), steps, [summary()]);
    expect(rows[0].prompts).toHaveLength(1);
    expect(rows[0].imported).toBeUndefined();
  });
});

describe("SV-05 P3 · a library row", () => {
  it("is named by its first prompt, never the model alone", () => {
    const [item] = librarySources([summary({ client: "claude-code" })], new Set(), Date.parse("2026-10-26T10:00:00Z"));
    expect(libraryName(item)).toBe("Make the poster");
    expect(item.line).toBe("Claude Code · Haiku 4.5 · 10 Oct · 1 prompt");
  });

  it("with an unknown tool reads No harness chosen first in its detail line", () => {
    const [item] = librarySources([summary()], new Set(), Date.parse("2026-10-26T10:00:00Z"));
    expect(item.line).toBe(`${NO_APP} · Haiku 4.5 · 10 Oct · 1 prompt`);
    expect(item.appKnown).toBe(false);
    expect(libraryName(item)).not.toBe("Haiku 4.5");
  });
});

// SV-07 P7: imports. Claude Code's summary of an earlier session is a Summary tile, counted and named as no prompt, and Convert
// makes it one; the same chat imported again is marked, on its row and on its tiles.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { draftTitleOf } from "@/lib/build/addSession";
import { convertRow, targetsOf } from "@/lib/build/duplicate";
import { buildSteps, sessionGroups } from "@/lib/build/graph";
import { isSummaryPayload, SUMMARY_COPY } from "@/lib/build/summaryTurn";
import { typeLineOf } from "@/lib/build/tileLines";
import type { BuildNode, NodeTree } from "@/lib/build/types";
import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { BuildList } from "./BuildList";
import { librarySources, REPEAT_COPY, repeatedTiles, repeatsOf, sourceSessions } from "./sourcesModel";
import { CHATS, mount, pickChat, settled, setUp, tearDown } from "./sv07Harness";

vi.setConfig({ testTimeout: 120_000 });

const SUMMARY = "This session is being continued from a previous conversation that ran out of context. The conversation is summarized below: we built the poster.";
const IMPORT = "11111111-0000-4000-8000-000000000001";
const node = (id: string, position: number, text: string, over: Partial<BuildNode> = {}): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text }, source_ref: { import_session_id: IMPORT }, event_id: null, is_gap: false, created_at: "", children: [], ...over }) as unknown as NodeTree;

describe("SV-07 P7 · Claude Code's summary", () => {
  const tree = [node("n1", 0, SUMMARY), node("n2", 1, "Make the menu"), node("n3", 2, "Price it")];

  it("becomes a Summary tile: called what it is, with its word count, and counted as no prompt", () => {
    const steps = buildSteps(tree);
    expect(steps[0]).toMatchObject({ kind: "prompt", summary: true, defaultTitle: SUMMARY_COPY.title });
    expect(typeLineOf(steps[0])).toBe(`Summary · ${steps[0].words} words`);
    expect(steps[1].summary).toBeUndefined();
    const groups = sessionGroups(steps, [], {}, { [IMPORT]: { tool: null, date: "" } }, [IMPORT]);
    const [row] = sourceSessions(groups, steps, [{ id: IMPORT, client: "claude-code", model: null, targetBuildId: null, modelName: null, firstPrompt: "Make the menu", promptCount: 3, turnCount: 6, createdAt: "2026-10-10T10:00:00Z", buildId: "b" }]);
    // Two prompts listed and counted; the session did not come in short, for the summary is one of its turns.
    expect(row.prompts.map((prompt) => prompt.id)).toEqual(["n2", "n3"]);
    expect(row.imported).toBeUndefined();
  });

  it("is drawn on the List as Summary of an earlier chat, never as a prompt's place", () => {
    const steps = buildSteps(tree);
    render(
      <MemoryRouter>
        <BuildList {...sandboxListProps("fox")} steps={steps} />
      </MemoryRouter>,
    );
    const card = screen.getAllByTestId("step-card").find((element) => element.getAttribute("data-kind") === "summary") as HTMLElement;
    expect(card.getAttribute("aria-label")).toMatch(/^Summary of an earlier chat/);
    expect(within(card).getByTestId("prompt-eyebrow").textContent).toMatch(/^Summary · \d+ words$/);
  });

  it("Convert makes it a prompt, keeping everything it holds", () => {
    const row = { ...node("n1", 0, SUMMARY), payload: { text: SUMMARY, model: "Opus 5.5", session: IMPORT } } as unknown as BuildNode;
    expect(targetsOf(row)).toContain("prompt");
    const plan = convertRow(row, "prompt", "x");
    expect(plan.refusal).toBeNull();
    expect(plan.row?.payload).toEqual({ text: SUMMARY, model: "Opus 5.5", session: IMPORT, as_prompt: true });
    expect(isSummaryPayload(plan.row?.payload)).toBe(false);
    const [step] = buildSteps([{ ...node("n1", 0, SUMMARY), payload: plan.row?.payload } as unknown as NodeTree]);
    expect(step.summary).toBeUndefined();
    expect(step.defaultTitle).toBe("Prompt 1");
    // An ordinary prompt still offers only the other two.
    expect(targetsOf(node("n2", 1, "Make the menu") as unknown as BuildNode)).toEqual(["agent", "manual"]);
  });

  it("a draft made from such a chat is named by its first real prompt", () => {
    expect(draftTitleOf("This session is being continued from a previous", [{ text: SUMMARY }, { text: "Make the menu for the bakery" }])).toBe("Make the menu for the bakery");
    expect(draftTitleOf("Bakery site", [{ text: SUMMARY }])).toBe("Bakery site");
    expect(draftTitleOf(null, [{ text: SUMMARY }])).toBe("Untitled build");
  });
});

describe("SV-07 P7 · repeated chats, as pure functions", () => {
  it("a library row with the transcript of a session in the build says which, by one Map", () => {
    const groups = sessionGroups(buildSteps([node("n1", 0, "Make the poster")]), [], {}, { [IMPORT]: { tool: null, date: "" } }, [IMPORT]);
    const repeats = repeatsOf([{ id: IMPORT, contentHash: "h1" }], groups);
    expect(repeats).toEqual(new Map([["h1", 1]]));
    const base = { client: "claude", model: null, targetBuildId: null, modelName: null, firstPrompt: "Make the poster", promptCount: 1, turnCount: 2, createdAt: "2026-10-10T10:00:00Z", buildId: null };
    const rows = librarySources([{ ...base, id: "again", contentHash: "h1", draftIds: [] }, { ...base, id: "other", contentHash: "h2", draftIds: [] }], new Set(), Date.now(), "b", repeats);
    expect(rows.map((row) => row.sameAs)).toEqual([1, undefined]);
  });

  it("each tile of a session whose prompts repeat an earlier session's says Also in that session", () => {
    const runs = [
      { head: { key: "a", number: 1 }, steps: [{ id: "a1", kind: "prompt" as const, text: "One" }, { id: "a2", kind: "prompt" as const, text: "Two" }] },
      { head: { key: "b", number: 2 }, steps: [{ id: "b1", kind: "prompt" as const, text: "Other" }] },
      { head: { key: "c", number: 3 }, steps: [{ id: "c1", kind: "prompt" as const, text: "One" }, { id: "c2", kind: "prompt" as const, text: "Two" }] },
    ];
    expect(repeatedTiles(runs)).toEqual(new Map([["c1", 1], ["c2", 1]]));
    expect(REPEAT_COPY.alsoIn(1)).toBe("Also in Session 1");
  });
});

describe("SV-07 P7 · the same chat imported twice, on the page", () => {
  beforeEach(setUp);
  afterEach(tearDown);

  it("its row says Same prompts as Session 1, and once added each of its tiles says Also in Session 1", async () => {
    mount([]);
    fireEvent.click(screen.getByTestId("empty-build-chats"));
    await pickChat(CHATS[0].name);
    await settled(1);
    fireEvent.click(screen.getByTestId("add-session-row"));
    fireEvent.click(screen.getByRole("button", { name: /Add from your connected chats/ }));
    const picker = await screen.findByTestId("add-session-picker");
    const twin = await waitFor(() => {
      const found = within(picker).getAllByRole("listitem").find((row) => (row.getAttribute("aria-label") ?? "").includes(REPEAT_COPY.sameAs(1)));
      if (!found) throw new Error("no repeated row");
      return found;
    }, { timeout: 15_000 });
    // The seed's twin of the first chat (`TWIN`): the same transcript, imported again.
    fireEvent.click(twin);
    await settled(2);
    await waitFor(() => expect(screen.getAllByTestId("also-in").map((line) => line.textContent)).toEqual([REPEAT_COPY.alsoIn(1)]), { timeout: 15_000 });
  });
});

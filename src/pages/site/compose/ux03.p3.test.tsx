// UX-03 P3: the steps match the build, and empty sessions never go live.
//
// The composer is mounted for real on the audit backend (only the network faked). The build page's steps are drawn from the same
// rows the composer wrote, through the reader's own pipeline (nestNodes, readerSteps), so the two can be compared tile for tile.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { tableRows } from "@/lib/build/__audit__/fakeSupabase";
import { nestNodes } from "@/lib/build/nodes";
import { CHECKLIST_COPY, publishChecklist, type ChecklistInput } from "@/lib/build/publishChecklist";
import { buildCounts, readerMap, readerSteps, whatYouNeed } from "@/lib/build/readerSteps";
import type { BuildNode } from "@/lib/build/types";
import { NeedPanel, StepsList } from "@/pages/site/build/BuildSteps";
import { asMaking, type BuildStepsView } from "@/pages/site/build/buildModel";

import { DRAFT, draftRow, harnessAfter, harnessBefore, mountCa20, sessionsOf } from "./ca20Harness";
import { KEY_A, KEY_B, KEY_C, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });
beforeEach(harnessBefore);
afterEach(harnessAfter);

const BASE: ChecklistInput = {
  missing: [],
  title: "Poster",
  description: "A poster.",
  cover: "image",
  tiles: 3,
  blockers: [],
  threadHold: null,
  reminders: [],
  appless: [],
  cardFilled: true,
  unsent: [],
};

describe("UX-03 P3: an empty session is a required publish item", () => {
  it("names the session by its number, says why, and holds Publish", () => {
    const list = publishChecklist({ ...BASE, empty: [{ key: "typed-c", number: 3 }] });
    const item = list.required.find((entry) => entry.key === "empty-typed-c");
    expect(item).toMatchObject({
      section: "required",
      done: false,
      words: "Session 3 has no steps",
      detail: "Empty sessions are not published",
      action: { id: "remove_session", label: "Remove session" },
      sessionKey: "typed-c",
    });
    expect(list.canPublish).toBe(false);
    expect(list.note).toBe("Complete 1 required item to publish");
  });

  it("is not there when every session has a step", () => {
    const list = publishChecklist({ ...BASE, empty: [] });
    expect(list.required.some((entry) => entry.action?.id === "remove_session")).toBe(false);
    expect(list.canPublish).toBe(true);
    expect(CHECKLIST_COPY.removeSession).toBe("Remove session");
  });

  it("Remove session removes it through the List's own remove, and Undo brings it back", async () => {
    await mountCa20(seedCa20);
    const order = () =>
      sessionsOf()
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((row) => row.session_key);
    expect(order()).toEqual([KEY_A, KEY_B, KEY_C]);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const window = await screen.findByTestId("publish-checklist");
    expect(within(window).getByText("Session 3 has no steps")).toBeTruthy();
    expect(within(window).getByText("Empty sessions are not published")).toBeTruthy();
    expect((screen.getByTestId("checklist-publish") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(window).getByRole("button", { name: "Remove session: Session 3 has no steps" }));
    await waitFor(() => expect(order()).toEqual([KEY_A, KEY_B]), { timeout: 15_000 });
    const undoButton = await screen.findByTestId("notice-undo", undefined, { timeout: 15_000 });
    expect(await screen.findByText(/^Removed Session 3\./, undefined, { timeout: 15_000 })).toBeTruthy();
    fireEvent.click(await screen.findByTestId("notice-undo"));
    await waitFor(() => expect(order()).toEqual([KEY_A, KEY_B, KEY_C]), { timeout: 15_000 });
  });
});

/* ── the composer's List and the build page's steps ── */

const ID = (n: number) => `0c3c3c3c-0000-4000-8000-${String(n).padStart(12, "0")}`;
const IDS = { p1: ID(1), p2: ID(2), sent: ID(3), p3: ID(4), file: ID(5), team: ID(6), agent: ID(7) } as const;
const S1 = "typed-ux03-a";
const S2 = "typed-ux03-b";

type Row = Record<string, unknown>;
const node = (id: string, position: number, type: string, payload: Row, parent: string | null = null, title: string | null = null): Row => ({
  id,
  build_id: DRAFT,
  parent_id: parent,
  position,
  type,
  title,
  note: null,
  payload,
  source_ref: null,
  event_id: null,
  is_gap: false,
  created_at: "2026-10-20T10:00:00Z",
});

/** Two sessions: two prompts, the second with a prompt sent with it; then a prompt and a File step. */
function seedParity(rows: Record<string, Row[]>) {
  const build = rows.builds.find((row) => row.id === DRAFT) as Row;
  build.title = "UX-03 parity";
  build.making = {
    sessions_meta: { [S1]: { tool: "claude-code", date: "2026-10-20" }, [S2]: { tool: "claude-code", date: "2026-10-21" } },
    session_order: [S1, S2],
  };
  rows.build_nodes.push(
    node(IDS.p1, 0, "prompt", { text: "Write the poster copy", session: S1 }),
    node(IDS.p2, 1, "prompt", { text: "Pick the poster colours", session: S1 }),
    node(IDS.sent, 0, "prompt", { text: "Use the brand palette", session: S1 }, IDS.p2),
    node(IDS.p3, 2, "prompt", { text: "Write the menu", session: S2 }),
    node(IDS.file, 3, "document", { title: "brief.md", step: true, session: S2, url: "https://example.test/brief.md" }, null, "brief.md"),
  );
  rows.build_sessions.push(
    { id: ID(101), build_id: DRAFT, session_key: S1, import_id: null, position: 0, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
    { id: ID(102), build_id: DRAFT, session_key: S2, import_id: null, position: 1, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
  );
}

function stepsView(tree: ReturnType<typeof nestNodes>, makingRaw: unknown): BuildStepsView {
  const making = asMaking(makingRaw);
  const steps = readerSteps(tree, making);
  const map = readerMap(tree, making);
  return {
    steps,
    results: [],
    need: whatYouNeed(steps, tree, making),
    counts: buildCounts(steps),
    map,
    groups: map.groups,
    making: makingRaw as BuildStepsView["making"],
    mapAvailable: false,
    onCopy: async () => true,
    resolveMedia: () => undefined,
    otherBody: () => null,
    focus: null,
  } as BuildStepsView;
}

const drawPage = (view: BuildStepsView) =>
  render(
    <MemoryRouter>
      <StepsList view={view} phone={false} announce={() => undefined} />
      <NeedPanel view={view} onOpenOther={() => undefined} />
    </MemoryRouter>,
  );

describe("UX-03 P3: the build page's steps match the composer's List", () => {
  it("has the same step ids in the same order, the file in the same place", async () => {
    await mountCa20(seedParity);
    await screen.findByRole("group", { name: /^Session 2 · / }, { timeout: 15_000 });
    const collect = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-skel-id]"))
        .map((el) => el.getAttribute("data-skel-id"))
        .filter((id): id is string => Object.values(IDS).includes(id as never))
        // A tile and its card can both carry the id: each tile once, in the order it is drawn.
        .filter((id, at, all) => all.indexOf(id) === at);
    await waitFor(() => expect(collect()).toEqual([IDS.p1, IDS.p2, IDS.sent, IDS.p3, IDS.file]), { timeout: 15_000 });
    const list = collect();

    // The page reads the rows the composer holds now.
    const nodes = tableRows("build_nodes").filter((row) => row.build_id === DRAFT) as unknown as BuildNode[];
    const making = draftRow()?.making;
    cleanup();
    drawPage(stepsView(nestNodes(nodes), making));
    const page = Array.from(document.querySelectorAll<HTMLElement>("[data-testid='build-steps'] [id^='step-']"))
      .map((el) => el.id.slice("step-".length))
      .filter((id) => Object.values(IDS).includes(id as never));
    expect(page).toEqual(list);
  });
});

describe("UX-03 P3: one label per step", () => {
  const tree = () =>
    nestNodes([
      node(IDS.p1, 0, "prompt", { text: "Write the poster copy" }),
      node(IDS.team, 1, "team", { pattern: "pipeline" }, null, "Poster team"),
      node(IDS.agent, 0, "agent_config", { system_prompt: "Draft the copy." }, IDS.team, "Copywriter"),
      node(IDS.file, 2, "document", { title: "brief.md", step: true, url: "https://example.test/brief.md" }, null, "brief.md"),
    ] as unknown as BuildNode[]);

  it("heads each step Step <n> · <Type>, with the number exactly as given and no generated title", () => {
    drawPage(stepsView(tree(), {}));
    const labels = screen.getAllByTestId("step-label").map((el) => el.textContent);
    expect(labels).toContain("Step 1 · Prompt");
    expect(labels).toContain("Step 2 · Multi-agent team");
    expect(labels).toContain("Step 2.1 · Agent");
    expect(labels).toContain("Step 3 · File");
    // The generated "Prompt 1" is not shown; the titles the maker typed are, under the head.
    expect(document.body.textContent).not.toContain("Prompt 1 ·");
    expect(screen.getAllByTestId("step-own-title").map((el) => el.textContent)).toEqual(expect.arrayContaining(["Poster team", "Copywriter"]));
  });

  it("draws a File step with its name and Download, and the Files list links to it", () => {
    drawPage(stepsView(tree(), {}));
    const tile = document.getElementById(`step-${IDS.file}`) as HTMLElement;
    expect(within(tile).getByTestId("step-label").textContent).toBe("Step 3 · File");
    expect(within(tile).getAllByText("brief.md").length).toBeGreaterThan(0);
    expect(within(tile).getByRole("link", { name: /Download/ })).toBeTruthy();
    const files = screen.getByRole("region", { name: "Files" });
    expect(within(files).getByRole("link", { name: "step 3" }).getAttribute("href")).toBe(`#step-${IDS.file}`);
  });
});

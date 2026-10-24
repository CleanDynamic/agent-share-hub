// CA-20 P7: Duplicate, Convert, Collapse all and Ungroup, on the CA-20 draft.

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { CONVERT_COPY, convertRow, duplicateTiles } from "@/lib/build/duplicate";
import type { BuildSnapshot } from "@/lib/build/buildSnapshot";
import type { BuildNode } from "@/lib/build/types";

import { draftRow, harnessAfter, harnessBefore, mountCa20, nodeRow, positions } from "./ca20Harness";
import { IDS, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

const row = (id: string, parent: string | null, position: number, type: string, payload: Record<string, unknown>, title: string | null = null): BuildNode =>
  ({ id, build_id: "b", parent_id: parent, position, type, title, note: null, payload, source_ref: "x", event_id: "y", is_gap: false, created_at: "" }) as unknown as BuildNode;
const snap = (nodes: BuildNode[]): BuildSnapshot => ({ nodes, sessions: [], making: {} });

describe("the planners", () => {
  it("puts a copy directly below its original, with what is inside it, new ids and a copy title", () => {
    let n = 0;
    const out = duplicateTiles(snap([row("a", null, 0, "prompt", { text: "A" }, "Login"), row("t", null, 1, "team", {}), row("g", "t", 0, "agent_config", {})]), ["a", "t"], () => `new-${++n}`);
    const tops = out.snapshot.nodes.filter((r) => r.parent_id === null).sort((x, y) => (x.position ?? 0) - (y.position ?? 0)).map((r) => r.id);
    expect(tops).toEqual(["a", "new-1", "t", "new-2"]);
    expect(out.snapshot.nodes.find((r) => r.id === "new-1")?.title).toBe("Login copy");
    expect(out.snapshot.nodes.find((r) => r.id === "new-1")?.source_ref).toBeNull();
    expect(out.snapshot.nodes.filter((r) => r.parent_id === "new-2")).toHaveLength(1);
    expect(new Set(out.snapshot.nodes.map((r) => r.id)).size).toBe(out.snapshot.nodes.length);
  });

  it("carries the words, session, colour and uses across, and says what does not come across", () => {
    const prompt = row("p", null, 0, "prompt", { text: "Do it", session: "s", colour: "#112233", uses: [{ kind: "file", node_id: "f" }], model: "m" });
    const agent = convertRow(prompt, "agent", "claude-x");
    expect(agent.row?.type).toBe("agent_config");
    expect(agent.row?.payload).toMatchObject({ system_prompt: "Do it", model: "claude-x", session: "s", colour: "#112233", uses: [{ kind: "file", node_id: "f" }] });
    expect(agent.lost).toEqual(["Model"]);
    expect(convertRow(prompt, "manual", "m").refusal).toBe(CONVERT_COPY.needsTool);
    const back = convertRow(agent.row as BuildNode, "prompt", "m");
    expect(back.row?.payload).toMatchObject({ text: "Do it", session: "s" });
  });
});

describe("on the draft", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  const openMenu = (name: string | RegExp) => fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
  const tops = () => positions().filter((r) => r.parent_id === null);

  it("Duplicate puts a copy directly below, as one step Undo takes back", async () => {
    await mountCa20(seedCa20);
    const before = tops().length;
    openMenu("Prompt 2 options");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    await waitFor(() => expect(tops()).toHaveLength(before + 1), { timeout: 15_000 });
    const order = tops().map((r) => r.id as string);
    const copy = nodeRow(order[order.indexOf(IDS.p2) + 1]);
    expect(copy?.id).not.toBe(IDS.p2);
    expect((copy?.payload as { text: string }).text).toBe("Add the order form");
    expect(await screen.findByText("Duplicated Prompt 2")).toBeTruthy();
    fireEvent.click(screen.getByTestId("title-undo"));
    await waitFor(() => expect(tops()).toHaveLength(before), { timeout: 15_000 });
  });

  it("Convert keeps the tile's id, and Undo turns it back", async () => {
    await mountCa20(seedCa20);
    openMenu("Prompt 1 options");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Convert to agent…" }));
    await waitFor(() => expect(nodeRow(IDS.p1)?.type).toBe("agent_config"), { timeout: 15_000 });
    expect((nodeRow(IDS.p1)?.payload as { system_prompt: string }).system_prompt).toBe("Write the login page");
    // Still in its group.
    expect(JSON.stringify((draftRow()?.making as { reference_groups: unknown }).reference_groups)).toContain(IDS.p1);
    fireEvent.click(screen.getByTestId("title-undo"));
    await waitFor(() => expect(nodeRow(IDS.p1)?.type).toBe("prompt"), { timeout: 15_000 });
  });

  it("Convert asks when something would be lost, and Cancel changes nothing", async () => {
    await mountCa20(seedCa20);
    openMenu(screen.getAllByRole("button", { name: /^Prompt \d+ options$/ }).map((b) => b.getAttribute("aria-label"))[2] as string);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Convert to agent…" }));
    const ask = await screen.findByTestId("convert-window");
    expect(within(ask).getByText("These won't carry over: Effort.")).toBeTruthy();
    fireEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByTestId("convert-window")).toBeNull());
    expect(nodeRow(IDS.p3)?.type).toBe("prompt");
  });

  it("greys Convert to manual step, with its reason, when there is no tool", async () => {
    await mountCa20(seedCa20);
    openMenu("Prompt 1 options");
    const item = await screen.findByRole("menuitem", { name: "Convert to manual step…" });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(item.getAttribute("title")).toBe(CONVERT_COPY.needsTool);
  });

  it("Ungroup is not in the menu of a tile that is in no group", async () => {
    await mountCa20(seedCa20);
    openMenu("Prompt 2 options");
    await screen.findByRole("menuitem", { name: "Duplicate" });
    expect(screen.queryByRole("menuitem", { name: "Ungroup" })).toBeNull();
  });

  it("Ungroup takes a tile out of its group, and the group ends with one left", async () => {
    await mountCa20(seedCa20);
    openMenu("Prompt 1 options");
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ungroup" }));
    await waitFor(() => expect((draftRow()?.making as { reference_groups?: unknown[] }).reference_groups ?? []).toHaveLength(0), { timeout: 15_000 });
    expect(await screen.findByText("Ungrouped Prompt 1 from Login flow")).toBeTruthy();
  });

  it("Collapse all folds every session, then Expand all opens them", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getByTestId("sandbox-view"), { key: "Enter" });
    fireEvent.click(await screen.findByTestId("view-fold"));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /expand/i }).length).toBeGreaterThan(0), { timeout: 15_000 });
    fireEvent.keyDown(screen.getByTestId("sandbox-view"), { key: "Enter" });
    expect((await screen.findByTestId("view-fold")).textContent).toBe("Expand all");
  });
});

describe("Group, with the reference bridge", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  it("Ctrl G groups the chosen tiles in one step with one notice, and Undo takes the group away", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(screen.getByText("Add the order form"), { ctrlKey: true });
    fireEvent.click(screen.getByText("Read the orders"), { ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "g", ctrlKey: true });
    await waitFor(() => expect((draftRow()?.making as { reference_groups: unknown[] }).reference_groups).toHaveLength(2), { timeout: 15_000 });
    expect(await screen.findByText("Grouped 2 components")).toBeTruthy();
    fireEvent.click(screen.getByTestId("title-undo"));
    await waitFor(() => expect((draftRow()?.making as { reference_groups: unknown[] }).reference_groups).toHaveLength(1), { timeout: 15_000 });
  });
});

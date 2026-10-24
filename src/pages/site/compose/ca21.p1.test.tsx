// CA-21 P1 - Move up and Move down always move, on the CA-20 draft: Session 1 (P1, P2), Session 2 (the team, P3, P4), Session 3 (empty).

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { sessionsMetaOf } from "@/lib/build/making";

import { draftRow, harnessAfter, harnessBefore, mountCa20, nodeRow } from "./ca20Harness";
import { IDS, KEY_A, KEY_B, KEY_C, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

const sessionOf = (id: string) => (nodeRow(id)?.payload as { session?: string }).session;
const said = () => screen.getByTestId("sessions-said").textContent;

async function openMenu(name: string) {
  fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
  await screen.findByRole("menuitem", { name: "Move up" });
}

describe("Move up and Move down (CA-21 P1)", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  it("moves a tile that is not a prompt: the team swaps with its neighbour in its own session", async () => {
    await mountCa20(seedCa20);
    await openMenu("Team 3 options");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move down" }));
    await waitFor(() => expect(nodeRow(IDS.team)?.position).toBeGreaterThan(Number(nodeRow(IDS.p3)?.position)), { timeout: 15_000 });
    expect(sessionOf(IDS.team)).toBe(KEY_B);
  });

  it("at the top of its session goes to the end of the session above, says so, and Undo takes it back", async () => {
    await mountCa20(seedCa20);
    await openMenu("Team 3 options");
    expect(screen.getByRole("menuitem", { name: "Move up" }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Move up" }));
    await waitFor(() => expect(sessionOf(IDS.team)).toBe(KEY_A), { timeout: 15_000 });
    await waitFor(() => expect(said()).toMatch(/^Moved .* to Session 1\.$/), { timeout: 15_000 });
    expect(Number(nodeRow(IDS.team)?.position)).toBeGreaterThan(Number(nodeRow(IDS.p2)?.position));
    const undo = await screen.findByTestId("title-undo");
    await waitFor(() => expect(undo.getAttribute("title")).toMatch(/^Undo: Moved .* up/), { timeout: 15_000 });
    fireEvent.click(undo);
    await waitFor(() => expect(sessionOf(IDS.team)).toBe(KEY_B), { timeout: 15_000 });
  });

  it("at the bottom of its session goes to the start of the session below, even an empty one", async () => {
    await mountCa20(seedCa20);
    await openMenu("Prompt 5 options");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move down" }));
    await waitFor(() => expect(sessionOf(IDS.p4)).toBe(KEY_C), { timeout: 15_000 });
    await waitFor(() => expect(said()).toMatch(/to Session 3\.$/), { timeout: 15_000 });
  });

  it("is greyed only at the very first tile of the build", async () => {
    await mountCa20(seedCa20);
    await openMenu("Prompt 1 options");
    expect(screen.getByRole("menuitem", { name: "Move up" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Move down" }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Move up" })).toBeNull());
    // Prompt 2 is the last tile of Session 1, and Session 2 is below it: it can move down.
    await openMenu("Prompt 2 options");
    expect(screen.getByRole("menuitem", { name: "Move down" }).getAttribute("aria-disabled")).toBeNull();
  });

  it("a session's Move down in the only part swaps it with the next, and the first session's Move up is greyed", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(within(screen.getByRole("group", { name: /^Session 1 · / })).getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    expect((await screen.findByRole("menuitem", { name: "Move up" })).getAttribute("aria-disabled")).toBe("true");
  });

  it("a session at the edge of its part goes into the next part, never a silent refusal", async () => {
    await mountCa20((rows) => {
      seedCa20(rows);
      const build = rows.builds.find((row) => row.id === "0d0d0d0d-0000-4000-8000-000000000003") as { making: Record<string, unknown> };
      build.making = {
        ...build.making,
        workstreams: [{ key: "ws-a" }, { key: "ws-b" }],
        sessions_meta: { [KEY_A]: { tool: "claude-code", date: "2026-10-20", workstream: "ws-a" }, [KEY_B]: { tool: "claude-code", date: "2026-10-21", title: "Support", workstream: "ws-a" }, [KEY_C]: { tool: null, date: "2026-10-22", workstream: "ws-b" } },
      };
    });
    fireEvent.keyDown(within(screen.getByRole("group", { name: /^Session 2 · / })).getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move down" }));
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[KEY_B]?.workstream).toBe("ws-b"), { timeout: 15_000 });
    // Its tiles went with it.
    expect(sessionOf(IDS.p3)).toBe(KEY_B);
  });
});

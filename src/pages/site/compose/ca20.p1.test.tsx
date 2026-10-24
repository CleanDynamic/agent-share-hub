// CA-20 P1 - every button does something you can see, or is greyed out with a reason.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { REASONS } from "@/lib/build/componentMenus";

import { LONG, WAITING, describedBy, harnessAfter, harnessBefore, oneSession, twoSessions } from "./ca20Harness";

vi.setConfig({ testTimeout: 30_000 });
beforeEach(harnessBefore);
afterEach(harnessAfter);

const openView = async () => {
  fireEvent.keyDown(await screen.findByTestId("sandbox-view"), { key: "Enter" });
  return screen.findByRole("menuitemcheckbox", { name: "Session list" });
};

describe("CA-20 P1 · View", () => {
  it("has no Split and merge switch, and the Session list is greyed with its reason while there is one session", async () => {
    await oneSession();
    const row = await openView();
    expect(screen.queryByRole("menuitemcheckbox", { name: /Split and merge/ })).toBeNull();
    expect(row.getAttribute("aria-disabled")).toBe("true");
    expect(describedBy(row)).toBe(REASONS.sessionList);
    expect(row.getAttribute("title")).toBe("Shows once the build has two or more sessions");
    // A greyed row does nothing.
    fireEvent.click(row);
    expect(window.localStorage.length === 0 || ![...Object.values(window.localStorage)].some((value) => value.includes('"sessionList":true'))).toBe(true);
  });

  it("works with two sessions, and shows the list at once", async () => {
    await twoSessions();
    const row = await openView();
    expect(row.getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(row);
    expect(await screen.findByRole("navigation", { name: "Sessions" })).toBeTruthy();
  });
});

describe("CA-20 P1 · menu items that apply are always there", () => {
  it("offers Split session here on a tile that is not first in its session, and Merge with the session above on a session that is not first, with no switch", async () => {
    await twoSessions();
    fireEvent.click(screen.getByRole("button", { name: "Expand Session 2" }));
    fireEvent.keyDown(await screen.findByRole("button", { name: "Prompt 3 options" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Split session here" })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Merge with the session above" })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Move up" });
    expect(screen.queryByRole("menuitem", { name: "Merge with the session above" })).toBeNull();
  });
});

describe("CA-20 P1 · every greyed item has a reason", () => {
  const reasonOf = (name: string) => describedBy(screen.getByRole("menuitem", { name }));

  it("says why on a session's Move up and Move down", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Move up" });
    expect(screen.getByRole("menuitem", { name: "Move up" }).getAttribute("aria-disabled")).toBe("true");
    expect(reasonOf("Move up")).toBe("Already the first session");
    expect(screen.getByRole("menuitem", { name: "Move down" }).getAttribute("aria-disabled")).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Move down" });
    expect(reasonOf("Move down")).toBe("Already the last session");
  });

  it("says why on a tile's Move up, Move down and Move to session", async () => {
    await oneSession();
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 1 options" }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Move up" });
    expect(reasonOf("Move up")).toBe("Already the first tile");
    expect(reasonOf("Move down")).toBe("Already the last tile");
    expect(reasonOf("Move to session…")).toBe("Only one session");
  });

  it("every greyed menu item, in every menu of a one-session draft, is described", async () => {
    await oneSession();
    for (const name of ["Prompt 1 options", "Session 1 options"]) {
      fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
      await screen.findAllByRole("menuitem");
      for (const item of screen.getAllByRole("menuitem").filter((entry) => entry.getAttribute("aria-disabled") === "true")) {
        expect(describedBy(item), `${item.textContent} is greyed`).not.toBe("");
      }
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
      await waitFor(() => expect(screen.queryAllByRole("menuitem")).toHaveLength(0));
    }
    void within;
    void WAITING;
    void LONG;
  });
});

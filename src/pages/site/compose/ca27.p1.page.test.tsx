// CA-27 P1: Find in build on the composer's own page (SandboxPage behind supabase-js, only the network faked).

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { SHORTCUTS } from "@/lib/build/shortcuts";

import { harnessAfter, harnessBefore, mountCa20 } from "./ca20Harness";
import { seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

const press = (key: string, extra: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.body, { key, ...extra });

describe("on the build page", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  it("/ opens Find in build, and finds a word in a tile", async () => {
    await mountCa20(seedCa20);
    expect(screen.queryByTestId("find-field")).toBeNull();
    press("/");
    await screen.findByTestId("find-field");
    const input = screen.getByTestId("find-input") as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(input));
    const first = document.querySelector('[data-testid="step-card"]');
    const word = (first?.querySelector("h3")?.textContent ?? "").split(/\s+/).find((piece) => piece.length > 3) ?? "Prompt";
    fireEvent.change(input, { target: { value: word } });
    await waitFor(() => expect(screen.getByTestId("find-count").textContent).toMatch(/^1 of \d+$/));
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByTestId("find-field")).toBeNull();
  });

  it("the Find in build button is before View, and ? lists Find in build with /", async () => {
    await mountCa20(seedCa20);
    const button = screen.getByRole("button", { name: "Find in build" });
    expect(button.compareDocumentPosition(screen.getByTestId("sandbox-view")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    press("?");
    const window_ = await screen.findByTestId("shortcuts-window");
    const rows = within(window_).getAllByTestId("shortcut-row");
    expect(rows).toHaveLength(SHORTCUTS.length);
    expect(rows.find((row) => row.textContent?.includes("Find in build"))?.textContent).toContain("/");
  });
});

// SV-07 P6: small fixes seen in the recording. One look for an empty session; the import list opens under its row in the flow,
// at the column's width; labels and controls can't be selected, prompt text can. (Whether the part frame clips a focus ring
// needs layout, so Part 9 checks it in a browser.)

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import type { Delay } from "@/lib/build/__audit__/fakeSupabase";

import { CHATS, making, mount, pickChat, settled, setUp, tearDown } from "./sv07Harness";

vi.setConfig({ testTimeout: 120_000 });

const SLOW: Delay[] = ["PATCH", "POST", "DELETE"].map((method) => ({ method, path: /^\/rest\/v1\/(?!rpc)/, delayMs: 400 }));

beforeEach(setUp);
afterEach(tearDown);

describe("SV-07 P6 · an empty session looks one way", () => {
  it("a session started here reads No tiles yet with + Add tile from the moment it lands, never the dashed drop place", async () => {
    mount(SLOW);
    fireEvent.click(screen.getByTestId("empty-build-chats"));
    await pickChat(CHATS[0].name);
    await settled(1);
    let dashed = false;
    const observer = new MutationObserver(() => {
      if (screen.queryByText("Drop a tile here")) dashed = true;
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    fireEvent.click(screen.getByTestId("add-session-row"));
    act(() => fireEvent.click(screen.getByRole("button", { name: /Start a new session/ })));
    await settled(2);
    observer.disconnect();
    expect(dashed).toBe(false);
    const started = ((making() as { session_order: string[] }).session_order ?? [])[1];
    const session = document.querySelector(`[data-session-key="${started}"]`) as HTMLElement;
    expect(within(session).getByText("No tiles yet")).toBeTruthy();
    expect(within(session).getByRole("button", { name: /Add tile/ })).toBeTruthy();
  });
});

describe("SV-07 P6 · the import list", () => {
  it("opens under its row, in the column's flow and at its width, and takes the focus; Escape gives it back", async () => {
    mount([]);
    const row = screen.getByTestId("empty-build-chats");
    fireEvent.click(row);
    const panel = await screen.findByTestId("open-below");
    // In the Build column, not a floating layer at the body.
    expect(screen.getByTestId("empty-build").contains(panel)).toBe(true);
    expect(panel.style.position).toBe("");
    expect(panel.style.width).toBe("100%");
    expect(within(panel).getByTestId("add-session-picker")).toBeTruthy();
    // What stood below it is still there, under it: drawn after it, not covered by it.
    const start = screen.getByTestId("empty-build-new");
    expect(panel.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByTestId("open-below")).toBeNull();
    expect(document.activeElement).toBe(row);
  });
});

describe("SV-07 P6 · what can be selected", () => {
  it("a session head, the counts and the jump tabs select nothing; the title field and the prompt's text still can", async () => {
    mount([]);
    fireEvent.click(screen.getByTestId("empty-build-chats"));
    await pickChat(CHATS[0].name);
    await settled(1);
    const head = await screen.findByTestId("session-head");
    expect(head.style.userSelect).toBe("none");
    expect((within(head).getByTestId("session-title") as HTMLElement).style.userSelect).toBe("text");
    expect(screen.getByTestId("sandbox-counts").style.userSelect).toBe("none");
    // The prompt's own words are text to copy: nothing above them says otherwise.
    const words = await waitFor(() => screen.getByText(/Make the poster for the bakery/));
    for (let at: HTMLElement | null = words; at && at !== document.body; at = at.parentElement) {
      if (at === head) break;
      expect(at.style.userSelect, at.getAttribute("data-testid") ?? at.tagName).not.toBe("none");
    }
  });
});

// SV-07 P3: parts. Add a part answers at once and makes one part however often it is pressed; adding into a closed part opens
// it; a jump tab opens a closed part and reaches the session. On the real page, writes slow.

import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { requests, type Delay } from "@/lib/build/__audit__/fakeSupabase";
import { storedWorkstreamsOf } from "@/lib/build/making";

import { scrollNeeded } from "./pageScroll";
import { addChatTo, CHATS, making, mount, partKeys, pickChat, settled, setUp, tearDown } from "./sv07Harness";

vi.setConfig({ testTimeout: 120_000 });

/** Every write takes 400 ms: long enough that anything drawn before it lands was drawn from the click. */
const SLOW: Delay[] = ["PATCH", "POST", "DELETE"].map((method) => ({ method, path: /^\/rest\/v1\/(?!rpc)/, delayMs: 400 }));

beforeEach(setUp);
afterEach(tearDown);

/** A new post with one imported chat, saved. */
async function oneSession() {
  mount(SLOW);
  fireEvent.click(screen.getByTestId("empty-build-chats"));
  await pickChat(CHATS[0].name);
  await settled(1);
}

const groups = () => screen.queryAllByTestId("workstream-group");

describe("SV-07 P3 · Add a part", () => {
  it("one click shows the parts at once, before anything is written: Part 1 with the session there is, and an empty Part 2", async () => {
    await oneSession();
    const row = screen.getByTestId("add-part-row");
    const writes = () => requests().filter((request) => request.method === "PATCH" && request.path.startsWith("/rest/v1/builds")).length;
    const before = writes();
    // Drawn in the click's own commit (the time in a browser is measured by Part 9's recording).
    act(() => fireEvent.click(row));
    expect(groups()).toHaveLength(2);
    expect(writes()).toBe(before);
    expect(within(groups()[0]).getAllByRole("group", { name: /^Session 1/ }).length).toBeGreaterThan(0);
    expect(within(groups()[1]).getByTestId("workstream-empty").textContent).toContain("No sessions yet");
    // While it is written the row is disabled, and enabled again once it has landed.
    expect((screen.getByTestId("add-part-row") as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(partKeys()).toHaveLength(2), { timeout: 15_000 });
    await waitFor(() => expect((screen.getByTestId("add-part-row") as HTMLButtonElement).disabled).toBe(false), { timeout: 15_000 });
    // The parts drawn at the click are the parts written: nothing changes when the write lands.
    expect(groups().map((group) => group.getAttribute("data-workstream-group"))).toEqual(partKeys());
  });

  it("a double click makes one part", async () => {
    await oneSession();
    const row = screen.getByTestId("add-part-row");
    act(() => {
      fireEvent.click(row);
      fireEvent.click(row);
    });
    fireEvent.click(screen.getByTestId("add-part-row"));
    await waitFor(() => expect((screen.getByTestId("add-part-row") as HTMLButtonElement).disabled).toBe(false), { timeout: 15_000 });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(partKeys()).toHaveLength(2);
    expect(groups()).toHaveLength(2);
  });
});

describe("SV-07 P3 · closed parts", () => {
  /** One session in Part 1, Part 2 empty and then closed. */
  async function closedPartTwo() {
    await oneSession();
    fireEvent.click(screen.getByTestId("add-part-row"));
    await waitFor(() => expect((screen.getByTestId("add-part-row") as HTMLButtonElement).disabled).toBe(false), { timeout: 15_000 });
    act(() => fireEvent.click(screen.getByRole("button", { name: "Collapse Part 2" })));
    // The fold shows at once, before its write lands.
    expect(screen.getByRole("button", { name: "Expand Part 2" })).toBeTruthy();
    await waitFor(() => expect(storedWorkstreamsOf(making())[1]?.collapsed).toBe(true), { timeout: 15_000 });
  }

  it("adding into a closed part opens it first, and the session arrives in it", async () => {
    await closedPartTwo();
    await addChatTo("Part 2", CHATS[1].name);
    expect(screen.getByRole("button", { name: "Collapse Part 2" })).toBeTruthy();
    expect(within(groups()[1]).getByTestId("arriving-session")).toBeTruthy();
    await settled(2);
    expect(within(groups()[1]).getAllByRole("group", { name: /^Session 2/ }).length).toBeGreaterThan(0);
    expect(storedWorkstreamsOf(making())[1]?.collapsed).toBeFalsy();
  });

  it("the part chosen last is marked in Your sessions' Add this session to", async () => {
    await closedPartTwo();
    await addChatTo("Part 2", CHATS[1].name);
    await settled(2);
    fireEvent.click(screen.getByRole("button", { name: /Show sources/ }));
    const add = (await screen.findAllByRole("button", { name: "Add session" })).find((button) => !(button as HTMLButtonElement).disabled) as HTMLElement;
    fireEvent.pointerDown(add, { button: 0, ctrlKey: false });
    fireEvent.keyDown(add, { key: "Enter" });
    const marked = await screen.findByRole("menuitem", { name: /Part 2.*chosen last/ });
    expect(marked.getAttribute("data-last")).toBe("true");
    expect(screen.getByRole("menuitem", { name: /^Part 1/ }).getAttribute("data-last")).toBeNull();
    fireEvent.keyDown(marked, { key: "Escape" });
  });

  it("a jump tab to a session in a closed part opens the part and brings the head to 24 below the header", async () => {
    await closedPartTwo();
    await addChatTo("Part 2", CHATS[1].name);
    await settled(2);
    act(() => fireEvent.click(screen.getByRole("button", { name: "Collapse Part 2" })));
    await waitFor(() => expect(storedWorkstreamsOf(making())[1]?.collapsed).toBe(true), { timeout: 15_000 });
    fireEvent.keyDown(screen.getByTestId("sandbox-view"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /Session list/ }));
    const scrolls: ScrollToOptions[] = [];
    vi.spyOn(window, "scrollTo").mockImplementation(((options: ScrollToOptions) => void scrolls.push(options)) as typeof window.scrollTo);
    // The head stands far down the page (jsdom has no layout, nor `elementFromPoint`).
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => null });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this.getAttribute("data-testid") === "session-head" ? 900 : 0;
      return { x: 0, y: top, top, left: 0, right: 400, bottom: top + 40, width: 400, height: 40, toJSON: () => ({}) } as DOMRect;
    });
    const chip = (await screen.findAllByRole("button", { name: /^2 / }))[0];
    act(() => fireEvent.click(chip));
    expect(screen.getByRole("button", { name: "Collapse Part 2" })).toBeTruthy();
    const head = within(groups()[1]).getByTestId("session-head");
    expect(document.activeElement === head || head.contains(document.activeElement)).toBe(true);
    expect(scrolls.at(-1)?.top).toBe(900 - 48 - 24);
  });
});

describe("SV-07 P3 · the scroll helper's offset", () => {
  it("puts the top `offset` below the top of the window, and leaves a head already there alone", () => {
    expect(scrollNeeded({ top: 900, bottom: 940, height: 40 }, "start", 800, 72)).toBe(828);
    expect(scrollNeeded({ top: 72, bottom: 112, height: 40 }, "start", 800, 72)).toBe(0);
    expect(scrollNeeded({ top: 900, bottom: 940, height: 40 }, "start", 800)).toBe(900);
  });
});

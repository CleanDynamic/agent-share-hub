// CA-14 P2, P3, P4 — a session's head, mounted on the List: the arrow, the title, the count, the ⋯ menu, no dotted circle.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { BuildList, type BuildListProps } from "./BuildList";
import { SESSION_HEAD_COPY, TITLE_COUNT_FROM, type SessionOps } from "./SessionHead";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ops = (): SessionOps => ({ onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onMergeUp: vi.fn() });

function list(over: Partial<BuildListProps> = {}) {
  const base = sandboxListProps("bakery");
  const props: BuildListProps = { ...base, onToggleCollapsed: vi.fn(), sessionOps: ops(), ...over };
  render(
    <MemoryRouter>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return props;
}

const head = (number: number) => screen.getAllByTestId("session-head")[number - 1];

describe("the collapse arrow", () => {
  it("is named for its session, says whether it is open, and points at the tiles", () => {
    list();
    const arrow = within(head(1)).getByRole("button", { name: "Collapse Session 1" });
    expect(arrow.getAttribute("aria-expanded")).toBe("true");
    const tiles = document.getElementById(arrow.getAttribute("aria-controls") as string);
    expect(tiles).toBeTruthy();
    expect(within(tiles as HTMLElement).getAllByTestId("step-card").length).toBeGreaterThan(0);
  });

  it("asks to fold, and a folded session draws its count before the date and nothing under its head", () => {
    const props = list();
    fireEvent.click(within(head(1)).getByRole("button", { name: "Collapse Session 1" }));
    expect(props.onToggleCollapsed).toHaveBeenCalledWith(expect.any(String), true);
    cleanup();
    const first = [...sandboxListProps("bakery").dividers.values()][0].key;
    list({ collapsed: new Set([first]) });
    const folded = within(head(1));
    expect(folded.getByRole("button", { name: "Expand Session 1" }).getAttribute("aria-expanded")).toBe("false");
    expect(folded.getByTestId("session-count").textContent).toBe("2 tiles");
    const run = document.querySelector(`[data-session-key="${first}"]`) as HTMLElement;
    expect(within(run).queryAllByTestId("step-card")).toHaveLength(0);
    // The other sessions are open and show no count.
    expect(within(head(2)).queryByTestId("session-count")).toBeNull();
  });
});

describe("the title", () => {
  it("is a field with a placeholder, saved on Enter and on blur, and put back by Esc", () => {
    const props = list();
    const field = within(head(1)).getByRole("textbox", { name: "Title of Session 1" }) as HTMLInputElement;
    expect(field.placeholder).toBe(SESSION_HEAD_COPY.titlePlaceholder);
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "  Planning  " } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.sessionOps?.onTitle).toHaveBeenCalledWith(expect.any(String), "Planning");

    const other = within(head(2)).getByRole("textbox", { name: "Title of Session 2" }) as HTMLInputElement;
    act(() => other.focus());
    fireEvent.change(other, { target: { value: "Router" } });
    act(() => other.blur());
    expect(props.sessionOps?.onTitle).toHaveBeenLastCalledWith(expect.any(String), "Router");

    const third = within(head(3)).getByRole("textbox", { name: "Title of Session 3" }) as HTMLInputElement;
    act(() => third.focus());
    fireEvent.change(third, { target: { value: "Not this" } });
    fireEvent.keyDown(third, { key: "Escape" });
    expect(third.value).toBe("");
    expect(props.sessionOps?.onTitle).toHaveBeenCalledTimes(2);
  });

  it("keeps to 80 characters and shows the count only while typing past 60", () => {
    list();
    const field = within(head(1)).getByRole("textbox", { name: "Title of Session 1" }) as HTMLInputElement;
    expect(field.maxLength).toBe(80);
    act(() => field.focus());
    fireEvent.change(field, { target: { value: "x".repeat(TITLE_COUNT_FROM) } });
    expect(within(head(1)).queryByText(/\/80$/)).toBeNull();
    fireEvent.change(field, { target: { value: "x".repeat(TITLE_COUNT_FROM + 2) } });
    expect(within(head(1)).getByText("62/80")).toBeTruthy();
    act(() => field.blur());
    expect(within(head(1)).queryByText(/\/80$/)).toBeNull();
  });

  it("is plain text for a reader, and nothing at all without a title", () => {
    const base = sandboxListProps("bakery");
    const [[number, first], ...rest] = [...base.dividers.entries()];
    list({ sessionOps: undefined, dividers: new Map([[number, { ...first, title: "Planning" }], ...rest]) });
    expect(screen.queryAllByRole("textbox", { name: /^Title of Session/ })).toHaveLength(0);
    expect(within(head(1)).getByTestId("session-title-text").textContent).toBe("Planning");
    expect(within(head(2)).queryByTestId("session-title-text")).toBeNull();
    expect(screen.queryByPlaceholderText(SESSION_HEAD_COPY.titlePlaceholder)).toBeNull();
  });
});

describe("the ⋯ menu and keys", () => {
  const open = async (n: number) => {
    fireEvent.keyDown(within(head(n)).getByRole("button", { name: `Session ${n} options` }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Move up" });
  };

  it("offers Move up and Move down (not past the ends), Colour…, and Remove session; no merge item when the page gives none", async () => {
    const props = list({ onColour: vi.fn(), sessionOps: { onTitle: vi.fn(), onMove: vi.fn(), onRemove: vi.fn() } });
    await open(1);
    expect(screen.getByRole("menuitem", { name: "Move up" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Move down" }).getAttribute("aria-disabled")).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Colour…" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Remove session" }).getAttribute("data-tone")).toBe("danger");
    expect(screen.queryByRole("menuitem", { name: SESSION_HEAD_COPY.mergeUp })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Move down" }));
    expect(props.sessionOps?.onMove).toHaveBeenCalledWith(expect.any(String), 1);
  });

  it("offers Merge with the session above on every session but the first", async () => {
    const props = list();
    await open(1);
    expect(screen.queryByRole("menuitem", { name: SESSION_HEAD_COPY.mergeUp })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    cleanup();
    const again = list();
    fireEvent.keyDown(within(head(2)).getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: SESSION_HEAD_COPY.mergeUp }));
    expect(again.sessionOps?.onMergeUp).toHaveBeenCalled();
    expect(props).toBeTruthy();
  });

  it("hands the removal over at once: the page asks about a session that has tiles (CA-20 P2)", async () => {
    const props = list();
    await open(1);
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove session" }));
    expect(props.sessionOps?.onRemove).toHaveBeenCalledWith(expect.any(String));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("moves the session with Alt and the arrow keys when its head has focus", () => {
    const props = list();
    const arrow = within(head(2)).getByRole("button", { name: "Collapse Session 2" });
    fireEvent.keyDown(arrow, { key: "ArrowUp", altKey: true });
    expect(props.sessionOps?.onMove).toHaveBeenCalledWith(expect.any(String), -1);
    // CA-21: the move shows at once, so the first session is looked for in a page of its own.
    cleanup();
    const again = list();
    fireEvent.keyDown(within(head(1)).getByRole("button", { name: "Collapse Session 1" }), { key: "ArrowUp", altKey: true });
    expect(again.sessionOps?.onMove).not.toHaveBeenCalled();
  });
});

describe("colour", () => {
  it("draws no dotted circle anywhere while nothing has a colour", () => {
    list({ onColour: vi.fn() });
    expect(document.querySelectorAll('[data-colour-dot="none"]')).toHaveLength(0);
    expect(screen.queryAllByTestId("colour-button")).toHaveLength(0);
  });
});

describe("the app", () => {
  it("is a text button that opens the app picker while a session has none", () => {
    const base = sandboxListProps("bakery");
    const [[number, first], ...rest] = [...base.dividers.entries()];
    list({ dividers: new Map([[number, { ...first, tool: "No harness chosen" }], ...rest]), onPickApp: vi.fn() });
    const pick = within(head(1)).getByRole("button", { name: "Pick a harness for session 1" });
    expect(pick.textContent).toBe("No harness chosen");
  });
});

describe("empty sessions and mixed tiles", () => {
  it("draws an empty session where its number puts it, with No tiles yet", () => {
    const base = sandboxListProps("bakery");
    const heads = [...base.dividers.values()];
    // The three sessions are numbered 2, 3 and 4; the empty one is Session 1, so it comes first.
    const renumbered = new Map([...base.dividers.entries()].map(([step, head]) => [step, { ...head, number: head.number + 1 }]));
    list({ dividers: renumbered, emptySessions: [{ key: "typed-empty", number: 1, tool: "No harness chosen", detail: "", prompts: [], date: "22 Oct" }] });
    const names = screen.getAllByTestId("session-head").map((el) => el.getAttribute("aria-label"));
    expect(names[0]).toBe("Session 1 · No harness chosen");
    expect(names).toHaveLength(heads.length + 1);
    const run = document.querySelector('[data-session-key="typed-empty"]') as HTMLElement;
    expect(within(run).getByText("No tiles yet")).toBeTruthy();
    expect(within(run).getByRole("button", { name: "Collapse Session 1" })).toBeTruthy();
  });

  it("keeps an agent that follows a session's head inside that session's tiles, and hides it when the session folds", () => {
    const base = sandboxListProps("bakery");
    const third = [...base.dividers.values()][2];
    list();
    const run = document.querySelector(`[data-session-key="${third.key}"]`) as HTMLElement;
    expect(within(run).getAllByTestId("step-card").length + within(run).getAllByRole("group").length).toBeGreaterThan(1);
    cleanup();
    list({ collapsed: new Set([third.key]) });
    const folded = document.querySelector(`[data-session-key="${third.key}"]`) as HTMLElement;
    expect(within(folded).queryAllByTestId("step-card")).toHaveLength(0);
    expect(within(folded).queryByRole("group", { name: /^Agent/ })).toBeNull();
  });
});

describe("moving by drag", () => {
  const handleOf = (n: number) => within(head(n)).getByTestId("session-drag-handle");

  it("CA-21 P4: folds nothing while one is held, says what was picked up, and says it was put back", async () => {
    const props = list({ onDropSession: vi.fn() });
    expect(screen.getAllByTestId("session-drag-handle")).toHaveLength(3);
    const cards = screen.getAllByTestId("step-card").length;
    expect(cards).toBeGreaterThan(0);
    act(() => handleOf(2).focus());
    fireEvent.keyDown(handleOf(2), { code: "Space", key: " " });
    await screen.findByText(/Picked up Session 2/);
    // Held: nothing folds and nothing changes size.
    expect(screen.getAllByTestId("step-card")).toHaveLength(cards);
    expect(screen.getAllByTestId("session-head").some((el) => el.getAttribute("data-collapsed") === "true")).toBe(false);
    fireEvent.keyDown(handleOf(2), { code: "Escape", key: "Escape" });
    await screen.findByText(/Put back in/);
    expect(screen.getAllByTestId("step-card")).toHaveLength(cards);
    expect(props.onDropSession).not.toHaveBeenCalled();
  });

  it("names the handle for its session, and draws no handle for a reader", () => {
    list({ onDropSession: vi.fn() });
    expect(handleOf(1).getAttribute("aria-label")).toBe("Move Session 1");
    cleanup();
    list({ sessionOps: undefined, onDropSession: vi.fn() });
    expect(screen.queryAllByTestId("session-drag-handle")).toHaveLength(0);
  });
});

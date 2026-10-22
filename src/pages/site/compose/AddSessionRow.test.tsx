// CA-14 P5 — "Add a session": two choices, then the list. Fixed 64-tall rows that show the first prompt, grouped by date, searchable.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddSessionRow, ADD_SESSION_COPY, PICK_ROW_HEIGHT, filterSessions, type AddSessionRowProps } from "./AddSessionRow";
import { draftNote, groupLibrary, openingWords, type SourceLibraryItem } from "./sourcesModel";

const NOW = new Date("2026-10-22T12:00:00Z").getTime();

const item = (over: Partial<SourceLibraryItem> & { id: string }): SourceLibraryItem => ({
  label: "Claude",
  line: "",
  adding: false,
  inThisDraft: false,
  alsoIn: null,
  firstPrompt: "Plan the launch email",
  date: "22 Oct",
  promptCount: 3,
  app: "Claude",
  appKnown: true,
  model: null,
  createdAt: "2026-10-22T09:00:00Z",
  draftCount: 0,
  ...over,
});

const LIBRARY: SourceLibraryItem[] = [
  item({ id: "today", createdAt: "2026-10-22T09:00:00Z" }),
  item({ id: "week", createdAt: "2026-10-18T09:00:00Z", date: "18 Oct", app: "Claude Code", firstPrompt: "A very long first prompt that goes on and on and on past sixty characters so it is cut with an ellipsis" }),
  item({ id: "old", createdAt: "2026-09-25T09:00:00Z", date: "25 Sep", app: "Unknown app", appKnown: false, model: "Haiku 4.5", firstPrompt: "Old one", inThisDraft: true, draftCount: 1 }),
  item({ id: "also", createdAt: "2026-09-25T08:00:00Z", date: "25 Sep", firstPrompt: "Also elsewhere", inThisDraft: true, draftCount: 2 }),
];

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(over: Partial<AddSessionRowProps> = {}) {
  const props: AddSessionRowProps = { phone: false, library: LIBRARY, adding: false, onAdd: vi.fn(), onStartNew: vi.fn(), now: NOW, ...over };
  render(<AddSessionRow {...props} />);
  return props;
}

const openList = () => {
  fireEvent.click(screen.getByTestId("add-session-row"));
  fireEvent.click(screen.getByRole("button", { name: /Add from your connected chats/ }));
  return screen.getByTestId("add-session-picker");
};

describe("the row", () => {
  it("is a text button with a plus, no dashed outline, 36 tall", () => {
    mount();
    const row = screen.getByTestId("add-session-row");
    expect(row.textContent).toBe("Add a session");
    expect(row.querySelector("svg")).toBeTruthy();
    const style = row.getAttribute("style") ?? "";
    expect(style).toMatch(/height:\s*36px/);
    expect(style).not.toMatch(/dashed/);
  });

  it("says Adding… while a session is being added", () => {
    mount({ adding: true });
    expect(screen.getByTestId("add-session-row").textContent).toBe("Adding…");
    expect((screen.getByTestId("add-session-row") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("the two choices", () => {
  it("start a new session at once, with no app asked", () => {
    const props = mount();
    fireEvent.click(screen.getByTestId("add-session-row"));
    fireEvent.click(screen.getByRole("button", { name: /Start a new session/ }));
    expect(props.onStartNew).toHaveBeenCalledWith();
    expect(screen.queryByTestId("add-session-choices")).toBeNull();
  });

  it("open the list of connected chats, with a way back", () => {
    mount();
    const list = within(openList());
    expect(list.getAllByRole("listitem")).toHaveLength(4);
    fireEvent.click(list.getByRole("button", { name: ADD_SESSION_COPY.back }));
    expect(screen.getByTestId("add-session-choices")).toBeTruthy();
  });
});

describe("the list", () => {
  it("gives every row the same fixed height and shows the app, the first prompt's opening words and the count", () => {
    mount();
    const rows = within(openList()).getAllByTestId("library-row");
    for (const row of rows) expect(row.getAttribute("style")).toMatch(new RegExp(`height:\\s*${PICK_ROW_HEIGHT}px`));
    expect(PICK_ROW_HEIGHT).toBe(64);
    expect(rows[0].getAttribute("aria-label")).toBe("Claude, Plan the launch email, 22 Oct · 3 prompts");
    // Cut at 60 characters with an ellipsis.
    const second = rows[1].getAttribute("aria-label") ?? "";
    const opening = /^Claude Code, (.+), 18 Oct/.exec(second)?.[1] ?? "";
    expect(opening).toHaveLength(60);
    expect(opening.endsWith("…")).toBe(true);
    expect(second).not.toContain("an ellipsis");
  });

  it("groups by Today, This week and Earlier", () => {
    mount();
    const list = within(openList());
    expect(list.getAllByRole("group").map((group) => group.getAttribute("aria-label"))).toEqual(["Today", "This week", "Earlier"]);
    expect(within(list.getByRole("group", { name: "Earlier" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("names an unknown app so, with its model under it and a neutral glyph", () => {
    mount();
    const row = within(openList()).getByRole("listitem", { name: /^Unknown app/ });
    expect(row.getAttribute("aria-label")).toContain("Haiku 4.5 · 25 Sep · 3 prompts");
    expect(row.querySelector("[data-mark]")).toBeNull();
  });

  it("says where each is: this draft, or how many drafts", () => {
    mount();
    const list = within(openList());
    expect(list.getByRole("listitem", { name: /Old one/ }).textContent).toContain("In this draft");
    expect(list.getByRole("listitem", { name: /Also elsewhere/ }).textContent).toContain("In 2 drafts");
    expect((list.getByRole("listitem", { name: /Old one/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("searches the app, the date and the first prompt", () => {
    mount();
    const list = within(openList());
    const search = list.getByRole("searchbox", { name: ADD_SESSION_COPY.search });
    fireEvent.change(search, { target: { value: "launch" } });
    expect(list.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(search, { target: { value: "claude code" } });
    expect(list.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(search, { target: { value: "25 sep" } });
    expect(list.getAllByRole("listitem")).toHaveLength(2);
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(list.getByText(ADD_SESSION_COPY.none)).toBeTruthy();
  });

  it("adds the row picked and closes", () => {
    const props = mount();
    fireEvent.click(within(openList()).getByRole("listitem", { name: /Plan the launch email/ }));
    expect(props.onAdd).toHaveBeenCalledWith("today");
  });

  it("takes the sheet's height on a phone and scrolls inside it", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    mount({ phone: true });
    fireEvent.click(screen.getByTestId("add-session-row"));
    fireEvent.click(screen.getByRole("button", { name: /Add from your connected chats/ }));
    const picker = screen.getByTestId("add-session-picker");
    expect(picker.getAttribute("style")).toMatch(/height:\s*calc\(100dvh/);
    expect(within(picker).getByRole("list").getAttribute("style")).toMatch(/overflow-y:\s*auto/);
  });
});

describe("the model", () => {
  it("groups by day, with an item an hour into today still today", () => {
    expect(groupLibrary(LIBRARY, NOW).map((group) => [group.label, group.items.length])).toEqual([["Today", 1], ["This week", 1], ["Earlier", 2]]);
    expect(groupLibrary([], NOW)).toEqual([]);
  });
  it("cuts the opening words at 60 characters and reads nothing as empty", () => {
    expect(openingWords("a".repeat(70))).toHaveLength(60);
    expect(openingWords("a".repeat(70)).endsWith("…")).toBe(true);
    expect(openingWords("  two   words \n here ")).toBe("two words here");
    expect(openingWords(null)).toBe("");
  });
  it("says where a session is", () => {
    expect(draftNote({ inThisDraft: true, draftCount: 1 })).toBe("In this draft");
    expect(draftNote({ inThisDraft: false, draftCount: 1 })).toBe("In 1 draft");
    expect(draftNote({ inThisDraft: true, draftCount: 3 })).toBe("In 3 drafts");
    expect(draftNote({ inThisDraft: false, draftCount: 0 })).toBeNull();
  });
  it("filters by every word", () => {
    expect(filterSessions(LIBRARY, "claude zzz")).toHaveLength(0);
    expect(filterSessions(LIBRARY, "")).toHaveLength(4);
  });
});

// SV-08 P1: what Drafts does, said through roles and names so it holds for any layout. Every test here runs against the
// board's view; none reads a class.

import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { draftsFixture, draftsViewProps, sessionsFixture } from "@/dev/fixtures/drafts";

import { DraftsView, type DraftsViewProps } from "./DraftsView";
import { connectedTools, sessionMeta } from "./draftsModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("pointer: fine"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

function view(props: Partial<DraftsViewProps> = {}) {
  const base = { ...draftsViewProps(), onAddToNew: vi.fn(), onAddToDraft: vi.fn(), onConnect: vi.fn(), ...props };
  render(
    <MemoryRouter>
      <DraftsView {...base} />
    </MemoryRouter>,
  );
  return base;
}

function dropOn(target: Element, id: string) {
  const event = createEvent.drop(target);
  Object.defineProperty(event, "dataTransfer", { value: { types: ["text/plain"], getData: () => id } });
  fireEvent(target, event);
}

const many = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `m${i}`, title: `Draft ${i}`, sessionCount: i % 3, updatedAt: "2026-10-06T09:00:00.000Z" }));

describe("Drafts behaviour", () => {
  it("opens a draft from its row", () => {
    view();
    const row = screen.getByRole("link", { name: /Photo renamer by date taken/ });
    expect(row.getAttribute("href")).toBe("/compose/d1");
  });

  it("starts a new build from the page-width slot", () => {
    view();
    const slot = screen.getByTestId("start-row");
    expect(slot.getAttribute("href")).toBe("/compose/new");
    expect(slot.textContent).toContain("Drop a session here to start a build");
    // The head's "New build" goes to the same place.
    expect(screen.getByRole("link", { name: "New build" }).getAttribute("href")).toBe("/compose/new");
  });

  it("starts a build from a session dropped on that slot", () => {
    const p = view();
    dropOn(screen.getByTestId("start-row"), "s2");
    expect(p.onAddToNew).toHaveBeenCalledWith("s2");
  });

  it("adds a session dropped on a draft to that draft", () => {
    const p = view();
    dropOn(screen.getByRole("link", { name: /Inbox triage v2/ }), "s3");
    expect(p.onAddToDraft).toHaveBeenCalledWith("s3", expect.objectContaining({ id: "d3" }));
  });

  it("each session has a + named 'Add to a new build' whose menu starts a build or adds to a draft", async () => {
    const p = view();
    const plus = screen.getAllByRole("button", { name: "Add to a new build" });
    expect(plus).toHaveLength(sessionsFixture.length);
    fireEvent.pointerDown(plus[0], { button: 0, ctrlKey: false });
    fireEvent.keyDown(plus[0], { key: "Enter" });
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Start a new build" }));
    expect(p.onAddToNew).toHaveBeenCalledWith("s1");
  });

  it("the + menu adds a session to a chosen draft", async () => {
    const p = view();
    const plus = screen.getAllByRole("button", { name: "Add to a new build" })[1];
    fireEvent.pointerDown(plus, { button: 0, ctrlKey: false });
    fireEvent.keyDown(plus, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add to Inbox triage v2" }));
    expect(p.onAddToDraft).toHaveBeenCalledWith("s2", expect.objectContaining({ id: "d3" }));
  });

  it("session rows are draggable and carry the session id as text", () => {
    view();
    const row = screen.getAllByTestId("session-row")[0];
    expect(row.getAttribute("draggable")).toBe("true");
    const setData = vi.fn();
    const event = createEvent.dragStart(row);
    Object.defineProperty(event, "dataTransfer", { value: { setData, effectAllowed: "" } });
    fireEvent(row, event);
    expect(setData).toHaveBeenCalledWith("text/plain", "s1");
  });

  it("shows 12 drafts, then the rest at once with 'Show n more'", () => {
    view({ drafts: many(28) });
    expect(screen.getAllByTestId("draft-row")).toHaveLength(12);
    fireEvent.click(screen.getByRole("button", { name: "Show 16 more" }));
    expect(screen.getAllByTestId("draft-row")).toHaveLength(28);
    expect(screen.queryByRole("button", { name: /^Show \d+ more$/ })).toBeNull();
  });

  it("shows no 'Show more' for 12 drafts or fewer", () => {
    view({ drafts: many(12) });
    expect(screen.queryByRole("button", { name: /^Show \d+ more$/ })).toBeNull();
  });

  it("asks for the next page of sessions", () => {
    const onMore = vi.fn();
    view({ moreSessions: { loading: false, onMore } });
    fireEvent.click(screen.getByRole("button", { name: "Show more sessions" }));
    expect(onMore).toHaveBeenCalled();
  });

  it("removes empty drafts only after the confirm window, after the last draft row", () => {
    const onRemove = vi.fn();
    view({ emptyDrafts: { count: 2, onRemove } });
    const button = screen.getByRole("button", { name: "Remove empty drafts (2)" });
    const last = screen.getAllByTestId("draft-row").at(-1) as Element;
    expect(last.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button);
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("'Connect a tool' in the connections section opens the connector dialog", () => {
    const p = view();
    fireEvent.click(screen.getByRole("button", { name: "Connect a tool" }));
    expect(p.onConnect).toHaveBeenCalledTimes(1);
  });

  it("shows 8 sessions, then the rest at once with 'Show all'", () => {
    const sessions = Array.from({ length: 11 }, (_, i) => ({ ...sessionsFixture[0], id: `x${i}` }));
    view({ sessions });
    expect(screen.getAllByTestId("session-row")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getAllByTestId("session-row")).toHaveLength(11);
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
  });
});

describe("Drafts, the board's words", () => {
  const now = Date.parse("2026-10-06T10:00:00.000Z");

  it("heads the lists with their facts: the count is the heading", () => {
    view({ drafts: many(28) });
    expect(screen.getByRole("heading", { level: 1, name: "28 drafts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: `${sessionsFixture.length} sessions` })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /connection/ })).toBeInTheDocument();
  });

  it("names a session by its first prompt and details it '<date> · In n drafts', with no tool or model", () => {
    const s = { ...sessionsFixture[4], client: "claude-code", draftIds: ["d1", "d2", "d3"] };
    expect(sessionMeta(s, draftsFixture, now)).toBe("30 Sep · In 3 drafts");
    expect(sessionMeta({ ...s, draftIds: ["d1"] }, draftsFixture, now)).toBe("30 Sep · In 1 draft");
  });

  it("starts the detail line with the date where the tool is unknown", () => {
    const s = { ...sessionsFixture[0], client: null, modelName: null };
    expect(sessionMeta(s, draftsFixture, now)).toBe("2 Oct");
  });

  it("lists each connected tool once with the date of its last import", () => {
    const sessions = [
      { client: "claude", createdAt: "2026-10-02T09:00:00.000Z" },
      { client: "claude-code", createdAt: "2026-10-04T09:00:00.000Z" },
      { client: "claude", createdAt: "2026-09-20T09:00:00.000Z" },
      { client: "web", createdAt: "2026-10-05T09:00:00.000Z" },
      { client: null, createdAt: "2026-10-05T09:00:00.000Z" },
    ];
    expect(connectedTools(sessions, now).map((x) => [x.name, x.lastImport])).toEqual([
      ["Claude Code", "4 Oct"],
      ["Claude", "2 Oct"],
    ]);
    view({ sessions: sessions.map((x, i) => ({ ...sessionsFixture[0], id: `c${i}`, ...x })) });
    expect(screen.getByText("Last import 4 Oct")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "2 connections" })).toBeInTheDocument();
  });

  it("says there are no connections, and offers one, when no session names a tool", () => {
    view({ sessions: [] });
    expect(screen.getByRole("heading", { level: 2, name: "No connections" })).toBeInTheDocument();
    expect(screen.queryByText(/^Last import/)).toBeNull();
  });
});

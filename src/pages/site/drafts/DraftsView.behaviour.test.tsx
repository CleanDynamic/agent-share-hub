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
  const base = { ...draftsViewProps(), onRetryDrafts: vi.fn(), onRetrySessions: vi.fn(), onAddToNew: vi.fn(), onAddToDraft: vi.fn(), onConnect: vi.fn(), ...props };
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
    const slot = screen.getByRole("link", { name: /Start a new build/ });
    expect(slot.getAttribute("href")).toBe("/compose/new");
    expect(slot.textContent).toContain("or drop a session here");
  });

  it("starts a build from a session dropped on that slot", () => {
    const p = view();
    dropOn(screen.getByRole("link", { name: /Start a new build/ }), "s2");
    expect(p.onAddToNew).toHaveBeenCalledWith("s2");
  });

  it("adds a session dropped on a draft to that draft", () => {
    const p = view();
    dropOn(screen.getByRole("link", { name: /Inbox triage v2/ }), "s3");
    expect(p.onAddToDraft).toHaveBeenCalledWith("s3", expect.objectContaining({ id: "d3" }));
  });

  it("each session has a + named 'Start a build from this session' whose menu starts a build or adds to a draft", async () => {
    const p = view();
    const plus = screen.getAllByRole("button", { name: "Start a build from this session" });
    expect(plus).toHaveLength(sessionsFixture.length);
    fireEvent.pointerDown(plus[0], { button: 0, ctrlKey: false });
    fireEvent.keyDown(plus[0], { key: "Enter" });
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Start a new build" }));
    expect(p.onAddToNew).toHaveBeenCalledWith("s1");
  });

  it("the + menu adds a session to a chosen draft", async () => {
    const p = view();
    const plus = screen.getAllByRole("button", { name: "Start a build from this session" })[1];
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

  it("'Connect a tool', 'How they get here' and 'Manage' all open the connector dialog", () => {
    const p = view();
    fireEvent.click(screen.getByRole("button", { name: "Connect a tool" }));
    fireEvent.click(screen.getByRole("button", { name: "How they get here" }));
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    expect(p.onConnect).toHaveBeenCalledTimes(3);
  });
});

describe("Drafts, the board's words", () => {
  const now = Date.parse("2026-10-06T10:00:00.000Z");

  it("heads the lists with their counts", () => {
    view({ drafts: many(28) });
    expect(screen.getByText("28 drafts · latest first")).toBeInTheDocument();
    expect(screen.getByText(`${sessionsFixture.length} imported · drag one into a draft`)).toBeInTheDocument();
  });

  it("names a session by its first prompt and details it '<tool> · <model> · <date> · in n drafts'", () => {
    const s = { ...sessionsFixture[4], client: "claude-code", draftIds: ["d1", "d2", "d3"] };
    expect(sessionMeta(s, draftsFixture, now)).toBe("Claude Code · Opus 5.5 · 30 Sep · in 3 drafts");
    expect(sessionMeta({ ...s, draftIds: ["d1"] }, draftsFixture, now)).toBe("Claude Code · Opus 5.5 · 30 Sep · in 1 draft");
  });

  it("starts the detail line 'No harness chosen' where the tool is unknown", () => {
    const s = { ...sessionsFixture[0], client: null, modelName: null };
    expect(sessionMeta(s, draftsFixture, now)).toBe("No harness chosen · 2 Oct");
    expect(sessionMeta({ ...s, modelName: "Opus 5.5" }, draftsFixture, now)).toBe("No harness chosen · Opus 5.5 · 2 Oct");
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
    expect(screen.getByText("last import 4 Oct")).toBeInTheDocument();
  });

  it("leaves the tile out when no session names a tool", () => {
    view({ sessions: [] });
    expect(screen.queryByText("Connected tools")).toBeNull();
  });
});

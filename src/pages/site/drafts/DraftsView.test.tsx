import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { draftsFixture, draftsViewProps, sessionsFixture } from "@/dev/fixtures/drafts";

import { DraftsView, type DraftsViewProps } from "./DraftsView";
import { draftMeta, menuItems, sessionDate, sessionMeta, sessionSource } from "./draftsModel";

let fine = true;
let narrow = false;

beforeEach(() => {
  fine = true;
  narrow = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("pointer: fine") ? fine : query.includes("max-width") ? narrow : false,
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

/** The view as markup: jsdom drops var() colours from live styles, markup keeps them (as the brand tests read them). */
function html(props: Partial<DraftsViewProps> = {}) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <DraftsView {...draftsViewProps()} {...props} />
    </MemoryRouter>,
  );
}

/** A drag event that carries the session id as text, the way a session row sends it. */
function dragWith(target: Element, type: "dragOver" | "drop", id = "s1") {
  const event = createEvent[type](target);
  Object.defineProperty(event, "dataTransfer", {
    value: { types: ["text/plain"], getData: () => id, dropEffect: "none", setData: vi.fn(), effectAllowed: "" },
  });
  fireEvent(target, event);
}

describe("DraftsView", () => {
  it("draws both lists: the drafts, last edited first, and the waiting sessions", () => {
    view();
    expect(screen.getAllByTestId("draft-row")).toHaveLength(4);
    expect(screen.getAllByTestId("session-row")).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "Continue editing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Older post drafts/ }).getAttribute("href")).toBe("/drafts/posts");
  });

  it("shows 'Untitled build' in --text2, and a real title in --text", () => {
    view();
    const titles = screen.getAllByTestId("draft-title");
    expect(titles[0].textContent).toBe("Photo renamer by date taken");
    expect(titles[1].textContent).toBe("Untitled build");
    const markup = html();
    expect(markup).toContain('data-testid="draft-title" style="display:block;font-weight:500');
    expect(markup).toMatch(/font-weight:500;color:var\(--text\);white-space:nowrap[^>]*>Photo renamer by date taken/);
    expect(markup).toMatch(/font-weight:500;color:var\(--text2\);white-space:nowrap[^>]*>Untitled build/);
  });

  it("an empty title reads as Untitled build too", () => {
    view({ drafts: [{ id: "x", title: "  ", sessionCount: 0, updatedAt: draftsFixture[0].updatedAt }] });
    expect(screen.getByTestId("draft-title").textContent).toBe("Untitled build");
    expect(html({ drafts: [{ id: "x", title: "  ", sessionCount: 0, updatedAt: draftsFixture[0].updatedAt }] })).toMatch(
      /color:var\(--text2\);white-space:nowrap[^>]*>Untitled build/,
    );
  });

  it("the start row is a drop target: --evidence border, --row-highlight, new words, then a new build", () => {
    const p = view();
    const row = screen.getByTestId("start-row");
    expect(row.getAttribute("href")).toBe("/compose/new");
    expect(row.textContent).toContain("or drop a session here");
    dragWith(row, "dragOver");
    expect(row.getAttribute("data-over")).toBe("true");
    expect(row.textContent).toContain("Drop to start a build from it");
    dragWith(row, "drop", "s2");
    expect(p.onAddToNew).toHaveBeenCalledWith("s2");
    expect(row.textContent).toContain("or drop a session here");
  });

  it("a draft row is a drop target that says so, and adds the session to that draft", () => {
    const p = view();
    const row = screen.getAllByTestId("draft-row")[0];
    expect(row.textContent).toContain("2 sessions");
    expect(row.textContent).toContain("edited 17m ago");
    dragWith(row, "dragOver");
    expect(row.getAttribute("data-over")).toBe("true");
    expect(row.textContent).toContain("Drop to add this session");
    dragWith(row, "drop", "s3");
    expect(p.onAddToDraft).toHaveBeenCalledWith("s3", expect.objectContaining({ id: "d1" }));
  });

  it("ignores a drag that carries no text", () => {
    view();
    const row = screen.getAllByTestId("draft-row")[0];
    const event = createEvent.dragOver(row);
    Object.defineProperty(event, "dataTransfer", { value: { types: ["Files"] } });
    fireEvent(row, event);
    expect(row.getAttribute("data-over")).toBeNull();
  });

  it("sessions are draggable only on a fine pointer", () => {
    view();
    expect(screen.getAllByTestId("session-row")[0].getAttribute("draggable")).toBe("true");
  });

  it("sessions are not draggable on touch", () => {
    fine = false;
    view();
    expect(screen.getAllByTestId("session-row")[0].getAttribute("draggable")).toBeNull();
  });

  it("the + menu offers a new build and up to eight drafts, and never removes a session", async () => {
    const p = view();
    const add = screen.getAllByRole("button", { name: "Start a build from this session" })[0];
    fireEvent.pointerDown(add, { button: 0, ctrlKey: false });
    fireEvent.keyDown(add, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Start a new build",
      "Add to Photo renamer by date taken",
      "Add to Untitled build",
      "Add to Inbox triage v2",
      "Add to First MCP test",
    ]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Add to Photo renamer by date taken" }));
    expect(p.onAddToDraft).toHaveBeenCalledWith("s1", expect.objectContaining({ id: "d1" }));
  });

  it("on a phone the + opens the 'Add to a build' sheet and rows have no grip", async () => {
    narrow = true;
    view();
    expect(screen.getAllByTestId("session-row")[0].getAttribute("draggable")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Start a build from this session" })[0]);
    const sheet = await screen.findByRole("dialog", { name: "Add to a build" });
    expect(within(sheet).getAllByRole("button").map((b) => b.textContent)).toEqual(
      expect.arrayContaining(["Start a new build", "Add to Photo renamer by date taken"]),
    );
  });

  it("CA-12: a session already in a draft is listed with the others, says so, and offers Open for that draft and Add to for the rest", async () => {
    view();
    const row = screen.getAllByTestId("session-row").find((li) => li.textContent?.includes("Rename every photo"));
    expect(row?.textContent).toContain("in 1 draft");
    expect(screen.queryByRole("button", { name: /already in a build/ })).toBeNull();
    fireEvent.keyDown(within(row as HTMLElement).getByRole("button", { name: "Start a build from this session" }), { key: "Enter" });
    const open = await screen.findByRole("menuitem", { name: "Open Photo renamer by date taken" });
    expect(open.getAttribute("href")).toBe("/compose/d1");
    expect(screen.queryByRole("menuitem", { name: "Add to Photo renamer by date taken" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Add to Untitled build" })).toBeInTheDocument();
  });

  it("CA-12: asks for the next page of sessions", () => {
    const onMore = vi.fn();
    view({ moreSessions: { loading: false, onMore } });
    fireEvent.click(screen.getByRole("button", { name: "Show more sessions" }));
    expect(onMore).toHaveBeenCalled();
  });

  it("empty: one line and one action each, and 'Nothing in progress.'", () => {
    const p = view({ drafts: [], sessions: [] });
    expect(screen.getByText("No new sessions.")).toBeInTheDocument();
    expect(screen.getByText("Nothing in progress.")).toBeInTheDocument();
    expect(screen.getByTestId("start-row")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Connect a tool" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(p.onConnect).toHaveBeenCalled();
  });

  it("an error says one sentence in each list and retries that list", () => {
    const p = view({ draftsStatus: "error", sessionsStatus: "error" });
    expect(screen.getAllByText("That didn't load.")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]);
    expect(p.onRetryDrafts).toHaveBeenCalled();
    expect(p.onRetrySessions).not.toHaveBeenCalled();
  });

  it("CA-10: a sessions failure stays in the Sessions panel, and the drafts show", () => {
    view({ sessionsStatus: "error", sessionsError: { code: "57014", message: "canceling statement" } });
    expect(screen.getAllByText("That didn't load.")).toHaveLength(1);
    expect(screen.getByRole("status", { name: "Sessions" })).toBeInTheDocument();
    expect(screen.getByText("Code 57014")).toBeInTheDocument();
    expect(screen.getAllByTestId("draft-row").length).toBeGreaterThan(0);
  });

  it("loading draws skeleton rows, not content", () => {
    view({ draftsStatus: "loading", sessionsStatus: "loading" });
    expect(screen.queryByTestId("draft-row")).toBeNull();
    expect(screen.getAllByText(/^Loading/).length).toBeGreaterThan(0);
  });
});

describe("draftsModel", () => {
  const now = Date.parse("2026-10-06T10:00:00.000Z");

  it("meta: sessions and edited time", () => {
    expect(draftMeta({ sessionCount: 0, updatedAt: "2026-10-06T09:59:50.000Z" }, now)).toBe("No sessions · edited just now");
    expect(draftMeta({ sessionCount: 1, updatedAt: "2026-10-03T10:00:00.000Z" }, now)).toBe("1 session · edited 3d ago");
  });

  it("the date is Today, Yesterday or 3 Oct", () => {
    expect(sessionDate("2026-10-06T01:00:00.000Z", now)).toBe("Today");
    expect(sessionDate("2026-10-05T23:00:00.000Z", now)).toBe("Yesterday");
    expect(sessionDate("2026-10-02T09:00:00.000Z", now)).toBe("2 Oct");
  });

  it("the client label stands in for a missing model", () => {
    expect(sessionSource({ modelName: null, client: "claude-code" })).toBe("Claude Code");
    expect(sessionSource({ modelName: null, client: "web" })).toBe("Pasted");
    expect(sessionSource({ modelName: null, client: "chatgpt" })).toBe("ChatGPT");
    expect(sessionSource({ modelName: null, client: null })).toBe("No app chosen");
    expect(sessionSource({ modelName: "Opus 5.5", client: "claude" })).toBe("Opus 5.5");
  });

  it("a session aimed at a draft ends its meta with it and leads its menu with it", () => {
    const aimed = { ...sessionsFixture[0], targetBuildId: "d3" };
    expect(sessionMeta(aimed, draftsFixture, now)).toBe("Claude · GPT-6 Astra · 2 Oct · for Inbox triage v2");
    expect(menuItems(aimed, draftsFixture)[0]).toMatchObject({ kind: "target", label: "Add to Inbox triage v2" });
  });

  it("the menu names at most eight drafts", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, title: `T${i}`, sessionCount: 0, updatedAt: "2026-10-06T09:00:00.000Z" }));
    expect(menuItems(sessionsFixture[0], many).filter((i) => i.kind === "draft")).toHaveLength(8);
  });
});

describe("DraftsView · Remove empty drafts (SV-03 P2)", () => {
  it("shows nothing about it when no draft is empty", () => {
    view({ emptyDrafts: { count: 0, onRemove: vi.fn() } });
    expect(screen.queryByRole("button", { name: /Remove empty drafts/ })).toBeNull();
  });

  it("says how many at the foot of the page, and removes nothing until the confirm window is answered", () => {
    const onRemove = vi.fn();
    view({ emptyDrafts: { count: 3, onRemove } });
    fireEvent.click(screen.getByRole("button", { name: "Remove empty drafts (3)" }));

    const window = screen.getByRole("alertdialog");
    expect(within(window).getByText("Remove 3 empty drafts?")).toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.click(within(window).getByRole("button", { name: "Cancel" }));
    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("removes them when the window is confirmed", () => {
    const onRemove = vi.fn();
    view({ emptyDrafts: { count: 1, onRemove } });
    fireEvent.click(screen.getByRole("button", { name: "Remove empty drafts (1)" }));
    const window = screen.getByRole("alertdialog");
    expect(within(window).getByText("Remove 1 empty draft?")).toBeInTheDocument();
    fireEvent.click(within(window).getByRole("button", { name: "Remove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

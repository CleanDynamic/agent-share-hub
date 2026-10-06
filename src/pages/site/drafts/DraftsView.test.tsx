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
  const base = { ...draftsViewProps(), onRetry: vi.fn(), onToggleAttached: vi.fn(), onAddToNew: vi.fn(), onAddToDraft: vi.fn(), onRemove: vi.fn(), onConnect: vi.fn(), ...props };
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
    expect(screen.getAllByTestId("session-row")).toHaveLength(4);
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
    expect(markup).toContain('data-testid="draft-title" style="font-family:');
    expect(markup).toMatch(/font-weight:600;color:var\(--text\);white-space:nowrap[^>]*>Photo renamer by date taken/);
    expect(markup).toMatch(/font-weight:600;color:var\(--text2\);white-space:nowrap[^>]*>Untitled build/);
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
    expect(row.textContent).toContain("2 sessions · edited 17m ago");
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

  it("the + menu offers a new build, up to eight drafts, and Remove after a separator", async () => {
    const p = view();
    const add = screen.getAllByRole("button", { name: /^Add “Every morning at 7/ })[0];
    fireEvent.pointerDown(add, { button: 0, ctrlKey: false });
    fireEvent.keyDown(add, { key: "Enter" });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Start a new build",
      "Add to Photo renamer by date taken",
      "Add to Untitled build",
      "Add to Inbox triage v2",
      "Add to First MCP test",
      "Remove session",
    ]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Add to Photo renamer by date taken" }));
    expect(p.onAddToDraft).toHaveBeenCalledWith("s1", expect.objectContaining({ id: "d1" }));
  });

  it("Remove asks first, in an alert dialog", async () => {
    const p = view();
    const add = screen.getAllByRole("button", { name: /^Add “Every morning at 7/ })[0];
    fireEvent.keyDown(add, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove session" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove this session?")).toBeInTheDocument();
    expect(within(dialog).getByText("It disappears from Drafts. This can't be undone.")).toBeInTheDocument();
    expect(p.onRemove).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(p.onRemove).toHaveBeenCalledWith("s1");
  });

  it("on a phone the + opens the 'Add to a build' sheet and rows have no grip", async () => {
    narrow = true;
    view();
    expect(screen.getAllByTestId("session-row")[0].getAttribute("draggable")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /^Add “Every morning at 7/ })[0]);
    const sheet = await screen.findByRole("dialog", { name: "Add to a build" });
    expect(within(sheet).getAllByRole("button").map((b) => b.textContent)).toEqual(
      expect.arrayContaining(["Start a new build", "Add to Photo renamer by date taken", "Remove session"]),
    );
  });

  it("sessions already in a build hide behind a toggle, are not draggable, and say where they are", () => {
    const p = view();
    expect(screen.queryByTestId("session-row-attached")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show 1 already in a build" }));
    expect(p.onToggleAttached).toHaveBeenCalled();
  });

  it("shown, they read 'In {draft}', and their menu is one 'Open' link", async () => {
    view({ showAttached: true });
    const row = screen.getByTestId("session-row-attached");
    expect(row.textContent).toContain("In Photo renamer by date taken");
    expect(row.getAttribute("draggable")).toBeNull();
    expect(screen.getByRole("button", { name: "Hide sessions already in a build" })).toBeInTheDocument();
    fireEvent.keyDown(within(row).getByRole("button", { name: /Photo renamer by date taken/ }), { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: "Open Photo renamer by date taken" });
    expect(item.getAttribute("href")).toBe("/compose/d1");
  });

  it("empty: one line and one action each, and 'Nothing in progress.'", () => {
    const p = view({ drafts: [], sessions: [], attached: [] });
    expect(screen.getByText("No new sessions.")).toBeInTheDocument();
    expect(screen.getByText("Nothing in progress.")).toBeInTheDocument();
    expect(screen.getByTestId("start-row")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Connect a tool" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(p.onConnect).toHaveBeenCalled();
  });

  it("an error says one sentence in each list and retries", () => {
    const p = view({ status: "error" });
    expect(screen.getAllByText("That didn't load.")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]);
    expect(p.onRetry).toHaveBeenCalled();
  });

  it("loading draws skeleton rows, not content", () => {
    view({ status: "loading" });
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
    expect(sessionSource({ modelName: null, client: null })).toBe("Unknown tool");
    expect(sessionSource({ modelName: "Opus 5.5", client: "claude" })).toBe("Opus 5.5");
  });

  it("a session aimed at a draft ends its meta with it and leads its menu with it", () => {
    const aimed = { ...sessionsFixture[0], targetBuildId: "d3" };
    expect(sessionMeta(aimed, draftsFixture, now)).toBe("GPT-6 Astra · 2 Oct · for Inbox triage v2");
    expect(menuItems(aimed, draftsFixture)[0]).toMatchObject({ kind: "target", label: "Add to Inbox triage v2" });
  });

  it("the menu names at most eight drafts", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, title: `T${i}`, sessionCount: 0, updatedAt: "2026-10-06T09:00:00.000Z" }));
    expect(menuItems(sessionsFixture[0], many).filter((i) => i.kind === "draft")).toHaveLength(8);
  });
});

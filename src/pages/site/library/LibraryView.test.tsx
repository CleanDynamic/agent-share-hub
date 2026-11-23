// SV-09 P2: the Library view, from the board's sample data. Every section is drawn from its own prop; the selected item
// adapts to what it is (a step's two versions, a build's Open).

import { readOf } from "@/components/pagestate/pageStateModel";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { visionLibraryProps } from "@/dev/fixtures/vision/library";

import { LibraryView, type LibraryViewProps, type SelectedBuild } from "./LibraryView";

let wide = true;

beforeEach(() => {
  wide = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width") ? wide : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

function view(props: Partial<LibraryViewProps> = {}) {
  const all = { ...visionLibraryProps(), ...props };
  render(
    <MemoryRouter>
      <LibraryView {...all} />
    </MemoryRouter>,
  );
  return all;
}

const html = (props: Partial<LibraryViewProps> = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <LibraryView {...visionLibraryProps()} {...props} />
    </MemoryRouter>,
  );

const build: SelectedBuild = {
  kind: "build",
  id: "b1",
  chip: "Workflow",
  state: { text: "Saved today" },
  title: "Inbox triage agent",
  source: "Sorts the inbox by who is waiting.",
  rows: [{ label: "Model", value: "Sonnet 4.5" }],
  openHref: "/b2/inbox-triage",
  onCopy: vi.fn(),
  onAddToCollection: vi.fn(),
};

describe("LibraryView", () => {
  it("draws the head, the kinds with their counts, and the current kind", () => {
    view();
    expect(screen.getByRole("heading", { level: 1, name: "Library" })).toBeInTheDocument();
    expect(screen.getByText("64 saved · 5 collections")).toBeInTheDocument();
    const kinds = within(screen.getByRole("navigation", { name: "Kinds" })).getAllByRole("link");
    expect(kinds.map((link) => link.textContent)).toEqual(["All saved64", "Builds18", "Parts4", "Sessions9", "Steps27", "Requests3", "Filter sets3"]);
    expect(kinds[4]).toHaveAttribute("aria-current", "page");
    expect(kinds[1]).toHaveAttribute("href", "/?kind=builds");
  });

  it("lists the collections, ordered by last use, each with what it is and its count", () => {
    view();
    const rows = screen.getAllByTestId("library-collection");
    // A Card (name over its kind): a 56 minimum.
    for (const row of rows) expect(row.style.minHeight).toBe("56px");
    expect(rows.map((row) => row.textContent)).toEqual(["Sales promptsPublic9", "Agents to tryPrivate6", "Call tooling kitPrivate5", "Best of Opus 5.5Public · @kit12", "Research briefsFilter set21"]);
    expect(screen.getByRole("heading", { level: 2, name: "5 collections" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New collection" })).toBeInTheDocument();
  });

  it("leads with the changes: the figure as the heading, then a Card each, with no run-based kinds", () => {
    view();
    const changes = screen.getByTestId("library-changes");
    expect(within(changes).getByRole("heading", { level: 2, name: "3 changes" })).toBeInTheDocument();
    expect(within(changes).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "Summary on one promptEdited · 1 line changed · 2d",
      "Tone checker agentRemoved · build unpublished, your snapshot kept · 3d",
      "Account research briefRebuilt · rebuilt by @dax · 5h",
    ]);
    expect(within(changes).getByRole("link", { name: "Open all changes" })).toBeInTheDocument();
    expect(changes.textContent).not.toMatch(/RUN|STALE|reproduc|confirmed/i);
  });

  it("draws the list: tabs, controls, chips, a Card per row with its facts joined by dots, the selected row", () => {
    view();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Steps", "Changed", "Removed"]);
    expect(screen.getByRole("button", { name: "Filters 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort Last used" })).toBeInTheDocument();
    expect(screen.getByText("Same filters as Builds")).toBeInTheDocument();
    const list = screen.getByTestId("library-list");
    expect(list.tagName).toBe("UL");
    const rows = screen.getAllByTestId("library-row");
    expect(rows).toHaveLength(7);
    // A row is a Card button; its selected state is aria-pressed on the button, not aria-selected on the row.
    expect(rows[0]).not.toHaveAttribute("aria-selected");
    expect(within(rows[0]).getAllByRole("button")[0]).toHaveAttribute("aria-pressed", "true");
    expect(within(rows[0]).getByRole("button", { pressed: true })).toHaveTextContent("Summary on one prompt");
    // Facts: type, what happened to it (only when something did), where it is used, when it was last used.
    expect(rows[0].textContent).toContain("Prompt · Edited · Used in 4 · today");
    expect(rows[1].textContent).toContain("Agent · Used in 3 · yesterday");
    expect(rows[0].textContent).not.toMatch(/Stale/);
    const markup = html();
    expect(markup).toContain("color:var(--lit-ink)\">Edited");
    expect(markup).toContain("color:var(--breakage-ink)\">Removed");
  });

  it("chooses an item from its row", () => {
    const onSelect = vi.fn();
    view({ items: { ...visionLibraryProps().items, onSelect } });
    fireEvent.click(within(screen.getAllByTestId("library-row")[2]).getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("vr3");
  });

  it("shows a selected step's two versions as a radio group, its rows, its note, and one primary", () => {
    view();
    const panel = screen.getByTestId("library-selected");
    const group = within(panel).getByRole("radiogroup", { name: "Version" });
    expect(within(group).getByRole("radio", { name: "Your saved version" })).toBeChecked();
    expect(within(panel).getByText("Keep it under 200 words.")).toHaveStyle({ textDecoration: "line-through" });
    expect(within(panel).getByText("1 line changed since you saved it on 12 Oct")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Your note")).toHaveValue("Good section split. Try with the call notes build.");
    expect(within(panel).getByRole("button", { name: "Use in a build" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open source" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open source" }).getAttribute("data-ui")).toBe("button");
  });

  it("shows a selected build with Open and no Plaque or version switch", () => {
    view({ selected: build });
    const panel = screen.getByTestId("library-selected");
    expect(panel.querySelector('[data-ui="plaque"]')).toBeNull();
    expect(within(panel).queryByRole("radiogroup")).toBeNull();
    expect(within(panel).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/b2/inbox-triage");
    expect(within(panel).getByRole("link", { name: "Open" })).toHaveAttribute("data-ui", "button");
    fireEvent.click(within(panel).getByRole("button", { name: "Copy" }));
    expect(build.onCopy).toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: "Add to a collection" }));
    expect(build.onAddToCollection).toHaveBeenCalled();
  });

  it("previews a collection: its head, three numbered rows, and its start action", () => {
    view();
    const preview = screen.getByTestId("library-preview");
    expect(within(preview).getByRole("heading", { name: "Sales prompts" })).toBeInTheDocument();
    expect(within(preview).getByRole("link", { name: "Open Sales prompts" })).toBeInTheDocument();
    expect(within(preview).getByText("Objection handling")).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "Start a build from this collection" })).toBeInTheDocument();
  });

  it("says a failed read in one sentence with Try again, per panel", () => {
    const props = visionLibraryProps("error");
    const onRetry = vi.fn();
    view({ ...props, items: { ...props.items, read: readOf("error", undefined, onRetry), thing: "your library" } });
    expect(screen.getByText("Couldn't load your library. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Couldn't load your collections. Try again.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    const retries = screen.getAllByRole("button", { name: "Try again" });
    fireEvent.click(retries.find((button) => within(screen.getByRole("region", { name: "Saved items" })).queryAllByRole("button").includes(button)) ?? retries[retries.length - 1]);
    expect(onRetry).toHaveBeenCalled();
  });

  it("says 'Nothing saved yet' with one line, Browse builds and How saving works when empty", () => {
    view(visionLibraryProps("empty"));
    const empty = screen.getByTestId("library-empty");
    expect(within(empty).getByRole("heading", { name: "Nothing saved yet" })).toBeInTheDocument();
    expect(within(empty).getByText("Save a build, a session or a step and it waits for you here.")).toBeInTheDocument();
    expect(within(empty).getAllByRole("link")).toHaveLength(1);
    expect(within(empty).getByRole("link", { name: "Browse builds" })).toHaveAttribute("data-ui", "button");
    expect(within(empty).getByRole("button", { name: "How saving works" })).toBeInTheDocument();
  });

  it("stacks the side panel under the list on a phone, kinds as the same pills", () => {
    wide = false;
    view();
    const page = screen.getByTestId("library-page");
    expect(page).toHaveAttribute("data-layout", "one");
    expect(screen.getByRole("navigation", { name: "Kinds" })).toBeInTheDocument();
    const items = screen.getByTestId("library-items");
    const selected = screen.getByTestId("library-selected");
    expect(items.compareDocumentPosition(selected) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("draws its buttons with the shared Button, 32 high with 12 side padding (the control-heights pass)", () => {
    view();
    const buttons = [
      screen.getByRole("button", { name: "Filters 2" }),
      within(screen.getByTestId("library-selected")).getByRole("button", { name: "Use in a build" }),
      within(screen.getByTestId("library-selected")).getByRole("button", { name: "Copy" }),
    ];
    for (const button of buttons) {
      expect(button.getAttribute("data-ui"), button.textContent ?? "").toBe("button");
      expect(button.style.height, button.textContent ?? "").toBe("32px");
      expect(button.style.padding, button.textContent ?? "").toBe("0px 14px");
    }
  });

  it("draws the Version switch as a 32 track with 24 items", () => {
    view();
    const group = within(screen.getByTestId("library-selected")).getByRole("radiogroup", { name: "Version" });
    expect([group.style.minHeight, group.style.alignItems]).toEqual(["32px", "center"]);
    for (const item of within(group).getAllByRole("radio")) expect(item.style.height).toBe("24px");
  });

  it("draws its tabs 53 high, as every tab row is", () => {
    view();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThan(0);
    for (const tab of tabs) expect(tab.style.height, tab.textContent ?? "").toBe("53px");
  });

  it("draws no section whose prop is absent", () => {
    view({ changes: undefined, kinds: undefined, preview: undefined, selected: null });
    expect(screen.queryByTestId("library-changes")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Kinds" })).toBeNull();
    expect(screen.queryByTestId("library-preview")).toBeNull();
    expect(screen.queryByTestId("library-selected")).toBeNull();
  });
});

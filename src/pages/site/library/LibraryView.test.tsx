// SV-09 P2: the Library view, from the board's sample data. Every section is drawn from its own prop; the selected item
// adapts to what it is (a step's two versions, a build's Plaque and Open).

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
  build: { reproduction_count: 3, last_confirmed_at: null, last_confirmed_model: null, published_at: "2026-10-01T00:00:00.000Z" },
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
    expect(rows.map((row) => row.textContent)).toEqual(["Sales promptsPublic9", "Agents to tryPrivate6", "Call tooling kitPrivate5", "Best of Opus 5.5Public · @kit12", "Research briefsFilter set21"]);
    expect(screen.getByText("Ordered by your last use")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New collection" })).toBeInTheDocument();
  });

  it("leads with the changes: the figure, its toned clauses and four rows", () => {
    const markup = html();
    view();
    const changes = screen.getByTestId("library-changes");
    expect(within(changes).getByText("6 changes")).toBeInTheDocument();
    expect(within(changes).getAllByText(/EDITED|REMOVED|RUN|ANSWER/).map((chip) => chip.textContent)).toEqual(["EDITED", "REMOVED", "RUN", "ANSWER"]);
    expect(within(changes).getByRole("link", { name: "Open all changes" })).toBeInTheDocument();
    expect(markup).toContain("color:var(--cat-breakage)\">1 removed");
    expect(markup).toContain("color:var(--evidence)\">2 reproduced on Opus 5.5");
  });

  it("draws the table: tabs, controls, chips, five columns, the selected row, the state words in their colours", () => {
    const props = view();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Steps", "Changed", "Removed"]);
    expect(screen.getByRole("button", { name: "Filters 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sort Last used" })).toBeInTheDocument();
    expect(screen.getByText("Same filters as Builds")).toBeInTheDocument();
    const table = screen.getByTestId("library-table");
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Step", "Type", "State", "Used in", "Last used ↓"]);
    expect(within(table).getByRole("columnheader", { name: /Last used/ })).toHaveAttribute("aria-sort", "descending");
    const rows = screen.getAllByTestId("library-row");
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveAttribute("aria-selected", "true");
    expect(within(rows[0]).getByRole("button", { pressed: true })).toHaveTextContent("Summary on one prompt");
    const markup = html();
    expect(markup).toContain("color:var(--lit)\">Edited");
    expect(markup).toContain("color:var(--cat-breakage)\">Removed");
    void props;
  });

  it("chooses an item from its row", () => {
    const onSelect = vi.fn();
    view({ items: { ...visionLibraryProps().items, onSelect } });
    fireEvent.click(screen.getAllByTestId("library-row")[2]);
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
  });

  it("shows a selected build with its Plaque and Open, no version switch", () => {
    view({ selected: build });
    const panel = screen.getByTestId("library-selected");
    expect(panel.querySelector('[data-ui="plaque"]')).not.toBeNull();
    expect(within(panel).queryByRole("radiogroup")).toBeNull();
    expect(within(panel).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/b2/inbox-triage");
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

  it("says a failed read in one sentence with Retry, per panel", () => {
    const props = visionLibraryProps("error");
    const onRetry = vi.fn();
    view({ ...props, items: { ...props.items, what: "Builds didn't load.", onRetry } });
    expect(screen.getByText("Builds didn't load.")).toBeInTheDocument();
    expect(screen.getByText("Collections didn't load.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Retry" })[1]);
    expect(onRetry).toHaveBeenCalled();
  });

  it("is one line and one action when empty", () => {
    view(visionLibraryProps("empty"));
    const empty = screen.getByTestId("library-empty");
    expect(within(empty).getByText("Save a step from any build and it waits for you here.")).toBeInTheDocument();
    expect(within(empty).getAllByRole("link")).toHaveLength(1);
  });

  it("puts the kinds in a row of tabs on a phone, then the table, then the selected item", () => {
    wide = false;
    view();
    const page = screen.getByTestId("library-page");
    expect(page).toHaveAttribute("data-layout", "one");
    expect(screen.queryByRole("navigation", { name: "Kinds" })).toBeNull();
    expect(screen.getByRole("tablist", { name: "Kinds" })).toBeInTheDocument();
    const order = Array.from(page.children).map((child) => child.querySelector("[data-testid]")?.getAttribute("data-testid") ?? child.getAttribute("aria-label"));
    expect(order.indexOf("library-items")).toBeLessThan(order.indexOf("library-selected"));
  });

  it("draws no section whose prop is absent", () => {
    view({ changes: undefined, kinds: undefined, preview: undefined, selected: null });
    expect(screen.queryByTestId("library-changes")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Kinds" })).toBeNull();
    expect(screen.queryByTestId("library-preview")).toBeNull();
    expect(screen.queryByTestId("library-selected")).toBeNull();
  });
});

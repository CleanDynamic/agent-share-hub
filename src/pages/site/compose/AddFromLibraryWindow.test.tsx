// SV-18 P1: the Add from Library window, drawn from the board's sample data.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { visionAddFromLibraryProps, visionLibraryInsertRows } from "@/dev/fixtures/vision/composer-add-from-library";

import { AddFromLibraryWindow, LIBRARY_WINDOW_COPY, matchingRows, type AddFromLibraryWindowProps } from "./AddFromLibraryWindow";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function show(over: Partial<AddFromLibraryWindowProps> = {}) {
  const props = { ...visionAddFromLibraryProps(), onSelect: vi.fn(), onInsert: vi.fn(), onClose: vi.fn(), onVersion: vi.fn(), onQuery: vi.fn(), onTab: vi.fn(), onRetry: vi.fn(), ...over };
  render(
    <MemoryRouter>
      <AddFromLibraryWindow {...props} />
    </MemoryRouter>,
  );
  return props;
}

/** The window with its own selection and search, as the host holds them. */
function Held({ onInsert }: { onInsert: (id: string) => void }) {
  const [selectedId, select] = useState<string | null>("li1");
  const [query, setQuery] = useState("");
  return <AddFromLibraryWindow {...visionAddFromLibraryProps()} selectedId={selectedId} query={query} onSelect={select} onQuery={setQuery} onInsert={onInsert} />;
}

describe("the window", () => {
  it("is a dialog named Add from Library, with the place and what fits there", () => {
    show();
    expect(screen.getByRole("dialog", { name: "Add from Library" })).toBeInTheDocument();
    expect(screen.getByText("Inside Session 2 · Clean-up agent · prompts fit here")).toBeInTheDocument();
  });

  it("has Steps and Collections with their counts, and why a kind is missing", () => {
    show();
    const tabs = screen.getByRole("tablist", { name: "Kind" });
    expect(within(tabs).getByRole("tab", { name: /^Steps\s*14$/ })).toHaveAttribute("aria-selected", "true");
    expect(within(tabs).getByRole("tab", { name: /^Collections\s*3$/ })).toBeInTheDocument();
    expect(screen.getByText("Sessions don't fit inside an agent")).toBeInTheDocument();
  });

  it("lists saved items as a radio group with one tab stop", () => {
    show();
    const group = screen.getByRole("radiogroup", { name: "Saved steps" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(within(radios[0]).getByText("Edited since saved")).toBeInTheDocument();
    expect(within(radios[3]).getByText("Stale")).toBeInTheDocument();
  });

  it("shows the version switch on the selected item only", () => {
    show();
    const radios = screen.getAllByRole("radio");
    const switchOf = within(radios[0]).getByRole("group", { name: "Version to insert" });
    expect(within(switchOf).getByRole("button", { name: "Saved version · 12 Oct" })).toHaveAttribute("aria-pressed", "true");
    expect(within(switchOf).getByRole("button", { name: "Current version · 23 Oct" })).toBeEnabled();
    expect(within(radios[1]).queryByRole("group", { name: "Version to insert" })).toBeNull();
  });

  it("keeps Current version switched off for an item whose source has no newer version", () => {
    show({ selectedId: "li2" });
    expect(screen.getByRole("button", { name: "Current version" })).toBeDisabled();
  });

  it("says the footer sentence for the selected item and nothing when none is", () => {
    show();
    expect(screen.getByText(/^Copied as a new prompt with its source\. @maya is credited on the tile, and their step will show used in 5 builds\.$/)).toBeInTheDocument();
    cleanup();
    show({ selectedId: null });
    expect(screen.queryByText(/^Copied as a new/)).toBeNull();
    expect(screen.getByRole("button", { name: "Insert" })).toBeDisabled();
  });

  it("never says a pronoun for the maker", () => {
    show();
    expect(document.body.textContent).not.toMatch(/\b(her|his|she|he)\b/i);
  });
});

describe("keys", () => {
  it("arrow keys move the choice and focus between items", () => {
    const props = show();
    const radios = screen.getAllByRole("radio");
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: "ArrowDown" });
    expect(props.onSelect).toHaveBeenLastCalledWith("li2");
    fireEvent.keyDown(radios[0], { key: "ArrowUp" });
    expect(props.onSelect).toHaveBeenLastCalledWith("li4");
  });

  it("Enter inserts the item it is on", () => {
    const inserted = vi.fn();
    render(
      <MemoryRouter>
        <Held onInsert={inserted} />
      </MemoryRouter>,
    );
    const radios = screen.getAllByRole("radio");
    radios[2].focus();
    fireEvent.keyDown(radios[2], { key: "Enter" });
    // The press chooses it, then inserts; the host reads the choice it holds.
    expect(screen.getAllByRole("radio")[2]).toHaveAttribute("aria-checked", "true");
    expect(inserted).toHaveBeenCalledTimes(1);
    expect(inserted).toHaveBeenCalledWith("li3");
  });

  it("Escape closes", () => {
    const props = show();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("Cancel and Close close it, Insert inserts", () => {
    const props = show();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(props.onInsert).toHaveBeenCalledWith("li1");
  });

  it("Insert waits while an insert is on its way", () => {
    show({ inserting: true });
    expect(screen.getByRole("button", { name: "Insert" })).toBeDisabled();
  });
});

describe("search", () => {
  it("is a field named for what is listed, with the focus ring kept", () => {
    show();
    const field = screen.getByRole("searchbox", { name: "Find a saved step" });
    expect(field.style.outline).not.toBe("none");
  });

  it("keeps the rows whose title or detail has every word", () => {
    expect(matchingRows(visionLibraryInsertRows, "research").map((row) => row.id)).toEqual(["li2"]);
    expect(matchingRows(visionLibraryInsertRows, "opus 4 builds").map((row) => row.id)).toEqual(["li1"]);
    expect(matchingRows(visionLibraryInsertRows, "  ").length).toBe(4);
  });

  it("says when nothing matches", () => {
    show({ query: "zzz" });
    expect(screen.getByText(LIBRARY_WINDOW_COPY.noMatch)).toBeInTheDocument();
  });
});

describe("states", () => {
  it("loading", () => {
    show({ status: "loading", rows: [] });
    expect(screen.getByRole("status")).toHaveTextContent(LIBRARY_WINDOW_COPY.loading);
  });

  it("error says one sentence and offers Retry", () => {
    const props = show({ status: "error", rows: [] });
    expect(screen.getByRole("alert")).toHaveTextContent(LIBRARY_WINDOW_COPY.error);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it("empty says one line and one action", () => {
    show({ rows: [], selectedId: null });
    expect(screen.getByText(new RegExp(LIBRARY_WINDOW_COPY.empty))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Library" })).toHaveAttribute("href", "/library");
  });
});

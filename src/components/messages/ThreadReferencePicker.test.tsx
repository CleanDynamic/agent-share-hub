// RC-P20 — the picker offers one kind, builds, and twenty of them at most.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { REFERENCE_KINDS, REFERENCE_MAX, ThreadReferencePicker } from "@/components/messages/ThreadReferencePicker";

const items = Array.from({ length: 25 }, (_, index) => ({
  id: `build-${index}`,
  name: `Build ${index}`,
  subtitle: index % 2 ? "Saved" : "Yours",
}));

function renderPicker(
  onSelect = vi.fn(),
  { results = items, query = "", onQueryChange = vi.fn(), error = null as unknown, onRetry = vi.fn() } = {},
) {
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  render(
    <MemoryRouter>
      <ThreadReferencePicker
        isOpen
        onClose={vi.fn()}
        query={query}
        onQueryChange={onQueryChange}
        results={results}
        error={error}
        onRetry={onRetry}
        onSelect={onSelect}
        anchorEl={anchor}
      />
    </MemoryRouter>,
  );
  return { picker: screen.getByTestId("reference-picker"), onSelect };
}

describe("ThreadReferencePicker", () => {
  it("offers exactly one kind, Builds, and nothing to switch between", () => {
    const { picker } = renderPicker();
    expect(REFERENCE_KINDS).toEqual(["Builds"]);
    expect(within(picker).getByTestId("reference-kind").textContent).toBe("Builds");
    for (const legacy of ["Blueprints", "Stages", "Blocks"]) expect(within(picker).queryByText(legacy)).toBeNull();
  });

  it("shows twenty builds at most, and picks the one chosen", () => {
    const { picker, onSelect } = renderPicker();
    const rows = within(picker).getAllByTestId("reference-item");
    expect(REFERENCE_MAX).toBe(20);
    expect(rows).toHaveLength(20);
    fireEvent.click(rows[3]);
    expect(onSelect).toHaveBeenCalledWith(items[3]);
  });

  it("picks with the keyboard", () => {
    const { picker, onSelect } = renderPicker();
    const search = within(picker).getByLabelText("Search your builds and saves");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it("with nothing to offer, says so in one sentence with one way on", () => {
    const { picker } = renderPicker(vi.fn(), { results: [] });
    const empty = within(picker).getByTestId("reference-empty");
    expect(empty.textContent).toContain("Publish or save a build and it can go in a message.");
    expect(within(empty).getAllByRole("link")).toHaveLength(1);
    expect(within(empty).getByRole("link", { name: "Browse the gallery" }).getAttribute("href")).toBe("/gallery");
  });

  it("with a search that matches nothing, offers to clear it", () => {
    const onQueryChange = vi.fn();
    const { picker } = renderPicker(vi.fn(), { results: [], query: "zzz", onQueryChange });
    fireEvent.click(within(picker).getByRole("button", { name: "Clear search" }));
    expect(onQueryChange).toHaveBeenCalledWith("");
  });

  it("when the builds cannot be read, says so and offers to try again, not an empty list", () => {
    const onRetry = vi.fn();
    const { picker } = renderPicker(vi.fn(), { results: [], error: { code: "42501" }, onRetry });
    expect(within(picker).queryByTestId("reference-empty")).toBeNull();
    expect(within(picker).getByTestId("reference-error").textContent).toContain("You don't have access to this.");
    fireEvent.click(within(picker).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

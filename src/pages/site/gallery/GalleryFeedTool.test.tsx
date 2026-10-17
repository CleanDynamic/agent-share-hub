// TF-14 — the Made with menu: built in group order with logos where there are some, the chip, and Clear all.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LABS } from "@/lib/models/registry";
import { TOOL_GROUPS, TOOLS, toolsInGroup } from "@/lib/tools/registry";

import { GalleryFeedView, menusFor, type GalleryFeedViewProps } from "./GalleryFeedView";

const lovable = TOOLS.find((tool) => tool.id === "lovable")!;

function props(extra: Partial<GalleryFeedViewProps> = {}): GalleryFeedViewProps {
  return {
    view: "feed",
    onViewChange: vi.fn(),
    query: null,
    onSearch: vi.fn(),
    model: null,
    onModelChange: vi.fn(),
    tool: null,
    onToolChange: vi.fn(),
    audience: null,
    onAudienceChange: vi.fn(),
    audiences: [],
    sort: "newest",
    onSortChange: vi.fn(),
    counts: null,
    status: "ready",
    onRetry: vi.fn(),
    list: { kind: "all", list: { rows: [], total: 0, hasMore: false, loadingMore: false, onMore: vi.fn() } },
    srcByPath: new Map(),
    onClearAll: vi.fn(),
    onNavigate: vi.fn(),
    ...extra,
  };
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("menusFor, the Made with menu", () => {
  const menus = (extra: Partial<GalleryFeedViewProps> = {}) => menusFor(props(extra));

  it("sits after Model and before Made for", () => {
    expect(menus().map((menu) => menu.key)).toEqual(["model", "tool", "for", "sort"]);
    expect(menus().find((menu) => menu.key === "tool")).toMatchObject({ label: "Made with", value: "Any" });
  });

  it("is Any tool, then the tools under their group headings in registry order", () => {
    const { groups } = menus().find((menu) => menu.key === "tool")!;
    expect(groups[0].options.map((option) => option.label)).toEqual(["Any tool"]);
    const headings = groups.slice(1).map((group) => group.heading);
    expect(headings).toEqual(TOOL_GROUPS.filter((group) => toolsInGroup(group.key).length > 0).map((group) => group.label));
    expect(groups.slice(1)[0].options.map((option) => option.key)).toEqual(toolsInGroup("chat").map((tool) => tool.id));
  });

  it("gives a logo to a tool that has one and none to a tool that has not", () => {
    const options = menus().find((menu) => menu.key === "tool")!.groups.flatMap((group) => group.options);
    expect(options.find((option) => option.key === "lovable")?.mark).toBeTruthy();
    expect(options.find((option) => option.key === "base44")?.mark).toBeUndefined();
  });

  it("marks the chosen tool, and chooses one at a time", () => {
    const onToolChange = vi.fn();
    const menu = menus({ tool: lovable, onToolChange }).find((entry) => entry.key === "tool")!;
    expect(menu.value).toBe("Lovable");
    const options = menu.groups.flatMap((group) => group.options);
    expect(options.filter((option) => option.selected).map((option) => option.key)).toEqual(["lovable"]);
    options.find((option) => option.key === "replit")!.onSelect();
    options.find((option) => option.key === "any")!.onSelect();
    expect(onToolChange.mock.calls).toEqual([["replit"], [null]]);
  });

  it("puts each lab's logo on its heading in the Model menu", () => {
    const groups = menus().find((menu) => menu.key === "model")!.groups.slice(1);
    expect(groups.map((group) => group.heading)).toEqual(LABS.filter((lab) => groups.some((g) => g.heading === lab)));
    expect(groups.filter((group) => group.headingMark).length).toBeGreaterThan(0);
  });
});

describe("the chip and Clear all", () => {
  const tree = (extra: Partial<GalleryFeedViewProps> = {}) => (
    <MemoryRouter>
      <GalleryFeedView {...props(extra)} />
    </MemoryRouter>
  );

  it("shows 'Made with Lovable' beside the model chip, and its remove clears the tool", () => {
    const onToolChange = vi.fn();
    render(tree({ tool: lovable, onToolChange, model: { id: "sonnet-5-5", name: "Sonnet 5.5" } as never }));
    const row = screen.getByTestId("feed-active-filters");
    const labels = within(row).getAllByRole("button").map((button) => button.textContent);
    expect(labels).toEqual(["Proof on Sonnet 5.5", "Made with Lovable", "Clear all"]);
    fireEvent.click(within(row).getByRole("button", { name: "Remove Made with Lovable" }));
    expect(onToolChange).toHaveBeenCalledWith(null);
  });

  it("shows no chip without a tool, and Clear all calls onClearAll", () => {
    const onClearAll = vi.fn();
    const { rerender } = render(tree({ query: "inbox", onClearAll }));
    expect(screen.queryByRole("button", { name: /^Remove Made with/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
    rerender(tree({ tool: lovable, onClearAll }));
    expect(screen.getByRole("button", { name: "Remove Made with Lovable" })).toBeTruthy();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatternMarks } from "@/components/gallery/PatternMarks";

import { menusFor, type GalleryFeedViewProps } from "./GalleryFeedView";

afterEach(() => cleanup());

const props = (over: Partial<GalleryFeedViewProps> = {}): GalleryFeedViewProps =>
  ({
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
    ...over,
  }) as unknown as GalleryFeedViewProps;

describe("the Patterns filter (CA-13 P12)", () => {
  it("is not there until a pattern has a build, so a Gallery without the migration is exactly what it was", () => {
    expect(menusFor(props()).map((m) => m.key)).toEqual(["model", "tool", "for", "sort"]);
    expect(menusFor(props({ patterns: [], onPatternChange: vi.fn() })).map((m) => m.key)).toEqual(["model", "tool", "for", "sort"]);
    expect(menusFor(props({ patterns: [{ value: "router", count: 0 }], onPatternChange: vi.fn() })).map((m) => m.key)).toEqual(["model", "tool", "for", "sort"]);
  });

  it("sits beside the other filters with each pattern and its count, and hides one whose count is 0", () => {
    const onPatternChange = vi.fn();
    const menus = menusFor(props({ patterns: [{ value: "router", count: 4 }, { value: "long-running", count: 0 }, { value: "structured-output", count: 2 }], onPatternChange }));
    expect(menus.map((m) => m.key)).toEqual(["model", "tool", "pattern", "for", "sort"]);
    const menu = menus.find((m) => m.key === "pattern")!;
    expect(menu.label).toBe("Pattern");
    expect(menu.value).toBe("Any");
    const options = menu.groups[0].options;
    expect(options.map((o) => [o.label, o.count])).toEqual([["Any pattern", undefined], ["Uses a router", 4], ["Structured output", 2]]);
    options[1].onSelect();
    expect(onPatternChange).toHaveBeenCalledWith("router");
  });

  it("says which is chosen", () => {
    const menu = menusFor(props({ pattern: "structured-output", patterns: [{ value: "structured-output", count: 2 }], onPatternChange: vi.fn() })).find((m) => m.key === "pattern")!;
    expect(menu.value).toBe("Structured output");
    expect(menu.groups[0].options.filter((o) => o.selected).map((o) => o.label)).toEqual(["Structured output"]);
  });
});

describe("pattern marks on a card (CA-13 P12)", () => {
  it("draws nothing for a build with none", () => {
    const { container } = render(<PatternMarks patterns={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("draws at most two, and '+1' for the third", () => {
    render(<PatternMarks patterns={["router", "long-running", "structured-output"]} />);
    expect(screen.getAllByTestId("pattern-mark").map((n) => n.textContent)).toEqual(["Uses a router", "Long-running agent"]);
    expect(screen.getByTestId("pattern-more").textContent).toBe("+1");
  });
});

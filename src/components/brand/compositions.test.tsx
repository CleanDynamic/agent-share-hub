// UI-P11 — tagline, hero plate, part viewer, and the plaque's inverse tone.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values);
// roles and behaviour on the rendered tree.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PartViewer } from "./PartViewer";
import { Plaque, type PlaqueBuild } from "./Plaque";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-01T12:00:00Z");
const BUILD: PlaqueBuild = {
  reproduction_count: 63,
  rebuild_count: 0,
  last_confirmed_at: new Date(NOW - DAY).toISOString(),
  last_confirmed_model: "sonnet-4.5",
  published_at: new Date(NOW - 90 * DAY).toISOString(),
};

describe("Plaque tone", () => {

  it("is unchanged on a surface, by default", () => {
    const html = markup(<Plaque build={BUILD} now={NOW} />);
    expect(html).toContain("background:var(--evidence-fill)");
    expect(html).not.toContain("inverse");
  });
});

describe("PartViewer", () => {
  const TABS = [
    { value: "anatomy", label: "Anatomy" },
    { value: "built", label: "Watch it get built" },
  ] as const;
  const viewer = (over: Partial<React.ComponentProps<typeof PartViewer<"anatomy" | "built">>> = {}) => (
    <PartViewer<"anatomy" | "built">
      number={1}
      category="instruction"
      categoryLabel="instruction"
      name="System prompt"
      tabs={TABS}
      tab="anatomy"
      onTabChange={() => {}}
      mode="understand"
      onModeChange={() => {}}
      blurb="What each step does."
      {...over}
    >
      You triage supplier invoices.
    </PartViewer>
  );

  it("draws the strip: 'PART 01' in the viewer block, then the raised tab with the chip and the name", () => {
    const html = markup(viewer());
    expect(html).toContain("PART 01");
    expect(html).toContain("background:var(--viewer-block)");
    expect(html).toContain("border-radius:0 0 14px 0");
    expect(html).toContain("background:var(--tab)");
    expect(html).toContain("border-radius:12px 0 0 0");
    expect(html).toContain("border-bottom:0");
    expect(html).toContain('data-ui="category-chip"');
    expect(html).toContain("01 · System prompt");
  });

  it("is a solid, hairlined, 16px-radius frame with the card shadow", () => {
    const html = markup(viewer());
    expect(html).toContain("background:var(--solid)");
    expect(html).toContain("border:1px solid var(--glass-border)");
    expect(html).toContain("border-radius:var(--r-panel)");
    expect(html).toContain("box-shadow:var(--shadow-card)");
  });

  it("has no window dots and no close button", () => {
    render(viewer());
    expect(screen.queryByRole("button", { name: /close/i })).toBeNull();
  });

  it("is controlled: tabs, mode and Copy all report up", () => {
    const onTabChange = vi.fn();
    const onModeChange = vi.fn();
    const onCopy = vi.fn();
    render(viewer({ onTabChange, onModeChange, onCopy }));
    fireEvent.click(screen.getByRole("tab", { name: "Watch it get built" }));
    expect(onTabChange).toHaveBeenCalledWith("built");
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(onModeChange).toHaveBeenCalledWith("run");
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it("names itself and its tab panel", () => {
    render(viewer());
    expect(screen.getByRole("region", { name: "Part 01: System prompt" })).toBeTruthy();
    expect(screen.getByRole("tabpanel")).toBeTruthy();
  });
});

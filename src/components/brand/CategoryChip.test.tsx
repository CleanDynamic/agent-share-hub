// BG-P11 — the category chip.
//
// The claims: every chip resolves through the measured pairs and carries no
// raw hex in either theme's token set, the radius is the scale's chip step and
// never a capsule, selection is a border rather than a second fill, and the
// overflow variant names no category so it wears no category ground.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CategoryChip } from "./CategoryChip";
import { CATEGORIES } from "@/lib/theme/category";

function markup(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

describe("the nine, and the fallback", () => {
  for (const category of CATEGORIES) {
    it(`paints ${category} from its measured pair`, () => {
      const html = markup(<CategoryChip category={category} label={category} />);
      expect(html).toContain(`background:var(--cat-${category}-fill)`);
      expect(html).toContain(`color:var(--cat-${category})`);
    });
  }

  it("lands an unknown category on the fallback pair, not on an invented hue", () => {
    const html = markup(<CategoryChip category="founders" label="founders" />);
    expect(html).toContain("background:var(--cat-fallback-fill)");
    expect(html).toContain("color:var(--cat-fallback)");
  });

  it("resolves a synonym rather than falling back", () => {
    const html = markup(<CategoryChip category="gap" label="gap" />);
    expect(html).toContain("background:var(--cat-breakage-fill)");
  });
});

describe("no raw hex", () => {
  /**
   * The whole chip set, every variant and state, in one sweep.
   *
   * Asserted through SSR because jsdom's cssstyle drops every `var()` value —
   * read off a rendered node, a token and a hex are both the empty string, so
   * the check would pass on a chip painted in raw colour.
   */
  it("carries no hex and no rgba anywhere in the set", () => {
    const chips = [
      ...CATEGORIES.map((c) => <CategoryChip key={c} category={c} label={c} />),
      <CategoryChip key="unknown" category="not-a-category" label="fallback" />,
      <CategoryChip key="count" category="evidence" label="evidence" count={12} />,
      <CategoryChip key="sel" category="data" label="data" selected onClick={() => {}} />,
      <CategoryChip key="unsel" category="data" label="data" onClick={() => {}} />,
      <CategoryChip key="over" variant="overflow" count={4} />,
    ];
    const html = markup(<>{chips}</>);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/rgba?\(/);
  });

  it("spends the scale's chip radius, and never a capsule", () => {
    const html = markup(<CategoryChip category="media" label="media" />);
    expect(html).toContain("border-radius:var(--r-chip)");
    expect(html).not.toMatch(/border-radius:(100|999)px/);
  });
});

describe("the count", () => {
  it("rides inside the chip rather than beside it", () => {
    render(<CategoryChip category="evidence" label="evidence" count={3} />);
    const chip = screen.getByText("evidence").closest("[data-visual-slot='category-chip']");
    expect(chip?.querySelector("[data-chip-count]")).toHaveTextContent("3");
  });

  it("shows no number at zero or absent", () => {
    const { container, rerender } = render(
      <CategoryChip category="evidence" label="evidence" count={0} />
    );
    expect(container.querySelector("[data-chip-count]")).toBeNull();
    rerender(<CategoryChip category="evidence" label="evidence" />);
    expect(container.querySelector("[data-chip-count]")).toBeNull();
  });
});

describe("selection", () => {
  it("is a border, and never overwrites the fill that carries the category", () => {
    const html = markup(
      <CategoryChip category="agents" label="agents" selected onClick={() => {}} />
    );
    expect(html).toContain("background:var(--cat-agents-fill)");
    expect(html).toContain("border-color:var(--action)");
  });

  it("makes a chip with a handler an operable control", () => {
    const onClick = vi.fn();
    render(<CategoryChip category="data" label="data" onClick={onClick} />);
    const chip = screen.getByRole("button");
    expect(chip).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chip);
    fireEvent.keyDown(chip, { key: "Enter" });
    fireEvent.keyDown(chip, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("is a plain label with no handler", () => {
    render(<CategoryChip category="data" label="data" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the overflow variant", () => {
  it("renders +N in --text2 and wears no category ground", () => {
    const html = markup(<CategoryChip variant="overflow" count={4} />);
    expect(html).toContain(">+4<");
    expect(html).toContain("color:var(--text2)");
    expect(html).not.toMatch(/background:var\(--cat-[a-z]+-fill\)/);
  });

  it("is phrasing content, so it may sit inside a paragraph", () => {
    const html = markup(<CategoryChip variant="overflow" count={2} />);
    expect(html.startsWith("<span")).toBe(true);
  });
});

describe("the chip is phrasing content", () => {
  it("renders a span, because several call sites sit it inside a <p> or an <a>", () => {
    const html = markup(<CategoryChip category="narrative" label="narrative" />);
    expect(html.startsWith("<span")).toBe(true);
  });
});

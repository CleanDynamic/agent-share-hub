// UI-P11 — tagline, hero plate, part viewer, and the plaque's inverse tone.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values);
// roles and behaviour on the rendered tree.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { HeroPlate } from "./HeroPlate";
import { PartViewer } from "./PartViewer";
import { Plaque, type PlaqueBuild } from "./Plaque";
import { Tagline } from "./Tagline";

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
const LINES = ["Every AI build,", "hung with", "its proof."] as const;

describe("Tagline", () => {
  it("is one heading whose text is the whole sentence, with the chips hidden from screen readers", () => {
    render(<Tagline lines={LINES} size={46} offsets={[0, 90, 30]} />);
    expect(screen.getByRole("heading", { level: 1, name: "Every AI build, hung with its proof." })).toBeTruthy();
    const chips = document.querySelectorAll('[data-ui="tagline"] > span[aria-hidden="true"]');
    expect(chips).toHaveLength(3);
  });

  it("derives padding, gap and the mark from the size, truncated (46 and 30, the reference's two)", () => {
    const at46 = markup(<Tagline lines={LINES} size={46} offsets={[0, 90, 30]} />);
    expect(at46).toContain("padding:10px 14px 11px");
    expect(at46).toContain("gap:11px");
    expect(at46).toContain('width="27"');
    const at30 = markup(<Tagline lines={LINES} size={30} offsets={[0, 44, 14]} />);
    expect(at30).toContain("padding:6px 9px 7px");
    expect(at30).toContain("gap:7px");
    expect(at30).toContain('width="18"');
  });

  it("steps the chips by their offsets and shapes their corners 1 / 2 / 3", () => {
    const html = markup(<Tagline lines={LINES} size={46} offsets={[0, 90, 30]} />);
    expect(html).toContain("margin-left:0;");
    expect(html).toContain("margin-left:90px");
    expect(html).toContain("margin-left:30px");
    expect(html).toContain("border-radius:14px 14px 0 14px");
    expect(html).toContain("border-radius:0 14px 14px 14px");
    expect(html).toContain("border-radius:14px");
  });

  it("sets −0.03em at every size and spends the tagline tokens, with the lamp on its own token", () => {
    const html = markup(<Tagline lines={LINES} size={46} offsets={[0, 90, 30]} />);
    expect(html).toContain("letter-spacing:-0.03em");
    expect(html).toContain("background:var(--tagline-chip)");
    expect(html).toContain("color:var(--on-tagline-chip)");
    expect(html).toContain('fill="var(--tagline-lamp)"');
  });

  it("puts the mark on line 2 only", () => {
    expect(markup(<Tagline lines={LINES} size={40} offsets={[0, 70, 24]} />).match(/data-ui="mark"/g)).toHaveLength(1);
  });
});

describe("Plaque tone", () => {
  it("is on --inverse-evidence-fill and --on-inverse when inverse, at the reference's 10px / 11px", () => {
    const html = markup(<Plaque build={BUILD} tone="inverse" now={NOW} />);
    expect(html).toContain("background:var(--inverse-evidence-fill)");
    expect(html).toContain("color:var(--on-inverse-evidence-fill)");
    expect(html).toContain("color:var(--on-inverse)");
    expect(html).toContain("font-size:10px");
    expect(html).toContain("font-size:11px");
    expect(html).toContain("yesterday, on sonnet-4.5");
    expect(html).not.toContain("var(--evidence-fill)");
  });

  it("is unchanged on a surface, by default", () => {
    const html = markup(<Plaque build={BUILD} now={NOW} />);
    expect(html).toContain("background:var(--evidence-fill)");
    expect(html).not.toContain("inverse");
  });

  it("says 'not yet reproduced' in --on-inverse-2 on the inverse ground", () => {
    const html = markup(
      <Plaque build={{ ...BUILD, reproduction_count: 0, last_confirmed_at: null }} tone="inverse" now={NOW} />,
    );
    expect(html).toContain("color:var(--on-inverse-2)");
    expect(html).toContain("not yet reproduced");
  });
});

describe("HeroPlate · featured", () => {
  const featured = (
    <HeroPlate
      variant="featured"
      cover={<div data-testid="cover" />}
      title="Support reply drafter"
      outcome="Drafts a first reply."
      build={BUILD}
      rank={1}
      now={NOW}
    />
  );

  it("is a lamp over a framed row: the cover at 1.2 and the inverse panel at 1", () => {
    const html = markup(featured);
    expect(html.indexOf('data-ui="picture-lamp"')).toBeLessThan(html.indexOf('data-testid="cover"'));
    expect(html).toContain("flex-grow:1.2");
    expect(html).toContain("background:var(--inverse)");
    expect(html).toContain("color:var(--on-inverse)");
    expect(html).toContain("padding:18px 20px");
    expect(html).toContain("border:1px solid var(--glass-border)");
    expect(html).toContain("box-shadow:var(--shadow-card)");
    expect(html).toContain("MOST REPRODUCED THIS MONTH");
  });

  it("hangs the rank square 14px below, left 20, 84×84, zero-padded", () => {
    const html = markup(featured);
    expect(html).toContain("left:20px");
    expect(html).toContain("bottom:-14px");
    expect(html).toContain("width:84px");
    expect(html).toContain("box-shadow:var(--shadow-square)");
    expect(html).toContain(">NO.<");
    expect(html).toContain(">01<");
  });

  it("is a level-2 heading, and carries the inverse plaque", () => {
    render(featured);
    expect(screen.getByRole("heading", { level: 2, name: "Support reply drafter" })).toBeTruthy();
    expect(document.querySelector('[data-ui="plaque"][data-plaque-tone="inverse"]')).not.toBeNull();
  });

  it("is not blurred", () => {
    expect(markup(featured)).not.toMatch(/backdrop-filter|blur/i);
  });
});

describe("HeroPlate · build", () => {
  const plate = (
    <HeroPlate
      variant="build"
      title="Invoice triage agent"
      outcome="Reads every supplier invoice."
      credit={<span>made by @maya</span>}
      delta="Δ swapped model"
    />
  );

  it("is placed 16px from left, right and bottom, on --plate, with the one blur", () => {
    const html = markup(plate);
    expect(html).toContain("left:16px;right:16px;bottom:16px");
    expect(html).toContain("padding:18px 20px 18px 120px");
    expect(html).toContain("border-radius:var(--r-panel)");
    expect(html).toContain("background:var(--plate)");
    expect(html).toContain("border:1px solid var(--header-border)");
    expect(html).toContain("backdrop-filter:blur(16px) saturate(1.15)");
  });

  it("has an h1, the credit row, and the mark square at 30 / 30", () => {
    render(plate);
    expect(screen.getByRole("heading", { level: 1, name: "Invoice triage agent" })).toBeTruthy();
    expect(screen.getByText("Δ swapped model")).toBeTruthy();
    const html = markup(plate);
    expect(html).toContain("left:30px;bottom:30px");
    expect(html).toContain("width:88px");
    expect(html).toContain('width="50"');
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

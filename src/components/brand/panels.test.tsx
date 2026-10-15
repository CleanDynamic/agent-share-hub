// UI-P09, UI-P09b — panel, panel head, wall label, detail, stat, striped bar, page heading.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values);
// roles and structure on the rendered tree.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { CardHead } from "./CardHead";
import { Detail } from "./Detail";
import { Figure } from "./Figure";
import { PageHeading } from "./PageHeading";
import { Panel, PanelHead } from "./Panel";
import { Row } from "./Row";
import { Stat } from "./Stat";
import { StripedBar } from "./StripedBar";
import { Tile, Well } from "./Tile";
import { WallLabel } from "./WallLabel";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

/** The refined look, the way a dev page asks for it: `?look=refined` on a `/dev/*` route (UI-P78). */
const REFINED_URL = "/dev/kit/pages/home";
const underRefined = (node: React.ReactElement) => <MemoryRouter initialEntries={[REFINED_URL]}>{node}</MemoryRouter>;

describe("Panel", () => {

  it("is flat for the workspace: --flat, the same hairline, no shadow", () => {
    const html = markup(<Panel surface="flat">x</Panel>);
    expect(html).toContain('data-surface="flat"');
    expect(html).not.toContain("bg-glass");
    expect(html).toContain("background:var(--flat)");
    expect(html).toContain("border:1px solid var(--glass-border)");
    expect(html).toContain("box-shadow:none");
    expect(html).not.toContain("var(--glass)");
  });

  it("sets no blur of its own on any surface: the blur lives in index.css, on .bg-glass::after", () => {
    for (const surface of ["glass", "plain", "flat"] as const) {
      expect(markup(<Panel surface={surface}>x</Panel>)).not.toMatch(/backdrop-filter|blur|filter:/i);
    }
  });

  it("carries no raw colour", () => {
    const html = (["glass", "plain", "flat"] as const).map((surface) => markup(<Panel surface={surface}>x</Panel>)).join("");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/rgba?\(/);
  });
});

describe("Panel under the refined look (UI-P81)", () => {
  it('paints the module recipe for surface="glass": --module, a --module-border hairline, radius --r-card, --module-shadow', () => {
    const html = markup(underRefined(<Panel surface="glass">x</Panel>));
    // It still reports what was asked for, so a call site and its tests need no change.
    expect(html).toContain('data-surface="glass"');
    expect(html).toContain("background:var(--module)");
    expect(html).toContain("border:1px solid var(--module-border)");
    expect(html).toContain("border-radius:var(--r-card)");
    expect(html).toContain("box-shadow:var(--module-shadow)");
    expect(html).toContain("overflow:hidden");
  });

  it("has no liquid glass: no class, no halo, no fill of `none`, no border of `none`", () => {
    const html = markup(underRefined(<Panel surface="glass">x</Panel>));
    expect(html).not.toContain("bg-glass");
    expect(html).not.toContain("class=");
    expect(html).not.toContain("var(--glass-halo)");
    expect(html).not.toContain("background:none");
    expect(html).not.toContain("border:none");
  });

  it("sets no blur and no filter on any surface", () => {
    for (const surface of ["glass", "plain", "flat"] as const) {
      expect(markup(underRefined(<Panel surface={surface}>x</Panel>))).not.toMatch(/backdrop-filter|blur|filter:/i);
    }
  });

  it("carries no raw colour on any surface", () => {
    const html = (["glass", "plain", "flat"] as const).map((surface) => markup(underRefined(<Panel surface={surface}>x</Panel>))).join("");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/rgba?\(/);
  });

  it("UI-P85: plain is the module too, at the card radius; flat keeps its workspace token", () => {
    const plain = markup(underRefined(<Panel>x</Panel>));
    expect(plain).toContain("background:var(--module)");
    expect(plain).toContain("border-radius:var(--r-card)");
    const flat = markup(underRefined(<Panel surface="flat">x</Panel>));
    expect(flat).toContain("background:var(--flat)");
    expect(flat).toContain("border-radius:var(--r-card)");
  });

  it("UI-P85: the module's own padding is 16, and a caller's padding wins", () => {
    expect(markup(underRefined(<Panel surface="glass">x</Panel>))).toContain("padding:16px");
    expect(markup(underRefined(<Panel surface="glass" padding="12px 13px">x</Panel>))).toContain("padding:12px 13px");
    expect(markup(underRefined(<Panel surface="glass" padding="0">x</Panel>))).toContain("padding:0");
  });

  it("does not warn about nested glass, because there is none to nest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        underRefined(
          <Panel surface="glass">
            <Panel surface="glass">nested</Panel>
          </Panel>,
        ),
      );
      // The router logs its own future-flag warnings through the same channel; only the panel's is in question.
      expect(warn.mock.calls.filter(([message]) => String(message).includes("liquid-glass"))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("PanelHead", () => {

  it("omits the subtitle and the right slot when there are none", () => {
    const html = markup(<PanelHead title="T" />);
    expect(html).not.toContain("font-size:12px");
    expect(html).not.toContain("gap:6px");
  });

  it("can be a real heading", () => {
    render(<PanelHead title="Rebuilds" headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2, name: "Rebuilds" })).toBeTruthy();
  });
});

describe("WallLabel", () => {
  it.each([2, 3, 4] as const)("is a %i-column grid of 1px hairlines at radius 12", (columns) => {
    const html = markup(<WallLabel columns={columns} cells={[<span key="a">a</span>]} />);
    expect(html).toContain(`grid-template-columns:repeat(${columns}, minmax(0, 1fr))`);
    expect(html).toContain("gap:1px");
    expect(html).toContain("background:var(--hairline)");
    expect(html).toContain("border-radius:var(--r-control)");
    expect(html).toContain("overflow:hidden");
  });

  it("wraps each cell on --cell, padding 9px 10px, a column with gap 5", () => {
    // UI-P52 density pass: 12px 14px → 9px 10px, 7 → 5.
    const html = markup(<WallLabel columns={2} cells={["a", "b"]} />);
    expect(html.match(/background:var\(--cell\);padding:9px 10px;display:flex;flex-direction:column;gap:5px/g)).toHaveLength(2);
  });
});

describe("Detail", () => {

  it("takes a colour for the value", () => {
    expect(markup(<Detail label="L" value="V" color="var(--evidence)" />)).toContain("color:var(--evidence)");
  });
});

describe("StripedBar", () => {

  it("is a named progressbar with its value, min and max", () => {
    render(<StripedBar value={42} colour="var(--lit)" label="XP to level 5" valueText="42 of 100 XP" />);
    const bar = screen.getByRole("progressbar", { name: "XP to level 5" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuetext")).toBe("42 of 100 XP");
  });

  it("does not animate", () => {
    expect(markup(<StripedBar value={50} colour="var(--lit)" label="x" />)).not.toMatch(/transition|animation|transform/);
  });
});

describe("PageHeading", () => {

  it("renders the title as the page's h1", () => {
    render(<PageHeading eyebrow="Gallery" title="Builds worth running" size={34} />);
    expect(screen.getByRole("heading", { level: 1, name: "Builds worth running" })).toBeTruthy();
  });

  it.each([30, 32, 34, 36])("sets a %ipx mobile title at -0.035em", (size) => {
    expect(markup(<PageHeading eyebrow="E" title="T" size={size} />)).toContain("letter-spacing:-0.035em");
  });

  it("has no padding of its own inside a panel, and takes the page's own sizes", () => {
    const html = markup(<PageHeading eyebrow="E" title="T" size={50} variant="in-panel" />);
    expect(html).not.toContain("padding");
    // UI-P52 density pass: drawn at 50, rendered at 38, with the 44–51 band's tracking.
    expect(html).toContain("font-size:38px");
    expect(html).toContain("letter-spacing:-0.035em");
    expect(markup(<PageHeading eyebrow="E" title="T" size={52} variant="in-panel" />)).toContain("letter-spacing:-0.04em");
  });

  it("omits the sub when there is none", () => {
    expect(markup(<PageHeading eyebrow="E" title="T" size={34} />)).not.toContain("line-height:1.5");
  });
});

describe("refined layers and data marks (UI-P85)", () => {
  const refined = (node: React.ReactElement) => markup(underRefined(node));

  it("Panel is the module for glass and plain alike, 16 padding unless a caller sets one", () => {
    for (const surface of ["glass", "plain"] as const) {
      const html = refined(<Panel surface={surface}>x</Panel>);
      expect(html).toContain("background:var(--module)");
      expect(html).toContain("border:1px solid var(--module-border)");
      expect(html).toContain("border-radius:var(--r-card)");
      expect(html).toContain("box-shadow:var(--module-shadow)");
      expect(html).toContain("padding:16px");
      expect(html).not.toContain("bg-glass");
    }
    expect(refined(<Panel padding="8px 12px">x</Panel>)).toContain("padding:8px 12px");
  });

  it("Tile and Well are the recipes, and the well takes the dot grid for maps and media", () => {
    const tile = refined(<Tile>x</Tile>);
    expect(tile).toContain("background:var(--tile)");
    expect(tile).toContain("border:1px solid var(--tile-border)");
    expect(tile).toContain("padding:12px");
    const well = refined(<Well dots>x</Well>);
    expect(well).toContain("background:var(--well)");
    expect(well).toContain("box-shadow:var(--well-shadow)");
    expect(well).toContain("radial-gradient(var(--dot-grid) 1px, transparent 1px)");
    expect(well).toContain("background-size:16px 16px");
    expect(refined(<Well>x</Well>)).not.toContain("radial-gradient");
  });

  it("CardHead is 13.5/500 over a 12 --text2 subtitle, with an action at the right; PanelHead renders it", () => {
    const html = refined(<CardHead title="Title" subtitle="Sub" action={<a href="/x">go</a>} />);
    expect(html).toContain("font-size:13.5px");
    expect(html).toContain("font-weight:500");
    expect(html).toContain("font-size:12px");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("gap:4px");
    expect(html).toContain('href="/x"');
    expect(refined(<PanelHead title="T" />)).toContain('data-ui="card-head"');
  });

  it("Row is hairline-separated with the label left and a tabular value right; inModule uses the module hairline", () => {
    const html = refined(<Row label="Reproductions" value="41" height={48} />);
    expect(html).toContain("min-height:48px");
    expect(html).toContain("gap:12px");
    expect(html).toContain("border-bottom:1px solid var(--hairline)");
    expect(html).toContain("font-variant-numeric:tabular-nums");
    expect(refined(<Row label="a" value="b" inModule />)).toContain("var(--hairline-module)");
  });

  it("Figure prints the value and its unit, and the lamp bar only when asked", () => {
    const html = refined(<Figure label="Streak" lamp value="12" unit="days" />);
    expect(html).toContain("12");
    expect(html).toContain("days");
    expect(html).toContain("gap:6px");
    expect(html).toContain("height:3px");
    expect(refined(<Figure value="12" />)).not.toContain("height:3px");
  });

  it("StripedBar is flat: 6 high (4 when asked for 8 or less), a 2px gap, no stripes, and ticks that carry a label", () => {
    const html = refined(
      <StripedBar value={86} colour="var(--evidence)" height={12} label="Completeness" ticks={[{ at: 60, colour: "var(--text)", label: "Publish 60" }]} />,
    );
    expect(html).not.toContain("repeating-linear-gradient");
    expect(html).toContain("height:6px");
    expect(html).toContain("gap:2px");
    expect(html).toContain("background:var(--evidence)");
    expect(html).toContain("background:var(--bar-base)");
    expect(html).toContain("width:1px");
    expect(html).toContain("background:var(--label)");
    expect(html).toContain("Publish 60");
    expect(html).toContain('role="progressbar"');
    expect(refined(<StripedBar value={10} colour="var(--lit)" height={8} label="x" />)).toContain("height:4px");
  });

  it("Stat sets its number in the figure role with the unit in 12 --text2", () => {
    const html = refined(<Stat label="In the gallery" value="1,284" of="2,000" />);
    expect(html).toContain("font-size:var(--type-figure-size");
    expect(html).toContain("/ 2,000");
  });
});

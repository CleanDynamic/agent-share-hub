// UI-P09, UI-P09b — panel, panel head, wall label, detail, stat, striped bar, page heading.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values);
// roles and structure on the rendered tree.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Detail } from "./Detail";
import { PageHeading } from "./PageHeading";
import { Panel, PanelHead } from "./Panel";
import { Stat } from "./Stat";
import { StripedBar } from "./StripedBar";
import { WallLabel } from "./WallLabel";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("Panel", () => {
  it("is plain by default: --glass over a --glass-border hairline, radius 16, the card shadow and the top highlight", () => {
    const html = markup(<Panel>x</Panel>);
    expect(html).toContain('data-surface="plain"');
    expect(html).not.toContain("bg-glass");
    expect(html).toContain("background:var(--glass)");
    expect(html).toContain("border:1px solid var(--glass-border)");
    expect(html).toContain("border-radius:var(--r-panel)");
    expect(html).toContain("box-shadow:var(--shadow-card), var(--panel-highlight)");
    expect(html).toContain("overflow:hidden");
    expect(html).toContain("padding:16px 18px");
  });

  it("is liquid glass when asked: the .bg-glass class, the halo before the card shadow, and no fill or border of its own", () => {
    const html = markup(<Panel surface="glass">x</Panel>);
    expect(html).toContain('data-surface="glass"');
    expect(html).toContain('class="bg-glass"');
    expect(html).toContain("box-shadow:var(--glass-halo), var(--shadow-card)");
    expect(html).toContain("background:none");
    expect(html).toContain("border:none");
    expect(html).not.toContain("var(--glass)");
    expect(html).not.toContain("var(--panel-highlight)");
    expect(html).toContain("border-radius:var(--r-panel)");
    expect(html).toContain("padding:16px 18px");
  });

  it("is flat for the workspace: --flat, the same hairline, no shadow", () => {
    const html = markup(<Panel surface="flat">x</Panel>);
    expect(html).toContain('data-surface="flat"');
    expect(html).not.toContain("bg-glass");
    expect(html).toContain("background:var(--flat)");
    expect(html).toContain("border:1px solid var(--glass-border)");
    expect(html).toContain("box-shadow:none");
    expect(html).not.toContain("var(--glass)");
  });

  it("takes a padding, for lists", () => {
    expect(markup(<Panel padding="14px 16px">x</Panel>)).toContain("padding:14px 16px");
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

  it("warns in development when liquid glass is nested inside liquid glass, and not otherwise", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      render(
        <Panel surface="glass">
          <Panel surface="plain">fine</Panel>
        </Panel>,
      );
      expect(warn).not.toHaveBeenCalled();
      render(
        <Panel surface="glass">
          <Panel surface="glass">nested</Panel>
        </Panel>,
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain("nested inside another liquid-glass panel");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("PanelHead", () => {
  it("stacks a 16px title and a 12px subtitle 3px apart, and aligns the right slot to the top", () => {
    const html = markup(<PanelHead title="Glass panel" subtitle="reading surfaces" right={<button>go</button>} />);
    expect(html).toContain("justify-content:space-between;align-items:flex-start;gap:12px");
    expect(html).toContain("flex-direction:column;gap:3px");
    expect(html).toContain("font-size:16px");
    expect(html).toContain("font-weight:600");
    expect(html).toContain("color:var(--text)");
    expect(html).toContain("font-size:12px");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("display:flex;gap:6px;align-items:center");
  });

  it("sets a smaller title where the reference is smaller", () => {
    expect(markup(<PanelHead title="T" titleSize={13} />)).toContain("font-size:13px");
  });

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

  it("wraps each cell on --cell, padding 12px 14px, a column with gap 7", () => {
    const html = markup(<WallLabel columns={2} cells={["a", "b"]} />);
    expect(html.match(/background:var\(--cell\);padding:12px 14px;display:flex;flex-direction:column;gap:7px/g)).toHaveLength(2);
  });
});

describe("Detail", () => {
  it("is a 10px eyebrow over a DM Mono value drawn at 14px, on one line, clipped with an ellipsis", () => {
    // UI-P52 density pass: mono() renders the drawn 14 at 13; the 10px eyebrow is kept.
    const html = markup(<Detail label="Made for" value="finance ops" />);
    expect(html).toContain("display:contents");
    expect(html).toContain("font-size:10px");
    expect(html).toContain("font-size:13px");
    expect(html).toContain("color:var(--text)");
    expect(html).toContain("white-space:nowrap");
    expect(html).toContain("text-overflow:ellipsis");
    expect(html).toContain("overflow:hidden");
  });

  it("takes a colour for the value", () => {
    expect(markup(<Detail label="L" value="V" color="var(--evidence)" />)).toContain("color:var(--evidence)");
  });
});

describe("Stat", () => {
  it("is an eyebrow, then a baseline row with the value in DM Mono drawn at 22px, at -0.02em", () => {
    // UI-P52 density pass: mono() renders the drawn 22 at 19 and keeps its -0.02em.
    const html = markup(<Stat label="In the gallery" value="1,284" />);
    expect(html).toContain("display:flex;align-items:baseline");
    expect(html).toContain("font-size:19px");
    expect(html).toContain("letter-spacing:-0.02em");
    expect(html).toContain("color:var(--text)");
    expect(html).not.toContain("striped-bar");
  });

  it("adds '/ of' in 12px --text2 when asked", () => {
    const html = markup(<Stat label="L" value="3" of="5" />);
    expect(html).toContain("font-size:12px");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("\u00a0/ 5");
  });

  it("adds a 10px striped bar when given one", () => {
    const html = markup(<Stat label="L" value="3" bar={{ value: 60, colour: "var(--lit)", label: "L" }} />);
    expect(html).toContain('data-ui="striped-bar"');
    expect(html).toContain("height:10px");
  });
});

describe("StripedBar", () => {
  it("is a full-width flex row of the given height, 12 by default", () => {
    const html = markup(<StripedBar value={50} colour="var(--lit)" label="Progress" />);
    expect(html).toContain("position:relative;display:flex;height:12px;width:100%");
    expect(markup(<StripedBar value={50} colour="var(--lit)" label="P" height={9} />)).toContain("height:9px");
  });

  it("fills value% with the colour's stripes, and the rest with --bar-base stripes", () => {
    const html = markup(<StripedBar value={78} colour="var(--evidence)" label="Fresh" />);
    expect(html).toContain("width:78%");
    expect(html).toContain("background:repeating-linear-gradient(-60deg, var(--evidence) 0 2.5px, transparent 2.5px 6px)");
    expect(html).toContain("flex-grow:1");
    expect(html).toContain("background:repeating-linear-gradient(-60deg, var(--bar-base) 0 2.5px, transparent 2.5px 6px)");
  });

  it("places each tick at its own position, 4px proud, 1.5px wide", () => {
    const html = markup(
      <StripedBar
        value={86}
        colour="var(--lit)"
        label="Completeness"
        ticks={[
          { at: 60, colour: "var(--text2)" },
          { at: 80, colour: "var(--text)" },
        ]}
      />,
    );
    expect(html).toContain("left:60%;top:-4px;bottom:-4px;width:1.5px;background:var(--text2)");
    expect(html).toContain("left:80%;top:-4px;bottom:-4px;width:1.5px;background:var(--text)");
  });

  it("is a named progressbar with its value, min and max", () => {
    render(<StripedBar value={42} colour="var(--lit)" label="XP to level 5" valueText="42 of 100 XP" />);
    const bar = screen.getByRole("progressbar", { name: "XP to level 5" });
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuetext")).toBe("42 of 100 XP");
  });

  it("clamps the fill to 0 to 100, and treats a non-number as nothing", () => {
    expect(markup(<StripedBar value={140} colour="var(--lit)" label="x" />)).toContain("width:100%");
    expect(markup(<StripedBar value={-5} colour="var(--lit)" label="x" />)).toContain("width:0%");
    expect(markup(<StripedBar value={Number.NaN} colour="var(--lit)" label="x" />)).toContain("width:0%");
  });

  it("does not animate", () => {
    expect(markup(<StripedBar value={50} colour="var(--lit)" label="x" />)).not.toMatch(/transition|animation|transform/);
  });
});

describe("PageHeading", () => {
  it("is a column of eyebrow, h1 and sub with the bare padding, on a phone", () => {
    const html = markup(<PageHeading eyebrow="Gallery" title="Builds worth running" sub="Ordered by proof." size={36} />);
    expect(html).toContain('data-ui="page-heading"');
    expect(html).toContain("flex-direction:column;gap:8px;padding:4px 2px");
    expect(html).toContain("font-size:11px");
    // UI-P52 density pass: the title is drawn at 36 and display() renders it at 27.
    expect(html).toContain("font-size:27px");
    expect(html).toContain("letter-spacing:-0.035em");
    expect(html).toContain("line-height:1");
    expect(html).toContain("color:var(--text)");
    expect(html).toContain("font-size:14px;line-height:1.5;color:var(--text2)");
  });

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

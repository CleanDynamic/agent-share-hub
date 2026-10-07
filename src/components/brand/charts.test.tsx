// UI-P12 — line, step, histogram and spark charts, the activity grid, the
// timeline and the rank rungs.
//
// Geometry is asserted on SSR markup (jsdom's cssstyle drops var() values) and
// on the rendered tree.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActivityGrid, activityLevels, type ActivityDay } from "./ActivityGrid";
import { Histogram, LineChart, Sparkline, StepChart } from "./charts";
import { MarkTile, RankRung } from "./RankRung";
import { Timeline } from "./Timeline";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("LineChart", () => {
  const values = Array.from({ length: 64 }, (_, i) => i / 63);
  const html = markup(<LineChart width={360} height={120} values={values} markerIndex={23} />);

  it("draws five gridlines at sixths, in --hairline, down to 10px above the bottom", () => {
    for (const x of ["60.0", "120.0", "180.0", "240.0", "300.0"]) {
      expect(html).toContain(`<line x1="${x}" y1="0" x2="${x}" y2="110" stroke="var(--hairline)"></line>`);
    }
  });

  it("draws 101 ticks, every fifth 10px tall and the rest 6px, in --line", () => {
    const ticks: string[] = html.match(/<line [^>]*stroke="var\(--line\)"><\/line>/g) ?? [];
    expect(ticks).toHaveLength(101);
    expect(ticks.filter((t) => t.includes('y1="110"'))).toHaveLength(21);
    expect(ticks.filter((t) => t.includes('y1="114"'))).toHaveLength(80);
    expect(ticks[0]).toContain('x1="0.0"');
    expect(ticks[1]).toContain('x1="3.6"');
  });

  it("splits the series at the marker: --label before at .7, --evidence after, with the point shared", () => {
    expect(html).toMatch(/stroke="var\(--label\)" stroke-width="1.5" opacity="0.7"/);
    expect(html).toMatch(/stroke="var\(--evidence\)" stroke-width="1.8"/);
    const [before, after] = (html.match(/<polyline points="([^"]+)"/g) ?? []).map((p) => p.slice(18, -1).split(" "));
    expect(before).toHaveLength(24);
    expect(after).toHaveLength(41);
    expect(before.at(-1)).toBe(after[0]);
    expect(before[0].startsWith("0.0,")).toBe(true);
    expect(after.at(-1)!.startsWith("360.0,")).toBe(true);
  });

  it("maps values into 14px from the bottom to 8px from the top", () => {
    const flat = markup(<LineChart width={360} height={120} values={[0, 1]} markerIndex={0} />);
    expect(flat).toContain("0.0,106.0");
    expect(flat).toContain("360.0,8.0");
  });

  it("puts the dashed --text marker at the marker point, 1.4px", () => {
    expect(html).toContain('x1="131.4" y1="0" x2="131.4" y2="120" stroke="var(--text)" stroke-width="1.4" stroke-dasharray="3 3"');
  });

  it("fills under the after-series with --evidence from .28 to 0", () => {
    expect(html).toContain('stop-color="var(--evidence)" stop-opacity=".28"');
    expect(html).toContain('stop-opacity="0"');
    expect(html).toMatch(/<path d="M131.4,110 L/);
  });

  it("draws no marker and no before-series when nothing changed in the window (UI-P35)", () => {
    const none = markup(<LineChart width={360} height={120} values={values} markerIndex={null} />);
    expect(none).not.toContain('stroke-dasharray="3 3"');
    expect(none).not.toMatch(/stroke="var\(--label\)"/);
    const polylines = none.match(/<polyline points="([^"]+)"/g) ?? [];
    expect(polylines).toHaveLength(1);
    expect(polylines[0].slice(18, -1).split(" ")).toHaveLength(64);
    expect(none).toMatch(/<path d="M0.0,110 L0.0,/);
  });

  it("is decorative unless named", () => {
    expect(html).toContain('aria-hidden="true"');
    expect(markup(<LineChart width={10} height={20} values={[0.5]} markerIndex={0} label="Runs" />)).toContain(
      'role="img" aria-label="Runs"',
    );
  });

  it("does not crash on an empty series, and gives each instance its own gradient id", () => {
    expect(() => markup(<LineChart width={360} height={120} values={[]} markerIndex={0} />)).not.toThrow();
    const { container } = render(
      <>
        <LineChart width={100} height={50} values={[0.1, 0.9]} markerIndex={0} />
        <LineChart width={100} height={50} values={[0.1, 0.9]} markerIndex={0} />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient")].map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("StepChart", () => {
  const points = [
    { at: 0, value: 0.18 },
    { at: 0.1, value: 0.42 },
    { at: 0.28, value: 0.6 },
    { at: 0.52, value: 0.66 },
    { at: 0.74, value: 0.82 },
  ];
  const html = markup(<StepChart width={360} height={90} points={points} />);

  it("draws six gridlines at sevenths", () => {
    expect((html.match(/stroke="var\(--hairline\)"/g) ?? []).length).toBe(6);
    expect(html).toContain('x1="51.4"');
    expect(html).toContain('x1="308.6"');
  });

  it("steps after: holds each level to the next point's x", () => {
    expect(html).toContain('d="M0 73.8 L36.0 73.8 L36.0 52.2 L100.8 52.2 L100.8 36.0 L187.2 36.0 L187.2 30.6 L266.4 30.6 L266.4 16.2 L360 16.2"');
    expect(html).toContain('stroke="var(--cat-agents)" stroke-width="1.6"');
  });

  it("fills to the bottom from .4 to .03", () => {
    expect(html).toContain('stop-opacity=".4"');
    expect(html).toContain('stop-opacity=".03"');
    expect(html).toContain('d="M0 90 L0 73.8');
    expect(html).toMatch(/L360 90 Z"/);
  });
});

describe("Sparkline", () => {
  it("is one 1.4px --evidence polyline, 60×20 by default", () => {
    const html = markup(<Sparkline values={[0, 0.5, 1]} />);
    expect(html).toContain('width="60" height="20"');
    expect(html).toContain('stroke="var(--evidence)" stroke-width="1.4"');
    expect((html.match(/<polyline/g) ?? []).length).toBe(1);
  });
});

describe("Histogram", () => {
  const html = markup(<Histogram width={300} height={120} values={[0.04, 0.5, 1, 0.5]} fromIndex={2} />);

  it("draws a bar per value at width/n, inset 2px each side, min 4px tall, on the bottom edge", () => {
    expect(html).toContain('<rect x="2.0" y="115.4" width="71.0" height="4.6"');
    expect(html).toContain('<rect x="152.0" y="6.0" width="71.0" height="114.0"');
    expect(markup(<Histogram width={100} height={50} values={[0]} fromIndex={1} />)).toContain('height="4.0"');
  });

  it("colours the bars before --bar-base and from fromIndex on salmon, in both themes", () => {
    expect(html).toContain('fill="var(--bar-base)"');
    expect(html.match(/fill="#E8A283"/g)).toHaveLength(2);
  });

  it("lays a violet band from fromIndex to the right edge, behind the bars", () => {
    expect(html).toContain('<rect x="150.0" y="0" width="150.0" height="120" fill="rgba(140,120,196,.14)"');
    expect(html.indexOf("rgba(140,120,196,.14)")).toBeLessThan(html.indexOf("var(--bar-base)"));
  });
});

describe("ActivityGrid", () => {
  const days = (counts: number[]): ActivityDay[] => counts.map((count) => ({ count }));

  it("fills seven rows down each column, in 12px cells at radius 4 with 3px gaps", () => {
    const html = markup(<ActivityGrid days={days(Array(15).fill(1))} />);
    expect(html).toContain("gap:3px");
    expect(html).toContain("width:12px;height:12px;border-radius:4px");
    expect((html.match(/flex-direction:column/g) ?? []).length).toBe(3);
    expect((html.match(/<span/g) ?? []).length).toBe(15);
  });

  it("is 327px wide at 22 weeks", () => {
    expect(22 * 12 + 21 * 3).toBe(327);
  });

  it("paints an empty day --bar-base, active days --lit at .3 / .55 / .8 / 1 by quartile, a frozen day hollow", () => {
    const counts = [1, 2, 3, 4, 0];
    const html = markup(
      <ActivityGrid days={[...days(counts), { count: 9, frozen: true }]} />,
    );
    expect(html).toContain("background-color:var(--bar-base)");
    for (const o of ["0.3", "0.55", "0.8", "1"]) expect(html).toContain(`opacity:${o}`);
    expect(html).toContain("border:1.5px solid var(--evidence)");
  });

  it("ranks by quartile among the active days, not by absolute volume", () => {
    expect(activityLevels(days([1, 2, 3, 4]))).toEqual([1, 2, 3, 4]);
    expect(activityLevels(days([10, 20, 30, 40]))).toEqual([1, 2, 3, 4]);
    expect(activityLevels(days([5, 5, 5, 5]))).toEqual([1, 1, 1, 1]);
    expect(activityLevels([{ count: 0 }, { count: 3, frozen: true }])).toEqual([0, 0]);
  });

  it("is named for assistive tech", () => {
    render(<ActivityGrid days={days([1, 0, 2])} />);
    expect(screen.getByRole("img", { name: "Activity: 2 active days in the last 3" })).toBeTruthy();
  });
});

describe("Timeline", () => {
  const events = [
    { kind: "prompt", at: "00:00", text: "Wrote the outcome" },
    { kind: "milestone", at: "04:12", text: "First routed invoice" },
    { kind: "breakage", at: "11:40", text: "Failed on euro totals" },
    { kind: "note", at: "15:02", text: "Tolerance should be a setting" },
    { kind: "deploy", at: "26:30", text: "Running on the shared inbox" },
  ] as const;
  const html = markup(<Timeline events={events} />);

  it("draws the rail 5px in, from 6px down to 16px up, in --line", () => {
    expect(html).toContain("left:5px;top:6px;bottom:16px;width:1px;background:var(--line)");
  });

  it("lays each item on a 16 / 44 / 1fr grid, 10px below", () => {
    // UI-P52 density pass: 14 → 10 below each item; the tracks are not in the table.
    expect(html).toContain("grid-template-columns:16px 44px minmax(0, 1fr)");
    expect(html).toContain("padding-bottom:10px");
    expect((html.match(/<li/g) ?? []).length).toBe(5);
  });

  it("colours each kind's dot, and the kind's name in the same colour — deploy's name in --lit-ink", () => {
    const dot = (c: string) => `width:11px;height:11px;border-radius:50%;background-color:var(--${c})`;
    for (const c of ["cat-instruction", "evidence", "cat-breakage", "label", "lit"]) expect(html).toContain(dot(c));
    expect(html).toContain("color:var(--lit-ink)");
    expect(html).toContain("text-transform:uppercase");
  });

  it("does not glow on Noon", () => {
    expect(html).not.toContain("box-shadow");
  });

  it("is a named list", () => {
    render(<Timeline events={events} />);
    expect(screen.getByRole("list", { name: "Events" }).children).toHaveLength(5);
    expect(screen.getByText("Failed on euro totals")).toBeTruthy();
  });
});

describe("RankRung and MarkTile", () => {
  it("is weight and fill: lamp, recess, outline, nothing", () => {
    const at = (tier: "highest" | "rare" | "common" | "none") => markup(<RankRung rank={1} tier={tier} />);
    expect(at("highest")).toContain("background-color:var(--lit);color:var(--on-lit)");
    expect(at("rare")).toContain("background-color:var(--recess);color:var(--text)");
    expect(at("common")).toContain("border:1.5px solid var(--line);color:var(--text)");
    expect(at("none")).toContain("color:var(--label)");
    expect(at("none")).not.toContain("background");
  });

  it("steps radius and rank type with the size: 9 / 10 / 12 and 17 / 18 / 22 drawn", () => {
    const at = (size: 28 | 32 | 40) => markup(<RankRung rank={3} tier="rare" size={size} />);
    // UI-P52 density pass: a rung is a square, so its side goes 28 / 32 / 40 → 23 / 26 / 33.
    expect(at(28)).toContain("width:23px;height:23px;border-radius:9px");
    expect(at(32)).toContain("border-radius:10px");
    expect(at(40)).toContain("border-radius:12px");
    // UI-P52 density pass: the rank type is drawn at 17 / 18 / 22 and display()
    // renders it at 16 / 15 / 19 — under 20px, in Figtree 600.
    expect(at(28)).toContain("font-size:16px");
    expect(at(32)).toContain("font-size:15px");
    expect(at(40)).toContain("font-size:19px");
  });

  it("draws the creator mark at 38×38, radius 13, with a 20px trophy, glowing only when highest", () => {
    // UI-P52 density pass: the square 46 → 38; the radius and the icon are not in the table.
    const highest = markup(<MarkTile tier="highest" caption="First hang" />);
    expect(highest).toContain("width:38px;height:38px;border-radius:13px");
    expect(highest).toContain('width="20"');
    expect(highest).toContain("box-shadow:var(--rank-glow)");
    expect(highest).toContain("First hang");
    expect(markup(<MarkTile tier="rare" caption="x" />)).not.toContain("box-shadow");
  });
});

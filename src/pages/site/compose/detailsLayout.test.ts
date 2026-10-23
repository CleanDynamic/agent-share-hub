// CA-18 P4: the composer's widths from the window alone, and Details sized by its content.

import { describe, expect, it } from "vitest";

import { COLUMN_GAP, COLUMN_MAX, COLUMN_MIN, DETAILS_GAP, SEPARATION, frameOf, innerWidthOf, layoutDetails, type Measured } from "./detailsLayout";

/** Pieces whose height does not depend on the width. */
const flat = (heights: number[], over: Partial<Measured> = {}): Measured => ({ head: 56, foot: 0, sections: heights.map((height, at) => ({ key: `s${at}`, height })), ...over });
/** Pieces that get shorter as the column gets wider (text wraps): height * 300 / width. */
const wraps = (base: number[], over: Partial<Measured> = {}) => (width: number): Measured => ({ head: 56, foot: 0, sections: base.map((height, at) => ({ key: `s${at}`, height: Math.round((height * 300) / width) })), ...over });

describe("Build is centred on the window and Details takes the room to its right", () => {
  // Window, Build, Build's left edge, Sources (width), Details' room.
  it.each([
    [900, 560, 170, 52, 140],
    [1200, 560, 320, 216, 240],
    [1280, 560, 360, 216, 280],
    [1440, 640, 400, 216, 320],
    [1920, 760, 580, 216, 500],
    [2560, 760, 900, 216, 820],
  ])("at %i: Build %i from %i, Sources %i, room %i", (window, build, left, sources, room) => {
    const frame = frameOf(innerWidthOf(window));
    expect(frame.build).toBe(build);
    expect(frame.buildLeft).toBe(left);
    expect(frame.sources).toBe(sources);
    if (window >= 1200) expect(frame.room).toBe(room);
    expect(frame.beside).toBe(window >= 1280);
  });

  it("keeps Build's centre within 1px of the window's centre from 768 to 2560", () => {
    for (let window = 768; window <= 2560; window += 16) {
      const frame = frameOf(innerWidthOf(window));
      expect(Math.abs(frame.buildLeft + frame.build / 2 - window / 2), String(window)).toBeLessThanOrEqual(1);
    }
  });

  it("puts Sources' right edge 40 from Build (24 for the rail) and Details 40 right of Build", () => {
    for (let window = 768; window <= 2560; window += 16) {
      const frame = frameOf(innerWidthOf(window));
      expect(frame.sourcesLeft + frame.sources + frame.sourcesGap, String(window)).toBe(frame.buildLeft);
      expect(frame.sourcesGap).toBe(frame.rail ? 24 : 40);
      expect(frame.detailsLeft - (frame.buildLeft + frame.build)).toBe(DETAILS_GAP);
      expect(DETAILS_GAP).toBe(40);
      // Sources never comes closer than 40 to the window's edge, and Details never closer than 40 on the right.
      expect(frame.sourcesLeft).toBeGreaterThanOrEqual(40);
      expect(window - (frame.detailsLeft + frame.room)).toBe(40);
    }
  });

  it("folds Sources to its rail under 1152 and not from 1152", () => {
    expect(frameOf(innerWidthOf(1136))).toMatchObject({ rail: true, sources: 52, sourcesGap: 24 });
    expect(frameOf(innerWidthOf(1151))).toMatchObject({ rail: true });
    expect(frameOf(innerWidthOf(1152))).toMatchObject({ rail: false, sources: 216, sourcesGap: 40 });
    expect(frameOf(innerWidthOf(1152)).sourcesLeft).toBe(40);
  });

  it("narrows Build below 560 only between 768 and 792", () => {
    expect(frameOf(innerWidthOf(768)).build).toBe(536);
    expect(frameOf(innerWidthOf(792)).build).toBe(560);
    expect(frameOf(innerWidthOf(800)).build).toBe(560);
    expect(frameOf(innerWidthOf(768)).sourcesLeft).toBe(40);
  });

  it("hides Details under 1280 and shows it from 1280", () => {
    for (let window = 768; window < 1280; window += 16) expect(frameOf(innerWidthOf(window)).beside, String(window)).toBe(false);
    for (let window = 1280; window <= 2560; window += 16) expect(frameOf(innerWidthOf(window)).beside, String(window)).toBe(true);
  });

  it("is hidden whenever its room is under 280", () => {
    for (let window = 700; window <= 1300; window += 10) {
      const frame = frameOf(innerWidthOf(window));
      expect(frame.beside, String(window)).toBe(frame.room >= 280);
    }
  });

  it("never depends on the selection: the same window gives the same Build whatever Details holds", () => {
    const inner = innerWidthOf(1440);
    const a = layoutDetails({ inner, height: 800, measure: () => flat([100]) });
    const b = layoutDetails({ inner, height: 800, measure: () => flat([300, 400, 500, 600, 700]) });
    const c = layoutDetails({ inner, height: 200, measure: () => flat([900, 900]) });
    expect([a.build, b.build, c.build]).toEqual([640, 640, 640]);
    expect([a.buildLeft, b.buildLeft, c.buildLeft]).toEqual([400, 400, 400]);
    expect([a.sources, b.sources, c.sources]).toEqual([216, 216, 216]);
  });
});

describe("Details is as narrow as its content allows", () => {
  const inner = innerWidthOf(1920);

  it("gives a short tile 280", () => {
    const layout = layoutDetails({ inner, height: 800, measure: () => flat([120, 90]) });
    expect(layout).toMatchObject({ beside: true, width: 280, columns: 1, scrolls: false });
    expect(layout.assignment).toEqual([["head", "s0", "s1"]]);
  });

  it("gives a long prompt a wider single column, as the text wraps less", () => {
    // 3 sections of 600 at 300; each 1/(w/300) as wide; the height is 1000: it fits once w >= 300 * (1800 + 112) / 1000 ...
    const measure = wraps([600, 600, 600]);
    const layout = layoutDetails({ inner, height: 1300, measure });
    expect(layout.columns).toBe(1);
    expect(layout.width).toBeGreaterThan(280);
    expect((layout.width - 280) % 20).toBe(0);
    const tight = layout.width - 20;
    const m = measure(tight);
    expect(56 + m.sections.reduce((n, s) => n + s.height, 0) + 2 * SEPARATION).toBeGreaterThan(1300);
    expect(layout.scrolls).toBe(false);
  });

  it("goes to two columns when no single column of 520 or less will hold it", () => {
    const layout = layoutDetails({ inner: innerWidthOf(2560), height: 500, measure: wraps([250, 250, 250]) });
    expect(layout.columns).toBe(2);
    expect(layout.columnWidth).toBeGreaterThanOrEqual(COLUMN_MIN);
    expect(layout.columnWidth).toBeLessThanOrEqual(COLUMN_MAX);
    expect(layout.width).toBe(2 * layout.columnWidth + COLUMN_GAP);
    expect(layout.scrolls).toBe(false);
  });

  it("fills the first column down in order, then the next, and never splits a section", () => {
    const layout = layoutDetails({ inner: innerWidthOf(2560), height: 520, measure: () => flat([200, 200, 200, 200]) });
    expect(layout.columns).toBeGreaterThanOrEqual(2);
    expect(layout.assignment.flat()).toEqual(["head", "s0", "s1", "s2", "s3"]);
    for (const column of layout.assignment) {
      const used = column.reduce((n, key, at) => n + (key === "head" ? 56 : 200 + (at > 0 && column[at - 1] !== "head" ? SEPARATION : 0)), 0);
      expect(used).toBeLessThanOrEqual(520);
    }
  });

  it("uses three columns when two will not do and the room has them", () => {
    const layout = layoutDetails({ inner: innerWidthOf(3300), height: 480, measure: () => flat([200, 200, 200, 200]) });
    expect(layout.columns).toBeGreaterThanOrEqual(3);
    expect(layout.scrolls).toBe(false);
  });

  it("scrolls when the room runs out", () => {
    const small = layoutDetails({ inner: innerWidthOf(1440), height: 300, measure: () => flat([400, 400, 400]) });
    expect(small.beside).toBe(true);
    expect(small.scrolls).toBe(true);
    const wide = layoutDetails({ inner: innerWidthOf(2560), height: 300, measure: () => flat([290, 290, 290, 290, 290, 290, 290, 290, 290, 290]) });
    expect(wide.scrolls).toBe(true);
    expect(wide.columns).toBeGreaterThan(1);
  });

  it("cuts one long prose section to fit, for Read all", () => {
    const measure = (): Measured => ({ head: 56, foot: 0, sections: [{ key: "prompt", height: 4000, prose: true }, { key: "uses", height: 120 }] });
    const layout = layoutDetails({ inner, height: 700, measure });
    expect(layout.cut.prompt).toBeGreaterThanOrEqual(120);
    expect(layout.cut.prompt).toBeLessThan(700);
    expect(layout.cut.uses).toBeUndefined();
  });

  it("is not laid out at all when Details is not beside the build", () => {
    const layout = layoutDetails({ inner: innerWidthOf(1100), height: 800, measure: () => flat([100]) });
    expect(layout).toMatchObject({ beside: false, width: 0, columns: 0, assignment: [] });
  });

  it("keeps the foot with the last section", () => {
    const layout = layoutDetails({ inner, height: 800, measure: () => flat([100, 100], { foot: 40 }) });
    expect(layout.assignment.flat().at(-1)).toBe("foot");
  });

  it("measures only the widths it needs, once each", () => {
    const widths: number[] = [];
    layoutDetails({ inner, height: 600, measure: (width) => { widths.push(width); return wraps([450, 450])(width); } });
    expect(new Set(widths).size).toBe(widths.length);
  });
});

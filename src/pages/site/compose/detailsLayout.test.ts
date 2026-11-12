// CA-18 P4: the composer's widths from the window alone, and Details sized by its content. Editor fixes F62, S34, S35, F70, F75.

import { describe, expect, it } from "vitest";

import { DETAILS_GAP, SEPARATION, frameOf, innerWidthOf, layoutDetails, type Measured } from "./detailsLayout";

/** Pieces whose height does not depend on the width. */
const flat = (heights: number[], over: Partial<Measured> = {}): Measured => ({ head: 56, foot: 0, sections: heights.map((height, at) => ({ key: `s${at}`, height })), ...over });
/** Pieces that get shorter as the column gets wider (text wraps): height * 300 / width. */
const wraps = (base: number[], over: Partial<Measured> = {}) => (width: number): Measured => ({ head: 56, foot: 0, sections: base.map((height, at) => ({ key: `s${at}`, height: Math.round((height * 300) / width) })), ...over });

describe("Sources 256, Details 360, Build takes the rest up to 760 (F62, S34, S35, F75)", () => {
  // Window, Build, Build's left edge, Sources (width), Details' room.
  it.each([
    [900, 744, 116, 52, 152],
    [1200, 760, 364, 256, 240],
    [1280, 560, 328, 256, 320],
    [1440, 680, 328, 256, 480],
    [1920, 760, 528, 256, 960],
    [2560, 760, 848, 256, 1600],
  ])("at %i: Build %i from %i, Sources %i, room %i", (window, build, left, sources, room) => {
    const frame = frameOf(innerWidthOf(window));
    expect(frame.build).toBe(build);
    expect(frame.buildLeft).toBe(left);
    expect(frame.sources).toBe(sources);
    expect(frame.room).toBe(room);
    expect(frame.beside).toBe(window >= 1240);
  });

  it("gives Details 360 from 1400 up, and Sources 256 beside it", () => {
    for (let window = 1400; window <= 2560; window += 16) {
      const frame = frameOf(innerWidthOf(window));
      expect(frame.detailsWidth, String(window)).toBe(360);
      expect(frame.sources).toBe(256);
    }
  });

  it("fills the inner width until Build is 760, then centres the box in the window", () => {
    for (let window = 768; window <= 2560; window += 16) {
      const frame = frameOf(innerWidthOf(window));
      if (frame.build < 760) {
        expect(frame.boxLeft, String(window)).toBe(40);
        expect(frame.boxRight, String(window)).toBe(window - 40);
      } else {
        expect(Math.abs((frame.boxLeft + frame.boxRight) / 2 - window / 2), String(window)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("puts Sources' right edge 32 from Build (24 for the rail) and Details 32 right of Build", () => {
    for (let window = 768; window <= 2560; window += 16) {
      const frame = frameOf(innerWidthOf(window));
      expect(frame.sourcesLeft + frame.sources + frame.sourcesGap, String(window)).toBe(frame.buildLeft);
      expect(frame.sourcesGap).toBe(frame.rail ? 24 : 32);
      expect(frame.detailsLeft - (frame.buildLeft + frame.build)).toBe(DETAILS_GAP);
      expect(DETAILS_GAP).toBe(32);
      // Nothing comes closer than 40 to the window's edges.
      expect(frame.sourcesLeft).toBeGreaterThanOrEqual(40);
      expect(window - frame.boxRight).toBeGreaterThanOrEqual(40);
    }
  });

  it("folds Sources to its rail under 928 and not from 928", () => {
    expect(frameOf(innerWidthOf(912))).toMatchObject({ rail: true, sources: 52, sourcesGap: 24 });
    expect(frameOf(innerWidthOf(927))).toMatchObject({ rail: true });
    expect(frameOf(innerWidthOf(928))).toMatchObject({ rail: false, sources: 256, sourcesGap: 32 });
    expect(frameOf(innerWidthOf(928)).sourcesLeft).toBe(40);
  });

  it("lets Build take the rest beside the rail", () => {
    expect(frameOf(innerWidthOf(768)).build).toBe(612);
    expect(frameOf(innerWidthOf(768)).sourcesLeft).toBe(40);
  });

  it("hides Details under 1240 and shows it from 1240", () => {
    for (let window = 768; window < 1240; window += 16) expect(frameOf(innerWidthOf(window)).beside, String(window)).toBe(false);
    for (let window = 1240; window <= 2560; window += 16) expect(frameOf(innerWidthOf(window)).beside, String(window)).toBe(true);
  });

  it("is hidden whenever its room is under 280", () => {
    for (let window = 700; window <= 1300; window += 10) {
      const frame = frameOf(innerWidthOf(window));
      expect(frame.beside, String(window)).toBe(!frame.rail && frame.room >= 280);
    }
  });

  it("never depends on the selection: the same window gives the same Build whatever Details holds", () => {
    const inner = innerWidthOf(1440);
    const a = layoutDetails({ inner, height: 800, measure: () => flat([100]) });
    const b = layoutDetails({ inner, height: 800, measure: () => flat([300, 400, 500, 600, 700]) });
    const c = layoutDetails({ inner, height: 200, measure: () => flat([900, 900]) });
    expect([a.build, b.build, c.build]).toEqual([680, 680, 680]);
    expect([a.buildLeft, b.buildLeft, c.buildLeft]).toEqual([328, 328, 328]);
    expect([a.sources, b.sources, c.sources]).toEqual([256, 256, 256]);
  });
});

describe("Details collapsed (F62, decision D7)", () => {
  it("gives Build the room up to 760, keeps Sources and the box's edges, and is not beside", () => {
    const shown = frameOf(innerWidthOf(1440));
    const hidden = frameOf(innerWidthOf(1440), true);
    expect(hidden).toMatchObject({ beside: false, detailsWidth: 0, build: 760, buildLeft: shown.buildLeft, sourcesLeft: shown.sourcesLeft, boxLeft: shown.boxLeft, boxRight: shown.boxRight });
    expect(frameOf(innerWidthOf(1280), true).build).toBe(760);
  });

  it("changes nothing where Details is not beside anyway", () => {
    expect(frameOf(innerWidthOf(1100), true)).toEqual(frameOf(innerWidthOf(1100)));
  });
});

describe("the composer is one box (CA-18b P5)", () => {
  it.each([
    // window, boxLeft (Sources or the rail), boxRight (Details' right edge from 1240, where it is shown; Build's before)
    [1152, 52, 1100],
    [1280, 40, 1240],
    [1440, 40, 1400],
    [1920, 240, 1680],
    [2560, 560, 2000],
  ])("at %i the box runs %i to %i", (window, left, right) => {
    const frame = frameOf(innerWidthOf(window));
    expect(frame.boxLeft).toBe(left);
    expect(frame.boxRight).toBe(right);
  });

  it("ends at Build's right edge when Details is hidden, and begins at the rail's when Sources is folded", () => {
    const hidden = frameOf(innerWidthOf(1152));
    expect(hidden.beside).toBe(false);
    expect(hidden.boxRight).toBe(hidden.buildLeft + hidden.build);
    const rail = frameOf(innerWidthOf(900));
    expect(rail.rail).toBe(true);
    expect(rail.boxLeft).toBe(rail.buildLeft - 24 - 52);
  });

  it("gives Details one fixed width per window: min(room, 360), at least 280", () => {
    for (let window = 1240; window <= 3000; window += 16) {
      const frame = frameOf(innerWidthOf(window));
      expect(frame.detailsWidth, String(window)).toBe(Math.min(frame.room, 360));
      expect(frame.detailsWidth).toBeGreaterThanOrEqual(280);
      expect(frame.boxRight).toBe(frame.detailsLeft + frame.detailsWidth);
    }
  });

  it("keeps the right edge where it is whatever Details holds", () => {
    const inner = innerWidthOf(1920);
    const edges = [flat([100]), flat([900, 900, 900]), flat([5000], { foot: 40 })].map((m) => layoutDetails({ inner, height: 600, measure: () => m }));
    expect(new Set(edges.map((e) => e.boxRight)).size).toBe(1);
    expect(new Set(edges.map((e) => e.detailsLeft + e.width)).size).toBe(1);
    expect(edges.every((e) => e.width === 360 && e.columns === 1)).toBe(true);
  });

  it("gives the Map the same left, and the same right when Details is beside", () => {
    for (let window = 768; window <= 2560; window += 16) {
      const frame = frameOf(innerWidthOf(window));
      if (frame.beside) expect(frame.mapRight, String(window)).toBe(frame.boxRight);
      else expect(frame.mapRight, String(window)).toBe(window - 40);
    }
  });
});

describe("Details is one fixed column that scrolls inside", () => {
  const inner = innerWidthOf(1920);

  it("fills the column from the top, in order, a section never split", () => {
    const layout = layoutDetails({ inner, height: 800, measure: () => flat([120, 90]) });
    expect(layout).toMatchObject({ beside: true, width: 360, columns: 1, scrolls: false });
    expect(layout.assignment).toEqual([["head", "s0", "s1"]]);
  });

  it("scrolls inside when it is taller than the window, instead of adding columns", () => {
    const layout = layoutDetails({ inner: innerWidthOf(2560), height: 500, measure: wraps([250, 250, 250]) });
    expect(layout.columns).toBe(1);
    expect(layout.width).toBe(360);
    expect(layout.scrolls).toBe(true);
    expect(layout.assignment.flat()).toEqual(["head", "s0", "s1", "s2"]);
  });

  it("does not scroll when it fits", () => {
    const layout = layoutDetails({ inner, height: 600, measure: () => flat([200, 200]) });
    expect(layout.scrolls).toBe(false);
    // F70: every section, the first too, takes SEPARATION above it.
    expect(56 + 400 + 2 * SEPARATION).toBeLessThanOrEqual(600);
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

  it("places a trailing section after the foot line, with its separation (CA-18b P3)", () => {
    const measure = (): Measured => ({ head: 56, foot: 40, sections: [{ key: "s0", height: 100 }, { key: "references", height: 200, trailing: true }] });
    const layout = layoutDetails({ inner, height: 800, measure });
    expect(layout.assignment).toEqual([["head", "s0", "foot", "references"]]);
    expect(layout.scrolls).toBe(false);
    // F70: 56 + 49 + 100 + 40 (the foot) + 49 + 200 = 494: it fits 494 and not 493.
    expect(layoutDetails({ inner, height: 494, measure }).scrolls).toBe(false);
    expect(layoutDetails({ inner, height: 493, measure }).scrolls).toBe(true);
  });

  it("measures once, at its one width", () => {
    const widths: number[] = [];
    layoutDetails({ inner, height: 600, measure: (width) => { widths.push(width); return wraps([450, 450])(width); } });
    expect(widths).toEqual([360]);
  });
});

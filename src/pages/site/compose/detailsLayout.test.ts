// CA-18 P4: the composer's widths from the window alone, and Details sized by its content.

import { describe, expect, it } from "vitest";

import { DETAILS_GAP, SEPARATION, frameOf, innerWidthOf, layoutDetails, type Measured } from "./detailsLayout";

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

describe("the composer is one box (CA-18b P5)", () => {
  it.each([
    // window, boxLeft (Sources or the rail), boxRight (Details; checked from 1280, where it is shown)
    [1152, 40, 0],
    [1280, 104, 1240],
    [1440, 144, 1400],
    [1920, 324, 1880],
    [2560, 644, 2220],
  ])("at %i the box runs %i to %i", (window, left, right) => {
    const frame = frameOf(innerWidthOf(window));
    expect(frame.boxLeft).toBe(left);
    if (window >= 1280) expect(frame.boxRight).toBe(right);
  });

  it("ends at Build's right edge when Details is hidden, and begins at the rail's when Sources is folded", () => {
    const hidden = frameOf(innerWidthOf(1152));
    expect(hidden.beside).toBe(false);
    expect(hidden.boxRight).toBe(hidden.buildLeft + hidden.build);
    const rail = frameOf(innerWidthOf(1100));
    expect(rail.rail).toBe(true);
    expect(rail.boxLeft).toBe(rail.buildLeft - 24 - 52);
  });

  it("gives Details one fixed width per window: min(room, 520), at least 280", () => {
    for (let window = 1280; window <= 3000; window += 16) {
      const frame = frameOf(innerWidthOf(window));
      expect(frame.detailsWidth, String(window)).toBe(Math.min(frame.room, 520));
      expect(frame.detailsWidth).toBeGreaterThanOrEqual(280);
      expect(frame.boxRight).toBe(frame.detailsLeft + frame.detailsWidth);
    }
  });

  it("keeps the right edge where it is whatever Details holds", () => {
    const inner = innerWidthOf(1920);
    const edges = [flat([100]), flat([900, 900, 900]), flat([5000], { foot: 40 })].map((m) => layoutDetails({ inner, height: 600, measure: () => m }));
    expect(new Set(edges.map((e) => e.boxRight)).size).toBe(1);
    expect(new Set(edges.map((e) => e.detailsLeft + e.width)).size).toBe(1);
    expect(edges.every((e) => e.width === 500 && e.columns === 1)).toBe(true);
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
    expect(layout).toMatchObject({ beside: true, width: 500, columns: 1, scrolls: false });
    expect(layout.assignment).toEqual([["head", "s0", "s1"]]);
  });

  it("scrolls inside when it is taller than the window, instead of adding columns", () => {
    const layout = layoutDetails({ inner: innerWidthOf(2560), height: 500, measure: wraps([250, 250, 250]) });
    expect(layout.columns).toBe(1);
    expect(layout.width).toBe(520);
    expect(layout.scrolls).toBe(true);
    expect(layout.assignment.flat()).toEqual(["head", "s0", "s1", "s2"]);
  });

  it("does not scroll when it fits", () => {
    const layout = layoutDetails({ inner, height: 600, measure: () => flat([200, 200]) });
    expect(layout.scrolls).toBe(false);
    expect(56 + 400 + SEPARATION).toBeLessThanOrEqual(600);
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
    // 56 + 100 + 40 (the foot carries its own 22) + 45 (separation) + 200 = 441: it fits 441 and not 440.
    expect(layoutDetails({ inner, height: 441, measure }).scrolls).toBe(false);
    expect(layoutDetails({ inner, height: 440, measure }).scrolls).toBe(true);
  });

  it("measures once, at its one width", () => {
    const widths: number[] = [];
    layoutDetails({ inner, height: 600, measure: (width) => { widths.push(width); return wraps([450, 450])(width); } });
    expect(widths).toEqual([500]);
  });
});

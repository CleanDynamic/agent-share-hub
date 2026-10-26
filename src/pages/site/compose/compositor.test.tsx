// SV-06 P4 - only the compositor: nothing in the build page animates clip-path, a layout property, or a scale on a box with corners;
// a thing that grows drops its new part in; a framed box (a part, a lane) moves its three pieces; will-change is set only while
// something moves.

import { cleanup, render } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DROP, DROP_FALL } from "@/lib/build/buildMotion";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { SLIDE_ATTR } from "./flip";
import { FramePieces } from "./framePieces";
import { MotionBoundary, useListMotion } from "./listMotion";
import { passes, stubAnimations, type Played } from "./motionStub";

let played: Played[] = [];
let restore = () => undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("innerHeight", 900);
  __resetMotionMediaCache();
  ({ played, restore } = stubAnimations());
});
afterEach(() => {
  cleanup();
  restore();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  __resetMotionMediaCache();
});

describe("a static check over src/pages/site/compose", () => {
  const dir = join(process.cwd(), "src/pages/site/compose");
  const files = readdirSync(dir).filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && name !== "motionStub.ts");
  /** Every animation's keyframes: the line of each `animate(` or `animateOn(` / `start(` call, and the next few. */
  const calls = files.flatMap((name) => {
    const lines = readFileSync(join(dir, name), "utf8").split("\n");
    return lines.flatMap((line, at) => (/(\.animate\(|animateOn\(|\bstart\((?!\))|\bfly\(|\bdrawLines\()/.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line) ? [{ name, at: at + 1, text: lines.slice(at, at + 6).join(" ") }] : []));
  });

  it("finds the build page's animations to check", () => {
    expect(calls.length).toBeGreaterThan(20);
  });

  it("no clip-path, but the window frame (CA-28's resizeFrame, not the list)", () => {
    const clipped = calls.filter((call) => /clipPath/.test(call.text)).map((call) => call.name);
    expect([...new Set(clipped)]).toEqual(["buildMotion.tsx"]);
    const source = readFileSync(join(dir, "buildMotion.tsx"), "utf8");
    // The one there is the window's: inside `resizeFrame`, which no list element calls.
    const body = source.slice(source.indexOf("export function resizeFrame("), source.indexOf("/* ── slideOut"));
    expect(source.match(/clipPath:/g)?.length).toBe(body.match(/clipPath:/g)?.length);
    expect(readFileSync(join(dir, "listMotion.ts"), "utf8")).not.toMatch(/clipPath/);
  });

  it("no stroke-dash but the map's lines, no layout property, anywhere", () => {
    const dashed = calls.filter((call) => /strokeDash/.test(call.text)).map((call) => call.name);
    expect([...new Set(dashed)]).toEqual(["mapMorph.tsx"]);
    const map = readFileSync(join(dir, "mapMorph.tsx"), "utf8");
    const lines = map.slice(map.indexOf("function drawLines("), map.indexOf("export interface LensMorph"));
    expect(map.match(/strokeDash/g)?.length).toBe(lines.match(/strokeDash/g)?.length);
    for (const call of calls) expect(call.text, `${call.name}:${call.at}`).not.toMatch(/[{,]\s*(height|width|top|left|margin\w*|padding\w*)\s*:\s*[`"'\d]/);
  });

  it("no scale on a box with corners: only the frame's 1px sides scale, and the map's flying copies", () => {
    const scaled = calls.filter((call) => /scale[XY]?\(/.test(call.text)).map((call) => `${call.name}`);
    expect([...new Set(scaled)].sort()).toEqual(["listMotion.ts", "mapMorph.tsx"]);
    const motion = readFileSync(join(dir, "listMotion.ts"), "utf8");
    for (const match of motion.matchAll(/scale[XY]?\(/g)) expect(motion.slice(match.index - 200, match.index), "a scale in listMotion.ts").toMatch(/sides/);
  });
});

/** jsdom has no layout: an element is drawn where its `data-top` says, `data-h` tall. */
function layout(): void {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const top = Number(this.getAttribute("data-top") ?? 0);
    const height = Number(this.getAttribute("data-h") ?? 0);
    return { left: 0, top, width: height > 0 ? 300 : 0, height, right: 300, bottom: top + height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
}

function Tile({ tall }: { tall: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useListMotion(ref);
  return (
    <MotionBoundary motion={motion} slide={{}}>
      <div ref={ref}>
        <div {...{ [SLIDE_ATTR]: "tile:t" }} data-top={0} data-h={tall ? 160 : 100}>
          <div data-testid="head" data-top={0} data-h={60} />
          <div data-testid="text" data-top={60} data-h={40} />
          {tall ? <div data-testid="nested-row" data-top={100} data-h={60} /> : null}
        </div>
      </div>
    </MotionBoundary>
  );
}

function Part({ tall }: { tall: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useListMotion(ref);
  return (
    <MotionBoundary motion={motion} slide={{ ms: 200 }}>
      <div ref={ref}>
        <div {...{ [SLIDE_ATTR]: "part:a" }} data-top={0} data-h={tall ? 400 : 300} style={{ position: "relative" }}>
          <FramePieces radius={14} colour="red" />
        </div>
      </div>
    </MotionBoundary>
  );
}

describe("a thing that grows", () => {
  it("drops its new part in from DROP_FALL above, the box at its new size at once: no clip-path", () => {
    layout();
    const view = render(<Tile tall={false} />);
    view.rerender(<Tile tall />);
    const row = document.querySelector('[data-testid="nested-row"]');
    const drops = played.filter((entry) => entry.element === row);
    expect(drops).toHaveLength(1);
    expect(drops[0].keyframes).toEqual([{ opacity: 0, transform: `translateY(-${DROP_FALL}px)` }, { opacity: 1, transform: "none" }]);
    expect(drops[0].options.duration).toBe(DROP);
    // What was there before is not touched; the tile itself is not clipped or scaled.
    expect(played.filter((entry) => entry.element !== row)).toHaveLength(0);
  });

  it("a framed box slides its bottom edge and grows its 1px sides; its corners are never scaled", () => {
    layout();
    const view = render(<Part tall={false} />);
    view.rerender(<Part tall />);
    const piece = (name: string) => document.querySelector(`[data-frame-piece="${name}"]`);
    const bottom = played.filter((entry) => entry.element === piece("bottom"));
    const sides = played.filter((entry) => entry.element === piece("sides"));
    expect(bottom.map((entry) => entry.keyframes[0])).toEqual([{ transform: "translateY(-100px)" }]);
    expect(sides.map((entry) => entry.keyframes[0])).toEqual([{ transform: `scaleY(${(300 - 28) / (400 - 28)})` }]);
    expect(played.filter((entry) => entry.element === piece("top"))).toHaveLength(0);
  });

  it("at rest the frame is drawn whole; its pieces show only while it moves", async () => {
    layout();
    const view = render(<Part tall={false} />);
    const piece = (name: string) => document.querySelector<HTMLElement>(`[data-frame-piece="${name}"]`);
    expect(piece("whole")?.style.visibility).toBe("");
    expect(piece("bottom")?.style.visibility).toBe("hidden");
    view.rerender(<Part tall />);
    expect(piece("whole")?.style.visibility).toBe("hidden");
    expect(piece("bottom")?.style.visibility).toBe("");
    await passes(400);
    expect(piece("whole")?.style.visibility).toBe("");
    expect(piece("bottom")?.style.visibility).toBe("hidden");
  });
});

describe("will-change", () => {
  it("is on an element only while it moves, and gone at rest", async () => {
    layout();
    const view = render(<Part tall={false} />);
    view.rerender(<Part tall />);
    const bottom = document.querySelector<HTMLElement>('[data-frame-piece="bottom"]');
    expect(bottom?.style.willChange).toBe("transform, opacity");
    await passes(400);
    expect(bottom?.style.willChange).toBe("");
  });
});

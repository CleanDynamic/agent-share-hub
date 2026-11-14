// Prompt 6 G12, G15: the held copy shakes once when it is picked up, on an element inside it, never on the element dnd-kit moves.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SHAKE_MS, shakeFrames } from "@/lib/build/buildMotion";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { HeldCopy } from "./listNest";
import { stubAnimations, type Played } from "./motionStub";

let played: Played[] = [];
let reduced = false;

beforeEach(() => {
  reduced = false;
  window.matchMedia = ((query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as never;
  __resetMotionMediaCache();
  ({ played } = stubAnimations());
});
afterEach(() => {
  cleanup();
  delete (Element.prototype as { animate?: unknown }).animate;
  delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
  __resetMotionMediaCache();
});

const overlay = { html: "<div>Prompt 2</div>", w: 648, h: 128, type: "tile" as const, place: 0 };

describe("G12: the shake on pick-up", () => {
  it("plays once, on an element inside the held copy", () => {
    // The wrapper stands for dnd-kit's positioned overlay, which takes the drag's transform.
    render(
      <div data-testid="overlay-wrapper">
        <HeldCopy overlay={overlay} />
      </div>,
    );
    const copy = screen.getByTestId("held-copy");
    const shakes = played.filter((entry) => String(entry.options.id).endsWith("shake"));
    expect(shakes).toHaveLength(1);
    expect(copy.contains(shakes[0].element) && shakes[0].element !== copy).toBe(true);
    expect(shakes[0].element).not.toBe(screen.getByTestId("overlay-wrapper"));
    expect(shakes[0].keyframes).toEqual(shakeFrames());
    expect(shakes[0].options.duration).toBe(SHAKE_MS);
  });

  it("does not play again when the copy draws again", () => {
    const { rerender } = render(<HeldCopy overlay={overlay} />);
    rerender(<HeldCopy overlay={{ ...overlay }} />);
    expect(played.filter((entry) => String(entry.options.id).endsWith("shake"))).toHaveLength(1);
  });

  it("G15: plays nothing under reduced motion, and the copy is still drawn", () => {
    reduced = true;
    __resetMotionMediaCache();
    render(<HeldCopy overlay={overlay} />);
    expect(played).toHaveLength(0);
    expect(screen.getByTestId("held-copy").textContent).toContain("Prompt 2");
  });
});

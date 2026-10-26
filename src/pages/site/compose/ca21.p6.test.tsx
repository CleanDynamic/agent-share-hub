// CA-21 P6 - moves from the menu slide too: measured, then a transform from the old place to the new, over 150 ms; none under reduced motion.

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { slideMs } from "@/lib/build/buildMotion";
import { STANDARD, __resetMotionMediaCache } from "@/lib/theme/motion";

import { done, mountList, said, stubLayout, stubMedia } from "./ca21Harness";
import { stubAnimations, type Played } from "./motionStub";

let animations: Played[] = [];

beforeEach(() => {
  stubMedia();
  __resetMotionMediaCache();
  ({ played: animations } = stubAnimations());
});
afterEach(() => {
  delete (Element.prototype as { animate?: unknown }).animate;
  __resetMotionMediaCache();
  done();
});

const tileIds = () => [...document.querySelectorAll('[data-skel-kind="tile"]')].map((el) => el.getAttribute("data-skel-id") as string);

async function moveDown(name: string) {
  fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "Move down" }));
}

describe("a move from the menu", () => {
  it("slides the moved tile and its neighbour from their old places: a translate that ends at none, in the standard easing, all over the time the longer move asks (SV-06 P5)", async () => {
    stubLayout();
    const { props } = mountList({ onMove: vi.fn(() => Promise.resolve(true)) });
    const [first, second] = tileIds();
    await moveDown("Prompt 1 options");
    expect(props.onMove).toHaveBeenCalledWith(first, 1);
    await waitFor(() => expect(tileIds().slice(0, 2)).toEqual([second, first]));
    expect(animations.length).toBeGreaterThanOrEqual(2);
    const travel = animations.map(({ keyframes }) => {
      const [dx, dy] = (String(keyframes[0].transform).match(/-?[\d.]+/g) ?? []).map(Number);
      return Math.hypot(dx ?? 0, dy ?? 0);
    });
    for (const { keyframes, options } of animations) {
      expect(String(keyframes[0].transform)).toMatch(/translate\(/);
      expect(keyframes[1].transform).toBe("none");
      expect(options.duration).toBe(slideMs(Math.max(...travel)));
      expect(options.easing).toBe(STANDARD);
    }
    // No skeleton: nothing is held.
    expect(screen.queryByTestId("skeleton-layer")).toBeNull();
  });

  it("slides back and says so when the write does not land", async () => {
    stubLayout();
    mountList({ onMove: vi.fn(() => Promise.resolve(false)) });
    const [first, second] = tileIds();
    await moveDown("Prompt 1 options");
    await waitFor(() => expect(said()).toBe("Tile not moved"));
    await waitFor(() => expect(tileIds().slice(0, 2)).toEqual([first, second]));
  });

  it("under reduced motion ends in the same order at once, with nothing sliding", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    __resetMotionMediaCache();
    stubLayout();
    mountList({ onMove: vi.fn(() => Promise.resolve(true)) });
    const [first, second] = tileIds();
    await moveDown("Prompt 1 options");
    await waitFor(() => expect(tileIds().slice(0, 2)).toEqual([second, first]));
    expect(animations).toHaveLength(0);
  });

  it("slides a session moved from its menu, and a part", async () => {
    stubLayout();
    const props = mountList({ onMove: vi.fn(() => Promise.resolve(true)) }).props;
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move down" }));
    expect(props.sessionOps?.onMove).toHaveBeenCalled();
    await waitFor(() => expect(animations.length).toBeGreaterThan(0));
  });
});

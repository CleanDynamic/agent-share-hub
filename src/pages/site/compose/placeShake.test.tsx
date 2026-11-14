// Prompt 6 G13, G16: the held copy shakes once each time its landing place changes, after the slide has ended; a re-decision that
// leaves the place where it was does not shake; on drop the tile's own card shakes once it has landed; fast moves leave one shake.

import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SETTLE_MS, SHAKE_MS } from "@/lib/build/buildMotion";
import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { done, mountList, pickUp, press, stubLayout } from "./ca21Harness";
import { HeldCopy } from "./listNest";
import { stubAnimations, type Played } from "./motionStub";

let played: Played[] = [];

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as never;
  __resetMotionMediaCache();
  ({ played } = stubAnimations());
});
afterEach(() => {
  cleanup();
  done();
  vi.useRealTimers();
  delete (Element.prototype as { animate?: unknown }).animate;
  delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
  __resetMotionMediaCache();
});

const shakes = () => played.filter((entry) => String(entry.options.id).endsWith("shake"));
const copyShakes = () => shakes().filter((entry) => (entry.element as Element).closest?.('[data-testid="held-copy"]'));
const overlay = (place: number, slidesDone?: () => Promise<unknown>) => ({ html: "<div>Prompt 2</div>", w: 648, h: 128, type: "tile" as const, place, slidesDone });

describe("G13: a change of place, in the held copy", () => {
  it("shakes once per change, only after the slide has ended", async () => {
    let end: () => void = () => undefined;
    const slide = new Promise<void>((resolve) => (end = resolve));
    const { rerender } = render(<HeldCopy overlay={overlay(0)} />);
    expect(copyShakes()).toHaveLength(1); // the pick-up
    rerender(<HeldCopy overlay={overlay(1, () => slide)} />);
    await act(async () => undefined);
    expect(copyShakes()).toHaveLength(1);
    await act(async () => end());
    expect(copyShakes()).toHaveLength(2);
    // The copy drawn again at the same place: nothing.
    rerender(<HeldCopy overlay={{ ...overlay(1, () => slide) }} />);
    await act(async () => undefined);
    expect(copyShakes()).toHaveLength(2);
  });
});

describe("G13 in the list: what counts as a change of place", () => {
  const grip = (at: number) => within(document.querySelectorAll<HTMLElement>('[data-skel-kind="tile"]')[at]).getAllByTestId("drag-handle")[0];

  it("shakes for a move to a new place, and not for a key that leaves it where it was", async () => {
    stubLayout();
    mountList();
    await pickUp(grip(0));
    await waitFor(() => expect(copyShakes()).toHaveLength(1));
    await press("ArrowUp"); // already the first place: no change
    await act(async () => new Promise((resolve) => setTimeout(resolve, SHAKE_MS)));
    expect(copyShakes()).toHaveLength(1);
    await press("ArrowDown");
    await waitFor(() => expect(copyShakes()).toHaveLength(2));
    await press("Escape");
  });

  it("G16: four quick moves leave at most one shake running on the copy, and it ends at none", async () => {
    stubLayout();
    mountList();
    await pickUp(grip(0));
    for (let at = 0; at < 4; at += 1) await press("ArrowDown");
    await waitFor(() => expect(copyShakes().length).toBeGreaterThan(1));
    const inner = screen.getByTestId("held-copy").querySelector("[data-held-shake]") as Element;
    expect(copyShakes().filter((entry) => entry.element === inner && !entry.finished && !entry.cancelled).length).toBeLessThanOrEqual(1);
    expect(copyShakes().at(-1)?.keyframes.at(-1)).toEqual({ transform: "none" });
    await press("Escape");
  });

  it("on drop, shakes the tile's own card once, after it has landed and the copy is gone", async () => {
    stubLayout();
    mountList();
    const id = document.querySelectorAll('[data-skel-kind="tile"]')[0].getAttribute("data-skel-id");
    await pickUp(grip(0));
    await press("ArrowDown");
    const before = shakes().length;
    await press("Space");
    const card = () => document.querySelector(`[data-skel-kind="tile"][data-skel-id="${id}"]`)?.firstElementChild;
    await act(async () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS * 2 + 100)));
    const landed = shakes().slice(before).filter((entry) => entry.element === card());
    expect(landed).toHaveLength(1);
    expect(screen.queryByTestId("held-copy")).toBeNull();
  });
});

// 29e: the phone's motion rules that are pure: which movement a change makes, when a sheet closes, when an edge swipe
// completes, when a field needs scrolling above the keyboard, and the reading anchor's correction.

import { describe, expect, it } from "vitest";

import { swipeEnd } from "@/components/shell/phoneEdgeSwipe";
import { sheetCloses } from "@/components/phone/BottomSheet";
import { needsScroll } from "@/lib/theme/phoneKeyboard";
import { PHONE_EASE, PHONE_QUICK, PHONE_STANDARD, phoneReducedFade } from "@/lib/theme/motion";

import { anchorShift } from "./readingAnchor";
import { phoneNavKind } from "./phoneNav";

describe("phoneNavKind", () => {
  it("makes a dock switch instant", () => {
    expect(phoneNavKind("/", "/builds")).toBe("none");
    expect(phoneNavKind("/notifications", "/import")).toBe("none");
  });
  it("pushes a page opened from a root or from another page", () => {
    expect(phoneNavKind("/", "/b2/abc")).toBe("push");
    expect(phoneNavKind("/b2/abc", "/profile/kit")).toBe("push");
  });
  it("goes back to a root, and a pop from a page is a back", () => {
    expect(phoneNavKind("/b2/abc", "/", true)).toBe("back");
    expect(phoneNavKind("/profile/kit", "/b2/abc", true)).toBe("back");
  });
});

describe("tokens", () => {
  it("are 160 and 280 on one curve; reduced motion is a PHONE_QUICK opacity fade", () => {
    expect([PHONE_QUICK, PHONE_STANDARD, PHONE_EASE]).toEqual([160, 280, "cubic-bezier(.2,.8,.2,1)"]);
    expect(phoneReducedFade()).toBe("opacity 160ms cubic-bezier(.2,.8,.2,1)");
  });
});

describe("sheetCloses", () => {
  it("closes past a third of the height or faster than 0.5 px/ms", () => {
    expect(sheetCloses(101, 0.1, 300)).toBe(true);
    expect(sheetCloses(99, 0.1, 300)).toBe(false);
    expect(sheetCloses(40, 0.6, 300)).toBe(true);
    expect(sheetCloses(40, 0.4, 300)).toBe(false);
  });
});

describe("swipeEnd", () => {
  it("completes past 35% of the width over the remaining fraction of PHONE_STANDARD", () => {
    const end = swipeEnd(195, 0.1, 390);
    expect(end.back).toBe(true);
    expect(end.ms).toBe(Math.round(PHONE_STANDARD * 0.5));
  });
  it("completes on velocity over 0.5 and returns otherwise", () => {
    expect(swipeEnd(40, 0.6, 390).back).toBe(true);
    const stay = swipeEnd(100, 0.2, 390);
    expect(stay.back).toBe(false);
    expect(stay.ms).toBe(Math.round(PHONE_STANDARD * (100 / 390)));
  });
});

describe("needsScroll", () => {
  it("scrolls a field the keyboard covers or crowds, and leaves one in clear sight", () => {
    expect(needsScroll(700, 500)).toBe(true);
    expect(needsScroll(490, 500)).toBe(true);
    expect(needsScroll(400, 500)).toBe(false);
  });
});

describe("anchorShift", () => {
  it("follows the item the reader was on, and does nothing at the top of the page", () => {
    expect(anchorShift(120, 320, 600)).toBe(200);
    expect(anchorShift(120, 120.4, 600)).toBe(0);
    expect(anchorShift(120, 320, 0)).toBe(0);
  });
});

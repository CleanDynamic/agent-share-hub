// BG-P07 — the control kit's paint.
//
// What is proved here is the set of claims the kit's comments make, so that a
// later edit that quietly breaks one fails a test rather than shipping. Three
// of them are acceptance criteria for the prompt that built this file:
//
//   - nothing in the kit is a pill except the genuinely circular things;
//   - the focus ring has exactly one definition, in both the style form and
//     the class form;
//   - no blurred surface can nest inside another.

import { describe, expect, it } from "vitest";

import {
  buttonSlot,
  buttonStyle,
  checkboxStyle,
  chipStyle,
  CONTROL_CLASS,
  CONTROL_SIZE,
  dialogPanelStyle,
  FOCUS_RING_CLASS,
  GLASS_BLUR,
  menuItemStyle,
  menuPanelStyle,
  PRIMARY_VARIANTS,
  radioStyle,
  scrimStyle,
  SECONDARY_VARIANTS,
  sheetPanelStyle,
  switchThumbStyle,
  switchTrackStyle,
  tabTriggerStyle,
  tooltipStyle,
  TOUCH_HIT_CLASS,
  touchHit,
  uiTransition,
  type ButtonVariant,
} from "./controls";
import { denseHeight } from "./density";
import { focusRing } from "./focus";
import { RADIUS } from "./radius";

const VARIANTS: ButtonVariant[] = ["default", "destructive", "outline", "secondary", "ghost", "link"];

describe("every control carries the radius step the scale assigns it", () => {
  // The radius scale's one misuse is reaching for --r-full on something that is
  // not a circle. These are the controls the prompt named; each is checked
  // against the step it is supposed to carry rather than merely "not 999px",
  // so a control that drifts to the wrong rectangular step fails too.
  //
  // Carrying the right TOKEN is not the same as rendering the right SHAPE. See
  // the block at the bottom of this file for the two controls where it isn't.
  it("gives buttons --r-control", () => {
    for (const variant of VARIANTS) {
      if (variant === "link") continue; // text, not a box
      expect(buttonStyle(variant).borderRadius, variant).toBe("var(--r-control)");
    }
  });

  it("gives the switch track --r-control and not --r-full", () => {
    expect(switchTrackStyle().borderRadius).toBe("var(--r-control)");
    expect(switchTrackStyle().borderRadius).not.toBe("var(--r-full)");
  });

  it("gives the checkbox --r-chip", () => {
    expect(checkboxStyle().borderRadius).toBe("var(--r-chip)");
  });

  it("gives chips --r-chip", () => {
    expect(chipStyle("neutral").borderRadius).toBe("var(--r-chip)");
    expect(chipStyle("category", { category: "instruction" }).borderRadius).toBe("var(--r-chip)");
  });

  it("gives tabs and menu items --r-chip", () => {
    expect(tabTriggerStyle().borderRadius).toBe("var(--r-chip)");
    expect(menuItemStyle().borderRadius).toBe("var(--r-chip)");
  });

  it("gives overlay panels --r-panel", () => {
    expect(menuPanelStyle.borderRadius).toBe("var(--r-panel)");
    expect(dialogPanelStyle.borderRadius).toBe("var(--r-panel)");
  });

  it("spends --r-full only on things that are actually circles", () => {
    // The switch THUMB and the radio are circles; the track and the checkbox
    // are not. That distinction is the whole of the rule.
    expect(switchThumbStyle().borderRadius).toBe("var(--r-full)");
    expect(radioStyle().borderRadius).toBe("var(--r-full)");
    expect(RADIUS["r-full"]).toBe("999px");
  });
});

describe("the focus ring has one definition", () => {
  it("appears on every control when the focus came from a keyboard", () => {
    const focused = { focusVisible: true };
    const builders = [
      buttonStyle("default", focused),
      buttonStyle("link", focused),
      switchTrackStyle(focused),
      checkboxStyle(focused),
      radioStyle(focused),
      tabTriggerStyle(focused),
      chipStyle("neutral", { selectable: true, ...focused }),
    ];
    for (const style of builders) {
      expect(style.outlineColor).toBe(focusRing.outlineColor);
      expect(style.outlineWidth).toBe(focusRing.outlineWidth);
      expect(style.outlineOffset).toBe(focusRing.outlineOffset);
      expect(style.outlineStyle).toBe(focusRing.outlineStyle);
    }
  });

  it("appears on nothing at rest, so a mouse click leaves no ring", () => {
    for (const style of [buttonStyle("default"), checkboxStyle(), tabTriggerStyle()]) {
      expect(style.outlineColor).toBeUndefined();
    }
  });

  it("never appears on a disabled control", () => {
    const state = { focusVisible: true, disabled: true };
    expect(buttonStyle("default", state).outlineColor).toBeUndefined();
    expect(checkboxStyle(state).outlineColor).toBeUndefined();
  });

  it("says the same thing in the class form as in the style form", () => {
    // The two forms exist because a tab panel should not grow a useState just
    // to draw an outline. They must not become two different rings.
    expect(FOCUS_RING_CLASS).toContain(`outline-[color:${focusRing.outlineColor}]`);
    expect(FOCUS_RING_CLASS).toContain(`outline-${parseInt(focusRing.outlineWidth, 10)}`);
    expect(FOCUS_RING_CLASS).toContain(`outline-offset-${parseInt(focusRing.outlineOffset, 10)}`);
    // Every utility is focus-visible-scoped: a ring on plain :focus would show
    // on a mouse click, which is the thing both forms exist to avoid.
    for (const utility of FOCUS_RING_CLASS.split(/\s+/).filter(Boolean)) {
      expect(utility, utility).toMatch(/^focus-visible:/);
    }
  });
});

describe("no blurred surface nests inside another", () => {
  // The rule the previous shell broke. A blurred item inside a blurred panel is
  // two stacked compositing layers, each re-reading the pixels beneath it every
  // frame — that nesting, not the blur radius, is what made scrolling stutter.
  // UI-P40: the blur budget is the site header, the mobile header, the dock and
  // the build page's plate and dock. No kit panel is one of them.
  it("blurs no kit panel, portalled or not", () => {
    expect(menuPanelStyle.backdropFilter).toBeUndefined();
    expect(dialogPanelStyle.backdropFilter).toBeUndefined();
    expect(sheetPanelStyle("right").backdropFilter).toBeUndefined();
  });

  it("never blurs anything that can come to rest inside a panel", () => {
    const nestable = [
      menuItemStyle(),
      tooltipStyle, // does not portal in this codebase, so it must stay opaque
      ...VARIANTS.map((v) => buttonStyle(v)),
      chipStyle("neutral"),
      chipStyle("category", { category: "data" }),
      switchTrackStyle(),
      checkboxStyle(),
      radioStyle(),
      tabTriggerStyle(),
    ];
    for (const style of nestable) {
      expect(style.backdropFilter).toBeUndefined();
      expect(style.WebkitBackdropFilter).toBeUndefined();
    }
  });

  it("keeps one blur value in the whole system", () => {
    expect(GLASS_BLUR).toBe("blur(16px) saturate(1.15)");
  });
});

describe("motion", () => {
  it("never animates box-shadow, and never uses the `all` keyword", () => {
    // An animated box-shadow cannot be composited: it re-rasterises the element
    // every frame, which is what turns a grid of hovering cards into a dropped
    // -frame scroll.
    const transition = uiTransition();
    expect(transition).not.toMatch(/box-shadow/);
    expect(transition).not.toMatch(/\ball\b/);
  });

  it("stays under the theme's 200ms ceiling for UI feedback", () => {
    for (const ms of uiTransition().match(/(\d+)ms/g) ?? []) {
      expect(parseInt(ms, 10)).toBeLessThanOrEqual(200);
    }
  });

  it("never uses ease-in, which reads as an unresponsive control", () => {
    expect(uiTransition()).not.toMatch(/\bease-in\b/);
  });

  it("lifts on hover with a transform, which composites", () => {
    expect(buttonStyle("default", { hovered: true }).transform).toBe("translateY(-1px)");
    expect(buttonStyle("default", { hovered: true }).boxShadow).toBeUndefined();
  });

  it("does not lift a disabled button", () => {
    expect(buttonStyle("default", { hovered: true, disabled: true }).transform).toBeUndefined();
  });
});

describe("the variant to token mapping", () => {
  it("labels both primary fills with --on-action, which flips with them", () => {
    // A literal white would be 1.16:1 on Dusk's red. Both tokens flipping
    // together is what makes one mapping legal in both themes.
    expect(buttonStyle("default").background).toBe("var(--action)");
    expect(buttonStyle("default").color).toBe("var(--on-action)");
    expect(buttonStyle("destructive").background).toBe("var(--cat-breakage)");
    expect(buttonStyle("destructive").color).toBe("var(--on-action)");
  });

  it("gives both secondary treatments a --line border", () => {
    for (const variant of SECONDARY_VARIANTS) {
      expect(buttonStyle(variant).borderColor, variant).toBe("var(--line)");
    }
  });

  it("gives the tertiary treatments no fill", () => {
    expect(buttonStyle("ghost").background).toBe("transparent");
    expect(buttonStyle("ghost").color).toBe("var(--text2)");
    expect(buttonStyle("link").background).toBe("transparent");
  });

  it("underlines the link variant AT REST, not only on hover", () => {
    // A link distinguished from surrounding text by colour alone fails WCAG
    // 1.4.1, and a touch user never gets hover at all — so the affordance has
    // to be there before anyone interacts. Hover thickens it, and that is the
    // only thing hover is allowed to add here.
    expect(buttonStyle("link").textDecoration).toBe("underline");
    expect(buttonStyle("link", { hovered: true }).textDecorationThickness).toBe("2px");
  });

  it("spends tokens and never a literal colour", () => {
    for (const variant of VARIANTS) {
      const style = buttonStyle(variant, { hovered: true, focusVisible: true });
      for (const [property, value] of Object.entries(style)) {
        if (typeof value !== "string") continue;
        expect(value, `${variant}.${property}`).not.toMatch(/#[0-9a-f]{3,8}\b/i);
        expect(value, `${variant}.${property}`).not.toMatch(/\brgba?\(/);
      }
    }
  });

  it("marks the externally-supplied button surfaces with their slot", () => {
    // neoscale-ui RULE 3 reserves these. The slot is where the external visual
    // component is dropped in; the token paint beneath it is only a default.
    for (const variant of PRIMARY_VARIANTS) expect(buttonSlot(variant)).toBe("btn-primary");
    for (const variant of SECONDARY_VARIANTS) expect(buttonSlot(variant)).toBe("btn-secondary");
    expect(buttonSlot("ghost")).toBeUndefined();
    expect(buttonSlot("link")).toBeUndefined();
  });
});

describe("category chips", () => {
  it("take both halves of a measured pair, never one", () => {
    const chip = chipStyle("category", { category: "instruction" });
    expect(chip.background).toBe("var(--cat-instruction-fill)");
    expect(chip.color).toBe("var(--cat-instruction)");
  });

  it("fall back to the measured fallback pair rather than to an invented one", () => {
    const chip = chipStyle("category", { category: "not-a-category" });
    expect(chip.background).toBe("var(--cat-fallback-fill)");
    expect(chip.color).toBe("var(--cat-fallback)");
  });

  it("keep the fill doing the work, so selection cannot overwrite the category", () => {
    // The border carries selection precisely so the fill can keep carrying the
    // category. A filled chip therefore has no border colour of its own.
    expect(chipStyle("category", { category: "agents" }).borderColor).toBe("transparent");
  });
});

describe("the sheet is anchored, and its style knows it", () => {
  // Both of these are forced by the anchoring rather than chosen, so they are
  // the two things most likely to be "tidied" back into the dialog's treatment
  // by someone who has not hit the consequences.
  it("rounds only the corners that have something behind them", () => {
    const right = sheetPanelStyle("right");
    expect(right.borderTopLeftRadius).toBe("var(--r-panel)");
    expect(right.borderBottomLeftRadius).toBe("var(--r-panel)");
    // The two corners flush against the viewport edge stay square: a rounded
    // corner needs something behind it, and at the screen edge there is nothing.
    expect(right.borderTopRightRadius).toBeUndefined();
    expect(right.borderBottomRightRadius).toBeUndefined();

    const bottom = sheetPanelStyle("bottom");
    expect(bottom.borderTopLeftRadius).toBe("var(--r-panel)");
    expect(bottom.borderTopRightRadius).toBe("var(--r-panel)");
    expect(bottom.borderBottomLeftRadius).toBeUndefined();
  });

  it("never sets a four-sided border on a panel that carries exactly one", () => {
    for (const side of ["top", "bottom", "left", "right"] as const) {
      const style = sheetPanelStyle(side);
      expect(style.borderWidth, side).toBeUndefined();
      expect(style.borderStyle, side).toBeUndefined();
      // The colour is still ours — it is the width that belongs to the layout.
      expect(style.borderColor, side).toBe("var(--glass-border)");
    }
  });

  it("carries the overlay elevation, like the dialog", () => {
    expect(sheetPanelStyle("right").boxShadow).toBe(dialogPanelStyle.boxShadow);
  });
});

describe("the scrim", () => {
  it("dims and does not blur", () => {
    // It covers the whole viewport; blurring a full-screen layer is the single
    // most expensive thing this system could do.
    expect(scrimStyle.backdropFilter).toBeUndefined();
    expect(scrimStyle.background).toContain("var(--porthole)");
  });

  it("is not an elevation, so it cannot be spread by mistake for one", () => {
    expect(scrimStyle.boxShadow).toBeUndefined();
  });
});


describe("where the radius tokens do not produce the shape the spec describes", () => {
  /* A radius is only soft RELATIVE TO the box it is on. `--r-control` is 12px
     whether the element is 44px tall or 24px, and at 24px it is half the height
     — which is a capsule, the exact shape the scale exists to retire.

     Two controls in the kit are small enough for this to bite. Neither is fixed
     here: the fix is a bigger box, which is a structural change to an existing
     control and the one thing this restyle may never make, and the alternative
     is a seventh step in a six-step scale. So the arithmetic is pinned instead,
     with the sizes written out, so that the day someone changes a height this
     test says whether the problem went away.

     THIS BLOCK IS NOT A TODO TO DELETE. If a control's box grows past the
     threshold, update the size here and the expectation flips on its own.

     UI-P52 density pass: the sizes below are the kit's after UI-P53, read from
     CONTROL_SIZE (they were 36/40/44/40/40/40/24/16 and Tailwind's h-9 to h-4).
     The smallest rectangular control is now 30px, so that is the threshold the
     soft-rectangle check runs from; both KNOWN cases are still true. */
  const px = (token: string) => parseInt(RADIUS[token as keyof typeof RADIUS], 10);

  /** A radius at or past half the smaller dimension fully rounds that axis. */
  const fullyRounds = (radius: number, smallerSide: number) => radius * 2 >= smallerSide;

  const CONTROLS = [
    // [name, smaller dimension in px, the token it carries, its size classes]
    ["button, sm", CONTROL_SIZE.button.sm, "r-control", CONTROL_CLASS.button.sm],
    ["button, default", CONTROL_SIZE.button.default, "r-control", CONTROL_CLASS.button.default],
    ["button, lg", CONTROL_SIZE.button.lg, "r-control", CONTROL_CLASS.button.lg],
    ["input", CONTROL_SIZE.field, "r-control", CONTROL_CLASS.field],
    ["select trigger", CONTROL_SIZE.field, "r-control", CONTROL_CLASS.field],
    ["tabs list", CONTROL_SIZE.tab, "r-control", CONTROL_CLASS.tabList],
    ["switch track", CONTROL_SIZE.switchTrack, "r-control", CONTROL_CLASS.switchTrack],
    ["checkbox", CONTROL_SIZE.checkbox, "r-chip", CONTROL_CLASS.checkbox],
  ] as const;

  it("lands as a soft rectangle on every control 30px or larger", () => {
    for (const [name, size, token] of CONTROLS) {
      if (size < 30) continue;
      expect(fullyRounds(px(token), size), `${name} should not be fully rounded`).toBe(false);
    }
  });

  it("KNOWN: the switch track renders as a capsule despite --r-control", () => {
    // The track is 20px (24 before the UI-P52 density pass) and --r-control is
    // 12px, so the spec's "not a pill" and the spec's token cannot both be
    // honoured. The token is.
    expect(px("r-control") * 2).toBe(24);
    expect(CONTROL_SIZE.switchTrack).toBe(20);
    expect(fullyRounds(px("r-control"), CONTROL_SIZE.switchTrack)).toBe(true);
  });

  it("KNOWN: the checkbox renders as a circle despite --r-chip", () => {
    // The box is 15px (16 before the UI-P52 density pass) and --r-chip is 8px,
    // so a checkbox is the same shape as a radio and only the tick
    // distinguishes them. Round means pick one and square means pick any;
    // losing that is a real affordance defect, and the fix is a bigger box
    // rather than a smaller radius.
    expect(px("r-chip") * 2).toBe(16);
    expect(CONTROL_SIZE.checkbox).toBe(15);
    expect(fullyRounds(px("r-chip"), CONTROL_SIZE.checkbox)).toBe(true);
  });

  it("shows the same token reads correctly on the box it was sized for", () => {
    // --r-chip was sized for a chip, roughly 24px tall, where it is a third of
    // the height. The token is not the problem; the 16px box is.
    expect(fullyRounds(px("r-chip"), 24)).toBe(false);
  });
});

describe("control sizes (UI-P53, the density pass)", () => {
  // UI-P52 density pass: every size is the kit's old one through the table in
  // design/prompts/README-density.md, and the classes the shadcn kit spends say
  // the same numbers as CONTROL_SIZE.
  it("maps each control's old height through the table", () => {
    const pairs: Array<[number, number]> = [
      [CONTROL_SIZE.button.sm, 36],
      [CONTROL_SIZE.button.default, 40],
      [CONTROL_SIZE.button.lg, 44],
      [CONTROL_SIZE.button.icon, 40],
      [CONTROL_SIZE.field, 40],
      [CONTROL_SIZE.chip, 36],
      [CONTROL_SIZE.tab, 40],
      [CONTROL_SIZE.switchTrack, 24],
      [CONTROL_SIZE.switchThumb, 20],
      [CONTROL_SIZE.radio, 16],
      [CONTROL_SIZE.menuItem, 36],
    ];
    for (const [size, old] of pairs) expect(size, `${old}px`).toBe(denseHeight(old));
  });

  it("takes the checkbox to 15, the one size the pass names outright", () => {
    // 18 → 15, under the 20px line below which the table keeps a height.
    expect(CONTROL_SIZE.checkbox).toBe(15);
  });

  it("writes the same numbers into the shadcn kit's classes", () => {
    expect(CONTROL_CLASS.button.sm).toContain(`h-[${CONTROL_SIZE.button.sm}px]`);
    expect(CONTROL_CLASS.button.default).toContain(`h-[${CONTROL_SIZE.button.default}px]`);
    expect(CONTROL_CLASS.button.lg).toContain(`h-[${CONTROL_SIZE.button.lg}px]`);
    expect(CONTROL_CLASS.button.icon).toBe(`h-[${CONTROL_SIZE.button.icon}px] w-[${CONTROL_SIZE.button.icon}px]`);
    expect(CONTROL_CLASS.field).toContain(`h-[${CONTROL_SIZE.field}px]`);
    expect(CONTROL_CLASS.tabList).toContain(`h-[${CONTROL_SIZE.tab}px]`);
    expect(CONTROL_CLASS.checkbox).toBe(`h-[${CONTROL_SIZE.checkbox}px] w-[${CONTROL_SIZE.checkbox}px]`);
    // h-5 is 20px and h-4 16px: Tailwind's own steps where the table lands on them.
    expect(CONTROL_CLASS.switchTrack).toContain("h-5");
    expect(CONTROL_CLASS.switchThumb).toContain("h-4 w-4");
    expect(CONTROL_CLASS.radio).toBe("h-4 w-4");
  });

  it("keeps the switch thumb flush: 16px travelling 24 in a 40px inner track", () => {
    const inner = 44 - 2 * 2;
    expect(CONTROL_CLASS.switchThumb).toContain("translate-x-6");
    expect(24 + CONTROL_SIZE.switchThumb).toBe(inner);
  });

  it("holds a menu item to its 30px minimum in the style every menu spends", () => {
    expect(menuItemStyle().minHeight).toBe(CONTROL_SIZE.menuItem);
    expect(CONTROL_CLASS.menuItem).toBe("py-1");
  });

  it("keeps a 44px touch target on a phone for a control that had one", () => {
    // Below 768px a control that was 44px or taller keeps min-height 44.
    expect(CONTROL_CLASS.button.lg).toContain(TOUCH_HIT_CLASS);
    expect(TOUCH_HIT_CLASS).toBe("max-md:min-h-[44px]");
    expect(touchHit(true, 44)).toEqual({ minHeight: 44 });
    expect(touchHit(true, 48)).toEqual({ minHeight: 44 });
    expect(touchHit(true, 40)).toEqual({});
    expect(touchHit(false, 48)).toEqual({});
    for (const name of ["sm", "default", "icon"] as const) {
      expect(CONTROL_CLASS.button[name], name).not.toContain(TOUCH_HIT_CLASS);
    }
  });

  it("leaves the focus ring alone: it is not a size", () => {
    expect(focusRing.outlineWidth).toBe("2px");
    expect(focusRing.outlineOffset).toBe("2px");
  });
});

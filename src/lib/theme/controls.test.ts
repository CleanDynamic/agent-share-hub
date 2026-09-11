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
  uiTransition,
  type ButtonVariant,
} from "./controls";
import { focusRing } from "./focus";
import { RADIUS } from "./radius";

const VARIANTS: ButtonVariant[] = ["default", "destructive", "outline", "secondary", "ghost", "link"];

describe("nothing in the kit is a pill", () => {
  // The radius scale's one misuse is reaching for --r-full on something that is
  // not a circle. These are the controls the prompt named; each is checked
  // against the step it is supposed to carry rather than merely "not 999px",
  // so a control that drifts to the wrong rectangular step fails too.
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
  it("blurs the portalled panels and nothing else", () => {
    expect(menuPanelStyle.backdropFilter).toBe(GLASS_BLUR);
    expect(dialogPanelStyle.backdropFilter).toBe(GLASS_BLUR);
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

  it("carries the overlay elevation and the blur, like the dialog", () => {
    expect(sheetPanelStyle("right").boxShadow).toBe(dialogPanelStyle.boxShadow);
    expect(sheetPanelStyle("right").backdropFilter).toBe(GLASS_BLUR);
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

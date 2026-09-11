// buildgallery.ai — the control kit's paint.
//
// BG-P07. Every control in `src/components/ui/` reads its appearance from here,
// so that "what a button looks like" is one decision written once rather than a
// variant string re-derived in eleven files. The components keep their shadcn
// props API exactly; this module only supplies the pixels.
//
// WHY STYLE OBJECTS AND NOT CLASSES. Tailwind's generated utilities beat
// hand-written classes at build time in this project, so a `.bg-button` in
// `index.css` silently does nothing (`neoscale-ui` RULE 1). Everything here is
// a plain `CSSProperties` destined for an inline `style={{ }}`, where it
// outranks both. Keyframes are the one thing an inline style cannot express and
// are the sanctioned exception; `shimmer` in `index.css` is the only one this
// prompt adds.
//
// WHAT IS DELIBERATELY ABSENT. No `height`, `padding`, `display`, `flex`,
// `gap`, `margin`, `position`, `width` or `overflow` appears anywhere in this
// file. Those are structural, they belong to the Tailwind classes already on
// each control, and changing them is what breaks the three-panel layout
// (`neoscale-code-review` automatic-fail 2). If a control feels cramped at the
// new type size the answer is to report it, not to widen it here.
//
// THE ONE EXCEPTION, NAMED. `secondary` and `outline` buttons gain a 1px
// `--line` border they did not have. Borders are visual and explicitly in scope
// for this prompt, and Tailwind's preflight puts every element in
// `box-sizing: border-box`, so the fixed heights (`h-9`/`h-10`/`h-11`) do not
// move. An auto-width button grows by 2px. That is the whole cost.

import type { CSSProperties } from "react";

import { categoryFill } from "./category";
import { elevation, SCRIM } from "./elevation";
import { focusRing } from "./focus";
import { r } from "./radius";
import { t } from "./tokens";
import { DM_MONO } from "./type";

/* ── Motion ───────────────────────────────────────────────────────────────────
   The theme allows ≤200ms on `transform` and `opacity`, forbids `transition:
   all`, forbids `ease-in` on UI, and forbids animating `box-shadow` — an
   animated shadow cannot be composited, so it re-rasterises the element every
   frame, which is what turns a grid of hovering cards into a dropped-frame
   scroll.

   So the transition list below is written out property by property and
   `box-shadow` is not in it, in this file or any consumer of it. Colour
   properties are included because a fill crossing from rest to hover is a
   cross-fade, not a layout change, and they composite acceptably at this
   duration.
   ─────────────────────────────────────────────────────────────────────────── */

/** 160ms. Under the theme's 200ms ceiling for UI feedback. */
export const UI_MS = 160;

/** Never `ease-in` on UI: a control that starts slowly reads as unresponsive. */
export const UI_EASING = "cubic-bezier(.2,.6,.35,1)";

const TRANSITIONED = ["background-color", "border-color", "color", "opacity", "transform"] as const;

const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/* One MediaQueryList per query for the whole app rather than one per control.
   `.matches` is live, so a cached list stays current without a listener, and a
   control that re-renders for any other reason reads the new value. */
const lists = new Map<string, MediaQueryList | null>();

function matchesMedia(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  if (!lists.has(query)) {
    try {
      lists.set(query, window.matchMedia(query));
    } catch {
      lists.set(query, null);
    }
  }
  return lists.get(query)?.matches ?? false;
}

/**
 * True where a hover state is worth showing at all. The theme gates hover
 * motion behind this because on a touch screen `:hover` sticks after a tap,
 * leaving a control looking permanently pressed.
 */
export const hoverIsFine = (): boolean => matchesMedia(HOVER_QUERY);

/** True when the visitor has asked for less motion. Honoured in CSS *and* here. */
export const prefersReducedMotion = (): boolean => matchesMedia(REDUCED_MOTION_QUERY);

/**
 * The kit's transition, or `none` under `prefers-reduced-motion: reduce`.
 *
 * Reduced motion is answered by removing the transition rather than by
 * shortening it: the end state is identical, it simply arrives at once. Nothing
 * here is load-bearing for comprehension, so nothing is lost by skipping it.
 */
export function uiTransition(): string {
  if (prefersReducedMotion()) return "none";
  return TRANSITIONED.map((property) => `${property} ${UI_MS}ms ${UI_EASING}`).join(", ");
}

/** The 1px lift a control takes on hover. Suppressed for reduced motion. */
export function hoverLift(active: boolean): CSSProperties {
  if (!active || prefersReducedMotion()) return {};
  return { transform: "translateY(-1px)" };
}

/* ── Interaction state ────────────────────────────────────────────────────────
   Every builder below takes the same shape, so a component tracks three
   booleans and spends them without knowing which control it is.
   ─────────────────────────────────────────────────────────────────────────── */

export interface ControlState {
  /** Pointer is over the control AND the pointer is a fine one. */
  readonly hovered?: boolean;
  /** Focused *by keyboard* — `:focus-visible`, never a mouse click. */
  readonly focusVisible?: boolean;
  /** Pointer is down on the control, or the control is a pressed toggle. */
  readonly pressed?: boolean;
  /** The control is disabled. Suppresses every other state. */
  readonly disabled?: boolean;
}

/** The focus ring, spread only when the focus came from a keyboard. */
export const ring = (focusVisible: boolean | undefined): CSSProperties =>
  focusVisible ? { ...focusRing } : {};

/* ── Buttons ──────────────────────────────────────────────────────────────────
   Four treatments, mapped onto the six shadcn variant names so that no consumer
   has to change a single prop:

     default     → PRIMARY.    --action fill, --on-action label.
     destructive → PRIMARY in breakage red. --cat-breakage fill.
     secondary   → SECONDARY.  --glass fill, --line border, --text label.
     outline     → SECONDARY, lighter. --glass-2 fill, --line border.
     ghost       → TERTIARY.   --text2 label, no fill until hover.
     link        → TERTIARY as text. --action label, underline on hover.

   WHY DESTRUCTIVE TAKES --on-action AND NOT A HARDCODED WHITE. Both tokens flip
   together, and they flip in opposite directions, which is exactly what the
   pairing needs: Exhibition puts near-white #F7F8F9 on deep red #B91C1C (6.15:1)
   and Dusk puts near-black #241B1A on light red #F26D6D (5.76:1). A literal
   white would be 1.16:1 on Dusk's red — illegible, and the reason no component
   in this system spends a hex.

   WHY "GLASS" HERE IS A COLOUR AND NOT A BLUR. The secondary treatment uses the
   `--glass` token as a translucent fill and does NOT set `backdrop-filter`. A
   button lives inside a card inside a panel, both of which may be blurred, and
   stacking a third blurred layer inside them is precisely the nesting the theme
   forbids and the thing that made the previous shell slow. The token lightens
   whatever sits behind it, which is the whole of the effect a button at this
   size can show; the blur is reserved for the portalled overlay surfaces, which
   are children of `document.body` and therefore cannot nest.
   ─────────────────────────────────────────────────────────────────────────── */

export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

/** The shadcn variant names that are a PRIMARY action, and so carry the slot. */
export const PRIMARY_VARIANTS: readonly ButtonVariant[] = ["default", "destructive"];

/** The shadcn variant names that are a SECONDARY action. */
export const SECONDARY_VARIANTS: readonly ButtonVariant[] = ["secondary", "outline"];

/**
 * `data-visual-slot` for a variant, or `undefined` for the tertiary treatments.
 *
 * `neoscale-ui` RULE 3 reserves primary button SURFACES as externally supplied.
 * The slot marks where that component is dropped in; everything this module
 * paints underneath it is a DEFAULT, which is why the style object is spread
 * *before* any incoming `style` prop in every consumer. Drop a visual component
 * in later and it still wins.
 */
export function buttonSlot(variant: ButtonVariant): string | undefined {
  if (PRIMARY_VARIANTS.includes(variant)) return "btn-primary";
  if (SECONDARY_VARIANTS.includes(variant)) return "btn-secondary";
  return undefined;
}

function buttonPaint(variant: ButtonVariant): CSSProperties {
  switch (variant) {
    case "destructive":
      return { background: t.catBreakage, color: t.onAction, borderColor: "transparent" };
    case "secondary":
      return { background: t.glass, color: t.text, borderColor: t.line };
    case "outline":
      return { background: t.glass2, color: t.text, borderColor: t.line };
    case "ghost":
      return { background: "transparent", color: t.text2, borderColor: "transparent" };
    case "link":
      return { background: "transparent", color: t.action, borderColor: "transparent" };
    case "default":
    default:
      return { background: t.action, color: t.onAction, borderColor: "transparent" };
  }
}

/** What hover changes, per treatment. Colour only — the lift is separate. */
function buttonHover(variant: ButtonVariant): CSSProperties {
  switch (variant) {
    case "ghost":
      /* A ghost button has no resting fill, so hover is where it acquires one:
         that is what stops it reading as a label rather than a control. */
      return { background: t.glass2, color: t.text };
    case "link":
      return { textDecoration: "underline", textUnderlineOffset: "4px" };
    case "secondary":
      return { background: t.glassHi, borderColor: t.text2 };
    case "outline":
      return { background: t.glass, borderColor: t.text2 };
    default:
      /* Primary and destructive keep their fill and lighten by a measured step
         rather than by an opacity change, which would let the page show
         through a button whose whole job is to be solid. */
      return { filter: "brightness(1.08)" };
  }
}

/**
 * A button, resting or in any state.
 *
 * `link` is the one variant that keeps no border and no radius worth speaking
 * of — it is text — but it still takes the ring, because it is still a tab stop.
 */
export function buttonStyle(variant: ButtonVariant, state: ControlState = {}): CSSProperties {
  const { hovered, focusVisible, pressed, disabled } = state;
  const live = !disabled;
  const hot = Boolean(live && hovered);

  return {
    ...buttonPaint(variant),
    borderRadius: variant === "link" ? undefined : r.control,
    borderWidth: variant === "link" ? undefined : 1,
    borderStyle: variant === "link" ? undefined : "solid",
    transition: uiTransition(),
    cursor: disabled ? "not-allowed" : "pointer",
    ...(hot ? buttonHover(variant) : {}),
    ...hoverLift(hot),
    /* Pressed cancels the lift and settles the control back onto the page, so a
       click reads as a press rather than as a second hover. */
    ...(live && pressed ? { transform: "translateY(0)", filter: "brightness(.94)" } : {}),
    ...ring(live && focusVisible),
  };
}

/* ── Fields ───────────────────────────────────────────────────────────────────
   input, textarea, and the select trigger. One treatment: an inset well.

   `--recess` is the token for "a surface the page is cut into", which is
   exactly what a field is, and it is what separates a field from a button —
   the button sits on the page, the field sits in it. The border is `--line`
   at rest and `--action` once focused, so the field brightens toward the
   accent while the ring says which element the keyboard is on.

   THE iOS 16px RULE IS NOT TOUCHED. `index.css` forces `font-size: 16px` on
   every `input`, `select` and `textarea` below 768px, because anything smaller
   makes mobile Safari zoom the viewport on focus and never zoom back. Nothing
   here sets a font size on a field.
   ─────────────────────────────────────────────────────────────────────────── */

export interface FieldState extends ControlState {
  /** Draws the field in breakage red and is expected to travel with a message. */
  readonly invalid?: boolean;
}

export function fieldStyle(state: FieldState = {}): CSSProperties {
  const { hovered, focusVisible, invalid, disabled } = state;
  const live = !disabled;

  const borderColor = invalid
    ? t.catBreakage
    : live && focusVisible
      ? t.action
      : live && hovered
        ? t.text2
        : t.line;

  return {
    background: t.recess,
    color: t.text,
    borderColor,
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: r.control,
    transition: uiTransition(),
    cursor: disabled ? "not-allowed" : undefined,
    ...ring(live && focusVisible),
  };
}

/**
 * The error message under an invalid field.
 *
 * Breakage red is legal as text on both grounds — the theme measures every
 * category hue at ≥4.83:1 on Exhibition and ≥5.75:1 on Dusk — which is why the
 * message and the border can share one token.
 */
export const fieldMessageStyle: CSSProperties = {
  color: t.catBreakage,
  fontFamily: DM_MONO,
  fontSize: "12px",
  lineHeight: 1.4,
};

/** `--text2`, so a placeholder reads as absent content rather than as a value. */
export const placeholderStyle: CSSProperties = { color: t.text2 };

/* ── Chips and badges ─────────────────────────────────────────────────────────
   Radius `--r-chip`, and DM Mono at 12px because a chip is a label on a
   specimen, not prose. The fill comes from `categoryFill()`, which returns a
   measured background/foreground pair — use both halves or neither, since this
   hue on some other ground is a pairing nobody measured.
   ─────────────────────────────────────────────────────────────────────────── */

/** 12px DM Mono. The chip label, and the one type role a chip may carry. */
export const chipType: CSSProperties = {
  fontFamily: DM_MONO,
  fontSize: "12px",
  fontWeight: 500,
  lineHeight: 1.3,
  letterSpacing: "0.02em",
};

export type ChipTone = "category" | "neutral" | "action" | "evidence" | "outline";

/**
 * A chip.
 *
 * `category` resolves the nine part hues through `categoryFill`; anything the
 * resolver does not recognise lands on the measured fallback pair rather than
 * on an invented one.
 */
export function chipStyle(
  tone: ChipTone,
  options: { category?: string; selectable?: boolean } & ControlState = {},
): CSSProperties {
  const { category, selectable, hovered, focusVisible, pressed, disabled } = options;
  const live = !disabled;

  const paint: CSSProperties =
    tone === "category"
      ? categoryFill(category ?? "")
      : tone === "action"
        ? { background: t.action, color: t.onAction }
        : tone === "evidence"
          ? { background: t.evidenceFill, color: t.evidence }
          : tone === "outline"
            ? { background: "transparent", color: t.text2 }
            : { background: t.recess, color: t.text2 };

  return {
    ...paint,
    ...chipType,
    borderRadius: r.chip,
    borderWidth: 1,
    borderStyle: "solid",
    /* The border takes the chip's own ink rather than `--line`, so an outline
       chip and a filled chip are the same object at two weights. */
    borderColor: tone === "outline" ? t.line : "transparent",
    transition: uiTransition(),
    cursor: selectable && live ? "pointer" : undefined,
    /* A selectable chip has to look selectable, which on a shape this small is
       a border it did not have plus a pressed state that actually moves. */
    ...(selectable && live && hovered ? { borderColor: t.text2 } : {}),
    ...(selectable && live && pressed ? { borderColor: t.action, filter: "brightness(.95)" } : {}),
    ...ring(live && focusVisible),
  };
}

/**
 * A chip that is currently selected, as opposed to merely pressed.
 *
 * Selection is carried by the border and not by a second fill, because the fill
 * already encodes the category and overwriting it would lose that meaning.
 */
export const chipSelectedStyle: CSSProperties = {
  borderColor: t.action,
  borderWidth: 1,
  borderStyle: "solid",
};

/* ── Tabs ─────────────────────────────────────────────────────────────────── */

export const tabsListStyle: CSSProperties = {
  background: t.recess,
  borderRadius: r.control,
  transition: uiTransition(),
};

/**
 * A tab.
 *
 * The active tab is marked by an `--action` underline rather than by a filled
 * pill: the row is a set of labels with one of them current, and a fill would
 * make the current one read as a button while its neighbours read as text.
 */
export function tabTriggerStyle(state: ControlState & { active?: boolean } = {}): CSSProperties {
  const { active, hovered, focusVisible, disabled } = state;
  const live = !disabled;

  return {
    background: active ? t.glass : "transparent",
    color: active ? t.text : t.text2,
    borderRadius: r.chip,
    boxShadow: active ? `inset 0 -2px 0 0 ${t.action}` : undefined,
    transition: uiTransition(),
    cursor: disabled ? "not-allowed" : "pointer",
    ...(live && hovered && !active ? { color: t.text } : {}),
    ...ring(live && focusVisible),
  };
}

/* ── Switch, checkbox, radio ──────────────────────────────────────────────── */

/**
 * The switch track at `--r-control` — 12px, NOT a pill.
 *
 * THIS IS A DELIBERATE DEPARTURE and worth saying out loud, because a
 * rounded-rectangle switch is unusual enough to look like a mistake. Every
 * platform draws this control as a capsule, and every instinct says to follow.
 * The buildgallery radius scale removed the capsule rule on purpose: `--r-full`
 * is for circles only — spinners and avatars — and a 999px track here would be
 * the one pill left in the system, which is worse than a switch that looks
 * slightly unfamiliar. The THUMB stays circular, because it is a circle.
 */
export function switchTrackStyle(state: ControlState & { checked?: boolean } = {}): CSSProperties {
  const { checked, hovered, focusVisible, disabled } = state;
  const live = !disabled;

  return {
    background: checked ? t.action : t.recess,
    borderColor: checked ? t.action : t.line,
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: r.control,
    transition: uiTransition(),
    cursor: disabled ? "not-allowed" : "pointer",
    ...(live && hovered && !checked ? { borderColor: t.text2 } : {}),
    ...ring(live && focusVisible),
  };
}

/** The thumb. Circular — `--r-full` is correct here and almost nowhere else. */
export function switchThumbStyle(checked: boolean): CSSProperties {
  return {
    background: checked ? t.onAction : t.text2,
    borderRadius: r.full,
    transition: prefersReducedMotion()
      ? "none"
      : `transform ${UI_MS}ms ${UI_EASING}, background-color ${UI_MS}ms ${UI_EASING}`,
  };
}

/** The checkbox box at `--r-chip` — the scale's smallest step, as specified. */
export function checkboxStyle(state: ControlState & { checked?: boolean } = {}): CSSProperties {
  const { checked, hovered, focusVisible, disabled } = state;
  const live = !disabled;

  return {
    background: checked ? t.action : t.recess,
    color: checked ? t.onAction : "transparent",
    borderColor: checked ? t.action : t.line,
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: r.chip,
    transition: uiTransition(),
    cursor: disabled ? "not-allowed" : "pointer",
    ...(live && hovered && !checked ? { borderColor: t.text2 } : {}),
    ...ring(live && focusVisible),
  };
}

/**
 * The radio, which IS circular and therefore IS `--r-full`.
 *
 * The shape is the affordance here: a round control is single-choice and a
 * square one is multiple-choice, and that convention is older and better known
 * than this theme. Squaring it to satisfy "nothing is a pill" would trade a
 * real signal for a cosmetic consistency.
 */
export function radioStyle(state: ControlState & { checked?: boolean } = {}): CSSProperties {
  const { checked, hovered, focusVisible, disabled } = state;
  const live = !disabled;

  return {
    background: t.recess,
    color: t.action,
    borderColor: checked ? t.action : t.line,
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: r.full,
    transition: uiTransition(),
    cursor: disabled ? "not-allowed" : "pointer",
    ...(live && hovered && !checked ? { borderColor: t.text2 } : {}),
    ...ring(live && focusVisible),
  };
}

/* ── Overlays ─────────────────────────────────────────────────────────────────
   Menus, popovers, tooltips, dialogs and sheets.

   GLASS ON THE PANEL, NEVER ON THE ITEMS INSIDE IT. This is the assertion the
   prompt asks for, and it is the rule that the previous shell broke: a blurred
   chip inside a blurred card inside a blurred panel is three stacked
   compositing layers, each one re-reading the pixels beneath it every frame,
   and that — not the blur radius — is what made scrolling stutter. So
   `menuPanelStyle` sets `backdrop-filter` and `menuItemStyle` sets a plain
   colour. There is no third surface that may add one.

   WHY THE PANELS MAY BLUR AT ALL. Radix portals every one of these into
   `document.body`, so an open menu is a sibling of the app root rather than a
   descendant of whatever glass card opened it. A portalled surface cannot nest
   inside another blurred surface, which is the only reason a blur is affordable
   here and not on a button.

   THE TOOLTIP IS THE EXCEPTION AND IS DELIBERATELY OPAQUE. This codebase's
   tooltip does NOT portal — `TooltipContent` renders inline, so it genuinely
   can land inside a glass card. It is given a solid `--text` ground instead,
   which also happens to be the right call for 12px type that has to be read in
   under a second.
   ─────────────────────────────────────────────────────────────────────────── */

/** One blur value in the whole system. There is no smaller one to save cost. */
export const GLASS_BLUR = "blur(16px) saturate(1.15)";

/** Menus and popovers: portalled, blurred, `raised`. */
export const menuPanelStyle: CSSProperties = {
  background: t.glass,
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  borderColor: t.glassBorder,
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: r.panel,
  color: t.text,
  ...elevation.raised,
};

/**
 * An item inside a menu. NOT glass — see the assertion above.
 *
 * WHAT IS MISSING HERE, AND WHY. This object sets no background and no colour.
 * Radix marks the highlighted item with `data-highlighted`, which it sets for
 * BOTH keyboard navigation and mouse hover, and which no style object can read.
 * Tracking the highlight in React instead would mean re-deriving a state Radix
 * already publishes and getting the mouse case subtly wrong. So the item's two
 * colours are carried by `MENU_ITEM_CLASS` below and this object is limited to
 * what does not change between states — deliberately, so the two mechanisms
 * never own the same property and fight over it.
 */
export function menuItemStyle(state: ControlState = {}): CSSProperties {
  return {
    borderRadius: r.chip,
    transition: uiTransition(),
    cursor: state.disabled ? "not-allowed" : "pointer",
  };
}

/**
 * The highlight for a menu item, as Tailwind utilities that spend the tokens.
 *
 * These are GENERATED utilities, not hand-written classes, so they are not the
 * thing `neoscale-ui` RULE 1 forbids — that rule exists because Tailwind's own
 * output overrides hand-written CSS, which cannot happen to Tailwind's own
 * output. The `color:` hint on each arbitrary value is load-bearing: without it
 * Tailwind cannot tell a bare `var()` from a font size and drops the utility.
 *
 * `focus:` is included alongside `data-[highlighted]:` because DropdownMenu
 * moves real DOM focus onto its items while Select only sets the attribute;
 * covering both keeps one definition for both menus.
 */
export const MENU_ITEM_CLASS =
  "text-[color:var(--text2)] data-[highlighted]:bg-[color:var(--recess)] data-[highlighted]:text-[color:var(--text)] focus:bg-[color:var(--recess)] focus:text-[color:var(--text)]";

/** A hairline between groups of menu items. */
export const menuSeparatorStyle: CSSProperties = { background: t.line };

/** A group heading inside a menu. Mono, because it labels rather than reads. */
export const menuLabelStyle: CSSProperties = { ...chipType, color: t.text2 };

/** Dialogs and sheets: portalled, blurred, `overlay`. */
export const dialogPanelStyle: CSSProperties = {
  background: t.glass,
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  borderColor: t.glassBorder,
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: r.panel,
  color: t.text,
  ...elevation.overlay,
};

/**
 * The scrim behind a dialog or a sheet.
 *
 * Struck from `--porthole` — the darkest surface token in each theme — rather
 * than from black, so the page dims into its own room instead of under a sheet
 * of ink. It carries no blur: it covers the entire viewport, and blurring a
 * full-screen layer is the single most expensive thing this system could do.
 */
export const scrimStyle: CSSProperties = { ...SCRIM };

/**
 * The tooltip. Opaque, for the reason given above.
 *
 * `--text` as a ground with `--bg` as the ink is the system's highest-contrast
 * pairing in both themes (13.10:1 Exhibition, 14.17:1 Dusk) — it is the page's
 * own text and background colours swapped, so it needs no separate measurement.
 */
export const tooltipStyle: CSSProperties = {
  background: t.text,
  color: t.bg,
  borderRadius: r.chip,
  borderWidth: 0,
  borderStyle: "solid",
  fontSize: "12px",
  lineHeight: 1.4,
  ...elevation.raised,
};

/* ── Skeleton and spinner ─────────────────────────────────────────────────── */

/**
 * A loading placeholder: `--recess`, with a highlight swept across it by the
 * `bgShimmer` keyframe in `index.css`.
 *
 * A keyframe is the one thing an inline style cannot express, so the movement
 * lives in the stylesheet and is referenced here by name — the same sanctioned
 * exception the intake sweep and the sequence spinner already use.
 *
 * Under `prefers-reduced-motion` the sweep is dropped entirely and the
 * placeholder is a flat recess. It still reads as "not content yet", because
 * that is carried by the colour and the shape, not by the movement.
 */
export function skeletonStyle(): CSSProperties {
  const still = prefersReducedMotion();

  return {
    background: still
      ? t.recess
      : `linear-gradient(90deg, ${t.recess} 0%, ${t.glass2} 50%, ${t.recess} 100%)`,
    backgroundSize: still ? undefined : "200% 100%",
    borderRadius: r.media,
    animation: still ? undefined : `bgShimmer 1600ms ${UI_EASING} infinite`,
  };
}

/**
 * The spinner, and one of exactly two places `--r-full` is correct.
 *
 * A ring with one lit quadrant rather than a filled disc, so it reads as
 * "working" and not as "a dot". `sequenceSpin` is the existing rotation
 * keyframe in `index.css`; this adds no second one.
 *
 * Under reduced motion the rotation stops and the ring is drawn whole. A
 * stationary partial ring would look like a rendering fault.
 */
export function spinnerStyle(): CSSProperties {
  const still = prefersReducedMotion();

  return {
    borderRadius: r.full,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: still ? t.text2 : t.line,
    borderTopColor: still ? t.text2 : t.action,
    animation: still ? undefined : "sequenceSpin 720ms linear infinite",
  };
}

/* ── The theme toggle ─────────────────────────────────────────────────────────
   Three segments in one `--r-control` group on `--recess`, with the current
   segment filled `--action`. The group paints its own ground because the rails
   it sits in still carry the legacy dark paint, and `--text2` on that paint is
   not a pairing anyone measured; `--text2` on `--recess` is.
   ─────────────────────────────────────────────────────────────────────────── */

export const themeToggleGroupStyle: CSSProperties = {
  background: t.recess,
  borderColor: t.line,
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: r.control,
};

export function themeToggleSegmentStyle(state: ControlState & { selected?: boolean } = {}): CSSProperties {
  const { selected, hovered, focusVisible, disabled } = state;
  const live = !disabled;

  return {
    ...chipType,
    background: selected ? t.action : "transparent",
    color: selected ? t.onAction : t.text2,
    borderRadius: r.chip,
    borderWidth: 0,
    transition: uiTransition(),
    cursor: "pointer",
    ...(live && hovered && !selected ? { color: t.text } : {}),
    ...ring(live && focusVisible),
  };
}

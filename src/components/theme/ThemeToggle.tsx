import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTheme, type ThemeChoice } from "@/contexts/ThemeContext";
import { themeToggleGroupStyle, themeToggleSegmentStyle, uiTransition } from "@/lib/theme/controls";
import { focusRing } from "@/lib/theme/focus";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { data as dataText } from "@/lib/theme/type";

/* ────────────────────────────────────────────────────────────────────────────
   ThemeToggle — the control that flips the room.

   BG-P02 shipped this deliberately plain, with a note that BG-P07 would style
   it properly. This is that: three segments in one `--r-control` group on
   `--recess`, with the current segment filled `--action` and labelled
   `--on-action` — the same measured pair the primary button uses.

   AN ARIA RADIO GROUP OF BUTTONS rather than native radio inputs, because
   index.css forces a background, border and font-size onto every `input` in the
   app with !important, which a native radio cannot escape. That is still true
   after BG-P07 repointed that rule at the tokens.

   THE GROUP PAINTS ITS OWN GROUND, and that is not decoration. The rails this
   sits in still carry the legacy dark paint, and `--text2` on that paint is not
   a pairing anyone measured; `--text2` on `--recess` is (4.55 Exhibition, 5.73
   Dusk). Painting the ground is what makes the colour contract hold here.

   THE FOCUS RING IS NOW THE SHARED ONE, which is the question BG-P02 left open.
   It wrote the ring in `--text` because `--lit` measures 1.80:1 on Exhibition's
   ground, under the 3.0:1 floor for UI state. The resolution is in `focus.ts`
   and is about the OFFSET rather than the colour: `outline-offset: 2px` leaves a
   2px band of `--bg` between the control and the ring, so the ring is read
   against two edges rather than against the ground alone. That band is part of
   the ring's definition, not a taste, and it is why one definition can be used
   everywhere. A second ring here would be a second thing for a keyboard user to
   learn, for no gain.
   ──────────────────────────────────────────────────────────────────────────── */

const OPTIONS: readonly { value: ThemeChoice; label: string }[] = [
  { value: "exhibition", label: "Exhibition" },
  { value: "dusk", label: "Dusk" },
  { value: "system", label: "System" },
];

/**
 * BG-P18b — the rail's variant of the same control.
 *
 * WHY A VARIANT AND NOT A REPAINT. The default is the kit's: a `--recess` group
 * with the current segment filled `--action`, and it is what /dev/kit and the
 * workspace bar render. In the left rail that fill is a second `--action` mark
 * eight pixels under the rail's one primary button, and the theme's rule is one
 * primary action per view — a setting is not one. So in the rail the group has
 * no ground of its own, it is full width and 32px tall, and the current segment
 * is `--text` on `--recess`: the same step every other row in this rail marks
 * itself with. Nothing about the default changed, and neither of the other two
 * call sites moves.
 */
export type ThemeToggleVariant = "kit" | "rail";

/** The rail variant's group: full width, 32 tall, no fill. */
const RAIL_GROUP: CSSProperties = {
  display: "flex",
  width: "100%",
  height: 32,
  gap: 2,
  background: "transparent",
  borderRadius: r.chip,
};

/** The rail variant's segment, at rest, hovered and current. */
function railSegmentStyle(state: { selected: boolean; hovered: boolean; focusVisible: boolean }): CSSProperties {
  const { selected, hovered, focusVisible } = state;
  return {
    ...dataText,
    /* 12px flat rather than the data role's clamp: this is a rail control at a
       fixed width, not body copy that should breathe with the viewport, and 12
       is the floor DM Mono is allowed at. */
    fontSize: 12,
    /* `1 1 auto`, NOT `1 1 0`. Three equal thirds of the rail's 208px is 69
       each, and "Exhibition" at 12px DM Mono needs 72 — it clipped to
       "Exhibitior". Sizing from the labels and sharing the slack keeps all
       three whole, which matters more here than three identical boxes: the
       labels are the control. */
    flex: "1 1 auto",
    minWidth: 0,
    height: "100%",
    padding: "0 4px",
    textAlign: "center",
    whiteSpace: "nowrap",
    border: "none",
    borderRadius: r.chip,
    background: selected ? t.recess : "transparent",
    color: selected || hovered ? t.text : t.text2,
    cursor: "pointer",
    transition: uiTransition(),
    ...(focusVisible ? focusRing : null),
  };
}

export function ThemeToggle({ variant = "kit" }: { variant?: ThemeToggleVariant } = {}) {
  const { theme, setTheme } = useTheme();
  const [keyboardFocus, setKeyboardFocus] = useState<ThemeChoice | null>(null);
  const [hovered, setHovered] = useState<ThemeChoice | null>(null);
  const buttons = useRef(new Map<ThemeChoice, HTMLButtonElement | null>());

  /* Roving tabindex: the group is one tab stop and the arrows move within it,
     which is the radio-group pattern a screen reader announces. */
  const step = (delta: number) => {
    const from = OPTIONS.findIndex((option) => option.value === theme);
    const next = OPTIONS[(from + delta + OPTIONS.length) % OPTIONS.length];
    setTheme(next.value);
    setKeyboardFocus(next.value);
    buttons.current.get(next.value)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      step(-1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onKeyDown}
      /* NO PADDING HERE, AND THAT IS NOT AN OVERSIGHT. `display` and `gap` are
         BG-P02's and are left exactly as they were; a `padding: 2` would have
         inset the active segment neatly from the group's border, but padding is
         structural and this prompt restyles rather than relayouts. The active
         segment therefore meets the group's hairline directly. If that reads
         tight, the fix is a padding change and belongs to the prompt that owns
         this surface's layout — reported, not quietly taken. */
      style={
        variant === "rail"
          ? RAIL_GROUP
          : {
              display: "flex",
              gap: 2,
              ...themeToggleGroupStyle,
            }
      }
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current.set(option.value, element);
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => setTheme(option.value)}
            onMouseEnter={() => setHovered(option.value)}
            onMouseLeave={() => setHovered(null)}
            onFocus={(event) => {
              // Keyboard focus only — a click should not leave a ring behind.
              let visible = true;
              try {
                visible = event.currentTarget.matches(":focus-visible");
              } catch {
                /* :focus-visible unsupported. Show the ring rather than hide it. */
              }
              if (visible) setKeyboardFocus(option.value);
            }}
            onBlur={() => setKeyboardFocus(null)}
            style={
              variant === "rail"
                ? railSegmentStyle({
                    selected,
                    hovered: hovered === option.value,
                    focusVisible: keyboardFocus === option.value,
                  })
                : {
                    padding: "4px 8px",
                    border: "none",
                    ...themeToggleSegmentStyle({
                      selected,
                      hovered: hovered === option.value,
                      focusVisible: keyboardFocus === option.value,
                    }),
                  }
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;

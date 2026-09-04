import { useRef, useState, type KeyboardEvent } from "react";
import { useTheme, type ThemeChoice } from "@/contexts/ThemeContext";
import { t } from "@/lib/theme/tokens";

/* ────────────────────────────────────────────────
   ThemeToggle — the control that flips the room.

   Deliberately plain: tokens for colour, no layout opinions, no radius from the
   scale. BG-P07 styles it properly. What is here is what accessibility
   requires and nothing more.

   An ARIA radio group of buttons rather than native radio inputs, because
   index.css forces a background, border and font-size onto every `input` in the
   app with !important, which a native radio cannot escape.

   The group paints its own --bg ground. That is not decoration: it is what
   makes the colour contract's measured pairings hold. The rails around it still
   carry the legacy dark paint, and --text2 on that ground is not a measured
   pairing; --text2 on --bg is (5.26 Exhibition, 7.65 Dusk).
──────────────────────────────────────────────── */

const OPTIONS: readonly { value: ThemeChoice; label: string }[] = [
  { value: "exhibition", label: "Exhibition" },
  { value: "dusk", label: "Dusk" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [keyboardFocus, setKeyboardFocus] = useState<ThemeChoice | null>(null);
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
      style={{
        display: "flex",
        gap: 2,
        background: t.bg,
        border: `1px solid ${t.line}`,
      }}
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
            style={{
              padding: "4px 8px",
              font: "inherit",
              cursor: "pointer",
              background: selected ? t.recess : "transparent",
              color: selected ? t.text : t.text2,
              border: "none",
              /* The spec's ring is 2px --lit, but BG-P01 measured --lit at
                 1.80:1 on Exhibition's ground — below the 3.0:1 UI floor, and
                 recorded as such in contrast.test.ts. --text carries the ring
                 until BG-P07 settles the definition system-wide. */
              outline: keyboardFocus === option.value ? `2px solid ${t.text}` : "none",
              outlineOffset: 2,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;

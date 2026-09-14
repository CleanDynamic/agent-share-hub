import { t } from "@/lib/theme/tokens";
import { eyebrow } from "@/lib/theme/type";

interface AuthDividerProps {
  text: string;
}

/**
 * The "or sign in with email" rule.
 *
 * THE LABEL REBUILDS THE CARD'S GROUND RATHER THAN GUESSING AT IT. The rule is
 * a full-width bar behind the label, so the label has to be opaque or the line
 * runs through the words — and the card it sits on is `--glass`, which is
 * translucent and therefore has no single colour to copy. The two-layer
 * background here is that colour, constructed: `--bg` painted opaque, with
 * `--glass` over it, which is exactly what the card composites to. It follows
 * the theme switch like everything else because both halves are tokens.
 *
 * The one thing it cannot see is AuthShell's radial wash, which sits between the
 * ground and the card. At 9% alpha under a .55/.42 glass layer that leaves under
 * three parts in 255 unaccounted for on either room — below the threshold where
 * a 12px-tall patch behind a label could read as a patch, and the reason the
 * wash's alpha is a number this file cares about.
 */
export function AuthDivider({ text }: AuthDividerProps) {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ margin: "20px 0" }}
    >
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "0.5px",
          background: t.line,
        }}
      />
      <span
        style={{
          position: "relative",
          background: `linear-gradient(${t.glass}, ${t.glass}), ${t.bg}`,
          padding: "0 12px",
          ...eyebrow,
          color: t.text2,
        }}
      >
        {text}
      </span>
    </div>
  );
}

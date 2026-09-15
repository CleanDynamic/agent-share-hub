import { t } from "@/lib/theme/tokens";
import { data as dataText, tabular } from "@/lib/theme/type";
import { feedback } from "@/lib/theme/motion";

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

interface PasswordStrengthMeterProps {
  strength: PasswordStrength;
}

/* ────────────────────────────────────────────────────────────────────────────
   THREE SEGMENTS, AND THREE COLOURS THAT ARE NOT A TRAFFIC LIGHT.

   `#ef4444 / #f59e0b / #2EC4B6 / #E8571A` stood here — a red-amber-green ramp
   plus the legacy orange, four raw hexes and four tiers on a four-segment bar.
   The colours are now `--cat-breakage`, `--cat-artefact` and `--evidence`,
   which LOOK like a traffic light and are not one: they are three of the nine
   part-category hues doing a second, legitimate job. That distinction matters
   because it is what makes them measurable — every category hue is held to
   ≥4.83:1 on Exhibition and ≥5.75:1 on Dusk, and `contrast.test.ts` measures
   all three again on the auth card's own glass ground, which is what these
   actually sit on. A hand-picked red and amber would clear neither floor on
   Exhibition, which is exactly what the old ramp did not do.

   FOUR TIERS, THREE SEGMENTS. `calculatePasswordStrength` keeps its four
   returns untouched — it is validation, and the signup form's own gate reads
   it. What collapses is the DISPLAY: a bar has three states a reader can act
   on (this will not do, this will do, this is good), and the fourth was a
   fourth colour for "good, but more so". `good` and `strong` therefore share a
   full bar in `--evidence` and are told apart by the word beside it, which is
   the part a reader actually reads.

   THE SEGMENT RADIUS IS 2px, BELOW THE SCALE, ON PURPOSE. `--r-chip` is 8px and
   a segment is 4px tall: any radius at or above half the height is a capsule,
   and the theme's rule is that nothing is a pill. 2px is the largest soft
   corner a 4px bar can carry, and it is the same exception the build page's
   3px cells and the card's 5px marks already take.
   ──────────────────────────────────────────────────────────────────────────── */

const SEGMENTS = 3;

const strengthConfig: Record<
  PasswordStrength,
  { filled: number; colour: string; label: string }
> = {
  weak: { filled: 1, colour: t.catBreakage, label: "Weak" },
  fair: { filled: 2, colour: t.catArtefact, label: "Fair" },
  good: { filled: SEGMENTS, colour: t.evidence, label: "Good" },
  strong: { filled: SEGMENTS, colour: t.evidence, label: "Strong" },
};

export function PasswordStrengthMeter({ strength }: PasswordStrengthMeterProps) {
  const config = strengthConfig[strength];

  return (
    <div className="flex items-center" style={{ gap: "8px", marginTop: "8px" }}>
      <div
        className="flex"
        style={{ gap: "4px", flex: 1 }}
        role="img"
        aria-label={`Password strength: ${config.label}`}
      >
        {Array.from({ length: SEGMENTS }, (_, index) => index + 1).map((segment) => (
          <div
            key={segment}
            style={{
              height: "4px",
              flex: 1,
              borderRadius: 2,
              /* `--recess` is the unfilled track: a surface the page is cut
                 into, which is what an empty meter is. `--line` would have been
                 a hairline stretched to four pixels. */
              background: segment <= config.filled ? config.colour : t.recess,
              transition: feedback("background-color"),
            }}
          />
        ))}
      </div>
      <span
        style={{
          ...dataText,
          ...tabular,
          fontSize: "12px",
          fontWeight: 500,
          color: config.colour,
          minWidth: "48px",
        }}
      >
        {config.label}
      </span>
    </div>
  );
}

/**
 * Strength tiers (Phase 17 spec):
 *  - weak:   <8 chars, or only letters, or only numbers
 *  - fair:   8+ chars with mixed letters/numbers
 *  - good:   10+ chars with letters/numbers/symbols
 *  - strong: 12+ chars with upper + lower + numbers + symbols
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) return "weak";

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const hasLetter = hasLower || hasUpper;
  const len = password.length;

  if (len < 8 || (hasLetter && !hasNumber && !hasSymbol) || (!hasLetter && hasNumber && !hasSymbol)) {
    return "weak";
  }

  if (len >= 12 && hasUpper && hasLower && hasNumber && hasSymbol) {
    return "strong";
  }

  if (len >= 10 && hasLetter && hasNumber && hasSymbol) {
    return "good";
  }

  return "fair";
}

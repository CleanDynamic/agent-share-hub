import { Sparkles, X } from "lucide-react";
import { tokens } from "./tokens";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { elevation, SCRIM } from "@/lib/theme/elevation";
import { tierFill, xpText } from "@/lib/theme/progress";

export interface XpToastProps {
  xp: number;
  reason: string;
  onDismiss?: () => void;
}

/**
 * Compact bottom-right XP toast for ambient XP events from the realtime
 * stream. Pairs with PostXpFootnote (the louder publish-success variant).
 *
 * THIS MOUNTS APP-WIDE, so it has to be legible over a light page, a dark
 * page and the composer's flat working ground — which a toast struck for a
 * #25252F room was not: `+N XP` was amber type at 3.01:1 on Exhibition, over
 * a shell that assumed a dark ground beneath it.
 *
 * ONE AMBER-FILLED ELEMENT, AND IT IS THE XP FIGURE (BG-P28b). The figure was
 * amber TYPE beside an orange-filled medallion — the wrong way round twice
 * over. The medallion steps down to the quiet inset surface and the figure
 * becomes the amber chip with `--on-lit` on it, so the toast has exactly one
 * lit thing and it is the number you came to read.
 */
export default function XpToast({ xp, reason, onDismiss }: XpToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-3"
      style={{
        padding: "10px 14px",
        minWidth: 240,
        borderRadius: tokens.radiusPanel,
        background: t.glass,
        border: `0.5px solid ${t.glassBorder}`,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        ...elevation.raised,
        fontFamily: tokens.fontSans,
      }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 30,
          height: 30,
          borderRadius: r.chip,
          background: t.glass2,
          border: `0.5px solid ${t.line}`,
          flexShrink: 0,
        }}
      >
        <Sparkles size={15} color={t.text2} />
      </span>

      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          style={{
            ...xpText("onLit"),
            background: tierFill("highest").background,
            borderRadius: r.chip,
            padding: "1px 7px",
            alignSelf: "flex-start",
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          +{xp} XP
        </span>
        <span
          style={{
            fontSize: 11.5,
            color: tokens.textMuted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 220,
          }}
        >
          {reason}
        </span>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="ml-1 inline-flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          borderRadius: r.chip,
          background: "transparent",
          border: "none",
          color: tokens.textFaint,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <X size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}

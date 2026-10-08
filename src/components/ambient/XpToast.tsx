import { Sparkles, X } from "lucide-react";
import { tokens, xpColor } from "./tokens";

export interface XpToastProps {
  xp: number;
  reason: string;
  onDismiss?: () => void;
}

/**
 * Compact bottom-right XP toast for ambient XP events from the realtime
 * stream. Pairs with PostXpFootnote (which is the louder publish-success
 * variant).
 */
export default function XpToast({ xp, reason, onDismiss }: XpToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-3"
      style={{
        padding: "7px 10px",
        minWidth: 240,
        borderRadius: tokens.radiusPanel,
        background: tokens.shell,
        border: "0.5px solid color-mix(in srgb, var(--action) 32%, transparent)",
        boxShadow: "var(--elev-raised)",
        fontFamily: tokens.fontSans,
      }}
    >
      <span
        className="inline-flex items-center justify-center"
        style={{
          width: 25,
          height: 25,
          borderRadius: 9,
          background: tokens.orangeGradient,
          flexShrink: 0,
          boxShadow: "0 2px 10px color-mix(in srgb, var(--action) 40%, transparent)",
        }}
      >
        <Sparkles size={15} color="var(--text)" />
      </span>

      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          style={{
            fontFamily: tokens.fontMono,
            fontSize: 13,
            fontWeight: 700,
            color: xpColor,
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
          width: 18,
          height: 18,
          borderRadius: 6,
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

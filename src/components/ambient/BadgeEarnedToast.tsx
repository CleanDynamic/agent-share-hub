import { Award, X } from "lucide-react";
import { tokens } from "./tokens";

export interface BadgeEarnedToastProps {
  title: string;
  description?: string;
  onDismiss?: () => void;
  onView?: () => void;
}

/**
 * BadgeEarnedToast — ambient celebration toast for newly earned creator
 * badges. Fires from the user_badges realtime stream (state='earned').
 */
export default function BadgeEarnedToast({
  title,
  description,
  onDismiss,
  onView,
}: BadgeEarnedToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: "14px 16px",
        minWidth: 300,
        maxWidth: 360,
        borderRadius: tokens.radiusPanel,
        background: tokens.shell,
        border: `0.5px solid ${tokens.orange}66`,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        boxShadow:
          "0 16px 40px rgba(0,0,0,0.50), 0 0 0 1px rgba(232,87,26,0.14)",
        fontFamily: tokens.fontSans,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex shrink-0 items-center justify-center"
          style={{
            width: 38,
            height: 38,
            borderRadius: tokens.radiusPill,
            background: tokens.orangeGradient,
            boxShadow: "0 3px 14px rgba(232,87,26,0.45)",
          }}
        >
          <Award size={19} color="#fff" />
        </span>

        <div className="min-w-0 flex-1">
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: tokens.orange,
              textTransform: "uppercase",
            }}
          >
            Badge earned
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 14,
              fontWeight: 600,
              color: tokens.text,
              lineHeight: 1.25,
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: tokens.textMuted,
                lineHeight: 1.4,
              }}
            >
              {description}
            </div>
          )}
          {onView && (
            <button
              type="button"
              onClick={onView}
              style={{
                marginTop: 10,
                padding: "6px 12px",
                borderRadius: tokens.radiusPill,
                background: tokens.orangeGradient,
                border: "none",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View trophies
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "transparent",
            border: "none",
            color: tokens.textFaint,
            cursor: "pointer",
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={13} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

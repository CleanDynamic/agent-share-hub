import { Award, X } from "lucide-react";
import { tokens } from "./tokens";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { elevation } from "@/lib/theme/elevation";
import { tierFill, xpText } from "@/lib/theme/progress";

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
        background: t.glass,
        /**
         * BG-P28b. Was `${tokens.orange}66` — an eight-digit hex built by
         * gluing an alpha suffix onto a value that is now `var(--action)`, so
         * it produced `var(--action)66`, which is not a colour at all and left
         * the toast borderless. Toasts take --glass-border and elevation.raised
         * per the theme, in every room and over every page beneath them.
         */
        border: `0.5px solid ${t.glassBorder}`,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
        ...elevation.raised,
        fontFamily: tokens.fontSans,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex shrink-0 items-center justify-center"
          style={{
            width: 38,
            height: 38,
            // A circle, which is what --r-full is for.
            borderRadius: r.full,
            // A new badge IS the achievement, so the medallion is the one
            // amber-filled element here rather than the XP figure.
            background: tierFill("highest").background,
          }}
        >
          <Award size={19} color={tierFill("highest").color} />
        </span>

        <div className="min-w-0 flex-1">
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: tokens.textMuted,
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
                borderRadius: r.control,
                background: t.action,
                border: "none",
                color: t.onAction,
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

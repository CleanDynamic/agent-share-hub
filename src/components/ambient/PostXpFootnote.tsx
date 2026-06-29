import { useEffect, useState } from "react"
import { Sparkles, X } from "lucide-react"
import { tokens, xpColor } from "./tokens"

export interface PostXpFootnoteProps {
  /** XP awarded for the action. */
  xp: number
  /** Short description, e.g. "Blueprint published". */
  label: string
  /** Controls visibility. */
  visible?: boolean
  /** Auto-dismiss after this many ms (0 = never). */
  autoHideMs?: number
  /** Called when the toast dismisses (timer or close button). */
  onDismiss?: () => void
}

/**
 * PostXpFootnote — the publish-success toast that connects CREATING to
 * PROGRESSING. The single most important toast in the system. L1.
 */
export default function PostXpFootnote({
  xp,
  label,
  visible = true,
  autoHideMs = 4000,
  onDismiss,
}: PostXpFootnoteProps) {
  const [mounted, setMounted] = useState(visible)

  useEffect(() => {
    setMounted(visible)
    if (visible && autoHideMs > 0) {
      const t = setTimeout(() => {
        setMounted(false)
        onDismiss?.()
      }, autoHideMs)
      return () => clearTimeout(t)
    }
  }, [visible, autoHideMs, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className="transition-all duration-300"
      style={{
        fontFamily: tokens.fontSans,
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(10px)",
        pointerEvents: mounted ? "auto" : "none",
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{
          padding: "12px 14px",
          minWidth: 268,
          borderRadius: tokens.radiusPanel,
          background: tokens.shell,
          border: `0.5px solid rgba(232,87,26,0.40)`,
          backdropFilter: tokens.glass,
          WebkitBackdropFilter: tokens.glass,
          boxShadow: "0 14px 36px rgba(0,0,0,0.40), 0 0 0 1px rgba(232,87,26,0.10)",
        }}
      >
        <span
          className="flex shrink-0 items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: tokens.radiusPill,
            background: tokens.orangeGradient,
            boxShadow: "0 3px 14px rgba(232,87,26,0.45)",
          }}
        >
          <Sparkles size={18} color="#fff" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              style={{
                fontFamily: tokens.fontMono,
                fontSize: 15,
                fontWeight: 700,
                color: xpColor,
                letterSpacing: "-0.01em",
              }}
            >
              +{xp} XP
            </span>
            <span style={{ color: tokens.textFaint, fontSize: 13 }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: tokens.text }}>
              {label}
            </span>
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: tokens.textMuted }}>
            Added to your progress
          </div>
        </div>

        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setMounted(false)
            onDismiss?.()
          }}
          className="shrink-0 transition-opacity hover:opacity-100"
          style={{ color: tokens.textFaint, opacity: 0.7 }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

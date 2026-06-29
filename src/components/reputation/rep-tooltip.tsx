import { Info } from "lucide-react"
import { tokens, fontSans } from "./tokens"

/**
 * RepTooltip — the hover/focus explainer shown wherever reputation appears.
 * No props: drop it next to any reputation value. CSS-only reveal.
 */
export default function RepTooltip() {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="What is reputation?"
        className="inline-flex items-center justify-center rounded-full transition-colors"
        style={{
          width: 18,
          height: 18,
          color: tokens.textMuted,
          border: tokens.borderSoft,
          background: "rgba(46,196,182,0.10)",
          cursor: "help",
        }}
      >
        <Info size={11} color={tokens.teal} aria-hidden="true" />
      </button>

      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        style={{
          width: 248,
          padding: "10px 12px",
          borderRadius: tokens.radiusCard,
          border: tokens.borderStrong,
          background: tokens.card,
          ...tokens.glass,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          fontFamily: fontSans,
          fontSize: 12,
          lineHeight: 1.5,
          color: tokens.text,
        }}
      >
        <strong style={{ color: tokens.teal, fontWeight: 600 }}>
          Reputation
        </strong>{" "}
        measures how valued your work is — saves, remixes, accepted solutions
        and votes from established members.{" "}
        <strong style={{ color: tokens.orange, fontWeight: 600 }}>XP</strong>{" "}
        measures activity. They&apos;re different on purpose.
      </span>
    </span>
  )
}

import { useEffect, useRef, useState } from "react"
import { Sparkles } from "lucide-react"
import { tokens } from "./tokens"

export interface XpEvent {
  id: string
  xp: number
  label: string
}

export interface XpToastProps {
  events: XpEvent[]
  onDismiss: (id: string) => void
}

interface ToastItem {
  id: string
  xp: number
  count: number
  label: string
  createdAt: number
  leaving: boolean
}

const COALESCE_MS = 2000
const HOLD_MS = 2500
const MAX_STACK = 3

/**
 * Bottom-right XP gain toasts. Slides up + fades in (200ms), holds 2.5s.
 * Gains arriving within 2s coalesce into a single running-total toast.
 */
export default function XpToast({ events, onDismiss }: XpToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const seen = useRef<Set<string>>(new Set())
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const fresh = events.filter((e) => !seen.current.has(e.id))
    if (fresh.length === 0) return

    setToasts((prev) => {
      let next = [...prev]
      const now = Date.now()

      for (const e of fresh) {
        seen.current.add(e.id)
        const head = next.find((t) => !t.leaving)
        const recent =
          next.length > 0 &&
          next[next.length - 1] &&
          now - next[next.length - 1].createdAt < COALESCE_MS &&
          !next[next.length - 1].leaving

        if (recent) {
          // Merge into the most recent toast
          const target = next[next.length - 1]
          const count = target.count + 1
          next[next.length - 1] = {
            ...target,
            xp: target.xp + e.xp,
            count,
            label: `${count} actions`,
            createdAt: now,
          }
          // Reset its dismiss timer
          if (timers.current[target.id]) clearTimeout(timers.current[target.id])
          timers.current[target.id] = setTimeout(() => beginLeave(target.id), HOLD_MS)
        } else {
          const item: ToastItem = {
            id: e.id,
            xp: e.xp,
            count: 1,
            label: e.label,
            createdAt: now,
            leaving: false,
          }
          next.push(item)
          timers.current[item.id] = setTimeout(() => beginLeave(item.id), HOLD_MS)
        }
        void head
      }

      // Keep only the newest MAX_STACK
      if (next.length > MAX_STACK) next = next.slice(next.length - MAX_STACK)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  function beginLeave(id: string) {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      onDismiss(id)
    }, 220)
  }

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout)
    }
  }, [])

  return (
    <div
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 60,
        pointerEvents: "none",
      }}
      aria-live="polite"
    >
      <style>{`
        @keyframes xptoast-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "9px 14px",
            borderRadius: tokens.radiusPill,
            background: tokens.shell,
            border: tokens.borderStrong,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            color: tokens.text,
            fontFamily: tokens.fontSans,
            fontSize: 13,
            fontWeight: 500,
            ...tokens.glass,
            animation: t.leaving ? undefined : "xptoast-in 200ms ease-out",
            opacity: t.leaving ? 0 : 1,
            transform: t.leaving ? "translateY(14px)" : "translateY(0)",
            transition: "opacity 200ms ease-out, transform 200ms ease-out",
            pointerEvents: "auto",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "rgba(232,87,26,0.18)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={13} color={tokens.orange} />
          </span>
          <span style={{ fontFamily: tokens.fontMono, fontWeight: 700, color: tokens.orange }}>
            {`+${t.xp.toLocaleString("en-US")} XP`}
          </span>
          <span style={{ color: tokens.textMuted }}>·</span>
          <span style={{ color: tokens.text }}>{t.label}</span>
        </div>
      ))}
    </div>
  )
}

import { useState } from "react"

interface User {
  display_name: string
  avatar_url?: string
}

export function ComposerBar({ user }: { user?: User }) {
  const [isFocused, setIsFocused] = useState(false)

  const userInitials = user?.display_name
    ? user.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "SU"

  return (
    <div
      className="flex items-center gap-4 rounded-2xl transition-all duration-200"
      style={{
        padding: '14px 16px',
        marginBottom: '0px',
        background: "rgba(27, 27, 32, 0.4)",
        backdropFilter: "blur(40px)",
        border: `1px solid ${isFocused ? "rgba(232, 87, 26, 0.3)" : "rgba(255, 255, 255, 0.05)"}`,
      }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
        style={{
          background: "rgba(232, 87, 26, 0.15)",
          color: "#E8571A",
          border: "1px solid rgba(232, 87, 26, 0.3)",
        }}
      >
        {userInitials}
      </div>

      {/* Input */}
      <input
        type="text"
        placeholder="Share something..."
        className="flex-1 bg-transparent text-white placeholder:text-white/30 text-sm focus:outline-none"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
    </div>
  )
}

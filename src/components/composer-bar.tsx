import { useState } from "react"
import { useUploadPicker } from "@/contexts/UploadPickerContext"

interface User {
  display_name: string
  avatar_url?: string
}

export function ComposerBar({ user }: { user?: User }) {
  const { openUploadTypePicker } = useUploadPicker()
  const [isFocused] = useState(false)

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
      className="flex items-center gap-4 rounded-2xl transition-feedback duration-base"
      style={{
        padding: '14px 16px',
        marginBottom: '0px',
        background: "var(--recess)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${isFocused ? "color-mix(in srgb, var(--action) 30%, transparent)" : "var(--line)"}`,
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
        style={{
          background: "color-mix(in srgb, var(--action) 15%, transparent)",
          color: "var(--action)",
          border: "1px solid color-mix(in srgb, var(--action) 30%, transparent)",
        }}
      >
        {userInitials}
      </div>

      <div
        onClick={() => openUploadTypePicker()}
        style={{ flex: 1, color: "var(--text2)", fontSize: 14, cursor: "pointer" }}
      >
        Share something...
      </div>
    </div>
  )
}

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
      className="flex items-center gap-4 rounded-2xl transition-all duration-200"
      style={{
        padding: '14px 16px',
        marginBottom: '0px',
        background: "rgba(27, 27, 32, 0.4)",
        backdropFilter: "blur(40px)",
        border: `1px solid ${isFocused ? "rgba(139, 69, 19, 0.3)" : "rgba(255, 255, 255, 0.05)"}`,
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
        style={{
          background: "rgba(139, 69, 19, 0.15)",
          color: "#8B4513",
          border: "1px solid rgba(139, 69, 19, 0.3)",
        }}
      >
        {userInitials}
      </div>

      <div
        onClick={() => openUploadTypePicker()}
        style={{ flex: 1, color: "rgba(255,255,255,0.30)", fontSize: 14, cursor: "pointer" }}
      >
        Share something...
      </div>
    </div>
  )
}

import { COLORS, FONT } from "./tokens"

/**
 * StreakInlineNote — the only L1 freeze-education surface. A single quiet line
 * shown under the flame on the progress page. No management UI, no chrome.
 */
export default function StreakInlineNote() {
  return (
    <p
      style={{
        fontFamily: FONT.sans,
        fontSize: 13,
        lineHeight: 1.5,
        color: COLORS.textMuted,
        margin: 0,
      }}
    >
      Any action keeps it going. Life happens — you get 3 free passes a month.
    </p>
  )
}

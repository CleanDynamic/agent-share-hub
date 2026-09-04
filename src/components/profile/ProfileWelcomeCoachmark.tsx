import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "profile:welcome-coachmark-dismissed";

interface ProfileWelcomeCoachmarkProps {
  visible: boolean;
}

/**
 * Tiny dismissible banner shown on a brand-new own profile (zero content).
 * Dismissal is persisted in localStorage so it never re-appears.
 */
export function ProfileWelcomeCoachmark({ visible }: ProfileWelcomeCoachmarkProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!visible) return;
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [visible]);

  if (!visible || dismissed) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 16px",
        background: "rgba(46,196,182,0.06)",
        border: "0.5px solid rgba(46,196,182,0.20)",
        borderRadius: "8px",
        marginBottom: "16px",
        fontFamily: "Figtree, sans-serif",
        fontSize: "13px",
        fontWeight: 500,
        color: "rgba(46,196,182,0.85)",
      }}
    >
      <span>
        Welcome to NeoScale. Start by creating a blueprint or bookmarking
        content from Discover.
      </span>
      <button
        type="button"
        aria-label="Dismiss welcome message"
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "rgba(46,196,182,0.85)",
          padding: 4,
          flexShrink: 0,
          display: "inline-flex",
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

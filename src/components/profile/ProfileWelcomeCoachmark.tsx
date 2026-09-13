import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body } from "@/lib/theme/type";

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
        /* A welcome, not a warning: the recess ground the rest of the page
           uses for an inset panel, with ordinary text on it. */
        background: t.recess,
        border: `1px solid ${t.line}`,
        borderRadius: r.panel,
        marginBottom: "16px",
        ...body,
        fontSize: "13px",
        fontWeight: 500,
        color: t.text,
      }}
    >
      <span>
        Welcome to buildgallery. Start by creating a blueprint or bookmarking
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
          color: t.text2,
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

// BG-P26. The disconnection banner, repainted onto `--cat-breakage`.
//
// It was `bg-destructive/10` with `border-destructive/30` — shadcn palette
// colours, not theme tokens, so the banner did not change between the rooms.
// `--cat-breakage` is this system's own token for a break, and it is the one
// BG-P26 names for this banner. Measured 5.17:1 on Exhibition and 5.75:1 on
// Dusk against `--bg`, so it is legal as text and not only as a mark.

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { uiTransition } from "@/lib/theme/controls";

export function ConnectionBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!offline || dismissed) return null;

  return (
    <div
      role="status"
      className="px-4 py-2 flex items-center justify-between text-sm"
      style={{
        background: tokenAlpha("cat-breakage", 0.1),
        borderBottom: `1px solid ${tokenAlpha("cat-breakage", 0.3)}`,
      }}
    >
      <p style={{ color: t.catBreakage }}>
        Connection issue — some content may not load. Refresh to try again.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="p-1"
        style={{ color: t.catBreakage, transition: uiTransition() }}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

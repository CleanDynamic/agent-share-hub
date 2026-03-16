import { useState, useEffect } from "react";
import { X } from "lucide-react";

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
    <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2 flex items-center justify-between text-sm">
      <p className="text-destructive">
        Connection issue — some content may not load. Refresh to try again.
      </p>
      <button onClick={() => setDismissed(true)} className="p-1 text-destructive hover:text-destructive/80">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

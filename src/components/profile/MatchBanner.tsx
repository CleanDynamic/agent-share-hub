import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "profile:match-banner-dismissed";

interface MatchBannerProps {
  /** Profile being viewed. */
  targetUserId: string;
  /** Currently signed-in viewer (null = guest, hide). */
  viewerId: string | null;
  /** Hide entirely on the own profile. */
  isOwnProfile: boolean;
}

/**
 * Lightweight visitor-only "shared interests" banner.
 *
 * Compares `profiles.user_interests` arrays of viewer + target. Renders only
 * when there's at least one overlapping interest. Dismissal is per-target and
 * persisted in localStorage.
 */
export function MatchBanner({ targetUserId, viewerId, isOwnProfile }: MatchBannerProps) {
  const [shared, setShared] = useState<string[] | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isOwnProfile || !viewerId) {
      setShared(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_interests")
        .in("id", [viewerId, targetUserId]);
      if (cancelled || error || !data) return;
      const viewer = data.find((p: any) => p.id === viewerId) as any;
      const target = data.find((p: any) => p.id === targetUserId) as any;
      const a: string[] = Array.isArray(viewer?.user_interests) ? viewer.user_interests : [];
      const b: string[] = Array.isArray(target?.user_interests) ? target.user_interests : [];
      if (!a.length || !b.length) {
        setShared([]);
        return;
      }
      const setB = new Set(b.map((x) => x.toLowerCase()));
      const overlap = a.filter((x) => setB.has(x.toLowerCase()));
      setShared(overlap);
    })();
    return () => {
      cancelled = true;
    };
  }, [viewerId, targetUserId, isOwnProfile]);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(`${STORAGE_KEY}:${targetUserId}`) === "1");
    } catch {
      setDismissed(false);
    }
  }, [targetUserId]);

  if (isOwnProfile || !viewerId) return null;
  if (!shared || shared.length === 0 || dismissed) return null;

  const preview = shared.slice(0, 3).join(", ");
  const extra = shared.length > 3 ? ` +${shared.length - 3}` : "";

  return (
    <div
      role="status"
      className="mt-4 flex items-center gap-3 rounded-lg px-4 py-3"
      style={{
        background: "rgba(46,196,182,0.06)",
        border: "0.5px solid rgba(46,196,182,0.20)",
        color: "rgba(46,196,182,0.90)",
        fontFamily: "Inter, sans-serif",
        fontSize: "13px",
        fontWeight: 500,
      }}
    >
      <Sparkles size={14} className="shrink-0" />
      <span className="flex-1 truncate">
        You both build with <span className="font-semibold">{preview}</span>
        {extra}.
      </span>
      <button
        type="button"
        aria-label="Dismiss shared interests banner"
        onClick={() => {
          try {
            localStorage.setItem(`${STORAGE_KEY}:${targetUserId}`, "1");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/5"
      >
        <X size={12} />
      </button>
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import XpToast from "./XpToast";
import LineageXpToast from "./LineageXpToast";
import BadgeEarnedToast from "./BadgeEarnedToast";
import PostXpFootnote from "./PostXpFootnote";
import WelcomeXpModal from "./WelcomeXpModal";
import { useWelcomeXp } from "./useWelcomeXp";

type ToastKind = "xp" | "lineage" | "badge" | "footnote";

interface ToastEntry {
  id: string;
  kind: ToastKind;
  // xp + lineage
  xp?: number;
  reason?: string;
  message?: string;
  // badge
  title?: string;
  description?: string;
  // footnote
  label?: string;
}

interface CoalesceState {
  xp: number;
  reason: string;
  timer: ReturnType<typeof setTimeout> | null;
}

const MAX_VISIBLE = 5;
const COALESCE_MS = 2000;

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Singleton ambient gamification toast bus.
 * - Subscribes (Supabase realtime) to xp_events + user_badges for the
 *   current user.
 * - Routes rows to XpToast / LineageXpToast / BadgeEarnedToast.
 * - Listens for `gamification:post-xp` window events to render
 *   PostXpFootnote from places that don't have a dedicated success screen.
 * - Owns the one-time WelcomeXpModal.
 */
export default function GamificationToasts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const coalesceRef = useRef<Map<string, CoalesceState>>(new Map());
  const welcome = useWelcomeXp();

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((entry: Omit<ToastEntry, "id">) => {
    setToasts((t) => {
      const next = [...t, { ...entry, id: rid() }];
      return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
    });
  }, []);

  // Auto-dismiss after timeout
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.id), t.kind === "badge" ? 8000 : 5000),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  // Realtime subscriptions
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const flushCoalesce = (key: string) => {
      const s = coalesceRef.current.get(key);
      if (!s) return;
      push({ kind: "xp", xp: s.xp, reason: s.reason });
      coalesceRef.current.delete(key);
    };

    const xpChannel = supabase
      .channel(`gamification-xp-${rid()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "xp_events",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (!row || typeof row.amount !== "number") return;

          const actionType = row?.metadata?.action_type as string | undefined;
          if (actionType === "remix_received" || actionType === "lineage_cut") {
            push({
              kind: "lineage",
              xp: row.amount,
              message:
                actionType === "remix_received"
                  ? "Your blueprint was remixed"
                  : "Your work earned lineage credit",
            });
            return;
          }

          const reasonStr = (row.reason as string) || "Earned XP";
          const key = reasonStr.split(":")[0] || reasonStr;
          const existing = coalesceRef.current.get(key);
          if (existing) {
            existing.xp += row.amount;
            existing.reason = reasonStr;
            if (existing.timer) clearTimeout(existing.timer);
            existing.timer = setTimeout(() => flushCoalesce(key), COALESCE_MS);
          } else {
            const state: CoalesceState = {
              xp: row.amount,
              reason: reasonStr,
              timer: null,
            };
            state.timer = setTimeout(() => flushCoalesce(key), COALESCE_MS);
            coalesceRef.current.set(key, state);
          }
        },
      )
      .subscribe();

    const badgeChannel = supabase
      .channel(`gamification-badges-${rid()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_badges",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;
          if (row.state === "pending_reveal") return; // silent
          if (row.state === "earned") {
            push({
              kind: "badge",
              title: row.title || row.badge_key || "New badge",
              description: row.description || undefined,
            });
          }
        },
      )
      .subscribe();

    return () => {
      coalesceRef.current.forEach((s) => s.timer && clearTimeout(s.timer));
      coalesceRef.current.clear();
      supabase.removeChannel(xpChannel);
      supabase.removeChannel(badgeChannel);
    };
  }, [user?.id, push]);

  // Custom event bus for PostXpFootnote (e.g. bounty solution submit)
  useEffect(() => {
    const onPostXp = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const xp = typeof detail.xp === "number" ? detail.xp : 0;
      const label = (detail.label as string) || "Submitted";
      if (xp > 0) push({ kind: "footnote", xp, label });
    };
    window.addEventListener("gamification:post-xp", onPostXp);
    return () => window.removeEventListener("gamification:post-xp", onPostXp);
  }, [push]);

  return (
    <>
      {/* Toast portal — bottom-right stack */}
      <div
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 1200,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            {t.kind === "xp" && (
              <XpToast
                xp={t.xp || 0}
                reason={t.reason || ""}
                onDismiss={() => dismiss(t.id)}
              />
            )}
            {t.kind === "lineage" && (
              <LineageXpToast
                xp={t.xp || 0}
                message={t.message}
                onDismiss={() => dismiss(t.id)}
              />
            )}
            {t.kind === "badge" && (
              <BadgeEarnedToast
                title={t.title || "New badge"}
                description={t.description}
                onDismiss={() => dismiss(t.id)}
                onView={() => {
                  dismiss(t.id);
                  navigate("/analytics?tab=trophies");
                }}
              />
            )}
            {t.kind === "footnote" && (
              <PostXpFootnote
                xp={t.xp || 0}
                label={t.label || "Submitted"}
                onDismiss={() => dismiss(t.id)}
              />
            )}
          </div>
        ))}
      </div>

      <WelcomeXpModal
        open={welcome.open}
        onStart={() => {
          welcome.dismiss();
          navigate("/analytics");
        }}
        onClose={() => {
          welcome.dismiss();
        }}
      />
    </>
  );
}

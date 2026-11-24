import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import BadgeEarnedToast from "./BadgeEarnedToast";
import StreakMilestoneModal from "@/components/streaks/streak-milestone-modal";

interface ToastEntry {
  id: string;
  title: string;
  description?: string;
}

const MAX_VISIBLE = 5;

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Singleton ambient toast bus.
 * - Subscribes (Supabase realtime) to user_badges for the current user and
 *   shows a toast for each newly earned badge.
 * - Shows the streak milestone modal when a streak_milestone notification lands,
 *   and a toast when a streak is saved with a freeze.
 */
export default function GamificationToasts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [milestone, setMilestone] = useState<{ open: boolean; days: number }>({ open: false, days: 0 });

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
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 8000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  // Realtime: badges
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

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
              title: row.title || row.badge_key || "New badge",
              description: row.description || undefined,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(badgeChannel);
    };
  }, [user?.id, push]);

  // Notifications: streak_milestone and streak_saved
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;
    const ch = supabase
      .channel(`gamification-notifs-${rid()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${uid}` },
        (payload) => {
          const row: any = payload.new;
          const kind = row?.notification_type;
          if (kind === "streak_milestone") {
            const days = Number(row?.metadata?.days ?? 0);
            if (days > 0) setMilestone({ open: true, days });
          } else if (kind === "streak_saved") {
            toast({ title: "Streak saved with a freeze" });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  return (
    <>
      {/* Toast portal, bottom-right stack */}
      <div
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 1200,
          display: "flex",
          flexDirection: "column",
          gap: 7,
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <BadgeEarnedToast
              title={t.title}
              description={t.description}
              onDismiss={() => dismiss(t.id)}
              onView={() => {
                dismiss(t.id);
                navigate("/analytics?tab=trophies");
              }}
            />
          </div>
        ))}
      </div>

      {milestone.open && (
        <StreakMilestoneModal
          milestone={milestone.days}
          open={milestone.open}
          showShare={false}
          onClose={() => setMilestone({ open: false, days: 0 })}
        />
      )}
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BountyManagementPanel,
  type ManageAnalytics,
  type ManagePromisingSubmission,
  type ManageTopCommenter,
  type ManageActivityEvent,
  type ManageSlotGroup,
  type ManageSubmission,
  type ManageBounty,
} from "./BountyManagementPanel";
import type { BountyAnalytics } from "@/lib/bounty-competition/types";

interface ProfileMini {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  isAuthor: boolean;
  post: any;
  analytics: BountyAnalytics | undefined;
  solutionsRaw: any[];
  bountySlots: { id: string; kind: string; name: string }[];
  bountyStatus: "open" | "closed" | "solved";
  onAcceptSolution: (id: string) => void;
  onRejectSolution: (id: string) => void;
  onShortlistSolution: (id: string) => void;
  onPreviewSolution: (id: string) => void;
  onMessageUser: (userId: string) => void;
  onExtendDeadline: (days: number) => void;
  onUpdateAcceptanceCriteria: (text: string) => void;
  onPauseSubmissions: () => void;
  onResumeSubmissions: () => void;
  onCloseBounty: () => void;
  onPromoteToBlueprint: () => void;
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

function activityText(
  type: string,
  actor: string,
  meta: Record<string, any>,
  slotName: string,
): string {
  switch (type) {
    case "submission":
      return `@${actor} submitted to ${slotName}`;
    case "acceptance":
      return `@${actor}'s solution to ${slotName} accepted`;
    case "comment":
      return `@${actor} commented`;
    case "deadline_extended":
      return `Deadline extended`;
    case "draft_started":
      return `@${actor} started a draft`;
    default:
      return type;
  }
}

export function BountyManagementPanelContainer(props: Props) {
  const {
    open,
    onClose,
    isAuthor,
    post,
    analytics,
    solutionsRaw,
    bountySlots,
    bountyStatus,
  } = props;

  const [profileMap, setProfileMap] = useState<Map<string, ProfileMini>>(
    new Map(),
  );

  // Collect all user IDs that need handles/avatars from analytics
  useEffect(() => {
    if (!open || !analytics) return;
    const ids = new Set<string>();
    analytics.promisingSubmissions.forEach((p) => ids.add(p.solverId));
    analytics.topCommenters.forEach((c) => ids.add(c.userId));
    analytics.activityTimeline.forEach((e) => {
      if (e.actorId) ids.add(e.actorId);
    });
    solutionsRaw.forEach((s: any) => {
      if (s.solver_id) ids.add(s.solver_id);
    });
    const missing = [...ids].filter((id) => !profileMap.has(id));
    if (missing.length === 0) return;
    void (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", missing);
      if (!data) return;
      setProfileMap((prev) => {
        const next = new Map(prev);
        (data as ProfileMini[]).forEach((p) => next.set(p.id, p));
        return next;
      });
    })();
  }, [open, analytics, solutionsRaw, profileMap]);

  const slotsById = useMemo(() => {
    const m = new Map<string, { id: string; kind: string; name: string }>();
    bountySlots.forEach((s) => m.set(s.id, s));
    return m;
  }, [bountySlots]);

  const getHandle = (id: string) => {
    const p = profileMap.get(id);
    return p?.username || p?.display_name || id.slice(0, 6);
  };
  const getAvatar = (id: string) => profileMap.get(id)?.avatar_url || "";

  // ---- Build view-models ----
  const manageBounty: ManageBounty = useMemo(
    () => ({
      id: post.id,
      title: post.title || "",
      reward: Number(post.bounty_reward_amount ?? post.bounty_reward ?? 0),
      deadline: post.bounty_deadline ?? "",
      acceptanceCriteria: post.bounty_acceptance_criteria ?? "",
      isPaused: !!post.bounty_submissions_paused,
      status: bountyStatus,
    }),
    [post, bountyStatus],
  );

  const manageAnalytics: ManageAnalytics = useMemo(() => {
    const a = analytics;
    if (!a) {
      return {
        totalSubmissions: 0,
        acceptanceRate: 0,
        avgQuality: 0,
        discussionEngagement: 0,
        weekDeltaSubmissions: 0,
        acceptedCount: 0,
        totalForRate: 0,
        solutionsAveraged: 0,
        activeParticipants: 0,
      };
    }
    const accepted = solutionsRaw.filter((s: any) => s.status === "accepted").length;
    const considered = solutionsRaw.filter(
      (s: any) => s.status === "submitted" || s.status === "accepted",
    ).length;
    const participants = new Set(solutionsRaw.map((s: any) => s.solver_id)).size;
    return {
      totalSubmissions: a.totalSubmissions,
      acceptanceRate: a.acceptanceRate,
      avgQuality: a.avgQuality ?? 0,
      discussionEngagement: a.discussionEngagement,
      weekDeltaSubmissions: a.weekDeltaSubmissions,
      acceptedCount: accepted,
      totalForRate: considered,
      solutionsAveraged: considered,
      activeParticipants: participants,
    };
  }, [analytics, solutionsRaw]);

  const promising: ManagePromisingSubmission[] = useMemo(() => {
    if (!analytics) return [];
    return analytics.promisingSubmissions.map((p) => {
      const sol = solutionsRaw.find((s: any) => s.id === p.solutionId);
      return {
        id: p.solutionId,
        title: (sol?.solver_note as string) || `Solution to ${slotsById.get(p.slotId)?.name ?? "slot"}`,
        solverId: p.solverId,
        solverHandle: getHandle(p.solverId),
        solverAvatar: getAvatar(p.solverId),
        voteCount: p.voteCount,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics, solutionsRaw, slotsById, profileMap]);

  const topCommenters: ManageTopCommenter[] = useMemo(() => {
    if (!analytics) return [];
    return analytics.topCommenters.map((c) => ({
      userId: c.userId,
      handle: getHandle(c.userId),
      avatar: getAvatar(c.userId),
      commentCount: c.commentCount,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics, profileMap]);

  const activityTimeline: ManageActivityEvent[] = useMemo(() => {
    if (!analytics) return [];
    return analytics.activityTimeline.map((e, i) => {
      const slotId = (e.metadata as any)?.slot_id as string | undefined;
      const slotName = slotId ? slotsById.get(slotId)?.name ?? "slot" : "";
      const actor = e.actorId ? getHandle(e.actorId) : "someone";
      return {
        id: `${e.type}-${i}-${e.occurredAt}`,
        type:
          e.type === "deadline_extended"
            ? ("status_change" as const)
            : (e.type as ManageActivityEvent["type"]),
        text: activityText(e.type, actor, e.metadata, slotName),
        timestamp: relTime(e.occurredAt),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics, slotsById, profileMap]);

  const submissionsBySlot: ManageSlotGroup[] = useMemo(() => {
    const groups: ManageSlotGroup[] = [];
    for (const slot of bountySlots) {
      const subs: ManageSubmission[] = solutionsRaw
        .filter((s: any) => s.slot_id === slot.id)
        .map((s: any) => ({
          id: s.id,
          slotId: slot.id,
          slotName: slot.name,
          slotType: slot.kind === "stage" ? "design" : "code",
          solverId: s.solver_id,
          solverHandle: s.solver?.username || getHandle(s.solver_id),
          solverAvatar: s.solver?.avatar_url || getAvatar(s.solver_id),
          title: s.solver_note || `Solution to ${slot.name}`,
          voteCount: Number(s.vote_count ?? 0),
          iWouldImplementCount: Number(s.i_would_implement_count ?? 0),
          status:
            s.status === "draft"
              ? "submitted"
              : (s.status as ManageSubmission["status"]),
        }));
      if (subs.length > 0) {
        groups.push({
          slotId: slot.id,
          slotName: slot.name,
          slotType: slot.kind === "stage" ? "design" : "code",
          submissions: subs,
        });
      }
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solutionsRaw, bountySlots, profileMap]);

  return (
    <BountyManagementPanel
      isOpen={open}
      onClose={onClose}
      isAuthor={isAuthor}
      bounty={manageBounty}
      analytics={manageAnalytics}
      promisingSubmissions={promising}
      topCommenters={topCommenters}
      activityTimeline={activityTimeline}
      submissions={submissionsBySlot}
      onAcceptSolution={props.onAcceptSolution}
      onRejectSolution={props.onRejectSolution}
      onShortlistSolution={props.onShortlistSolution}
      onPreviewSolution={props.onPreviewSolution}
      onMessageUser={props.onMessageUser}
      onExtendDeadline={props.onExtendDeadline}
      onUpdateAcceptanceCriteria={props.onUpdateAcceptanceCriteria}
      onPauseSubmissions={props.onPauseSubmissions}
      onResumeSubmissions={props.onResumeSubmissions}
      onCloseBounty={props.onCloseBounty}
      onPromoteToBlueprint={props.onPromoteToBlueprint}
    />
  );
}

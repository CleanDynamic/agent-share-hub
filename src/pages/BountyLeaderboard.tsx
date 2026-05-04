import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getLeaderboard } from "@/lib/bounty-competition/getLeaderboard";
import { getLeaderboardActivity } from "@/lib/bounty-competition/getLeaderboardActivity";
import { useLeaderboardUpdates } from "@/lib/bounty-competition/realtime";
import {
  SolverLeaderboard,
  type Contributor,
  type ActivityEvent,
} from "@/components/bounty-competition/SolverLeaderboard";
import { SeoHead } from "@/components/SeoHead";

const SORT_TO_API: Record<string, "votes" | "submissions" | "acceptances" | "rank"> = {
  votes: "votes",
  submissions: "submissions",
  accepted: "acceptances",
  newest: "rank",
};

export default function BountyLeaderboardPage() {
  const { id: slug } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bountyId, setBountyId] = useState<string | null>(null);
  const [bountyTitle, setBountyTitle] = useState<string>("Bounty leaderboard");
  const [sort, setSort] = useState("votes");
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("content_items")
        .select("id, title, slug")
        .or(`slug.eq.${slug},id.eq.${slug}`)
        .maybeSingle();
      if (data) {
        setBountyId((data as any).id);
        setBountyTitle((data as any).title || "Bounty leaderboard");
      }
    })();
  }, [slug]);

  const refresh = useCallback(async () => {
    if (!bountyId) return;
    setLoading(true);
    try {
      const [entries, acts] = await Promise.all([
        getLeaderboard({ bountyId, sort: SORT_TO_API[sort], limit: 100 }),
        getLeaderboardActivity(bountyId, 20),
      ]);
      setContributors(
        entries.map((e) => ({
          rank: e.rank,
          user: {
            id: e.profile?.id ?? e.userId,
            displayName: e.profile?.displayName || e.profile?.username || "Anonymous",
            handle: e.profile?.username || "user",
            avatarUrl: e.profile?.avatarUrl || "",
            isTrustedSolver: !!e.profile?.isTrustedSolver,
          },
          voteCount: e.voteTotal,
          submissionCount: e.submissionCount,
          acceptedCount: e.acceptanceCount,
          hasActiveDraft: e.hasActiveDraft,
          publicActiveDraft: true,
        })),
      );
      setActivity(acts);
    } finally {
      setLoading(false);
    }
  }, [bountyId, sort]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useLeaderboardUpdates(bountyId, refresh);

  const content = useMemo(() => {
    if (!bountyId) return null;
    return (
      <SolverLeaderboard
        bountyId={bountyId}
        variant="desktop"
        contributors={contributors}
        sort={sort}
        onSortChange={setSort}
        onContributorClick={(uid) => {
          const c = contributors.find((x) => x.user.id === uid);
          navigate(`/profile/${c?.user.handle || uid}`);
        }}
        recentActivity={activity}
        onViewAll={() => navigate(`/b/${slug}`)}
        isLive
      />
    );
  }, [bountyId, contributors, sort, activity, navigate, slug]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
      <SeoHead title={`${bountyTitle} — Leaderboard`} description="Top solvers for this bounty" path={`/b/${slug}/leaderboard`} />
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => navigate(`/b/${slug}`)}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(46,196,182,0.85)",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← Back to bounty
        </button>
      </div>
      <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: "rgba(255,255,255,0.95)", margin: "0 0 16px" }}>
        Leaderboard — {bountyTitle}
      </h1>
      {loading && contributors.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Inter, sans-serif" }}>Loading…</div>
      ) : (
        content
      )}
    </div>
  );
}

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FeedCard, type FeedPost } from "@/components/feed-card";
import {
  MetaBountyCard,
  type MetaBountyCardModel,
} from "@/components/bounty-competition/MetaBountyCard";

const ACTIVE_COMP_SELECT = `
  id, title, description, content_type, post_type, cover_image_url,
  created_at, published_at, view_count, comment_count, download_count,
  what_to_expect, ai_tools, use_cases, custom_tags,
  bounty_status, bounty_reward_amount, bounty_reward_type, bounty_reward_currency,
  bounty_total_slots, bounty_solved_count, bounty_active_solvers,
  bounty_deadline, bounty_health_score, bounty_is_meta,
  creator_id,
  profiles:creator_id ( username, display_name, avatar_url, bio )
`;

interface ActiveCompetitionRow {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  post_type: string | null;
  cover_image_url: string | null;
  created_at: string;
  published_at: string | null;
  view_count: number | null;
  comment_count: number | null;
  download_count: number | null;
  what_to_expect: string | null;
  ai_tools: string[] | null;
  use_cases: string[] | null;
  custom_tags: string[] | null;
  bounty_status: string | null;
  bounty_reward_amount: number | null;
  bounty_reward_type: string | null;
  bounty_reward_currency: string | null;
  bounty_total_slots: number | null;
  bounty_solved_count: number | null;
  bounty_active_solvers: number | null;
  bounty_deadline: string | null;
  bounty_health_score: number | null;
  bounty_is_meta: boolean | null;
  creator_id: string;
  profiles:
    | { username: string | null; display_name: string | null; avatar_url: string | null; bio: string | null }
    | null;
}

function rowToFeedPost(row: ActiveCompetitionRow): FeedPost {
  const author = row.profiles ?? {
    username: null,
    display_name: null,
    avatar_url: null,
    bio: null,
  };
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    content_type: row.content_type ?? "Bounty",
    post_type: row.post_type ?? null,
    cover_image_url: row.cover_image_url ?? undefined,
    created_at: row.published_at ?? row.created_at,
    view_count: row.view_count ?? 0,
    comment_count: row.comment_count ?? 0,
    download_count: row.download_count ?? 0,
    what_to_expect: row.what_to_expect ?? undefined,
    ai_tools: row.ai_tools ?? [],
    use_cases: row.use_cases ?? [],
    custom_tags: row.custom_tags ?? [],
    bounty_enabled: true,
    bounty_amount: row.bounty_reward_amount,
    bounty_status: row.bounty_status,
    bounty_reward_type: row.bounty_reward_type,
    bounty_reward_currency: row.bounty_reward_currency,
    bounty_total_slots: row.bounty_total_slots ?? 0,
    bounty_solved_count: row.bounty_solved_count ?? 0,
    bounty_active_solvers: row.bounty_active_solvers ?? 0,
    bounty_deadline: row.bounty_deadline,
    bounty_health_score: row.bounty_health_score,
    bounty_is_meta: !!row.bounty_is_meta,
    author: {
      display_name: author.display_name || author.username || "Anonymous",
      username: author.username || "anon",
      avatar_url: author.avatar_url ?? undefined,
      bio: author.bio ?? undefined,
    },
  };
}

async function fetchSubBounties(
  metaIds: string[],
): Promise<Map<string, MetaBountyCardModel["subBounties"]>> {
  if (metaIds.length === 0) return new Map();
  const { data } = await (supabase as any)
    .from("meta_bounty_sub_definitions")
    .select("id, meta_bounty_id, title, target_amount, spawned_bounty_id, position")
    .in("meta_bounty_id", metaIds)
    .order("position", { ascending: true });

  const { data: pledges } = await (supabase as any)
    .from("meta_bounty_pledges")
    .select("sub_definition_id, amount, status")
    .in("meta_bounty_id", metaIds);

  const pledgedBySub = new Map<string, number>();
  for (const p of (pledges ?? []) as any[]) {
    if (!p.sub_definition_id) continue;
    if (p.status && p.status !== "active" && p.status !== "captured") continue;
    pledgedBySub.set(p.sub_definition_id, (pledgedBySub.get(p.sub_definition_id) ?? 0) + Number(p.amount ?? 0));
  }

  const out = new Map<string, MetaBountyCardModel["subBounties"]>();
  for (const sub of (data ?? []) as any[]) {
    const list = out.get(sub.meta_bounty_id) ?? [];
    list.push({
      id: sub.id,
      title: sub.title,
      target: Number(sub.target_amount ?? 0),
      pledged: pledgedBySub.get(sub.id) ?? 0,
      status: sub.spawned_bounty_id ? "spawned" : "funding",
    });
    out.set(sub.meta_bounty_id, list);
  }
  return out;
}

export function ActiveCompetitionsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["home_active_competitions"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("content_items") as any)
        .select(ACTIVE_COMP_SELECT)
        .eq("status", "approved")
        .eq("post_type", "bounty")
        .eq("bounty_status", "open")
        .order("bounty_health_score", { ascending: false, nullsFirst: false })
        .limit(6);
      if (error) throw error;

      const rows = (data ?? []) as ActiveCompetitionRow[];
      const metaIds = rows.filter((r) => r.bounty_is_meta).map((r) => r.id);
      const subDefs = await fetchSubBounties(metaIds);

      return rows.map((r) => ({ row: r, subBounties: subDefs.get(r.id) ?? [] }));
    },
  });

  if (isLoading) {
    return (
      <div style={{ padding: "0 24px 16px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <h2
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "0.02em",
            }}
          >
            🏆 Active competitions
          </h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="animate-pulse"
              style={{
                height: 88,
                background: "rgba(22,22,30,0.30)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                borderRadius: 12,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <div style={{ padding: "0 24px 16px" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h2
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "0.02em",
          }}
        >
          🏆 Active competitions
        </h2>
        <Link
          to="/discover?competitionsOnly=1"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "#E8571A",
            textDecoration: "none",
          }}
        >
          View all →
        </Link>
      </div>

      <div className="flex flex-col" style={{ gap: 10 }}>
        {data.map(({ row, subBounties }) => {
          if (row.bounty_is_meta) {
            const metaModel: MetaBountyCardModel = {
              id: row.id,
              slug: row.id,
              title: row.title,
              description: row.description ?? "",
              contributors: row.bounty_active_solvers ?? 0,
              totalPool: subBounties.reduce((acc, sb) => acc + sb.pledged, 0),
              subBounties,
            };
            return <MetaBountyCard key={row.id} metaBounty={metaModel} />;
          }
          return <FeedCard key={row.id} post={rowToFeedPost(row)} />;
        })}
      </div>
    </div>
  );
}

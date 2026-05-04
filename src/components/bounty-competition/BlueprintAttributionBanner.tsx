import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BlueprintAttributionBannerProps {
  bountyId: string;
}

interface PromotedFromBounty {
  id: string;
  slug: string | null;
  title: string;
  postType: string | null;
  createdAt: string | null;
  solvedAt: string | null;
  acceptedSolverCount: number;
}

function formatTimeToSolve(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "less than a day";
  const days = Math.round(ms / 86_400_000);
  if (days < 1) return "less than a day";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"}`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"}`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function BlueprintAttributionBanner({
  bountyId,
}: BlueprintAttributionBannerProps) {
  const { data } = useQuery<PromotedFromBounty | null>({
    queryKey: ["blueprint_attribution_source", bountyId],
    queryFn: async () => {
      const { data: src } = await (supabase as any)
        .from("content_items")
        .select(
          "id, slug, title, post_type, published_at, created_at, bounty_solved_at",
        )
        .eq("id", bountyId)
        .maybeSingle();
      if (!src || (src as any).post_type !== "bounty") return null;

      const { count } = await (supabase as any)
        .from("solutions")
        .select("solver_id", { count: "exact", head: true })
        .eq("bounty_id", bountyId)
        .eq("status", "accepted");

      return {
        id: (src as any).id as string,
        slug: ((src as any).slug as string | null) ?? null,
        title: ((src as any).title as string) ?? "the original bounty",
        postType: (src as any).post_type as string | null,
        createdAt:
          ((src as any).published_at as string | null) ??
          ((src as any).created_at as string | null) ??
          null,
        solvedAt: ((src as any).bounty_solved_at as string | null) ?? null,
        acceptedSolverCount: Number(count ?? 0),
      };
    },
    enabled: !!bountyId,
    staleTime: 60_000,
  });

  if (!data) return null;

  const href = `/content/${data.id}`;
  const timeToSolve = formatTimeToSolve(data.createdAt, data.solvedAt);
  const contributorLabel =
    data.acceptedSolverCount === 1
      ? "1 contributor"
      : `${data.acceptedSolverCount} contributors`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-blueprint-attribution-banner
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        marginBottom: 16,
        borderRadius: 8,
        background: "rgba(46,196,182,0.08)",
        border: "1px solid rgba(46,196,182,0.25)",
        textDecoration: "none",
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        fontWeight: 500,
        color: "#2EC4B6",
        cursor: "pointer",
      }}
    >
      <span>
        This blueprint was promoted from{" "}
        <span style={{ fontWeight: 600 }}>{data.title}</span> · solved by{" "}
        {contributorLabel} over {timeToSolve}
      </span>
      <ExternalLink size={11} style={{ flexShrink: 0 }} />
    </a>
  );
}

export default BlueprintAttributionBanner;

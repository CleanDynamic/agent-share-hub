import { supabase } from "@/integrations/supabase/client";
import type { SolverProfile } from "./types";

export interface SolutionComment {
  id: string;
  solution_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  author: SolverProfile | null;
}

export async function getSolutionComments(
  solutionId: string,
): Promise<SolutionComment[]> {
  const { data, error } = await (supabase as any)
    .from("solution_comments")
    .select("id, solution_id, parent_comment_id, body, created_at, author_id")
    .eq("solution_id", solutionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));
  const { data: profs } = await (supabase as any)
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_trusted_solver")
    .in("id", authorIds);
  const map = new Map<string, SolverProfile>();
  for (const p of (profs ?? []) as SolverProfile[]) map.set(p.id, p);

  return rows.map((r) => ({
    id: r.id,
    solution_id: r.solution_id,
    parent_comment_id: r.parent_comment_id,
    body: r.body,
    created_at: r.created_at,
    author: map.get(r.author_id) ?? null,
  }));
}

export async function postSolutionComment(args: {
  solutionId: string;
  authorId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<void> {
  const { error } = await (supabase as any)
    .from("solution_comments")
    .insert({
      solution_id: args.solutionId,
      author_id: args.authorId,
      body: args.body,
      parent_comment_id: args.parentCommentId ?? null,
    } as any);
  if (error) throw error;
}

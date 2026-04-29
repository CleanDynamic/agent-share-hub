import { supabase } from "@/integrations/supabase/client";

const MIN_POSTS = 3;

function topN<T extends string>(values: T[], n: number): T[] {
  const counts = new Map<T, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

/**
 * Generate and persist `profiles.derived_bio` for a user, based on the domains,
 * tools, models and tags found across their published content.
 *
 * Non-blocking by design — callers should not await this. Errors are logged.
 */
export async function recomputeDerivedBio(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const { data, error } = await supabase
      .from("content_items")
      .select("domain, models_referenced, tools_referenced, tags")
      .eq("creator_id", userId)
      .eq("status", "approved");

    if (error) throw error;
    const rows = (data ?? []) as Array<{
      domain: string | null;
      models_referenced: string[] | null;
      tools_referenced: string[] | null;
      tags: string[] | null;
    }>;

    let derivedBio: string | null = null;

    if (rows.length >= MIN_POSTS) {
      const domains = topN(rows.map(r => (r.domain ?? "").trim()).filter(Boolean), 2);
      const models = topN(rows.flatMap(r => r.models_referenced ?? []), 3);
      const tools = topN(rows.flatMap(r => r.tools_referenced ?? []), 3);
      const tags = topN(rows.flatMap(r => r.tags ?? []), 2);

      // Combine models + tools, dedupe, keep top 3.
      const works = topN([...models, ...tools], 3);

      const parts: string[] = [];
      if (domains.length) {
        parts.push(`Publishes mostly in ${domains.join(" and ")}.`);
      }
      if (works.length) {
        parts.push(`Works with ${works.join(", ")}.`);
      }
      if (tags.length) {
        parts.push(`Strong in ${tags.join(" and ")}.`);
      }
      derivedBio = parts.length > 0 ? parts.join(" ") : null;
    }

    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        derived_bio: derivedBio,
        last_derived_at: new Date().toISOString(),
      } as any)
      .eq("id", userId);
    if (upErr) throw upErr;
  } catch (err) {
    console.error("[recomputeDerivedBio] failed for", userId, err);
  }
}

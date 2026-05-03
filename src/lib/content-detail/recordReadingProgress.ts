import { supabase } from "@/integrations/supabase/client";

const lastWriteAt = new Map<string, number>();
const THROTTLE_MS = 30_000;

/**
 * Upsert reading progress for a (reader, post) pair, throttled to once / 30s.
 * On first hit at 100, sets completed_at and increments
 * content_items.reading_completion_count.
 */
export async function recordReadingProgress({
  readerId,
  postId,
  progressPct,
}: {
  readerId: string;
  postId: string;
  progressPct: number;
}): Promise<void> {
  if (!readerId || !postId) return;
  const pct = Math.max(0, Math.min(100, Math.round(progressPct)));
  const key = `${readerId}::${postId}`;
  const now = Date.now();
  const last = lastWriteAt.get(key) ?? 0;
  // Always allow the 100% completion event through, otherwise throttle.
  if (pct < 100 && now - last < THROTTLE_MS) return;
  lastWriteAt.set(key, now);

  // Read existing row to decide if this is a first-time completion.
  const { data: existing } = await (supabase as any)
    .from("reading_progress")
    .select("last_progress_pct, completed_at")
    .eq("reader_id", readerId)
    .eq("post_id", postId)
    .maybeSingle();

  const wasComplete = !!existing?.completed_at;
  const becomingComplete = pct >= 100 && !wasComplete;

  const payload: Record<string, any> = {
    reader_id: readerId,
    post_id: postId,
    last_progress_pct: pct,
    last_read_at: new Date().toISOString(),
  };
  if (!existing) payload.first_read_at = new Date().toISOString();
  if (becomingComplete) payload.completed_at = new Date().toISOString();

  const { error } = await (supabase as any)
    .from("reading_progress")
    .upsert(payload, { onConflict: "reader_id,post_id" });
  if (error) {
    console.warn("[recordReadingProgress] upsert failed", error);
    return;
  }

  if (becomingComplete) {
    // Increment completion count. No RPC available — best-effort read+write.
    try {
      const { data: ci } = await (supabase as any)
        .from("content_items")
        .select("reading_completion_count")
        .eq("id", postId)
        .maybeSingle();
      const next = ((ci as any)?.reading_completion_count ?? 0) + 1;
      await (supabase as any)
        .from("content_items")
        .update({ reading_completion_count: next } as any)
        .eq("id", postId);
    } catch (e) {
      console.warn("[recordReadingProgress] completion count bump failed", e);
    }
  }
}

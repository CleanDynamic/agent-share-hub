import { supabase } from "@/integrations/supabase/client";
import { notifyEngagement } from "@/lib/notifications/triggers";
import type { Reblog } from "./types";
import {
  REBLOG_TEXT_MAX,
  ReblogValidationError,
  generateReblogSlug,
  uploadReblogMedia,
  validateMedia,
} from "./media";
import { validateExcerpt, hashExcerpt } from "./validateExcerpt";

export interface CreateReblogInput {
  rebloggerId: string;
  originalPostId: string;
  parentReblogId?: string | null;
  text?: string | null;
  mediaFile?: File | null;
  excerptText?: string | null;
  excerptSourceBlockId?: string | null;
  excerptSourceBlockTypeLabel?: string | null;
}

/**
 * Create a reblog. DB triggers enforce rate limits and counters; this layer
 * does the content/media validation, slug generation, root-post resolution,
 * media upload, insert, and best-effort notification fan-out.
 */
export async function createReblog(input: CreateReblogInput): Promise<Reblog> {
  const text = (input.text ?? "").trim();
  const hasText = text.length > 0;
  const hasMedia = !!input.mediaFile;
  const rawExcerpt = (input.excerptText ?? "").trim();
  const hasExcerpt = rawExcerpt.length > 0;

  if (!hasText && !hasMedia && !hasExcerpt) {
    throw new ReblogValidationError(
      "EMPTY_REBLOG",
      "A reblog needs at least text, media, or an excerpt."
    );
  }
  if (text.length > REBLOG_TEXT_MAX) {
    throw new ReblogValidationError(
      "TEXT_TOO_LONG",
      `Reblog text must be ≤ ${REBLOG_TEXT_MAX} characters.`
    );
  }
  if (input.mediaFile) validateMedia(input.mediaFile);

  // Validate excerpt up-front (anti-fabrication) — DB trigger also enforces length.
  let excerptHash: string | null = null;
  if (hasExcerpt) {
    if (rawExcerpt.length < 4 || rawExcerpt.length > 2000) {
      throw new ReblogValidationError(
        "EXCERPT_LENGTH",
        "Excerpt must be between 4 and 2000 characters."
      );
    }
    const check = await validateExcerpt(input.originalPostId, rawExcerpt);
    if (!check.isValid) {
      throw new ReblogValidationError(
        "EXCERPT_NOT_FOUND",
        "Excerpt text was not found in the source post."
      );
    }
    excerptHash = await hashExcerpt(rawExcerpt);
  }

  // Resolve root_original_post_id.
  let rootOriginalPostId = input.originalPostId;
  if (input.parentReblogId) {
    const { data: parent, error: parentErr } = await (supabase
      .from("reblogs") as any)
      .select("root_original_post_id, original_post_id")
      .eq("id", input.parentReblogId)
      .is("deleted_at", null)
      .maybeSingle();
    if (parentErr) throw parentErr;
    if (!parent) {
      throw new ReblogValidationError(
        "PARENT_NOT_FOUND",
        "Parent reblog not found or has been deleted."
      );
    }
    rootOriginalPostId = parent.root_original_post_id || parent.original_post_id;
  }

  const slug = generateReblogSlug();
  const reblogId = crypto.randomUUID();

  // Upload media first (we need the row id for the path).
  let media_url: string | null = null;
  let media_kind: "none" | "image" | "video" = "none";
  let media_thumbnail_url: string | null = null;
  if (input.mediaFile) {
    const uploaded = await uploadReblogMedia({
      rebloggerId: input.rebloggerId,
      reblogId,
      file: input.mediaFile,
    });
    media_url = uploaded.url;
    media_kind = uploaded.kind;
    // Client-side video thumbnail extraction is out of scope; the field
    // remains null and is populated later by an edge function if needed.
    media_thumbnail_url = null;
  }

  const payload: any = {
    id: reblogId,
    slug,
    reblogger_id: input.rebloggerId,
    original_post_id: input.originalPostId,
    parent_reblog_id: input.parentReblogId ?? null,
    root_original_post_id: rootOriginalPostId,
    text: hasText ? text : null,
    media_kind,
    media_url,
    media_thumbnail_url,
    excerpt_text: hasExcerpt ? rawExcerpt : null,
    excerpt_source_block_id: hasExcerpt ? input.excerptSourceBlockId ?? null : null,
    excerpt_source_block_type_label: hasExcerpt
      ? input.excerptSourceBlockTypeLabel ?? null
      : null,
    excerpt_text_hash: excerptHash,
  };

  const { data, error } = await (supabase.from("reblogs") as any)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    // Map DB rate-limit messages to typed errors so the UI can branch.
    const msg = error.message || "";
    if (msg.includes("once per 24 hours")) {
      throw new ReblogValidationError("SELF_REBLOG_RATE_LIMIT", msg);
    }
    if (msg.includes("Reblog rate limit")) {
      throw new ReblogValidationError("RATE_LIMIT", msg);
    }
    throw error;
  }

  // Best-effort notification (skips self-reblog automatically).
  // For quoted-excerpt reblogs we pass a `variant: "quote"` flag in metadata
  // so the notification renderer can switch the body to "quoted your …".
  notifyEngagement({
    kind: "repost",
    postId: input.originalPostId,
    actorId: input.rebloggerId,
    variant: hasExcerpt ? "quote" : "reblog",
    metadata: hasExcerpt
      ? { reblog_id: data.id, excerpt_preview: rawExcerpt.slice(0, 140) }
      : { reblog_id: data.id },
  }).catch(() => {});

  // Reblog-of-reblog: notify the parent reblog's author.
  if (input.parentReblogId) {
    (async () => {
      try {
        const { data: parent } = await (supabase.from("reblogs") as any)
          .select("reblogger_id")
          .eq("id", input.parentReblogId)
          .maybeSingle();
        const parentAuthor = parent?.reblogger_id;
        if (parentAuthor && parentAuthor !== input.rebloggerId) {
          // Reuse the post_reblogged channel with a flag in metadata so the
          // notification renderer can choose the right body string.
          const { createNotification } = await import("@/lib/notifications/createNotification");
          await createNotification({
            recipientId: parentAuthor,
            kind: "reblog_reblogged",
            actorId: input.rebloggerId,
            targetType: "blueprint",
            targetId: data.id,
            body: "Someone reblogged your reblog",
            metadata: { reblog_id: data.id, parent_reblog_id: input.parentReblogId },
          });
        }
      } catch {
        /* silent */
      }
    })();
  }

  return data as Reblog;
}

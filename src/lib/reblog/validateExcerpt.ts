import { supabase } from "@/integrations/supabase/client";

const MIN = 4;
const MAX = 2000;

function normalise(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Computes a SHA-256 hex digest of the (raw) excerpt text.
 * Used to fuzzy-anchor the excerpt back on the source page.
 */
export async function hashExcerpt(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Pulls the full searchable text of a post: article_body (TipTap JSON), the
 * raw text_content of each content_block, plus title/description/subtitle.
 */
export async function loadSourceCorpus(postId: string): Promise<string> {
  const [{ data: post }, { data: blocks }] = await Promise.all([
    (supabase.from("content_items") as any)
      .select("title, subtitle, description, article_body")
      .eq("id", postId)
      .maybeSingle(),
    (supabase.from("content_blocks") as any)
      .select("text_content, use_instructions, image_description")
      .eq("content_id", postId),
  ]);

  const parts: string[] = [];
  if (post) {
    parts.push(post.title ?? "", post.subtitle ?? "", post.description ?? "");
    if (post.article_body) {
      try {
        parts.push(JSON.stringify(post.article_body));
      } catch {
        /* ignore */
      }
    }
  }
  for (const b of (blocks ?? []) as any[]) {
    parts.push(b.text_content ?? "", b.use_instructions ?? "", b.image_description ?? "");
  }
  return parts.join("\n");
}

export interface ExcerptValidation {
  isValid: boolean;
  fuzzy?: boolean;
  reason?: "TOO_SHORT" | "TOO_LONG" | "NOT_FOUND" | "POST_NOT_FOUND";
}

/**
 * Verifies that `excerptText` actually exists in the source post content.
 * Returns fuzzy=true if found only after whitespace normalisation.
 */
export async function validateExcerpt(
  sourcePostId: string,
  excerptText: string
): Promise<ExcerptValidation> {
  const len = excerptText.length;
  if (len < MIN) return { isValid: false, reason: "TOO_SHORT" };
  if (len > MAX) return { isValid: false, reason: "TOO_LONG" };

  const corpus = await loadSourceCorpus(sourcePostId);
  if (!corpus) return { isValid: false, reason: "POST_NOT_FOUND" };

  if (corpus.includes(excerptText)) {
    return { isValid: true, fuzzy: false };
  }
  if (normalise(corpus).includes(normalise(excerptText))) {
    return { isValid: true, fuzzy: true };
  }
  return { isValid: false, reason: "NOT_FOUND" };
}

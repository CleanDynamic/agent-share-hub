import { supabase } from "@/integrations/supabase/client";

/**
 * Generate (or fetch cached) AI-PDF for a post via the `generate-ai-pdf`
 * edge function. The edge function handles caching, storage upload, and
 * persisting `ai_pdf_url` / `ai_pdf_generated_at` on `content_items`.
 */
export async function generateAIPdf(postId: string): Promise<{ url: string; cached: boolean }> {
  if (!postId) throw new Error("generateAIPdf: missing postId");
  const { data, error } = await supabase.functions.invoke("generate-ai-pdf", {
    body: { postId },
  });
  if (error) throw error;
  if (!data?.url) throw new Error((data as any)?.error ?? "AI-PDF generation failed");
  return { url: data.url as string, cached: !!data.cached };
}

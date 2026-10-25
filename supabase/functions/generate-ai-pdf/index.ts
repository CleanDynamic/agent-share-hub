// Generates a structured, AI-friendly PDF from a post's canonical payload.
// The PDF itself is built in pdf.ts; this file only wires the handler to the
// database and the ai-pdfs bucket.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPdf, buildReblogPdf } from "./pdf.ts";
import { createHandler } from "./handler.ts";

// Clients built once from environment values hold nothing about a caller.
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);

Deno.serve(
  createHandler({
    async getUser(token) {
      if (!token) return null;
      const { data } = await auth.auth.getUser(token);
      return data.user ? { id: data.user.id } : null;
    },
    async getPost(postId) {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, slug, status, visibility, creator_id, updated_at, ai_pdf_url, ai_pdf_generated_at, canonical_export_payload")
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async getReblog(reblogId) {
      const { data: reblog, error } = await supabase
        .from("reblogs")
        .select("id, slug, text, media_kind, media_url, created_at, reblogger_id, original_post_id")
        .eq("id", reblogId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!reblog) return null;

      const { data: reblogger } = await supabase.from("profiles").select("id, username, display_name").eq("id", reblog.reblogger_id).maybeSingle();
      const { data: original } = await supabase
        .from("content_items")
        .select("id, slug, title, description, post_type, created_at, creator_id, status, visibility")
        .eq("id", reblog.original_post_id)
        .maybeSingle();

      let originalAuthor = null;
      if (original?.creator_id) {
        const { data: author } = await supabase.from("profiles").select("id, username, display_name").eq("id", original.creator_id).maybeSingle();
        originalAuthor = author;
      }
      return { reblog, reblogger, original, originalAuthor };
    },
    buildPdf: (payload) => buildPdf(payload),
    buildReblogPdf: ({ reblog, original, reblogger, originalAuthor }) => buildReblogPdf(reblog, original, reblogger, originalAuthor),
    async upload(path, bytes) {
      const { error } = await supabase.storage.from("ai-pdfs").upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (error) throw error;
      return supabase.storage.from("ai-pdfs").getPublicUrl(path).data.publicUrl;
    },
    async saveUrl(postId, url) {
      const { error } = await supabase
        .from("content_items")
        .update({ ai_pdf_url: url, ai_pdf_generated_at: new Date().toISOString() } as never)
        .eq("id", postId);
      if (error) throw error;
    },
    async logExport(postId, format) {
      await supabase.from("ai_export_log").insert({ post_id: postId, format } as never);
    },
  }),
);

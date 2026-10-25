import { z } from "zod/v4";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { bearerToken, errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";

// kind picks a post or a reblog. "post" is the default, as it was.
const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("post"), postId: z.guid() }),
  z.object({ kind: z.literal("reblog"), reblogId: z.guid() }),
]);

export interface PostRow {
  id: string;
  slug: string | null;
  status: string | null;
  visibility: string | null;
  creator_id: string | null;
  updated_at: string | null;
  ai_pdf_url: string | null;
  ai_pdf_generated_at: string | null;
  canonical_export_payload: unknown;
}

export interface ReblogData {
  reblog: { id: string; slug: string | null; reblogger_id: string; original_post_id: string };
  reblogger: unknown;
  original: { id: string; creator_id: string | null; status: string | null; visibility: string | null } | null;
  originalAuthor: unknown;
}

export interface Deps {
  getUser(token: string | null): Promise<{ id: string } | null>;
  getPost(postId: string): Promise<PostRow | null>;
  getReblog(reblogId: string): Promise<ReblogData | null>;
  buildPdf(payload: unknown): Promise<Uint8Array>;
  buildReblogPdf(data: ReblogData): Promise<Uint8Array>;
  /** Stores the file in the public ai-pdfs bucket and returns its address. */
  upload(path: string, bytes: Uint8Array): Promise<string>;
  /** Keeps the address on the post so the next call can reuse it. */
  saveUrl(postId: string, url: string): Promise<void>;
  /** Best-effort log of an export. */
  logExport?(postId: string, format: string): Promise<void>;
}

/** Public means approved and visible to everyone; anything else is for its owner. */
const isPublic = (post: { status: string | null; visibility: string | null }) => post.status === "approved" && post.visibility === "public";

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight(req, { methods: "POST, OPTIONS" });
    const cors = corsHeaders(req, { methods: "POST, OPTIONS" });
    if (req.method !== "POST") return errorResponse("Method not allowed", 405, cors);

    try {
      const raw = await req.json().catch(() => null);
      const parsed = Body.safeParse(raw && typeof raw === "object" && !("kind" in raw) ? { ...raw, kind: "post" } : raw);
      if (!parsed.success) return errorResponse(fieldError(parsed.error), 400, cors);

      // The caller is known only to let an owner reach their own private post.
      const user = await deps.getUser(bearerToken(req));

      if (parsed.data.kind === "reblog") {
        const data = await deps.getReblog(parsed.data.reblogId);
        const owns = !!user && (user.id === data?.reblog.reblogger_id || user.id === data?.original?.creator_id);
        if (!data || (!(data.original && isPublic(data.original)) && !owns)) {
          return errorResponse("Reblog not found", 404, cors);
        }

        const pdfBytes = await deps.buildReblogPdf(data);
        const fileName = `reblog/${data.reblog.id}/${(data.reblog.slug ?? data.reblog.id).split("/").join("-")}-${Date.now()}.pdf`;
        const url = await deps.upload(fileName, pdfBytes);

        try {
          await deps.logExport?.(data.reblog.original_post_id, "ai-pdf-reblog");
        } catch (_e) { /* ignore */ }

        return jsonResponse({ url, cached: false }, 200, cors);
      }

      // Fetch the post (caching check + payload)
      const post = await deps.getPost(parsed.data.postId);
      const owner = !!user && post?.creator_id === user.id;
      if (!post || (!isPublic(post) && !owner)) return errorResponse("Post not found", 404, cors);

      // Caching: if cached PDF is newer than the post's last update, reuse.
      if (post.ai_pdf_url && post.ai_pdf_generated_at && post.updated_at) {
        if (new Date(post.ai_pdf_generated_at).getTime() >= new Date(post.updated_at).getTime()) {
          return jsonResponse({ url: post.ai_pdf_url, cached: true }, 200, cors);
        }
      }

      const payload = post.canonical_export_payload;
      if (!payload) {
        return errorResponse("Canonical payload not yet generated. Open the post once to seed it.", 409, cors);
      }

      const pdfBytes = await deps.buildPdf(payload);
      const fileName = `${post.id}/${(post.slug ?? post.id).split("/").join("-")}-${Date.now()}.pdf`;
      const url = await deps.upload(fileName, pdfBytes);

      // The address of a PDF made from a post that is not public stays off the row.
      if (isPublic(post)) await deps.saveUrl(post.id, url);

      try {
        await deps.logExport?.(post.id, "ai-pdf");
      } catch (_e) { /* ignore */ }

      return jsonResponse({ url, cached: false }, 200, cors);
    } catch (err) {
      console.error("[generate-ai-pdf]", err);
      return errorResponse("Could not make the PDF", 500, cors);
    }
  };
}

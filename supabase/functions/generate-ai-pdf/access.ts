// Who may have a PDF made from a post.
//
// The function reads with the service key and uploads to the public `ai-pdfs`
// bucket, so it has to decide for itself what the caller may see: a public,
// approved post is anybody's to export; anything else (a draft, a private or
// unlisted post, one waiting for review) only its creator's.

export interface Exportable {
  status: string | null;
  visibility: string | null;
  creator_id: string | null;
}

export function mayExport(post: Exportable, callerId: string | null): boolean {
  if (callerId && post.creator_id === callerId) return true;
  return post.status === "approved" && (post.visibility ?? "public") === "public";
}

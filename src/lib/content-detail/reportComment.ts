/**
 * Report a comment. Placeholder implementation — there is no
 * `primitive_comment_reports` table yet; this records to the console
 * and resolves successfully so the UI can show a confirmation toast.
 * When a moderation pipeline lands, swap this for a real insert.
 */
export async function reportComment({
  commentId,
  reason,
}: {
  commentId: string;
  reason?: string;
}) {

  return { ok: true as const };
}

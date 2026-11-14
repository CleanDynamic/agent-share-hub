// G10: one PDF file per reblog, reused while it is newer than the reblog and its original.
// Pure TypeScript with no imports, so Deno and the repo's Vitest both load it.

export interface ReblogForPdf {
  id: string;
  slug: string | null;
  updated_at: string | null;
}

/** The one storage path a reblog's PDF lives at. */
export function reblogPdfPath(reblog: ReblogForPdf): string {
  return `reblog/${reblog.id}/${(reblog.slug ?? reblog.id).split("/").join("-")}.pdf`;
}

/** When the stored file is fresh, its time (for the address's cache-buster); otherwise null. */
export function freshReblogPdf(
  stored: ReadonlyArray<{ name: string; updated_at?: string | null; created_at?: string | null }>,
  reblog: ReblogForPdf,
  originalUpdatedAt: string | null,
): number | null {
  const name = reblogPdfPath(reblog).split("/").pop();
  const file = stored.find((one) => one.name === name);
  const at = Date.parse(file?.updated_at ?? file?.created_at ?? "");
  if (!file || Number.isNaN(at)) return null;
  const changed = Math.max(Date.parse(reblog.updated_at ?? "") || 0, Date.parse(originalUpdatedAt ?? "") || 0);
  return at >= changed ? at : null;
}

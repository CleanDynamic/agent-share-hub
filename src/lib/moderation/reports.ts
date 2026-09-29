// Reporting a build or a comment, and the admin's queue of reports (RC-P17b).
//
// A report is one content_reports row per (target, reporter): a build or a
// comment, a reason from five, an optional note of at most 500 characters. The
// reader files it and reads back only their own; admins read every one, and a
// report closes only through resolve_report, which hides the target or does not
// (20261001190000_rc_reports.sql).
//
// A NOTE IS TEXT A READER WROTE ⟦neoscale-error-monitoring › Privacy⟧, and so
// is the comment an excerpt is taken from. Neither reaches an error: failures
// are reported with the operation, ids, code and status only (SocialError).
//
// THE QUEUE: one request for the open reports, their reporters embedded; then
// the one-line target summaries in at most two requests, one for the builds
// and one for the comments, each only when the page holds a target of its kind.

import {
  SocialError,
  currentUserId,
  db,
  isDuplicate,
  signedOutError,
  socialError,
  uniqueIds,
} from "@/lib/social/types";

export type ReportTargetType = "build" | "comment";
export type ReportReason = "spam" | "broken" | "harmful" | "stolen" | "other";

/** The five reasons, most likely first and "Something else" last ⟦hicks-law › Budgets: dialog⟧. */
export const REPORT_REASONS: ReadonlyArray<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "Spam" },
  { value: "broken", label: "Doesn't work" },
  { value: "harmful", label: "Harmful" },
  { value: "stolen", label: "Not theirs" },
  { value: "other", label: "Something else" },
];

/** The longest note the database accepts. */
export const REPORT_NOTE_MAX = 500;

/** A page of the queue. */
export const REPORTS_PAGE_SIZE = 50;

export interface ReportTargetInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  note?: string | null;
}

/**
 * File a report as the signed-in reader. Reporting the same thing twice is not
 * an error: the first report is still open, which is the state asked for.
 */
export async function reportTarget(input: ReportTargetInput): Promise<void> {
  const ids = input.targetType === "build" ? { buildId: input.targetId } : { commentId: input.targetId };
  const note = (input.note ?? "").trim();
  if (!REPORT_REASONS.some((reason) => reason.value === input.reason) || [...note].length > REPORT_NOTE_MAX) {
    throw new SocialError("reportTarget", "invalid", ids);
  }

  const userId = await currentUserId();
  if (!userId) throw signedOutError("reportTarget", ids);

  const response = await db.from("content_reports").insert({
    target_type: input.targetType,
    target_id: input.targetId,
    reporter_id: userId,
    reason: input.reason,
    note: note.length > 0 ? note : null,
  });
  if (response.error && !isDuplicate(response.error)) throw socialError("reportTarget", response, ids);
}

export interface OpenReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  note: string | null;
  createdAt: string;
  reporter: { username: string | null; displayName: string | null } | null;
  /** One line naming the target, and where it lives; null href when it is gone. */
  summary: { text: string; href: string | null };
}

export interface OpenReportsPage {
  reports: OpenReport[];
  /** created_at of the last report read, or null at the end. */
  nextBefore: string | null;
}

interface ReportRow {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  note: string | null;
  created_at: string;
  reporter?: { username: string | null; display_name: string | null } | Array<{ username: string | null; display_name: string | null }> | null;
}

interface BuildSummaryRow {
  id: string;
  slug: string;
  title: string | null;
}

interface CommentSummaryRow {
  id: string;
  body: string;
  build?: { slug: string; title: string | null } | Array<{ slug: string; title: string | null }> | null;
}

/** How much of a reported comment the queue quotes. */
const EXCERPT = 80;

function first<T>(embed: T | T[] | null | undefined): T | null {
  return Array.isArray(embed) ? (embed[0] ?? null) : (embed ?? null);
}

function excerpt(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length <= EXCERPT ? clean : `${clean.slice(0, EXCERPT - 1).trimEnd()}…`;
}

export interface ListOpenReportsOptions {
  limit?: number;
  /** Reports strictly older than this created_at: the last of the page held. */
  before?: string;
}

/** The open reports, newest first, each with its reporter and a line about its target. Admins only. */
export async function listOpenReports(options: ListOpenReportsOptions = {}): Promise<OpenReportsPage> {
  const limit = Math.max(1, Math.min(options.limit ?? REPORTS_PAGE_SIZE, 100));

  let query = db
    .from("content_reports")
    .select(
      "id, target_type, target_id, reason, note, created_at, reporter:profiles!content_reports_reporter_profile_fkey(username, display_name)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (options.before) query = query.lt("created_at", options.before);

  const response = await query;
  if (response.error) throw socialError("listOpenReports", response);
  const rows = (response.data ?? []) as ReportRow[];

  const buildIds = uniqueIds(rows.filter((row) => row.target_type === "build").map((row) => row.target_id));
  const commentIds = uniqueIds(rows.filter((row) => row.target_type === "comment").map((row) => row.target_id));

  const [builds, comments] = await Promise.all([
    buildIds.length > 0
      ? db.from("builds").select("id, slug, title").in("id", buildIds).limit(buildIds.length)
      : Promise.resolve({ data: [], error: null, status: 200 }),
    commentIds.length > 0
      ? db
          .from("build_comments")
          .select("id, body, build:builds!build_comments_build_id_fkey(slug, title)")
          .in("id", commentIds)
          .limit(commentIds.length)
      : Promise.resolve({ data: [], error: null, status: 200 }),
  ]);
  if (builds.error) throw socialError("listOpenReports (builds)", builds);
  if (comments.error) throw socialError("listOpenReports (comments)", comments);

  const buildById = new Map(((builds.data ?? []) as BuildSummaryRow[]).map((row) => [row.id, row]));
  const commentById = new Map(((comments.data ?? []) as CommentSummaryRow[]).map((row) => [row.id, row]));

  const reports = rows.map((row): OpenReport => {
    const reporter = first(row.reporter);
    let summary: OpenReport["summary"];
    if (row.target_type === "build") {
      const build = buildById.get(row.target_id);
      summary = build
        ? { text: (build.title ?? "").trim() || "Untitled build", href: `/b2/${build.slug}` }
        : { text: "A build that is no longer there", href: null };
    } else {
      const comment = commentById.get(row.target_id);
      const on = first(comment?.build);
      summary = comment
        ? {
            text: `“${excerpt(comment.body)}”${on ? ` on ${(on.title ?? "").trim() || "Untitled build"}` : ""}`,
            href: on ? `/b2/${on.slug}#comments` : null,
          }
        : { text: "A comment that is no longer there", href: null };
    }
    return {
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      reason: row.reason,
      note: row.note,
      createdAt: row.created_at,
      reporter: reporter ? { username: reporter.username, displayName: reporter.display_name } : null,
      summary,
    };
  });

  return { reports, nextBefore: rows.length < limit ? null : (rows[rows.length - 1]?.created_at ?? null) };
}

export type ReportAction = "hide" | "dismiss";

/** Close a report: hide its target, or leave it be. Admins only; anyone else gets no_access. */
export async function resolveReport(reportId: string, action: ReportAction): Promise<void> {
  // The generated types do not know resolve_report yet: getBuildFeed.ts's cast.
  const response = await (
    db.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown; status?: number }>
  )("resolve_report", { report: reportId, action });
  if (response.error) throw socialError("resolveReport", response);
}

/**
 * Whether an admin has hidden this build. Asked only on the creator's own
 * page, which is the one place the answer is shown (STATES.md row 15).
 */
export async function isBuildHidden(buildId: string): Promise<boolean> {
  const response = await db.from("builds").select("is_hidden").eq("id", buildId).limit(1).maybeSingle();
  if (response.error) throw socialError("isBuildHidden", response, { buildId });
  return Boolean((response.data as { is_hidden?: boolean } | null)?.is_hidden);
}

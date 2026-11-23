// The admin's Reports tab: every open report, newest first (RC-P17b).
//
// Synth 15 Part F: a table headed by its fact ("3 open reports"): Reason, What
// (the target as one line that links to it, the reporter's note under it),
// Reported by, When, then "Hide" and "Dismiss" as small secondary buttons. The
// selected row's detail fills the side panel with the same actions. Hiding is
// the one that changes what readers see, so it is confirmed in a dialog on the
// modal recipe whose filled button says what it does, "Hide it" (STATES.md
// rows 16, 17). The note is the reporter's own words: shown as plain text, and
// never in an error.

import { useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminConfirm } from "@/components/admin/AdminDialogs";
import { AdminDetail, AdminEmpty, AdminRowsLoading, AdminSection, AdminTable, DetailActions, DetailFact, ADMIN_META, RowAction, adminText, countOf } from "@/components/admin/AdminFrame";
import { isPermissionError } from "@/lib/errors/permission";
import {
  REPORT_REASONS,
  listOpenReports,
  listSiteHiddenPosts,
  resolveReport,
  unhideForSite,
  type OpenReport,
  type OpenReportsPage,
  type ReportAction,
} from "@/lib/moderation";
import { commentTime } from "@/lib/social";
import { t } from "@/lib/theme/tokens";
import { textStep } from "@/lib/theme/type";

export const REPORTS_QUEUE_KEY = "admin-open-reports";
/** UX-09 Q5: the topics and replies the site hid, each with Unhide. */
export const SITE_HIDDEN_KEY = ["moderation", "listSiteHiddenPosts"] as const;

/** What Hide does to each kind of target, in the confirming dialog. */
function hideWords(report: OpenReport | null): { title: string; description: string } {
  if (report?.targetType === "comment") return { title: "Hide this comment?", description: "Only its author and admins will see it. Every open report on it closes." };
  if (report?.targetType === "openbuild_post") {
    const what = report.postKind === "reply" ? "reply" : "topic";
    return {
      title: `Hide this ${what}?`,
      description: `It leaves every feed, space and search. Its author sees it was hidden by the site's moderators; only admins can unhide it. Every open report on it closes.`,
    };
  }
  return { title: "Hide this build?", description: "Only its creator and admins will see it. Every open report on it closes." };
}

const reasonLabel = (value: string) => REPORT_REASONS.find((reason) => reason.value === value)?.label ?? value;

/** What kind of thing was reported, in one word. */
const kindOf = (report: OpenReport) => (report.targetType === "build" ? "Build" : report.targetType === "comment" ? "Comment" : "OpenBuilds");

/** Who reported it. */
const reporterOf = (report: OpenReport) => report.reporter?.displayName?.trim() || (report.reporter?.username ? `@${report.reporter.username}` : "A reader");

const linkStyle = { ...adminText(textStep.body, t.text), textDecoration: "underline", textDecorationColor: t.label, textUnderlineOffset: 3, overflowWrap: "anywhere" } as const;

/** The target, as one line that links to it. */
function Target({ report }: { report: OpenReport }) {
  return report.summary.href ? (
    <Link to={report.summary.href} style={linkStyle}>
      {report.summary.text}
    </Link>
  ) : (
    <span style={adminText(textStep.body, t.text2)}>{report.summary.text}</span>
  );
}

export function ReportsQueue() {
  const queryClient = useQueryClient();
  const queue = useInfiniteQuery({
    queryKey: [REPORTS_QUEUE_KEY],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listOpenReports({ before: pageParam }),
    getNextPageParam: (last: OpenReportsPage) => last.nextBefore ?? undefined,
    refetchOnWindowFocus: false,
  });

  const [hiding, setHiding] = useState<OpenReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const reports = queue.data?.pages.flatMap((page) => page.reports) ?? [];
  const hidden = useQuery({ queryKey: SITE_HIDDEN_KEY, queryFn: () => listSiteHiddenPosts(), refetchOnWindowFocus: false });
  const picked = reports.find((report) => report.id === selected) ?? null;

  const unhide = async (postId: string) => {
    setBusy(postId);
    try {
      await unhideForSite(postId);
      void queryClient.invalidateQueries({ queryKey: SITE_HIDDEN_KEY });
    } catch (error) {
      toast(isPermissionError(error) ? "You don't have access to this." : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const resolve = async (report: OpenReport, action: ReportAction) => {
    setBusy(report.id);
    try {
      await resolveReport(report.id, action);
      // Hiding closes every open report on the same target, so they leave together.
      queryClient.setQueryData<InfiniteData<OpenReportsPage, string | undefined>>([REPORTS_QUEUE_KEY], (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                reports: page.reports.filter((row) =>
                  action === "hide"
                    ? !(row.targetType === report.targetType && row.targetId === report.targetId)
                    : row.id !== report.id,
                ),
              })),
            }
          : data,
      );
      setHiding(null);
      if (action === "hide" && report.targetType === "openbuild_post") void queryClient.invalidateQueries({ queryKey: SITE_HIDDEN_KEY });
    } catch (error) {
      toast(isPermissionError(error) ? "You don't have access to this." : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  /* UX-09 Q5: the site's moderators hide a topic or a reply too, apart from its space's own hide. */
  const actions = (report: OpenReport) => (
    <>
      <RowAction disabled={busy === report.id || (report.targetType === "openbuild_post" && report.postKind === null)} onClick={() => setHiding(report)}>
        Hide
      </RowAction>
      <RowAction disabled={busy === report.id} onClick={() => void resolve(report, "dismiss")}>
        Dismiss
      </RowAction>
    </>
  );

  let list;
  if (queue.isLoading) list = <AdminRowsLoading testId="reports-loading" />;
  else if (queue.isError) {
    list = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <p style={adminText(textStep.body, t.text)}>{isPermissionError(queue.error) ? "You don't have access to this." : "Something went wrong."}</p>
        <RowAction onClick={() => void queue.refetch()}>Try again</RowAction>
      </div>
    );
  } else if (reports.length === 0) list = <AdminEmpty testId="reports-empty">Nothing has been reported.</AdminEmpty>;
  else {
    list = (
      <AdminTable
        label="Open reports"
        rows={reports}
        rowKey={(report) => report.id}
        rowTestId="report-row"
        selected={selected}
        onSelect={setSelected}
        name={{ head: "Reason", cell: (report) => reasonLabel(report.reason), label: (report) => `${reasonLabel(report.reason)}: ${report.summary.text}` }}
        columns={[
          {
            head: "What",
            ownLine: true,
            cell: (report) => (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, maxWidth: 360 }}>
                <span style={ADMIN_META}>{kindOf(report)}</span>
                <Target report={report} />
                {report.note ? <p style={{ ...ADMIN_META, color: t.text2, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{report.note}</p> : null}
              </div>
            ),
          },
          { head: "Reported by", meta: reporterOf, cell: (report) => reporterOf(report) },
          {
            head: "When",
            ownLine: true,
            cell: (report) => (
              <time dateTime={report.createdAt} style={ADMIN_META}>
                {commentTime(report.createdAt)}
              </time>
            ),
          },
        ]}
        actions={actions}
      />
    );
  }

  return (
    <section data-testid="reports-queue" aria-label="Reports" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <AdminSection fact={queue.isLoading || queue.isError ? "Open reports" : countOf(reports.length, "open report")} label="Open reports">
        {list}
        {queue.hasNextPage ? (
          <div>
            <RowAction disabled={queue.isFetchingNextPage} onClick={() => void queue.fetchNextPage()}>
              Show more
            </RowAction>
          </div>
        ) : null}
      </AdminSection>

      {picked ? (
        <AdminDetail fact={`${kindOf(picked)} reported as ${reasonLabel(picked.reason).toLowerCase()}`} onClose={() => setSelected(null)}>
          <DetailFact label="What">
            <Target report={picked} />
          </DetailFact>
          {picked.note ? <DetailFact label="Note">{picked.note}</DetailFact> : null}
          <DetailFact label="Reported by">{reporterOf(picked)}</DetailFact>
          <DetailFact label="When">
            <time dateTime={picked.createdAt}>{commentTime(picked.createdAt)}</time>
          </DetailFact>
          <DetailActions>{actions(picked)}</DetailActions>
        </AdminDetail>
      ) : null}

      {/* UX-09 Q5: what the site hid, newest first, each with Unhide. The report stays resolved. */}
      {(hidden.data ?? []).length > 0 ? (
        <section data-testid="site-hidden" aria-label="Hidden by the site" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={adminText(textStep.headline, t.text, { fontWeight: 600, lineHeight: "24px" })}>{`${countOf((hidden.data ?? []).length, "post")} hidden by the site`}</h2>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {(hidden.data ?? []).map((entry) => (
              <li
                key={entry.id}
                data-testid="site-hidden-row"
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48, padding: "6px 0", boxSizing: "border-box" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 320px" }}>
                  <Link to={entry.href} style={linkStyle}>
                    {`“${entry.text}”`}
                  </Link>
                  <span style={ADMIN_META}>
                    {entry.kind === "topic" ? "Topic" : "Reply"}
                    {entry.hiddenAt ? (
                      <>
                        {" · Hidden "}
                        <time dateTime={entry.hiddenAt}>{commentTime(entry.hiddenAt)}</time>
                      </>
                    ) : null}
                  </span>
                </div>
                <RowAction disabled={busy === entry.id} onClick={() => void unhide(entry.id)}>
                  Unhide
                </RowAction>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <AdminConfirm
        open={hiding !== null}
        onOpenChange={(open) => (!open && busy === null ? setHiding(null) : undefined)}
        title={hideWords(hiding).title}
        description={hideWords(hiding).description}
        confirmLabel="Hide it"
        busy={busy !== null}
        testId="hide-dialog"
        onConfirm={() => hiding && void resolve(hiding, "hide")}
      />
    </section>
  );
}

export default ReportsQueue;

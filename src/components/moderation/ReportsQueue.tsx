// The admin's Reports tab: every open report, newest first (RC-P17b).
//
// It takes the place of the Content Queue, which moderated legacy posts the
// clear deletes. Each row says what was reported (a build or a comment, as one
// line that links to it), why, the reporter's note, who reported it and when;
// then two actions, "Hide" (secondary) and "Dismiss" (tertiary). Hiding is the
// one that changes what readers see, so it is confirmed in the existing Dialog
// whose primary button says what it does, "Hide it" (STATES.md rows 16, 17).
//
// Rows are parted by hairlines, not boxed ⟦law-of-common-region⟧. The note is
// the reporter's own words: shown here as plain text, and never in an error.

import { useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { isPermissionError } from "@/lib/errors/permission";
import {
  REPORT_REASONS,
  listOpenReports,
  resolveReport,
  type OpenReport,
  type OpenReportsPage,
  type ReportAction,
} from "@/lib/moderation";
import { commentTime } from "@/lib/social";
import { skeletonStyle } from "@/lib/theme/controls";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, eyebrow, measure } from "@/lib/theme/type";

export const REPORTS_QUEUE_KEY = "admin-open-reports";

const SECONDARY = { background: "transparent", minHeight: 44 } as const;

const reasonLabel = (value: string) => REPORT_REASONS.find((reason) => reason.value === value)?.label ?? value;

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

  const reports = queue.data?.pages.flatMap((page) => page.reports) ?? [];

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
    } catch (error) {
      toast(isPermissionError(error) ? "You don't have access to this." : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section data-testid="reports-queue" style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
      <h2 style={{ ...eyebrow, color: t.text2, margin: 0 }}>Open reports</h2>

      {queue.isLoading ? (
        <div data-testid="reports-loading" aria-hidden style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}>
          {[0, 1, 2].map((index) => (
            <div key={index} style={{ ...skeletonStyle(), height: 64 }} />
          ))}
        </div>
      ) : queue.isError ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs }}>
          <p style={{ ...body, color: t.text, margin: 0 }}>
            {isPermissionError(queue.error) ? "You don't have access to this." : "Something went wrong."}
          </p>
          <Button type="button" variant="outline" onClick={() => void queue.refetch()} style={SECONDARY}>
            Try again
          </Button>
        </div>
      ) : reports.length === 0 ? (
        <p data-testid="reports-empty" style={{ ...body, color: t.text2, margin: 0 }}>
          Nothing has been reported.
        </p>
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {reports.map((report, index) => (
            <li
              key={report.id}
              data-testid="report-row"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: SPACE.sm,
                paddingBlock: SPACE.sm,
                borderTop: index === 0 ? undefined : `1px solid ${t.line}`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, minWidth: 0, flex: "1 1 320px" }}>
                <span style={{ ...eyebrow, color: t.text2 }}>
                  {report.targetType === "build" ? "Build" : "Comment"} · {reasonLabel(report.reason)}
                </span>
                {report.summary.href ? (
                  <Link to={report.summary.href} style={{ ...body, color: t.text, overflowWrap: "anywhere" }}>
                    {report.summary.text}
                  </Link>
                ) : (
                  <span style={{ ...body, color: t.text2 }}>{report.summary.text}</span>
                )}
                {report.note ? (
                  <p style={{ ...body, ...measure, color: t.text, margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {report.note}
                  </p>
                ) : null}
                <span style={{ fontFamily: DM_MONO, fontSize: 12, lineHeight: 1.3, color: t.text2 }}>
                  {report.reporter?.displayName?.trim() || (report.reporter?.username ? `@${report.reporter.username}` : "A reader")} ·{" "}
                  <time dateTime={report.createdAt}>{commentTime(report.createdAt)}</time>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.xs }}>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy === report.id}
                  onClick={() => setHiding(report)}
                  style={SECONDARY}
                >
                  Hide
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy === report.id}
                  onClick={() => void resolve(report, "dismiss")}
                  style={{ minHeight: 44 }}
                >
                  Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {queue.hasNextPage ? (
        <Button
          type="button"
          variant="outline"
          disabled={queue.isFetchingNextPage}
          onClick={() => void queue.fetchNextPage()}
          style={{ ...SECONDARY, alignSelf: "flex-start" }}
        >
          Show more
        </Button>
      ) : null}

      <Dialog open={hiding !== null} onOpenChange={(open) => (!open && busy === null ? setHiding(null) : undefined)}>
        <DialogContent data-testid="hide-dialog" style={{ maxWidth: 440 }}>
          <DialogTitle style={{ ...body, fontSize: 18, fontWeight: 600 }}>
            Hide this {hiding?.targetType === "comment" ? "comment" : "build"}?
          </DialogTitle>
          <DialogDescription style={{ ...body, color: t.text2 }}>
            {hiding?.targetType === "comment"
              ? "Only its author and admins will see it. Every open report on it closes."
              : "Only its creator and admins will see it. Every open report on it closes."}
          </DialogDescription>
          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: SPACE.xs }}>
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setHiding(null)} style={{ minHeight: 44 }}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={busy !== null}
              onClick={() => hiding && void resolve(hiding, "hide")}
              style={{ minHeight: 44 }}
            >
              Hide it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default ReportsQueue;

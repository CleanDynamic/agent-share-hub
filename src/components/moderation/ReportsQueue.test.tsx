// RC-P17b — the admin's Reports tab, rendered.
//
// The claims: each open report is a row that says what was reported, why, the
// reporter's note, who and when, and links to the target; "Hide" is secondary
// and asks first, in a dialog whose one filled button says "Hide it"; "Dismiss"
// is tertiary and closes one report; hiding clears every row about the same
// target; an empty queue says "Nothing has been reported."; a refused queue
// says "You don't have access to this." The data layer is stubbed at
// src/lib/moderation; the queue is real.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast }));

const listOpenReports = vi.fn();
const resolveReport = vi.fn();
const listSiteHiddenPosts = vi.fn();
const unhideForSite = vi.fn();
vi.mock("@/lib/moderation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/moderation")>()),
  listOpenReports: (...args: unknown[]) => listOpenReports(...args),
  resolveReport: (...args: unknown[]) => resolveReport(...args),
  listSiteHiddenPosts: (...args: unknown[]) => listSiteHiddenPosts(...args),
  unhideForSite: (...args: unknown[]) => unhideForSite(...args),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { ReportsQueue } from "@/components/moderation/ReportsQueue";
import type { OpenReport } from "@/lib/moderation";
import { SocialError } from "@/lib/social";

function report(id: string, over: Partial<OpenReport> = {}): OpenReport {
  return {
    id,
    targetType: "build",
    targetId: "build-1",
    reason: "spam",
    note: null,
    createdAt: "2026-09-28T10:00:00.000Z",
    reporter: { username: "rae", displayName: "Rae" },
    summary: { text: "Invoice reader", href: "/b2/invoice-reader" },
    postKind: null,
    ...over,
  };
}

function renderQueue() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReportsQueue />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rows = () => screen.queryAllByTestId("report-row");

beforeEach(() => {
  vi.clearAllMocks();
  listSiteHiddenPosts.mockResolvedValue([]);
});

describe("ReportsQueue", () => {
  it("lists each report: type and reason, a link to the target, the note, the reporter and the time", async () => {
    listOpenReports.mockResolvedValue({
      reports: [
        report("r1", { note: "Copied from my repo." , reason: "stolen" }),
        report("r2", {
          targetType: "comment",
          targetId: "comment-1",
          reason: "harmful",
          reporter: { username: "sam", displayName: null },
          summary: { text: "“This is rude” on Invoice reader", href: "/b2/invoice-reader#comments" },
        }),
      ],
      nextBefore: null,
    });
    renderQueue();

    await waitFor(() => expect(rows()).toHaveLength(2));
    const [first, second] = rows();
    expect(first.textContent).toContain("Build · Not theirs");
    expect(within(first).getByRole("link", { name: "Invoice reader" }).getAttribute("href")).toBe("/b2/invoice-reader");
    expect(first.textContent).toContain("Copied from my repo.");
    expect(first.textContent).toContain("Rae");
    expect(first.querySelector("time")?.getAttribute("datetime")).toBe("2026-09-28T10:00:00.000Z");

    expect(second.textContent).toContain("Comment · Harmful");
    expect(within(second).getByRole("link").getAttribute("href")).toBe("/b2/invoice-reader#comments");
    expect(second.textContent).toContain("@sam");
  });

  it("gives each row a secondary Hide and a tertiary Dismiss, and nothing filled", async () => {
    listOpenReports.mockResolvedValue({ reports: [report("r1")], nextBefore: null });
    renderQueue();
    await waitFor(() => expect(rows()).toHaveLength(1));

    const row = rows()[0];
    expect(within(row).getByRole("button", { name: "Hide" }).getAttribute("data-visual-slot")).toBe("btn-secondary");
    expect(within(row).getByRole("button", { name: "Dismiss" }).getAttribute("data-visual-slot")).toBeNull();
    expect(row.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(0);
  });

  it("dismisses one report, and only that one", async () => {
    listOpenReports.mockResolvedValue({
      reports: [report("r1"), report("r2", { reason: "broken" })],
      nextBefore: null,
    });
    resolveReport.mockResolvedValue(undefined);
    renderQueue();
    await waitFor(() => expect(rows()).toHaveLength(2));

    fireEvent.click(within(rows()[0]).getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(resolveReport).toHaveBeenCalledWith("r1", "dismiss"));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0].textContent).toContain("Doesn't work");
  });

  it("asks before hiding, in a dialog whose one filled button says Hide it, then clears every row about that target", async () => {
    listOpenReports.mockResolvedValue({
      reports: [
        report("r1"),
        report("r2", { targetType: "comment", targetId: "comment-1", summary: { text: "“x”", href: null } }),
        report("r3", { reason: "harmful" }),
      ],
      nextBefore: null,
    });
    resolveReport.mockResolvedValue(undefined);
    renderQueue();
    await waitFor(() => expect(rows()).toHaveLength(3));

    fireEvent.click(within(rows()[0]).getByRole("button", { name: "Hide" }));
    expect(resolveReport).not.toHaveBeenCalled();

    const dialog = await screen.findByTestId("hide-dialog");
    expect(within(dialog).getByRole("heading", { name: "Hide this build?" })).toBeTruthy();
    const filled = [...dialog.querySelectorAll('[data-visual-slot="btn-primary"]')].map((button) => button.textContent);
    expect(filled).toEqual(["Hide it"]);

    fireEvent.click(within(dialog).getByRole("button", { name: "Hide it" }));

    await waitFor(() => expect(resolveReport).toHaveBeenCalledWith("r1", "hide"));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0].textContent).toContain("Comment");
  });

  it("says Nothing has been reported. when the queue is empty", async () => {
    listOpenReports.mockResolvedValue({ reports: [], nextBefore: null });
    renderQueue();
    expect((await screen.findByTestId("reports-empty")).textContent).toBe("Nothing has been reported.");
  });

  it("says a refusal in one sentence, with a way to try again", async () => {
    listOpenReports.mockRejectedValue(new SocialError("listOpenReports", "no_access", {}, "42501", 403));
    renderQueue();
    expect(await screen.findByText("You don't have access to this.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("keeps the row when resolving is refused, and says why in one sentence", async () => {
    listOpenReports.mockResolvedValue({ reports: [report("r1")], nextBefore: null });
    resolveReport.mockRejectedValue(new SocialError("resolveReport", "no_access", {}, "42501", 403));
    renderQueue();
    await waitFor(() => expect(rows()).toHaveLength(1));

    fireEvent.click(within(rows()[0]).getByRole("button", { name: "Dismiss" }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith("You don't have access to this."));
    expect(rows()).toHaveLength(1);
  });
});

describe("UX-09 P8, Q5: a topic's report in the queue", () => {
  const topicReport = (over: Partial<OpenReport> = {}) =>
    report("r1", { targetType: "openbuild_post", targetId: "p1", postKind: "topic", summary: { text: "Topic: “Can anyone make the scorer faster?”", href: "/openbuilds/topics/p1" }, ...over });

  it("is labelled OpenBuilds, links to the topic, and offers Hide and Dismiss", async () => {
    listOpenReports.mockResolvedValue({ reports: [topicReport()], nextBefore: null });
    renderQueue();
    const [row] = await screen.findAllByTestId("report-row");
    expect(row.textContent).toContain("OpenBuilds · Spam");
    expect(within(row).getByRole("link", { name: "Topic: “Can anyone make the scorer faster?”" }).getAttribute("href")).toBe("/openbuilds/topics/p1");
    expect(within(row).getByRole("button", { name: "Hide" })).toBeEnabled();
    expect(within(row).getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("hides a reply for the site after asking, and lists it under Hidden by the site", async () => {
    listOpenReports.mockResolvedValue({ reports: [topicReport({ postKind: "reply", targetId: "x1", summary: { text: "Reply: “spam”", href: "/openbuilds/topics/p1#reply-x1" } })], nextBefore: null });
    resolveReport.mockResolvedValue(undefined);
    renderQueue();
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(within(rows()[0]).getByRole("button", { name: "Hide" }));
    const dialog = await screen.findByTestId("hide-dialog");
    expect(within(dialog).getByRole("heading", { name: "Hide this reply?" })).toBeTruthy();
    expect(dialog.textContent).toContain("hidden by the site's moderators");

    listSiteHiddenPosts.mockResolvedValue([{ id: "x1", rootId: "p1", kind: "reply", text: "spam", hiddenAt: "2026-11-05T10:00:00.000Z", href: "/openbuilds/topics/p1#reply-x1" }]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Hide it" }));
    await waitFor(() => expect(resolveReport).toHaveBeenCalledWith("r1", "hide"));
    await waitFor(() => expect(rows()).toHaveLength(0));
    const hidden = await screen.findByRole("region", { name: "Hidden by the site" });
    expect(within(hidden).getByRole("link", { name: "“spam”" }).getAttribute("href")).toBe("/openbuilds/topics/p1#reply-x1");
  });

  it("unhides from Hidden by the site", async () => {
    listOpenReports.mockResolvedValue({ reports: [], nextBefore: null });
    listSiteHiddenPosts.mockResolvedValue([{ id: "p9", rootId: "p9", kind: "topic", text: "A topic", hiddenAt: null, href: "/openbuilds/topics/p9" }]);
    unhideForSite.mockResolvedValue(undefined);
    renderQueue();
    const [row] = await screen.findAllByTestId("site-hidden-row");
    listSiteHiddenPosts.mockResolvedValue([]);
    fireEvent.click(within(row).getByRole("button", { name: "Unhide" }));
    await waitFor(() => expect(unhideForSite).toHaveBeenCalledWith("p9"));
    await waitFor(() => expect(screen.queryByTestId("site-hidden-row")).toBeNull());
  });

  it("offers no Hide for a topic that is no longer there", async () => {
    listOpenReports.mockResolvedValue({ reports: [topicReport({ postKind: null, summary: { text: "A topic or reply that is no longer there", href: null } })], nextBefore: null });
    renderQueue();
    const [row] = await screen.findAllByTestId("report-row");
    expect(within(row).getByRole("button", { name: "Hide" })).toBeDisabled();
  });
});

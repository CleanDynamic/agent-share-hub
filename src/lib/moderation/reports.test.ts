// Reporting and the admin's queue, the data layer (RC-P17b).
//
// The same stand-in for the PostgREST builder as src/lib/social/social.test.ts:
// every call is recorded, and a REQUEST is recorded when a builder is awaited,
// which is when supabase-js goes to the network. The claims: a report sends
// exactly the row the migration expects and nothing else; a note never reaches
// an error; the queue names its targets in at most two requests after the
// list; and resolving goes through resolve_report alone.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

type Answer = { data: unknown; error: unknown; status?: number };

let calls: Recorded[] = [];
let builders = 0;
let answer: (table: string, own: Recorded[]) => Answer = () => ({ data: [], error: null, status: 200 });
let session: { user: { id: string } } | null = { user: { id: "reader-1" } };
const rpc = vi.fn();

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "in", "lt", "order", "limit", "maybeSingle"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [], builder: id });
    return Promise.resolve(answer(table, mine())).then(resolve, reject);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: (...args: unknown[]) => rpc(...args),
    auth: { getSession: vi.fn(async () => ({ data: { session } })) },
  },
}));

import {
  REPORT_NOTE_MAX,
  REPORT_REASONS,
  isBuildHidden,
  listOpenReports,
  reportTarget,
  resolveReport,
} from "@/lib/moderation";
import { SocialError } from "@/lib/social";
import { isPermissionError } from "@/lib/errors/permission";

const requests = () => calls.filter((call) => call.method === "request");
const requestsTo = (table: string) => requests().filter((call) => call.table === table);
const callOf = (table: string, method: string) => calls.find((call) => call.table === table && call.method === method);

function reportRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    target_type: "build",
    target_id: "build-1",
    reason: "spam",
    note: null,
    created_at: `2026-09-2${id.slice(-1)}T10:00:00.000Z`,
    reporter: { username: "rae", display_name: "Rae" },
    ...over,
  };
}

beforeEach(() => {
  calls = [];
  builders = 0;
  session = { user: { id: "reader-1" } };
  answer = () => ({ data: [], error: null, status: 200 });
  rpc.mockReset();
});

describe("REPORT_REASONS", () => {
  it("offers five reasons, most likely first and Something else last", () => {
    expect(REPORT_REASONS.map((reason) => reason.label)).toEqual([
      "Spam",
      "Doesn't work",
      "Harmful",
      "Not theirs",
      "Something else",
    ]);
    expect(REPORT_REASONS.map((reason) => reason.value)).toEqual(["spam", "broken", "harmful", "stolen", "other"]);
    expect(REPORT_NOTE_MAX).toBe(500);
  });
});

describe("reportTarget", () => {
  it("files one row as the signed-in reader, in one request", async () => {
    await reportTarget({ targetType: "comment", targetId: "comment-9", reason: "harmful", note: "  it names a person  " });

    expect(requests()).toHaveLength(1);
    expect(callOf("content_reports", "insert")?.args).toEqual([
      {
        target_type: "comment",
        target_id: "comment-9",
        reporter_id: "reader-1",
        reason: "harmful",
        note: "it names a person",
      },
    ]);
  });

  it("sends no note at all when the reader wrote none", async () => {
    await reportTarget({ targetType: "build", targetId: "build-1", reason: "spam", note: "   " });
    expect((callOf("content_reports", "insert")?.args[0] as { note: unknown }).note).toBeNull();
  });

  it("takes a second report of the same thing as done, not as an error", async () => {
    answer = () => ({ data: null, error: { code: "23505" }, status: 409 });
    await expect(reportTarget({ targetType: "build", targetId: "build-1", reason: "spam" })).resolves.toBeUndefined();
  });

  it("refuses an unknown reason or an overlong note before any request", async () => {
    await expect(
      reportTarget({ targetType: "build", targetId: "build-1", reason: "rude" as never }),
    ).rejects.toMatchObject({ kind: "invalid" });
    await expect(
      reportTarget({ targetType: "build", targetId: "build-1", reason: "other", note: "x".repeat(501) }),
    ).rejects.toMatchObject({ kind: "invalid" });
    expect(requests()).toHaveLength(0);
  });

  it("asks nothing of a signed-out reader and says no access", async () => {
    session = null;
    const error = await reportTarget({ targetType: "build", targetId: "build-1", reason: "spam" }).catch((e) => e);
    expect(isPermissionError(error)).toBe(true);
    expect(requests()).toHaveLength(0);
  });

  it("never puts the note in an error: identifiers, code and status only", async () => {
    const note = "the maker is Jordan Pike, jordan@example.com";
    answer = () => ({
      data: null,
      error: { code: "23514", message: `Failing row contains (${note})`, details: note },
      status: 400,
    });

    const error = (await reportTarget({ targetType: "build", targetId: "build-1", reason: "other", note }).catch(
      (e) => e,
    )) as SocialError;

    expect(error).toBeInstanceOf(SocialError);
    expect(error.message).toBe("reportTarget failed: failed (code 23514, status 400, build build-1)");
    expect(JSON.stringify({ ...error, message: error.message })).not.toContain("Jordan");
    expect("cause" in error).toBe(false);
  });

  it("reads a refusal as no access", async () => {
    answer = () => ({ data: null, error: { code: "42501" }, status: 403 });
    const error = await reportTarget({ targetType: "build", targetId: "build-1", reason: "spam" }).catch((e) => e);
    expect(isPermissionError(error)).toBe(true);
  });
});

describe("listOpenReports", () => {
  it("asks once, open reports newest first, fifty at most, with the reporter embedded", async () => {
    const page = await listOpenReports();

    expect(requests()).toHaveLength(1);
    const select = callOf("content_reports", "select")?.args[0] as string;
    expect(select).toContain("reporter:profiles!content_reports_reporter_profile_fkey(username, display_name)");
    expect(select).not.toContain("*");
    expect(callOf("content_reports", "eq")?.args).toEqual(["status", "open"]);
    expect(callOf("content_reports", "order")?.args).toEqual(["created_at", { ascending: false }]);
    expect(callOf("content_reports", "limit")?.args).toEqual([50]);
    expect(page).toEqual({ reports: [], nextBefore: null });
  });

  it("names build targets in one more request, and comment targets in one more again", async () => {
    answer = (table) => {
      if (table === "content_reports") {
        return {
          data: [
            reportRow("r1", { target_type: "build", target_id: "build-1", note: "copied from my repo" }),
            reportRow("r2", { target_type: "comment", target_id: "comment-1", reason: "harmful" }),
            reportRow("r3", { target_type: "build", target_id: "build-1", reason: "stolen" }),
            reportRow("r4", { target_type: "build", target_id: "build-gone" }),
          ],
          error: null,
          status: 200,
        };
      }
      if (table === "builds") return { data: [{ id: "build-1", slug: "invoice-reader", title: "Invoice reader" }], error: null };
      return {
        data: [{ id: "comment-1", body: "  This   is\nrude  ", build: { slug: "invoice-reader", title: "Invoice reader" } }],
        error: null,
      };
    };

    const page = await listOpenReports();

    expect(requests()).toHaveLength(3);
    expect(requestsTo("builds")).toHaveLength(1);
    expect(requestsTo("build_comments")).toHaveLength(1);
    // Each target once.
    expect(callOf("builds", "in")?.args).toEqual(["id", ["build-1", "build-gone"]]);
    expect(callOf("build_comments", "in")?.args).toEqual(["id", ["comment-1"]]);

    expect(page.reports.map((report) => report.summary)).toEqual([
      { text: "Invoice reader", href: "/b2/invoice-reader" },
      { text: "“This is rude” on Invoice reader", href: "/b2/invoice-reader#comments" },
      { text: "Invoice reader", href: "/b2/invoice-reader" },
      { text: "A build that is no longer there", href: null },
    ]);
    expect(page.reports[0]).toMatchObject({
      id: "r1",
      targetType: "build",
      targetId: "build-1",
      reason: "spam",
      note: "copied from my repo",
      reporter: { username: "rae", displayName: "Rae" },
    });
  });

  it("asks for no summaries of a kind the page does not hold", async () => {
    answer = (table) =>
      table === "content_reports"
        ? { data: [reportRow("r1", { target_type: "comment", target_id: "comment-1" })], error: null }
        : { data: [], error: null };

    const page = await listOpenReports();

    expect(requestsTo("builds")).toHaveLength(0);
    expect(requestsTo("build_comments")).toHaveLength(1);
    expect(page.reports[0].summary).toEqual({ text: "A comment that is no longer there", href: null });
  });

  it("pages by created_at: strictly older than the last one held, and says when it has reached the end", async () => {
    answer = (table) =>
      table === "content_reports"
        ? { data: [reportRow("r1"), reportRow("r2")], error: null }
        : { data: [], error: null };

    const full = await listOpenReports({ limit: 2, before: "2026-09-28T10:00:00.000Z" });
    expect(callOf("content_reports", "lt")?.args).toEqual(["created_at", "2026-09-28T10:00:00.000Z"]);
    expect(full.nextBefore).toBe("2026-09-22T10:00:00.000Z");

    calls = [];
    const short = await listOpenReports({ limit: 3 });
    expect(short.nextBefore).toBeNull();
  });

  it("reads a refused list as no access", async () => {
    answer = () => ({ data: null, error: { code: "42501" }, status: 403 });
    const error = await listOpenReports().catch((e) => e);
    expect(isPermissionError(error)).toBe(true);
  });
});

describe("resolveReport", () => {
  it("goes through resolve_report with the report and the action", async () => {
    rpc.mockResolvedValue({ data: null, error: null, status: 204 });
    await resolveReport("report-1", "hide");
    expect(rpc).toHaveBeenCalledWith("resolve_report", { report: "report-1", action: "hide" });
    expect(requests()).toHaveLength(0);
  });

  it("reads 'not allowed' as no access", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not allowed" }, status: 403 });
    const error = await resolveReport("report-1", "dismiss").catch((e) => e);
    expect(isPermissionError(error)).toBe(true);
    expect((error as Error).message).not.toContain("not allowed");
  });
});

describe("isBuildHidden", () => {
  it("asks for the one column, for the one build", async () => {
    answer = () => ({ data: { is_hidden: true }, error: null });
    expect(await isBuildHidden("build-1")).toBe(true);
    expect(callOf("builds", "select")?.args).toEqual(["is_hidden"]);
    expect(callOf("builds", "eq")?.args).toEqual(["id", "build-1"]);
    expect(requests()).toHaveLength(1);
  });
});

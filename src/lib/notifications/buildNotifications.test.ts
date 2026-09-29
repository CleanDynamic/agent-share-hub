// RC-P19 — reading build notifications.
//
// The claims: a page's builds are named in one request however many rows
// there are; each target leads where it should (a build and a bounty's build
// to /b2/<slug>, a comment to its comments, a follow to the follower); a row
// says its stored message; and a kind nobody knows neither crashes nor links.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let answer: (table: string) => { data: unknown; error: unknown; count?: number } = () => ({ data: [], error: null });

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "range", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [] });
    return Promise.resolve(answer(table)).then(resolve, reject);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table) },
}));

import {
  BUILD_NOTIFICATION_KINDS,
  getNotifications,
  notificationHref,
  notificationMessage,
  resolveNotificationBuilds,
  type Notification,
  type NotificationRow,
} from "@/lib/notifications";

const requests = (table?: string) =>
  calls.filter((call) => call.method === "request" && (table === undefined || call.table === table));

function row(n: number, over: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: `n-${n}`,
    recipient_id: "me",
    actor_id: "actor-1",
    notification_type: "like",
    body: "liked your build",
    target_type: "build",
    target_id: `build-${n % 7}`,
    metadata: { build_id: `build-${n % 7}` },
    is_read: false,
    read_at: null,
    created_at: "2026-09-29T10:00:00.000Z",
    ...over,
  };
}

function notification(over: Partial<Notification> = {}): Notification {
  return {
    ...row(1),
    kind: "like",
    actor: { id: "actor-1", username: "maya", display_name: "Maya", avatar_url: null },
    target: null,
    build: { id: "build-1", slug: "invoice-reader", title: "Invoice reader" },
    ...over,
  };
}

beforeEach(() => {
  calls = [];
  answer = () => ({ data: [], error: null });
});

describe("resolveNotificationBuilds", () => {
  it("names the builds of twenty rows in one request, each build once", async () => {
    const rows = Array.from({ length: 20 }, (_, index) => row(index));
    answer = () => ({
      data: Array.from({ length: 7 }, (_, index) => ({ id: `build-${index}`, slug: `slug-${index}`, title: `Build ${index}` })),
      error: null,
    });

    const builds = await resolveNotificationBuilds(rows);

    expect(requests()).toHaveLength(1);
    const ids = calls.find((call) => call.method === "in")?.args[1] as string[];
    expect(ids).toHaveLength(7);
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([7]);
    expect(builds.get("build-3")).toEqual({ id: "build-3", slug: "slug-3", title: "Build 3" });
  });

  it("asks nothing when no row is about a build", async () => {
    await resolveNotificationBuilds([row(1, { metadata: null, target_type: "profile", target_id: "someone" })]);
    expect(requests()).toHaveLength(0);
  });
});

describe("getNotifications", () => {
  it("reads a page of build notifications in three requests: the rows, their actors, their builds", async () => {
    answer = (table) => {
      if (table === "notifications") return { data: Array.from({ length: 20 }, (_, index) => row(index)), error: null, count: 20 };
      if (table === "profiles") return { data: [{ id: "actor-1", username: "maya", display_name: "Maya", avatar_url: null }], error: null };
      return { data: [{ id: "build-1", slug: "invoice-reader", title: "Invoice reader" }], error: null };
    };

    const page = await getNotifications({ userId: "me", limit: 20 });

    expect(requests()).toHaveLength(3);
    expect(requests("builds")).toHaveLength(1);
    const first = page.notifications.find((item) => item.id === "n-1");
    expect(first?.build).toEqual({ id: "build-1", slug: "invoice-reader", title: "Invoice reader" });
    expect(first?.actor?.username).toBe("maya");
  });
});

describe("notificationHref", () => {
  it("leads a build and a bounty's build to the build, a comment to its comments", () => {
    expect(notificationHref(notification())).toBe("/b2/invoice-reader");
    expect(notificationHref(notification({ kind: "solved", target_type: "bounty_build", target_id: "bounty-1" }))).toBe(
      "/b2/invoice-reader",
    );
    expect(notificationHref(notification({ kind: "reply", target_type: "build_comment", target_id: "comment-1" }))).toBe(
      "/b2/invoice-reader#comments",
    );
  });

  it("leads a follow to the follower, and a build the reader cannot read nowhere", () => {
    expect(notificationHref(notification({ kind: "follow", target_type: "profile", target_id: "actor-1", build: null }))).toBe(
      "/profile/maya",
    );
    expect(notificationHref(notification({ build: null }))).toBeNull();
  });

  it("leads a kind nobody knows nowhere", () => {
    expect(notificationHref(notification({ kind: "made_up_kind", target_type: null, target_id: null, build: null }))).toBeNull();
  });
});

describe("notificationMessage", () => {
  it("says each build kind's stored message", () => {
    expect(BUILD_NOTIFICATION_KINDS).toHaveLength(9);
    expect(notificationMessage(notification({ kind: "reproduced", body: "ran your build and it did not work" }))).toBe(
      "ran your build and it did not work",
    );
  });

  it("says a strange kind's stored message, and survives one with none", () => {
    expect(notificationMessage(notification({ kind: "made_up_kind", body: "Something happened." }))).toBe("Something happened.");
    expect(notificationMessage(notification({ kind: "made_up_kind", body: null }))).toBe("New notification");
  });
});

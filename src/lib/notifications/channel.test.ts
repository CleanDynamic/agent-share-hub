// UI-P35a — the notifications channel says whether it is live, and the builds
// on a page of notifications are pictured in one request.
//
// The claims: a subscription reports `live` when the server accepts it and
// `offline` when it closes, errors or times out, and keeps delivering inserts;
// the hook starts `connecting`, ignores the CLOSED a removed channel reports on
// its way out, and joins once per user however often its callback changes; and
// the covers of twenty rows' builds are read in one request, each build once,
// through the card's own select.

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ── a channel whose status and inserts the test drives ── */

interface FakeChannel {
  name: string;
  insert?: (payload: { new: unknown }) => void;
  status?: (status: string) => void;
  removed: boolean;
}

let channels: FakeChannel[] = [];

/* ── a PostgREST builder that records what it was asked ── */

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let answer: () => { data: unknown; error: unknown } = () => ({ data: [], error: null });

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [] });
    return Promise.resolve(answer()).then(resolve, reject);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    channel: (name: string) => {
      const channel: FakeChannel = { name, removed: false };
      channels.push(channel);
      const api = {
        on: (_event: string, _filter: unknown, handler: (payload: { new: unknown }) => void) => {
          channel.insert = handler;
          return api;
        },
        subscribe: (callback: (status: string) => void) => {
          channel.status = callback;
          return channel;
        },
      };
      return api;
    },
    removeChannel: (channel: FakeChannel) => {
      channel.removed = true;
      channel.status?.("CLOSED");
    },
  },
}));

import { subscribeToNewNotifications, useNotificationChannel, type NotificationChannelStatus } from "@/lib/notifications";
import { resolveNotificationCovers } from "@/lib/notifications/covers";

beforeEach(() => {
  channels = [];
  calls = [];
  answer = () => ({ data: [], error: null });
});

describe("subscribeToNewNotifications", () => {
  it("reports live when the server accepts it, offline when it closes, errors or times out", () => {
    const heard: NotificationChannelStatus[] = [];
    const inserts: unknown[] = [];
    subscribeToNewNotifications("me", (row) => inserts.push(row), (status) => heard.push(status));

    const [channel] = channels;
    channel.status?.("SUBSCRIBED");
    channel.insert?.({ new: { id: "n-1" } });
    channel.status?.("CHANNEL_ERROR");
    channel.status?.("SUBSCRIBED");
    channel.status?.("TIMED_OUT");
    channel.status?.("CLOSED");

    expect(heard).toEqual(["live", "offline", "live", "offline", "offline"]);
    expect(inserts).toEqual([{ id: "n-1" }]);
  });

  it("joins nothing without a user", () => {
    subscribeToNewNotifications("", () => undefined);
    expect(channels).toHaveLength(0);
  });
});

describe("useNotificationChannel", () => {
  it("starts connecting, goes live, and hears inserts through the latest callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ callback }) => useNotificationChannel("me", callback), {
      initialProps: { callback: first },
    });
    expect(result.current).toBe("connecting");

    act(() => channels[0].status?.("SUBSCRIBED"));
    expect(result.current).toBe("live");

    rerender({ callback: second });
    expect(channels).toHaveLength(1);

    act(() => channels[0].insert?.({ new: { id: "n-2" } }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith({ id: "n-2" });

    act(() => channels[0].status?.("CHANNEL_ERROR"));
    expect(result.current).toBe("offline");
  });

  it("joins again for a new user and ignores the old channel's CLOSED on its way out", () => {
    const { result, rerender } = renderHook(({ user }) => useNotificationChannel(user, () => undefined), {
      initialProps: { user: "me" as string | null },
    });
    act(() => channels[0].status?.("SUBSCRIBED"));

    rerender({ user: "someone-else" });
    expect(channels[0].removed).toBe(true);
    expect(channels).toHaveLength(2);
    expect(result.current).toBe("connecting");

    act(() => channels[1].status?.("SUBSCRIBED"));
    expect(result.current).toBe("live");

    rerender({ user: null });
    expect(channels[1].removed).toBe(true);
    expect(result.current).toBe("offline");
  });
});

describe("resolveNotificationCovers", () => {
  const media = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    node_id: null,
    bucket: "build-media",
    path: `b/${id}.png`,
    kind: "image",
    width: 1200,
    height: 800,
    poster_path: null,
    duration: null,
    post_position: null,
    post_text: null,
    ...over,
  });
  const card = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    slug: `slug-${id}`,
    title: `Build ${id}`,
    hero_node_id: null,
    cover_media_id: null,
    build_nodes: [],
    build_media: [],
    bounties: [],
    ...over,
  });

  it("pictures the builds of twenty rows in one request, each build once, through the card's select", async () => {
    answer = () => ({
      data: [
        card("build-1", { cover_media_id: "m-1", build_media: [media("m-2"), media("m-1")] }),
        card("build-2", { build_media: [media("m-3", { post_position: 0 })] }),
        card("build-3"),
      ],
      error: null,
    });
    const ids = Array.from({ length: 20 }, (_, index) => `build-${(index % 3) + 1}`);

    const covers = await resolveNotificationCovers(ids);

    expect(calls.filter((call) => call.method === "request")).toHaveLength(1);
    expect(calls[0]).toEqual({ table: "builds", method: "select", args: [expect.stringContaining("build_media!build_media_build_id_fkey(")] });
    expect(calls.find((call) => call.method === "in" && call.args[0] === "id")?.args[1]).toEqual(["build-1", "build-2", "build-3"]);
    expect(calls.find((call) => call.method === "limit")?.args).toEqual([3]);
    expect(covers.get("build-1")?.id).toBe("m-1");
    expect(covers.get("build-2")?.id).toBe("m-3");
    expect(covers.get("build-3")).toBeNull();
  });

  it("asks nothing for no builds", async () => {
    expect((await resolveNotificationCovers([])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("says what failed", async () => {
    answer = () => ({ data: null, error: { message: "boom" } });
    await expect(resolveNotificationCovers(["build-1"])).rejects.toThrow("resolveNotificationCovers failed: boom");
  });
});

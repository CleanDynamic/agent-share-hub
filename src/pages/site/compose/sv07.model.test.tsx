// SV-07 P2: one model from click to result. The session on its way is laid over the stored `making` during render; a refetch
// never takes the page back; a slow import is one entry from the first frame to the last.

import { fireEvent, screen } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import type { Delay } from "@/lib/build/__audit__/fakeSupabase";
import { newerRecord } from "@/hooks/useComposeBuild";

import { numberedWithArriving, replacedBy, withoutSession } from "./sessionModel";
import { CHATS, maker, mount, pickChat, samples, settled, setUp, startSampling, tearDown } from "./sv07Harness";

vi.setConfig({ testTimeout: 60_000 });

const FIRST = "typed-0001";
const making = { sessions_meta: { [FIRST]: { tool: null, date: "2026-10-26" } }, session_order: [FIRST] };
const chat = (over: Partial<Parameters<typeof replacedBy>[3] & object> = {}) => ({ key: "import-1", kind: "chat" as const, status: "writing" as const, ...over });

describe("SV-07 P2 · the session on its way, laid over the stored making", () => {
  it("an import replaces the empty Session 1 from the click: it is left out of what is drawn", () => {
    expect(replacedBy(making, [FIRST], () => false, chat())).toBe(FIRST);
    expect(withoutSession(making, FIRST)).toEqual({ sessions_meta: {}, session_order: [] });
  });

  it("a new draft's Session 1 that is in no order yet is still the one replaced", () => {
    expect(replacedBy({ sessions_meta: making.sessions_meta }, [], () => false, chat())).toBe(FIRST);
  });

  it("nothing is replaced for an empty session, a failed import, a Session 1 with tiles or an app, or one in another part", () => {
    expect(replacedBy(making, [FIRST], () => false, chat({ kind: "empty" }))).toBeNull();
    expect(replacedBy(making, [FIRST], () => false, chat({ status: "failed" }))).toBeNull();
    expect(replacedBy(making, [FIRST], () => true, chat())).toBeNull();
    expect(replacedBy({ ...making, sessions_meta: { [FIRST]: { tool: "claude", date: "2026-10-26" } } }, [FIRST], () => false, chat())).toBeNull();
    const parts = { ...making, workstreams: [{ key: "ws-1" }, { key: "ws-2" }] };
    expect(replacedBy(parts, [FIRST], () => false, chat({ part: "ws-2" }))).toBeNull();
    expect(replacedBy(parts, [FIRST], () => false, chat({ part: "ws-1" }))).toBe(FIRST);
    expect(replacedBy(making, [FIRST], () => false, null)).toBeNull();
  });

  it("the sessions after the one on its way move up a number at once, and are left alone once it has landed", () => {
    const groups = [
      { key: "a", number: 1 },
      { key: "b", number: 2 },
      { key: "c", number: 3 },
    ];
    const arriving = { ...chat(), head: { number: 2 } };
    expect(numberedWithArriving(groups, arriving, (group) => group.key).map((group) => group.number)).toEqual([1, 3, 4]);
    const landed = [...groups, { key: "import-1", number: 4 }];
    expect(numberedWithArriving(landed, arriving, (group) => group.key)).toBe(landed);
    expect(numberedWithArriving(groups, { ...arriving, status: "failed" }, (group) => group.key)).toBe(groups);
  });
});

describe("SV-07 P2 · refetches never undo what the page shows", () => {
  const record = (stamp: string, title: string) => ({ build: { id: "b", updated_at: stamp, title, making: { title } }, tree: [], tray: [], events: [], nodeTypes: [] });

  it("an answer older than the row held is not drawn over it; a newer one is", () => {
    const held = record("2026-10-26T10:00:05Z", "Mine");
    expect(newerRecord(held, record("2026-10-26T10:00:01Z", "Old"))).toBe(held);
    expect((newerRecord(held, record("2026-10-26T10:00:09Z", "New")) as typeof held).build.title).toBe("New");
  });

  it("in the query cache: a stale refetch leaves the newer record in place", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let answer = record("2026-10-26T10:00:05Z", "Mine");
    const options = { queryKey: ["compose", "b"], queryFn: async () => answer, structuralSharing: newerRecord };
    await client.fetchQuery(options);
    answer = record("2026-10-26T10:00:01Z", "Old");
    await client.fetchQuery({ ...options, staleTime: 0 });
    expect((client.getQueryData(["compose", "b"]) as typeof answer).build.title).toBe("Mine");
  });
});

describe("SV-07 P2 · no effect copies the model into other state", () => {
  it("the page, the List and the model work out what they draw during render", () => {
    for (const file of ["SandboxPage.tsx", "BuildList.tsx", "sessionModel.ts"]) {
      const source = readFileSync(join(process.cwd(), "src/pages/site/compose", file), "utf8");
      const effects = source.split(/useEffect\(\s*\(\)\s*=>\s*\{/).slice(1).map((body) => body.slice(0, body.indexOf("\n  }")));
      for (const body of effects) expect(body, file).not.toMatch(/\bset[A-Z]\w*\(\s*(made|making|groups|order|steps|arriving|sourceSessionRows|emptySessions)\b/);
    }
  });
});

describe("SV-07 P2 · a slow import", () => {
  beforeEach(setUp);
  afterEach(tearDown);

  it("is one entry, in one place, from the first frame after the click to the last", async () => {
    // Every write slow: the tiles, the entry, the row and the order land one after another over seconds.
    const slow: Delay[] = ["PATCH", "POST", "DELETE"].map((method) => ({ method, path: /^\/rest\/v1\/(?!rpc)/, delayMs: 400 }));
    mount(slow);
    startSampling();
    maker("open the chats", () => fireEvent.click(screen.getByTestId("empty-build-chats")));
    await pickChat(CHATS[0].name);
    const from = samples.length;
    await settled(1);
    const after = samples.slice(from);
    expect(after.length).toBeGreaterThan(10);
    for (const sample of after) expect(sample.sessions.map((session) => session.key)).toEqual([CHATS[0].id]);
  });
});

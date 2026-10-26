// SV-03 P3: the composer's first-screen reads start together, each on its own key, and the record shares the node types.

import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const started: string[] = [];
const waiting: Array<() => void> = [];
const slow = <T,>(name: string, value: T) => {
  started.push(name);
  return new Promise<T>((resolve) => waiting.push(() => resolve(value)));
};

vi.mock("@/lib/build/builds", async (original) => ({
  ...(await original<typeof import("@/lib/build/builds")>()),
  getBuild: vi.fn((id: string, options?: { nodeTypes?: () => Promise<unknown[]> }) => {
    started.push(`getBuild ${id}`);
    return options?.nodeTypes ? options.nodeTypes().then((types) => ({ build: { id }, nodeTypes: types })) : slow("getBuild", { build: { id } });
  }),
}));
vi.mock("@/lib/build/sessions", async (original) => ({
  ...(await original<typeof import("@/lib/build/sessions")>()),
  listBuildSessions: vi.fn((id: string) => slow(`listBuildSessions ${id}`, [])),
}));
vi.mock("@/lib/build/buildSessions", async (original) => ({
  ...(await original<typeof import("@/lib/build/buildSessions")>()),
  listBuildSessionRows: vi.fn((id: string) => slow(`listBuildSessionRows ${id}`, [])),
}));
vi.mock("@/lib/build/making", async (original) => ({
  ...(await original<typeof import("@/lib/build/making")>()),
  getMadeWith: vi.fn((id: string) => slow(`getMadeWith ${id}`, { madeWith: [], excluded: [] })),
}));
vi.mock("@/lib/build/nodeTypes", async (original) => ({
  ...(await original<typeof import("@/lib/build/nodeTypes")>()),
  getNodeTypes: vi.fn(() => slow("getNodeTypes", [{ key: "team" }])),
}));

import { composeBuildQueryKey } from "@/hooks/composeBuildQueryKey";
import { nodeTypesKey } from "@/lib/build/nodeTypes";

import { buildSessionRowsKey, buildSessionsKey, madeWithKey } from "./useComposeSessions";
import { startComposerReads } from "./composerOpen";

beforeEach(() => {
  started.length = 0;
  waiting.length = 0;
});

describe("startComposerReads", () => {
  it("starts the record, the build's sessions, their rows and Made with in one go, before any has answered", () => {
    const client = new QueryClient();
    startComposerReads(client, "b1");
    expect(started).toEqual(expect.arrayContaining(["getBuild b1", "listBuildSessions b1", "listBuildSessionRows b1", "getMadeWith b1"]));
    expect(started.filter((name) => name.startsWith("getNodeTypes"))).toHaveLength(1);
    expect(waiting.length).toBeGreaterThan(0);
  });

  it("fills the keys the page's hooks read, so each reads what it reads now with no second request", async () => {
    const client = new QueryClient();
    startComposerReads(client, "b1");
    await vi.waitFor(() => expect(waiting.length).toBe(started.length - 1));
    for (const release of waiting) release();
    await vi.waitFor(() => expect(client.getQueryData(composeBuildQueryKey("b1"))).toBeTruthy());
    await vi.waitFor(() => expect(client.getQueryData(buildSessionsKey("b1"))).toEqual([]));
    expect(client.getQueryData(buildSessionRowsKey("b1"))).toEqual([]);
    expect(client.getQueryData(madeWithKey("b1"))).toEqual({ madeWith: [], excluded: [] });
    expect(client.getQueryData(nodeTypesKey)).toEqual([{ key: "team" }]);
  });

  it("asks once for a draft that is already on its way", () => {
    const client = new QueryClient();
    startComposerReads(client, "b1");
    startComposerReads(client, "b1");
    expect(started.filter((name) => name === "listBuildSessions b1")).toHaveLength(1);
  });
});

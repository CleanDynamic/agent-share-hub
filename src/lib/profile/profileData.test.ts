// UI-P34a — what the Profile's new reads ask for and how they fail.
//
// Each read is recorded through a stand-in for supabase-js: the table, the
// columns (named, never *), the filters and the cap. A failed read throws an
// error that carries identifiers only, and a refusal is one isPermissionError
// recognises.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = [string, ...unknown[]];

const stand = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; chain: Call[] }>,
  rpcs: [] as Array<{ fn: string; params: unknown }>,
  /** One answer per request, in order; the last repeats. */
  answers: [] as Array<{ data: unknown; error: unknown; status?: number; count?: number | null }>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const next = () => {
    const answer = stand.answers.length > 1 ? stand.answers.shift()! : stand.answers[0];
    return answer ?? { data: null, error: null, status: 200 };
  };
  const builder = (record: { table: string; chain: Call[] }): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "then") {
            const answer = next();
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(answer).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            record.chain.push([prop, ...args]);
            return builder(record);
          };
        },
      },
    );
  return {
    supabase: {
      from: (table: string) => {
        const record = { table, chain: [] as Call[] };
        stand.calls.push(record);
        return builder(record);
      },
      rpc: (fn: string, params: unknown) => {
        stand.rpcs.push({ fn, params });
        return Promise.resolve(next());
      },
    },
  };
});

import { isPermissionError } from "@/lib/errors/permission";
import { FollowError, followMaker, unfollowMaker } from "./follow";
import {
  afterInReproducedOrder,
  countMakerWorks,
  listMakerReproducedBuilds,
  type ReproducedBuildsCursor,
} from "./makerBuilds";
import { asTrack, getProfileProgress } from "./profileProgress";

const MAKER = "maker-1";
const VIEWER = "viewer-1";

const answer = (...answers: typeof stand.answers) => {
  stand.answers = answers;
};
const method = (chain: Call[], name: string) => chain.filter(([prop]) => prop === name).map(([, ...args]) => args);

beforeEach(() => {
  stand.calls = [];
  stand.rpcs = [];
  stand.answers = [{ data: null, error: null, status: 200 }];
});

describe("getProfileProgress", () => {
  it("reads the maker's own row by named columns, and reads nothing else when it is there", async () => {
    answer({
      data: { xp_total: 1840, level: 7, track: "curator", streak_days: 12, streak_best: 31, last_respec_at: "2026-09-01T00:00:00Z" },
      error: null,
    });

    await expect(getProfileProgress(MAKER)).resolves.toEqual({
      level: 7,
      xpTotal: 1840,
      track: "curator",
      streakDays: 12,
      streakBest: 31,
      lastRespecAt: "2026-09-01T00:00:00Z",
    });
    expect(stand.calls).toHaveLength(1);
    const { table, chain } = stand.calls[0];
    expect(table).toBe("user_progress");
    expect(method(chain, "select")).toEqual([["xp_total, level, track, streak_days, streak_best, last_respec_at"]]);
    expect(method(chain, "eq")).toEqual([["user_id", MAKER]]);
    expect(stand.rpcs).toEqual([]);
  });

  it("falls back to the visible-surfaces function for somebody else's level and track, and knows no XP", async () => {
    answer({ data: null, error: null }, { data: { level: 4, track: "mentor" }, error: null });

    await expect(getProfileProgress(MAKER)).resolves.toEqual({
      level: 4,
      xpTotal: null,
      track: "mentor",
      streakDays: 0,
      streakBest: 0,
      lastRespecAt: null,
    });
    expect(stand.rpcs).toEqual([{ fn: "get_visible_surfaces", params: { _user_id: MAKER } }]);
  });

  it("never reads a track that is not one of the four", () => {
    expect(asTrack("curator")).toBe("curator");
    expect(asTrack("wizard")).toBeNull();
    expect(asTrack(null)).toBeNull();
  });

  it("throws a refusal it can be told by, never a level of 1", async () => {
    answer({ data: null, error: { code: "42501", message: "permission denied for table user_progress" }, status: 403 });

    const error = await getProfileProgress(MAKER).catch((caught: unknown) => caught);
    expect(isPermissionError(error)).toBe(true);
    expect((error as Error).message).toBe(`getProfileProgress failed (user ${MAKER})`);
  });
});

describe("followMaker and unfollowMaker", () => {
  it("insert and delete the one follows row", async () => {
    await followMaker(VIEWER, MAKER);
    await unfollowMaker(VIEWER, MAKER);

    expect(stand.calls.map((call) => call.table)).toEqual(["follows", "follows"]);
    expect(method(stand.calls[0].chain, "insert")).toEqual([[{ follower_id: VIEWER, following_id: MAKER }]]);
    expect(method(stand.calls[1].chain, "delete")).toEqual([[]]);
    expect(method(stand.calls[1].chain, "eq")).toEqual([
      ["follower_id", VIEWER],
      ["following_id", MAKER],
    ]);
  });

  it("fail with the follower's id, the code and the status — never the database's words", async () => {
    answer({ data: null, error: { code: "23505", message: 'duplicate key value violates "follows_pkey"' }, status: 409 });

    const error = await followMaker(VIEWER, MAKER).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(FollowError);
    expect((error as FollowError).code).toBe("23505");
    expect((error as FollowError).status).toBe(409);
    expect((error as FollowError).message).toBe(`followMaker failed (user ${VIEWER})`);
  });
});

describe("countMakerWorks", () => {
  it("asks two head requests: published rebuilds, and reproductions that worked", async () => {
    answer({ data: null, error: null, count: 6 }, { data: null, error: null, count: 48 });

    await expect(countMakerWorks(MAKER)).resolves.toEqual({ rebuilds: 6, reproduced: 48 });
    const [builds, reproductions] = stand.calls;
    expect(builds.table).toBe("builds");
    expect(method(builds.chain, "select")).toEqual([["id", { count: "estimated", head: true }]]);
    expect(method(builds.chain, "eq")).toEqual([["creator_id", MAKER]]);
    expect(method(builds.chain, "in")).toEqual([["status", ["published", "gallery"]]]);
    expect(method(builds.chain, "not")).toEqual([["parent_build_id", "is", null]]);
    expect(reproductions.table).toBe("build_reproductions");
    expect(method(reproductions.chain, "eq")).toEqual([
      ["user_id", MAKER],
      ["worked", true],
    ]);
  });

  it("reads a missing count as zero", async () => {
    answer({ data: null, error: null, count: null });
    await expect(countMakerWorks(MAKER)).resolves.toEqual({ rebuilds: 0, reproduced: 0 });
  });
});

describe("listMakerReproducedBuilds", () => {
  it("reads the maker's working reproductions newest first, one more than a page, then those builds by id", async () => {
    const rows = [
      { id: "r3", build_id: "b3", confirmed_at: "2026-09-03T00:00:00Z" },
      { id: "r2", build_id: "b2", confirmed_at: "2026-09-02T00:00:00Z" },
      { id: "r1", build_id: "b1", confirmed_at: "2026-09-01T00:00:00Z" },
    ];
    const card = (id: string) => ({ id, slug: id, title: id, status: "published", build_nodes: [], build_media: [], bounties: [] });
    answer({ data: rows, error: null }, { data: [card("b2"), card("b3")], error: null });

    const page = await listMakerReproducedBuilds(MAKER, { limit: 2 });

    const [reproductions, builds] = stand.calls;
    expect(reproductions.table).toBe("build_reproductions");
    expect(method(reproductions.chain, "select")).toEqual([["id, build_id, confirmed_at"]]);
    expect(method(reproductions.chain, "order")).toEqual([
      ["confirmed_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(method(reproductions.chain, "limit")).toEqual([[3]]);
    expect(builds.table).toBe("builds");
    expect(method(builds.chain, "in")).toContainEqual(["id", ["b3", "b2"]]);
    expect(page.builds.map((build) => build.id)).toEqual(["b3", "b2"]);
    expect(page.next).toEqual({ confirmedAt: "2026-09-02T00:00:00Z", reproductionId: "r2" });
  });

  it("is the last page when there is no extra row, and asks for no builds when there are no reproductions", async () => {
    answer({ data: [], error: null });

    await expect(listMakerReproducedBuilds(MAKER)).resolves.toEqual({ builds: [], next: null });
    expect(stand.calls).toHaveLength(1);
  });

  it("continues strictly after the cursor, ties broken by id", () => {
    const cursor: ReproducedBuildsCursor = { confirmedAt: "2026-09-02T00:00:00Z", reproductionId: "r2" };
    expect(afterInReproducedOrder(cursor)).toBe(
      'confirmed_at.lt."2026-09-02T00:00:00Z",and(confirmed_at.eq."2026-09-02T00:00:00Z",id.lt.r2)',
    );
  });

  it("throws with identifiers only", async () => {
    answer({ data: null, error: { code: "42501", message: "nope" }, status: 403 });
    const error = await listMakerReproducedBuilds(MAKER).catch((caught: unknown) => caught);
    expect(isPermissionError(error)).toBe(true);
    expect((error as Error).message).toBe(`listMakerReproducedBuilds (reproductions) failed (user ${MAKER})`);
  });
});

// Collections that hold builds, the data layer (RC-P18).
//
// The same stand-in for the PostgREST builder as src/lib/social/social.test.ts:
// every call is recorded, and a REQUEST is recorded when a builder is awaited.
// The claims: a list's builds cost one request however many there are; a
// build goes into a collection as a build (item_kind, build_id) and moves the
// collection to the top; the lists order by the reader's last use and leave
// the legacy default out; a name is refused before any request when empty or
// too long, and never reaches an error.

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

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "eq", "in", "lt", "order", "limit", "single", "maybeSingle"]) {
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
    rpc: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session } })) },
  },
}));

import {
  COLLECTION_NAME_MAX,
  addBuildToCollection,
  listCollectionBuilds,
  listCollections,
  removeBuildFromCollection,
  renameCollection,
  resolveBuildItems,
  startCollection,
} from "@/lib/library";
import { GALLERY_BUILD_COLUMNS } from "@/lib/build/gallery";
import { SocialError } from "@/lib/social";
import { isPermissionError } from "@/lib/errors/permission";

const requests = () => calls.filter((call) => call.method === "request");
const requestsTo = (table: string) => requests().filter((call) => call.table === table);
const callsOf = (table: string, method: string) => calls.filter((call) => call.table === table && call.method === method);
const callOf = (table: string, method: string) => callsOf(table, method)[0];

const buildRow = (n: number) => ({
  id: `build-${n}`,
  creator_id: "maker-1",
  slug: `build-${n}`,
  title: `Build ${n}`,
  outcome: "Does a thing.",
  shape: "workflow",
  status: "published",
  made_for: [],
  made_with: [],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  completeness: 90,
  reproduction_count: 1,
  last_confirmed_at: null,
  last_confirmed_model: null,
  published_at: "2026-09-01T00:00:00.000Z",
  parent_build_id: null,
  rebuild_count: 0,
  rebuild_note: null,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  build_nodes: [],
  build_media: [],
  bounties: [],
});

beforeEach(() => {
  calls = [];
  builders = 0;
  session = { user: { id: "reader-1" } };
  answer = () => ({ data: [], error: null, status: 200 });
});

describe("resolveBuildItems", () => {
  it("reads twenty builds in one request, with the card's own columns", async () => {
    const ids = Array.from({ length: 20 }, (_, index) => `build-${index + 1}`);
    answer = () => ({ data: ids.map((_, index) => buildRow(index + 1)), error: null });

    const builds = await resolveBuildItems([...ids, "build-1"]);

    expect(requests()).toHaveLength(1);
    expect(String(callOf("builds", "select")?.args[0])).toContain(GALLERY_BUILD_COLUMNS);
    expect(callOf("builds", "in")?.args).toEqual(["id", ids]);
    expect(callsOf("builds", "limit")[0]?.args).toEqual([20]);
    expect(builds.size).toBe(20);
    expect(builds.get("build-3")?.title).toBe("Build 3");
  });

  it("asks nothing for no builds", async () => {
    expect((await resolveBuildItems([])).size).toBe(0);
    expect(requests()).toHaveLength(0);
  });
});

describe("addBuildToCollection", () => {
  it("puts the build in as a build, after the last item, and moves the collection to the top", async () => {
    answer = (table, own) =>
      table === "collection_items" && own.some((call) => call.method === "maybeSingle")
        ? { data: { position: 4 }, error: null }
        : { data: null, error: null, status: 201 };

    await addBuildToCollection("col-1", "build-7");

    expect(callOf("collection_items", "insert")?.args).toEqual([
      {
        collection_id: "col-1",
        item_kind: "build",
        build_id: "build-7",
        item_id: "build-7",
        content_id: null,
        added_by: "reader-1",
        position: 5,
      },
    ]);
    const touch = callOf("collections", "update")?.args[0] as { updated_at: string };
    expect(Number.isNaN(Date.parse(touch.updated_at))).toBe(false);
    expect(callOf("collections", "eq")?.args).toEqual(["id", "col-1"]);
    expect(requests()).toHaveLength(3);
  });

  it("takes a build already in the collection as done", async () => {
    answer = (table, own) =>
      own.some((call) => call.method === "insert") ? { data: null, error: { code: "23505" }, status: 409 } : { data: null, error: null };
    await expect(addBuildToCollection("col-1", "build-7")).resolves.toBeUndefined();
  });

  it("asks nothing of a reader who is not signed in", async () => {
    session = null;
    const error = await addBuildToCollection("col-1", "build-7").catch((e) => e);
    expect(isPermissionError(error)).toBe(true);
    expect(requests()).toHaveLength(0);
  });

  it("reads a refusal as no access, with the ids and nothing else", async () => {
    answer = (table, own) =>
      own.some((call) => call.method === "insert")
        ? { data: null, error: { code: "42501", message: "new row violates row-level security policy" }, status: 403 }
        : { data: null, error: null };
    const error = (await addBuildToCollection("col-1", "build-7").catch((e) => e)) as SocialError;
    expect(isPermissionError(error)).toBe(true);
    expect(error.message).toBe("addBuildToCollection failed: no access (code 42501, status 403, build build-7, collection col-1)");
  });
});

describe("removeBuildFromCollection", () => {
  it("removes the one build from the one collection", async () => {
    await removeBuildFromCollection("col-1", "build-7");
    expect(callOf("collection_items", "delete")).toBeTruthy();
    expect(callsOf("collection_items", "eq").map((call) => call.args)).toEqual([
      ["collection_id", "col-1"],
      ["build_id", "build-7"],
    ]);
  });
});

describe("listCollections", () => {
  it("asks once for the reader's own, the one used last first, without the legacy default", async () => {
    answer = () => ({
      data: [{ id: "col-2", owner_id: "reader-1", title: "Invoices", is_public: false, updated_at: "2026-09-29T10:00:00.000Z", collection_items: [{ count: 3 }] }],
      error: null,
    });

    const list = await listCollections();

    expect(requests()).toHaveLength(1);
    expect(String(callOf("collections", "select")?.args[0])).toContain("collection_items(count)");
    expect(callsOf("collections", "eq").map((call) => call.args)).toEqual([
      ["owner_id", "reader-1"],
      ["is_default", false],
    ]);
    expect(callOf("collections", "order")?.args).toEqual(["updated_at", { ascending: false }]);
    expect(callOf("collections", "limit")?.args).toEqual([50]);
    expect(list).toEqual([
      { id: "col-2", ownerId: "reader-1", name: "Invoices", isPrivate: true, itemCount: 3, lastUsedAt: "2026-09-29T10:00:00.000Z" },
    ]);
  });

  it("shows another reader only their public collections", async () => {
    await listCollections({ ownerId: "maker-9" });
    expect(callsOf("collections", "eq").map((call) => call.args)).toContainEqual(["is_public", true]);
    expect(callsOf("collections", "eq").map((call) => call.args)).toContainEqual(["owner_id", "maker-9"]);
  });
});

describe("listCollectionBuilds", () => {
  it("reads a page in two requests, newest addition first, and skips what cannot be read", async () => {
    answer = (table) =>
      table === "collection_items"
        ? {
            data: [
              { build_id: "build-2", added_at: "2026-09-28T10:00:00.000Z" },
              { build_id: "build-gone", added_at: "2026-09-27T10:00:00.000Z" },
            ],
            error: null,
          }
        : { data: [buildRow(2)], error: null };

    const page = await listCollectionBuilds("col-1", { limit: 2, before: "2026-09-29T00:00:00.000Z" });

    expect(requests()).toHaveLength(2);
    expect(callsOf("collection_items", "eq").map((call) => call.args)).toEqual([
      ["collection_id", "col-1"],
      ["item_kind", "build"],
    ]);
    expect(callOf("collection_items", "lt")?.args).toEqual(["added_at", "2026-09-29T00:00:00.000Z"]);
    expect(page.items.map((item) => item.build.id)).toEqual(["build-2"]);
    expect(page.nextBefore).toBe("2026-09-27T10:00:00.000Z");
  });
});

describe("naming a collection", () => {
  it("refuses an empty or overlong name before any request", async () => {
    await expect(startCollection("   ")).rejects.toMatchObject({ kind: "invalid" });
    await expect(startCollection("x".repeat(COLLECTION_NAME_MAX + 1))).rejects.toMatchObject({ kind: "invalid" });
    await expect(renameCollection("col-1", "")).rejects.toMatchObject({ kind: "invalid" });
    expect(requests()).toHaveLength(0);
  });

  it("starts a private collection for the reader, and never puts its name in an error", async () => {
    const name = "Jordan's client work";
    answer = () => ({
      data: null,
      error: { code: "23514", message: `Failing row contains (${name})`, details: name },
      status: 400,
    });

    const error = (await startCollection(name).catch((e) => e)) as SocialError;

    expect(callOf("collections", "insert")?.args[0]).toMatchObject({
      owner_id: "reader-1",
      title: name,
      is_public: false,
      is_default: false,
    });
    expect(error).toBeInstanceOf(SocialError);
    expect(error.message).not.toContain("Jordan");
    expect(JSON.stringify({ ...error })).not.toContain("Jordan");
  });
});

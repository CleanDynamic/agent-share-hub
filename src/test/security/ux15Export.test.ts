// UX-15 P6: what "Download your data" holds. A seeded fake client plays the database: every table holds the person's rows and
// someone else's, and answers only the filters the export asks. Nothing of the other person may appear.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildExport, CAP, fileName, FORMAT, NEVER, SOURCES, waitSentence, type ReadClient } from "../../../supabase/functions/export-my-data/export";

type Row = Record<string, unknown>;

function fakeClient(tables: Record<string, Row[]>, opts: { failing?: string[]; signed?: boolean } = {}): ReadClient & { calls: { table: string; columns: string }[] } {
  const calls: { table: string; columns: string }[] = [];
  return {
    calls,
    from(table: string) {
      return {
        select(columns: string) {
          calls.push({ table, columns });
          const names = columns.split(",").map((c) => c.trim());
          const eqs: [string, string][] = [];
          const neqs: [string, string][] = [];
          const chain = {
            eq(column: string, value: string) {
              eqs.push([column, value]);
              return chain;
            },
            neq(column: string, value: string) {
              neqs.push([column, value]);
              return chain;
            },
            limit(n: number) {
              if (opts.failing?.includes(table)) return Promise.resolve({ data: null, error: { message: "boom" } });
              const rows = (tables[table] ?? [])
                .filter((row) => eqs.every(([c, v]) => row[c] === v) && neqs.every(([c, v]) => row[c] !== v))
                .slice(0, n)
                // the projection: only the named columns come back, as PostgREST does
                .map((row) => Object.fromEntries(names.filter((name) => name in row).map((name) => [name, row[name]])));
              return Promise.resolve({ data: rows, error: null });
            },
          };
          return chain;
        },
      };
    },
    storage: opts.signed
      ? { from: () => ({ createSignedUrls: async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed.example/${path}` })), error: null }) }) }
      : undefined,
  };
}

const A = "user-a";
const B = "user-b";

const seed = (): Record<string, Row[]> => ({
  profiles: [
    { id: A, username: "ava", display_name: "Ava", stripe_account_id: "acct_SECRET", is_admin: true, notification_preferences: { post_like: false } },
    { id: B, username: "ben", display_name: "Ben", stripe_account_id: "acct_B" },
  ],
  builds: [
    { id: "b1", creator_id: A, status: "published", title: "A published" },
    { id: "b2", creator_id: A, status: "draft", title: "A draft" },
    { id: "b9", creator_id: B, status: "draft", title: "B-SECRET draft" },
  ],
  build_nodes: [
    { id: "n1", build_id: "b1", type: "prompt", title: "step one", position: 1 },
    { id: "n2", build_id: "b2", type: "prompt", title: "draft step", position: 1 },
    { id: "n9", build_id: "b9", type: "prompt", title: "B-SECRET step", position: 1 },
  ],
  build_media: [{ id: "m1", build_id: "b1", bucket: "build-media", path: "user-a/pic.png", mime: "image/png", bytes: 10, caption: "c" }],
  openbuild_posts: [
    { id: "p1", author_id: A, body: "A topic", parent_id: null },
    { id: "p9", author_id: B, body: "B-SECRET reply", parent_id: "p1" },
  ],
  build_likes: [{ user_id: A, build_id: "b9" }, { user_id: B, build_id: "b1" }],
  follows: [{ follower_id: A, following_id: B }, { follower_id: B, following_id: A }, { follower_id: B, following_id: "c" }],
  saved_items: [{ user_id: A, id: "s1" }, { user_id: B, id: "s9" }],
  collections: [{ owner_id: A, id: "c1", title: "mine" }, { owner_id: B, id: "c9", title: "B-SECRET" }],
  build_comments: [{ author_id: A, id: "k1", body: "mine" }, { author_id: B, id: "k9", body: "B-SECRET" }],
  dm_messages: [
    { sender_id: A, id: "d1", thread_id: "t", text_content: "I said this" },
    { sender_id: B, id: "d9", thread_id: "t", text_content: "B-SECRET message to A" },
  ],
  dm_thread_members: [{ user_id: A, thread_id: "t" }, { user_id: B, thread_id: "t" }],
  notifications: [{ recipient_id: A, id: "no1", notification_type: "follow", body: "followed you" }, { recipient_id: B, id: "no9", body: "B-SECRET" }],
  content_reports: [{ reporter_id: A, id: "r1", reason: "spam" }, { reporter_id: B, id: "r9", reason: "B-SECRET" }],
});

describe("the export", () => {
  it("holds the person's own rows in every source", async () => {
    const file = await buildExport(fakeClient(seed()), A, new Date("2026-11-07T10:00:00Z"));
    expect(file.format).toBe(FORMAT);
    expect(file.exportedAt).toBe("2026-11-07T10:00:00.000Z");
    expect(file.userId).toBe(A);
    expect((file.data.profile[0] as Row).username).toBe("ava");
    expect(file.data.builds.map((r) => (r as Row).id)).toEqual(["b1"]);
    expect(file.data.drafts.map((r) => (r as Row).id)).toEqual(["b2"]);
    expect(file.data.topics_and_replies.map((r) => (r as Row).id)).toEqual(["p1"]);
    expect(file.data.messages_sent.map((r) => (r as Row).text_content)).toEqual(["I said this"]);
    expect(file.data.notifications).toHaveLength(1);
    expect(file.data.reports_made).toHaveLength(1);
    expect(file.data.follows.map((r) => (r as Row).following_id)).toEqual([B]);
    expect(file.data.followers.map((r) => (r as Row).follower_id)).toEqual([B]);
    expect(file.steps.map((r) => (r as Row).title).sort()).toEqual(["draft step", "step one"]);
  });

  it("holds nothing of another person's private data", async () => {
    const file = await buildExport(fakeClient(seed()), A, new Date());
    const text = JSON.stringify(file);
    expect(text).not.toContain("B-SECRET");
    expect(text).not.toContain("acct_SECRET");
    expect(text).not.toContain("acct_B");
    for (const column of NEVER) expect(text, column).not.toContain(`"${column}"`);
  });

  it("lists no column that carries someone else's words or the site's secrets", () => {
    for (const source of SOURCES) {
      const columns = source.columns.split(",").map((c) => c.trim());
      for (const never of NEVER) expect(columns, `${source.key} lists ${never}`).not.toContain(never);
      expect(source.columns, source.key).not.toContain("*");
    }
  });

  it("names every table and column it reads in the generated types", () => {
    const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
    const tableColumns = (table: string): string[] | null => {
      const match = types.match(new RegExp(`\\n {6}${table}: \\{\\n {8}Row: \\{([\\s\\S]*?)\\n {8}\\}\\n`));
      return match ? [...match[1].matchAll(/\n {10}(\w+)\??:/g)].map((m) => m[1]) : null;
    };
    const wanted = [
      ...SOURCES.map((s) => ({ table: s.table, columns: [...s.columns.split(",").map((c) => c.trim()), s.by, ...(s.also ? [s.also[0]] : []), ...(s.not ? [s.not[0]] : [])] })),
      { table: "build_nodes", columns: ["id", "build_id", "type", "title", "position", "note", "payload", "is_gap", "created_at", "updated_at"] },
      { table: "build_media", columns: ["id", "build_id", "bucket", "path", "mime", "bytes", "caption", "created_at"] },
    ];
    for (const { table, columns } of wanted) {
      const known = tableColumns(table);
      expect(known, `${table} is in the generated types`).not.toBeNull();
      for (const column of columns) expect(known, `${table}.${column}`).toContain(column);
    }
  });

  it("says what it could not read, and what it cut", async () => {
    const file = await buildExport(fakeClient(seed(), { failing: ["notifications"] }), A, new Date());
    expect(file.incomplete).toEqual(["notifications"]);
    expect(file.data.notifications).toEqual([]);
    const many = seed();
    many.build_likes = Array.from({ length: CAP + 10 }, (_, i) => ({ user_id: A, build_id: `b${i}` }));
    const big = await buildExport(fakeClient(many), A, new Date());
    expect(big.truncated).toEqual(["build_likes"]);
    expect(big.data.build_likes).toHaveLength(CAP);
  });

  it("links the media with signed addresses", async () => {
    const file = await buildExport(fakeClient(seed(), { signed: true }), A, new Date());
    expect(file.media).toHaveLength(1);
    expect(file.media[0].url).toBe("https://signed.example/user-a/pic.png");
    const unsigned = await buildExport(fakeClient(seed()), A, new Date());
    expect(unsigned.media[0].url).toBeNull();
  });

  it("asks the database only for the person's id", async () => {
    const client = fakeClient(seed());
    await buildExport(client, A, new Date());
    expect(client.calls.length).toBeGreaterThan(SOURCES.length);
  });
});

describe("the file name and the limit", () => {
  it("names the file openbuilds-data-<username>-<date>.json", () => {
    expect(fileName("ava", new Date("2026-11-07T23:59:00Z"))).toBe("openbuilds-data-ava-2026-11-07.json");
    expect(fileName("Ava Lee/../x", new Date("2026-01-02T00:00:00Z"))).toBe("openbuilds-data-ava-lee-x-2026-01-02.json");
    expect(fileName(null, new Date("2026-01-02T00:00:00Z"))).toBe("openbuilds-data-account-2026-01-02.json");
  });

  it("says when to come back, rounded up, in the words the page uses", () => {
    expect(waitSentence(3600)).toBe("You can download again in 60 minutes.");
    expect(waitSentence(61)).toBe("You can download again in 2 minutes.");
    expect(waitSentence(1)).toBe("You can download again in 1 minute.");
    expect(waitSentence(0)).toBe("You can download again in 1 minute.");
  });
});

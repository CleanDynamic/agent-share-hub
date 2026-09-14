// Tier 2 — the Supabase stub the messaging specs run against.
//
// WHY THIS EXISTS. BG-P26's acceptance asks for proof that "realtime still
// delivers: send a message in one context and see it arrive in another". The
// e2e skill's auth-fixture pattern answers that with a dedicated test user in a
// DEV Supabase project. This repo has exactly one `.env`, pointing at one
// project, and nothing in the tree says it is a dev project. Creating users and
// writing DMs into what may be production, to prove a repaint did not break a
// bubble radius, is not a trade worth making. So the transport is stubbed here
// instead, at the two boundaries the app actually talks through: PostgREST over
// HTTP and Phoenix over a WebSocket.
//
// WHAT THAT BUYS, BEYOND SAFETY. A stub is not the poor relation of a live
// project for this particular job — it is better at it. The test *drives* the
// INSERT frame itself, so "a message arrived over realtime" is asserted at a
// known instant instead of waited for. Nothing here sleeps, and nothing here
// flakes because a remote broker was slow.
//
// WHAT IT DELIBERATELY DOES NOT COVER. RLS. These stubs serve whatever the seed
// says, so they cannot prove a policy hides user B's threads from user A. That
// needs a live project and is called out in the spec header too, so nobody reads
// a green tier 2 as covering it.
//
// NOTHING REACHES THE NETWORK. `installSupabaseStub` routes every `/rest/v1/**`
// and `/realtime/v1/**` request, and the catch-all at the end of the REST
// handler fails the test on an unrecognised table rather than falling through to
// the real project. That is the property that makes this safe to run anywhere.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, WebSocketRoute } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");

/* ───────────────────────── project ref ───────────────────────── */

/**
 * The Supabase auth session lives under `sb-<projectRef>-auth-token`, where
 * projectRef is the first label of the API hostname — see supabase-js's
 * SupabaseClient constructor. We need the same key to inject a session, so we
 * read the URL the app itself was built with.
 *
 * `.env` is gitignored, so CI supplies the value as a real environment variable;
 * locally it comes from the file. Either way we never print it.
 */
function supabaseUrl(): string {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
  const envPath = path.join(REPO_ROOT, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  throw new Error(
    "VITE_SUPABASE_URL is not set and .env does not define it — tier 2 cannot " +
      "derive the auth storage key. Set it in the environment before running."
  );
}

export function projectRef(): string {
  return new URL(supabaseUrl()).hostname.split(".")[0];
}

/* ───────────────────────── identities ───────────────────────── */

/** The signed-in user every tier-2 spec runs as. */
export const ME = {
  id: "00000000-0000-4000-8000-00000000beef",
  username: "testviewer",
  display_name: "Test Viewer",
  avatar_url: null as string | null,
};

/** The other party in the direct thread. */
export const THEM = {
  id: "00000000-0000-4000-8000-0000000000aa",
  username: "otherparty",
  display_name: "Other Party",
  avatar_url: null as string | null,
};

/* ───────────────────────── seed shape ───────────────────────── */

export interface Seed {
  /** Rows per table name, exactly as PostgREST would return them. */
  tables: Record<string, any[]>;
}

/** A thread with a short history, used by most specs. */
export function defaultSeed(): Seed {
  const threadId = "00000000-0000-4000-8000-00000000d001";
  const t = (minsAgo: number) =>
    new Date(Date.now() - minsAgo * 60_000).toISOString();

  return {
    tables: {
      profiles: [ME, THEM],
      follows: [{ follower_id: ME.id, following_id: THEM.id }],
      dm_thread_members: [
        {
          thread_id: threadId,
          user_id: ME.id,
          // Chosen so the two unread paths agree: getThreads counts messages
          // from the other party after this instant (the two at t(3) and t(2)),
          // and useUnreadMessages reads unread_count_a below. Both say 2. A seed
          // where they disagreed would make an unread assertion meaningless.
          last_read_at: t(15),
          is_pinned: false,
          is_muted: false,
          joined_at: t(600),
        },
      ],
      dm_threads: [
        {
          id: threadId,
          type: "direct",
          title: null,
          created_by: ME.id,
          pinned_content_id: null,
          pinned_content_type: null,
          participant_a: ME.id,
          participant_b: THEM.id,
          is_pinned_a: false,
          is_pinned_b: false,
          is_deleted_a: false,
          is_deleted_b: false,
          request_status: "accepted",
          last_message_at: t(2),
          last_message_preview: "the last thing they said",
          last_message_sender_id: THEM.id,
          is_archived: false,
          unread_count_a: 2,
          unread_count_b: 0,
        },
      ],
      // A run of three from THEM, one from ME, then a run of two from THEM —
      // so the grouping rule (a repeated avatar and timestamp dropped inside a
      // run) has both a run to collapse and a sender change to break on.
      dm_messages: [
        msg(threadId, THEM.id, "first of a run", t(20)),
        msg(threadId, THEM.id, "second of the same run", t(19)),
        msg(threadId, THEM.id, "third of the same run", t(18)),
        msg(threadId, ME.id, "my reply, the other side", t(10)),
        msg(threadId, THEM.id, "first of the closing run", t(3)),
        msg(threadId, THEM.id, "the last thing they said", t(2)),
      ],
      notifications: [],
    },
  };
}

export const DEFAULT_THREAD_ID = "00000000-0000-4000-8000-00000000d001";

/* ───────────────────── notification subkinds ───────────────────── */

/**
 * Every subkind NotificationCard can render, one row each.
 *
 * BG-P26's acceptance 4 is "every notification subkind renders — enumerate
 * them". This list IS that enumeration, and the spec asserts a row for each, so
 * the enumeration cannot drift from what is actually covered: adding a subkind
 * to the card without adding it here leaves it untested, and adding it here
 * without the card handling it turns the spec red.
 *
 * `kind` is the column the page reads as `notification_type`; the bounty
 * subkind travels in `metadata.sub`, which is where triggers.ts puts it.
 */
export const NOTIFICATION_SUBKINDS: {
  key: string;
  kind: string;
  metadata: Record<string, unknown>;
  /** A fragment of the copy the row must show. */
  expect: string;
}[] = [
  { key: "reference_received", kind: "reference_received", metadata: {}, expect: "referenced your" },
  { key: "new_follower", kind: "new_follower", metadata: {}, expect: "followed you" },
  { key: "engagement_like", kind: "engagement", metadata: { engagementType: "like" }, expect: "liked your" },
  { key: "engagement_repost", kind: "engagement", metadata: { engagementType: "repost" }, expect: "reposted your" },
  { key: "engagement_comment", kind: "engagement", metadata: { engagementType: "comment" }, expect: "commented on your" },
  { key: "bounty_solution_submitted", kind: "bounty_interaction", metadata: { sub: "solution_submitted" }, expect: "submitted a solution" },
  { key: "bounty_solution_accepted", kind: "bounty_interaction", metadata: { sub: "solution_accepted" }, expect: "solution was accepted" },
  { key: "bounty_new_comment", kind: "bounty_interaction", metadata: { sub: "new_comment" }, expect: "New comment on your bounty" },
  { key: "bounty_solver_overtaken", kind: "bounty_interaction", metadata: { sub: "bounty_solver_overtaken", previous_rank: 2, new_rank: 3 }, expect: "overtook your rank" },
  { key: "meta_bounty_sub_spawned", kind: "bounty_interaction", metadata: { sub: "meta_bounty_sub_spawned", sub_title: "Spawned Sub" }, expect: "Spawned Sub" },
  { key: "bounty_deadline_approaching", kind: "bounty_interaction", metadata: { sub: "bounty_deadline_approaching", hours_remaining: 6 }, expect: "Bounty deadline" },
  { key: "bounty_promoted_to_blueprint", kind: "bounty_interaction", metadata: { sub: "bounty_promoted_to_blueprint", bounty_title: "Promoted Bounty" }, expect: "Promoted Bounty" },
  { key: "new_message", kind: "new_message", metadata: {}, expect: "New message from" },
  { key: "mention", kind: "mention", metadata: {}, expect: "mentioned you" },
  { key: "system", kind: "system", metadata: {}, expect: "A system notice" },
];

/** The day headings groupNotificationsByTime produces, in its own order. */
export const DAY_HEADINGS = ["Today", "Yesterday", "Earlier"] as const;

/**
 * One notification per subkind, dated into three day buckets.
 *
 * DATES ARE ANCHORED TO LOCAL MIDNIGHT, NOT TO "N HOURS AGO", because
 * groupNotificationsByTime buckets on calendar boundaries. An offset in hours
 * drifts across those boundaries depending on the time of day the suite runs —
 * "26 hours ago" is yesterday at 10:00 but the day before at 00:10.
 *
 * The third bucket is "Earlier" rather than "This week" for the same class of
 * reason: `thisWeekStart` is the most recent Sunday, so a row three days old is
 * "This week" midweek and "Earlier" on a Monday. Thirty days back is "Earlier"
 * on every day of the week.
 */
export function notificationsSeed(): Seed {
  const base = defaultSeed();
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const DAY = 86_400_000;

  base.tables.notifications = NOTIFICATION_SUBKINDS.map((s, i) => {
    // Just inside today, just inside yesterday, and a month back.
    const at =
      i < 5 ? midnight + 1000 : i < 10 ? midnight - DAY + 1000 : midnight - 30 * DAY;
    const iso = new Date(at).toISOString();
    return {
      id: `n-${s.key}`,
      recipient_id: ME.id,
      actor_id: THEM.id,
      notification_type: s.kind,
      body: s.kind === "system" ? "A system notice" : `${s.key} body`,
      target_type: null,
      target_id: null,
      content_id: null,
      project_id: null,
      collection_id: null,
      metadata: s.metadata,
      // Alternate read state so the unread treatment has both cases on screen.
      is_read: i % 2 === 1,
      read_at: i % 2 === 1 ? iso : null,
      created_at: iso,
    };
  });

  return base;
}

export function msg(
  thread_id: string,
  sender_id: string,
  body: string,
  sent_at: string,
  extra: Record<string, unknown> = {}
) {
  return {
    id: `m-${Math.random().toString(36).slice(2, 10)}`,
    thread_id,
    sender_id,
    kind: "text",
    body,
    text_content: body,
    message_type: "text",
    image_url: null,
    voice_url: null,
    voice_duration_seconds: null,
    is_liked: null,
    reply_to_message_id: null,
    shared_content_type: null,
    shared_content_id: null,
    shared_content_meta: null,
    edited_at: null,
    sent_at,
    read_at: null,
    delivered_at: sent_at,
    is_unsent: false,
    ...extra,
  };
}

/* ───────────────────────── the handle ───────────────────────── */

export interface StubHandle {
  /**
   * Push a `postgres_changes` INSERT down every channel whose filters match,
   * exactly as the broker would. Resolves once the frame has been written.
   *
   * This is the "arrives in another context" half of acceptance 2: the row is
   * delivered over the same socket the app subscribed on, through the app's own
   * callback, with no polling and no sleep.
   */
  deliver(table: string, record: Record<string, unknown>): Promise<void>;
  /** Resolves when at least one channel has completed a Phoenix join. */
  waitForSubscription(timeoutMs?: number): Promise<void>;
  /** Topics that completed a join, in join order. */
  joinedTopics(): string[];
  /** Rows the app POSTed, by table — proves a send actually wrote. */
  inserted(table: string): any[];
  /** PATCHes the app issued, by table — proves read-state still writes. */
  patched(table: string): any[];
}

interface JoinedBinding {
  id: number;
  event: string;
  schema: string;
  table: string;
  filter?: string;
}

interface OpenSocket {
  ws: WebSocketRoute;
  /** topic -> bindings assigned at join */
  topics: Map<string, JoinedBinding[]>;
}

/* ───────────────────────── install ───────────────────────── */

export async function installSupabaseStub(
  page: Page,
  seed: Seed = defaultSeed()
): Promise<StubHandle> {
  const ref = projectRef();

  /* — 1. a session in localStorage, so ProtectedRoute lets us through —
   *
   * supabase-js reads the session from storage and only calls the network when
   * it has expired, so a well-formed unexpired session is enough for
   * AuthContext's getSession() to resolve logged-in. The token is a structurally
   * valid JWT with a far-future exp; it authenticates nothing, because every
   * request it would be sent on is intercepted below. */
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const jwt = fakeJwt({ sub: ME.id, exp: expiresAt, role: "authenticated" });
  const session = {
    access_token: jwt,
    token_type: "bearer",
    expires_in: 60 * 60 * 24,
    expires_at: expiresAt,
    refresh_token: "tier2-refresh-token",
    user: {
      id: ME.id,
      aud: "authenticated",
      role: "authenticated",
      email: "tier2@example.test",
      email_confirmed_at: new Date(0).toISOString(),
      phone: "",
      confirmed_at: new Date(0).toISOString(),
      last_sign_in_at: new Date(0).toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      identities: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      is_anonymous: false,
    },
  };
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key as string, value as string);
      } catch {
        /* a storage-less context is a test-harness problem, not an app bug */
      }
    },
    [`sb-${ref}-auth-token`, JSON.stringify(session)] as const
  );

  /* — 2. PostgREST — */
  const tables: Record<string, any[]> = JSON.parse(
    JSON.stringify(seed.tables)
  );
  const insertedRows: Record<string, any[]> = {};
  const patchedRows: Record<string, any[]> = {};
  const unknownTables: string[] = [];

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // /rest/v1/<table>  — rpc is handled as its own pseudo-table below.
    const table = url.pathname.replace(/^.*\/rest\/v1\//, "").split("?")[0];
    const method = request.method();

    if (method === "POST") {
      let body: any = [];
      try {
        body = JSON.parse(request.postData() || "[]");
      } catch {
        body = [];
      }
      const rows = Array.isArray(body) ? body : [body];
      (insertedRows[table] ??= []).push(...rows);
      // Give the inserted rows back the way `.select().single()` expects.
      const materialised = rows.map((r) => ({
        id: `srv-${Math.random().toString(36).slice(2, 10)}`,
        sent_at: new Date().toISOString(),
        ...r,
      }));
      (tables[table] ??= []).push(...materialised);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: corsHeaders(),
        body: JSON.stringify(materialised),
      });
    }

    if (method === "PATCH") {
      let body: any = {};
      try {
        body = JSON.parse(request.postData() || "{}");
      } catch {
        body = {};
      }
      (patchedRows[table] ??= []).push({ body, query: url.search });
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders(),
        body: JSON.stringify([body]),
      });
    }

    if (method === "DELETE") {
      return route.fulfill({
        status: 204,
        contentType: "application/json",
        headers: corsHeaders(),
        body: "",
      });
    }

    // GET / HEAD
    const known = Object.prototype.hasOwnProperty.call(tables, table);
    if (!known) {
      // Loud rather than silent: an unstubbed table means the spec would have
      // reached the real project, which is the one thing this file promises
      // cannot happen.
      if (!unknownTables.includes(table)) unknownTables.push(table);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { ...corsHeaders(), "content-range": "0-0/0" },
        body: "[]",
      });
    }

    // PostgREST's `count=exact` is the number of rows MATCHING, before any
    // limit or range is applied — that is the whole point of asking for it. The
    // body is the limited page; the count is not. Computing both from the same
    // limited array made a `limit: 1` count query report a total of 1, which is
    // what the notifications header does to fill its tab counts.
    const matched = filterRows(tables[table], url, { paginate: false });
    const rows = filterRows(tables[table], url, { paginate: true });

    // A `head:true` count query wants the total in Content-Range, not a body.
    const prefer = request.headers()["prefer"] ?? "";
    const wantsCount = prefer.includes("count=");
    const isHead = method === "HEAD";
    const headers: Record<string, string> = { ...corsHeaders() };
    if (wantsCount || isHead) {
      headers["content-range"] = `0-${Math.max(0, rows.length - 1)}/${matched.length}`;
    }

    // `.single()` / `.maybeSingle()` ask for an object via Accept.
    const accept = request.headers()["accept"] ?? "";
    const single = accept.includes("vnd.pgrst.object");

    return route.fulfill({
      status: 200,
      contentType: single
        ? "application/vnd.pgrst.object+json"
        : "application/json",
      headers,
      body: isHead ? "" : JSON.stringify(single ? rows[0] ?? null : rows),
    });
  });

  /* — 3. Phoenix over WebSocket —
   *
   * Wire format both directions is a JSON array:
   *   [join_ref, ref, topic, event, payload]
   * On `phx_join` the client sends config.postgres_changes as an array of
   * filters and expects the same array back, each entry carrying an `id`;
   * RealtimeChannel._updatePostgresBindings compares them field by field and
   * errors the channel on any mismatch, so we echo the filters verbatim. */
  const sockets: OpenSocket[] = [];
  let nextBindingId = 1;
  let resolveFirstJoin: (() => void) | null = null;
  const firstJoin = new Promise<void>((r) => {
    resolveFirstJoin = r;
  });

  await page.routeWebSocket(/\/realtime\/v1\//, (ws) => {
    const open: OpenSocket = { ws, topics: new Map() };
    sockets.push(open);

    ws.onMessage((raw) => {
      let frame: any[];
      try {
        frame = JSON.parse(String(raw));
      } catch {
        return;
      }
      const [joinRef, ref, topic, event, payload] = frame;

      if (event === "phx_join") {
        const requested: any[] = payload?.config?.postgres_changes ?? [];
        const assigned: JoinedBinding[] = requested.map((f) => ({
          ...f,
          id: nextBindingId++,
        }));
        open.topics.set(topic, assigned);
        ws.send(
          JSON.stringify([
            joinRef,
            ref,
            topic,
            "phx_reply",
            {
              status: "ok",
              response: {
                postgres_changes: assigned.map((b) => ({
                  id: b.id,
                  event: b.event,
                  schema: b.schema,
                  table: b.table,
                  ...(b.filter !== undefined ? { filter: b.filter } : {}),
                })),
              },
            },
          ])
        );
        resolveFirstJoin?.();
        resolveFirstJoin = null;
        return;
      }

      if (event === "phx_leave") {
        open.topics.delete(topic);
        ws.send(
          JSON.stringify([
            joinRef,
            ref,
            topic,
            "phx_reply",
            { status: "ok", response: {} },
          ])
        );
        return;
      }

      // heartbeat, access_token and anything else: acknowledge so the client
      // never decides the socket is dead and tears the channels down.
      ws.send(
        JSON.stringify([
          joinRef ?? null,
          ref,
          topic,
          "phx_reply",
          { status: "ok", response: {} },
        ])
      );
    });

    ws.onClose(() => {
      const i = sockets.indexOf(open);
      if (i >= 0) sockets.splice(i, 1);
    });
  });

  return {
    async deliver(table, record) {
      // Keep the stub's own view of the table in step, so a refetch after the
      // realtime arrival returns the row too.
      (tables[table] ??= []).push(record);

      for (const s of sockets) {
        for (const [topic, bindings] of s.topics) {
          const matching = bindings.filter(
            (b) =>
              b.table === table &&
              (b.event === "*" || b.event === "INSERT") &&
              filterMatches(b.filter, record)
          );
          if (matching.length === 0) continue;
          s.ws.send(
            JSON.stringify([
              null,
              null,
              topic,
              "postgres_changes",
              {
                ids: matching.map((b) => b.id),
                data: {
                  schema: "public",
                  table,
                  type: "INSERT",
                  commit_timestamp: new Date().toISOString(),
                  // An empty `columns` is safe: convertChangeData iterates the
                  // record's own keys and passes a value through untouched when
                  // its column is absent.
                  columns: [],
                  record,
                  old_record: null,
                  errors: null,
                },
              },
            ])
          );
        }
      }
    },

    async waitForSubscription(timeoutMs = 15_000) {
      await Promise.race([
        firstJoin,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `no realtime channel joined within ${timeoutMs}ms — the ` +
                    `subscription the app used to open is gone`
                )
              ),
            timeoutMs
          )
        ),
      ]);
    },

    joinedTopics() {
      return sockets.flatMap((s) => Array.from(s.topics.keys()));
    },

    inserted(table) {
      return insertedRows[table] ?? [];
    },

    patched(table) {
      return patchedRows[table] ?? [];
    },
  };
}

/* ───────────────────────── helpers ───────────────────────── */

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "content-range",
  };
}

/**
 * A structurally valid unsigned JWT. It is never verified — every request that
 * would carry it is intercepted — but supabase-js parses the payload to read
 * `exp`, so the shape has to be right.
 */
function fakeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.tier2signature`;
}

/**
 * Honour only the PostgREST operators these pages actually use: eq, in and the
 * ordering/limit pair. Everything else is served unfiltered, which is safe —
 * getThreads does most of its partitioning in JS on the rows it gets back, so
 * over-serving changes nothing the specs assert on.
 */
function filterRows(
  rows: any[],
  url: URL,
  { paginate }: { paginate: boolean } = { paginate: true }
): any[] {
  let out = [...rows];

  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "offset", "or"].includes(key)) continue;
    if (value.startsWith("eq.")) {
      const want = value.slice(3);
      out = out.filter((r) => String(r[key]) === want);
    } else if (value.startsWith("neq.")) {
      const want = value.slice(4);
      out = out.filter((r) => String(r[key]) !== want);
    } else if (value.startsWith("in.")) {
      const list = value
        .slice(3)
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((s) => s.replace(/^"|"$/g, ""));
      out = out.filter((r) => list.includes(String(r[key])));
    } else if (value.startsWith("gt.")) {
      const want = value.slice(3);
      out = out.filter((r) => String(r[key]) > want);
    }
  }

  const order = url.searchParams.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    out.sort((a, b) => {
      const av = a[col] ?? "";
      const bv = b[col] ?? "";
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (dir === "desc" ? -1 : 1);
    });
  }

  if (paginate) {
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = url.searchParams.get("limit");
    out = out.slice(offset, limit ? offset + Number(limit) : undefined);
  }

  return out;
}

/** Matches the `col=eq.value` form realtime filters use. */
function filterMatches(filter: string | undefined, record: Record<string, unknown>): boolean {
  if (!filter) return true;
  const m = filter.match(/^(.+?)=eq\.(.*)$/);
  if (!m) return true;
  return String(record[m[1]]) === m[2];
}

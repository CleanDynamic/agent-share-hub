// UX-15 P6: what "Download your data" holds, and how it is read. Pure TypeScript: no Deno API and no import outside this folder, so the
// function and Vitest read the same file.
//
// IT RUNS AS THE PERSON. `client` carries their own token, so row-level security decides every row; the `.eq()` on each source is a
// second lock (their own rows only), not the first. Nothing here uses the service key. Columns are named, never `*`, and a column that
// holds another person's words or the site's secrets is not listed: no message preview, no unread counts, no payment account.
//
// A source that cannot be read is named in `incomplete` rather than left out silently; a list that reached its cap is named in
// `truncated`. The file says what it does not hold.

export const FORMAT = "openbuilds-data-v1";
/** The most rows read from any one source. */
export const CAP = 5000;

export interface Source {
  key: string;
  table: string;
  columns: string;
  /** The column holding the person's id. */
  by: string;
  /** An extra equality, such as the draft status. */
  also?: [column: string, value: string];
  /** Rows whose status is not this (builds that are not drafts). */
  not?: [column: string, value: string];
}

export const SOURCES: readonly Source[] = [
  { key: "profile", table: "profiles", by: "id", columns: "id, username, display_name, bio, location, website_url, twitter_handle, avatar_url, banner_url, joined_at, is_private, notification_preferences, user_interests, user_ai_tools, level" },
  { key: "builds", table: "builds", by: "creator_id", not: ["status", "draft"], columns: "id, slug, title, outcome, shape, status, made_for, made_with, models_used, making, post_doc, live_url, repo_url, parent_build_id, published_at, created_at, updated_at" },
  { key: "drafts", table: "builds", by: "creator_id", also: ["status", "draft"], columns: "id, slug, title, outcome, shape, status, made_for, made_with, models_used, making, post_doc, created_at, updated_at" },
  { key: "topics_and_replies", table: "openbuild_posts", by: "author_id", columns: "id, parent_id, root_id, body, about_build_id, about_node_id, still_open, tags, created_at, updated_at" },
  { key: "build_likes", table: "build_likes", by: "user_id", columns: "build_id, created_at" },
  { key: "entry_likes", table: "post_likes", by: "user_id", columns: "post_id, created_at" },
  { key: "entry_reactions", table: "post_reactions", by: "user_id", columns: "post_id, kind, value, created_at" },
  { key: "follows", table: "follows", by: "follower_id", columns: "following_id, created_at" },
  { key: "followers", table: "follows", by: "following_id", columns: "follower_id, created_at" },
  { key: "saves", table: "saved_items", by: "user_id", columns: "id, kind, ref, build_id, note, notify, created_at" },
  { key: "build_saves", table: "build_saves", by: "user_id", columns: "build_id, created_at" },
  { key: "collections", table: "collections", by: "owner_id", columns: "id, slug, title, description, is_public, item_count, created_at, updated_at" },
  { key: "comments", table: "build_comments", by: "author_id", columns: "id, build_id, node_id, parent_id, body, created_at, edited_at" },
  { key: "reproductions", table: "build_reproductions", by: "user_id", columns: "build_id, worked, model_used, note, result, confirmed_at" },
  { key: "messages_sent", table: "dm_messages", by: "sender_id", columns: "id, thread_id, message_type, text_content, body, image_url, voice_url, sent_at" },
  { key: "thread_memberships", table: "dm_thread_members", by: "user_id", columns: "thread_id, joined_at" },
  { key: "notifications", table: "notifications", by: "recipient_id", columns: "id, notification_type, actor_id, target_type, target_id, build_id, body, is_read, created_at" },
  { key: "reports_made", table: "content_reports", by: "reporter_id", columns: "id, target_type, target_id, reason, note, status, created_at" },
];

/** The columns that must never appear in the file, whatever a source lists. The Vitest checks every source against this. */
export const NEVER = ["stripe_account_id", "last_message_preview", "unread_count_a", "unread_count_b", "is_admin", "embedding", "subscription_price_id"] as const;

/** The slice of the Supabase client this file uses, so a test can stand one in. */
export interface ReadClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): Filtered;
    };
  };
  storage?: { from(bucket: string): { createSignedUrls(paths: string[], seconds: number): Promise<{ data: { path: string | null; signedUrl: string }[] | null; error: unknown }> } };
}
interface Filtered {
  eq(column: string, value: string): Filtered;
  neq(column: string, value: string): Filtered;
  limit(n: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
}

export interface ExportFile {
  format: typeof FORMAT;
  exportedAt: string;
  userId: string;
  /** Every source's rows by key. */
  data: Record<string, unknown[]>;
  /** Pictures and files of the person's builds, with a link that works for a day. */
  media: { id: string; build_id: string; bucket: string; path: string; mime: string | null; bytes: number | null; caption: string | null; url: string | null }[];
  /** Steps of the person's builds. */
  steps: unknown[];
  /** Sources that could not be read; the file is not whole without them. */
  incomplete: string[];
  /** Sources that reached the cap. */
  truncated: string[];
}

async function read(client: ReadClient, source: Source, userId: string): Promise<unknown[]> {
  let query = client.from(source.table).select(source.columns).eq(source.by, userId);
  if (source.also) query = query.eq(source.also[0], source.also[1]);
  if (source.not) query = query.neq(source.not[0], source.not[1]);
  const { data, error } = await query.limit(CAP);
  if (error) throw error;
  return data ?? [];
}

export async function buildExport(client: ReadClient, userId: string, now: Date): Promise<ExportFile> {
  const file: ExportFile = { format: FORMAT, exportedAt: now.toISOString(), userId, data: {}, media: [], steps: [], incomplete: [], truncated: [] };

  const results = await Promise.allSettled(SOURCES.map((source) => read(client, source, userId)));
  results.forEach((result, index) => {
    const key = SOURCES[index].key;
    if (result.status === "fulfilled") {
      file.data[key] = result.value;
      if (result.value.length >= CAP) file.truncated.push(key);
    } else {
      file.data[key] = [];
      file.incomplete.push(key);
    }
  });

  // Steps and media hang off the person's builds and drafts: read by build id, still as the person.
  const buildIds = [...(file.data.builds ?? []), ...(file.data.drafts ?? [])].map((row) => (row as { id: string }).id);
  if (buildIds.length > 0) {
    const list = buildIds.slice(0, 1000);
    for (const [key, table, columns, column] of [
      ["steps", "build_nodes", "id, build_id, type, title, position, note, payload, is_gap, created_at, updated_at", "build_id"],
      ["media", "build_media", "id, build_id, bucket, path, mime, bytes, caption, created_at", "build_id"],
    ] as const) {
      try {
        const rows: unknown[] = [];
        for (const id of list) {
          if (rows.length >= CAP) break;
          rows.push(...(await read(client, { key, table, columns, by: column }, id)));
        }
        if (key === "steps") file.steps = rows;
        else file.media = (rows as ExportFile["media"]).map((row) => ({ ...row, url: null }));
        if (rows.length >= CAP) file.truncated.push(key);
      } catch {
        file.incomplete.push(key);
      }
    }
    await signMedia(client, file);
  }
  return file;
}

async function signMedia(client: ReadClient, file: ExportFile): Promise<void> {
  if (!client.storage || file.media.length === 0) return;
  const byBucket = new Map<string, ExportFile["media"]>();
  for (const row of file.media) byBucket.set(row.bucket, [...(byBucket.get(row.bucket) ?? []), row]);
  for (const [bucket, rows] of byBucket) {
    try {
      const { data } = await client.storage.from(bucket).createSignedUrls(rows.map((row) => row.path), 24 * 3600);
      const urlOf = new Map((data ?? []).map((item) => [item.path, item.signedUrl]));
      for (const row of rows) row.url = urlOf.get(row.path) ?? null;
    } catch {
      /* the path stays; the link does not */
    }
  }
}

/** Minutes to wait, rounded up, in the sentence the page shows. */
export function waitSentence(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `You can download again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}

/** `openbuilds-data-<username>-<date>.json`, the username made safe for a file name. */
export function fileName(username: string | null | undefined, now: Date): string {
  const who = (username ?? "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "account";
  return `openbuilds-data-${who}-${now.toISOString().slice(0, 10)}.json`;
}

// UX-15 P4: the notification switches, as the database reads them.
//
// PURE. `profiles.notification_preferences` is a jsonb object with one key per kind of notification (20261111120000_ux15_settings_blocking.sql
// holds the same map in `notification_pref_key`, and a test holds the two together). A MISSING KEY COUNTS AS ON: only a stored `false`
// turns a kind off, so a profile made before a kind existed hears of it until its owner says otherwise.

export const PREFERENCE_KEYS = [
  "build_rebuilt",
  "build_reproduced",
  "build_comment",
  "build_like",
  "post_reply",
  "post_mention",
  "post_like",
  "post_pinned",
  "post_started",
  "new_follower",
  "followed_publishes",
  "saved_changed",
] as const;
export type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

export type NotificationPreferences = Record<PreferenceKey, boolean>;

export interface PreferenceRow {
  key: PreferenceKey;
  /** Worded from the person's side. */
  label: string;
}
export interface PreferenceGroup {
  title: string;
  rows: readonly PreferenceRow[];
}

export const PREFERENCE_GROUPS: readonly PreferenceGroup[] = [
  {
    title: "Your builds",
    rows: [
      { key: "build_rebuilt", label: "Someone rebuilds one of your builds" },
      { key: "build_reproduced", label: "Someone reproduces one of your builds" },
      { key: "build_comment", label: "Someone comments on one of your builds" },
      { key: "build_like", label: "Someone likes one of your builds" },
    ],
  },
  {
    title: "Topics and replies",
    rows: [
      { key: "post_reply", label: "Someone replies to your topic or reply" },
      { key: "post_mention", label: "Someone mentions you" },
      { key: "post_like", label: "Someone likes your topic or reply" },
      { key: "post_pinned", label: "Your entry is pinned" },
      { key: "post_started", label: "Someone starts a topic from your build" },
    ],
  },
  {
    title: "People",
    rows: [
      { key: "new_follower", label: "Someone follows you" },
      { key: "followed_publishes", label: "Someone you follow publishes a build" },
    ],
  },
  {
    title: "Saved things",
    rows: [{ key: "saved_changed", label: "Something you saved changes" }],
  },
];

/** Which switch governs each kind the database writes. The same table as `notification_pref_key` in SQL. */
export const KIND_TO_KEY: Readonly<Record<string, PreferenceKey>> = {
  rebuilt: "build_rebuilt",
  reproduced: "build_reproduced",
  comment: "build_comment",
  reply: "build_comment",
  like: "build_like",
  follow: "new_follower",
  published: "followed_publishes",
  post_reply: "post_reply",
  post_thread: "post_reply",
  post_mention: "post_mention",
  post_like: "post_like",
  post_pinned: "post_pinned",
  post_started: "post_started",
};

/** Kinds the database no longer writes (UX-08 and UX-11). They get no switch, and their old rows still read. */
export const RETIRED_KINDS = ["solution", "solved"] as const;

const isKey = (value: string): value is PreferenceKey => (PREFERENCE_KEYS as readonly string[]).includes(value);

/** Every switch's state from what the profile holds. Anything but a stored `false` is on. */
export function parsePreferences(raw: unknown): NotificationPreferences {
  const stored = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as NotificationPreferences;
  for (const key of PREFERENCE_KEYS) out[key] = stored[key] !== false;
  return out;
}

/** A key the database accepts from the browser, or null. */
export function preferenceKeyOf(value: string): PreferenceKey | null {
  return isKey(value) ? value : null;
}

/* SV-10: the Home vision board's sample data, as `HomeView` takes it.

   Copied from `design/reference/vision/dusk/home.html` (the board's source, `Main.dc.html`, draws its sample inline).
   DEV ONLY (the dev page `vision-home` and the view's tests). Times are offsets from a fixed `now`, so the page reads the
   same on any day. The first post's two pictures are the board's drawings, in `public/dev/sv10`, served as they are. */

import type { DesignState } from "@/dev/useDesignTheme";
import type { GalleryBuild, GalleryMedia } from "@/lib/build/gallery";
import type { ThreadBlock, ThreadDoc, ThreadPostMedia } from "@/lib/build/thread";
import type { Classification } from "@/lib/classify/types";
import type { HomeViewProps } from "@/pages/site/home/HomeView";
import type { HomeFeedItem, HomePerson } from "@/pages/site/home/homeModel";

/** Thursday 15 Oct 2026, midday (UTC): the board's today is the fourth day of the week. */
export const VISION_HOME_NOW = Date.parse("2026-10-15T12:00:00.000Z");

const minutes = (n: number) => new Date(VISION_HOME_NOW - n * 60_000).toISOString();
const hours = (n: number) => minutes(n * 60);
const days = (n: number) => hours(n * 24);

const person = (id: string, handle: string, name: string, hue: number): HomePerson => ({ id, handle, name, hue, avatarUrl: null });
const MAYA = person("u-maya", "maya", "Maya Kent", 0);
const DAX = person("u-dax", "dax", "Dax", 2);
const MIRA = person("u-mira", "mira", "Mira", 4);
const SUNTZU = person("u-suntzu", "suntzu", "suntzu", 1);

const build = (id: string, title: string, over: Partial<GalleryBuild> = {}): GalleryBuild => ({
  id,
  creator_id: `u-${id}`,
  slug: id,
  title,
  outcome: null,
  shape: "workflow",
  status: "gallery",
  made_for: [],
  made_with: [],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  completeness: null,
  reproduction_count: 0,
  last_confirmed_at: null,
  last_confirmed_model: null,
  published_at: days(1),
  parent_build_id: null,
  rebuild_count: 0,
  rebuild_note: null,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  nodes: [],
  media: [],
  ...over,
});

/* ── post 1: the board's thread of four ── */

const picture = (id: string, file: string): GalleryMedia => ({
  id,
  node_id: null,
  bucket: "build-media",
  path: `dev/sv10/${file}`,
  kind: "image",
  width: 266,
  height: 240,
  poster_path: null,
  duration: null,
  post_position: null,
  post_text: null,
});
const NOTES = picture("sv10-notes", "notes.svg");
const BARS = picture("sv10-bars", "bars.svg");

const pic = (media: GalleryMedia): ThreadPostMedia => ({
  type: "postMedia",
  attrs: { mediaId: media.id, width: 100, w: media.width, h: media.height, alt: "", crop: null, aspect: null, zoom: null, warn: [], caption: "" },
});
const para = (value: string): ThreadBlock => ({ type: "paragraph", content: [{ type: "text", text: value }] });
const brk: ThreadBlock = { type: "postBreak" };

const CALL_NOTES_DOC: ThreadDoc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Call notes that write themselves" }] },
    para(
      "Every sales call now ends with a summary in Notion before I've closed Zoom. The trick was splitting the transcript clean-up into its own agent and keeping the summary on one prompt.",
    ),
    { type: "postMediaGrid", attrs: { step: null }, content: [pic(NOTES), pic(BARS)] },
    brk,
    para("Session 1 pulls the transcript from Zoom and hands it on."),
    brk,
    para("Session 2 cleans it up: speakers, filler, timestamps."),
    brk,
    para("The summary prompt writes the page in Notion."),
  ],
};

/* The board's two lines, "Claude + Notion · Built solo · Automation" and "Sales · Summarise calls", as the maker's own words. */
const own = (value: string) => `custom:${value}`;
const CALL_NOTES_CLASSIFICATION: Classification = {
  version: 1,
  declared: { field: [{ custom: "Sales" }], task: [{ custom: "Summarise calls", primary: true }], setting: [], data: [], age: null, stack: [{ custom: "Claude" }, { custom: "Notion" }] },
  derived: { built: { values: [own("Built solo")], from: [] }, role: { values: [own("Automation")], from: [] } },
  disputes: {},
  questions_dismissed: [],
};

const callNotes = build("call-notes", "Call notes that write themselves", {
  creator_id: MAYA.id,
  made_with: ["claude", "notion"],
  reproduction_count: 6,
  last_confirmed_at: days(4),
  last_confirmed_model: "opus-5.5",
  published_at: hours(1),
  post_doc: CALL_NOTES_DOC,
  media: [NOTES, BARS],
});

const localModel = build("call-notes-local", "Call notes, local model", {
  creator_id: DAX.id,
  parent_build_id: "call-notes",
  source_title_at_fork: "Call notes that write themselves",
  source_handle_at_fork: "maya",
  published_at: hours(3),
});

const gbngd = build("gbngd", "gbngd", { creator_id: SUNTZU.id, made_with: ["claude-code"], published_at: days(1) });

export const visionHomeItems: HomeFeedItem[] = [
  {
    kind: "build",
    key: "build:call-notes",
    at: hours(1),
    build: callNotes,
    maker: MAYA,
    modelsUsed: [],
    plaque: callNotes,
    classification: CALL_NOTES_CLASSIFICATION,
    engagement: { counts: { likes: 24, comments: 5 }, liked: false, saved: false },
  },
  {
    kind: "rebuild",
    key: "rebuild:call-notes-local",
    at: hours(3),
    maker: DAX,
    note: "Same pipeline, but Session 2 runs on a local model. Slower on long calls, free on everything else.",
    source: { title: "Call notes that write themselves", handle: "maya" },
    build: localModel,
    plaque: localModel,
    engagement: { counts: { likes: 8, comments: 0 }, liked: false, saved: false },
  },
  {
    kind: "build",
    key: "build:gbngd",
    at: days(1),
    build: gbngd,
    maker: SUNTZU,
    modelsUsed: [],
    plaque: gbngd,
    classification: null,
    engagement: { counts: { likes: 0, comments: 0 }, liked: false, saved: false },
  },
];

const SRC: ReadonlyMap<string, string> = new Map([
  [NOTES.path, `/${NOTES.path}`],
  [BARS.path, `/${BARS.path}`],
]);

/** The view's props for a state; `?state=` on the dev page picks one. */
export function visionHomeProps(state: DesignState = "populated"): HomeViewProps {
  const base: HomeViewProps = {
    now: VISION_HOME_NOW,
    since: {
      rows: [
        { key: "s1", title: "@dax rebuilt Call notes", detail: "\"Session 2 on a local model\"", at: hours(3), href: "/b2/call-notes-local" },
        { key: "s2", title: "@kit rebuilt Inbox triage", detail: "\"Labels from a sheet\"", at: hours(30), href: "/b2/inbox-triage-labels" },
      ],
    },
    drafts: {
      status: "ready",
      data: {
        total: 36,
        rows: [
          { id: "vd1", title: "Invoice chaser", untitled: false, meta: "4 sessions · edited 1h ago" },
          { id: "vd2", title: "Untitled build", untitled: true, meta: "2 sessions · edited 2h ago" },
          { id: "vd3", title: "dddd", untitled: false, meta: "1 session · edited 3d ago" },
        ],
      },
    },
    sessions: {
      status: "ready",
      data: {
        total: 8,
        rows: [
          { id: "vs1", title: "This session is being continued from a previous conversation", meta: "10 Oct · In 3 drafts" },
          { id: "vs2", title: "This is my site https://agent-share-hub.lovable.app", meta: "8 Oct · In 4 drafts" },
        ],
      },
    },
    onAddSession: () => undefined,
    week: {
      status: "ready",
      data: {
        days: ["active", "active", "active", "none", "none", "none", "none"],
        today: 3,
        streak: 3,
        challenges: [
          { slug: "solve-a-gap", title: "Solve a gap", done: 0, target: 1 },
        ],
      },
    },
    scope: "everyone",
    onScopeChange: () => undefined,
    filter: "all",
    onFilterChange: () => undefined,
    feed: { status: "ready", items: visionHomeItems, hasMore: false, loadingMore: false, onMore: () => undefined, onRetry: () => undefined },
    newCount: 3,
    onShowNew: () => undefined,
    srcByPath: SRC,
    endCards: [
      { id: "inbox-triage", title: "Inbox triage in one prompt", href: "/b2/inbox-triage", facts: "Web app · Made with AI · No coding" },
      { id: "untitled", title: "Untitled build", href: "/b2/untitled", facts: "" },
    ],
    requests: {
      status: "ready",
      data: [
        { id: "b1", title: "Handle paywalled sources", detail: "Research brief · 5 days left", reward: "£40", href: "/openbuilds/topics/b1" },
        { id: "b2", title: "Speaker names from audio", detail: "Call notes · 9 days left", reward: "£35", href: "/openbuilds/topics/b2" },
        { id: "b3", title: "Export to Keynote", detail: "Pitch deck · 2 weeks left", reward: "£25", href: "/openbuilds/topics/b3" },
      ],
    },
    published: {
      status: "ready",
      data: {
        total: 2,
        rows: [
          { id: "pb1", title: "Call notes that write themselves", slug: "call-notes", href: "/b2/call-notes", published: "12 Oct" },
          { id: "pb2", title: "Inbox triage in one prompt", slug: "inbox-triage", href: "/b2/inbox-triage", published: "3 Oct" },
        ],
      },
    },
    onCopyLink: () => undefined,
  };
  const failure = { onRetry: () => undefined };
  if (state === "loading") {
    return { ...base, feed: { ...base.feed, status: "loading", items: [] }, newCount: 0, drafts: { status: "loading" }, sessions: { status: "loading" }, week: { status: "loading" }, requests: { status: "loading" }, published: { status: "loading" } };
  }
  if (state === "error") {
    return { ...base, feed: { ...base.feed, status: "error", items: [] }, newCount: 0, drafts: { status: "error", ...failure }, sessions: { status: "error", ...failure }, week: { status: "error", ...failure }, requests: { status: "error", ...failure }, published: { status: "error", ...failure } };
  }
  if (state === "empty") {
    return { ...base, since: null, feed: { ...base.feed, items: [] }, newCount: 0, endCards: [], drafts: { status: "ready", data: { total: 0, rows: [] } }, sessions: { status: "ready", data: { total: 0, rows: [] } }, requests: { status: "ready", data: [] }, published: { status: "ready", data: { total: 0, rows: [] } } };
  }
  return base;
}

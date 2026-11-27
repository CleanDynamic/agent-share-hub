/* Synth 07: Home, three panels with the X feed rhythm: the maker's own work on the left (each section headed by its fact),
   the feed in the centre (Following / Everyone tabs, the kind pills, the posts 8 apart) and what is open in the reader's
   spaces on the right. The page's h1 is there for screen readers only.

   PURE: typed props, no fetching, no `useAuth()`, no router hooks but links. `HomePage` loads and maps; the dev page
   `vision-home` renders the same props from sample data.

   THE FEED. A build is `FeedPost` as it is, a rebuild and a topic are drawn here from the feed row. A run note is not drawn.
   An item off screen is `content-visibility: auto` with an intrinsic size near its real height. A build post tells the page
   when it comes within a screen of view (`onPostsNear`), so its post is read before it is seen.

   NOTHING MOVES. Tabs and the kind pills change at once; the "n new" pill appears in place and choosing it adds the new
   items at the top at once. */

import { PriorityImageScope } from "@/components/post/media/priorityImage";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Plus } from "lucide-react";

import { Avatar } from "@/components/brand/Avatar";
import { PageEmpty, PageFailed, PageState, type PanelFailure } from "@/components/pagestate/PageState";
import { readOf, type ReadLike } from "@/components/pagestate/pageStateModel";
import { Button } from "@/components/brand/Button";
import { FilterChip } from "@/components/brand/FilterChip";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { LampBar } from "@/components/brand/LampDot";
import { FeedPost } from "@/components/gallery/FeedPost";
import { X_FEED, xGrid } from "@/components/gallery/xFeed";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PostCard } from "@/components/post/PostCard";
import { ReplyAnatomy } from "@/pages/site/openbuilds/PostReplies";
import { SectionHead } from "@/components/vision/SectionHead";
import { TextTabs } from "@/components/vision/TextTabs";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring, touchArea } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { PhoneHome } from "./PhoneHome";
import { RebuildPost } from "./RebuildPost";
import { useNear } from "./useNear";
import { FeedBones, HomeColumns, HomeControl, HomeLoadingView, Rule, SectionBones, ellipsis, text, useHomeLayout } from "./HomeFrame";
import {
  HOME_FILTERS,
  atHandle,
  matchesFilter,
  shortAgo,
  sinceHeading,
  weekHeading,
  weekSummary,
  type HomeBuildPost,
  type HomeDraftRow,
  type HomeEndCard,
  type HomeFeedItem,
  type HomePerson,
  type HomeFilter,
  type HomeRebuildPost,
  type HomeReproNote,
  type HomeRequestRow,
  type HomeSessionRow,
  type HomeSinceRow,
  type HomeWeek,
  type HomePublished,
  STILL_OPEN_HREF,
  STILL_OPEN_PHRASE,
  type StillOpenScope,
} from "./homeModel";
import type { HomeReplyGroup, HomeTopicPost } from "./homeTopics";
import { signInSentence, EMPTY } from "@/lib/copy/copy";

export type HomeScope = "following" | "everyone";

/** What a section that loads on its own shows. `signed-out` is a state, not an error. */
export type Loadable<T> =
  | { status: "signed-out" }
  | { status: "loading" }
  | ({ status: "error"; retrying?: boolean } & PanelFailure)
  | { status: "ready"; data: T };

export interface HomeFeedProps {
  status: "loading" | "error" | "ready";
  /** What is shown: the items held back as new are not here. */
  items: readonly HomeFeedItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
  /** The real error behind `status: "error"`; logged once by the panel, never shown. */
  error?: unknown;
  /** G5: the retry is out. */
  retrying?: boolean;
}

/** UX-07 P1: a topic's Like, Reply and Save on Home. */
export interface HomeTopicActions {
  onLike: (postId: string, on: boolean) => void;
  onReply: (postId: string) => void;
  /** Part 4. Absent: Save is not offered. */
  save?: { isSaved: (postId: string) => boolean; onSave: (postId: string, on: boolean) => void };
  /** The open reply box and the topic it answers. */
  box: { at: string; node: ReactNode } | null;
}

export interface HomeViewProps {
  /** The clock the ages read. The dev page freezes it. */
  now: number;

  /* Your studio */
  /** Rebuilds of the reader's builds since the last visit. Null: not drawn. */
  since: { rows: readonly HomeSinceRow[] } | null;
  drafts: Loadable<{ rows: readonly HomeDraftRow[]; total: number }>;
  sessions: Loadable<{ rows: readonly HomeSessionRow[]; total: number }>;
  onAddSession: (sessionId: string) => void;
  week: Loadable<HomeWeek>;

  /* the feed */
  scope: HomeScope;
  onScopeChange: (scope: HomeScope) => void;
  filter: HomeFilter;
  onFilterChange: (filter: HomeFilter) => void;
  feed: HomeFeedProps;
  /** Items newer than the last visit, held back until the pill is chosen. */
  newCount: number;
  /** Prompt 20: up to three authors of those items, for the phone's floating pill. */
  newAuthors?: readonly HomePerson[];
  onShowNew: () => void;
  /** Prompt 29a: the phone's pull to refresh: refetch the feed and its count of new posts, and resolve with how many arrived. */
  onRefresh?: () => Promise<number>;
  /** Signed once for the page: the posts' pictures. */
  srcByPath: MediaSrcMap;
  /** Build ids whose post came within a screen of view. */
  onPostsNear?: (buildIds: string[]) => void;
  /** UX-07 P1: what a topic's row does, and the one reply box (under the topic it answers). Absent: topics carry no row. */
  topics?: HomeTopicActions;
  /** Two builds from Builds, under "You're up to date". */
  endCards: readonly HomeEndCard[];

  /* The right panel */
  /** UX-08 P3: what is still open. */
  requests: Loadable<readonly HomeRequestRow[]>;
  /** UX-08 P3: whose topics `requests` holds: the reader's spaces (the default), or all of OpenBuilds when signed out. */
  stillOpenScope?: StillOpenScope;
  /** The maker's published builds: the studio's third section, and the right panel's when it has nothing else and the studio is not drawn. Absent: none. */
  published?: Loadable<HomePublished>;
  /** Copy link on the newest published build. */
  onCopyLink?: (slug: string) => void;
  /** G9: every region of the page failed, these being its reads. The page shows one failed state in place of its columns' content. */
  pageFailed?: readonly ReadLike[];
}

const DRAFTS = "/drafts";
const BUILDS = "/builds";
const SIGN_IN = "/login?redirect=/";

/** The two lines of a row: the name at 15/600, the fact under it at 13 in Text 3. */
const rowTitle = (extra: CSSProperties = {}): CSSProperties => text(15, 500, t.text, { fontWeight: 600, ...extra });
const rowMeta = (extra: CSSProperties = {}): CSSProperties => text(13, 400, t.label, { lineHeight: "18px", ...extra });

/** A row of a side panel that goes somewhere: 16 at the sides, a Card fill under a fine pointer. */
function RowLink({ to, children, ...rest }: { to: string; children: ReactNode; "data-testid"?: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      {...rest}
      {...handlers}
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 56,
        padding: "8px 16px",
        color: t.text,
        textDecoration: "none",
        background: state.hovered ? t.module : "transparent",
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </Link>
  );
}

/** A link in the page's plain style: `--text`, `--text2` on a fine pointer's hover, ringed on focus. */
function PlainLink({ to, style, children, ...rest }: { to: string; style?: CSSProperties; children: ReactNode; "aria-label"?: string; "data-testid"?: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} {...rest} {...handlers} style={{ color: state.hovered ? t.text2 : t.text, textDecoration: "none", borderRadius: r.chip, ...ring(state.focusVisible), ...style }}>
      {children}
    </Link>
  );
}

/** The page's name, for screen readers only. */
function HomeTitle() {
  return (
    <h1 className="sr-only" style={{ margin: 0 }}>
      Home
    </h1>
  );
}

/* ═════════ your studio ═════════ */

export function SinceSection({ rows, now }: { rows: readonly HomeSinceRow[]; now: number }) {
  return (
    <section aria-label="Since you were last here">
      <SectionHead title={sinceHeading(rows.length)} headingLevel={2} />
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((row) => (
          <li key={row.key}>
            {row.href ? (
              <RowLink to={row.href} data-testid="home-since-row">
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", ...rowTitle(), ...ellipsis }}>{row.title}</span>
                  <span style={{ display: "block", ...rowMeta(), ...ellipsis }}>{row.detail}</span>
                </span>
                <span style={rowMeta({ whiteSpace: "nowrap" })}>{shortAgo(row.at, now)}</span>
              </RowLink>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, minHeight: 56, padding: "8px 16px", boxSizing: "border-box", alignItems: "center" }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", ...rowTitle(), ...ellipsis }}>{row.title}</span>
                  <span style={{ display: "block", ...rowMeta(), ...ellipsis }}>{row.detail}</span>
                </span>
                <span style={rowMeta({ whiteSpace: "nowrap" })}>{shortAgo(row.at, now)}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** G4: a section's Loadable as PageState reads it. A signed-out section is drawn by its own branch, never handed here. */
function readOfLoadable<T>(value: Loadable<T>): ReadLike {
  if (value.status === "ready") return readOf("ready", value.data);
  if (value.status === "error") return { data: undefined, error: value.error ?? { message: "section read failed" }, status: "error", fetchStatus: value.retrying ? "fetching" : "idle", refetch: value.onRetry };
  return readOf("loading");
}

/** A section: its label, its heading and what it holds. */
const sectionFrame = (label: string, head: ReactNode) => (body: ReactNode) => (
  <section aria-label={label}>
    {head}
    {body}
  </section>
);

/** A section's words when it has none, or could not be read: held in the 16 the rows keep. */
const SECTION_NOTE: CSSProperties = { padding: "0 16px" };

export function ContinueSection({ drafts }: { drafts: HomeViewProps["drafts"] }) {
  const title = drafts.status === "ready" ? `${drafts.data.total} ${drafts.data.total === 1 ? "draft" : "drafts"}` : "Continue editing";
  return (
    <PageState
      read={readOfLoadable(drafts)}
      thing="your drafts"
      region="Continue editing"
      skeleton={<SectionBones rows={3} height={56} what="your drafts" />}
      frame={sectionFrame("Continue editing", <SectionHead title={title} to={DRAFTS} openName="drafts" headingLevel={2} />)}
      style={SECTION_NOTE}
      empty={{ when: () => drafts.status === "ready" && drafts.data.rows.length === 0, line: "No drafts in progress." }}
    >
      {() =>
        drafts.status === "ready" &&
        drafts.data.rows.map((row) => (
          <RowLink key={row.id} to={`/compose/${row.id}`} data-testid="home-draft-row">
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", ...rowTitle({ color: row.untitled ? t.text2 : t.text }), ...ellipsis }}>{row.title}</span>
              <span style={{ display: "block", ...rowMeta(), ...ellipsis }}>{row.meta}</span>
            </span>
          </RowLink>
        ))
      }
    </PageState>
  );
}

export function SessionsSection({ sessions, onAdd }: { sessions: HomeViewProps["sessions"]; onAdd: (id: string) => void }) {
  const title = sessions.status === "ready" ? `${sessions.data.total} ${sessions.data.total === 1 ? "session" : "sessions"}` : "Your sessions";
  return (
    <PageState
      read={readOfLoadable(sessions)}
      thing="your sessions"
      region="Your sessions"
      skeleton={<SectionBones rows={2} height={56} what="your sessions" />}
      frame={sectionFrame("Your sessions", <SectionHead title={title} to={DRAFTS} openName="sessions" headingLevel={2} />)}
      style={SECTION_NOTE}
      empty={{ when: () => sessions.status === "ready" && sessions.data.rows.length === 0, line: EMPTY.sessions }}
    >
      {() =>
        sessions.status === "ready" &&
        sessions.data.rows.map((row) => (
          <div
            key={row.id}
            data-testid="home-session-row"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 56, padding: "8px 16px", boxSizing: "border-box" }}
          >
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", ...text(15, 400, t.text), ...ellipsis }}>{row.title}</span>
              <span style={{ display: "block", ...rowMeta(), ...ellipsis }}>{row.meta}</span>
            </span>
            <IconButton icon={Plus} drawn={<Glyph name="plus" size={14} />} label="Add to a new build" size={32} onClick={() => onAdd(row.id)} />
          </div>
        ))
      }
    </PageState>
  );
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

function dayBar(state: HomeWeek["days"][number], today: boolean): CSSProperties {
  const base: CSSProperties = { display: "block", width: "100%", height: 6, borderRadius: 3, boxSizing: "border-box" };
  if (state === "active") return { ...base, background: t.text };
  if (state === "frozen") return { ...base, background: t.text2 };
  if (today) return { ...base, background: t.well, border: `1px dashed ${t.line}` };
  return { ...base, background: t.control };
}

function ChallengeBar({ done, target, title }: { done: number; target: number; title: string }) {
  const share = Math.max(0, Math.min(1, done / Math.max(1, target)));
  return (
    <span
      role="progressbar"
      aria-label={title}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(done, target)}
      aria-valuetext={`${done} of ${target}`}
      style={{ display: "block", marginTop: 8, height: 4, borderRadius: 2, background: t.control }}
    >
      {share > 0 ? <span style={{ display: "block", width: `${Math.round(share * 100)}%`, height: 4, borderRadius: 2, background: done >= target ? t.text : t.evidence }} /> : null}
    </span>
  );
}

/** UX-03 P6: the week has progress to show: a streak, a day done, or a challenge started. */
const weekHasProgress = (week: HomeWeek): boolean => week.streak > 0 || week.days.some((day) => day !== "none") || week.challenges.some((row) => row.done > 0);

export function WeekSection({ week }: { week: HomeViewProps["week"] }) {
  if (week.status === "signed-out") return null;
  const title = week.status === "ready" ? weekHeading(week.data) : "Your week";
  return (
    <PageState
      read={readOfLoadable(week)}
      thing="your week"
      region="Your week"
      skeleton={<SectionBones rows={2} height={40} what="your week" />}
      frame={sectionFrame("Your week", <SectionHead title={title} headingLevel={2} />)}
      style={SECTION_NOTE}
    >
      {() =>
        week.status === "ready" && (
          <div style={{ padding: "0 16px" }}>
            <div role="img" aria-label={weekSummary(week.data.days)} data-testid="home-week-days" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginBottom: week.data.challenges.length > 0 ? 16 : 0 }}>
              {week.data.days.map((state, index) => {
                const today = index === week.data.today;
                return (
                  <div key={index} aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span style={dayBar(state, today)} />
                    <span style={text(13, today ? 500 : 400, today ? t.text : t.label, { lineHeight: "18px" })}>{DAY_LETTERS[index]}</span>
                  </div>
                );
              })}
            </div>
            {week.data.challenges.map((row, index) => (
              <div key={row.slug} data-testid="weekly-challenge" style={{ padding: index === week.data.challenges.length - 1 ? "8px 0 0" : "8px 0" }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8, ...text(15, 500, t.text) }}>
                  <span>{row.title}</span>
                  <span style={{ color: t.label, fontWeight: 400, whiteSpace: "nowrap" }}>{`${row.done} / ${row.target}`}</span>
                </span>
                <ChallengeBar done={row.done} target={row.target} title={row.title} />
              </div>
            ))}
          </div>
        )
      }
    </PageState>
  );
}

function StudioSignedOut() {
  return (
    <section aria-label="Your studio" style={{ padding: "0 16px" }}>
      <PageEmpty line={signInSentence("drafts")} />
      <div style={{ marginTop: 12 }}>
        <Button variant="primary" size={32} href={SIGN_IN} data-visual-slot="btn-primary">
          Sign in
        </Button>
      </div>
    </section>
  );
}

/**
 * The maker's published builds: how many, the newest five with their dates and, under them, the newest one's link to copy.
 * The studio's third section; the right panel draws it when it has nothing else and the studio is not on the page.
 */
export function PublishedSection({ published, onCopyLink }: { published: HomePublished; onCopyLink?: (slug: string) => void }) {
  const newest = published.rows[0];
  const title = `${published.total} published ${published.total === 1 ? "build" : "builds"}`;
  return (
    <section aria-label="Your published builds">
      <SectionHead title={title} headingLevel={2} />
      {published.rows.map((row) => (
        <RowLink key={row.id} to={row.href} data-testid="home-published-row">
          <span style={{ minWidth: 0, ...rowTitle(), ...ellipsis }}>{row.title}</span>
          <span style={rowMeta({ whiteSpace: "nowrap" })}>{row.published}</span>
        </RowLink>
      ))}
      {newest && onCopyLink ? (
        <div style={{ padding: "8px 16px 0" }}>
          <HomeControl onClick={() => onCopyLink(newest.slug)}>
            <Glyph name="link" size={16} />
            Copy link
          </HomeControl>
        </div>
      ) : null}
    </section>
  );
}

const publishedHas = (published: HomeViewProps["published"]): published is { status: "ready"; data: HomePublished } => published?.status === "ready" && published.data.total > 0;

function Studio(props: HomeViewProps) {
  if (props.drafts.status === "signed-out") return <StudioSignedOut />;
  const parts: ReactNode[] = [];
  if (props.since) parts.push(<SinceSection key="since" rows={props.since.rows} now={props.now} />);
  parts.push(<ContinueSection key="drafts" drafts={props.drafts} />);
  parts.push(<SessionsSection key="sessions" sessions={props.sessions} onAdd={props.onAddSession} />);
  // UX-03 P6: a week with nothing done yet is not drawn.
  if (props.week.status !== "ready" || weekHasProgress(props.week.data)) parts.push(<WeekSection key="week" week={props.week} />);
  if (publishedHas(props.published)) parts.push(<PublishedSection key="published" published={props.published.data} onCopyLink={props.onCopyLink} />);
  return <>{parts.flatMap((part, index) => (index === 0 ? [part] : [<Rule key={`rule-${index}`} />, part]))}</>;
}

/** Two columns and one: the Card line that stands for the studio, "36 drafts in progress · 4 sessions", with a chevron to Drafts. */
function DraftsLine({ drafts, sessions }: Pick<HomeViewProps, "drafts" | "sessions">) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  if (drafts.status !== "ready") return null;
  const parts = [`${drafts.data.total} ${drafts.data.total === 1 ? "draft" : "drafts"} in progress`];
  if (sessions.status === "ready") parts.push(`${sessions.data.total} ${sessions.data.total === 1 ? "session" : "sessions"}`);
  return (
    <Link
      to={DRAFTS}
      data-testid="home-drafts-line"
      {...handlers}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 44,
        padding: "0 16px",
        boxSizing: "border-box",
        background: state.hovered ? t.control : t.module,
        borderRadius: r.card,
        color: t.text,
        textDecoration: "none",
        ...text(15, 500, t.text),
        ...ring(state.focusVisible),
      }}
    >
      <span>{parts.join(" · ")}</span>
      <Glyph name="chev" size={16} />
    </Link>
  );
}

/* ═════════ the feed ═════════ */

/** The page's two tabs, full width, and under them the kind pills: tabs say whose, pills say what. */
export function FeedHead({ scope, onScopeChange, filter, onFilterChange }: Pick<HomeViewProps, "scope" | "onScopeChange" | "filter" | "onFilterChange">) {
  return (
    <div>
      <TextTabs<HomeScope>
        label="Feed scope"
        fill
        value={scope}
        onChange={onScopeChange}
        tabs={[
          { value: "following", label: "Following" },
          { value: "everyone", label: "Everyone" },
        ]}
      />
      <div role="group" aria-label="Kind" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 16px 4px" }}>
        {HOME_FILTERS.map((item) => (
          <FilterChip key={item.value} label={item.label} on={item.value === filter} onClick={() => onFilterChange(item.value)} />
        ))}
      </div>
    </div>
  );
}

/** "3 new since you looked": centred, small, Inverse fill with an up arrow. Choosing it adds the items at the top in place. */
export function NewPill({ count, onShow }: { count: number; onShow: () => void }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  if (count <= 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "12px 16px 0" }}>
      <button
        type="button"
        data-testid="home-new-pill"
        onClick={onShow}
        {...handlers}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          ...touchArea(phone),
          padding: "0 12px 0 8px",
          backgroundColor: t.inverse,
          border: 0,
          borderRadius: r.full,
          ...text(13, 500, t.onInverse, { lineHeight: "normal" }),
          cursor: "pointer",
          ...ring(state.focusVisible),
        }}
      >
        <Glyph name="up" size={16} />
        {`${count} new since you looked`}
      </button>
    </div>
  );
}

/** An item of the feed: 12 above and below and 16 at the sides (prompt 29a: two items are 24 apart, no line), skipped by the renderer while it is off screen. `divided` is the profile's note, which keeps its hairline. */
function FeedItemFrame({ height, divided = false, children, ...rest }: { height: number; divided?: boolean; children: ReactNode; "data-kind": string; "data-testid"?: string }) {
  return (
    <div {...rest} style={{ padding: divided ? "0 16px" : X_FEED.desktop.padding, borderBottom: divided ? `1px solid ${t.hairline}` : undefined, contentVisibility: "auto", containIntrinsicSize: `auto ${height}px` }}>
      {children}
    </div>
  );
}

export function BuildItem({ item, srcByPath, now, onNear }: { item: HomeBuildPost; srcByPath: MediaSrcMap; now: number; onNear?: (ids: string[]) => void }) {
  const ref = useNear<HTMLDivElement>(item.build.id, onNear);
  return (
    <FeedItemFrame height={640} data-kind="build" data-testid="home-feed-item">
      <div ref={ref}>
        <FeedPost
          build={item.build}
          srcByPath={srcByPath}
          makerHandle={item.maker.handle}
          makerName={item.maker.name}
          makerAvatar={item.maker.avatarUrl ?? null}
          modelsUsed={item.modelsUsed}
          plaqueBuild={item.plaque}
          classification={item.classification}
          engagement={item.engagement}
          now={now}
          x="desktop"
        />
      </div>
    </FeedItemFrame>
  );
}

/** The profile's own first line over a run note. Home does not draw run notes; the profile does until its own prompt. */
export function NoteItem({ item, now, heading }: { item: HomeReproNote; now: number; heading?: ReactNode }) {
  const handle = atHandle(item.runner.handle) ?? "Someone";
  return (
    <FeedItemFrame height={80} divided data-kind="repro_note" data-testid="home-feed-item">
      <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr) auto", columnGap: 12, alignItems: "start", padding: "12px 4px" }}>
        <span style={{ justifySelf: "center", display: "inline-flex" }}>
          <Avatar size={28} userId={item.runner.id} name={item.runner.name} hue={item.runner.hue} src={item.runner.avatarUrl} />
        </span>
        <div style={{ minWidth: 0 }}>
          {heading ? <div>{heading}</div> : <div>
            <span style={{ fontWeight: 500 }}>{handle}</span> <span style={{ color: t.text2 }}>ran</span>{" "}
            <PlainLink to={item.href} style={{ fontWeight: 500 }}>
              {item.buildTitle}
            </PlainLink>
            {item.worked ? (
              <span style={{ color: t.text2 }}>{`, and it worked${item.model ? ` on ${item.model}` : ""}`}</span>
            ) : (
              <>
                <span style={{ color: t.breakageInk }}>, and it didn&rsquo;t work</span>
                {item.model ? <span style={{ color: t.text2 }}>{` on ${item.model}`}</span> : null}
              </>
            )}
          </div>}
          {item.note ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, ...text(13, 400, t.text2) }}>
              {item.worked ? <LampBar width={8} /> : null}
              {`"${item.note}"`}
            </div>
          ) : null}
        </div>
        <span style={text(13, 400, t.label)}>{shortAgo(item.at, now)}</span>
      </div>
    </FeedItemFrame>
  );
}

export function RebuildItem({ item, srcByPath, now, onNear }: { item: HomeRebuildPost; srcByPath: MediaSrcMap; now: number; onNear?: (ids: string[]) => void }) {
  return (
    <FeedItemFrame height={320} data-kind="rebuild" data-testid="home-feed-item">
      <RebuildPost item={item} srcByPath={srcByPath} now={now} size="desktop" onNear={onNear} />
    </FeedItemFrame>
  );
}

/** UX-07 P1: a topic is the post card, its Like, Reply and Save in the engagement row's place, and the reply box under it when open. */
export function TopicItem({ item, actions }: { item: HomeTopicPost; actions?: HomeTopicActions }) {
  return (
    <FeedItemFrame height={260} data-kind="topic" data-testid="home-feed-item">
      <div>
        <PostCard
          x="desktop"
          card={item.card}
          topic={
            actions
              ? {
                  likes: item.likes,
                  liked: item.liked,
                  onLike: () => actions.onLike(item.postId, !item.liked),
                  replies: item.replies,
                  onReply: () => actions.onReply(item.postId),
                  save: actions.save ? { saved: actions.save.isSaved(item.postId), onSave: () => actions.save!.onSave(item.postId, !actions.save!.isSaved(item.postId)) } : undefined,
                }
              : undefined
          }
        />
        {actions?.box?.at === item.postId ? (
          <div style={{ ...xGrid("desktop"), paddingTop: 12 }}>
            <div data-testid="home-reply-box" style={{ gridColumn: 2, minWidth: 0 }}>
              {actions.box.node}
            </div>
          </div>
        ) : null}
      </div>
    </FeedItemFrame>
  );
}

/**
 * UX-07 P1: every reply under one topic as one item. The topic's head and heading in compact form (avatar 24, the heading at the
 * card title size), the count of new replies, then the newest reply in the post page's anatomy with its attachments. The head and
 * the reply lead to the topic at that reply; the reply's own link is a second way in, kept out of the tab order.
 */
export function ReplyGroupItem({ item }: { item: HomeReplyGroup }) {
  const name = item.topic.author.name;
  const line = [atHandle(item.topic.author.handle), item.topic.age].filter(Boolean).join(" · ");
  return (
    <FeedItemFrame height={200} data-kind="reply_group" data-testid="home-feed-item">
      <article aria-label={`${item.count} in ${item.topic.heading || "Untitled post"}`}>
        <PlainLink to={item.to} data-testid="home-reply-group-link" style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", columnGap: 12, color: t.text, textDecoration: "none" }}>
          <Avatar size={24} userId={item.topic.author.id} name={name} src={item.topic.author.avatarUrl} />
          <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, whiteSpace: "nowrap" }}>
            <span style={text(13, 500, t.text, { lineHeight: "20px" })}>{name}</span>
            <span style={{ ...text(13, 400, t.label, { lineHeight: "20px" }), ...ellipsis, minWidth: 0 }}>{line}</span>
          </span>
          <span style={{ gridColumn: 2, display: "block", marginTop: 4, ...text(15, 500, t.text, { lineHeight: "20px" }), overflowWrap: "anywhere" }}>{item.topic.heading || "Untitled post"}</span>
          <span data-testid="home-reply-group-count" style={{ gridColumn: 2, display: "block", marginTop: 8, ...text(13, 500, t.text2, { lineHeight: "20px" }) }}>
            {item.count}
          </span>
        </PlainLink>
        <div style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", columnGap: 12, marginTop: 8 }}>
          <div style={{ gridColumn: 2, minWidth: 0 }}>
            <ReplyAnatomy reply={item.reply} />
          </div>
        </div>
      </article>
    </FeedItemFrame>
  );
}

export function FeedEnd({ cards }: { cards: readonly HomeEndCard[] }) {
  return (
    <div data-testid="home-feed-end">
      <div style={{ padding: "24px 16px 0", textAlign: "center" }}>
        <div style={text(15, 500, t.text)}>You&rsquo;re up to date</div>
        <PlainLink to={BUILDS} style={{ ...text(13, 400, t.label, { lineHeight: "18px" }), textDecoration: "underline", textUnderlineOffset: 3 }}>
          More builds
        </PlainLink>
      </div>
      {cards.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, padding: "16px 16px 0" }}>
          {cards.map((card) => (
            <Link key={card.id} to={card.href} style={{ display: "block", padding: 12, background: t.module, borderRadius: r.card, color: t.text, textDecoration: "none" }}>
              <span style={{ display: "block", ...text(15, 500, t.text), ...ellipsis }}>{card.title}</span>
              {card.facts ? <span style={{ display: "block", ...rowMeta(), ...ellipsis }}>{card.facts}</span> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FeedBody(props: HomeViewProps) {
  const { feed, filter, now, srcByPath, onPostsNear, scope, onScopeChange } = props;
  if (feed.status !== "ready" || (feed.items.length === 0 && props.newCount === 0)) {
    return (
      <PageState
        read={feed.status === "ready" ? readOf("ready", feed.items) : feed.status === "error" ? { data: undefined, error: feed.error ?? { message: "feed read failed" }, status: "error", fetchStatus: feed.retrying ? "fetching" : "idle", refetch: feed.onRetry } : readOf("loading")}
        thing="the feed"
        region="The feed"
        skeleton={<FeedBones />}
        style={{ padding: "16px" }}
        empty={{
          when: () => true,
          line: scope === "following" ? "Nobody you follow has posted yet." : "Nothing has been posted yet.",
          action: scope === "following" ? { label: "See everyone", onClick: () => onScopeChange("everyone") } : undefined,
          testId: "home-feed-empty",
        }}
      >
        {() => null}
      </PageState>
    );
  }
  const visible = feed.items.filter((item) => matchesFilter(item.kind, filter));
  return (
    <>
      <PriorityImageScope>
        <div data-testid="home-feed" style={{ display: "flex", flexDirection: "column", padding: "0 0 16px" }}>
          {visible.map((item) =>
            item.kind === "build" ? (
              <BuildItem key={item.key} item={item} srcByPath={srcByPath} now={now} onNear={onPostsNear} />
            ) : item.kind === "rebuild" ? (
              <RebuildItem key={item.key} item={item} srcByPath={srcByPath} now={now} onNear={onPostsNear} />
            ) : item.kind === "topic" ? (
              <TopicItem key={item.key} item={item} actions={props.topics} />
            ) : (
              <ReplyGroupItem key={item.key} item={item} />
            ),
          )}
        </div>
      </PriorityImageScope>
      {visible.length === 0 ? (
        <p style={text(13, 400, t.text2, { margin: 0, padding: "0 16px 16px" })}>
          None of these among the latest.{feed.hasMore ? " Show more to look further back." : ""}
        </p>
      ) : null}
      {feed.hasMore ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "0 16px" }}>
          <HomeControl disabled={feed.loadingMore} onClick={feed.onMore}>
            {feed.loadingMore ? "Loading" : "Show more"}
          </HomeControl>
        </div>
      ) : (
        <FeedEnd cards={props.endCards} />
      )}
    </>
  );
}

function Feed(props: HomeViewProps & { line?: ReactNode }) {
  return (
    <>
      {props.line ? <div style={{ padding: "12px 16px 0" }}>{props.line}</div> : null}
      <FeedHead scope={props.scope} onScopeChange={props.onScopeChange} filter={props.filter} onFilterChange={props.onFilterChange} />
      <NewPill count={props.newCount} onShow={props.onShowNew} />
      <FeedBody {...props} />
    </>
  );
}

/* ═════════ the right panel ═════════ */

/** UX-08 P3: what is still open: the topics that are still waiting for a piece, in the reader's spaces (or all of OpenBuilds when signed out). */
export function RequestsSection({ requests, scope = "spaces" }: { requests: HomeViewProps["requests"]; scope?: StillOpenScope }) {
  return (
    <PageState
      read={readOfLoadable(requests)}
      thing="posts"
      region="Still open"
      skeleton={<SectionBones rows={3} height={56} what="open topics" />}
      frame={sectionFrame("Still open", <SectionHead title={requests.status === "ready" && requests.data.length > 0 ? `${requests.data.length} ${STILL_OPEN_PHRASE[scope]}` : "Still open"} to={STILL_OPEN_HREF} openName="OpenBuilds" headingLevel={2} />)}
      style={SECTION_NOTE}
      empty={{ when: () => requests.status === "ready" && requests.data.length === 0, line: "Nothing is still open right now." }}
    >
      {() =>
        requests.status === "ready" &&
        requests.data.map((row) => (
          <RowLink key={row.id} to={row.href} data-testid="home-request-row">
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", ...rowTitle(), ...ellipsis }}>{row.title}</span>
              <span style={{ display: "block", ...rowMeta(), ...ellipsis }}>{row.detail}</span>
            </span>
            {row.reward ? <span style={{ fontFamily: DM_MONO, fontSize: 15, fontWeight: 500, lineHeight: "20px", color: t.text, whiteSpace: "nowrap" }}>{row.reward}</span> : null}
          </RowLink>
        ))
      }
    </PageState>
  );
}

/** UX-03 P6: a list module is drawn while it loads or fails, and once it holds at least one row. */
const listShown = (value: Loadable<readonly unknown[]>): boolean => value.status === "loading" || value.status === "error" || (value.status === "ready" && value.data.length > 0);

/** The right panel: what is open in the reader's spaces. With nothing there, the maker's published builds, where the studio is not on the page to hold them. */
function Room(props: HomeViewProps & { studioShown: boolean }) {
  const parts: ReactNode[] = [];
  if (listShown(props.requests)) parts.push(<RequestsSection key="requests" requests={props.requests} scope={props.stillOpenScope} />);
  if (parts.length === 0 && !props.studioShown && publishedHas(props.published)) {
    parts.push(<PublishedSection key="published" published={props.published.data} onCopyLink={props.onCopyLink} />);
  }
  return <>{parts.flatMap((part, index) => (index === 0 ? [part] : [<Rule key={`rule-${index}`} />, part]))}</>;
}

/* ═════════ the page ═════════ */

export function HomeView(props: HomeViewProps) {
  const layout = useHomeLayout();
  const phone = useIsPhone();
  // Prompt 20: below 768px Home is the feed alone. Nothing at 768 and up changes.
  if (phone) return <PhoneHome {...props} />;
  // While the feed loads the page is its loading state, the route's Placeholder, block for block (SV-04 P5).
  if (props.feed.status === "loading") return <HomeLoadingView />;
  if (props.pageFailed) {
    return (
      <>
        <HomeTitle />
        <HomeColumns flush layout={layout} left={null} centre={<PageFailed reads={props.pageFailed} region="Home" style={{ padding: "16px" }} />} right={null} />
      </>
    );
  }
  const line = props.drafts.status === "ready" ? <DraftsLine drafts={props.drafts} sessions={props.sessions} /> : null;
  return (
    <>
      <HomeTitle />
      <HomeColumns
        flush
        layout={layout}
        top={layout === "one" && line ? line : undefined}
        left={<Studio {...props} />}
        centre={<Feed {...props} line={layout === "two" ? line : undefined} />}
        right={<Room {...props} studioShown={layout === "three"} />}
      />
    </>
  );
}

export default HomeView;

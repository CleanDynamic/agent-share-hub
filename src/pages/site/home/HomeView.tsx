/* SV-10: Home, as `design/reference/vision/dusk/home.html` draws it: three columns. The maker's own work on the left
   (Your studio), a feed of build posts in the centre, the site's activity on the right (The room).

   PURE: typed props, no fetching, no `useAuth()`, no router hooks but links. `HomePage` loads and maps; the dev page
   `vision-home` renders the same props from the board's sample data. Every section is its own component.

   THE FEED. A build is `FeedPost` as it is (the post as the composer previews it), a rebuild and an ask are drawn here
   from the feed row, and a reproduction note is one line. Items are told apart by hairlines. An item off screen is
   `content-visibility: auto` with an intrinsic size near its real height. A build post tells the page when it comes
   within a screen of view (`onPostsNear`), so its post is read before it is seen.

   NOTHING MOVES. Tabs and the kind filter change at once; the "n new" pill appears in place and choosing it adds the new
   items at the top at once. */

import { PriorityImageScope } from "@/components/post/media/priorityImage";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { Plus } from "lucide-react";

import { Avatar } from "@/components/brand/Avatar";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { Button } from "@/components/brand/Button";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { LampBar } from "@/components/brand/LampDot";
import { ModelMark } from "@/components/brand/ModelMark";
import { Plaque } from "@/components/brand/Plaque";
import { Segmented } from "@/components/brand/Segmented";
import { FeedPost } from "@/components/gallery/FeedPost";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { PageHeader } from "@/components/shell/PageHeader";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { EngagementRow } from "@/components/social/EngagementRow";
import { PostCard } from "@/components/post/PostCard";
import { ReplyAnatomy } from "@/pages/site/openbuilds/PostReplies";
import { InnerTile } from "@/components/vision/InnerTile";
import { PageFigure } from "@/components/vision/PageFigure";
import { SectionChevron, SectionHead } from "@/components/vision/SectionHead";
import { TextTabs } from "@/components/vision/TextTabs";
import { START_TOPIC_FROM_RUN_LABEL } from "./runTopic";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring, touchArea } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import {
  FeedBones,
  HomeColumns,
  HomeControl,
  HomeLoadingView,
  Rule,
  SectionBones,
  ellipsis,
  text,
  useHomeLayout,
} from "./HomeFrame";
import {
  HOME_FILTERS,
  atHandle,
  closesIn,
  matchesFilter,
  runsLabel,
  shortAgo,
  solutionsLabel,
  weekMeta,
  weekSummary,
  type HomeBuildPost,
  type HomeCover,
  type HomeDraftRow,
  type HomeEndCard,
  type HomeFeedItem,
  type HomeFilter,
  type HomeMostRunRow,
  type HomeRebuildPost,
  type HomeReproNote,
  type HomeRequestRow,
  type HomeRunRow,
  type HomeSessionRow,
  type HomeSinceRow,
  type HomeSinceTone,
  type HomeWeek,
  type HomeWhereNextRow,
  type HomePublished,
  STILL_OPEN_HREF,
  STILL_OPEN_META,
  type StillOpenScope,
} from "./homeModel";
import type { HomeReplyGroup, HomeTopicPost } from "./homeTopics";

export type HomeScope = "following" | "everyone";

/** What a section that loads on its own shows. `signed-out` is a state, not an error. */
export type Loadable<T> =
  | { status: "signed-out" }
  | { status: "loading" }
  | ({ status: "error" } & PanelFailure)
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

export interface HomeRoom {
  reproducedToday: number | null;
  litToday: number | null;
  runsThisWeek: number | null;
  /** The counts could not be read: the section says so in their place. */
  failure?: PanelFailure;
  /** The latest runs: the feed's own notes. */
  runs: readonly HomeRunRow[];
  /** UX-08 P2: opens the New topic window from a run that did not work. Absent: the button is not drawn. */
  onStartTopic?: (run: HomeRunRow) => void;
}

export interface HomeViewProps {
  /** The clock the ages and the plaques read. The dev page freezes it. */
  now: number;

  /* Your studio */
  /** Since you were last here. Null: not drawn (no events since the last visit). */
  since: { meta: string; rows: readonly HomeSinceRow[] } | null;
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
  onShowNew: () => void;
  /** Signed once for the page: the posts' pictures and covers. */
  srcByPath: MediaSrcMap;
  /** Build ids whose post came within a screen of view. */
  onPostsNear?: (buildIds: string[]) => void;
  /** UX-07 P1: what a topic's row does, and the one reply box (under the topic it answers). Absent: topics carry no row. */
  topics?: HomeTopicActions;
  /** Two builds from Builds, under "You're up to date". */
  endCards: readonly HomeEndCard[];

  /* The room */
  room: HomeRoom;
  /** UX-08 P3: Still open. */
  requests: Loadable<readonly HomeRequestRow[]>;
  /** UX-08 P3: whose topics `requests` holds: the reader's spaces (the default), or all of OpenBuilds when signed out. */
  stillOpenScope?: StillOpenScope;
  mostRun: Loadable<readonly HomeMostRunRow[]>;
  whereNext: Loadable<readonly HomeWhereNextRow[]>;
  /** UX-03 P6: the maker's published builds, drawn in the room only when nothing else there has anything to show. Absent: none. */
  published?: Loadable<HomePublished>;
  /** UX-03 P6: Copy link on the newest published build. */
  onCopyLink?: (slug: string) => void;
}

const DRAFTS = "/drafts";
const BUILDS = "/builds";
const ACTIVITY = "/notifications";
const SIGN_IN = "/login?redirect=/";

const mono = (px: number, color: string, extra: CSSProperties = {}): CSSProperties => ({ fontFamily: DM_MONO, fontSize: px, fontWeight: 400, lineHeight: "16px", color, ...extra });

/** A row of a side column: a link, with a hairline under all but the last. */
const rowLink = (last: boolean, extra: CSSProperties = {}): CSSProperties => ({
  boxSizing: "border-box",
  borderBottom: last ? "none" : `1px solid ${t.hairline}`,
  color: t.text,
  textDecoration: "none",
  ...extra,
});

/** A link in the board's plain style: `--text`, `--text2` on a fine pointer's hover, ringed on focus. */
function PlainLink({ to, style, children, ...rest }: { to: string; style?: CSSProperties; children: ReactNode; "aria-label"?: string; "data-testid"?: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} {...rest} {...handlers} style={{ color: state.hovered ? t.text2 : t.text, textDecoration: "none", borderRadius: r.chip, ...ring(state.focusVisible), ...style }}>
      {children}
    </Link>
  );
}

/** The dot-grid well that stands where a cover has not arrived, or where there is none. */
function Cover({ cover, height, width, eager = false }: { cover: HomeCover; height: number; width?: number; eager?: boolean }) {
  const box: CSSProperties = {
    display: "block",
    boxSizing: "border-box",
    width: width ?? "100%",
    height,
    borderRadius: r.control,
    overflow: "hidden",
    background: t.well,
    backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`,
    backgroundSize: "16px 16px",
    border: `1px solid ${t.wellBorder}`,
    flexShrink: 0,
  };
  return (
    <span aria-hidden="true" style={box}>
      {cover.src ? (
        <img src={cover.src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
    </span>
  );
}

/* ═════════ your studio ═════════ */

const SINCE_DOT: Record<HomeSinceTone, string> = { worked: t.evidence, failed: t.catBreakage, rebuild: t.text2, stale: t.lit };

export function SinceSection({ meta, rows, now }: { meta: string; rows: readonly HomeSinceRow[]; now: number }) {
  return (
    <section aria-label="Since you were last here">
      <div style={{ marginBottom: 16 }}>
        <SectionHead title="Since you were last here" meta={meta} headingLevel={2} />
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
        {rows.map((row, index) => {
          const last = index === rows.length - 1;
          return (
            <li key={row.key} style={{ display: "grid", gridTemplateColumns: "16px 1fr auto", columnGap: 10, paddingBottom: last ? 0 : 14, position: "relative" }}>
              {last ? null : <span aria-hidden="true" style={{ position: "absolute", left: 7, top: 14, bottom: 0, width: 1, background: t.hairline }} />}
              <span aria-hidden="true" style={{ marginTop: 5, width: 9, height: 9, borderRadius: 5, background: SINCE_DOT[row.tone], boxShadow: last ? undefined : `0 0 0 3px ${t.surface}`, position: "relative" }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{row.href ? <PlainLink to={row.href}>{row.title}</PlainLink> : row.title}</div>
                <div style={text(12, 400, t.label)}>{row.detail}</div>
              </div>
              <span style={text(12, 400, t.label)}>{shortAgo(row.at, now)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SectionFailure({ panel, failure }: { panel: string; failure: PanelFailure }) {
  return <ErrorState panel={panel} onRetry={failure.onRetry} error={failure.error} />;
}

export function ContinueSection({ drafts }: { drafts: HomeViewProps["drafts"] }) {
  if (drafts.status === "loading") return <SectionBones rows={3} height={48} what="your drafts" />;
  const meta = drafts.status === "ready" ? `${drafts.data.total} ${drafts.data.total === 1 ? "draft" : "drafts"} · latest first` : undefined;
  return (
    <section aria-label="Continue editing">
      <div style={{ marginBottom: 8 }}>
        <SectionHead title="Continue editing" meta={meta} to={DRAFTS} openName="drafts" headingLevel={2} />
      </div>
      {drafts.status === "error" ? (
        <SectionFailure panel="Continue editing" failure={drafts} />
      ) : drafts.status === "ready" && drafts.data.rows.length > 0 ? (
        drafts.data.rows.map((row, index) => (
          <Link key={row.id} to={`/compose/${row.id}`} data-testid="home-draft-row" style={rowLink(index === drafts.data.rows.length - 1, { display: "flex", alignItems: "center", minHeight: 48 })}>
            <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ display: "block", fontWeight: 500, color: row.untitled ? t.text2 : t.text, ...ellipsis }}>{row.title}</span>
              <span style={text(12, 400, t.label)}>{row.meta}</span>
            </span>
          </Link>
        ))
      ) : (
        <EmptyState line="No drafts in progress." action={undefined} />
      )}
    </section>
  );
}

export function SessionsSection({ sessions, onAdd }: { sessions: HomeViewProps["sessions"]; onAdd: (id: string) => void }) {
  if (sessions.status === "loading") return <SectionBones rows={2} height={52} what="your sessions" />;
  const meta = sessions.status === "ready" ? `${sessions.data.total} imported · newest first` : undefined;
  return (
    <section aria-label="Your sessions">
      <div style={{ marginBottom: 8 }}>
        <SectionHead title="Your sessions" meta={meta} to={DRAFTS} openName="sessions" headingLevel={2} />
      </div>
      {sessions.status === "error" ? (
        <SectionFailure panel="Your sessions" failure={sessions} />
      ) : sessions.status === "ready" && sessions.data.rows.length > 0 ? (
        sessions.data.rows.map((row, index) => (
          <div
            key={row.id}
            data-testid="home-session-row"
            style={{ display: "grid", gridTemplateColumns: "20px 1fr 28px", columnGap: 10, alignItems: "center", minHeight: 52, borderBottom: index === sessions.data.rows.length - 1 ? "none" : `1px solid ${t.hairline}` }}
          >
            <span style={{ display: "inline-flex", color: t.text }}>
              <ModelMark tool={row.model ? null : row.client} model={row.model} size={18} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", ...ellipsis }}>{row.title}</span>
              <span style={{ display: "block", ...mono(11, t.label) }}>{row.meta}</span>
            </span>
            <IconButton icon={Plus} drawn={<Glyph name="plus" size={12} />} label="Add to a new build" size={24} onClick={() => onAdd(row.id)} />
          </div>
        ))
      ) : (
        <EmptyState line="No sessions yet." action={undefined} />
      )}
    </section>
  );
}

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

function dayBar(state: HomeWeek["days"][number], today: boolean): CSSProperties {
  const base: CSSProperties = { display: "block", width: "100%", height: 6, borderRadius: 2, boxSizing: "border-box" };
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
  if (week.status === "loading") return <SectionBones rows={3} height={40} what="your week" />;
  if (week.status === "signed-out") return null;
  return (
    <section aria-label="Your week">
      <div style={{ marginBottom: 14 }}>
        <SectionHead title="Your week" meta={week.status === "ready" ? weekMeta(week.data.streak) : undefined} headingLevel={2} />
      </div>
      {week.status === "error" ? (
        <SectionFailure panel="Your week" failure={week} />
      ) : (
        <>
          <div role="img" aria-label={weekSummary(week.data.days)} data-testid="home-week-days" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginBottom: 16 }}>
            {week.data.days.map((state, index) => {
              const today = index === week.data.today;
              return (
                <div key={index} aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={dayBar(state, today)} />
                  <span style={text(11, today ? 500 : 400, today ? t.text : t.label)}>{DAY_LETTERS[index]}</span>
                </div>
              );
            })}
          </div>
          {week.data.challenges.map((row, index) => (
            <div key={row.slug} data-testid="weekly-challenge" style={{ padding: index === week.data.challenges.length - 1 ? "10px 0 0" : "10px 0", borderTop: `1px solid ${t.hairline}` }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8, ...text(12, 500, t.text) }}>
                <span>{row.title}</span>
                <span style={{ color: t.label, fontWeight: 400, whiteSpace: "nowrap" }}>{`${row.done} / ${row.target}`}</span>
              </span>
              <ChallengeBar done={row.done} target={row.target} title={row.title} />
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function StudioSignedOut() {
  return (
    <section aria-label="Your studio">
      <EmptyState line="Sign in to see your drafts, sessions and week." action={undefined} />
      <div style={{ marginTop: 12 }}>
        <Button variant="primary" size={32} href={SIGN_IN} data-visual-slot="btn-primary">
          Sign in
        </Button>
      </div>
    </section>
  );
}

function Studio(props: HomeViewProps) {
  if (props.drafts.status === "signed-out") return <StudioSignedOut />;
  const parts: ReactNode[] = [];
  if (props.since) parts.push(<SinceSection key="since" meta={props.since.meta} rows={props.since.rows} now={props.now} />);
  parts.push(<ContinueSection key="drafts" drafts={props.drafts} />);
  parts.push(<SessionsSection key="sessions" sessions={props.sessions} onAdd={props.onAddSession} />);
  // UX-03 P6: a week with nothing done yet is not drawn.
  if (props.week.status !== "ready" || weekHasProgress(props.week.data)) parts.push(<WeekSection key="week" week={props.week} />);
  return (
    <>
      {parts.flatMap((part, index) => (index === 0 ? [part] : [<Rule key={`rule-${index}`} />, part]))}
    </>
  );
}

/** One column: the line above the feed that stands for the studio. */
function DraftsLine({ drafts, sessions }: Pick<HomeViewProps, "drafts" | "sessions">) {
  if (drafts.status !== "ready") return null;
  const parts = [`${drafts.data.total} ${drafts.data.total === 1 ? "draft" : "drafts"} in progress`];
  if (sessions.status === "ready") parts.push(`${sessions.data.total} ${sessions.data.total === 1 ? "session" : "sessions"}`);
  return (
    <Link
      to={DRAFTS}
      data-testid="home-drafts-line"
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 32, padding: "0 12px", boxSizing: "border-box", background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, color: t.text, textDecoration: "none" }}
    >
      <span>{parts.join(" · ")}</span>
      <Glyph name="chev" size={12} />
    </Link>
  );
}

/* ═════════ the feed ═════════ */

export function FeedHead({ scope, onScopeChange, filter, onFilterChange }: Pick<HomeViewProps, "scope" | "onScopeChange" | "filter" | "onFilterChange">) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", columnGap: 12, padding: "0 20px", borderBottom: `1px solid ${t.hairline}` }}>
      <TextTabs<HomeScope>
        label="Feed scope"
        height={32}
        gap={24}
        rule={false}
        value={scope}
        onChange={onScopeChange}
        tabs={[
          { value: "following", label: "Following" },
          { value: "everyone", label: "Everyone" },
        ]}
      />
      <div style={{ marginBottom: 6 }}>
        <Segmented<HomeFilter> label="Kind" size={28} items={HOME_FILTERS} value={filter} onChange={onFilterChange} />
      </div>
    </div>
  );
}

export function NewPill({ count, onShow }: { count: number; onShow: () => void }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  if (count <= 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 20px 0" }}>
      <button
        type="button"
        data-testid="home-new-pill"
        onClick={onShow}
        {...handlers}
        style={{ height: 32, ...touchArea(phone), padding: "0 12px", background: state.hovered ? t.controlOn : t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: 14, ...text(12, 400, t.text, { lineHeight: "normal" }), cursor: "pointer", ...ring(state.focusVisible) }}
      >
        {`${count} new since you looked`}
      </button>
    </div>
  );
}

/** An item of the feed: a hairline under it, and skipped by the renderer while it is off screen. */
function FeedItemFrame({ height, children, ...rest }: { height: number; children: ReactNode; "data-kind": string; "data-testid"?: string }) {
  return (
    <div {...rest} style={{ borderBottom: `1px solid ${t.hairline}`, contentVisibility: "auto", containIntrinsicSize: `auto ${height}px` }}>
      {children}
    </div>
  );
}

/** Calls `onNear` once, when the element comes within a screen of view. */
function useNear<E extends Element>(id: string, onNear?: (ids: string[]) => void) {
  const ref = useRef<E>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !onNear || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          onNear([id]);
        }
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, onNear]);
  return ref;
}

/** The author row of a rebuild or an ask: name, then "@handle <what> · age". */
function AuthorRow({ name, line }: { name: string; line: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 24, marginBottom: 4, whiteSpace: "nowrap", minWidth: 0 }}>
      <span style={text(13, 500, t.text, { lineHeight: 1.4 })}>{name}</span>
      <span style={{ ...text(13, 400, t.label, { lineHeight: 1.4 }), ...ellipsis, minWidth: 0 }}>{line}</span>
    </div>
  );
}

export function BuildItem({ item, srcByPath, now, onNear }: { item: HomeBuildPost; srcByPath: MediaSrcMap; now: number; onNear?: (ids: string[]) => void }) {
  const ref = useNear<HTMLDivElement>(item.build.id, onNear);
  return (
    <FeedItemFrame height={640} data-kind="build" data-testid="home-feed-item">
      <div ref={ref} style={{ padding: "0 20px" }}>
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
        />
      </div>
    </FeedItemFrame>
  );
}

/** UX-10 P6: the profile passes its own first line (`Reproduced @kit's Podcast clipper on Opus 5.5: it worked`); Home passes none. */
export function NoteItem({ item, now, heading }: { item: HomeReproNote; now: number; heading?: ReactNode }) {
  const handle = atHandle(item.runner.handle) ?? "Someone";
  return (
    <FeedItemFrame height={80} data-kind="repro_note" data-testid="home-feed-item">
      <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr) auto", columnGap: 12, alignItems: "start", padding: "14px 20px" }}>
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
                <span style={{ color: t.catBreakage }}>, and it didn&rsquo;t work</span>
                {item.model ? <span style={{ color: t.text2 }}>{` on ${item.model}`}</span> : null}
              </>
            )}
          </div>}
          {item.note ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, ...text(12, 400, t.text2) }}>
              {item.worked ? <LampBar width={8} /> : null}
              {`"${item.note}"`}
            </div>
          ) : null}
        </div>
        <span style={text(12, 400, t.label)}>{shortAgo(item.at, now)}</span>
      </div>
    </FeedItemFrame>
  );
}

/** The build line under a rebuild: its title and its Plaque. */
function BuildLine({ title, href, plaque, now }: { title: string; href: string; plaque: HomeRebuildPost["plaque"]; now: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 6, marginTop: 12 }}>
      <PlainLink to={href} style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
        {title}
      </PlainLink>
      <Plaque build={plaque} size="card" now={now} />
    </div>
  );
}

export function RebuildItem({ item, now, onNear }: { item: HomeRebuildPost; now: number; onNear?: (ids: string[]) => void }) {
  const ref = useNear<HTMLDivElement>(item.build.id, onNear);
  const source = atHandle(item.source.handle);
  const handle = atHandle(item.maker.handle);
  const age = shortAgo(item.at, now);
  return (
    <FeedItemFrame height={320} data-kind="rebuild" data-testid="home-feed-item">
      <article ref={ref} aria-label={item.build.title} style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, padding: "20px 20px 16px" }}>
        <Avatar size={40} userId={item.maker.id} name={item.maker.name} hue={item.maker.hue} src={item.maker.avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <AuthorRow name={item.maker.name} line={`${handle ? `${handle} ` : ""}rebuilt${age ? ` · ${age}` : ""}`} />
          {item.note ? <p style={text(16, 400, t.text, { margin: 0, lineHeight: 1.55 })}>{item.note}</p> : null}
          <div style={{ display: "grid", gridTemplateColumns: "88px minmax(0, 1fr)", columnGap: 12, marginTop: 12, padding: 10, background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card }}>
            <Cover cover={{ src: null }} height={58} />
            <span style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
              <span style={text(12, 400, t.label)}>Rebuilt from</span>
              <span style={{ fontWeight: 500, ...ellipsis }}>{item.source.title}</span>
              {source ? <span style={text(12, 400, t.label)}>{source}</span> : null}
            </span>
          </div>
          <BuildLine title={item.build.title} href={`/b2/${item.build.slug}`} plaque={item.plaque} now={now} />
          {item.engagement ? (
            <EngagementRow
              variant="card"
              withRebuild
              build={{ id: item.build.id, slug: item.build.slug, title: item.build.title, rebuild_count: item.build.rebuild_count }}
              counts={item.engagement.counts}
              liked={item.engagement.liked}
              saved={item.engagement.saved}
              style={{ marginTop: 12, maxWidth: 520, justifyContent: "space-between" }}
            />
          ) : null}
        </div>
      </article>
    </FeedItemFrame>
  );
}

/** UX-07 P1: a topic is the post card, its Like, Reply and Save in the engagement row's place, and the reply box under it when open. */
export function TopicItem({ item, actions }: { item: HomeTopicPost; actions?: HomeTopicActions }) {
  return (
    <FeedItemFrame height={260} data-kind="topic" data-testid="home-feed-item">
      <div style={{ padding: "0 20px" }}>
        <PostCard
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
          <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, paddingBottom: 16 }}>
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
 * card title size), `3 new replies` in 12.5/500, then the newest reply in the post page's anatomy with its attachments. The head and
 * the reply lead to the topic at that reply; the reply's own link is a second way in, kept out of the tab order.
 */
export function ReplyGroupItem({ item }: { item: HomeReplyGroup }) {
  const name = item.topic.author.name;
  const line = [atHandle(item.topic.author.handle), item.topic.age].filter(Boolean).join(" · ");
  return (
    <FeedItemFrame height={200} data-kind="reply_group" data-testid="home-feed-item">
      <article aria-label={`${item.count} in ${item.topic.heading || "Untitled post"}`} style={{ padding: "20px 20px 16px" }}>
        <PlainLink to={item.to} data-testid="home-reply-group-link" style={{ display: "grid", gridTemplateColumns: "24px minmax(0, 1fr)", columnGap: 12, color: t.text, textDecoration: "none" }}>
          <Avatar size={24} userId={item.topic.author.id} name={name} src={item.topic.author.avatarUrl} />
          <span style={{ display: "flex", alignItems: "baseline", gap: 6, minWidth: 0, whiteSpace: "nowrap" }}>
            <span style={text(13, 500, t.text, { lineHeight: "20px" })}>{name}</span>
            <span style={{ ...text(12, 400, t.label, { lineHeight: "20px" }), ...ellipsis, minWidth: 0 }}>{line}</span>
          </span>
          <span style={{ gridColumn: 2, display: "block", marginTop: 4, ...text(13, 500, t.text, { lineHeight: 1.4 }), overflowWrap: "anywhere" }}>{item.topic.heading || "Untitled post"}</span>
          <span data-testid="home-reply-group-count" style={{ gridColumn: 2, display: "block", marginTop: 8, ...text(12, 500, t.text2, { lineHeight: "20px" }) }}>
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

export function FeedEnd({ cards, now }: { cards: readonly HomeEndCard[]; now: number }) {
  return (
    <div data-testid="home-feed-end">
      <div style={{ padding: "28px 20px 8px", textAlign: "center" }}>
        <div style={{ fontWeight: 500 }}>You&rsquo;re up to date</div>
        <PlainLink to={BUILDS} style={{ ...text(12, 400, t.label), textDecoration: "none" }}>
          More builds
        </PlainLink>
      </div>
      {cards.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, padding: "12px 20px 0" }}>
          {cards.map((card) => (
            <Link key={card.id} to={card.href} style={{ display: "block", padding: 10, background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, color: t.text, textDecoration: "none" }}>
              <Cover cover={card.cover} height={110} />
              <span style={{ display: "block", marginTop: 10, fontWeight: 500, ...ellipsis }}>{card.title}</span>
              <span style={{ display: "flex", marginTop: 4 }}>
                <Plaque build={card.plaque} size="card" now={now} />
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FeedBody(props: HomeViewProps) {
  const { feed, filter, now, srcByPath, onPostsNear, scope, onScopeChange } = props;
  if (feed.status === "loading") return <FeedBones />;
  if (feed.status === "error") return <ErrorState panel="The feed" onRetry={feed.onRetry} error={feed.error} data-testid="home-feed-error" style={{ padding: "16px 20px" }} />;
  if (feed.items.length === 0 && props.newCount === 0) {
    return (
      <EmptyState
        style={{ padding: "16px 20px" }}
        line={scope === "following" ? "Nobody you follow has posted yet." : "Nothing has been posted yet."}
        action={scope === "following" ? { label: "See everyone", onClick: () => onScopeChange("everyone") } : undefined}
        data-testid="home-feed-empty"
      />
    );
  }
  const visible = feed.items.filter((item) => matchesFilter(item.kind, filter));
  return (
    <>
      <PriorityImageScope>
      <div data-testid="home-feed">
        {visible.map((item) =>
          item.kind === "build" ? (
            <BuildItem key={item.key} item={item} srcByPath={srcByPath} now={now} onNear={onPostsNear} />
          ) : item.kind === "rebuild" ? (
            <RebuildItem key={item.key} item={item} now={now} onNear={onPostsNear} />
          ) : item.kind === "topic" ? (
            <TopicItem key={item.key} item={item} actions={props.topics} />
          ) : item.kind === "reply_group" ? (
            <ReplyGroupItem key={item.key} item={item} />
          ) : (
            <NoteItem key={item.key} item={item} now={now} />
          ),
        )}
      </div>
      </PriorityImageScope>
      {visible.length === 0 ? (
        <p style={text(12, 400, t.text2, { margin: 0, padding: "16px 20px 0" })}>
          None of these among the latest.{feed.hasMore ? " Show more to look further back." : ""}
        </p>
      ) : null}
      {feed.hasMore ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 20px 0" }}>
          <HomeControl disabled={feed.loadingMore} onClick={feed.onMore}>
            {feed.loadingMore ? "Loading" : "Show more"}
          </HomeControl>
        </div>
      ) : (
        <FeedEnd cards={props.endCards} now={now} />
      )}
    </>
  );
}

function Feed(props: HomeViewProps) {
  return (
    <>
      <FeedHead scope={props.scope} onScopeChange={props.onScopeChange} filter={props.filter} onFilterChange={props.onFilterChange} />
      <NewPill count={props.newCount} onShow={props.onShowNew} />
      <FeedBody {...props} />
    </>
  );
}

/* ═════════ the room ═════════ */

function Figure({ value, lamp = false }: { value: number | null; lamp?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, ...text(16, 500, t.text, { lineHeight: 1.1, letterSpacing: "-0.02em" }) }}>
      {lamp ? <LampBar width={10} /> : null}
      {value === null ? " " : value.toLocaleString("en-GB")}
    </div>
  );
}

const runChip = (worked: boolean): CSSProperties => ({
  ...text(12, 400, worked ? t.evidence : t.catBreakage, { lineHeight: "18px" }),
  display: "inline-flex",
  alignItems: "center",
  boxSizing: "border-box",
  height: 20,
  padding: "0 8px",
  borderRadius: r.chip,
  background: worked ? t.evidenceFill : t.catBreakageFill,
  whiteSpace: "nowrap",
});

export function RoomSection({ room, now }: { room: HomeRoom; now: number }) {
  return (
    <section aria-label="Today">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <PageFigure size="room" figure={room.reproducedToday === null ? " " : runsLabel(room.reproducedToday)} parts={[{ text: "Reproduced today" }]} />
        <SectionChevron to={ACTIVITY} name="activity" />
      </div>
      {room.failure ? (
        <div style={{ marginTop: 16 }}>
          <SectionFailure panel="Run counts" failure={room.failure} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 16 }}>
          <InnerTile style={{ padding: 12 }}>
            <Figure value={room.litToday} lamp />
            <div style={{ marginTop: 4, ...text(12, 400, t.label) }}>builds confirmed in the last 24 hours</div>
          </InnerTile>
          <InnerTile style={{ padding: 12 }}>
            <Figure value={room.runsThisWeek} />
            <div style={{ marginTop: 4, ...text(12, 400, t.label) }}>runs this week</div>
          </InnerTile>
        </div>
      )}
      {room.runs.length > 0 ? (
        <div style={{ marginTop: 14 }} data-testid="home-latest-runs">
          {room.runs.map((run) => (
            <div key={run.key} style={{ borderTop: `1px solid ${t.hairline}` }}>
              <Link
                to={run.href}
                style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", columnGap: 10, alignItems: "center", minHeight: 32, color: t.text, textDecoration: "none" }}
              >
                <span style={runChip(run.worked)}>{run.worked ? "Worked" : "Didn’t"}</span>
                <span style={{ minWidth: 0, ...ellipsis, ...text(12, 400, t.text) }}>
                  <span style={{ fontWeight: 500 }}>{run.buildTitle}</span>
                  {run.handle ? <span style={{ color: t.label }}>{` · ${atHandle(run.handle)}`}</span> : null}
                </span>
                <span style={text(12, 400, t.label)}>{shortAgo(run.at, now)}</span>
              </Link>
              {run.canStartTopic && room.onStartTopic ? (
                <div style={{ paddingBottom: 8 }}>
                  <HomeControl onClick={() => room.onStartTopic?.(run)}>{START_TOPIC_FROM_RUN_LABEL}</HomeControl>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** UX-08 P3: Still open: the topics that are still waiting for a piece, in the reader's spaces (or all of OpenBuilds when signed out). */
export function RequestsSection({ requests, scope = "spaces" }: { requests: HomeViewProps["requests"]; scope?: StillOpenScope }) {
  if (requests.status === "loading") return <SectionBones rows={3} height={48} what="still-open topics" />;
  return (
    <section aria-label="Still open">
      <div style={{ marginBottom: 8 }}>
        <SectionHead title="Still open" meta={STILL_OPEN_META[scope]} to={STILL_OPEN_HREF} openName="OpenBuilds" headingLevel={2} />
      </div>
      {requests.status === "error" ? (
        <SectionFailure panel="Still open" failure={requests} />
      ) : requests.status === "ready" && requests.data.length > 0 ? (
        requests.data.map((row, index) => (
          <Link key={row.id} to={row.href} data-testid="home-request-row" style={rowLink(index === requests.data.length - 1, { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 48 })}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 500, ...ellipsis }}>{row.title}</span>
              <span style={{ display: "block", ...text(12, 400, t.label), ...ellipsis }}>{row.detail}</span>
            </span>
            {row.reward ? <span style={{ fontWeight: 500 }}>{row.reward}</span> : null}
          </Link>
        ))
      ) : (
        <EmptyState line="Nothing is still open right now." action={undefined} />
      )}
    </section>
  );
}

const MOST_RUN_ROW: CSSProperties = { display: "grid", gridTemplateColumns: "16px 28px 1fr auto", columnGap: 10, alignItems: "center", minHeight: 48 };

export function MostRunSection({ mostRun }: { mostRun: HomeViewProps["mostRun"] }) {
  if (mostRun.status === "loading") return <SectionBones rows={3} height={48} what="the most run builds" />;
  return (
    <section aria-label="Most run this week">
      <div style={{ marginBottom: 8 }}>
        <SectionHead title="Most run this week" meta="By people who reproduced them" headingLevel={2} />
      </div>
      {mostRun.status === "error" ? (
        <SectionFailure panel="Most run this week" failure={mostRun} />
      ) : mostRun.status === "ready" && mostRun.data.length > 0 ? (
        mostRun.data.map((row, index) => (
          <Link key={row.buildId} to={row.href} data-testid="home-most-run-row" style={rowLink(index === mostRun.data.length - 1, MOST_RUN_ROW)}>
            <span style={mono(11, t.label)}>{index + 1}</span>
            <Avatar size={28} userId={row.maker.id} name={row.maker.name} hue={row.maker.hue} src={row.maker.avatarUrl} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 500, ...ellipsis }}>{row.title}</span>
              {row.maker.handle ? <span style={text(12, 400, t.label)}>{atHandle(row.maker.handle)}</span> : null}
            </span>
            <span style={{ fontWeight: 500 }}>{row.count.toLocaleString("en-GB")}</span>
          </Link>
        ))
      ) : (
        <EmptyState line="Nothing run yet this week." action={undefined} />
      )}
    </section>
  );
}

const WHERE_NEXT_ROW: CSSProperties = { display: "grid", gridTemplateColumns: "56px 1fr", columnGap: 10, alignItems: "center", minHeight: 56 };

export function WhereNextSection({ whereNext }: { whereNext: HomeViewProps["whereNext"] }) {
  if (whereNext.status === "signed-out") return null;
  if (whereNext.status === "loading") return <SectionBones rows={2} height={56} what="suggestions" />;
  return (
    <section aria-label="Where next">
      <div style={{ marginBottom: 8 }}>
        <SectionHead title="Where next" meta="From what you ran this week" headingLevel={2} />
      </div>
      {whereNext.status === "error" ? (
        <SectionFailure panel="Where next" failure={whereNext} />
      ) : whereNext.data.length > 0 ? (
        whereNext.data.map((row, index) => (
          <Link key={row.id} to={row.href} data-testid="home-where-next-row" style={rowLink(index === whereNext.data.length - 1, WHERE_NEXT_ROW)}>
            <Cover cover={row.cover} height={40} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 500, ...ellipsis }}>{row.title}</span>
              <span style={{ display: "block", ...mono(11, t.label), ...ellipsis }}>{row.reason}</span>
            </span>
          </Link>
        ))
      ) : (
        <EmptyState line="Run a build this week and suggestions appear here." action={undefined} />
      )}
    </section>
  );
}

/** UX-03 P6: a list module is drawn while it loads or fails, and once it holds at least one row. */
const listShown = (value: Loadable<readonly unknown[]>): boolean => value.status === "loading" || value.status === "error" || (value.status === "ready" && value.data.length > 0);

/** UX-03 P6: the room's figure and counts are drawn when one is above zero, a run is listed, or they could not be read. */
const roomShown = (room: HomeRoom): boolean => Boolean(room.failure) || room.runs.length > 0 || [room.reproducedToday, room.litToday, room.runsThisWeek].some((value) => (value ?? 0) > 0);

/** Every module of the room has answered, so whether it is empty is known. */
const roomSettled = (props: HomeViewProps): boolean =>
  [props.room.reproducedToday, props.room.litToday, props.room.runsThisWeek].every((value) => value !== null) &&
  [props.requests, props.mostRun, props.whereNext].every((value) => value.status === "ready" || value.status === "signed-out");

/**
 * UX-03 P6: the maker's published builds, when nothing else in the room has anything to say: how many, the newest five with their
 * dates, what a reproduction is, and the newest one's link to copy.
 */
export function PublishedSection({ published, onCopyLink }: { published: HomePublished; onCopyLink?: (slug: string) => void }) {
  const newest = published.rows[0];
  const meta = `${published.total} published${published.reproduced === 0 ? " · none reproduced yet" : ""}`;
  return (
    <section aria-label="Your published builds">
      <div style={{ marginBottom: 8 }}>
        <SectionHead title="Your published builds" meta={meta} headingLevel={2} />
      </div>
      {published.rows.map((row, index) => (
        <Link key={row.id} to={row.href} data-testid="home-published-row" style={rowLink(index === published.rows.length - 1, { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 32 })}>
          <span style={{ minWidth: 0, fontWeight: 500, ...ellipsis }}>{row.title}</span>
          <span style={{ ...text(12, 400, t.label), whiteSpace: "nowrap" }}>{row.published}</span>
        </Link>
      ))}
      <p style={{ ...text(12, 400, t.text2), margin: "12px 0 0", lineHeight: "18px" }}>A reproduction is recorded when another signed-in person runs your build and says whether it worked.</p>
      {newest && onCopyLink ? (
        <div style={{ marginTop: 12 }}>
          <HomeControl onClick={() => onCopyLink(newest.slug)}>Copy link</HomeControl>
        </div>
      ) : null}
    </section>
  );
}

function Room(props: HomeViewProps) {
  const parts: ReactNode[] = [];
  if (roomShown(props.room)) parts.push(<RoomSection key="room" room={props.room} now={props.now} />);
  if (listShown(props.requests)) parts.push(<RequestsSection key="requests" requests={props.requests} scope={props.stillOpenScope} />);
  if (listShown(props.mostRun)) parts.push(<MostRunSection key="most" mostRun={props.mostRun} />);
  if (props.whereNext.status !== "signed-out" && listShown(props.whereNext)) parts.push(<WhereNextSection key="next" whereNext={props.whereNext} />);
  // Nothing else to show, for a maker with published builds: those builds.
  if (parts.length === 0 && roomSettled(props) && props.published?.status === "ready" && props.published.data.total > 0) {
    parts.push(<PublishedSection key="published" published={props.published.data} onCopyLink={props.onCopyLink} />);
  }
  return <>{parts.flatMap((part, index) => (index === 0 ? [part] : [<Rule key={`rule-${index}`} />, part]))}</>;
}

/* ═════════ the page ═════════ */

export function HomeView(props: HomeViewProps) {
  const layout = useHomeLayout();
  // While the feed loads the page is its loading state, the route's Placeholder, block for block (SV-04 P5).
  if (props.feed.status === "loading") return <HomeLoadingView />;
  return (
    <>
    <PageHeader title="Home" />
    <HomeColumns
      layout={layout}
      top={layout === "one" ? <DraftsLine drafts={props.drafts} sessions={props.sessions} /> : undefined}
      left={<Studio {...props} />}
      centre={<Feed {...props} />}
      right={<Room {...props} />}
    />
    </>
  );
}

export default HomeView;

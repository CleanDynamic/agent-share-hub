/* UI-P35 — Activity, as the reference draws it (design/reference/{desktop,mobile}/{noon,dusk}/activity.html).

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   links. `ActivityPage` supplies the data; the dev compare page supplies the
   sample data; both render this. The viewport is read here (the app's 768px
   breakpoint) so the two behave the same.

   DESKTOP: a `minmax(0, 1fr) 400px` grid, gap 12, filling the 820px board — the
   list on the left; the orbs (180), the runs chart (190) and the "Show me"
   filter (the rest) on the right. PHONE: the heading, the kind chips, and one
   panel per day; no orbs, chart or filter panel (the chips are the filter).

   ONE KIND, ONE ICON, ONE INK. Each kind's icon and colour (KIND below) is spent
   on its badge and its filter dot and nowhere else. The reference's amber
   (`--lit`) on the solved and published badges is `--lit-ink` here, as RULES §7
   lists.

   CONTENT-BOX WHERE THE REFERENCE IS. The boards are content-box and the app is
   border-box, so the row's min-height and the badge's 20px are content-box here,
   as GalleryView and BuildView do it. */

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Check,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  RefreshCw,
  Target,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { LampDot } from "@/components/brand/LampDot";
import { OrbGlass } from "@/components/brand/OrbGlass";
import { OrbSolid } from "@/components/brand/OrbSolid";
import { PageHeading } from "@/components/brand/PageHeading";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { LineChart } from "@/components/brand/charts";
import { FrameLink } from "@/components/shell/FrameLink";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { BOARD_GRID_HEIGHT, boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { shortAgo } from "@/pages/site/home/homeModel";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import {
  ACTIVITY_KINDS,
  PHONE_CHIPS,
  chartSubtitle,
  filterGroups,
  toggleKind,
  unreadHeading,
  unreadLine,
  type ActivityGroup,
  type ActivityKind,
  type ActivityRow,
  type KindCounts,
} from "./activityModel";

/* ── the view's props ── */

/** What a panel that loads on its own shows. */
export type ActivityLoad<T> =
  | { status: "loading" }
  | ({ status: "error" } & PanelFailure)
  | { status: "ready"; data: T };

export interface ActivityListProps {
  status: "loading" | "error" | "ready";
  /** The loaded notifications under their days, newest first. */
  groups: readonly ActivityGroup[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
  /** The real error behind `status: "error"`; logged once by the panel, never shown. */
  error?: unknown;
}

export interface ActivityRuns {
  /** Runs per day, scaled 0–1, oldest first. */
  values: readonly number[];
  /** The day a rebuild went live, or null when none did in the window. */
  markerIndex: number | null;
  /** The chart in words, for assistive tech. */
  label: string;
}

export interface ActivityViewProps {
  fit?: PageFit;
  /** The clock the times read. The compare page freezes it. */
  now: number;
  list: ActivityListProps;
  /** Unread notifications; null until known. */
  unread: number | null;
  /** The realtime channel is connected. */
  live: boolean;
  /** Each kind's count among the loaded notifications. */
  kindCounts: KindCounts;
  /** Different people who ran the viewer's builds this week; null until known. */
  peopleThisWeek: number | null;
  /** That count could not be read: its orb's place says so. */
  peopleError?: PanelFailure;
  runs: ActivityLoad<ActivityRuns>;
  /**
   * A mark-read the server refused. The row and the count have already gone back to
   * unread (the page re-reads them), and the list says so in its own place with a way
   * to ask again — an optimistic action that fails rolls back with a line, not silence.
   */
  writeError?: PanelFailure;
  /** A row was followed: it marks itself read. */
  onOpen: (row: ActivityRow) => void;
  onMarkAllRead: () => void;
}

const GALLERY = "/gallery";

/* ── the kinds ── */

const KIND: Record<ActivityKind, { icon: LucideIcon; ink: string }> = {
  reproduced: { icon: Check, ink: t.evidence },
  rebuilt: { icon: RefreshCw, ink: t.catAgents },
  solution: { icon: Target, ink: t.action },
  solved: { icon: Trophy, ink: t.litInk },
  published: { icon: ImageIcon, ink: t.litInk },
  comment: { icon: MessageSquare, ink: t.text2 },
  reply: { icon: MessageSquare, ink: t.text2 },
  like: { icon: Heart, ink: t.text2 },
  follow: { icon: User, ink: t.text2 },
};

const NONE: ReadonlySet<ActivityKind> = new Set();

/* ── small shared pieces ── */

const mono = (px: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: DM_MONO,
  fontSize: px,
  lineHeight: "normal",
  ...extra,
});

const whoStyle: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 13,
  lineHeight: "normal",
  color: t.text2,
  overflowWrap: "anywhere",
};

const detailStyle: CSSProperties = mono(11, { color: t.label, marginTop: 3, overflowWrap: "anywhere" });

/** A mark-read that did not save: the rows are unread again, and this says so where they are. */
function WriteFailed({ failure }: { failure: PanelFailure }) {
  return (
    <ErrorState
      line="That didn't save."
      panel="Activity"
      onRetry={failure.onRetry}
      error={failure.error}
      style={{ paddingTop: 14 }}
      data-testid="activity-write-error"
    />
  );
}

/** A day's heading before its rows have arrived: the eyebrow's own line. */
function DayHeadingSkeleton() {
  return <Skeleton width={84} height={13} />;
}

/** An activity row before it has arrived: the desktop row's grid and 64px of content in its own padding. */
function DesktopRowSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "14px 38px minmax(0, 1fr) 76px 40px",
        gap: 12,
        alignItems: "center",
        minHeight: 64,
        padding: "6px 12px",
        boxSizing: "content-box",
        borderRadius: 14,
      }}
    >
      <Skeleton width={10} height={7} radius={r.full} />
      <Skeleton width={34} height={34} radius="50%" />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <Skeleton width="62%" height={17} />
        <Skeleton width="38%" height={11} />
      </div>
      <Skeleton width={76} height={46} radius={9} />
      <Skeleton width={26} height={10} style={{ justifySelf: "end" }} />
    </div>
  );
}

/** The phone's row before it has arrived: 77px with its hairline. */
function PhoneRowSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "38px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 10px",
        borderRadius: 14,
        borderBottom: `1px solid ${t.hairline}`,
        boxSizing: "border-box",
        height: 77,
      }}
    >
      <Skeleton width={36} height={36} radius="50%" />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <Skeleton width="48%" height={13} />
        <Skeleton width="66%" height={19} />
        <Skeleton width="36%" height={11} />
      </div>
      <Skeleton width={24} height={10} />
    </div>
  );
}

/** Today's three rows and yesterday's four, as the board draws them. */
const DESKTOP_LOADING_DAYS = [3, 4] as const;
const PHONE_LOADING_ROWS = 3;

/** The actor, with the kind's badge on their shoulder. Hidden from assistive tech: the row's words name both. */
function Who({ row, size }: { row: ActivityRow; size: 34 | 36 }) {
  const kind = row.kind ? KIND[row.kind] : null;
  const Icon = kind?.icon;
  return (
    <div aria-hidden="true" style={{ position: "relative" }}>
      <Avatar size={size} userId={row.actor.id} name={row.actor.name} hue={row.actor.hue} src={row.actor.avatarUrl} />
      {kind && Icon ? (
        <span
          data-testid="activity-badge"
          data-kind={row.kind}
          style={{
            position: "absolute",
            right: -4,
            bottom: -4,
            width: 20,
            height: 20,
            boxSizing: "content-box",
            borderRadius: 7,
            background: t.solid,
            border: `1px solid ${t.glassBorder}`,
            color: kind.ink,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={12} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
        </span>
      ) : null}
    </div>
  );
}

/** The build's thumbnail: its signed cover, or the fallback landscape; an empty track when there is no build. */
function Thumb({ row }: { row: ActivityRow }) {
  if (!row.cover) return <div />;
  return (
    <div style={{ width: 76, height: 46, borderRadius: 9, overflow: "hidden" }}>
      {row.cover.src ? (
        <img
          src={row.cover.src}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <CoverFallback seed={row.cover.seed} radius={9} sky={row.cover.sky} />
      )}
    </div>
  );
}

function When({ row, now, style }: { row: ActivityRow; now: number; style?: CSSProperties }) {
  return (
    <time dateTime={row.at} style={mono(10, { color: t.label, ...style })}>
      {shortAgo(row.at, now)}
    </time>
  );
}

/** A row that leads somewhere is one link to it, and following it reads it; a row that leads nowhere is still. */
function RowFrame({
  row,
  onOpen,
  style,
  children,
}: {
  row: ActivityRow;
  onOpen: (row: ActivityRow) => void;
  style: CSSProperties;
  children: ReactNode;
}) {
  const marks = {
    "data-testid": "activity-row",
    "data-kind": row.kind ?? "other",
    "data-unread": row.unread ? "true" : undefined,
  };
  const paint: CSSProperties = { ...style, background: row.unread ? t.rowHighlight : "transparent", color: "inherit" };
  if (!row.href) {
    return (
      <div {...marks} style={paint}>
        {children}
      </div>
    );
  }
  return (
    <FrameLink {...marks} to={row.href} onClick={() => onOpen(row)} style={paint} hoverStyle={{ background: t.rowHighlight }}>
      {children}
    </FrameLink>
  );
}

/* ── the list ── */

function DesktopRow({ row, now, onOpen }: { row: ActivityRow; now: number; onOpen: (row: ActivityRow) => void }) {
  return (
    <RowFrame
      row={row}
      onOpen={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "14px 38px minmax(0, 1fr) 76px 40px",
        gap: 12,
        alignItems: "center",
        minHeight: 64,
        padding: "6px 12px",
        boxSizing: "content-box",
        borderRadius: 14,
      }}
    >
      {row.unread ? <LampDot /> : <span />}
      <Who row={row} size={34} />
      <div style={{ minWidth: 0 }}>
        {/* The board keeps the title span and the detail line when they are empty: they set a follow row's height. */}
        <div style={whoStyle}>
          {row.who}{" "}
          <span style={{ ...display(17), letterSpacing: "normal", lineHeight: "normal", color: t.text }}>{row.title}</span>
        </div>
        <div style={detailStyle}>{row.detail}</div>
      </div>
      <Thumb row={row} />
      <When row={row} now={now} style={{ textAlign: "right" }} />
    </RowFrame>
  );
}

function PhoneRow({ row, now, onOpen }: { row: ActivityRow; now: number; onOpen: (row: ActivityRow) => void }) {
  return (
    <RowFrame
      row={row}
      onOpen={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "38px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 10px",
        borderRadius: 14,
        borderBottom: `1px solid ${t.hairline}`,
      }}
    >
      <Who row={row} size={36} />
      <div style={{ minWidth: 0 }}>
        <div style={whoStyle}>{row.who}</div>
        {row.title ? (
          <div style={{ ...display(19), letterSpacing: "-0.01em", lineHeight: 1.1, color: t.text }}>{row.title}</div>
        ) : null}
        {row.detail ? <div style={detailStyle}>{row.detail}</div> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <When row={row} now={now} />
        {row.unread ? <LampDot /> : null}
      </div>
    </RowFrame>
  );
}

/** A day's eyebrow, as the heading of its rows. */
function DayHeading({ day }: { day: string }) {
  return (
    <Eyebrow as="h2" style={{ margin: 0 }}>
      {day}
    </Eyebrow>
  );
}

function NoneOfThese({ hasMore }: { hasMore: boolean }) {
  return (
    <p style={{ margin: "14px 4px 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "normal", color: t.text2 }}>
      None of these among the latest.{hasMore ? " Show more to look further back." : ""}
    </p>
  );
}

function MoreButton({ list, phone }: { list: ActivityListProps; phone: boolean }) {
  if (!list.hasMore) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: phone ? 0 : 10 }}>
      <Button variant="secondary" size={phone ? 44 : 34} fontSize={phone ? 13 : 12} disabled={list.loadingMore} onClick={list.onMore}>
        {list.loadingMore ? "Loading…" : "Show more"}
      </Button>
    </div>
  );
}

function DesktopList({
  list,
  chosen,
  now,
  onOpen,
}: {
  list: ActivityListProps;
  chosen: ReadonlySet<ActivityKind>;
  now: number;
  onOpen: (row: ActivityRow) => void;
}) {
  if (list.status === "loading") {
    return (
      <LoadingRegion what="your activity" data-testid="activity-loading">
        {DESKTOP_LOADING_DAYS.map((rows, day) => (
          <div key={day}>
            <div style={{ padding: "14px 4px 6px" }}>
              <DayHeadingSkeleton />
            </div>
            {Array.from({ length: rows }, (_, i) => (
              <DesktopRowSkeleton key={i} />
            ))}
          </div>
        ))}
      </LoadingRegion>
    );
  }
  if (list.status === "error") {
    return <ErrorState panel="Your activity" onRetry={list.onRetry} error={list.error} style={{ paddingTop: 14 }} data-testid="activity-error" />;
  }
  if (list.groups.length === 0) return <EmptyState line="All caught up." data-testid="activity-empty" />;

  const groups = filterGroups(list.groups, chosen);
  return (
    <div data-testid="activity-list">
      {groups.map((group) => (
        <div key={group.day} data-testid="activity-day">
          <div style={{ padding: "14px 4px 6px" }}>
            <DayHeading day={group.day} />
          </div>
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {group.rows.map((row) => (
              <li key={row.id}>
                <DesktopRow row={row} now={now} onOpen={onOpen} />
              </li>
            ))}
          </ol>
        </div>
      ))}
      {groups.length === 0 ? <NoneOfThese hasMore={list.hasMore} /> : null}
      <MoreButton list={list} phone={false} />
    </div>
  );
}

function PhoneList({
  list,
  chosen,
  now,
  onOpen,
}: {
  list: ActivityListProps;
  chosen: ReadonlySet<ActivityKind>;
  now: number;
  onOpen: (row: ActivityRow) => void;
}) {
  if (list.status === "loading") {
    return (
      <Panel padding="14px 8px">
        <LoadingRegion what="your activity" data-testid="activity-loading">
          <DayHeadingSkeleton />
          <div style={{ marginTop: 6 }}>
            {Array.from({ length: PHONE_LOADING_ROWS }, (_, i) => (
              <PhoneRowSkeleton key={i} />
            ))}
          </div>
        </LoadingRegion>
      </Panel>
    );
  }
  if (list.status === "error") {
    return (
      <Panel padding="14px 16px">
        <ErrorState panel="Your activity" onRetry={list.onRetry} error={list.error} data-testid="activity-error" />
      </Panel>
    );
  }
  if (list.groups.length === 0) {
    return (
      <Panel padding="0 16px">
        <EmptyState line="All caught up." data-testid="activity-empty" />
      </Panel>
    );
  }

  const groups = filterGroups(list.groups, chosen);
  return (
    <>
      {groups.map((group) => (
        <Panel key={group.day} padding="14px 8px">
          <div data-testid="activity-day">
            <DayHeading day={group.day} />
            <ol style={{ listStyle: "none", margin: "6px 0 0", padding: 0 }}>
              {group.rows.map((row) => (
                <li key={row.id}>
                  <PhoneRow row={row} now={now} onOpen={onOpen} />
                </li>
              ))}
            </ol>
          </div>
        </Panel>
      ))}
      {groups.length === 0 ? (
        <Panel padding="0 16px 14px">
          <NoneOfThese hasMore={list.hasMore} />
        </Panel>
      ) : null}
      <MoreButton list={list} phone />
    </>
  );
}

/* ── the right column ── */

function Orbs({ peopleThisWeek, peopleError, live }: { peopleThisWeek: number | null; peopleError?: PanelFailure; live: boolean }) {
  const row: CSSProperties = { display: "flex", gap: 12, justifyContent: "center", alignItems: "center", height: "100%" };
  const people =
    peopleThisWeek !== null ? (
      <OrbSolid
        size={140}
        top="This week"
        value={peopleThisWeek.toLocaleString("en-GB")}
        bottom={peopleThisWeek === 1 ? "person ran your builds" : "people ran your builds"}
      />
    ) : peopleError ? (
      <div style={{ width: 140, display: "flex", justifyContent: "center" }}>
        <ErrorState panel="People this week" onRetry={peopleError.onRetry} error={peopleError.error} data-testid="activity-orbs-error" />
      </div>
    ) : (
      <Skeleton width={140} height={140} radius="50%" />
    );
  const content = (
    <>
      {people}
      <OrbGlass size={140} label={live ? "Listening" : "Reconnecting"} sub={live ? "live" : "offline"} />
    </>
  );
  return peopleThisWeek === null && !peopleError ? (
    <LoadingRegion what="the people who ran your builds" data-testid="activity-orbs" style={row}>
      {content}
    </LoadingRegion>
  ) : (
    <div data-testid="activity-orbs" style={row}>
      {content}
    </div>
  );
}

function RunsChart({ runs }: { runs: ActivityLoad<ActivityRuns> }) {
  const marker = runs.status === "ready" ? runs.data.markerIndex : null;
  return (
    <>
      <PanelHead title="Runs of your builds" subtitle={chartSubtitle(marker)} titleSize={13} headingLevel={2} />
      <div data-testid="activity-runs" style={{ marginTop: 10 }}>
        {runs.status === "loading" ? (
          <LoadingRegion what="the runs chart" data-testid="activity-runs-loading">
            <Skeleton width={360} height={120} />
          </LoadingRegion>
        ) : runs.status === "error" ? (
          <ErrorState panel="Runs of your builds" onRetry={runs.onRetry} error={runs.error} data-testid="activity-runs-error" />
        ) : (
          <LineChart width={360} height={120} values={runs.data.values} markerIndex={runs.data.markerIndex} label={runs.data.label} />
        )}
      </div>
    </>
  );
}

function KindToggle({
  kind,
  count,
  on,
  onToggle,
}: {
  kind: ActivityKind;
  /** Of the loaded rows. Null while the list loads (a bone says it, not a zero), undefined when it could not be read (nothing does). */
  count: number | null | undefined;
  on: boolean;
  onToggle: () => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={on}
      data-testid="activity-kind"
      data-kind={kind}
      onClick={onToggle}
      {...handlers}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        height: 32,
        boxSizing: "content-box",
        margin: 0,
        padding: 0,
        borderWidth: "0 0 1px 0",
        borderStyle: "solid",
        borderColor: t.hairline,
        background: on ? t.tab : state.hovered ? t.rowHighlight : "transparent",
        color: t.text,
        cursor: "pointer",
        textAlign: "left",
        ...ring(state.focusVisible),
      }}
    >
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: KIND[kind].ink, flexShrink: 0 }} />
      <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "normal", fontWeight: on ? 600 : 400, color: t.text, flexGrow: 1 }}>
        {kind}
      </span>
      {count === null ? (
        <Skeleton width={16} height={11} />
      ) : count === undefined ? null : (
        <span style={mono(11, { color: t.label })}>{count.toLocaleString("en-GB")}</span>
      )}
    </button>
  );
}

function ShowMe({
  kindCounts,
  listStatus,
  chosen,
  onToggle,
}: {
  kindCounts: KindCounts;
  listStatus: ActivityListProps["status"];
  chosen: ReadonlySet<ActivityKind>;
  onToggle: (kind: ActivityKind) => void;
}) {
  return (
    <>
      <PanelHead title="Show me" titleSize={14} headingLevel={2} />
      <div role="group" aria-label="Show me" style={{ marginTop: 6 }}>
        {ACTIVITY_KINDS.map((kind) => (
          <KindToggle
            key={kind}
            kind={kind}
            count={listStatus === "ready" ? kindCounts[kind] : listStatus === "loading" ? null : undefined}
            on={chosen.has(kind)}
            onToggle={() => onToggle(kind)}
          />
        ))}
      </div>
    </>
  );
}

/* ── the two layouts ── */

/** The orbs' and the chart's share of the board, so the filter panel keeps its height when the list grows past it. */
const SHOW_ME_MIN = BOARD_GRID_HEIGHT - 180 - 190 - 12 * 2;

function DesktopActivity(props: ActivityViewProps) {
  const { fit = "content", now, list, unread, live, kindCounts, peopleThisWeek, peopleError, runs, writeError, onOpen, onMarkAllRead } = props;
  const [chosen, setChosen] = useState<ReadonlySet<ActivityKind>>(NONE);
  const board = fit === "board";

  return (
    <div
      data-testid="activity-view"
      data-viewport="desktop"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 400px",
        gridTemplateRows: board ? "minmax(0, 1fr)" : undefined,
        gap: 12,
        lineHeight: "normal",
        ...boardHeight(fit),
      }}
    >
      <div style={{ display: "flex", minHeight: 0, minWidth: 0 }}>
        <Panel padding="14px 16px" style={{ flex: 1 }}>
          <PanelHead
            title="Activity"
            subtitle={unread === null ? " " : unreadLine(unread, live)}
            headingLevel={1}
            right={
              <Button
                variant="ghost"
                size={30}
                fontSize={12}
                icon={Check}
                data-testid="activity-mark-all"
                disabled={!unread}
                onClick={onMarkAllRead}
              >
                Mark all read
              </Button>
            }
          />
          {writeError ? <WriteFailed failure={writeError} /> : null}
          <DesktopList list={list} chosen={chosen} now={now} onOpen={onOpen} />
        </Panel>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0, alignSelf: board ? undefined : "start" }}>
        <div style={{ height: 180, flexShrink: 0 }}>
          <Panel padding="12px" style={{ height: "100%" }}>
            <Orbs peopleThisWeek={peopleThisWeek} peopleError={peopleError} live={live} />
          </Panel>
        </div>
        <div style={{ height: 190, flexShrink: 0 }}>
          <Panel padding="14px 16px" style={{ height: "100%" }}>
            <RunsChart runs={runs} />
          </Panel>
        </div>
        <div style={{ display: "flex", flexGrow: 1, minHeight: board ? 0 : SHOW_ME_MIN }}>
          <Panel padding="14px 16px" style={{ flex: 1 }}>
            <ShowMe
              kindCounts={kindCounts}
              listStatus={list.status}
              chosen={chosen}
              onToggle={(kind) => setChosen((current) => toggleKind(current, kind))}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PhoneActivity(props: ActivityViewProps) {
  const { now, list, unread, kindCounts, writeError, onOpen, onMarkAllRead } = props;
  const [chosen, setChosen] = useState<ReadonlySet<ActivityKind>>(NONE);

  return (
    <div data-testid="activity-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 12, lineHeight: "normal" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <PageHeading eyebrow="Activity" title={unread === null ? "Activity" : unreadHeading(unread)} size={34} />
        {unread ? (
          <Button variant="ghost" size={44} fontSize={13} icon={Check} data-testid="activity-mark-all" onClick={onMarkAllRead}>
            Mark all read
          </Button>
        ) : null}
      </div>

      <ScrollRow gap={6} label="Show">
        <FilterChip label="All" on={chosen.size === 0} onClick={() => setChosen(NONE)} />
        {PHONE_CHIPS.map(({ kind, label }) => (
          <FilterChip
            key={kind}
            label={label}
            count={list.status === "ready" ? kindCounts[kind].toLocaleString("en-GB") : undefined}
            on={chosen.has(kind)}
            onClick={() => setChosen((current) => toggleKind(current, kind))}
          />
        ))}
      </ScrollRow>

      {writeError ? (
        <Panel padding="14px 16px">
          <WriteFailed failure={writeError} />
        </Panel>
      ) : null}
      <PhoneList list={list} chosen={chosen} now={now} onOpen={onOpen} />
    </div>
  );
}

export function ActivityView(props: ActivityViewProps) {
  const phone = useIsPhone();
  return phone ? <PhoneActivity {...props} /> : <DesktopActivity {...props} />;
}

export default ActivityView;

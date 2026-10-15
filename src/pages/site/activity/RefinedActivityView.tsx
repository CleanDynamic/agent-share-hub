/* UI-P92 — Activity in the refined look, as `design/reference/refined/{dusk,noon}/activity.html` draws it.

   A FORK, NOT AN EDIT. `ActivityView` stays the current look; this is the same page with the same props (imported from
   it, not copied), the same data, handlers, copy, accessible names and order of parts. `ActivityPage` and the dev page
   choose between the two with `useLook()`.

   DESKTOP: the frame draws the breadcrumb; this is a wrapping row, gap 48 — the list (`flex: 999 1 560px`, gap 32:
   the head, then one hairlined group per day) and the aside (`flex: 1 1 300px`, max 340, a hairline on its left, gap
   24: the people this week beside Listening, the runs chart, Show me). No panels: the frame's one surface is the
   ground, and parts are told apart by hairlines.

   PHONE: today's order — the heading with Mark all read, the kind chips, then the days — in refined rows.

   ONE KIND, ONE INK. Each kind's tone is spent on its badge (an 8×8 square on the avatar's shoulder) and its square in
   Show me, and nowhere else. Unread is the lamp bar before the row and the line in `--text`, never a fill.

   THE ROW IS ONE LINK, as today: the build's title is drawn as the board draws its link (500, `--text`) inside it, not
   as a second link nested in the first. */

import { useState, type CSSProperties, type ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { CardHead } from "@/components/brand/CardHead";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { Figure } from "@/components/brand/Figure";
import { FilterChip } from "@/components/brand/FilterChip";
import { FramedWork } from "@/components/brand/FramedWork";
import { LampBar } from "@/components/brand/LampDot";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useRoom } from "@/components/brand/useRoom";
import { FrameLink } from "@/components/shell/FrameLink";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { BETWEEN, useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { asideStyle, mainStyle, trackRow } from "@/lib/theme/refinedLayout";
import { shortAgo } from "@/pages/site/home/homeModel";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { CONTROL_HOVER, SELECTED } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { ActivityListProps, ActivityLoad, ActivityRuns, ActivityViewProps } from "./ActivityView";
import {
  ACTIVITY_KINDS,
  PHONE_CHIPS,
  chartSubtitle,
  filterGroups,
  toggleKind,
  unreadHeading,
  unreadLine,
  type ActivityKind,
  type ActivityRow,
  type KindCounts,
} from "./activityModel";

/* ── the kinds ── */

const TONE: Record<ActivityKind, string> = {
  reproduced: t.evidence,
  rebuilt: t.catAgents,
  solution: t.action,
  solved: t.litInk,
  published: t.litInk,
  comment: t.text2,
  reply: t.text2,
  like: t.text2,
  follow: t.text2,
};

const NONE: ReadonlySet<ActivityKind> = new Set();

/* ── type ── */

const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
  ...extra,
});

const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** A part of the aside: its rows, and a hairline under it when another follows. */
const asidePart = (gap: number, last: boolean): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap,
  minWidth: 0,
  ...(last ? null : { paddingBottom: 24, borderBottom: `1px solid ${t.hairline}` }),
});

/* ── small shared pieces ── */

/** A mark-read that did not save: the rows are unread again, and this says so where they are. */
function WriteFailed({ failure }: { failure: PanelFailure }) {
  return (
    <ErrorState
      line="That didn't save."
      panel="Activity"
      onRetry={failure.onRetry}
      error={failure.error}
      data-testid="activity-write-error"
    />
  );
}

/** The actor, with the kind's square on their shoulder. Hidden from assistive tech: the row's words name both. */
function Who({ row }: { row: ActivityRow }) {
  return (
    <span aria-hidden="true" style={{ position: "relative", display: "inline-flex" }}>
      <Avatar size={28} userId={row.actor.id} name={row.actor.name} hue={row.actor.hue} src={row.actor.avatarUrl} />
      {row.kind ? (
        <span
          data-testid="activity-badge"
          data-kind={row.kind}
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 8,
            height: 8,
            borderRadius: 2,
            background: TONE[row.kind],
            boxShadow: `0 0 0 2px ${t.surface}`,
          }}
        />
      ) : null}
    </span>
  );
}

/** The build's thumbnail, framed: its signed cover, or the fallback sketch; an empty track when there is no build. */
function Thumb({ row }: { row: ActivityRow }) {
  if (!row.cover) return <span />;
  return (
    <FramedWork width={48} height={32}>
      {row.cover.src ? (
        <img
          src={row.cover.src}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <CoverFallback seed={row.cover.seed} radius={2} sky={row.cover.sky} />
      )}
    </FramedWork>
  );
}

function When({ row, now, style }: { row: ActivityRow; now: number; style?: CSSProperties }) {
  return (
    <time dateTime={row.at} style={text(11.5, 400, t.label, { ...tnum, ...style })}>
      {shortAgo(row.at, now)}
    </time>
  );
}

/** Who did what, then the build's title as the board draws its link. */
function Line({ row }: { row: ActivityRow }) {
  return (
    <span style={text(13, 400, row.unread ? t.text : t.text2, { overflowWrap: "anywhere" })}>
      {row.who}
      {row.title ? (
        <>
          {" "}
          <span style={{ fontWeight: 500, color: t.text }}>{row.title}</span>
        </>
      ) : null}
    </span>
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
  const paint: CSSProperties = { ...style, color: "inherit" };
  if (!row.href) {
    return (
      <div {...marks} style={paint}>
        {children}
      </div>
    );
  }
  return (
    <FrameLink {...marks} to={row.href} onClick={() => onOpen(row)} style={paint}>
      {children}
    </FrameLink>
  );
}

/* ── the list ── */

const DESKTOP_COLUMNS = "8px 28px minmax(0, 1fr) 48px 32px";

const desktopRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: DESKTOP_COLUMNS,
  alignItems: "center",
  gap: 12,
  minHeight: 56,
  boxSizing: "border-box",
  borderBottom: `1px solid ${t.hairline}`,
};

const phoneRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "28px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 12,
  minHeight: 56,
  padding: "12px 0",
  boxSizing: "border-box",
  borderBottom: `1px solid ${t.hairline}`,
};

function DesktopRow({ row, now, onOpen }: { row: ActivityRow; now: number; onOpen: (row: ActivityRow) => void }) {
  return (
    <RowFrame row={row} onOpen={onOpen} style={desktopRow}>
      {row.unread ? <LampBar /> : <span style={{ width: 8 }} />}
      <Who row={row} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, padding: "8px 0" }}>
        <Line row={row} />
        {row.detail ? <span style={text(12.5, 400, t.text2, { overflowWrap: "anywhere" })}>{row.detail}</span> : null}
      </div>
      <Thumb row={row} />
      <When row={row} now={now} style={{ textAlign: "right" }} />
    </RowFrame>
  );
}

function PhoneRow({ row, now, onOpen }: { row: ActivityRow; now: number; onOpen: (row: ActivityRow) => void }) {
  return (
    <RowFrame row={row} onOpen={onOpen} style={phoneRow}>
      <Who row={row} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <Line row={row} />
        {row.detail ? <span style={text(12, 400, t.text2, { overflowWrap: "anywhere" })}>{row.detail}</span> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <When row={row} now={now} />
        {row.unread ? <LampBar /> : null}
      </div>
    </RowFrame>
  );
}

/** A day's eyebrow over a hairline, as the heading of its rows. */
function DayHeading({ day }: { day: ReactNode }) {
  return (
    <Eyebrow as="h2" style={{ margin: 0, paddingBottom: 8, borderBottom: `1px solid ${t.hairline}` }}>
      {day}
    </Eyebrow>
  );
}

function RowSkeleton({ phone }: { phone: boolean }) {
  if (phone) {
    return (
      <div style={phoneRow}>
        <Skeleton width={28} height={28} radius="50%" />
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <Skeleton width="66%" height={13} />
          <Skeleton width="40%" height={11} />
        </div>
        <Skeleton width={20} height={10} />
      </div>
    );
  }
  return (
    <div style={desktopRow}>
      <span />
      <Skeleton width={28} height={28} radius="50%" />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <Skeleton width="62%" height={13} />
        <Skeleton width="38%" height={11} />
      </div>
      <Skeleton width={48} height={32} radius={4} />
      <Skeleton width={22} height={10} style={{ justifySelf: "end" }} />
    </div>
  );
}

/** Today's three rows and yesterday's four, as the board draws them; the phone shows the first three. */
const LOADING_DAYS = [3, 4] as const;
const PHONE_LOADING_ROWS = 3;

function NoneOfThese({ hasMore }: { hasMore: boolean }) {
  return (
    <p style={text(12, 400, t.text2, { margin: 0 })}>
      None of these among the latest.{hasMore ? " Show more to look further back." : ""}
    </p>
  );
}

function MoreButton({ list, phone }: { list: ActivityListProps; phone: boolean }) {
  if (!list.hasMore) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Button variant="secondary" size={phone ? 44 : 32} fontSize={13} disabled={list.loadingMore} onClick={list.onMore}>
        {list.loadingMore ? "Loading…" : "Show more"}
      </Button>
    </div>
  );
}

function ActivityList({
  list,
  chosen,
  now,
  phone,
  onOpen,
}: {
  list: ActivityListProps;
  chosen: ReadonlySet<ActivityKind>;
  now: number;
  phone: boolean;
  onOpen: (row: ActivityRow) => void;
}) {
  const column: CSSProperties = { display: "flex", flexDirection: "column", gap: phone ? 24 : 32, minWidth: 0 };
  const day: CSSProperties = { display: "flex", flexDirection: "column" };

  if (list.status === "loading") {
    const days = phone ? [PHONE_LOADING_ROWS] : LOADING_DAYS;
    return (
      <LoadingRegion what="your activity" data-testid="activity-loading" style={column}>
        {days.map((rows, index) => (
          <div key={index} style={day}>
            <div style={{ paddingBottom: 8, borderBottom: `1px solid ${t.hairline}` }}>
              <Skeleton width={72} height={11} />
            </div>
            {Array.from({ length: rows }, (_, i) => (
              <RowSkeleton key={i} phone={phone} />
            ))}
          </div>
        ))}
      </LoadingRegion>
    );
  }
  if (list.status === "error") {
    return <ErrorState panel="Your activity" onRetry={list.onRetry} error={list.error} data-testid="activity-error" />;
  }
  if (list.groups.length === 0) return <EmptyState line="All caught up." data-testid="activity-empty" />;

  const Row = phone ? PhoneRow : DesktopRow;
  const groups = filterGroups(list.groups, chosen);
  return (
    <div data-testid="activity-list" style={column}>
      {groups.map((group) => (
        <section key={group.day} data-testid="activity-day" style={day}>
          <DayHeading day={group.day} />
          <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {group.rows.map((row) => (
              <li key={row.id}>
                <Row row={row} now={now} onOpen={onOpen} />
              </li>
            ))}
          </ol>
        </section>
      ))}
      {groups.length === 0 ? <NoneOfThese hasMore={list.hasMore} /> : null}
      <MoreButton list={list} phone={phone} />
    </div>
  );
}

/* ── the aside ── */

function People({ peopleThisWeek, peopleError, live }: { peopleThisWeek: number | null; peopleError?: PanelFailure; live: boolean }) {
  const grid: CSSProperties = { ...asidePart(0, false), display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 };
  const people =
    peopleThisWeek !== null ? (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <span style={text(12, 400, t.text2)}>This week</span>
        <Figure value={peopleThisWeek.toLocaleString("en-GB")} />
        <span style={text(12, 400, t.text2)}>{peopleThisWeek === 1 ? "person ran your builds" : "people ran your builds"}</span>
      </div>
    ) : peopleError ? (
      <ErrorState panel="People this week" onRetry={peopleError.onRetry} error={peopleError.error} data-testid="activity-orbs-error" />
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton width="60%" height={12} />
        <Skeleton width={40} height={26} />
        <Skeleton width="90%" height={12} />
      </div>
    );
  const listening = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <span style={text(12, 400, t.text2, { display: "inline-flex", alignItems: "center", gap: 8 })}>
        {live ? <LampBar /> : null}
        {live ? "Listening" : "Reconnecting"}
      </span>
      <span style={text(13, 500, t.text)}>{live ? "live" : "offline"}</span>
    </div>
  );
  const content = (
    <>
      {people}
      {listening}
    </>
  );
  return peopleThisWeek === null && !peopleError ? (
    <LoadingRegion what="the people who ran your builds" data-testid="activity-orbs" style={grid}>
      {content}
    </LoadingRegion>
  ) : (
    <section aria-label="People this week" data-testid="activity-orbs" style={grid}>
      {content}
    </section>
  );
}

/** The chart's drawing box; it stretches to the aside's width, the strokes keep their weight. */
const CHART_W = 300;
const CHART_H = 120;
const GRID_YS = [24, 60, 96] as const;
const LINE_TOP = 12;
const LINE_BOTTOM = 12;

const f = (n: number) => Math.round(n * 10) / 10;

/** Runs per day as the board draws them: the line in `--evidence` over a flat area, the rebuild as a dashed `--lit-ink` line with a ringed dot. */
function RunsLine({ runs }: { runs: ActivityRuns }) {
  const areaAlpha = useRoom() === "dusk" ? 0.07 : 0.08;
  const { values, markerIndex, label } = runs;
  const n = values.length;
  const x = (i: number) => (n > 1 ? (i * CHART_W) / (n - 1) : 0);
  const y = (v: number) => CHART_H - LINE_BOTTOM - Math.min(Math.max(v, 0), 1) * (CHART_H - LINE_TOP - LINE_BOTTOM);
  const points = values.map((v, i) => `${f(x(i))},${f(y(v))}`).join(" ");
  const marked = markerIndex !== null && Number.isFinite(markerIndex) && n > 0;
  const marker = marked ? Math.min(Math.max(Math.round(markerIndex), 0), n - 1) : 0;
  const mx = x(marker);
  const my = n > 0 ? y(values[marker]) : 0;

  return (
    <div style={{ position: "relative" }}>
      <svg
        data-ui="chart-line"
        role="img"
        aria-label={label}
        width="100%"
        height={CHART_H}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        {GRID_YS.map((gy) => (
          <line key={gy} x1={0} x2={CHART_W} y1={gy} y2={gy} stroke={t.hairline} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        ))}
        {n > 0 ? (
          <>
            <polygon points={`${points} ${CHART_W},${CHART_H} 0,${CHART_H}`} fill={t.evidence} fillOpacity={areaAlpha} />
            <polyline points={points} fill="none" stroke={t.evidence} strokeWidth={1.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>
        ) : null}
        {marked ? (
          <line
            data-testid="activity-runs-marker"
            x1={f(mx)}
            x2={f(mx)}
            y1={0}
            y2={CHART_H}
            stroke={t.litInk}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {marked ? (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `calc(${f((mx / CHART_W) * 100)}% - 4px)`,
            top: f(my - 4),
            width: 8,
            height: 8,
            boxSizing: "border-box",
            borderRadius: "50%",
            background: t.surface,
            border: `1.5px solid ${t.litInk}`,
          }}
        />
      ) : null}
    </div>
  );
}

function RunsChart({ runs }: { runs: ActivityLoad<ActivityRuns> }) {
  const marker = runs.status === "ready" ? runs.data.markerIndex : null;
  return (
    <section style={asidePart(16, false)}>
      <CardHead title="Runs of your builds" subtitle={chartSubtitle(marker)} headingLevel={2} />
      <div data-testid="activity-runs">
        {runs.status === "loading" ? (
          <LoadingRegion what="the runs chart" data-testid="activity-runs-loading">
            <Skeleton width="100%" height={CHART_H} />
          </LoadingRegion>
        ) : runs.status === "error" ? (
          <ErrorState panel="Runs of your builds" onRetry={runs.onRetry} error={runs.error} data-testid="activity-runs-error" />
        ) : (
          <RunsLine runs={runs.data} />
        )}
      </div>
    </section>
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
        gap: 8,
        height: 32,
        boxSizing: "border-box",
        margin: "0 -8px",
        padding: "0 8px",
        borderRadius: 6,
        border: "1px solid transparent",
        background: "transparent",
        ...(state.hovered ? CONTROL_HOVER : null),
        ...(on ? SELECTED : null),
        ...text(12.5, on ? 500 : 400, on ? t.text : t.text2),
        cursor: "pointer",
        textAlign: "left",
        ...ring(state.focusVisible),
      }}
    >
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: TONE[kind], flexShrink: 0 }} />
      <span style={{ flexGrow: 1 }}>{kind}</span>
      {count === null ? (
        <Skeleton width={16} height={11} />
      ) : count === undefined ? null : (
        <span style={text(12, 400, t.label, tnum)}>{count.toLocaleString("en-GB")}</span>
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
    <section style={asidePart(8, true)}>
      <CardHead title="Show me" headingLevel={2} />
      <div role="group" aria-label="Show me" style={{ display: "flex", flexDirection: "column" }}>
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
    </section>
  );
}

/* ── the two layouts ── */

function DesktopActivity(props: ActivityViewProps) {
  const { now, list, unread, live, kindCounts, peopleThisWeek, peopleError, runs, writeError, onOpen, onMarkAllRead } = props;
  const [chosen, setChosen] = useState<ReadonlySet<ActivityKind>>(NONE);
  const stacked = !useMinWidth(BETWEEN.stack);

  return (
    <div
      data-testid="activity-view"
      data-viewport="desktop"
      data-look="refined"
      style={trackRow(stacked, 48)}
    >
      <section aria-labelledby="activity-heading" style={mainStyle(stacked, { flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 32 })}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flexGrow: 1, minWidth: 0 }}>
            <h1 id="activity-heading" style={text(20, 500, t.text, { margin: 0, letterSpacing: "-0.015em" })}>
              Activity
            </h1>
            <p style={text(12, 400, t.text2, { margin: 0, display: "flex", alignItems: "center", gap: 8, minHeight: 15 })}>
              {unread === null ? null : (
                <>
                  {unreadLine(unread, live)}
                  {live ? <LampBar /> : null}
                </>
              )}
            </p>
          </div>
          <Button variant="secondary" size={28} fontSize={12} data-testid="activity-mark-all" disabled={!unread} onClick={onMarkAllRead}>
            Mark all read
          </Button>
        </div>
        {writeError ? <WriteFailed failure={writeError} /> : null}
        <ActivityList list={list} chosen={chosen} now={now} phone={false} onOpen={onOpen} />
      </section>

      <aside
        style={asideStyle(stacked, {
          flex: "1 0 300px",
          maxWidth: 340,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          paddingLeft: 32,
          borderLeft: `1px solid ${t.hairline}`,
        })}
      >
        <People peopleThisWeek={peopleThisWeek} peopleError={peopleError} live={live} />
        <RunsChart runs={runs} />
        <ShowMe
          kindCounts={kindCounts}
          listStatus={list.status}
          chosen={chosen}
          onToggle={(kind) => setChosen((current) => toggleKind(current, kind))}
        />
      </aside>
    </div>
  );
}

function PhoneActivity(props: ActivityViewProps) {
  const { now, list, unread, kindCounts, writeError, onOpen, onMarkAllRead } = props;
  const [chosen, setChosen] = useState<ReadonlySet<ActivityKind>>(NONE);

  return (
    <div
      data-testid="activity-view"
      data-viewport="mobile"
      data-look="refined"
      style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <Eyebrow>Activity</Eyebrow>
          <h1 style={text(20, 500, t.text, { margin: 0, letterSpacing: "-0.015em" })}>
            {unread === null ? "Activity" : unreadHeading(unread)}
          </h1>
        </div>
        {unread ? (
          <Button variant="secondary" size={44} fontSize={13} data-testid="activity-mark-all" onClick={onMarkAllRead}>
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

      {writeError ? <WriteFailed failure={writeError} /> : null}
      <ActivityList list={list} chosen={chosen} now={now} phone onOpen={onOpen} />
    </div>
  );
}

export function RefinedActivityView(props: ActivityViewProps) {
  const phone = useIsPhone();
  return phone ? <PhoneActivity {...props} /> : <DesktopActivity {...props} />;
}

export default RefinedActivityView;

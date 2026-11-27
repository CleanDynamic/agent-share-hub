/* Synth 12 Part C: Activity on the Synth draft pack.

   PANELS inside a 980 container, `minmax(0, 1fr) 340px`. The list panel: "Activity" as the h1 (20/600) with the live state
   beside it ("● live" in mono 13 Mint; "Reconnecting" in Warn while the channel is down), Mark all read (small secondary)
   at the right. The days are groups headed 13/500 Text 3: Today, Yesterday, This week, then dates. Each row is one link:
   the avatar at 40 with its kind's 10px square (radius 2, a 2px Panel ring) on the top right shoulder, the line ("@kit"
   15/600 Text, the words, the build or topic name 15/600 Text), and the age 13 Text 3. Unread: a 3px Mint bar at the
   left and the line in Text; read lines are in Text 2. Show more after 50.

   THE SIDE PANEL: "5 people this week" (the people in this week's rows, avatars 36 in a row) and "Show me", a switch per
   kind with its square. At 760 and below there is one panel, and Show me opens in a sheet from a "Show me" button in the
   head.

   Runs are not drawn: no "ran your build", no runs chart, no count of people who ran your builds. The page still reads
   them; the view leaves them out.

   THE ROW IS ONE LINK: the build's name inside it is type, not a second link. */

import { PageFailed, PageState, WriteFailed as MovedWriteFailed } from "@/components/pagestate/PageState";
import { readOf, type ReadLike } from "@/components/pagestate/pageStateModel";
import { useId, useState, type CSSProperties, type ReactNode } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { WaterField } from "@/components/brand/FluidField";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PHONE_ROW_STYLE, usePhoneRowLine } from "@/components/phone/phoneRow";
import { PHONE_DOCK, PHONE_PILL_ROW, PHONE_TOPBAR } from "@/components/shell/chromeSize";
import { PhonePills, type PhonePill } from "@/components/phone/PhonePills";
import type { PanelFailure } from "@/components/pagestate/PageState";
import { FrameLink } from "@/components/shell/FrameLink";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { PANEL_GAP } from "@/components/shell/pageGrid";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { Switch } from "@/components/ui/switch";
import { shortAgo } from "@/pages/site/home/homeModel";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import {
  ACTIVITY_KINDS,
  KIND_LABEL,
  filterGroups,
  kindShown,
  switchKind,
  unreadLine,
  type ActivityKind,
  type ActivityRow,
  type ActivitySquare,
  type KindCounts,
  type ActivityGroup,
} from "./activityModel";
import { type PageFit } from "@/components/shell/siteFrameFit";
import { SAVE_FAILED } from "@/lib/copy/copy";

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
  /** G4: the list's read, for PageState (failed, retrying, empty). Without it the status above stands in. */
  read?: ReadLike;
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
  /** Kept for the page; Synth 12 does not draw the run-based count. */
  peopleThisWeek?: number | null;
  peopleError?: PanelFailure;
  /** Kept for the page; Synth 12 does not draw the runs chart. */
  runs?: ActivityLoad<ActivityRuns>;
  peopleRead?: ReadLike;
  runsRead?: ReadLike;
  /** G9: every region failed, these being its reads: the page shows one failed state under its title. */
  pageFailed?: readonly ReadLike[];
  /**
   * A mark-read the server refused. The row and the count have already gone back to
   * unread (the page re-reads them), and the list says so in its own place with a way
   * to ask again: an optimistic action that fails rolls back with a line, not silence.
   */
  writeError?: PanelFailure;
  /** A row was followed: it marks itself read. */
  onOpen: (row: ActivityRow) => void;
  onMarkAllRead: () => void;
}

/* ── the kinds ── */

/** Each kind's square, as a token that holds both themes' colours. */
export const SQUARE: Record<ActivitySquare, string> = {
  rebuilt: t.kindRebuilt,
  comment: t.kindComment,
  reply: t.kindComment,
  like: t.kindLike,
  follow: t.kindFollow,
  published: t.kindPublished,
  topic: t.kindTopic,
};

const squareOf = (row: ActivityRow): ActivitySquare | null => row.square ?? (row.kind && row.kind !== "reproduced" ? row.kind : null);

const NONE: ReadonlySet<ActivityKind> = new Set();

/** The page's container. */
const CONTAINER = 980;

/* ── type ── */

const text = (px: 13 | 15 | 20, weight: 400 | 500 | 600, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: px === 20 ? "24px" : px === 15 ? "20px" : "16px",
  color,
  ...extra,
});

const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };

const panel: CSSProperties = { background: t.surface, borderRadius: 12, padding: "16px 0", boxSizing: "border-box", minWidth: 0 };
const PAD = 16;

/* ── small shared pieces ── */

/** A mark-read that did not save: the rows are unread again, and this says so where they are. */
function WriteFailed({ failure }: { failure: PanelFailure }) {
  return <MovedWriteFailed line={SAVE_FAILED} panel="Activity" onRetry={failure.onRetry} error={failure.error} data-testid="activity-write-error" />;
}

/** A kind's square: 10, radius 2, ringed in the Panel shade where it sits on an avatar. */
function Square({ square, ring = false, ringColour = t.surface, style }: { square: ActivitySquare; ring?: boolean; ringColour?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: SQUARE[square], flexShrink: 0, ...(ring ? { boxShadow: `0 0 0 2px ${ringColour}` } : null), ...style }}
    />
  );
}

/** The actor, with the kind's square on their top right shoulder. Hidden from assistive tech: the row's words name both. */
function Who({ row, phone = false }: { row: ActivityRow; phone?: boolean }) {
  /* 29f: on a phone the avatar stands alone: no kind square, and an unread row is marked by a dot at the row's edge. */
  const square = phone ? null : squareOf(row);
  return (
    <span aria-hidden="true" style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <Avatar size={40} userId={row.actor.id} name={row.actor.name} hue={row.actor.hue} src={row.actor.avatarUrl} phone={phone} />
      {square ? (
        <span data-testid="activity-badge" data-kind={row.kind ?? square} style={{ position: "absolute", right: -1, top: -1, display: "inline-flex" }}>
          <Square square={square} ring ringColour={phone ? t.bg : t.surface} />
        </span>
      ) : null}
    </span>
  );
}

/** Who did what, then the build's name, set as the line's other strong word. */
function Line({ row, phone = false }: { row: ActivityRow; phone?: boolean }) {
  const lead = row.actorLabel && row.who.startsWith(row.actorLabel) ? row.actorLabel : null;
  const words = lead ? row.who.slice(lead.length) : row.who;
  /* 29f: on a phone the person's name is 700 and the words around it are in Text. */
  return (
    <span style={text(15, 400, row.unread || phone ? t.text : t.text2, { overflowWrap: "anywhere" })}>
      {lead ? <span style={{ fontWeight: phone ? 700 : 600, color: t.text }}>{lead}</span> : null}
      {words}
      {row.title ? (
        <>
          {" "}
          <span style={{ fontWeight: 600, color: t.text }}>{row.title}</span>
        </>
      ) : null}
    </span>
  );
}

/** A row that leads somewhere is one link to it, and following it reads it; a row that leads nowhere is still. */
function RowFrame({ row, onOpen, style, children }: { row: ActivityRow; onOpen: (row: ActivityRow) => void; style: CSSProperties; children: ReactNode }) {
  const marks = {
    "data-testid": "activity-row",
    "data-kind": row.kind ?? "other",
    "data-unread": row.unread ? "true" : undefined,
  };
  const paint: CSSProperties = { ...style, color: "inherit", textDecoration: "none" };
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

const rowStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gridTemplateColumns: "40px minmax(0, 1fr)",
  alignItems: "start",
  gap: 12,
  minHeight: 64,
  padding: `12px ${PAD}px`,
  boxSizing: "border-box",
};

function Row({ row, now, onOpen, phone = false }: { row: ActivityRow; now: number; onOpen: (row: ActivityRow) => void; phone?: boolean }) {
  return (
    <RowFrame row={row} onOpen={onOpen} style={rowStyle}>
      {row.unread ? (
        phone ? (
          /* 29f: a 6 round Mint dot, 5 from the left edge, centred on the 40 avatar (12 padding above it). */
          <span data-testid="activity-unread-bar" data-unread-mark="" aria-hidden="true" style={{ position: "absolute", left: 5, top: 12 + 20 - 3, width: 6, height: 6, borderRadius: "50%", background: t.brandAccent }} />
        ) : (
          <span data-testid="activity-unread-bar" data-unread-mark="" aria-hidden="true" style={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: "0 2px 2px 0", background: t.brandAccent }} />
        )
      ) : null}
      <Who row={row} phone={phone} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <Line row={row} phone={phone} />
        {row.detail ? <span style={text(13, 400, t.text2, { overflowWrap: "anywhere" })}>{row.detail}</span> : null}
        <time dateTime={row.at} style={text(13, 400, t.label, tnum)}>
          {shortAgo(row.at, now)}
        </time>
      </div>
    </RowFrame>
  );
}

/** A day's heading, 13/500 Text 3. */
function DayHeading({ day, phone = false }: { day: ReactNode; phone?: boolean }) {
  /* 29f: the stills carry no day heads on a phone; the groups keep their heading for screen readers. */
  if (phone) return <h2 className="sr-only">{day}</h2>;
  return <h2 style={text(13, 500, t.label, { margin: 0, padding: `8px ${PAD}px 4px` })}>{day}</h2>;
}

function RowSkeleton({ phone = false }: { phone?: boolean }) {
  return (
    <div style={rowStyle}>
      <Skeleton width={40} height={40} radius={phone ? 9 : "50%"} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <Skeleton width="66%" height={14} />
        <Skeleton width={36} height={12} />
      </div>
    </div>
  );
}

/** Today's three rows and yesterday's four while the list loads. */
const LOADING_DAYS = [3, 4] as const;

/** 29f: nothing yet, on a phone: the water ripple and the line, centred in the space between the pills and the dock. */
function PhoneEmpty({ line }: { line: string }) {
  return (
    <div
      data-ui="empty-state"
      data-testid="activity-empty"
      style={{ minHeight: `calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - ${PHONE_TOPBAR + PHONE_PILL_ROW + PHONE_DOCK}px)`, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: `0 ${PAD}px` }}
    >
      <span aria-hidden="true" style={{ position: "relative", width: 120, height: 120, display: "block", borderRadius: "50%", overflow: "hidden" }}>
        <WaterField />
      </span>
      <p style={text(15, 400, t.text2, { margin: 0, textAlign: "center" })}>{line}</p>
    </div>
  );
}

function NoneOfThese({ hasMore }: { hasMore: boolean }) {
  return <p style={text(15, 400, t.text2, { margin: 0, padding: `0 ${PAD}px` })}>None of these among the latest.{hasMore ? " Show more to look further back." : ""}</p>;
}

function MoreButton({ list, phone }: { list: ActivityListProps; phone: boolean }) {
  if (!list.hasMore) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: `0 ${PAD}px` }}>
      <Button variant="secondary" size={phone ? 44 : 32} fontSize={13} disabled={list.loadingMore} onClick={list.onMore}>
        {list.loadingMore ? "Loading…" : "Show more"}
      </Button>
    </div>
  );
}

function ActivityList({ list, chosen, now, phone, onOpen, live }: { list: ActivityListProps; live: boolean; chosen: ReadonlySet<ActivityKind>; now: number; phone: boolean; onOpen: (row: ActivityRow) => void }) {
  const column: CSSProperties = { display: "flex", flexDirection: "column", gap: phone ? 0 : 16, minWidth: 0 };
  const day: CSSProperties = { display: "flex", flexDirection: "column" };

  const skeleton = (
    <LoadingRegion what="your activity" data-testid="activity-loading" style={column}>
      {(phone ? [3] : LOADING_DAYS).map((rows, index) => (
        <div key={index} style={day}>
          {phone ? null : (
            <div style={{ padding: `8px ${PAD}px 4px` }}>
              <Skeleton width={72} height={12} />
            </div>
          )}
          {Array.from({ length: rows }, (_, i) => (
            <RowSkeleton key={i} phone={phone} />
          ))}
        </div>
      ))}
    </LoadingRegion>
  );

  const groups = filterGroups(list.groups, chosen);
  const emptyLine = "All caught up.";
  return (
    <PageState
      read={list.read ?? (list.status === "error" ? readOf("error", undefined, list.onRetry, list.error) : list.status === "loading" ? readOf("loading") : readOf("ready", list.groups))}
      thing="your activity"
      region="Your activity"
      skeleton={skeleton}
      empty={phone ? undefined : { when: () => list.groups.length === 0 && live, line: emptyLine, testId: "activity-empty" }}
    >
      {() =>
        list.groups.length === 0 ? (
          phone && live ? <PhoneEmpty line={emptyLine} /> : null
        ) : (
          <div data-testid="activity-list" style={column}>
            {groups.map((group) => (
              <section key={group.day} data-testid="activity-day" style={day}>
                <DayHeading day={group.day} phone={phone} />
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {group.rows.map((row) => (
                    <li key={row.id}>
                      <Row row={row} now={now} onOpen={onOpen} phone={phone} />
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {groups.length === 0 ? <NoneOfThese hasMore={list.hasMore} /> : null}
            <MoreButton list={list} phone={phone} />
          </div>
        )
      }
    </PageState>
  );
}

/* ── the head ── */

function LiveState({ live, phone = false }: { live: boolean; phone?: boolean }) {
  /* 29f: no "live" label with its dot on a phone. Inserts still arrive as rows; the state is said to screen readers only. */
  if (phone) {
    return (
      <span className="sr-only" data-testid="activity-live" role="status">
        {live ? "Live" : "Reconnecting"}
      </span>
    );
  }
  return (
    <span data-testid="activity-live" style={{ fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: live ? t.brandAccent : t.warn, whiteSpace: "nowrap" }}>
      {live ? "● live" : "Reconnecting"}
    </span>
  );
}

function Head({ unread, live, onMarkAllRead, phone }: { unread: number | null; live: boolean; onMarkAllRead: () => void; phone: boolean }) {
  const unreadWords =
    unread === null ? null : (
      /* The unread count, for screen readers: the dots on the rows say it to the eye. */
      <span className="sr-only" data-testid="activity-unread">
        {unreadLine(unread, live)}
      </span>
    );
  if (phone) {
    /* Prompt 19 and 29f: the top bar names the page and carries "Mark all read", so the heading is for screen readers only and
       the head draws no box: the first row stands right under the pills. */
    return (
      <>
        <h1 className="sr-only" style={text(20, 600, t.text, { margin: 0 })}>Activity</h1>
        <LiveState live={live} phone />
        {unreadWords}
      </>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: `0 ${PAD}px 8px`, minHeight: 40, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
        <h1 style={text(20, 600, t.text, { margin: 0 })}>Activity</h1>
        <LiveState live={live} />
        {unreadWords}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Button variant="secondary" size={32} fontSize={13} data-testid="activity-mark-all" disabled={!unread} onClick={onMarkAllRead}>
          Mark all read
        </Button>
      </div>
    </div>
  );
}

/* ── the side ── */

/** The people in this week's rows, newest first, each once. */
export function peopleThisWeekOf(groups: readonly ActivityGroup[]): ActivityRow["actor"][] {
  const seen = new Map<string, ActivityRow["actor"]>();
  for (const group of groups) {
    if (group.day !== "Today" && group.day !== "Yesterday" && group.day !== "This week") continue;
    for (const row of group.rows) if (row.kind !== "reproduced" && !seen.has(row.actor.id)) seen.set(row.actor.id, row.actor);
  }
  return [...seen.values()];
}

function People({ groups }: { groups: readonly ActivityGroup[] }) {
  const people = peopleThisWeekOf(groups);
  if (people.length === 0) return null;
  const heading = `${people.length.toLocaleString("en-GB")} ${people.length === 1 ? "person" : "people"} this week`;
  return (
    <section aria-label={heading} data-testid="activity-people" style={{ padding: `0 ${PAD}px`, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={text(20, 600, t.text, { margin: 0 })}>{heading}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
        {people.slice(0, 12).map((actor) => (
          <li key={actor.id}>
            <Avatar size={36} userId={actor.id} name={actor.name} hue={actor.hue} src={actor.avatarUrl} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function KindSwitch({ kind, count, on, onToggle }: { kind: ActivityKind; count: number | null | undefined; on: boolean; onToggle: () => void }) {
  const id = useId();
  const square = kind === "reproduced" ? null : kind;
  return (
    <div data-testid="activity-kind" data-kind={kind} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 40 }}>
      {square ? <Square square={square} /> : null}
      <label htmlFor={id} style={text(15, 400, t.text, { flexGrow: 1, cursor: "pointer" })}>
        {KIND_LABEL[kind]}
      </label>
      {count === null ? <Skeleton width={16} height={12} /> : count === undefined ? null : <span style={text(13, 400, t.label, tnum)}>{count.toLocaleString("en-GB")}</span>}
      <Switch id={id} checked={on} onCheckedChange={onToggle} />
    </div>
  );
}

function ShowMe({ kindCounts, listStatus, chosen, onToggle, titled = true }: { kindCounts: KindCounts; listStatus: ActivityListProps["status"]; chosen: ReadonlySet<ActivityKind>; onToggle: (kind: ActivityKind) => void; titled?: boolean }) {
  return (
    <section aria-label={titled ? "Show me" : undefined} style={{ padding: `0 ${PAD}px`, display: "flex", flexDirection: "column", gap: 4 }}>
      {titled ? <h2 style={text(20, 600, t.text, { margin: "0 0 4px" })}>Show me</h2> : null}
      {/* In the sheet, the sheet's own group carries the name. */}
      <div role={titled ? "group" : undefined} aria-label={titled ? "Show me" : undefined} style={{ display: "flex", flexDirection: "column" }}>
        {ACTIVITY_KINDS.map((kind) => (
          <KindSwitch key={kind} kind={kind} count={listStatus === "ready" ? kindCounts[kind] : listStatus === "loading" ? null : undefined} on={kindShown(kind, chosen)} onToggle={() => onToggle(kind)} />
        ))}
      </div>
      <NotificationSettingsLink />
    </section>
  );
}

/* UX-15 P2: the quiet way to Settings from here. */
function NotificationSettingsLink() {
  return (
    <FrameLink to="/settings/notifications" style={text(13, 400, t.label, { marginTop: 8, textDecoration: "underline", textUnderlineOffset: 3, alignSelf: "flex-start" })}>
      Notification settings
    </FrameLink>
  );
}

/* ── the page ── */

/** The phone's pills: each is a set of kinds. "Comments and replies" is two kinds under one pill. */
const PHONE_PILLS: readonly { value: string; label: string; kinds: readonly ActivityKind[] }[] = [
  { value: "all", label: "All", kinds: [] },
  { value: "rebuilds", label: "Rebuilds", kinds: ["rebuilt"] },
  { value: "comments", label: "Comments and replies", kinds: ["comment", "reply"] },
  { value: "likes", label: "Likes", kinds: ["like"] },
  { value: "follows", label: "Follows", kinds: ["follow"] },
];

function Layout(props: ActivityViewProps) {
  const { now, list, unread, live, kindCounts, writeError, onOpen, onMarkAllRead } = props;
  useColumnPanels(true);
  const phone = useIsPhone();
  usePhoneRowLine(phone);
  const [chosen, setChosen] = useState<ReadonlySet<ActivityKind>>(NONE);
  const [pill, setPill] = useState("all");
  const toggle = (kind: ActivityKind) => setChosen((current) => switchKind(current, kind));
  const shown: ReadonlySet<ActivityKind> = phone ? new Set(PHONE_PILLS.find((p) => p.value === pill)?.kinds ?? []) : chosen;
  const pills: PhonePill[] = PHONE_PILLS.map(({ value, label }) => ({ value, label }));

  const main = (
    <section aria-label="Activity" style={phone ? { display: "flex", flexDirection: "column", minWidth: 0 } : { ...panel, display: "flex", flexDirection: "column", gap: 8 }}>
      {/* On a phone the pill row comes first: it sits right under the top bar and carries the structural line. */}
      {phone ? <div style={PHONE_ROW_STYLE}><PhonePills docked label="Show" pills={pills} value={pill} onChange={setPill} /></div> : null}
      <Head unread={unread} live={live} onMarkAllRead={onMarkAllRead} phone={phone} />
      {writeError ? (
        <div style={{ padding: `0 ${PAD}px` }}>
          <WriteFailed failure={writeError} />
        </div>
      ) : null}
      <ActivityList list={list} chosen={shown} now={now} phone={phone} onOpen={onOpen} live={live} />
    </section>
  );

  if (phone) {
    return (
      <div data-testid="activity-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: PANEL_GAP, minWidth: 0, margin: `0 -${PANEL_GAP}px`, paddingBottom: 24, fontFamily: FIGTREE }}>
        {main}
      </div>
    );
  }
  return (
    <div
      data-testid="activity-view"
      data-viewport="desktop"
      style={{ width: "100%", maxWidth: CONTAINER, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", columnGap: PANEL_GAP, alignItems: "start", fontFamily: FIGTREE }}
    >
      {main}
      <aside aria-label="This week and Show me" style={{ ...panel, display: "flex", flexDirection: "column", gap: 24 }}>
        <People groups={list.groups} />
        <ShowMe kindCounts={kindCounts} listStatus={list.status} chosen={chosen} onToggle={toggle} />
      </aside>
    </div>
  );
}

export function ActivityView(props: ActivityViewProps) {
  if (props.pageFailed) {
    /* G9: every region failed: one failed state for the page, under its title. */
    return (
      <div data-testid="activity-view" style={{ ...panel, width: "100%", maxWidth: CONTAINER, margin: "0 auto", padding: PAD, display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={text(20, 600, t.text, { margin: 0 })}>Activity</h1>
        <PageFailed reads={props.pageFailed} region="Activity" />
      </div>
    );
  }
  return <Layout {...props} />;
}

export default ActivityView;

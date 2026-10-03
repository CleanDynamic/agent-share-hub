/* UI-P27 — Home, as the reference draws it (design/reference/{desktop,mobile}/{noon,dusk}/home.html).

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   `Link`. `HomePage` supplies the data; the dev compare page supplies the sample
   data; both render this. The viewport is read here (the app's 768px breakpoint)
   so the two behave the same.

   DESKTOP: a `minmax(0, 1fr) 420px` grid, gap 12, filling the 820px board — the
   hero over the visitors' book on the left; the orbs, the week's challenges, the
   streak and where next on the right. PHONE: one column in the order the mobile
   board draws it, without where next.

   EVERY COLOUR IS A TOKEN. The reference's amber text (`--lit`) is `--lit-ink`
   here, as RULES §7 lists. Nothing in this file draws a number from the sample
   data: counts, rows and weeks all arrive as props. */

import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Flame, Maximize2 } from "lucide-react";

import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { FilterChip } from "@/components/brand/FilterChip";
import { IconButton } from "@/components/brand/IconButton";
import { LampDot } from "@/components/brand/LampDot";
import { OrbGlass } from "@/components/brand/OrbGlass";
import { OrbSolid } from "@/components/brand/OrbSolid";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { Plaque } from "@/components/brand/Plaque";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { StripedBar } from "@/components/brand/StripedBar";
import { Tagline } from "@/components/brand/Tagline";
import { Sparkline } from "@/components/brand/charts";
import { FrameLink } from "@/components/shell/FrameLink";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import {
  HOME_FILTERS,
  KIND_LABEL,
  frozenLabel,
  isNewerThanSeen,
  matchesFilter,
  shortAgo,
  type HomeChallengeRow,
  type HomeCover,
  type HomeFeedRow,
  type HomeFilter,
  type HomeStreak,
  type HomeWhereNextRow,
} from "./homeModel";

/* ── the view's props ── */

export type HomeScope = "following" | "everyone";

/** What a panel that loads on its own shows. `signed-out` is a state, not an error. */
export type Loadable<T> =
  | { status: "signed-out" }
  | { status: "loading" }
  | ({ status: "error" } & PanelFailure)
  | { status: "ready"; data: T };

export interface HomeFeedProps {
  status: "loading" | "error" | "ready";
  rows: readonly HomeFeedRow[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
  /** The real error behind `status: "error"`; logged once by the panel, never shown. */
  error?: unknown;
}

export interface HomeViewProps {
  fit?: PageFit;
  /** The clock the times and the plaques read. The compare page freezes it. */
  now: number;
  scope: HomeScope;
  onScopeChange: (scope: HomeScope) => void;
  /** Builds confirmed in the last day; null until known. */
  litToday: number | null;
  reproducedToday: number | null;
  runsThisWeek: number | null;
  /** The two run counts could not be read: the orbs' panel says so, in place of the orbs. */
  orbsError?: PanelFailure;
  feed: HomeFeedProps;
  /** When this browser last loaded Home (epoch ms), or null on a first visit. */
  seenAt: number | null;
  challenges: Loadable<readonly HomeChallengeRow[]>;
  /** Where the challenges panel's expand button goes. Omitted when no page shows the full view. */
  thisWeekHref?: string;
  streak: Loadable<HomeStreak>;
  whereNext: Loadable<readonly HomeWhereNextRow[]>;
  /** Navigation from a button (links are links). */
  onNavigate: (to: string) => void;
}

const GALLERY = "/gallery";
const HOW_PROOF_WORKS = "/about";
const SIGN_IN = "/login?redirect=/";

const TAGLINE = ["Every AI build,", "hung with", "its proof."] as const;
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/* ── small shared pieces ── */

/* `line-height: normal` on every run of text, as the reference draws it: the
   app's body sets a looser leading, and these rows are measured in pixels. */
const mono = (px: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: DM_MONO,
  fontSize: px,
  lineHeight: "normal",
  ...extra,
});

/** The thumbnail: the signed cover, or the fallback landscape for the build. */
function Thumb({ cover, width, height, radius }: { cover: HomeCover; width: number | string; height: number | string; radius: number }) {
  return (
    <div style={{ width, height, borderRadius: radius, overflow: "hidden", flexShrink: 0 }}>
      {cover.src ? (
        <img
          src={cover.src}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <CoverFallback seed={cover.seed} radius={radius} sky={cover.sky} />
      )}
    </div>
  );
}

/** The kind's colour: amber ink for a build, the agents hue for a rebuild, evidence for a note, breakage for an ask. */
const KIND_INK: Record<HomeFeedRow["kind"], string> = {
  build: t.litInk,
  rebuild: t.catAgents,
  repro_note: t.evidence,
  bounty: t.catBreakage,
};

const kindLabelStyle = (kind: HomeFeedRow["kind"]): CSSProperties => ({
  ...mono(10, { letterSpacing: ".07em", color: KIND_INK[kind] }),
});

const whoStyle: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 12,
  lineHeight: "normal",
  color: t.text2,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

function actorAvatar(row: HomeFeedRow, size: number) {
  return <Avatar size={size} userId={row.actor.id} name={row.actor.name} hue={row.actor.hue} src={row.actor.avatarUrl} />;
}

const rowFrame = (highlight: boolean): CSSProperties => ({
  borderRadius: 14,
  background: highlight ? t.rowHighlight : "transparent",
  borderBottom: `1px solid ${highlight ? "transparent" : t.hairline}`,
  textDecoration: "none",
  color: "inherit",
});

/* ── the visitors' book ── */

function DesktopRow({ row, highlight, now }: { row: HomeFeedRow; highlight: boolean; now: number }) {
  return (
    <FrameLink
      to={row.href}
      data-testid="home-row"
      data-kind={row.kind}
      data-highlight={highlight ? "true" : undefined}
      style={{
        ...rowFrame(highlight),
        display: "grid",
        gridTemplateColumns: "92px 30px minmax(0, 1fr) 84px 32px",
        gap: 12,
        alignItems: "center",
        padding: "9px 12px",
      }}
    >
      <span style={kindLabelStyle(row.kind)}>{KIND_LABEL[row.kind]}</span>
      {actorAvatar(row, 28)}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <span style={whoStyle}>{row.who}</span>
        <span style={{ ...display(20), lineHeight: 1, color: t.text }}>{row.title}</span>
        <Plaque build={row.plaque} size="card" now={now} />
      </div>
      <Thumb cover={row.cover} width={84} height={54} radius={10} />
      <span style={mono(10, { color: t.label, textAlign: "right" })}>{shortAgo(row.at, now)}</span>
    </FrameLink>
  );
}

function PhoneRow({ row, highlight, now }: { row: HomeFeedRow; highlight: boolean; now: number }) {
  return (
    <FrameLink
      to={row.href}
      data-testid="home-row"
      data-kind={row.kind}
      data-highlight={highlight ? "true" : undefined}
      style={{
        ...rowFrame(highlight),
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 72px",
        gap: 12,
        alignItems: "center",
        padding: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {actorAvatar(row, 22)}
          <span style={kindLabelStyle(row.kind)}>{KIND_LABEL[row.kind]}</span>
          <span style={mono(10, { color: t.label })}>· {shortAgo(row.at, now)}</span>
        </div>
        <span style={whoStyle}>{row.who}</span>
        <span style={{ ...display(20), lineHeight: 1.05, color: t.text }}>{row.title}</span>
        <Plaque build={row.plaque} size="card" now={now} />
      </div>
      <Thumb cover={row.cover} width={72} height={72} radius={10} />
    </FrameLink>
  );
}

/** A book row's height on the board: its padding, its content and its hairline. A loading row is as tall, so the page does not move. */
const DESKTOP_ROW_HEIGHT = 74;
const PHONE_ROW_HEIGHT = 130;

/** A row of the visitors' book before it has arrived: the same grid and padding, bones where the content goes. */
function RowSkeleton({ phone }: { phone: boolean }) {
  if (phone) {
    return (
      <div
        style={{
          ...rowFrame(false),
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 72px",
          gap: 12,
          alignItems: "center",
          padding: 12,
          boxSizing: "border-box",
          height: PHONE_ROW_HEIGHT,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Skeleton width={22} height={22} radius="50%" />
            <Skeleton width={64} height={10} />
          </div>
          <Skeleton width="55%" height={12} />
          <Skeleton width="80%" height={20} />
          <Skeleton width="60%" height={14} />
        </div>
        <Skeleton width={72} height={72} radius={10} />
      </div>
    );
  }
  return (
    <div
      style={{
        ...rowFrame(false),
        display: "grid",
        gridTemplateColumns: "92px 30px minmax(0, 1fr) 84px 32px",
        gap: 12,
        alignItems: "center",
        padding: "9px 12px",
        boxSizing: "border-box",
        height: DESKTOP_ROW_HEIGHT,
      }}
    >
      <Skeleton width={56} height={10} />
      <Skeleton width={28} height={28} radius="50%" />
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <Skeleton width="38%" height={12} />
        <Skeleton width="62%" height={20} />
        <Skeleton width="46%" height={14} />
      </div>
      <Skeleton width={84} height={54} radius={10} />
      <Skeleton width={22} height={10} style={{ justifySelf: "end" }} />
    </div>
  );
}

function BookBody({
  feed,
  filter,
  seenAt,
  now,
  phone,
  onNavigate,
}: {
  feed: HomeFeedProps;
  filter: HomeFilter;
  seenAt: number | null;
  now: number;
  phone: boolean;
  onNavigate: (to: string) => void;
}) {
  const Row = phone ? PhoneRow : DesktopRow;

  if (feed.status === "loading") {
    return (
      <LoadingRegion what="the visitors’ book" data-testid="home-feed-loading" style={{ display: "flex", flexDirection: "column" }}>
        {Array.from({ length: phone ? 4 : 5 }, (_, i) => (
          <RowSkeleton key={i} phone={phone} />
        ))}
      </LoadingRegion>
    );
  }

  if (feed.status === "error") {
    return <ErrorState panel="The visitors’ book" onRetry={feed.onRetry} error={feed.error} data-testid="home-feed-error" />;
  }

  if (feed.rows.length === 0) {
    return <EmptyState line="Nothing hung yet." action={{ label: "Enter the gallery", onClick: () => onNavigate(GALLERY) }} data-testid="home-feed-empty" />;
  }

  const visible = feed.rows.filter((row) => matchesFilter(row.kind, filter));
  const highlightKey = isNewerThanSeen(visible[0]?.at, seenAt) ? visible[0]?.key : undefined;

  return (
    <>
      <div data-testid="home-feed" style={{ display: "flex", flexDirection: "column" }}>
        {visible.map((row) => (
          <Row key={row.key} row={row} highlight={row.key === highlightKey} now={now} />
        ))}
      </div>
      {visible.length === 0 ? (
        <p style={{ margin: "14px 12px 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "normal", color: t.text2 }}>
          None of these among the latest.{feed.hasMore ? " Show more to look further back." : ""}
        </p>
      ) : null}
      {feed.hasMore ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          <Button
            variant="secondary"
            size={phone ? 44 : 34}
            fontSize={phone ? 13 : 12}
            disabled={feed.loadingMore}
            onClick={feed.onMore}
          >
            {feed.loadingMore ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/* ── the hero ── */

const LIT_BADGE_TEXT = (n: number, phone: boolean) => `${n.toLocaleString("en-GB")} ${phone ? "lit today" : "builds lit today"}`;

function ScopeControl({
  scope,
  onChange,
  size,
  fontSize,
}: {
  scope: HomeScope;
  onChange: (scope: HomeScope) => void;
  size: 34 | 36;
  fontSize: 12 | 13;
}) {
  return (
    <Segmented<HomeScope>
      label="Whose builds"
      size={size}
      fontSize={fontSize}
      value={scope}
      onChange={onChange}
      items={[
        { value: "following", label: "Following" },
        { value: "everyone", label: "Everyone" },
      ]}
    />
  );
}

function LitBadge({ litToday, phone }: { litToday: number | null; phone: boolean }) {
  if (litToday === null) return null;
  return (
    <div
      data-testid="home-lit-badge"
      style={{
        display: "flex",
        alignItems: "center",
        gap: phone ? 7 : 8,
        padding: phone ? "7px 10px" : "6px 10px",
        borderRadius: r.control,
        background: phone ? t.glass2 : t.mediaTag,
        border: phone ? `1px solid ${t.line}` : undefined,
        ...mono(11, { color: t.text }),
      }}
    >
      <LampDot />
      {LIT_BADGE_TEXT(litToday, phone)}
    </div>
  );
}

/** The hero's artwork: fixed brand artwork (sky 0), never a build, and a scrim for the type. */
function HeroArt({ scrim }: { scrim: string }) {
  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
        <CoverFallback seed="home-hero" radius={0} sky={0} />
      </div>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: scrim }} />
    </>
  );
}

/* ── the orbs ── */

/** An orb before its number has arrived: a circle of the orb's diameter. */
function OrbSkeleton({ size }: { size: number }) {
  return <Skeleton width={size} height={size} radius="50%" />;
}

const runs = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "run" : "runs"}`;

/**
 * The two orbs in their row, in whichever of their states they are in: the numbers,
 * a circle each while a number is on its way, or — when a count could not be read —
 * the panel's failure in their place (the page passes `failure` only then). On a phone the orbs sit straight on the page, so
 * a failure there needs a surface (`framed`).
 */
function OrbsRow({
  size,
  reproducedToday,
  runsThisWeek,
  failure,
  framed = false,
  style,
}: {
  size: number;
  reproducedToday: number | null;
  runsThisWeek: number | null;
  failure?: PanelFailure;
  framed?: boolean;
  style?: CSSProperties;
}) {
  const row: CSSProperties = { display: "flex", justifyContent: "center", gap: 12, alignItems: "center", ...style };

  if (failure) {
    const error = <ErrorState panel="Run counts" onRetry={failure.onRetry} error={failure.error} data-testid="home-orbs-error" />;
    return framed ? (
      <Panel padding="14px 16px">{error}</Panel>
    ) : (
      /* In the panel's own padding: the failure reads from the panel's top-left, as every other panel's does. */
      <div style={{ ...row, justifyContent: "flex-start", alignItems: "flex-start", padding: "2px 4px" }}>{error}</div>
    );
  }

  const orbs = (
    <>
      {reproducedToday === null ? (
        <OrbSkeleton size={size} />
      ) : (
        <OrbGlass size={size} label="Reproduced today" sub={runs(reproducedToday)} />
      )}
      {runsThisWeek === null ? (
        <OrbSkeleton size={size} />
      ) : (
        <OrbSolid size={size} top="This week" value={runsThisWeek.toLocaleString("en-GB")} bottom="runs reported" />
      )}
    </>
  );
  if (reproducedToday === null || runsThisWeek === null) {
    return (
      <LoadingRegion what="the run counts" style={row}>
        {orbs}
      </LoadingRegion>
    );
  }
  return <div style={row}>{orbs}</div>;
}

/* ── challenges ── */

const MEANING_INK: Record<HomeChallengeRow["meaning"], string> = {
  run: t.lit,
  solve: t.action,
  reconfirm: t.evidence,
};

function countText(row: HomeChallengeRow, phone: boolean): string {
  if (phone) return `${row.done}/${row.target}`;
  const done = row.done >= row.target;
  const tail = done ? " · done" : row.xp ? ` · +${row.xp} xp` : "";
  return `${row.done} / ${row.target}${tail}`;
}

function ChallengeList({ rows, phone }: { rows: readonly HomeChallengeRow[]; phone: boolean }) {
  return (
    <div data-testid="home-challenges">
      {rows.map((row) => (
        <div
          key={row.slug}
          data-testid="weekly-challenge"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 7,
            padding: phone ? "11px 0" : "10px 0",
            borderBottom: `1px solid ${t.hairline}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontFamily: FIGTREE, fontSize: phone ? 14 : 13, lineHeight: "normal", color: t.text }}>{row.title}</span>
            <span style={mono(11, { color: t.text2, whiteSpace: "nowrap" })}>{countText(row, phone)}</span>
          </div>
          <StripedBar
            value={(row.done / Math.max(1, row.target)) * 100}
            colour={MEANING_INK[row.meaning]}
            height={9}
            label={row.title}
            valueText={`${row.done} of ${row.target}`}
          />
        </div>
      ))}
    </div>
  );
}

/** A challenge before it has arrived: the row's own padding and hairline round a line of text and a 9px bar. */
function ChallengeRowSkeleton({ phone }: { phone: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: phone ? "11px 0" : "10px 0",
        borderBottom: `1px solid ${t.hairline}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, height: phone ? 16 : 15 }}>
        <Skeleton width="58%" height={phone ? 13 : 12} />
        <Skeleton width={phone ? 28 : 72} height={11} />
      </div>
      <Skeleton height={9} radius={5} />
    </div>
  );
}

function ChallengesBody({
  challenges,
  phone,
  onNavigate,
}: {
  challenges: HomeViewProps["challenges"];
  phone: boolean;
  onNavigate: (to: string) => void;
}) {
  if (challenges.status === "signed-out") {
    return (
      <EmptyState
        line="Sign in to take this week's challenges."
        action={{ label: "Sign in", onClick: () => onNavigate(SIGN_IN) }}
        data-testid="home-challenges-signed-out"
      />
    );
  }
  if (challenges.status === "loading") {
    return (
      <LoadingRegion what="this week’s challenges" data-testid="home-challenges-loading">
        {[0, 1, 2].map((i) => (
          <ChallengeRowSkeleton key={i} phone={phone} />
        ))}
      </LoadingRegion>
    );
  }
  if (challenges.status === "error") {
    return (
      <ErrorState
        panel="This week’s challenges"
        onRetry={challenges.onRetry}
        error={challenges.error}
        style={{ paddingTop: 14 }}
        data-testid="home-challenges-error"
      />
    );
  }
  return <ChallengeList rows={challenges.data} phone={phone} />;
}

function ChallengesPanel({
  challenges,
  thisWeekHref,
  phone,
  onNavigate,
}: {
  challenges: HomeViewProps["challenges"];
  thisWeekHref?: string;
  phone: boolean;
  onNavigate: (to: string) => void;
}) {
  const expand =
    !phone && thisWeekHref && challenges.status !== "signed-out" ? (
      <IconButton icon={Maximize2} label="Open this week" size={34} onClick={() => onNavigate(thisWeekHref)} />
    ) : undefined;

  return (
    <Panel padding={phone ? "14px 16px 6px" : "14px 16px"} style={phone ? undefined : { flex: 1 }}>
      <PanelHead title="This week’s challenges" subtitle="Resets Monday 00:00 UTC" headingLevel={2} right={expand} />
      <ChallengesBody challenges={challenges} phone={phone} onNavigate={onNavigate} />
    </Panel>
  );
}

/* ── the streak ── */

function DayMark({ state }: { state: HomeStreak["week"][number] }) {
  if (state === "active") return <LampDot width={20} height={12} />;
  return (
    <span
      aria-hidden="true"
      style={{
        width: 20,
        height: 12,
        borderRadius: r.full,
        boxSizing: "border-box",
        border: state === "frozen" ? `1.5px solid ${t.evidence}` : `1.5px dashed ${t.line}`,
      }}
    />
  );
}

/** The head's mark, and the week below it, before the streak has arrived: the populated panel's own rows, as bones. */
function StreakSkeleton() {
  return (
    <LoadingRegion what="your streak" data-testid="home-streak-loading">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <PanelHead title="Streak" subtitle={"\u00a0"} headingLevel={2} />
        <Skeleton width={22} height={22} radius="50%" />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        {DAY_LETTERS.map((_, index) => (
          <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <Skeleton width={20} height={12} radius={r.full} />
            <Skeleton width={8} height={11} radius={3} />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

function StreakPanel({ streak, onNavigate }: { streak: HomeViewProps["streak"]; onNavigate: (to: string) => void }) {
  if (streak.status === "ready" && streak.data.count > 0) {
    const { count, frozenUsed, week } = streak.data;
    return (
      <Panel padding="14px 16px">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <PanelHead title={`${count}-day streak`} subtitle={frozenLabel(frozenUsed)} headingLevel={2} />
          <span style={{ color: t.litInk, display: "flex" }}>
            <Flame size={22} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />
          </span>
        </div>
        <ul
          data-testid="home-streak-week"
          style={{ display: "flex", justifyContent: "space-between", margin: "12px 0 0", padding: 0, listStyle: "none" }}
        >
          {week.map((state, index) => (
            <li
              key={index}
              aria-label={`${DAY_NAMES[index]}: ${state === "active" ? "lit" : state === "frozen" ? "frozen" : "not lit"}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
            >
              <DayMark state={state} />
              <span aria-hidden="true" style={mono(10, { color: t.label })}>
                {DAY_LETTERS[index]}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  if (streak.status === "loading") {
    return (
      <Panel padding="14px 16px">
        <StreakSkeleton />
      </Panel>
    );
  }

  return (
    <Panel padding="14px 16px">
      <PanelHead title="Streak" headingLevel={2} />
      {streak.status === "error" ? (
        <ErrorState panel="Streak" onRetry={streak.onRetry} error={streak.error} style={{ paddingTop: 14 }} data-testid="home-streak-error" />
      ) : (
        <EmptyState
          line="Run a build today to start a streak."
          action={streak.status === "signed-out" ? { label: "Sign in", onClick: () => onNavigate(SIGN_IN) } : undefined}
          data-testid="home-streak-empty"
        />
      )}
    </Panel>
  );
}

/* ── where next ── */

/** A suggestion before it has arrived: the row's padding and hairline round a 34px picture, two lines and a sparkline. */
function WhereNextRowSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 0",
        borderBottom: `1px solid ${t.hairline}`,
      }}
    >
      <Skeleton width={34} height={34} radius={8} />
      <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <Skeleton width="62%" height={13} />
        <Skeleton width="40%" height={10} />
      </div>
      <Skeleton width={54} height={18} radius={6} />
    </div>
  );
}

function WhereNextPanel({ whereNext, onNavigate }: { whereNext: HomeViewProps["whereNext"]; onNavigate: (to: string) => void }) {
  return (
    <Panel padding="14px 16px" style={{ flex: 1 }}>
      <PanelHead title="Where next" subtitle="From what you ran this week" headingLevel={2} />
      {whereNext.status === "loading" ? (
        <LoadingRegion what="suggestions" data-testid="home-where-next-loading" style={{ marginTop: 6 }}>
          {[0, 1, 2].map((i) => (
            <WhereNextRowSkeleton key={i} />
          ))}
        </LoadingRegion>
      ) : whereNext.status === "error" ? (
        <ErrorState panel="Where next" onRetry={whereNext.onRetry} error={whereNext.error} style={{ paddingTop: 14 }} data-testid="home-where-next-error" />
      ) : whereNext.status === "signed-out" || whereNext.data.length === 0 ? (
        <EmptyState
          line="Run a build this week and suggestions appear here."
          action={
            whereNext.status === "signed-out"
              ? { label: "Sign in", onClick: () => onNavigate(SIGN_IN) }
              : { label: "Enter the gallery", onClick: () => onNavigate(GALLERY) }
          }
          data-testid="home-where-next-empty"
        />
      ) : (
        <div data-testid="home-where-next" style={{ marginTop: 6 }}>
          {whereNext.data.map((row) => (
            <FrameLink
              key={row.id}
              to={row.href}
              data-testid="home-where-next-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 0",
                borderBottom: `1px solid ${t.hairline}`,
                color: "inherit",
              }}
            >
              <Thumb cover={row.cover} width={34} height={34} radius={8} />
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "normal", color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.title}
                </div>
                <div style={mono(10, { color: t.label })}>{row.reason}</div>
              </div>
              <Sparkline values={row.spark} width={54} height={18} />
            </FrameLink>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ── the two layouts ── */

function DesktopHome(props: HomeViewProps) {
  const { fit = "content", now, scope, onScopeChange, litToday, reproducedToday, runsThisWeek, orbsError, feed, seenAt, challenges, thisWeekHref, streak, whereNext, onNavigate } = props;
  const [filter, setFilter] = useState<HomeFilter>("all");

  return (
    <div
      data-testid="home-view"
      data-viewport="desktop"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 420px",
        gridTemplateRows: fit === "board" ? "minmax(0, 1fr)" : undefined,
        gap: 12,
        ...boardHeight(fit),
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 }}>
        <div style={{ height: 340, flexShrink: 0 }}>
          <Panel padding="22px 24px" style={{ height: "100%" }}>
            <HeroArt scrim={`linear-gradient(90deg, ${t.scrim} 0%, transparent 60%)`} />
            <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <ScopeControl scope={scope} onChange={onScopeChange} size={34} fontSize={12} />
                <LitBadge litToday={litToday} phone={false} />
              </div>
              <Tagline lines={TAGLINE} size={46} offsets={[0, 90, 30]} />
              <div style={{ display: "flex", gap: 8 }}>
                <Button size={36} fontSize={13} icon={ArrowRight} onClick={() => onNavigate(GALLERY)}>
                  Enter the gallery
                </Button>
                <Button variant="secondary" size={36} fontSize={13} onClick={() => onNavigate(HOW_PROOF_WORKS)}>
                  How proof works
                </Button>
              </div>
            </div>
          </Panel>
        </div>

        <div style={{ flexGrow: 1, minHeight: 0, display: "flex" }}>
          <Panel padding="14px 16px" style={{ flex: 1 }}>
            <PanelHead
              title="The visitors’ book"
              subtitle="Builds, rebuilds, reproduction notes and asks — newest first"
              headingLevel={2}
              right={
                <Segmented<HomeFilter> label="Show" size={30} fontSize={11} value={filter} onChange={setFilter} items={HOME_FILTERS} />
              }
            />
            <div style={{ marginTop: 10 }}>
              <BookBody feed={feed} filter={filter} seenAt={seenAt} now={now} phone={false} onNavigate={onNavigate} />
            </div>
          </Panel>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 }}>
        <div style={{ height: 180, flexShrink: 0 }}>
          <Panel padding="12px" style={{ height: "100%" }}>
            <OrbsRow size={150} reproducedToday={reproducedToday} runsThisWeek={runsThisWeek} failure={orbsError} style={{ height: "100%" }} />
          </Panel>
        </div>

        <div style={{ height: 230, flexShrink: 0, display: "flex" }}>
          <ChallengesPanel challenges={challenges} thisWeekHref={thisWeekHref} phone={false} onNavigate={onNavigate} />
        </div>

        <StreakPanel streak={streak} onNavigate={onNavigate} />

        <div style={{ flexGrow: 1, minHeight: 0, display: "flex" }}>
          <WhereNextPanel whereNext={whereNext} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

function PhoneHome(props: HomeViewProps) {
  const { now, scope, onScopeChange, litToday, reproducedToday, runsThisWeek, orbsError, feed, seenAt, challenges, streak, onNavigate } = props;
  const [filter, setFilter] = useState<HomeFilter>("all");

  return (
    <div data-testid="home-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <ScopeControl scope={scope} onChange={onScopeChange} size={36} fontSize={13} />
        <LitBadge litToday={litToday} phone />
      </div>

      <Panel padding="16px" style={{ height: 270 }}>
        <HeroArt scrim={`linear-gradient(180deg, transparent 30%, ${t.scrim} 100%)`} />
        <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <Tagline lines={TAGLINE} size={30} offsets={[0, 44, 14]} />
          <div style={{ display: "flex", gap: 8 }}>
            <Button size={42} fontSize={14} icon={ArrowRight} onClick={() => onNavigate(GALLERY)}>
              Enter the gallery
            </Button>
          </div>
        </div>
      </Panel>

      <OrbsRow size={162} reproducedToday={reproducedToday} runsThisWeek={runsThisWeek} failure={orbsError} framed style={{ padding: "4px 0" }} />

      <ChallengesPanel challenges={challenges} phone onNavigate={onNavigate} />

      <Panel padding="14px 12px">
        <PanelHead title="The visitors’ book" subtitle="Newest first" headingLevel={2} />
        <div style={{ margin: "10px -4px 0" }}>
          <ScrollRow gap={6} label="Show">
            {HOME_FILTERS.map((item) => (
              <FilterChip key={item.value} label={item.label} on={filter === item.value} onClick={() => setFilter(item.value)} />
            ))}
          </ScrollRow>
        </div>
        <div style={{ marginTop: 8 }}>
          <BookBody feed={feed} filter={filter} seenAt={seenAt} now={now} phone onNavigate={onNavigate} />
        </div>
      </Panel>

      <StreakPanel streak={streak} onNavigate={onNavigate} />
    </div>
  );
}

export function HomeView(props: HomeViewProps) {
  const phone = useIsPhone();
  return phone ? <PhoneHome {...props} /> : <DesktopHome {...props} />;
}

export default HomeView;

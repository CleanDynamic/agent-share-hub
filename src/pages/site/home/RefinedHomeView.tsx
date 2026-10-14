/* UI-P88 — Home in the refined look, as `design/reference/refined/{dusk,noon}/home.html` draws it.

   A FORK, NOT AN EDIT. `HomeView` stays the current look; this is the same page with the same props (imported from
   it, not copied), the same data, handlers, copy, accessible names and order of parts. `HomePage` and the dev page
   choose between the two with `useLook()`.

   DESKTOP: the frame draws the breadcrumb; this is a wrapping row, gap 48 — the main column (`flex: 999 1 640px`,
   gap 40: the hero, then the visitors' book) and the aside (`flex: 1 1 300px`, max 340, a hairline on its left, gap
   24: the run counts as two figures, the week's challenges, the streak, where next). There is no card on the page:
   the frame's one surface is the ground, and parts are told apart by hairlines.

   PHONE: one column in today's order — scope and the lit line, the hero, the run counts, the challenges, the book,
   the streak — and, as today, no where next.

   THE WALL. The hero's picture is a 400×232 well with the dot grid, a rail 16 from its top and six framed works at
   the board's positions. The centre one is lit, with the picture light's cone over it, while any build was lit today
   (`litToday`), so the wall is lit from data and not as decoration. The orbs are not drawn under refined.

   LIT IN THE BOOK. A row's thumbnail is lit when it is the row newer than the previous visit, the same record that
   gives it the tile fill. */

import { useState, type CSSProperties, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";

import { useResolvedTheme } from "@/contexts/ThemeContext";
import { Avatar } from "@/components/brand/Avatar";
import { Button } from "@/components/brand/Button";
import { CardHead } from "@/components/brand/CardHead";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { EmptyState } from "@/components/brand/EmptyState";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { Figure } from "@/components/brand/Figure";
import { FilterChip } from "@/components/brand/FilterChip";
import { FramedWork, PICTURE_LIGHT_CONE } from "@/components/brand/FramedWork";
import { IconButton } from "@/components/brand/IconButton";
import { LampBar } from "@/components/brand/LampDot";
import { Mark } from "@/components/brand/Mark";
import { Pill } from "@/components/brand/Pill";
import { Plaque } from "@/components/brand/Plaque";
import { Segmented } from "@/components/brand/Segmented";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { StreakDay, StreakWeek } from "@/components/brand/StreakDay";
import { StripedBar } from "@/components/brand/StripedBar";
import { Well } from "@/components/brand/Tile";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { Sparkline } from "@/components/brand/charts";
import { FrameLink } from "@/components/shell/FrameLink";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { HomeFeedProps, HomeScope, HomeViewProps } from "./HomeView";
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
} from "./homeModel";

const GALLERY = "/gallery";
const HOW_PROOF_WORKS = "/about";
const SIGN_IN = "/login?redirect=/";

const TAGLINE = ["Every AI build,", "hung with", "its proof."] as const;
const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/* ── type ── */

const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
  ...extra,
});

const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };

/** A part of the aside: its rows, and a hairline under it when another follows. */
const asidePart = (gap: number, below: number | null): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap,
  minWidth: 0,
  ...(below === null ? null : { paddingBottom: below, borderBottom: `1px solid ${t.hairline}` }),
});

/** The picture in a frame: the signed cover, or the refined fallback sketch. */
function Picture({ cover }: { cover: HomeCover }) {
  return cover.src ? (
    <img
      src={cover.src}
      alt=""
      loading="lazy"
      decoding="async"
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
    />
  ) : (
    <CoverFallback seed={cover.seed} radius={2} sky={cover.sky} />
  );
}

/* ── the hero ── */

function ScopeControl({ scope, onChange }: { scope: HomeScope; onChange: (scope: HomeScope) => void }) {
  return (
    <Segmented<HomeScope>
      label="Whose builds"
      size={28}
      fontSize={12}
      value={scope}
      onChange={onChange}
      items={[
        { value: "following", label: "Following" },
        { value: "everyone", label: "Everyone" },
      ]}
    />
  );
}

/** The lit count: a plain line with a 10×3 lamp bar before it, not a badge. */
function LitLine({ litToday, phone }: { litToday: number | null; phone: boolean }) {
  if (litToday === null) return null;
  return (
    <span
      data-testid="home-lit-badge"
      style={{ ...text(12, 400, t.text2), ...tnum, display: "inline-flex", alignItems: "center", gap: 8 }}
    >
      <LampBar width={10} />
      {`${litToday.toLocaleString("en-GB")} ${phone ? "lit today" : "builds lit today"}`}
    </span>
  );
}

/** The tagline: one sentence for assistive technology, three indented lines on screen, the mark after "hung with". */
function Tagline({ phone }: { phone: boolean }) {
  const size = phone ? 36 : 44;
  return (
    <h1
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily: FIGTREE,
        fontSize: size,
        fontWeight: 500,
        letterSpacing: "-0.04em",
        lineHeight: 1.04,
        color: t.text,
      }}
    >
      <VisuallyHidden>{TAGLINE.join(" ")}</VisuallyHidden>
      <span aria-hidden="true">{TAGLINE[0]}</span>
      <span aria-hidden="true" style={{ paddingLeft: 48, display: "inline-flex", alignItems: "center", gap: 12 }}>
        {TAGLINE[1]}
        <Mark size={phone ? 26 : 30} />
      </span>
      <span aria-hidden="true" style={{ paddingLeft: 24 }}>
        {TAGLINE[2]}
      </span>
    </h1>
  );
}

/** The six works on the wall, where the board hangs them. The second is the one under the light. */
const WALL: readonly { left: number; top: number; width: number; height: number }[] = [
  { left: 24, top: 56, width: 92, height: 60 },
  { left: 140, top: 40, width: 118, height: 80 },
  { left: 278, top: 60, width: 92, height: 58 },
  { left: 52, top: 144, width: 70, height: 54 },
  { left: 156, top: 148, width: 100, height: 56 },
  { left: 282, top: 140, width: 68, height: 66 },
];
const LIT_WORK = 1;
const WALL_WIDTH = 400;
/** A distance across the wall, as a share of its inside (the width less its 1px edges): at full width it is the board's
    px, and on a narrower phone the works keep their places. */
const across = (px: number) => `${(px / (WALL_WIDTH - 2)) * 100}%`;

/** The hero's wall: brand artwork, never a build. Lit while any build was lit today. */
function Wall({ lit }: { lit: boolean }) {
  const room = useResolvedTheme();
  return (
    <Well
      dots
      style={{ position: "relative", width: WALL_WIDTH, maxWidth: "100%", height: 232, flexShrink: 0, overflow: "hidden" }}
    >
      <span aria-hidden="true" data-testid="home-wall" data-lit={lit ? "" : undefined} style={{ position: "absolute", inset: 0 }}>
        <span style={{ position: "absolute", left: 12, right: 12, top: 16, height: 1, background: t.line }} />
        {lit ? (
          <span
            style={{
              position: "absolute",
              left: across(132),
              top: 32,
              width: across(134),
              height: 110,
              clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)",
              background: PICTURE_LIGHT_CONE[room],
            }}
          />
        ) : null}
        {WALL.map((work, index) => (
          <span key={index} style={{ position: "absolute", left: across(work.left), top: work.top, width: across(work.width) }}>
            <FramedWork lit={lit && index === LIT_WORK} height={work.height}>
              <CoverFallback seed={`home-wall-${index}`} radius={2} />
            </FramedWork>
          </span>
        ))}
      </span>
    </Well>
  );
}

function Hero({
  scope,
  onScopeChange,
  litToday,
  phone,
  onNavigate,
}: Pick<HomeViewProps, "scope" | "onScopeChange" | "litToday" | "onNavigate"> & { phone: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <ScopeControl scope={scope} onChange={onScopeChange} />
        <span style={{ flexGrow: 1 }} />
        <LitLine litToday={litToday} phone={phone} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 32 }}>
        <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          <Tagline phone={phone} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Button size={32} fontSize={13} onClick={() => onNavigate(GALLERY)}>
              Enter the gallery
            </Button>
            {phone ? null : (
              <Button variant="secondary" size={32} fontSize={13} onClick={() => onNavigate(HOW_PROOF_WORKS)}>
                How proof works
              </Button>
            )}
          </div>
        </div>
        <Wall lit={(litToday ?? 0) > 0} />
      </div>
    </div>
  );
}

/* ── the visitors' book ── */

/** The kind's ink, on the pill's own fill: amber ink for a build, the agents hue, evidence, breakage. */
const KIND_INK: Record<HomeFeedRow["kind"], string> = {
  build: t.litInk,
  rebuild: t.catAgents,
  repro_note: t.evidence,
  bounty: t.breakage,
};

function KindPill({ kind }: { kind: HomeFeedRow["kind"] }) {
  return <Pill style={{ color: KIND_INK[kind] }}>{KIND_LABEL[kind]}</Pill>;
}

const DESKTOP_COLUMNS = "96px 24px minmax(0, 1fr) 56px 32px";

/** A row of the book: hairline-separated; the newest since the last visit takes the tile fill instead. */
const rowFrame = (highlight: boolean): CSSProperties => ({
  minHeight: 60,
  boxSizing: "border-box",
  borderBottom: `1px solid ${highlight ? "transparent" : t.hairline}`,
  textDecoration: "none",
  color: "inherit",
  ...(highlight ? { background: t.tile, borderRadius: 6, margin: "0 -12px", padding: "0 12px" } : null),
});

function Thumb({ row, highlight, width, height }: { row: HomeFeedRow; highlight: boolean; width: number; height: number }) {
  return (
    <FramedWork lit={highlight} width={width} height={height}>
      <Picture cover={row.cover} />
    </FramedWork>
  );
}

function TitleLine({ row, now }: { row: HomeFeedRow; now: number }) {
  return (
    <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 8, rowGap: 4, minWidth: 0 }}>
      <span style={text(13, 500, t.text, { whiteSpace: "nowrap" })}>{row.title}</span>
      <Plaque build={row.plaque} size="row" now={now} />
    </span>
  );
}

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
        gridTemplateColumns: DESKTOP_COLUMNS,
        alignItems: "center",
        gap: 12,
      }}
    >
      <span>
        <KindPill kind={row.kind} />
      </span>
      <Avatar size={24} userId={row.actor.id} name={row.actor.name} hue={row.actor.hue} src={row.actor.avatarUrl} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, padding: "8px 0" }}>
        <span style={text(12.5, 400, t.text2, ellipsis)}>{row.who}</span>
        <TitleLine row={row} now={now} />
      </div>
      <Thumb row={row} highlight={highlight} width={56} height={36} />
      <span style={text(11.5, 400, t.label, { ...tnum, textAlign: "right" })}>{shortAgo(row.at, now)}</span>
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
        alignItems: "center",
        gap: 12,
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar size={24} userId={row.actor.id} name={row.actor.name} hue={row.actor.hue} src={row.actor.avatarUrl} />
          <KindPill kind={row.kind} />
          <span style={text(11.5, 400, t.label, tnum)}>· {shortAgo(row.at, now)}</span>
        </div>
        <span style={text(12.5, 400, t.text2, ellipsis)}>{row.who}</span>
        <TitleLine row={row} now={now} />
      </div>
      <Thumb row={row} highlight={highlight} width={72} height={52} />
    </FrameLink>
  );
}

/** A book row before it has arrived: the same grid and height, bones where the content goes. */
function RowSkeleton({ phone }: { phone: boolean }) {
  if (phone) {
    return (
      <div
        style={{
          ...rowFrame(false),
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 72px",
          alignItems: "center",
          gap: 12,
          padding: "12px 0",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Skeleton width={24} height={24} radius="50%" />
            <Skeleton width={56} height={18} radius={4} />
          </div>
          <Skeleton width="55%" height={12} />
          <Skeleton width="80%" height={14} />
        </div>
        <Skeleton width={72} height={52} radius={4} />
      </div>
    );
  }
  return (
    <div style={{ ...rowFrame(false), display: "grid", gridTemplateColumns: DESKTOP_COLUMNS, alignItems: "center", gap: 12, height: 60 }}>
      <Skeleton width={56} height={18} radius={4} />
      <Skeleton width={24} height={24} radius="50%" />
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <Skeleton width="38%" height={12} />
        <Skeleton width="62%" height={14} />
      </div>
      <Skeleton width={56} height={36} radius={4} />
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
  const list: CSSProperties = { display: "flex", flexDirection: "column", borderTop: `1px solid ${t.hairline}` };

  if (feed.status === "loading") {
    return (
      <LoadingRegion what="the visitors’ book" data-testid="home-feed-loading" style={list}>
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
      <div data-testid="home-feed" style={list}>
        {visible.map((row) => (
          <Row key={row.key} row={row} highlight={row.key === highlightKey} now={now} />
        ))}
      </div>
      {visible.length === 0 ? (
        <p style={text(12, 400, t.text2, { margin: "12px 0 0" })}>
          None of these among the latest.{feed.hasMore ? " Show more to look further back." : ""}
        </p>
      ) : null}
      {feed.hasMore ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Button variant="secondary" size={phone ? 44 : 32} fontSize={13} disabled={feed.loadingMore} onClick={feed.onMore}>
            {feed.loadingMore ? "Loading…" : "Show more"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function Book({
  feed,
  seenAt,
  now,
  phone,
  onNavigate,
}: Pick<HomeViewProps, "feed" | "seenAt" | "now" | "onNavigate"> & { phone: boolean }) {
  const [filter, setFilter] = useState<HomeFilter>("all");
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      {phone ? (
        <>
          <CardHead title="The visitors’ book" subtitle="Newest first" headingLevel={2} />
          <ScrollRow gap={6} label="Show">
            {HOME_FILTERS.map((item) => (
              <FilterChip key={item.value} label={item.label} on={filter === item.value} onClick={() => setFilter(item.value)} />
            ))}
          </ScrollRow>
        </>
      ) : (
        <CardHead
          title="The visitors’ book"
          subtitle="Builds, rebuilds, reproduction notes and asks — newest first"
          headingLevel={2}
          action={<Segmented<HomeFilter> label="Show" size={28} fontSize={12} value={filter} onChange={setFilter} items={HOME_FILTERS} />}
        />
      )}
      <div style={{ marginTop: 8 }}>
        <BookBody feed={feed} filter={filter} seenAt={seenAt} now={now} phone={phone} onNavigate={onNavigate} />
      </div>
    </section>
  );
}

/* ── the run counts ── */

const runsUnit = (n: number) => (n === 1 ? "run" : "runs");

function RunCounts({
  reproducedToday,
  runsThisWeek,
  failure,
}: {
  reproducedToday: number | null;
  runsThisWeek: number | null;
  failure?: PanelFailure;
}) {
  const part = asidePart(0, 24);
  if (failure) {
    return (
      <div style={part}>
        <ErrorState panel="Run counts" onRetry={failure.onRetry} error={failure.error} data-testid="home-orbs-error" />
      </div>
    );
  }

  const grid: CSSProperties = { ...part, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 };
  const bone = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Skeleton width="70%" height={12} />
      <Skeleton width={48} height={26} />
    </div>
  );
  const figures = (
    <>
      {reproducedToday === null ? (
        bone
      ) : (
        <Figure lamp label="Reproduced today" value={reproducedToday.toLocaleString("en-GB")} unit={runsUnit(reproducedToday)} />
      )}
      {runsThisWeek === null ? bone : <Figure label="This week" value={runsThisWeek.toLocaleString("en-GB")} unit="runs reported" />}
    </>
  );
  if (reproducedToday === null || runsThisWeek === null) {
    return (
      <LoadingRegion what="the run counts" style={grid}>
        {figures}
      </LoadingRegion>
    );
  }
  return (
    <div data-testid="home-run-counts" style={grid}>
      {figures}
    </div>
  );
}

/* ── challenges ── */

/** Done is evidence; under way is the lamp's colour, whatever the challenge measures. */
const barTone = (row: HomeChallengeRow) => (row.done >= row.target ? t.evidence : t.lit);

function countText(row: HomeChallengeRow, phone: boolean): string {
  if (phone) return `${row.done}/${row.target}`;
  const done = row.done >= row.target;
  const tail = done ? " · done" : row.xp ? ` · +${row.xp} xp` : "";
  return `${row.done} / ${row.target}${tail}`;
}

const challengeRow = (first: boolean): CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "12px 0",
  borderTop: first ? undefined : `1px solid ${t.hairline}`,
});

function ChallengeList({ rows, phone }: { rows: readonly HomeChallengeRow[]; phone: boolean }) {
  return (
    <div data-testid="home-challenges">
      {rows.map((row, index) => (
        <div key={row.slug} data-testid="weekly-challenge" style={challengeRow(index === 0)}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={text(12.5, 500, t.text, { flexGrow: 1, minWidth: 0 })}>{row.title}</span>
            <span style={text(11.5, 400, t.label, { ...tnum, whiteSpace: "nowrap" })}>{countText(row, phone)}</span>
          </div>
          <StripedBar
            value={(row.done / Math.max(1, row.target)) * 100}
            colour={barTone(row)}
            height={4}
            label={row.title}
            valueText={`${row.done} of ${row.target}`}
          />
        </div>
      ))}
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
          <div key={i} style={challengeRow(i === 0)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, height: 15 }}>
              <Skeleton width="58%" height={12} />
              <Skeleton width={phone ? 28 : 72} height={11} />
            </div>
            <Skeleton height={4} radius={1} />
          </div>
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
        style={{ paddingTop: 8 }}
        data-testid="home-challenges-error"
      />
    );
  }
  return <ChallengeList rows={challenges.data} phone={phone} />;
}

function Challenges({
  challenges,
  thisWeekHref,
  phone,
  onNavigate,
}: Pick<HomeViewProps, "challenges" | "thisWeekHref" | "onNavigate"> & { phone: boolean }) {
  const expand =
    !phone && thisWeekHref && challenges.status !== "signed-out" ? (
      <IconButton icon={Maximize2} glyph="chev" label="Open this week" size={28} onClick={() => onNavigate(thisWeekHref)} />
    ) : undefined;
  return (
    <section style={asidePart(8, 12)}>
      <CardHead title="This week’s challenges" subtitle="Resets Monday 00:00 UTC" headingLevel={2} action={expand} />
      <ChallengesBody challenges={challenges} phone={phone} onNavigate={onNavigate} />
    </section>
  );
}

/* ── the streak ── */

function Streak({ streak, last, onNavigate }: { streak: HomeViewProps["streak"]; last: boolean; onNavigate: (to: string) => void }) {
  const part = asidePart(16, last ? null : 24);

  if (streak.status === "ready" && streak.data.count > 0) {
    const { count, frozenUsed, week } = streak.data;
    return (
      <section style={part}>
        <CardHead title={`${count}-day streak`} subtitle={frozenLabel(frozenUsed)} headingLevel={2} />
        <StreakWeek data-testid="home-streak-week">
          {week.map((state, index) => (
            <StreakDay key={index} state={state} dayName={DAY_NAMES[index]} letter={DAY_LETTERS[index]} />
          ))}
        </StreakWeek>
      </section>
    );
  }

  if (streak.status === "loading") {
    return (
      <section style={part}>
        <LoadingRegion what="your streak" data-testid="home-streak-loading" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CardHead title="Streak" subtitle={" "} headingLevel={2} />
          <div style={{ display: "flex", gap: 6 }}>
            {DAY_LETTERS.map((_, index) => (
              <div key={index} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Skeleton width="100%" height={32} radius={6} />
                <Skeleton width={8} height={11} radius={2} />
              </div>
            ))}
          </div>
        </LoadingRegion>
      </section>
    );
  }

  return (
    <section style={part}>
      <CardHead title="Streak" headingLevel={2} />
      {streak.status === "error" ? (
        <ErrorState panel="Streak" onRetry={streak.onRetry} error={streak.error} data-testid="home-streak-error" />
      ) : (
        <EmptyState
          line="Run a build today to start a streak."
          action={streak.status === "signed-out" ? { label: "Sign in", onClick: () => onNavigate(SIGN_IN) } : undefined}
          data-testid="home-streak-empty"
        />
      )}
    </section>
  );
}

/* ── where next ── */

const nextRow = (first: boolean): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  minHeight: 52,
  boxSizing: "border-box",
  borderTop: first ? undefined : `1px solid ${t.hairline}`,
  textDecoration: "none",
  color: "inherit",
});

function WhereNext({ whereNext, onNavigate }: Pick<HomeViewProps, "whereNext" | "onNavigate">) {
  let body: ReactNode;
  if (whereNext.status === "loading") {
    body = (
      <LoadingRegion what="suggestions" data-testid="home-where-next-loading">
        {[0, 1, 2].map((i) => (
          <div key={i} style={nextRow(i === 0)}>
            <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <Skeleton width="62%" height={13} />
              <Skeleton width="40%" height={10} />
            </div>
            <Skeleton width={56} height={16} radius={2} />
          </div>
        ))}
      </LoadingRegion>
    );
  } else if (whereNext.status === "error") {
    body = <ErrorState panel="Where next" onRetry={whereNext.onRetry} error={whereNext.error} data-testid="home-where-next-error" />;
  } else if (whereNext.status === "signed-out" || whereNext.data.length === 0) {
    body = (
      <EmptyState
        line="Run a build this week and suggestions appear here."
        action={
          whereNext.status === "signed-out"
            ? { label: "Sign in", onClick: () => onNavigate(SIGN_IN) }
            : { label: "Enter the gallery", onClick: () => onNavigate(GALLERY) }
        }
        data-testid="home-where-next-empty"
      />
    );
  } else {
    body = (
      <div data-testid="home-where-next">
        {whereNext.data.map((row, index) => (
          <FrameLink key={row.id} to={row.href} data-testid="home-where-next-row" style={nextRow(index === 0)}>
            <span style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={text(12.5, 500, t.text, ellipsis)}>{row.title}</span>
              <span style={text(10.5, 500, t.label, { ...ellipsis, letterSpacing: ".04em" })}>{row.reason}</span>
            </span>
            <Sparkline values={row.spark} width={56} height={16} tone={t.text2} />
          </FrameLink>
        ))}
      </div>
    );
  }

  return (
    <section style={asidePart(8, null)}>
      <CardHead title="Where next" subtitle="From what you ran this week" headingLevel={2} />
      {body}
    </section>
  );
}

/* ── the two layouts ── */

function DesktopHome(props: HomeViewProps) {
  const { now, scope, onScopeChange, litToday, reproducedToday, runsThisWeek, orbsError, feed, seenAt, challenges, thisWeekHref, streak, whereNext, onNavigate } = props;
  return (
    <div
      data-testid="home-view"
      data-viewport="desktop"
      data-look="refined"
      style={{ display: "flex", flexWrap: "wrap", gap: 48, alignItems: "flex-start" }}
    >
      <div style={{ flex: "999 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 40 }}>
        <Hero scope={scope} onScopeChange={onScopeChange} litToday={litToday} phone={false} onNavigate={onNavigate} />
        <Book feed={feed} seenAt={seenAt} now={now} phone={false} onNavigate={onNavigate} />
      </div>
      <aside
        style={{
          flex: "1 1 300px",
          maxWidth: 340,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 24,
          paddingLeft: 32,
          borderLeft: `1px solid ${t.hairline}`,
        }}
      >
        <RunCounts reproducedToday={reproducedToday} runsThisWeek={runsThisWeek} failure={orbsError} />
        <Challenges challenges={challenges} thisWeekHref={thisWeekHref} phone={false} onNavigate={onNavigate} />
        <Streak streak={streak} last={false} onNavigate={onNavigate} />
        <WhereNext whereNext={whereNext} onNavigate={onNavigate} />
      </aside>
    </div>
  );
}

function PhoneHome(props: HomeViewProps) {
  const { now, scope, onScopeChange, litToday, reproducedToday, runsThisWeek, orbsError, feed, seenAt, challenges, streak, onNavigate } = props;
  return (
    <div
      data-testid="home-view"
      data-viewport="mobile"
      data-look="refined"
      style={{ display: "flex", flexDirection: "column", gap: 32, minWidth: 0 }}
    >
      <Hero scope={scope} onScopeChange={onScopeChange} litToday={litToday} phone onNavigate={onNavigate} />
      <RunCounts reproducedToday={reproducedToday} runsThisWeek={runsThisWeek} failure={orbsError} />
      <Challenges challenges={challenges} phone onNavigate={onNavigate} />
      <Book feed={feed} seenAt={seenAt} now={now} phone onNavigate={onNavigate} />
      <Streak streak={streak} last onNavigate={onNavigate} />
    </div>
  );
}

export function RefinedHomeView(props: HomeViewProps) {
  const phone = useIsPhone();
  return phone ? <PhoneHome {...props} /> : <DesktopHome {...props} />;
}

export default RefinedHomeView;

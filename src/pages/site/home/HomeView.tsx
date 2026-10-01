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
import { FilterChip } from "@/components/brand/FilterChip";
import { IconButton } from "@/components/brand/IconButton";
import { LampDot } from "@/components/brand/LampDot";
import { OrbGlass } from "@/components/brand/OrbGlass";
import { OrbSolid } from "@/components/brand/OrbSolid";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { Plaque } from "@/components/brand/Plaque";
import { Segmented } from "@/components/brand/Segmented";
import { StripedBar } from "@/components/brand/StripedBar";
import { Tagline } from "@/components/brand/Tagline";
import { Sparkline } from "@/components/brand/charts";
import { FrameLink } from "@/components/shell/FrameLink";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { skeletonStyle } from "@/lib/theme/controls";
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
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; data: T };

export interface HomeFeedProps {
  status: "loading" | "error" | "ready";
  rows: readonly HomeFeedRow[];
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
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

/** One Sentient line, the empty state's sentence. */
function EmptyLine({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return <p style={{ ...display(size), color: t.text, margin: 0 }}>{children}</p>;
}

function Empty({ line, action, size, children }: { line: string; action?: ReactNode; size?: number; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, paddingTop: 14 }}>
      <EmptyLine size={size}>{line}</EmptyLine>
      {action}
      {children}
    </div>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, paddingTop: 14 }}>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "normal", color: t.text2 }}>This could not be loaded.</p>
      <Button variant="secondary" size={30} fontSize={12} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function Skeleton({ height, style }: { height: number; style?: CSSProperties }) {
  return <div aria-hidden="true" style={{ ...skeletonStyle(), height, ...style }} />;
}

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
      <div aria-busy="true" aria-label="Loading the visitors’ book" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={phone ? 96 : 72} style={{ borderRadius: 14 }} />
        ))}
      </div>
    );
  }

  if (feed.status === "error") return <Failed onRetry={feed.onRetry} />;

  if (feed.rows.length === 0) {
    return (
      <Empty
        line="Nothing hung yet."
        size={22}
        action={
          <Button size={phone ? 44 : 34} fontSize={phone ? 13 : 12} variant="secondary" onClick={() => onNavigate(GALLERY)}>
            Enter the gallery
          </Button>
        }
      />
    );
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

function OrbPlaceholder({ size }: { size: number }) {
  return <div aria-hidden="true" style={{ width: size, height: size, borderRadius: r.full, background: t.recess, flexShrink: 0 }} />;
}

const runs = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "run" : "runs"}`;

function Orbs({ size, reproducedToday, runsThisWeek }: { size: number; reproducedToday: number | null; runsThisWeek: number | null }) {
  return (
    <>
      {reproducedToday === null ? (
        <OrbPlaceholder size={size} />
      ) : (
        <OrbGlass size={size} label="Reproduced today" sub={runs(reproducedToday)} />
      )}
      {runsThisWeek === null ? (
        <OrbPlaceholder size={size} />
      ) : (
        <OrbSolid size={size} top="This week" value={runsThisWeek.toLocaleString("en-GB")} bottom="runs reported" />
      )}
    </>
  );
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
      <Empty
        line="Sign in to take this week's challenges."
        action={
          <Button size={phone ? 44 : 34} fontSize={phone ? 13 : 12} variant="secondary" onClick={() => onNavigate(SIGN_IN)}>
            Sign in
          </Button>
        }
      />
    );
  }
  if (challenges.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading this week’s challenges" style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 14 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={34} />
        ))}
      </div>
    );
  }
  if (challenges.status === "error") return <Failed onRetry={challenges.onRetry} />;
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

function StreakPanel({ streak }: { streak: HomeViewProps["streak"] }) {
  const lines = (() => {
    if (streak.status === "ready" && streak.data.count > 0) {
      const { count, frozenUsed, week } = streak.data;
      return (
        <>
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
        </>
      );
    }
    return (
      <>
        <PanelHead title="Streak" headingLevel={2} />
        {streak.status === "loading" ? (
          <Skeleton height={44} style={{ marginTop: 12 }} />
        ) : streak.status === "error" ? (
          <Failed onRetry={streak.onRetry} />
        ) : (
          <Empty line="Run a build today to start a streak." />
        )}
      </>
    );
  })();

  return <Panel padding="14px 16px">{lines}</Panel>;
}

/* ── where next ── */

function WhereNextPanel({ whereNext, onNavigate }: { whereNext: HomeViewProps["whereNext"]; onNavigate: (to: string) => void }) {
  const gallery = (
    <Button size={34} fontSize={12} variant="secondary" onClick={() => onNavigate(GALLERY)}>
      Enter the gallery
    </Button>
  );

  return (
    <Panel padding="14px 16px" style={{ flex: 1 }}>
      <PanelHead title="Where next" subtitle="From what you ran this week" headingLevel={2} />
      {whereNext.status === "loading" ? (
        <div aria-busy="true" aria-label="Loading suggestions" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={34} />
          ))}
        </div>
      ) : whereNext.status === "error" ? (
        <Failed onRetry={whereNext.onRetry} />
      ) : whereNext.status === "signed-out" || whereNext.data.length === 0 ? (
        <Empty line="Run a build this week and suggestions appear here." action={gallery} />
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
  const { fit = "content", now, scope, onScopeChange, litToday, reproducedToday, runsThisWeek, feed, seenAt, challenges, thisWeekHref, streak, whereNext, onNavigate } = props;
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
            <div style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "center", height: "100%" }}>
              <Orbs size={150} reproducedToday={reproducedToday} runsThisWeek={runsThisWeek} />
            </div>
          </Panel>
        </div>

        <div style={{ height: 230, flexShrink: 0, display: "flex" }}>
          <ChallengesPanel challenges={challenges} thisWeekHref={thisWeekHref} phone={false} onNavigate={onNavigate} />
        </div>

        <StreakPanel streak={streak} />

        <div style={{ flexGrow: 1, minHeight: 0, display: "flex" }}>
          <WhereNextPanel whereNext={whereNext} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

function PhoneHome(props: HomeViewProps) {
  const { now, scope, onScopeChange, litToday, reproducedToday, runsThisWeek, feed, seenAt, challenges, streak, onNavigate } = props;
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

      <div style={{ display: "flex", justifyContent: "center", gap: 12, padding: "4px 0" }}>
        <Orbs size={162} reproducedToday={reproducedToday} runsThisWeek={runsThisWeek} />
      </div>

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

      <StreakPanel streak={streak} />
    </div>
  );
}

export function HomeView(props: HomeViewProps) {
  const phone = useIsPhone();
  return phone ? <PhoneHome {...props} /> : <DesktopHome {...props} />;
}

export default HomeView;

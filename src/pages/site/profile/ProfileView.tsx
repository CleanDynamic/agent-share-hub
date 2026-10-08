/* UI-P34 — /profile/:handle in the site frame.

   PURE. A maker's banner, their level and track, four figures, their works, a
   22-week activity grid and their creator marks. Typed props only: no fetching,
   no `useAuth()`, no router hooks but `Link`. The viewport is read here (the
   768px breakpoint), so the live page and the compare page behave the same.

   DESKTOP: a column, gap 9. Row 1 is the banner (220) beside the level panel
   (440). Row 2 is the stats wall label at its natural height. Row 3 fills: the
   works on the left, and on the right (360) a column of Activity and Creator
   marks that share the height. PHONE: the banner, the actions, the level panel
   with the tracks as chips, the stats in two columns, the works as chips over a
   two-column grid, the activity grid and the creator marks.

   A FIGURE'S BAR IS ONLY DRAWN WHERE IT MEASURES SOMETHING. `figures.bars` holds
   progress to a creator-mark threshold for the figures that have one; where it
   is absent the Stat has no bar, rather than a bar that says what is not known.

   DENSER SINCE UI-P57: every size this file sets itself is the tightened board's
   (`design/prompts/README-density.md`): rows and columns 9 apart, the level
   block 12 / 6, the works' grid 9 (4px 7px on a phone), marks 9 under their
   head. The banner (220), the level ring and the orbs are over 64 and keep their
   size; the brand pieces map their own. */

import type { CSSProperties, ReactNode } from "react";
import { Flame } from "lucide-react";
import { Link } from "react-router-dom";

import { ActivityGrid, type ActivityDay } from "@/components/brand/ActivityGrid";
import { EmptyState } from "@/components/brand/EmptyState";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { ErrorState, type PanelFailure } from "@/components/brand/ErrorState";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { OrbRing } from "@/components/brand/OrbRing";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { MarkTile } from "@/components/brand/RankRung";
import { Segmented } from "@/components/brand/Segmented";
import { CardSkeleton, LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { Button } from "@/components/brand/Button";
import { Stat } from "@/components/brand/Stat";
import { UnderlineTabs } from "@/components/brand/UnderlineTabs";
import { WallLabel } from "@/components/brand/WallLabel";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { sideTrack, useIsPhone, useTierFit, useWidthTier, type WidthTier } from "@/components/shell/useMinWidth";
import type { TrackId } from "@/lib/progress";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { display, FIGTREE, mono } from "@/lib/theme/type";

import { ProfileActions, ProfileBanner, type ProfileMakerView } from "./ProfileBanner";
import {
  RING_CAPTION,
  TRACK_ITEMS,
  WORKS_TABS,
  emptyLine,
  formatCount,
  formatPounds,
  remainingLine,
  ringLabel,
  streakLine,
  tabLabel,
  trackLabel,
  xpLine,
  type CollectionTileView,
  type FiguresView,
  type LevelView,
  type MarkView,
  type WorksTab,
  type WorksView,
} from "./profileModel";

export interface ProfileViewProps {
  fit?: PageFit;
  /** Null while the profile itself is on its way: the banner holds its place and every panel waits. */
  maker: ProfileMakerView | null;
  /** The viewer is the maker: Edit profile in place of Follow, and the track can be changed. */
  isOwn: boolean;
  following: boolean;
  followBusy?: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  /** Absent where messaging is not offered. */
  onMessage?: () => void;
  onEdit?: () => void;
  /** Null while it loads. */
  level: LevelView | null;
  /** Called with the track picked, on your own profile. */
  onTrack?: (track: TrackId) => void;
  /** Null while it loads. */
  figures: FiguresView | null;
  /**
   * Whether the figures will carry bars, so that while they load each cell holds its
   * bar's place and the row is the height it will be. The live page has no creator-mark
   * thresholds to measure against and says false; the sample draws them.
   */
  figuresBarsExpected?: boolean;
  works: WorksView;
  /** Null while it loads. */
  activity: readonly ActivityDay[] | null;
  /** Null while it loads. */
  marks: readonly MarkView[] | null;
  /** A panel whose read failed says so in its own place, and the rest carry on. */
  failed?: Partial<Record<"level" | "figures" | "activity" | "marks", PanelFailure>>;
}

export const ACTIVITY_TITLE = "Activity";
export const ACTIVITY_SUBTITLE = "22 weeks · outlined days were frozen";
export const MARKS_TITLE = "Creator marks";
export const MARKS_SUBTITLE = "Common · rare · highest";

const COLUMN: CSSProperties = { display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 };

/* ── the level panel ── */

function StreakRow({ view, phone }: { view: LevelView; phone: boolean }) {
  const line = streakLine(view, phone);
  if (!line) return null;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: t.text2 }}>
      <Flame size={15} strokeWidth={1.6} color={t.litInk} aria-hidden="true" style={{ flexShrink: 0 }} />
      {line}
    </div>
  );
}

/** The level panel before it has arrived: the orb's circle, the track and its figures as bones — and on a phone the track chips' row. */
function LevelSkeleton({ phone }: { phone: boolean }) {
  const orb = phone ? 118 : 150;
  return (
    <Panel surface="glass" padding={phone ? "16px" : "16px 18px"} style={phone ? undefined : { height: "100%" }}>
      <LoadingRegion what="the level" data-testid="profile-level-loading">
        <div style={{ display: "flex", gap: phone ? 10 : 12, alignItems: "center" }}>
          <Skeleton width={orb} height={orb} radius="50%" />
          <div style={{ display: "flex", flexDirection: "column", gap: phone ? 4 : 6, flexGrow: 1, minWidth: 0 }}>
            <Skeleton width={phone ? 96 : 48} height={11} />
            {phone ? null : <Skeleton height={25} radius={r.control} />}
            <Skeleton width={phone ? "70%" : "54%"} height={phone ? 15 : 14} />
            {phone ? <Skeleton width="56%" height={15} /> : null}
            <Skeleton width="42%" height={15} />
          </div>
        </div>
        {phone ? (
          <div style={{ display: "flex", gap: 4, margin: "10px -2px 0" }}>
            {[78, 70, 66, 74].map((width, index) => (
              <Skeleton key={index} width={width} height={30} radius={r.media} />
            ))}
          </div>
        ) : null}
      </LoadingRegion>
    </Panel>
  );
}

function LevelPanel({
  level,
  failure,
  isOwn,
  onTrack,
  phone,
}: {
  level: LevelView | null;
  failure?: PanelFailure;
  isOwn: boolean;
  onTrack?: (track: TrackId) => void;
  phone: boolean;
}) {
  const orb = phone ? 118 : 150;
  const editable = isOwn && Boolean(onTrack);

  if (failure) {
    return (
      <Panel surface="glass" padding={phone ? "16px" : "16px 18px"} style={phone ? undefined : { height: "100%" }}>
        <ErrorState panel="Level" onRetry={failure.onRetry} error={failure.error} data-testid="profile-level-error" />
      </Panel>
    );
  }

  if (!level) return <LevelSkeleton phone={phone} />;

  const xp = xpLine(level);
  const remaining = remainingLine(level);
  const track = level.track;
  const trackItems = TRACK_ITEMS.map((item) => ({ value: item.value, label: item.label }));

  const orbNode = <OrbRing size={orb} percent={level.percent} value={level.level} caption={RING_CAPTION} label={ringLabel(level)} />;

  if (phone) {
    const name = trackLabel(track);
    return (
      <Panel surface="glass" padding="16px">
        <div data-testid="profile-level" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {orbNode}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <Eyebrow>{name ? `${name} track` : "Track"}</Eyebrow>
            {xp ? <div style={{ ...mono(13), lineHeight: "normal", color: t.text }}>{xp}</div> : null}
            {remaining ? <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: t.text2 }}>{remaining}</div> : null}
            <StreakRow view={level} phone />
          </div>
        </div>
        <div style={{ margin: "10px -2px 0" }}>
          <ScrollRow gap={6} label="Track">
            {TRACK_ITEMS.map((item) => (
              <FilterChip
                key={item.value}
                label={item.label}
                on={item.value === track}
                aria-disabled={editable ? undefined : true}
                onClick={editable ? () => onTrack?.(item.value) : undefined}
                style={editable ? undefined : { cursor: "default" }}
              />
            ))}
          </ScrollRow>
        </div>
      </Panel>
    );
  }

  return (
    <Panel surface="glass" padding="16px 18px" style={{ height: "100%" }}>
      <div data-testid="profile-level" style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {orbNode}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexGrow: 1, minWidth: 0 }}>
          <Eyebrow>Track</Eyebrow>
          <Segmented<TrackId>
            items={trackItems}
            value={(track ?? "") as TrackId}
            onChange={(next) => onTrack?.(next)}
            size={30}
            fontSize={11}
            label="Track"
            readOnly={!editable}
          />
          {xp ? (
            <div style={{ ...mono(12), lineHeight: "normal", color: t.text2 }}>
              {xp}
              {remaining ? ` · ${remaining}` : ""}
            </div>
          ) : null}
          <StreakRow view={level} phone={false} />
        </div>
      </div>
    </Panel>
  );
}

/* ── the stats ── */

function StatsWall({
  figures,
  barsExpected,
  failure,
  phone,
}: {
  figures: FiguresView | null;
  barsExpected: boolean;
  failure?: PanelFailure;
  phone: boolean;
}) {
  if (failure) {
    return (
      <div
        data-testid="profile-stats-error"
        style={{
          minHeight: phone ? 169 : 84,
          boxSizing: "border-box",
          padding: "9px 10px",
          borderRadius: r.control,
          border: `1px solid ${t.line}`,
          display: "flex",
          alignItems: "center",
        }}
      >
        <ErrorState panel="Maker figures" onRetry={failure.onRetry} error={failure.error} />
      </div>
    );
  }

  /* A figure's bone is as tall as the number's line (25px), and holds its bar's place where the figures will carry one. */
  const loading = <Skeleton width={46} height={18} style={{ margin: "1px 0 2px" }} />;
  const waiting = figures === null && barsExpected;
  const bars = figures?.bars;
  const cells = [
    <Stat key="builds" label="Builds hung" value={figures ? formatCount(figures.buildsHung) : loading} />,
    <Stat
      key="reproduced"
      label="Reproduced by others"
      value={figures ? formatCount(figures.reproducedByOthers) : loading}
      barLoading={waiting}
      bar={
        figures && bars?.reproduced !== undefined
          ? { value: bars.reproduced, colour: t.evidence, label: "Progress to the next creator mark for reproductions" }
          : undefined
      }
    />,
    <Stat
      key="rebuilds"
      label="Rebuilds of their work"
      value={figures ? formatCount(figures.rebuildsOfWork) : loading}
      barLoading={waiting}
      bar={
        figures && bars?.rebuilds !== undefined
          ? { value: bars.rebuilds, colour: t.catAgents, label: "Progress to the next creator mark for rebuilds" }
          : undefined
      }
    />,
    <Stat
      key="bounties"
      label="Bounties solved"
      value={figures ? formatCount(figures.bountiesSolved) : loading}
      of={figures && !phone ? formatPounds(figures.bountyEarningsGbp) : undefined}
      barLoading={waiting}
      bar={
        figures && bars?.bounties !== undefined
          ? { value: bars.bounties, colour: t.action, label: "Progress to the next creator mark for bounties" }
          : undefined
      }
    />,
  ];
  const label = <WallLabel columns={phone ? 2 : 4} cells={cells} />;
  return figures ? (
    <div data-testid="profile-stats">{label}</div>
  ) : (
    <LoadingRegion what="the maker’s figures" data-testid="profile-stats">
      {label}
    </LoadingRegion>
  );
}

/* ── the works ── */

function CollectionTile({ tile, phone }: { tile: CollectionTileView; phone: boolean }) {
  const cells = tile.covers.slice(0, 4);
  return (
    <Link
      to={tile.to}
      data-testid="profile-collection"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        padding: 5,
        background: t.glass,
        border: `1px solid ${t.glassBorder}`,
        borderRadius: r.card,
        boxShadow: t.shadowCard,
        boxSizing: "border-box",
        textDecoration: "none",
        color: t.text,
        minWidth: 0,
      }}
    >
      <div
        style={{
          height: phone ? 90 : 86,
          borderRadius: r.media,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 2,
        }}
      >
        {cells.map((cover, index) => (
          <div key={index} style={{ position: "relative", overflow: "hidden", minHeight: 0 }}>
            {cover}
          </div>
        ))}
      </div>
      <div style={{ padding: "0 5px 5px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <h3 style={{ ...display(17), margin: 0, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {tile.title}
        </h3>
        <div style={{ fontFamily: FIGTREE, fontSize: 11, lineHeight: "normal", color: t.text2 }}>{tile.count}</div>
      </div>
    </Link>
  );
}

/** What a tab's panel is loading, as `Loading …` reads it. */
const WORKS_NOUN: Record<WorksTab, string> = {
  builds: "builds",
  rebuilds: "rebuilds",
  reproduced: "reproduced builds",
  collections: "collections",
};

/** The desktop works grid's columns at each width tier (UI-P39): 4 from 1280, 3 to 1024, 2 below. */
const WORKS_COLUMNS: Record<WidthTier, number> = { full: 4, split: 3, stacked: 2 };

function WorksBody({ works, isOwn, phone }: { works: WorksView; isOwn: boolean; phone: boolean }) {
  const tier = useWidthTier();
  const columns = `repeat(${phone ? 2 : WORKS_COLUMNS[tier]}, minmax(0, 1fr))`;
  const grid: CSSProperties = { display: "grid", gridTemplateColumns: columns, gap: phone ? "4px 7px" : 9, alignItems: "start" };
  const variant = phone ? "phone" : "desktop";

  if (works.status === "loading") {
    return (
      <LoadingRegion what={WORKS_NOUN[works.tab]} data-testid="profile-works-loading" style={grid}>
        {Array.from({ length: 4 }, (_, index) => (
          <CardSkeleton key={index} cover={phone ? 90 : 86} body={138} />
        ))}
      </LoadingRegion>
    );
  }

  if (works.status === "error") {
    return (
      <ErrorState
        /* A refusal is its own sentence, never an empty tab. */
        line={works.errorKind === "permission" ? "You don't have access to this." : undefined}
        panel="Works"
        onRetry={works.onRetry}
        error={works.error}
        style={{ paddingTop: 6 }}
        data-testid="profile-works-error"
      />
    );
  }

  const collections = works.tab === "collections";
  const count = collections ? works.collections.length : works.cards.length;
  if (count === 0) return <EmptyState line={emptyLine(works.tab, isOwn)} data-testid="profile-works-empty" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div data-testid="profile-works-grid" style={grid}>
        {collections
          ? works.collections.map((tile) => <CollectionTile key={tile.key} tile={tile} phone={phone} />)
          : works.cards.map((card) => (
              <div key={card.key} data-testid="profile-card" style={{ minWidth: 0 }}>
                {card.render(variant)}
              </div>
            ))}
      </div>
      {works.hasMore ? (
        <div>
          <Button variant="secondary" size={phone ? 44 : 36} disabled={works.loadingMore} data-testid="profile-show-more" onClick={works.onMore}>
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function tabItems(counts: WorksView["counts"]) {
  return WORKS_TABS.map((tab) => ({
    value: tab.value,
    label: tabLabel(tab.label, counts[tab.value]),
    id: `profile-tab-${tab.value}`,
    controls: `profile-panel`,
  }));
}

function WorksPanel({ works, isOwn, fill }: { works: WorksView; isOwn: boolean; fill: boolean }) {
  return (
    <Panel surface="glass" padding="12px 16px 14px" style={fill ? { height: "100%" } : undefined}>
      <div data-testid="profile-works" style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: 4 }}>
          <UnderlineTabs<WorksTab>
            tabs={tabItems(works.counts)}
            value={works.tab}
            onChange={works.onTab}
            fontSize={13}
            label="Works"
          />
        </div>
        <div role="tabpanel" id="profile-panel" aria-labelledby={`profile-tab-${works.tab}`}>
          <WorksBody works={works} isOwn={isOwn} phone={false} />
        </div>
      </div>
    </Panel>
  );
}

function PhoneWorks({ works, isOwn }: { works: WorksView; isOwn: boolean }) {
  return (
    <div data-testid="profile-works" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <ScrollRow gap={6} label="Works" tablist>
        {WORKS_TABS.map((tab) => (
          <FilterChip
            key={tab.value}
            label={tabLabel(tab.label, works.counts[tab.value])}
            on={tab.value === works.tab}
            tab={{ id: `profile-tab-${tab.value}`, controls: "profile-panel" }}
            onClick={() => works.onTab(tab.value)}
          />
        ))}
      </ScrollRow>
      <div role="tabpanel" id="profile-panel" aria-labelledby={`profile-tab-${works.tab}`}>
        <WorksBody works={works} isOwn={isOwn} phone />
      </div>
    </div>
  );
}

/* ── activity and creator marks ── */

function ActivityPanel({
  days,
  failure,
  phone,
  fill,
}: {
  days: readonly ActivityDay[] | null;
  failure?: PanelFailure;
  phone: boolean;
  fill: boolean;
}) {
  return (
    <Panel surface="glass" padding="14px 16px" style={fill ? { height: "100%" } : undefined}>
      <div data-testid="profile-activity">
        {/* The phone board draws this head at 16 (15 rendered), the desktop one at 13 (12). */}
        <PanelHead title={ACTIVITY_TITLE} subtitle={ACTIVITY_SUBTITLE} titleSize={phone ? 16 : 13} headingLevel={2} />
        <div style={{ marginTop: 9, overflow: phone ? "hidden" : undefined }}>
          {failure ? (
            <ErrorState panel="Activity" onRetry={failure.onRetry} error={failure.error} data-testid="profile-activity-error" />
          ) : days ? (
            <ActivityGrid days={days} />
          ) : (
            <LoadingRegion what="the activity grid" data-testid="profile-activity-loading">
              <Skeleton height={7 * 12 + 6 * 3} />
            </LoadingRegion>
          )}
        </div>
      </div>
    </Panel>
  );
}

function MarksPanel({
  marks,
  failure,
  isOwn,
  phone,
  fill,
}: {
  marks: readonly MarkView[] | null;
  failure?: PanelFailure;
  isOwn: boolean;
  phone: boolean;
  fill: boolean;
}) {
  const tiles = (marks ?? []).map((mark) => <MarkTile key={mark.key} tier={mark.tier} caption={mark.name} />);
  return (
    <Panel surface="glass" padding="14px 16px" style={fill ? { height: "100%" } : undefined}>
      <div data-testid="profile-marks">
        <PanelHead title={MARKS_TITLE} subtitle={MARKS_SUBTITLE} titleSize={13} headingLevel={2} />
        {failure ? (
          <ErrorState panel="Creator marks" onRetry={failure.onRetry} error={failure.error} style={{ paddingTop: 9 }} data-testid="profile-marks-error" />
        ) : marks === null ? (
          <LoadingRegion what="the creator marks" data-testid="profile-marks-loading" style={{ marginTop: 9 }}>
            {/* Five tiles of 64 by 54 (64 square before UI-P57), spread across the panel as the marks are. */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} width={64} height={54} radius={r.control} />
              ))}
            </div>
          </LoadingRegion>
        ) : tiles.length === 0 ? (
          <EmptyState line={isOwn ? "Publish a build to earn your first." : "No creator marks yet."} data-testid="profile-marks-empty" />
        ) : phone ? (
          <div style={{ margin: "9px -2px 0" }}>
            <ScrollRow gap={8} label="Creator marks">
              {tiles}
            </ScrollRow>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9 }}>{tiles}</div>
        )}
      </div>
    </Panel>
  );
}

/* ── the page ── */

/** The banner's place while the profile is on its way: the page's own announcement, and a block as tall as the banner. */
function BannerSkeleton({ phone }: { phone: boolean }) {
  return (
    <LoadingRegion what="the profile" announce data-testid="profile-banner-loading" style={phone ? undefined : { height: "100%" }}>
      <Skeleton height={phone ? 290 : "100%"} radius={phone ? 18 : r.panel} />
    </LoadingRegion>
  );
}

export function ProfileView({
  fit: givenFit = "content",
  maker,
  isOwn,
  following,
  followBusy,
  onFollow,
  onUnfollow,
  onMessage,
  onEdit,
  level,
  onTrack,
  figures,
  figuresBarsExpected = false,
  works,
  activity,
  marks,
  failed = {},
}: ProfileViewProps) {
  const phone = useIsPhone();
  const fit = useTierFit(givenFit);
  const actions = { isOwn, following, followBusy, onFollow, onUnfollow, onMessage: isOwn ? undefined : onMessage, onEdit };
  const twoActions = !isOwn && Boolean(actions.onMessage);
  /* UI-P39: below 1024 each row's right track stacks under its left, in the phone's order. */
  const stacked = useWidthTier() === "stacked";

  if (phone) {
    return (
      <div data-testid="profile-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 9, lineHeight: "normal" }}>
        {maker ? <ProfileBanner maker={maker} phone {...actions} /> : <BannerSkeleton phone />}
        {maker ? (
          <div style={{ display: "grid", gridTemplateColumns: twoActions ? "1fr 1fr" : "1fr", gap: 6 }}>
            <ProfileActions {...actions} phone />
          </div>
        ) : (
          /* The actions' row: drawn 48, held at 44 on a phone (the touch target). */
          <Skeleton height={44} radius={r.control} />
        )}
        <LevelPanel level={level} failure={failed.level} isOwn={isOwn} onTrack={onTrack} phone />
        <StatsWall figures={figures} barsExpected={figuresBarsExpected} failure={failed.figures} phone />
        <PhoneWorks works={works} isOwn={isOwn} />
        <ActivityPanel days={activity} failure={failed.activity} phone fill={false} />
        <MarksPanel marks={marks} failure={failed.marks} isOwn={isOwn} phone fill={false} />
      </div>
    );
  }

  return (
    <div data-testid="profile-view" data-viewport="desktop" style={{ ...COLUMN, gap: 9, lineHeight: "normal", ...boardHeight(fit) }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: stacked ? "minmax(0, 1fr)" : `minmax(0, 1fr) ${sideTrack(440)}`,
          gridAutoRows: 220,
          gap: 9,
          flexShrink: 0,
        }}
      >
        <div style={{ minHeight: 0 }}>{maker ? <ProfileBanner maker={maker} {...actions} /> : <BannerSkeleton phone={false} />}</div>
        <div style={{ minHeight: 0 }}>
          <LevelPanel level={level} failure={failed.level} isOwn={isOwn} onTrack={onTrack} phone={false} />
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <StatsWall figures={figures} barsExpected={figuresBarsExpected} failure={failed.figures} phone={false} />
      </div>
      <div
        style={{
          display: "grid",
          /* The 22-week grid is 327 wide and does not scale, so this track keeps the board's 360 until the row stacks. */
          gridTemplateColumns: stacked ? "minmax(0, 1fr)" : "minmax(0, 1fr) 360px",
          gap: 9,
          flexGrow: 1,
          minHeight: 0,
        }}
      >
        <div style={{ minHeight: 0 }}>
          <WorksPanel works={works} isOwn={isOwn} fill={!stacked} />
        </div>
        <div style={{ ...COLUMN, gap: 9 }}>
          <div style={{ flexGrow: 1, minHeight: 0 }}>
            <ActivityPanel days={activity} failure={failed.activity} phone={false} fill={!stacked} />
          </div>
          <div style={{ flexGrow: 1, minHeight: 0 }}>
            <MarksPanel marks={marks} failure={failed.marks} isOwn={isOwn} phone={false} fill={!stacked} />
          </div>
        </div>
      </div>
    </div>
  );
}

const noop = () => undefined;

/** A works panel that has not been read: the Builds tab, waiting. */
const WORKS_LOADING: WorksView = {
  tab: "builds",
  onTab: noop,
  counts: {},
  status: "loading",
  cards: [],
  collections: [],
  hasMore: false,
  loadingMore: false,
  onMore: noop,
  onRetry: noop,
};

/**
 * The profile before it has arrived: the same view, every panel waiting. The panels,
 * their heads and their padding are the real ones; only what is inside them is a bone.
 */
export function ProfileViewSkeleton({ fit = "content", figuresBarsExpected }: { fit?: PageFit; figuresBarsExpected?: boolean }) {
  return (
    <ProfileView
      fit={fit}
      maker={null}
      isOwn={false}
      following={false}
      onFollow={noop}
      onUnfollow={noop}
      level={null}
      figures={null}
      figuresBarsExpected={figuresBarsExpected}
      works={WORKS_LOADING}
      activity={null}
      marks={null}
    />
  );
}

/**
 * The profile itself could not be read: the page's own panel says so, with a way to ask
 * again, inside the frame. Not "Profile not found": that is for a handle nobody has.
 */
export function ProfileLoadFailed({ onRetry, error }: { onRetry: () => void; error?: unknown }) {
  return (
    <Panel padding="24px 24px">
      <h1 style={VISUALLY_HIDDEN}>Profile</h1>
      <ErrorState panel="Profile" onRetry={onRetry} error={error} data-testid="profile-load-error" />
    </Panel>
  );
}

/** A sentence and a way on, for a profile that is not there. */
export function ProfileNotice({ line, detail, action }: { line: string; detail?: string; action?: ReactNode }) {
  return (
    <div data-testid="profile-notice" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "35px 0", textAlign: "center" }}>
      <h1 style={{ ...display(30), margin: 0, color: t.text }}>{line}</h1>
      {detail ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{detail}</p> : null}
      {action ? <div style={{ marginTop: 9 }}>{action}</div> : null}
    </div>
  );
}

export default ProfileView;

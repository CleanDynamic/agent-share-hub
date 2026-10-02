/* UI-P34 — /profile/:handle in the site frame.

   PURE. A maker's banner, their level and track, four figures, their works, a
   22-week activity grid and their creator marks. Typed props only: no fetching,
   no `useAuth()`, no router hooks but `Link`. The viewport is read here (the
   768px breakpoint), so the live page and the compare page behave the same.

   DESKTOP: a column, gap 12. Row 1 is the banner (220) beside the level panel
   (440). Row 2 is the stats wall label at its natural height. Row 3 fills: the
   works on the left, and on the right (360) a column of Activity and Creator
   marks that share the height. PHONE: the banner, the actions, the level panel
   with the tracks as chips, the stats in two columns, the works as chips over a
   two-column grid, the activity grid and the creator marks.

   A FIGURE'S BAR IS ONLY DRAWN WHERE IT MEASURES SOMETHING. `figures.bars` holds
   progress to a creator-mark threshold for the figures that have one; where it
   is absent the Stat has no bar, rather than a bar that says what is not known. */

import type { CSSProperties, ReactNode } from "react";
import { Flame } from "lucide-react";
import { Link } from "react-router-dom";

import { ActivityGrid, type ActivityDay } from "@/components/brand/ActivityGrid";
import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { FilterChip } from "@/components/brand/FilterChip";
import { OrbRing } from "@/components/brand/OrbRing";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { MarkTile } from "@/components/brand/RankRung";
import { Segmented } from "@/components/brand/Segmented";
import { Stat } from "@/components/brand/Stat";
import { UnderlineTabs } from "@/components/brand/UnderlineTabs";
import { WallLabel } from "@/components/brand/WallLabel";
import { ScrollRow } from "@/components/shell/ScrollRow";
import { boardHeight, type PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import type { TrackId } from "@/lib/progress";
import { skeletonStyle } from "@/lib/theme/controls";
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
  maker: ProfileMakerView;
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
  works: WorksView;
  /** Null while it loads. */
  activity: readonly ActivityDay[] | null;
  /** Null while it loads. */
  marks: readonly MarkView[] | null;
}

export const ACTIVITY_TITLE = "Activity";
export const ACTIVITY_SUBTITLE = "22 weeks · outlined days were frozen";
export const MARKS_TITLE = "Creator marks";
export const MARKS_SUBTITLE = "Common · rare · highest";

const COLUMN: CSSProperties = { display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 };

function Skeleton({ width, height, style }: { width?: number | string; height: number; style?: CSSProperties }) {
  return <div aria-hidden="true" style={{ ...skeletonStyle(), width, height, ...style }} />;
}

/* ── the level panel ── */

function StreakRow({ view, phone }: { view: LevelView; phone: boolean }) {
  const line = streakLine(view, phone);
  if (!line) return null;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: t.text2 }}>
      <Flame size={15} strokeWidth={1.6} color={t.litInk} aria-hidden="true" style={{ flexShrink: 0 }} />
      {line}
    </div>
  );
}

function LevelPanel({
  level,
  isOwn,
  onTrack,
  phone,
}: {
  level: LevelView | null;
  isOwn: boolean;
  onTrack?: (track: TrackId) => void;
  phone: boolean;
}) {
  const orb = phone ? 118 : 150;
  const editable = isOwn && Boolean(onTrack);

  if (!level) {
    return (
      <Panel padding={phone ? "16px" : "16px 18px"} style={phone ? undefined : { height: "100%" }}>
        <div data-testid="profile-level" role="status" aria-label="Loading level" style={{ display: "flex", gap: phone ? 14 : 16, alignItems: "center" }}>
          <Skeleton width={orb} height={orb} style={{ borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: phone ? 6 : 8, flexGrow: 1 }}>
            <Skeleton width={90} height={13} />
            <Skeleton width="80%" height={phone ? 15 : 30} />
            <Skeleton width="60%" height={14} />
          </div>
        </div>
      </Panel>
    );
  }

  const xp = xpLine(level);
  const remaining = remainingLine(level);
  const track = level.track;
  const trackItems = TRACK_ITEMS.map((item) => ({ value: item.value, label: item.label }));

  const orbNode = <OrbRing size={orb} percent={level.percent} value={level.level} caption={RING_CAPTION} label={ringLabel(level)} />;

  if (phone) {
    const name = trackLabel(track);
    return (
      <Panel padding="16px">
        <div data-testid="profile-level" style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {orbNode}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <Eyebrow>{name ? `${name} track` : "Track"}</Eyebrow>
            {xp ? <div style={{ ...mono(13), lineHeight: "normal", color: t.text }}>{xp}</div> : null}
            {remaining ? <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: t.text2 }}>{remaining}</div> : null}
            <StreakRow view={level} phone />
          </div>
        </div>
        <div style={{ margin: "14px -2px 0" }}>
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
    <Panel padding="16px 18px" style={{ height: "100%" }}>
      <div data-testid="profile-level" style={{ display: "flex", gap: 16, alignItems: "center" }}>
        {orbNode}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexGrow: 1, minWidth: 0 }}>
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

function StatsWall({ figures, phone }: { figures: FiguresView | null; phone: boolean }) {
  const loading = <Skeleton width={46} height={22} />;
  const bars = figures?.bars;
  const cells = [
    <Stat key="builds" label="Builds hung" value={figures ? formatCount(figures.buildsHung) : loading} />,
    <Stat
      key="reproduced"
      label="Reproduced by others"
      value={figures ? formatCount(figures.reproducedByOthers) : loading}
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
      bar={
        figures && bars?.bounties !== undefined
          ? { value: bars.bounties, colour: t.action, label: "Progress to the next creator mark for bounties" }
          : undefined
      }
    />,
  ];
  return (
    <div data-testid="profile-stats" aria-busy={figures ? undefined : true}>
      <WallLabel columns={phone ? 2 : 4} cells={cells} />
    </div>
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
        gap: 7,
        padding: 7,
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
      <div style={{ padding: "0 5px 5px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <h3 style={{ ...display(17), margin: 0, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {tile.title}
        </h3>
        <div style={{ fontFamily: FIGTREE, fontSize: 11, lineHeight: "normal", color: t.text2 }}>{tile.count}</div>
      </div>
    </Link>
  );
}

function WorksBody({ works, isOwn, phone }: { works: WorksView; isOwn: boolean; phone: boolean }) {
  const columns = phone ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))";
  const grid: CSSProperties = { display: "grid", gridTemplateColumns: columns, gap: phone ? "6px 10px" : 12, alignItems: "start" };
  const variant = phone ? "phone" : "desktop";

  if (works.status === "loading") {
    return (
      <div data-testid="profile-works-loading" role="status" aria-label="Loading builds" style={grid}>
        {Array.from({ length: phone ? 2 : 4 }, (_, index) => (
          <Skeleton key={index} height={phone ? 214 : 206} style={{ borderRadius: r.card }} />
        ))}
      </div>
    );
  }

  if (works.status === "error") {
    return (
      <div data-testid="profile-works-error" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, paddingTop: 8 }}>
        <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, color: t.text }}>
          {works.errorKind === "permission" ? "You don't have access to this." : "Something went wrong."}
        </p>
        <Button variant="secondary" size={36} onClick={works.onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  const collections = works.tab === "collections";
  const count = collections ? works.collections.length : works.cards.length;
  if (count === 0) {
    return (
      <p data-testid="profile-works-empty" style={{ margin: 0, paddingTop: 8, fontFamily: FIGTREE, fontSize: 13, lineHeight: "normal", color: t.text2 }}>
        {emptyLine(works.tab, isOwn)}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
    <Panel padding="12px 16px 14px" style={fill ? { height: "100%" } : undefined}>
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
    <div data-testid="profile-works" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ScrollRow gap={6} label="Works">
        {WORKS_TABS.map((tab) => (
          <FilterChip
            key={tab.value}
            label={tabLabel(tab.label, works.counts[tab.value])}
            on={tab.value === works.tab}
            onClick={() => works.onTab(tab.value)}
          />
        ))}
      </ScrollRow>
      <div role="region" aria-label="Works">
        <WorksBody works={works} isOwn={isOwn} phone />
      </div>
    </div>
  );
}

/* ── activity and creator marks ── */

function ActivityPanel({ days, phone, fill }: { days: readonly ActivityDay[] | null; phone: boolean; fill: boolean }) {
  return (
    <Panel padding="14px 16px" style={fill ? { height: "100%" } : undefined}>
      <div data-testid="profile-activity">
        <PanelHead title={ACTIVITY_TITLE} subtitle={ACTIVITY_SUBTITLE} titleSize={13} headingLevel={2} />
        <div style={{ marginTop: 12, overflow: phone ? "hidden" : undefined }}>
          {days ? (
            <ActivityGrid days={days} />
          ) : (
            <Skeleton height={7 * 12 + 6 * 3} style={{ width: "100%" }} />
          )}
        </div>
      </div>
    </Panel>
  );
}

function MarksPanel({ marks, isOwn, phone, fill }: { marks: readonly MarkView[] | null; isOwn: boolean; phone: boolean; fill: boolean }) {
  const tiles = (marks ?? []).map((mark) => <MarkTile key={mark.key} tier={mark.tier} caption={mark.name} />);
  return (
    <Panel padding="14px 16px" style={fill ? { height: "100%" } : undefined}>
      <div data-testid="profile-marks">
        <PanelHead title={MARKS_TITLE} subtitle={MARKS_SUBTITLE} titleSize={13} headingLevel={2} />
        {marks === null ? (
          <Skeleton height={64} style={{ marginTop: 12, width: "100%" }} />
        ) : tiles.length === 0 ? (
          <p style={{ margin: "12px 0 0", fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: t.text2 }}>
            {isOwn ? "Publish a build to earn your first." : "No creator marks yet."}
          </p>
        ) : phone ? (
          <div style={{ margin: "12px -2px 0" }}>
            <ScrollRow gap={8} label="Creator marks">
              {tiles}
            </ScrollRow>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>{tiles}</div>
        )}
      </div>
    </Panel>
  );
}

/* ── the page ── */

export function ProfileView({
  fit = "content",
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
  works,
  activity,
  marks,
}: ProfileViewProps) {
  const phone = useIsPhone();
  const actions = { isOwn, following, followBusy, onFollow, onUnfollow, onMessage: isOwn ? undefined : onMessage, onEdit };
  const twoActions = !isOwn && Boolean(actions.onMessage);

  if (phone) {
    return (
      <div data-testid="profile-view" data-viewport="mobile" style={{ display: "flex", flexDirection: "column", gap: 12, lineHeight: "normal" }}>
        <ProfileBanner maker={maker} phone {...actions} />
        <div style={{ display: "grid", gridTemplateColumns: twoActions ? "1fr 1fr" : "1fr", gap: 8 }}>
          <ProfileActions {...actions} phone />
        </div>
        <LevelPanel level={level} isOwn={isOwn} onTrack={onTrack} phone />
        <StatsWall figures={figures} phone />
        <PhoneWorks works={works} isOwn={isOwn} />
        <ActivityPanel days={activity} phone fill={false} />
        <MarksPanel marks={marks} isOwn={isOwn} phone fill={false} />
      </div>
    );
  }

  return (
    <div data-testid="profile-view" data-viewport="desktop" style={{ ...COLUMN, gap: 12, lineHeight: "normal", ...boardHeight(fit) }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 440px", gap: 12, height: 220, flexShrink: 0 }}>
        <div style={{ minHeight: 0 }}>
          <ProfileBanner maker={maker} {...actions} />
        </div>
        <div style={{ minHeight: 0 }}>
          <LevelPanel level={level} isOwn={isOwn} onTrack={onTrack} phone={false} />
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <StatsWall figures={figures} phone={false} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 12, flexGrow: 1, minHeight: 0 }}>
        <div style={{ minHeight: 0 }}>
          <WorksPanel works={works} isOwn={isOwn} fill />
        </div>
        <div style={{ ...COLUMN, gap: 12 }}>
          <div style={{ flexGrow: 1, minHeight: 0 }}>
            <ActivityPanel days={activity} phone={false} fill />
          </div>
          <div style={{ flexGrow: 1, minHeight: 0 }}>
            <MarksPanel marks={marks} isOwn={isOwn} phone={false} fill />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The profile before it has arrived: the banner and level panel, the stats and the works, in `--recess`. */
export function ProfileViewSkeleton() {
  const phone = useIsPhone();
  return (
    <div
      data-testid="profile-skeleton"
      role="status"
      aria-label="Loading profile"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {phone ? (
        <>
          <Skeleton height={290} style={{ borderRadius: 18 }} />
          <Skeleton height={48} style={{ borderRadius: r.control }} />
          <Skeleton height={150} style={{ borderRadius: r.panel }} />
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 440px", gap: 12 }}>
            <Skeleton height={220} style={{ borderRadius: r.panel }} />
            <Skeleton height={220} style={{ borderRadius: r.panel }} />
          </div>
          <Skeleton height={76} style={{ borderRadius: r.control }} />
          <Skeleton height={420} style={{ borderRadius: r.panel }} />
        </>
      )}
    </div>
  );
}

/** A sentence and a way on, for a profile that is not there. */
export function ProfileNotice({ line, detail, action }: { line: string; detail?: string; action?: ReactNode }) {
  return (
    <div data-testid="profile-notice" role="status" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "48px 0", textAlign: "center" }}>
      <h1 style={{ ...display(30), margin: 0, color: t.text }}>{line}</h1>
      {detail ? <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>{detail}</p> : null}
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

export default ProfileView;

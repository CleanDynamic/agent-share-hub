/* SV-12: the Maps view of Builds, pure: each build's Map, read only. One box per session, one line wherever a tile in one
   session uses something from another, part labels. The board is `design/reference/vision/dusk/builds-maps.html`.

   The page has no filter column here (the board differs from the Table's), so this draws the whole page: the Table's own
   head (BF-03) with its sentence and the view switch, one row (Filters with the active count, the direction switch,
   "n with a Map"), the Table's chip row (BF-04: every chip and Clear all) and the grid. Filters opens the one Filters dialog
   (BF-06) with the Table's own panel, given as `panel`, so the filters are the Table's, kept across views.

   WHERE THINGS ARE comes from the composer's layout (`layoutSessionMap`), turned into the well's 400 x 220 space by
   `mapsModel.ts`; this view only draws what it is given. Positions are percentages of the well's width and its height, so
   a box keeps the board's size (92 x 36) and the layout's places follow the card. The Map is drawn at rest: no motion, and
   Horizontal or Vertical swaps at once. The drawing is hidden from assistive technology; the group says it in words.

   Cards below the first screen are skipped by the browser until they come near (`content-visibility`). */

import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Segmented } from "@/components/brand/Segmented";
import { Skeleton } from "@/components/brand/Skeleton";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { BuildsControl, BuildsHead, FiltersButton, UpdatingStatus, ViewSwitch, ellipsis, hitArea, text, useCardColumns } from "./BuildsFrame";
import { BuildsFiltersDialog } from "./BuildsFiltersDialog";
import { ActiveFilters, RowLamp, type TableChip } from "./BuildsTableView";

/** The well, in the board's own units. */
export const WELL_W = 400;
export const WELL_H = 220;
export const BOX_W = 92;
export const BOX_H = 36;

export type MapsDirection = "horizontal" | "vertical";

export interface MapBoxView {
  key: string;
  /** Top-left, in the well's 400 x 220. */
  x: number;
  y: number;
  /** "S1 Transcribe". */
  label: string;
  /** "OPUS · 4". */
  meta: string;
}

export interface MapPartView {
  key: string;
  x: number;
  y: number;
  /** "PART A · RESEARCH". */
  label: string;
}

export interface MapLineView {
  id: string;
  /** An SVG path in the well's 400 x 220, coordinates to one decimal. */
  d: string;
}

/** One direction of one build's Map, as it is drawn. */
export interface MapDrawing {
  boxes: readonly MapBoxView[];
  lines: readonly MapLineView[];
  parts: readonly MapPartView[];
  /** The drawing's own size, in the well's units: the well's 400 x 220, or more when the Map is larger (the well scrolls). */
  width: number;
  height: number;
}

export interface MapCardView {
  id: string;
  href: string;
  title: string;
  /** Without the "@"; null when the maker is not known. */
  maker: string | null;
  /** "3 parts · 5 sessions". */
  summary: string;
  /** "6 reproduced". */
  reproduced: string;
  /** BF-01 P4: the same count as a number: the lamp is drawn only above zero. */
  reproductions: number;
  lit: boolean;
  /** How many sessions the build has: none is "No sessions yet", one is "One session. A Map needs two." */
  sessions: number;
  /** BF-03 (D2): the Map was not read; the card says so in its summary and the well says nothing. */
  failed: boolean;
  /** The Map in words, for the drawing's group: "Session 1, Transcribe, is used by session 2 ...". */
  words: string;
  /** Null while this build's Map is still arriving. */
  drawings: Record<MapsDirection, MapDrawing> | null;
}

export interface BuildsMapsViewProps {
  view: GalleryViewMode;
  hrefFor: (view: GalleryViewMode) => string;
  onViewIntent?: (view: GalleryViewMode) => void;
  activeCount: number;
  /** Every active filter, drawn as the Table draws them. */
  chips: readonly TableChip[];
  onRemoveChip: (key: string) => void;
  onClearAll: () => void;
  /** The Table's filter panel, drawn in the Filters dialog (BF-06). */
  panel?: ReactNode;
  direction: MapsDirection;
  onDirection: (direction: MapsDirection) => void;
  /** The page's count label ("18 builds", "3 of 18 builds"), the head's figure; and how many have a Map (null until the Maps are read). */
  buildsLabel: string;
  withMap: number | null;
  cards: readonly MapCardView[];
  /** The rest of the matching builds are one press away. */
  onMore?: () => void;
  loadingMore?: boolean;
  empty?: ReactNode;
  /** One sentence and Retry, above the grid, when the Maps did not load. */
  notice?: ReactNode;
  /** BF-02 (C2): the cards are the last address's, kept until the new page lands. */
  updating?: boolean;
}

const ROOT: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums" };

/** Cards past the first screen (two rows of three) are not drawn until they come near. */
const FIRST_SCREEN_CARDS = 6;
const CARD_HEIGHT = 312;

const pct = (value: number, of: number): string => `${Math.round((value / of) * 10000) / 100}%`;

/* ── one Map ── */

function Well({ drawing, note, words }: { drawing: MapDrawing | null; note?: string; words: string }) {
  const { state, handlers } = useInteractive<HTMLDivElement>();
  const scrolls = drawing !== null && (drawing.width > WELL_W || drawing.height > WELL_H);
  const [w, h] = drawing ? [drawing.width, drawing.height] : [WELL_W, WELL_H];
  return (
    <div
      role="group"
      aria-label={words}
      tabIndex={scrolls ? 0 : undefined}
      {...(scrolls ? handlers : null)}
      style={{
        position: "relative",
        height: WELL_H,
        boxSizing: "border-box",
        borderRadius: r.control,
        background: t.well,
        border: `1px solid ${t.wellBorder}`,
        backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`,
        backgroundSize: "16px 16px",
        overflow: scrolls ? "auto" : "hidden",
        ...(scrolls ? ring(state.focusVisible) : null),
      }}
    >
      {drawing ? (
        <div aria-hidden="true" style={{ position: "relative", width: "100%", minWidth: scrolls ? w : undefined, height: h }}>
          {drawing.parts.map((part) => (
            <span key={part.key} style={{ position: "absolute", left: pct(part.x, w), top: pct(part.y, h), fontFamily: DM_MONO, fontSize: 10, letterSpacing: ".04em", color: t.label, whiteSpace: "nowrap" }}>
              {part.label}
            </span>
          ))}
          <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
            {drawing.lines.map((line) => (
              <path key={line.id} d={line.d} fill="none" stroke={t.line} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          {drawing.boxes.map((box) => (
            <span
              key={box.key}
              style={{ position: "absolute", left: pct(box.x, w), top: pct(box.y, h), width: pct(BOX_W, w), height: BOX_H, boxSizing: "border-box", padding: "4px 7px", background: t.tile, border: `1px solid ${t.tileBorder}`, borderRadius: r.control, overflow: "hidden", whiteSpace: "nowrap" }}
            >
              <span style={{ display: "block", ...ellipsis, fontSize: 11, fontWeight: 500, lineHeight: "14px", color: t.text }}>{box.label}</span>
              <span style={{ display: "block", ...ellipsis, fontFamily: DM_MONO, fontSize: 10, lineHeight: "13px", color: t.label }}>{box.meta}</span>
            </span>
          ))}
          {note ? <span style={{ position: "absolute", left: 0, right: 0, bottom: 14, textAlign: "center", ...text(12, 400, t.label) }}>{note}</span> : null}
        </div>
      ) : (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, padding: 16, display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
          <Skeleton width="40%" height={36} radius={6} />
          <Skeleton width="40%" height={36} radius={6} />
        </div>
      )}
    </div>
  );
}

export function MapCard({ card, direction, index }: { card: MapCardView; direction: MapsDirection; index: number }) {
  return (
    <article
      data-testid="map-card"
      style={{
        background: t.module,
        border: `1px solid ${t.moduleBorder}`,
        borderRadius: r.card,
        padding: 16,
        ...(index >= FIRST_SCREEN_CARDS ? { contentVisibility: "auto", containIntrinsicSize: `auto ${CARD_HEIGHT}px` } : null),
      }}
    >
      <Well
        drawing={card.drawings ? card.drawings[direction] : null}
        note={card.drawings === null || card.failed ? undefined : card.sessions === 0 ? "No sessions yet" : card.sessions === 1 ? "One session. A Map needs two." : undefined}
        words={card.words}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginTop: 10 }}>
        <span style={{ minWidth: 0 }}>
          <Link to={card.href} style={{ display: "block", ...ellipsis, ...hitArea(2), ...text(13, 500, t.text), textDecoration: "none", borderRadius: r.chip }}>
            {card.title}
          </Link>
          <span style={text(12, 400, t.label)}>{`${card.maker ? `@${card.maker} · ` : ""}${card.summary}`}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flex: "none" }}>
          <span style={text(12.5, 400, t.text2)}>{card.reproduced}</span>
          {card.reproductions > 0 ? <RowLamp lit={card.lit} /> : null}
        </span>
      </div>
    </article>
  );
}

/* ── the page ── */

const MAPS_PARTS = [{ text: "Each build's Map: one box per session, one line where a tile in one session uses something from another." }];

export default function BuildsMapsView(props: BuildsMapsViewProps) {
  const { view, hrefFor, onViewIntent, activeCount, chips, onRemoveChip, onClearAll, panel, direction, onDirection, buildsLabel, withMap, cards, onMore, loadingMore, empty, notice, updating } = props;
  const [open, setOpen] = useState(false);
  const columns = useCardColumns();
  return (
    <div data-testid="builds-maps" style={ROOT}>
      <BuildsHead figure={buildsLabel} parts={MAPS_PARTS} updating={updating} switcher={<ViewSwitch view={view} hrefFor={hrefFor} onIntent={onViewIntent} />} />

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 16 }}>
        <FiltersButton activeCount={activeCount} disabled={!panel} onClick={() => setOpen(true)} />
        <span style={{ flex: 1 }} />
        <Segmented<MapsDirection>
          label="Map direction"
          size={30}
          fontSize={12}
          compact
          items={[
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
          ]}
          value={direction}
          onChange={onDirection}
        />
        {withMap !== null ? <span style={text(12, 400, t.label)}>{`${withMap} with a Map`}</span> : null}
        <UpdatingStatus updating={updating} />
      </div>

      <ActiveFilters chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />

      {panel ? (
        <BuildsFiltersDialog open={open} onOpenChange={setOpen}>
          {panel}
        </BuildsFiltersDialog>
      ) : null}

      {notice ? <div style={{ marginTop: 24 }}>{notice}</div> : null}

      {cards.length === 0 && empty ? (
        <div style={{ marginTop: 32 }}>{empty}</div>
      ) : (
        <div data-testid="builds-cards" aria-busy={updating === true} style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 24, marginTop: 32, paddingBottom: onMore ? 24 : 64, ...(updating ? { opacity: 0.5 } : null) }}>
          {cards.map((card, index) => (
            <MapCard key={card.id} card={card} direction={direction} index={index} />
          ))}
        </div>
      )}
      {onMore ? (
        <div style={{ paddingBottom: 64 }}>
          <BuildsControl onClick={onMore} disabled={loadingMore}>
            {loadingMore ? "Loading" : "Show more builds"}
          </BuildsControl>
        </div>
      ) : null}
    </div>
  );
}

/* SV-10: Home's frame, in a small module of its own: the three columns, the controls the sections share, and the page's
   loading view. `HomeView` draws its page from these, and `HomeLoadingView` draws the page as it stands while the feed
   loads, from the same pieces, so the route table's Placeholder is the page's own loading state without the page's code
   (the post, its thread, the engagement row) in the first download.

   The board is `design/reference/vision/dusk/home.html`. The surface and its padding belong to the site frame; what is
   here starts at the columns.

   COLUMNS (Synth 03). Three PANELS on the page shade, 8 apart, no lines: `300px minmax(0, 1fr) 340px` from 1101 (the sides
   narrow to 280 and 320 before the centre goes below 520). From 761 to 1100 the left panel is hidden
   (`minmax(0, 1fr) 300px`); below 761 one column of panels: the Drafts line, the feed, then the right column's sections
   in order. The frame's own panel steps back (`useColumnPanels`). */

import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PageHeader } from "@/components/shell/PageHeader";
import { PANEL_GUTTER, PANEL_PAD, PANEL_RADIUS } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { panelColumns } from "@/components/shell/pageGrid";
import { useMinWidth } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** The board's three columns show from 1101; the left goes below that, and the right joins the feed below 761. */
const THREE_COLUMNS_MIN = 1101;
const TWO_COLUMNS_MIN = 761;

export type HomeLayout = "three" | "two" | "one";

/** Below this the centre would go under 520 with 300 and 340 sides, so the sides narrow to 280 and 320 (1192 = 640 + 520 + 2 gaps + 2 margins). */
const SIDES_FULL_MIN = 1192;

export function useHomeLayout(): HomeLayout {
  const three = useMinWidth(THREE_COLUMNS_MIN);
  const two = useMinWidth(TWO_COLUMNS_MIN);
  return three ? "three" : two ? "two" : "one";
}

/* ── type ── */

export const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  // The board's body line, 20, unless a part says otherwise.
  lineHeight: "20px",
  color,
  ...extra,
});

export const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

/** Between two sections of a side column: no line, only the column's gap. Kept so the sections read as before. */
export function Rule() {
  return null;
}

/* ── controls ── */

export function HomeControl({
  onClick,
  pressed,
  disabled,
  children,
}: {
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button variant="secondary" size={32} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}

/* ── the columns ── */

/** The board's body: Geist 13 on a 20 line, tabular numbers. */
const root: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums" };

/** A column's panel: Panel fill, radius 12, no border, no shadow. `clip` so a sticky row inside still sticks. */
const panel: CSSProperties = { background: t.surface, borderRadius: PANEL_RADIUS, overflow: "clip", minWidth: 0, boxSizing: "border-box" };

/** A side column's panel: 16 inside, sections 24 apart. */
const sidePanel: CSSProperties = { ...panel, padding: PANEL_PAD, display: "flex", flexDirection: "column", gap: 24 };

/** A side panel whose sections carry their own 16 at the sides (the section head and its rows), so the panel keeps only the top and bottom. */
const flushPanel: CSSProperties = { ...sidePanel, padding: `${PANEL_PAD}px 0` };

export function HomeColumns({
  layout,
  left,
  centre,
  right,
  top,
  flush = false,
}: {
  layout: HomeLayout;
  left: ReactNode;
  centre: ReactNode;
  right: ReactNode;
  /** One column only: the line above the feed. */
  top?: ReactNode;
  /** Home's side panels: the sections hold their own side padding. */
  flush?: boolean;
}) {
  useColumnPanels(true);
  const side = flush ? flushPanel : sidePanel;
  const sidesFull = useMinWidth(SIDES_FULL_MIN);
  if (layout === "one") {
    return (
      <div data-testid="home-view" data-layout="one" style={{ ...root, display: "flex", flexDirection: "column", gap: PANEL_GUTTER, minWidth: 0 }}>
        {top ? <div style={{ ...panel, padding: PANEL_PAD }}>{top}</div> : null}
        <section aria-label="Feed" style={{ ...panel, paddingBottom: 48 }}>{centre}</section>
        <aside aria-label="The room" style={side}>{right}</aside>
      </div>
    );
  }
  const three = layout === "three";
  return (
    <div
      data-testid="home-view"
      data-layout={layout}
      style={{
        ...panelColumns(three ? "three" : "two", { sidesFull, between: !three }),
        ...root,
      }}
    >
      {three ? <aside aria-label="Your studio" style={side}>{left}</aside> : null}
      <section aria-label="Feed" style={{ ...panel, paddingBottom: 48 }}>
        {centre}
      </section>
      <aside aria-label="The room" style={side}>
        {right}
      </aside>
    </div>
  );
}

/* ── loading ── */

/** A section's head while it loads: the fact's place, one line at the head's 24. */
export function HeadBones() {
  return (
    <div style={{ padding: "0 16px 8px", height: 32, boxSizing: "border-box", display: "flex", alignItems: "center" }}>
      <Skeleton width="50%" height={20} radius={4} />
    </div>
  );
}

/** Rows while they load: each its own height. */
export function RowBones({ count, height, what }: { count: number; height: number; what: string }) {
  return (
    <LoadingRegion what={what} style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ height, boxSizing: "border-box", display: "flex", alignItems: "center", padding: "0 16px" }}>
          <Skeleton height={height - 24} radius={10} />
        </div>
      ))}
    </LoadingRegion>
  );
}

/** The feed's tabs row, drawn while the feed loads, at its own height. */
function TabsBones() {
  return <div style={{ height: 53, boxSizing: "border-box" }} />;
}

/** A post while the feed loads: the author row, a title, a picture. */
function PostBones() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, padding: "4px 16px" }}>
      <Skeleton width={40} height={40} radius="50%" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Skeleton width="40%" height={20} radius={4} />
        <Skeleton width="80%" height={20} radius={4} />
        <Skeleton height={240} radius={6} />
      </div>
    </div>
  );
}

export const FEED_BONES = 2;

export function FeedBones() {
  return (
    <LoadingRegion what="the feed" data-testid="home-feed-loading">
      {Array.from({ length: FEED_BONES }, (_, index) => (
        <PostBones key={index} />
      ))}
    </LoadingRegion>
  );
}

/** A side column's section while it loads. */
export function SectionBones({ rows, height, what }: { rows: number; height: number; what: string }) {
  return (
    <section style={{ display: "flex", flexDirection: "column" }}>
      <HeadBones />
      <RowBones count={rows} height={height} what={what} />
    </section>
  );
}

function LeftBones() {
  return (
    <>
      <SectionBones rows={3} height={52} what="your drafts" />
      <Rule />
      <SectionBones rows={2} height={56} what="your sessions" />
    </>
  );
}

function RightBones() {
  return (
    <>
      <SectionBones rows={3} height={56} what="open topics" />
    </>
  );
}

/** The page while the feed loads: the route table's Placeholder for `/`. It holds a screen's height, so the footer is
    not drawn up the page and then pushed away when the content arrives. */
export function HomeLoadingView() {
  const layout = useHomeLayout();
  return (
    <>
    <PageHeader title="Home" />
    <div style={{ minHeight: "100vh" }}>
      <HomeColumns
        layout={layout}
        flush
        top={layout === "one" ? <Skeleton height={44} radius={6} /> : undefined}
        left={<LeftBones />}
        centre={
          <>
            <TabsBones />
            <FeedBones />
          </>
        }
        right={<RightBones />}
      />
    </div>
    </>
  );
}

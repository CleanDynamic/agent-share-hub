/* SV-10: Home's frame, in a small module of its own: the three columns, the controls the sections share, and the page's
   loading view. `HomeView` draws its page from these, and `HomeLoadingView` draws the page as it stands while the feed
   loads, from the same pieces, so the route table's Placeholder is the page's own loading state without the page's code
   (the post, its thread, the engagement row) in the first download.

   The board is `design/reference/vision/dusk/home.html`. The surface and its padding (`24px clamp(16px, 2.2vw, 32px) 0`)
   belong to the site frame (`board="home"`); what is here starts at the columns.

   COLUMNS. `280px minmax(0, 628px) 300px`, centred, no gap; the centre has a hairline either side. Below 1100 the left
   column is hidden; below 760 one column: the Drafts line, the feed, then the right column's sections in order. */

import type { CSSProperties, ReactNode } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useMinWidth } from "@/components/shell/useMinWidth";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { PRIMARY, controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** The board's three columns show from 1101; the left goes below that, and the right joins the feed below 761. */
const THREE_COLUMNS_MIN = 1101;
const TWO_COLUMNS_MIN = 761;

export type HomeLayout = "three" | "two" | "one";

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

/** A hairline between two sections of a side column. */
export function Rule() {
  return <div aria-hidden="true" style={{ height: 1, background: t.hairline }} />;
}

/* ── controls ── */

const controlBase: CSSProperties = {
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: r.control,
  fontFamily: FIGTREE,
  lineHeight: "normal",
  textDecoration: "none",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

/** The view's one primary: `--action`, 32 high, 12.5/500. A link when it goes somewhere. */
export function HomePrimary({ href, children }: { href: string; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={href} data-visual-slot="btn-primary" {...handlers} style={{ ...controlBase, ...PRIMARY, height: 32, padding: "0 12px", fontSize: 12.5, fontWeight: 500, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

/** A control: `--control` fill, 1px `--control-border`, radius 6, 32 high, 12.5/400. */
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
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      {...handlers}
      style={{ ...controlBase, height: 32, padding: "0 12px", fontSize: 12.5, fontWeight: 400, color: t.text, ...controlPaint(state), ...ring(state.focusVisible) }}
    >
      {children}
    </button>
  );
}

/** A 28px square control with a glyph, named for what it does. On a phone its hit area reaches 44. */
export function SquareButton({ label, onClick, phone, children }: { label: string; onClick: () => void; phone: boolean; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{
        boxSizing: "content-box",
        width: 28,
        height: 28,
        padding: phone ? (TOUCH_MIN - 28) / 2 : 0,
        margin: phone ? (28 - TOUCH_MIN) / 2 : 0,
        display: "grid",
        placeItems: "center",
        background: "none",
        border: 0,
        borderRadius: r.control,
        color: t.text,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <span aria-hidden="true" style={{ boxSizing: "border-box", width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: r.control, ...controlPaint(state) }}>
        {children}
      </span>
    </button>
  );
}

/* ── the columns ── */

/** The board's body: Geist 13 on a 20 line, tabular numbers. */
const root: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums" };

export function HomeColumns({
  layout,
  left,
  centre,
  right,
  top,
}: {
  layout: HomeLayout;
  left: ReactNode;
  centre: ReactNode;
  right: ReactNode;
  /** One column only: the line above the feed. */
  top?: ReactNode;
}) {
  if (layout === "one") {
    return (
      <div data-testid="home-view" data-layout="one" style={{ ...root, display: "flex", flexDirection: "column", gap: 24, minWidth: 0, paddingBottom: 48 }}>
        {top}
        <section aria-label="Feed" style={{ minWidth: 0 }}>{centre}</section>
        <aside aria-label="The room" style={{ display: "flex", flexDirection: "column", gap: 32, minWidth: 0 }}>{right}</aside>
      </div>
    );
  }
  const three = layout === "three";
  return (
    <div
      data-testid="home-view"
      data-layout={layout}
      style={{
        display: "grid",
        gridTemplateColumns: three ? "280px minmax(0, 628px) 300px" : "minmax(0, 628px) 300px",
        justifyContent: "center",
        ...root,
      }}
    >
      {three ? (
        <aside aria-label="Your studio" style={{ padding: "8px 28px 48px 4px", display: "flex", flexDirection: "column", gap: 32, minWidth: 0 }}>
          {left}
        </aside>
      ) : null}
      <section aria-label="Feed" style={{ borderLeft: `1px solid ${t.hairline}`, borderRight: `1px solid ${t.hairline}`, minWidth: 0, padding: "0 0 48px" }}>
        {centre}
      </section>
      <aside aria-label="The room" style={{ padding: "8px 4px 48px 28px", display: "flex", flexDirection: "column", gap: 32, minWidth: 0 }}>
        {right}
      </aside>
    </div>
  );
}

/* ── loading ── */

/** A section's head while it loads: the title's and the meta line's places. */
export function HeadBones() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Skeleton width="50%" height={14} radius={4} />
      <Skeleton width="70%" height={12} radius={4} />
    </div>
  );
}

/** Rows while they load: each its own height, a hairline under all but the last. */
export function RowBones({ count, height, what }: { count: number; height: number; what: string }) {
  return (
    <LoadingRegion what={what} style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ height, boxSizing: "border-box", borderBottom: index < count - 1 ? `1px solid ${t.hairline}` : "none", display: "flex", alignItems: "center" }}>
          <Skeleton height={height - 24} radius={6} />
        </div>
      ))}
    </LoadingRegion>
  );
}

/** The feed's tabs row, drawn while the feed loads, at its own height. */
function TabsBones() {
  return <div style={{ height: 41, boxSizing: "border-box", borderBottom: `1px solid ${t.hairline}` }} />;
}

/** A post while the feed loads: the author row, a title, a picture. */
function PostBones() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", columnGap: 12, padding: "20px 20px 16px", borderBottom: `1px solid ${t.hairline}` }}>
      <Skeleton width={40} height={40} radius="50%" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Skeleton width="40%" height={20} radius={4} />
        <Skeleton width="80%" height={28} radius={4} />
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
    <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <HeadBones />
      <RowBones count={rows} height={height} what={what} />
    </section>
  );
}

function LeftBones() {
  return (
    <>
      <SectionBones rows={3} height={48} what="your drafts" />
      <Rule />
      <SectionBones rows={2} height={52} what="your sessions" />
      <Rule />
      <SectionBones rows={3} height={40} what="your week" />
    </>
  );
}

function RightBones() {
  return (
    <>
      <SectionBones rows={3} height={36} what="today's runs" />
      <Rule />
      <SectionBones rows={3} height={48} what="open requests" />
      <Rule />
      <SectionBones rows={3} height={48} what="the most run builds" />
    </>
  );
}

/** The page while the feed loads: the route table's Placeholder for `/`. */
export function HomeLoadingView() {
  const layout = useHomeLayout();
  return (
    <HomeColumns
      layout={layout}
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
  );
}

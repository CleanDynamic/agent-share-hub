/* SV-11: the Builds page's frame, in a small module of its own: the column, the head with its view switch, the
   controls the views share, and the page as it stands while it loads (`BuildsLoadingView`, the route table's Placeholder
   and the page's own loading state), so the Placeholder carries none of the page's code (the filters, the table).

   BF-06 (A1, C5a): the filter rail is gone. The surface and its padding belong to the site frame (`board`); what is here
   starts at the page head, and the Table has the whole width under it, 40 below. The filters are a dialog that the Filters
   button opens (`BuildsFiltersDialog`), the same in all three views.

   THE VIEW IS IN THE ADDRESS (`?view=maps`). Each segment of the switch is a link to the same page with the new view, so
   the old content stays until the new arrives, and pointing at one fetches that view's code. */

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PAGE_TITLE } from "@/components/shell/PageHeader";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { PageFigure, type FigurePart } from "@/components/vision/PageFigure";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** Cards in three columns, two below 1100, one below 760 (Maps and Classification). */
export function useCardColumns(): 1 | 2 | 3 {
  const two = useMinWidth(761);
  const three = useMinWidth(1101);
  return three ? 3 : two ? 2 : 1;
}

/** Table rows are 48 high on the board. */
export const TABLE_ROW = 48;

/* ── type ── */

export const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "20px",
  color,
  ...extra,
});

export const ellipsis: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

/** The boards' root: Geist 13 on a 20px line, numbers tabular. */
const ROOT: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums" };

/* ── the column ── */

/** The head, then the view's own content in one column 40 below it. */
export function BuildsColumns({ head, main, testId = "builds-page" }: { head: ReactNode; main: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} style={{ ...ROOT, paddingBottom: 64 }}>
      {head}
      <section aria-label="Builds" style={{ minWidth: 0, marginTop: 40 }}>
        {main}
      </section>
    </div>
  );
}

/* ── the head ── */

export const VIEW_LABEL: Record<GalleryViewMode, string> = { table: "Table", maps: "Maps", classification: "Classification" };

const VIEWS: readonly GalleryViewMode[] = ["table", "maps", "classification"];

function ViewSegment({ view, current, href, onIntent }: { view: GalleryViewMode; current: boolean; href: string; onIntent?: (view: GalleryViewMode) => void }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const height = 28;
  return (
    <Link
      to={href}
      preventScrollReset
      aria-current={current ? "page" : undefined}
      onPointerEnter={() => onIntent?.(view)}
      onFocus={() => onIntent?.(view)}
      {...handlers}
      style={{
        // On a phone the hit area reaches 44 with a matching negative margin; the drawn segment inside keeps its 28.
        display: "flex",
        alignItems: "center",
        ...(phone ? { paddingBlock: (TOUCH_MIN - height) / 2, marginBlock: (height - TOUCH_MIN) / 2 } : null),
        borderRadius: r.chip,
        textDecoration: "none",
        ...ring(state.focusVisible),
      }}
    >
      <span
        style={{
          boxSizing: "border-box",
          height,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          borderRadius: r.chip,
          border: `1px solid ${current ? t.selectedEdge : "transparent"}`,
          background: current ? t.control : "transparent",
          fontFamily: FIGTREE,
          fontSize: 12.5,
          fontWeight: current ? 500 : 400,
          lineHeight: "normal",
          color: current || state.hovered ? t.text : t.text2,
          whiteSpace: "nowrap",
        }}
      >
        {/* BF-03 (D1): the label holds the width of its 500 weight, so the switch is as wide on every view and no segment
            moves under the pointer when the current one changes. */}
        <span style={{ display: "inline-grid" }}>
          <span style={{ gridArea: "1 / 1" }}>{VIEW_LABEL[view]}</span>
          <span aria-hidden="true" style={{ gridArea: "1 / 1", fontWeight: 500, visibility: "hidden" }}>
            {VIEW_LABEL[view]}
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Table, Maps, Classification: a `--well` track with 2px padding and the current segment raised. Links, not buttons:
    the view is in the address. */
export function ViewSwitch({ view, hrefFor, onIntent }: { view: GalleryViewMode; hrefFor: (view: GalleryViewMode) => string; onIntent?: (view: GalleryViewMode) => void }) {
  return (
    <nav aria-label="View" style={{ display: "flex", gap: 2, padding: 2, background: t.well, border: `1px solid ${t.wellBorder}`, borderRadius: r.control }}>
      {VIEWS.map((entry) => (
        <ViewSegment key={entry} view={entry} current={entry === view} href={hrefFor(entry)} onIntent={onIntent} />
      ))}
    </nav>
  );
}

/** "n builds", its meta line, and the view switch on the right: the one head of Table, Maps and Classification (BF-03 D1), so
    the title and the switch stand in the same place on every view. The h1 holds the number only; the meta line sits under it. */
export function BuildsHead({ figure, parts, switcher, updating }: { figure: ReactNode; parts: readonly FigurePart[]; switcher: ReactNode; updating?: boolean }) {
  return (
    <div data-testid="builds-head" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <PageFigure
        /* PageHeader's title style; the h1 stays here because it dims itself while the list updates (BF-02). */
        figure={<h1 style={{ ...PAGE_TITLE, ...(updating ? { opacity: 0.5 } : null) }}>{figure}</h1>}
        parts={parts}
      />
      {switcher}
    </div>
  );
}

/** BF-02 (C2): always mounted, so a screen reader hears "Updating" come and go. */
export function UpdatingStatus({ updating }: { updating?: boolean }) {
  return (
    <span role="status" style={{ ...text(12, 400, t.label), alignSelf: "center" }}>
      {updating ? "Updating" : ""}
    </span>
  );
}

/* ── controls ── */

/** A control at the board's 28 (44 on a phone): Add, Sort, Columns. Takes a ref and the rest of a button's props, so a
    menu's trigger can be one. */
export const BuildsControl = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }>(function BuildsControl({ children, selected = false, ...rest }, ref) {
  const phone = useIsPhone();
  /* A menu's trigger hands this its own pointer and focus handlers: they are chained, not replaced (a Radix menu opens on pointer down). */
  const { state, handlers } = useInteractive<HTMLButtonElement>(rest);
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      {...handlers}
      style={{
        boxSizing: "border-box",
        height: phone ? TOUCH_MIN : 28,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0 10px",
        borderRadius: r.control,
        fontFamily: FIGTREE,
        fontSize: 12,
        fontWeight: 400,
        lineHeight: "normal",
        color: t.text,
        whiteSpace: "nowrap",
        cursor: "pointer",
        ...(selected ? { background: t.selectedFill, border: `1px solid ${t.selectedEdge}` } : controlPaint(state)),
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
});

/** BF-06 (A1, G4): the one Filters button of Table, Maps and Classification. The word, then the count when a filter is on;
    with one on it is drawn in the selected look (not the primary: Apply is the dialog's one primary). It opens a dialog.
    BF-09 (A8): with a saved set open, its name follows the count. */
export const FiltersButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { activeCount: number; setName?: string }>(function FiltersButton({ activeCount, setName, ...rest }, ref) {
  const on = activeCount > 0;
  const name = `${on ? `Filters, ${activeCount} on` : "Filters"}${setName ? `, set ${setName}` : ""}`;
  return (
    <BuildsControl ref={ref} aria-haspopup="dialog" aria-label={name} {...rest} selected={on}>
      <span style={on ? { color: t.text, fontWeight: 500 } : { color: t.label }}>Filters</span>
      {on ? <span style={{ color: t.text }}>{activeCount}</span> : null}
      {setName ? <span style={{ color: t.text2, maxWidth: 160, ...ellipsis }}>{`· ${setName}`}</span> : null}
    </BuildsControl>
  );
});

/** BF-05 (G3): a pointer target reaches 24px by growing its hit area, never its drawn size: padding with a matching
    negative margin, so nothing around it moves. `by` is the padding on each side of the line. */
export const hitArea = (by: number): CSSProperties => ({ padding: `${by}px 0`, margin: `${-by}px 0` });

/** A text button: "Clear all", "Save current", "Add a calculation". Takes a ref and a button's props, so a menu's trigger can be one. */
export const BuildsTextButton = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & { size?: 12 | 12.5; color?: string }>(function BuildsTextButton(
  { children, size = 12, color = t.label, ...rest },
  ref,
) {
  const { state, handlers } = useInteractive<HTMLButtonElement>(rest);
  // One character (the calculation's remove, ×) is 8px wide: its hit area is 24 wide, with the extra taken back by the margin.
  const single = typeof children === "string" && children.length === 1;
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      {...handlers}
      style={{
        background: "none",
        border: 0,
        ...(single ? { boxSizing: "border-box", minWidth: 24, textAlign: "center", padding: "2px 8px", margin: "-2px -8px" } : { padding: "2px", margin: "-2px" }),
        borderRadius: r.chip,
        fontFamily: FIGTREE,
        fontSize: size,
        lineHeight: "inherit",
        color: state.hovered ? t.text : color,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
});

/* ── loading ── */

/** Rows of the table while it loads, at the table's own height. */
export function TableRowSkeletons({ count }: { count: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, height: TABLE_ROW, borderBottom: `1px solid ${t.hairline}` }}>
          <Skeleton width="36%" height={12} radius={4} />
          <Skeleton width="12%" height={10} radius={4} />
        </div>
      ))}
    </div>
  );
}

/** The view the address names, and the address of each view, read without the page's address module (which brings the
    data layer with it). The page writes the same `view` parameter through `galleryHref`. */
export function viewOfSearch(search: string): GalleryViewMode {
  const view = new URLSearchParams(search).get("view");
  return view === "maps" || view === "classification" ? view : "table";
}

function viewHref(pathname: string, search: string, view: GalleryViewMode): string {
  const next = new URLSearchParams(search);
  if (view === "table") next.delete("view");
  else next.set("view", view);
  const written = next.toString();
  return written ? `${pathname}?${written}` : pathname;
}

/** Builds as it stands before its list arrives: the route table's Placeholder for /builds, and the page's own loading
    state. The head and the lens row are drawn; the table is blocks. The switch is drawn from the address, so it is where
    it will be. */
export function BuildsLoadingView() {
  const { pathname, search } = useLocation();
  const view = viewOfSearch(search);
  const hrefFor = (next: GalleryViewMode) => viewHref(pathname, search, next);
  if (view === "maps") return <MapsLoadingView hrefFor={hrefFor} />;
  if (view === "classification") return <ClassificationLoadingView hrefFor={hrefFor} />;
  return (
    <LoadingRegion what="builds" announce>
      <BuildsColumns
        testId="builds-loading"
        head={<BuildsHead figure="Builds" parts={[{ text: " " }]} switcher={<ViewSwitch view={view} hrefFor={hrefFor} />} />}
        main={
          <>
            <div style={{ height: 36, borderBottom: `1px solid ${t.hairline}` }} />
            <div style={{ marginTop: 16 + 26 + 20 }}>
              <TableRowSkeletons count={10} />
            </div>
          </>
        }
      />
    </LoadingRegion>
  );
}

/** SV-12: the Maps page as it stands before its list arrives: the head, the row's height and the cards with their wells,
    at the grid's columns. */
export function MapsLoadingView({ hrefFor }: { hrefFor: (view: GalleryViewMode) => string }) {
  const wide = useMinWidth(1101);
  const middle = useMinWidth(761);
  const columns = wide ? 3 : middle ? 2 : 1;
  return (
    <LoadingRegion what="builds" announce>
      <div data-testid="builds-loading" style={{ ...ROOT, paddingBottom: 64 }}>
        <BuildsHead figure="Builds" parts={[{ text: " " }]} switcher={<ViewSwitch view="maps" hrefFor={hrefFor} />} />
        <div style={{ height: 28, marginTop: 16 }} />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 24, marginTop: 32 }} aria-hidden="true">
          {Array.from({ length: columns * 2 }, (_, index) => (
            <div key={index} style={{ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16 }}>
              <Skeleton width="100%" height={220} radius={6} />
              <div style={{ marginTop: 10 }}>
                <Skeleton width="55%" height={12} radius={4} />
                <div style={{ marginTop: 6 }}>
                  <Skeleton width="30%" height={10} radius={4} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

/** SV-13: the Classification page as it stands before its list arrives: the head, the row's height and cards with a
    title and eight rows, at the grid's columns. */
export function ClassificationLoadingView({ hrefFor }: { hrefFor: (view: GalleryViewMode) => string }) {
  const columns = useCardColumns();
  return (
    <LoadingRegion what="builds" announce>
      <div data-testid="builds-loading" style={{ ...ROOT, paddingBottom: 64 }}>
        <BuildsHead figure="Builds" parts={[{ text: " " }]} switcher={<ViewSwitch view="classification" hrefFor={hrefFor} />} />
        <div style={{ height: 28, marginTop: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 24, alignItems: "start", marginTop: 32 }} aria-hidden="true">
          {Array.from({ length: columns * 2 }, (_, index) => (
            <div key={index} style={{ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16 }}>
              <Skeleton width="55%" height={12} radius={4} />
              <div style={{ marginTop: 6 }}>
                <Skeleton width="30%" height={10} radius={4} />
              </div>
              <div style={{ marginTop: 16 }}>
                {Array.from({ length: 8 }, (__, row) => (
                  <div key={row} style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, height: 54, boxSizing: "border-box", borderTop: `1px solid ${t.hairline}` }}>
                    <Skeleton width="40%" height={10} radius={4} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

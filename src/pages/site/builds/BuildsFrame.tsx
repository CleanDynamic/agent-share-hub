/* SV-11: the Builds page's frame, in a small module of its own: the two columns, the head with its view switch, the
   controls the views share, and the page as it stands while it loads (`BuildsLoadingView`, the route table's Placeholder
   and the page's own loading state), so the Placeholder carries none of the page's code (the filters, the table).

   The board is `design/reference/vision/dusk/builds-table.html`. The surface and its padding belong to the site frame
   (`board`); what is here starts at the page head. Columns `256px minmax(0, 1fr)`, 56 apart, 40 under the head; below
   1000 one column, the filters first and closed to their heads.

   THE VIEW IS IN THE ADDRESS (`?view=maps`). Each segment of the switch is a link to the same page with the new view, so
   the old content stays until the new arrives, and pointing at one fetches that view's code. */

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
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

/** Two columns from 1001; one below. */
const TWO_COLUMNS_MIN = 1001;

export function useBuildsTwoColumns(): boolean {
  return useMinWidth(TWO_COLUMNS_MIN);
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

/* ── the columns ── */

export function BuildsColumns({ two, head, filters, main, testId = "builds-page" }: { two: boolean; head: ReactNode; filters: ReactNode; main: ReactNode; testId?: string }) {
  return (
    <div data-testid={testId} data-layout={two ? "two" : "one"} style={{ ...ROOT, paddingBottom: 64 }}>
      {head}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: two ? "256px minmax(0, 1fr)" : "minmax(0, 1fr)",
          columnGap: 56,
          rowGap: 40,
          marginTop: 40,
        }}
      >
        <aside aria-label="Filters" style={{ minWidth: 0 }}>
          {filters}
        </aside>
        <section aria-label="Builds" style={{ minWidth: 0 }}>
          {main}
        </section>
      </div>
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
          border: `1px solid ${current ? t.controlBorder : "transparent"}`,
          background: current ? t.control : "transparent",
          fontFamily: FIGTREE,
          fontSize: 12.5,
          fontWeight: current ? 500 : 400,
          lineHeight: "normal",
          color: current || state.hovered ? t.text : t.text2,
          whiteSpace: "nowrap",
        }}
      >
        {VIEW_LABEL[view]}
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

/** "n builds", its meta line, and the view switch on the right. */
export function BuildsHead({ figure, parts, switcher }: { figure: ReactNode; parts: readonly FigurePart[]; switcher: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit" }}>
        <PageFigure figure={figure} parts={parts} />
      </h1>
      {switcher}
    </div>
  );
}

/* ── controls ── */

/** A control at the board's 28 (44 on a phone): Add, Sort, Columns. Takes a ref and the rest of a button's props, so a
    menu's trigger can be one. */
export const BuildsControl = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function BuildsControl({ children, ...rest }, ref) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
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
        ...controlPaint(state),
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
});

/** A text button: "Clear all", "Save current", "Add a calculation". */
export function BuildsTextButton({ onClick, children, size = 12, color = t.label, ...rest }: { onClick?: () => void; children: ReactNode; size?: 11.5 | 12 | 12.5; color?: string; "aria-pressed"?: boolean; "aria-label"?: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      {...handlers}
      style={{
        background: "none",
        border: 0,
        padding: 0,
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
}

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

/** The filter column while it loads: its head and closed rows 44 high. */
function FilterSkeletons() {
  return (
    <div aria-hidden="true">
      <div style={{ paddingBottom: 20 }}>
        <div style={text(14, 500, t.text, { lineHeight: 1.3 })}>Filters</div>
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", height: 44, borderTop: `1px solid ${t.hairline}` }}>
          <Skeleton width="50%" height={12} radius={4} />
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
    state. The head and the column frames are drawn; the filters and the table are blocks. The switch is drawn from the
    address, so it is where it will be. */
export function BuildsLoadingView() {
  const two = useBuildsTwoColumns();
  const { pathname, search } = useLocation();
  const view = viewOfSearch(search);
  const hrefFor = (next: GalleryViewMode) => viewHref(pathname, search, next);
  return (
    <LoadingRegion what="builds" announce>
      <BuildsColumns
        two={two}
        testId="builds-loading"
        head={<BuildsHead figure="Builds" parts={[{ text: " " }]} switcher={<ViewSwitch view={view} hrefFor={hrefFor} />} />}
        filters={<FilterSkeletons />}
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

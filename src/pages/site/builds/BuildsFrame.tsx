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

import { MobileIcon } from "@/components/brand/MobileIcon";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PhonePills } from "@/components/phone/PhonePills";
import { PANEL_RADIUS } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import type { FigurePart } from "@/components/vision/PageFigure";
import type { GalleryViewMode } from "@/lib/build/galleryParams";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { controlPaint, hoverFill } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { PhoneCardSkeletons } from "./BuildsPhone";

/** Cards in three columns, two below 1100, one below 760 (Maps and Classification). */
export function useCardColumns(): 1 | 2 | 3 {
  const two = useMinWidth(761);
  const three = useMinWidth(1101);
  return three ? 3 : two ? 2 : 1;
}

/** Table rows are 48 high on the board. */
export const TABLE_ROW = 48;

/* ── type ── */

export const text = (px: number, weight: 400 | 500 | 600, color: string, extra: CSSProperties = {}): CSSProperties => ({
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

/** Synth 08: the page is one full-width panel on the page shade. The frame's own panel steps back and this draws it. */
export const BUILDS_PANEL: CSSProperties = { background: t.surface, borderRadius: PANEL_RADIUS, overflow: "clip", minWidth: 0, boxSizing: "border-box", paddingBottom: 48 };

/** Prompt 21: on a phone the panel is not drawn: the page is the Page shade, the cards are its Panels. */
const PHONE_PAGE: CSSProperties = { minWidth: 0, boxSizing: "border-box", paddingBottom: 24 };
export const panelFor = (phone: boolean): CSSProperties => (phone ? PHONE_PAGE : BUILDS_PANEL);

/** The panel, the head in it, then the view's own content in one column under it. */
export function BuildsColumns({ head, main, testId = "builds-page" }: { head: ReactNode; main: ReactNode; testId?: string }) {
  const phone = useIsPhone();
  useColumnPanels(true);
  return (
    <div data-testid={testId} style={{ ...ROOT, ...panelFor(phone) }}>
      {head}
      <section aria-label="Builds" style={{ minWidth: 0, padding: phone ? 0 : "0 20px" }}>
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
  const height = 32;
  return (
    <Link
      to={href}
      preventScrollReset
      aria-current={current ? "page" : undefined}
      onPointerEnter={() => onIntent?.(view)}
      onFocus={() => onIntent?.(view)}
      {...handlers}
      style={{
        // On a phone the hit area reaches 44 with a matching negative margin; the drawn pill inside keeps its 32.
        display: "flex",
        alignItems: "center",
        ...(phone ? { paddingBlock: (TOUCH_MIN - height) / 2, marginBlock: (height - TOUCH_MIN) / 2 } : null),
        borderRadius: 16,
        textDecoration: "none",
        flexShrink: 0,
        ...ring(state.focusVisible),
      }}
    >
      {/* Synth 08: a pill, 32 tall, 0 14px, 13/500 on Card; the current one Inverse at 600. */}
      <span
        style={{
          boxSizing: "border-box",
          height,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          borderRadius: 16,
          background: current ? t.action : state.hovered ? hoverFill(t.module) : t.module,
          fontFamily: FIGTREE,
          fontSize: 13,
          fontWeight: current ? 600 : 500,
          lineHeight: "normal",
          color: current ? t.onAction : t.text,
          whiteSpace: "nowrap",
        }}
      >
        {/* BF-03 (D1): the label holds the width of its heavier weight, so the switch is as wide on every view and no pill
            moves under the pointer when the current one changes. */}
        <span style={{ display: "inline-grid" }}>
          <span style={{ gridArea: "1 / 1" }}>{VIEW_LABEL[view]}</span>
          <span aria-hidden="true" style={{ gridArea: "1 / 1", fontWeight: 600, visibility: "hidden" }}>
            {VIEW_LABEL[view]}
          </span>
        </span>
      </span>
    </Link>
  );
}

/** Table, Maps, Classification: a row of pills. Links, not buttons: the view is in the address. On a phone the row scrolls
    sideways inside its own box. */
export function ViewSwitch({ view, hrefFor, onIntent }: { view: GalleryViewMode; hrefFor: (view: GalleryViewMode) => string; onIntent?: (view: GalleryViewMode) => void }) {
  const phone = useIsPhone();
  if (phone) {
    /* Prompt 21: PhonePills whose pills are links, so the view stays in the address. */
    return (
      <nav aria-label="View">
        <PhonePills<GalleryViewMode> label="Views" value={view} onChange={() => undefined} pills={VIEWS.map((entry) => ({ value: entry, label: VIEW_LABEL[entry], href: hrefFor(entry), onIntent: () => onIntent?.(entry) }))} />
      </nav>
    );
  }
  return (
    <nav aria-label="View" style={{ display: "flex", gap: 8, minWidth: 0, maxWidth: "100%", overflowX: "auto", scrollbarWidth: "none", padding: 4, margin: -4 }}>
      {VIEWS.map((entry) => (
        <ViewSegment key={entry} view={entry} current={entry === view} href={hrefFor(entry)} onIntent={onIntent} />
      ))}
    </nav>
  );
}

/** The head: the count as a 20/600 fact ("120 builds", or "34 of 120 builds" when filtered) and the view switch at the right.
    The page's h1, "Builds", is for screen readers only: the nav item already names the page. `parts` is kept so callers compile;
    only its first piece, the count, is drawn. */
export function BuildsHead({ figure, parts, switcher, updating }: { figure: ReactNode; parts: readonly FigurePart[]; switcher: ReactNode; updating?: boolean }) {
  const phone = useIsPhone();
  const count = parts[0]?.text;
  return (
    <div data-testid="builds-head" style={phone ? undefined : { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "20px 20px 8px" }}>
      <h1 className="sr-only" style={{ margin: 0 }}>
        {figure}
      </h1>
      {/* Prompt 21: on a phone the count is the fact, 20/24 600 with padding 0 16 8, and the view switch is its own row under it. */}
      <div data-testid="builds-count" style={{ ...text(20, 600, t.text, { lineHeight: "24px", fontFamily: FIGTREE }), ...(phone ? { padding: "0 16px 8px" } : null), ...(updating ? { opacity: 0.5 } : null) }}>
        {count ?? "\u00a0"}
      </div>
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
        height: phone ? TOUCH_MIN : 32,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0 12px",
        borderRadius: r.control,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: "normal",
        color: t.text,
        whiteSpace: "nowrap",
        cursor: "pointer",
        /* Prompt 21: on a phone a control is a Card fill with no outline, chosen or not. */
        ...(phone ? { background: t.module, border: 0, borderRadius: 10 } : selected ? { background: t.selectedFill, border: `1px solid ${t.selectedEdge}` } : controlPaint(state)),
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
  const phone = useIsPhone();
  const on = activeCount > 0;
  /* G7: the name starts with what is drawn, in its order ("Filters 6 · Mine"), then the state it adds. The spaces between the
     pieces are not drawn (the control is a flex box); they keep the words apart for a voice-control user. */
  const shown = ["Filters", on ? String(activeCount) : null, setName ? `· ${setName}` : null].filter(Boolean).join(" ");
  const name = setName ? `${shown}, ${on ? `${activeCount} on, ` : ""}saved set` : on ? `Filters, ${activeCount} on` : "Filters";
  return (
    <BuildsControl ref={ref} aria-haspopup="dialog" aria-label={name} {...rest} selected={on}>
      {phone ? <MobileIcon name="filter" size={18} /> : null}
      <span style={{ color: t.text }}>Filters</span>
      {on ? " " : null}
      {on ? <span style={{ fontFamily: DM_MONO, fontSize: 13, fontWeight: 400, color: phone ? t.brandAccent : t.text2 }}>{activeCount}</span> : null}
      {setName ? " " : null}
      {setName ? <span style={{ color: t.text2, maxWidth: 160, ...ellipsis }}>{`· ${setName}`}</span> : null}
    </BuildsControl>
  );
});

/** BF-05 (G3): a pointer target reaches 24px by growing its hit area, never its drawn size: padding with a matching
    negative margin, so nothing around it moves. `by` is the padding on each side of the line. */
export const hitArea = (by: number): CSSProperties => ({ padding: `${by}px 0`, margin: `${-by}px 0` });

/** A text button: "Clear all", "Save current", "Add a calculation". Takes a ref and a button's props, so a menu's trigger can be one. */
export const BuildsTextButton = forwardRef<HTMLButtonElement, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> & { size?: 12 | 12.5 | 13; color?: string; underline?: boolean }>(function BuildsTextButton(
  { children, size = 12, color = t.label, underline = false, ...rest },
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
        textDecoration: underline ? "underline" : undefined,
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
      {/* The table's header row: its own type, padding and rule around a blank line, so the rows start where the table's do. */}
      <div style={{ ...text(12, 400, t.label), padding: "0 0 10px", borderBottom: `1px solid ${t.hairline}` }}>{"\u00a0"}</div>
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
  const phone = useIsPhone();
  const hrefFor = (next: GalleryViewMode) => viewHref(pathname, search, next);
  if (view === "maps") return <MapsLoadingView hrefFor={hrefFor} />;
  if (view === "classification") return <ClassificationLoadingView hrefFor={hrefFor} />;
  return (
    <LoadingRegion what="builds" announce>
      <BuildsColumns
        testId="builds-loading"
        head={<BuildsHead figure="Builds" parts={[{ text: "\u00a0" }]} switcher={<ViewSwitch view={view} hrefFor={hrefFor} />} />}
        main={
          phone ? (
            <PhoneCardSkeletons count={6} height={112} />
          ) : (
          <>
            <div style={{ height: 36, borderBottom: `1px solid ${t.hairline}` }} />
            <div style={{ marginTop: 20 }}>
              <TableRowSkeletons count={10} />
            </div>
          </>
          )
        }
      />
    </LoadingRegion>
  );
}

/** SV-12: the Maps page as it stands before its list arrives: the head, the row's height and the cards with their wells,
    at the grid's columns. */
export function MapsLoadingView({ hrefFor }: { hrefFor: (view: GalleryViewMode) => string }) {
  useColumnPanels(true);
  const wide = useMinWidth(1101);
  const middle = useMinWidth(761);
  const columns = wide ? 3 : middle ? 2 : 1;
  const phone = useIsPhone();
  if (phone) {
    return (
      <LoadingRegion what="builds" announce>
        <div data-testid="builds-loading" style={{ ...ROOT, ...panelFor(true) }}>
          <BuildsHead figure="Builds" parts={[{ text: "\u00a0" }]} switcher={<ViewSwitch view="maps" hrefFor={hrefFor} />} />
          <PhoneCardSkeletons count={4} height={268} />
        </div>
      </LoadingRegion>
    );
  }
  return (
    <LoadingRegion what="builds" announce>
      <div data-testid="builds-loading" style={{ ...ROOT, ...BUILDS_PANEL }}>
        <BuildsHead figure="Builds" parts={[{ text: "\u00a0" }]} switcher={<ViewSwitch view="maps" hrefFor={hrefFor} />} />
        <div style={{ height: 30, marginTop: 16, marginInline: 20 }} />
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 24, margin: "32px 20px 0" }} aria-hidden="true">
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
  useColumnPanels(true);
  const columns = useCardColumns();
  const phone = useIsPhone();
  if (phone) {
    return (
      <LoadingRegion what="builds" announce>
        <div data-testid="builds-loading" style={{ ...ROOT, ...panelFor(true) }}>
          <BuildsHead figure="Builds" parts={[{ text: "\u00a0" }]} switcher={<ViewSwitch view="classification" hrefFor={hrefFor} />} />
          <PhoneCardSkeletons count={4} height={220} />
        </div>
      </LoadingRegion>
    );
  }
  return (
    <LoadingRegion what="builds" announce>
      <div data-testid="builds-loading" style={{ ...ROOT, ...BUILDS_PANEL }}>
        <BuildsHead figure="Builds" parts={[{ text: "\u00a0" }]} switcher={<ViewSwitch view="classification" hrefFor={hrefFor} />} />
        <div style={{ height: 28, marginTop: 24, marginInline: 20 }} />
        {/* The key's line under the row, in its own type, so the cards start where the page's do. */}
        <div style={{ ...text(12, 400, t.label), margin: "16px 20px 0" }}>{"\u00a0"}</div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 24, alignItems: "start", margin: "16px 20px 0" }} aria-hidden="true">
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

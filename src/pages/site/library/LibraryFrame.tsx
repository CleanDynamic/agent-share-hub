/* SV-09: the Library page's frame, in a small module of its own: the three columns, the controls the page shares, and
   the page as it stands while it loads (`LibraryLoadingView`, the route table's Placeholder and the page's own loading
   state), so the Placeholder carries none of the page's code (its table, panels and dialogs).

   The board is `design/reference/vision/dusk/library.html`. The surface and its padding belong to the site frame; what is
   here starts at the page head. Columns `208px minmax(0, 1fr) 340px`, 48 apart; below 1200 the selected item moves under
   the others; below 800 one column. */

import type { CSSProperties, ReactNode } from "react";

import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { PRIMARY, controlPaint } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/* ── the board's numbers ── */

/** The board's breakpoints: three columns above 1200, two above 800, one below. */
const THREE_MIN = 1201;
const TWO_MIN = 801;

/** Table rows are 52 high on the board. */
export const TABLE_ROW = 52;

export type LibraryLayout = "three" | "two" | "one";

export function useLibraryLayout(): LibraryLayout {
  const three = useMinWidth(THREE_MIN);
  const two = useMinWidth(TWO_MIN);
  return three ? "three" : two ? "two" : "one";
}

/** The boards' root: Geist 13 on a 20px line, numbers tabular. */
const ROOT: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums" };

const COLUMNS: Record<LibraryLayout, CSSProperties> = {
  three: { gridTemplateColumns: "208px minmax(0, 1fr) 340px", columnGap: 48 },
  two: { gridTemplateColumns: "208px minmax(0, 1fr)", columnGap: 48, rowGap: 48 },
  one: { gridTemplateColumns: "minmax(0, 1fr)", rowGap: 40 },
};

/** The page: the left column (head, kinds, collections), the main column, and the selected item. On a phone the left
    column's head and kinds come first, then the main column, the selected item, and the collections last. */
export function LibraryColumns({ layout, head, left, main, detail, testId = "library-page" }: { layout: LibraryLayout; head: ReactNode; left: ReactNode; main: ReactNode; detail: ReactNode; testId?: string }) {
  if (layout === "one") {
    return (
      <div data-testid={testId} data-layout={layout} style={{ ...ROOT, display: "grid", ...COLUMNS.one, paddingBottom: 64 }}>
        <div style={{ minWidth: 0 }}>{head}</div>
        <section aria-label="Saved" style={{ minWidth: 0 }}>{main}</section>
        <aside aria-label="Selected item" style={{ minWidth: 0 }}>{detail}</aside>
        <div style={{ minWidth: 0 }}>{left}</div>
      </div>
    );
  }
  return (
    <div data-testid={testId} data-layout={layout} style={{ ...ROOT, display: "grid", ...COLUMNS[layout], paddingBottom: 64 }}>
      <aside aria-label="Library sections" style={{ minWidth: 0 }}>
        {head}
        {left}
      </aside>
      <section aria-label="Saved" style={{ minWidth: 0 }}>{main}</section>
      <aside aria-label="Selected item" style={{ minWidth: 0, gridColumn: layout === "two" ? "1 / -1" : undefined }}>{detail}</aside>
    </div>
  );
}

/* ── controls ── */

const controlBase: CSSProperties = {
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: r.control,
  fontFamily: FIGTREE,
  fontWeight: 400,
  lineHeight: "normal",
  whiteSpace: "nowrap",
  textDecoration: "none",
  cursor: "pointer",
};

/** A control at the board's 28 or 32 (44 on a phone, as the Drafts page's controls are). */
export function LibraryControl({ size = 32, onClick, href, disabled, wide, children, ...rest }: { size?: 28 | 32; onClick?: () => void; href?: string; disabled?: boolean; wide?: boolean; children: ReactNode; "aria-label"?: string }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLElement>({}, { disabled });
  const style: CSSProperties = {
    ...controlBase,
    height: phone ? TOUCH_MIN : size,
    width: wide ? "100%" : undefined,
    padding: size === 28 ? "0 10px" : "0 12px",
    fontSize: size === 28 ? 12 : 12.5,
    color: t.text,
    ...controlPaint(state),
    ...ring(state.focusVisible),
    cursor: disabled ? "not-allowed" : "pointer",
  };
  if (href) {
    return (
      <Link to={href} {...rest} {...handlers} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} {...rest} {...handlers} style={style}>
      {children}
    </button>
  );
}

/** The view's one primary: `--action` fill, `--on-action` text 500, radius 6, 32 high (44 on a phone). */
export function LibraryPrimary({ onClick, href, children }: { onClick?: () => void; href?: string; children: ReactNode }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLElement>();
  const style: CSSProperties = { ...controlBase, ...PRIMARY, flexGrow: 1, height: phone ? TOUCH_MIN : 32, padding: "0 12px", fontSize: 12.5, fontWeight: 500, ...ring(state.focusVisible) };
  if (href) {
    return (
      <Link to={href} data-visual-slot="btn-primary" {...handlers} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" data-visual-slot="btn-primary" onClick={onClick} {...handlers} style={style}>
      {children}
    </button>
  );
}

/** A text button in `--text2`: the Collections head's "New". */
export function LibraryTextButton({ onClick, children, ...rest }: { onClick: () => void; children: ReactNode; "aria-label"?: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      {...handlers}
      style={{ background: "none", border: 0, padding: 0, borderRadius: r.chip, fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: state.hovered ? t.text : t.text2, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      {children}
    </button>
  );
}

/* ── the head ── */

const headTitle: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 500, lineHeight: 1.2, letterSpacing: "-0.015em", color: t.text };
const headMeta: CSSProperties = { margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 12, lineHeight: "20px", color: t.label, fontVariantNumeric: "tabular-nums" };

/** "Library" and its count line. */
export function LibraryHead({ title, meta }: { title: string; meta: ReactNode }) {
  return (
    <div>
      <h1 style={headTitle}>{title}</h1>
      <p style={headMeta}>{meta}</p>
    </div>
  );
}

/* ── loading ── */

/** Rows of the table while it loads, at the table's own sizes. */
export function TableRowSkeletons({ count }: { count: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, height: TABLE_ROW, borderBottom: `1px solid ${t.hairline}` }}>
          <Skeleton width="40%" height={12} radius={4} />
          <Skeleton width="28%" height={10} radius={4} />
        </div>
      ))}
    </div>
  );
}

/** The collections list while it loads: three rows 40 high. */
export function CollectionSkeletons() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", height: 40, borderBottom: `1px solid ${t.hairline}` }}>
          <Skeleton width="60%" height={12} radius={4} />
        </div>
      ))}
    </div>
  );
}

/** The Library as it stands before its lists arrive: the route table's Placeholder for /library, and the page's own
    loading state. The head and the column frames are drawn; the lists and the selected item are blocks. */
export function LibraryLoadingView() {
  const layout = useLibraryLayout();
  return (
    <LoadingRegion what="your library" announce>
      <LibraryColumns
        layout={layout}
        testId="library-loading"
        head={<LibraryHead title="Library" meta={" "} />}
        left={
          <div style={{ marginTop: 32 }}>
            <CollectionSkeletons />
          </div>
        }
        main={<TableRowSkeletons count={7} />}
        detail={<Skeleton height={320} radius={8} />}
      />
    </LoadingRegion>
  );
}

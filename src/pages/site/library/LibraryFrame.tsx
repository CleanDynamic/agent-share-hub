/* Synth 10 Part B: the Library page's frame, in a small module of its own: the two panels, the controls the page shares,
   and the page as it stands while it loads (`LibraryLoadingView`, the route table's Placeholder and the page's own loading
   state), so the Placeholder carries none of the page's code (its rows, sections and dialogs).

   PANELS (Synth 03). Two panels on the page shade, 8 apart, no lines: the saved things (`minmax(0, 1fr)`) and the side
   panel (340 from 1101, 300 from 761 to 1100). Below 761 the side sections stack under the list. The frame's own panel
   steps back (`useColumnPanels`). The page's h1 is for screen readers only: Library is the current nav item, and the
   panel opens on its counts ("0 saved · 0 collections") in Text 3. */

import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PANEL_GUTTER, PANEL_PAD, PANEL_RADIUS, PHONE_MARGIN } from "@/components/shell/chromeSize";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { panelColumns } from "@/components/shell/pageGrid";
import { useIsPhone, useMinWidth } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/* ── the numbers ── */

/** The two panels show from 761; the side panel is 340 from 1101 and 300 below that. */
const TWO_MIN = 761;
const WIDE_SIDE_MIN = 1101;

/** A saved row, a Card: title 15/600 and its facts. */
export const ROW_HEIGHT = 64;

export type LibraryLayout = "wide" | "mid" | "one";

export function useLibraryLayout(): LibraryLayout {
  const wide = useMinWidth(WIDE_SIDE_MIN);
  const two = useMinWidth(TWO_MIN);
  return wide ? "wide" : two ? "mid" : "one";
}

/** The page's root: Geist 13 on a 20px line, numbers tabular. */
const ROOT: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums" };

const panel: CSSProperties = { background: t.surface, borderRadius: PANEL_RADIUS, overflow: "clip", minWidth: 0, boxSizing: "border-box", padding: PANEL_PAD };

/** The page: the saved things (head, kinds, changes, the list) and the side panel (collections, the selected item and a
    collection's preview, then how saving works). */
export function LibraryColumns({
  layout,
  head,
  main,
  side,
  testId = "library-page",
}: {
  layout: LibraryLayout;
  head: ReactNode;
  main: ReactNode;
  side: ReactNode;
  testId?: string;
}) {
  useColumnPanels(true);
  const phone = useIsPhone();
  if (phone) {
    /* Mobile prompt 25: on a phone the panels are not drawn. The saved things and the side sections are one column on the
       Page shade; each part carries its own 16 margin. */
    return (
      <div data-testid={testId} data-layout="phone" style={{ ...ROOT, paddingBottom: 24 }}>
        <section aria-label="Saved">
          {head}
          {main}
        </section>
        <aside aria-label="Collections and the selected item" style={{ display: "flex", flexDirection: "column", gap: 24, padding: `24px ${PHONE_MARGIN}px 0` }}>
          {side}
        </aside>
      </div>
    );
  }
  const frame: CSSProperties =
    layout === "one" ? { display: "flex", flexDirection: "column", gap: PANEL_GUTTER } : panelColumns("two", { between: layout === "mid" });
  return (
    <div data-testid={testId} data-layout={layout} style={{ ...ROOT, ...frame }}>
      <section aria-label="Saved" style={{ ...panel, paddingBottom: 32 }}>
        {head}
        {main}
      </section>
      <aside aria-label="Collections and the selected item" style={{ ...panel, display: "flex", flexDirection: "column", gap: 24 }}>
        {side}
      </aside>
    </div>
  );
}

/* ── controls ── */

/** A control 32 high (44 on a phone, as the Drafts page's controls are): the shared Button, a link when it goes somewhere. */
export function LibraryControl({
  onClick,
  href,
  disabled,
  wide,
  variant = "secondary",
  children,
  ...rest
}: {
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  wide?: boolean;
  variant?: "secondary" | "ghost";
  children: ReactNode;
  "aria-label"?: string;
}) {
  const phone = useIsPhone();
  return (
    <Button variant={variant} size={phone ? 44 : 32} href={href} fullWidth={wide} disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </Button>
  );
}

/** The view's one primary: the shared Button, `--action`, 32 high (44 on a phone); a link when it goes somewhere. */
export function LibraryPrimary({ onClick, href, children }: { onClick?: () => void; href?: string; children: ReactNode }) {
  const phone = useIsPhone();
  return (
    <Button variant="primary" size={phone ? 44 : 32} href={href} data-visual-slot="btn-primary" onClick={onClick} style={{ flexGrow: 1 }}>
      {children}
    </Button>
  );
}

/** A quiet text button in `--text2`: the Collections head's "New". */
export function LibraryTextButton({ onClick, children, ...rest }: { onClick: () => void; children: ReactNode; "aria-label"?: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      {...handlers}
      style={{ display: "inline-flex", alignItems: "center", height: 24, background: "none", border: 0, padding: "0 4px", borderRadius: r.chip, fontFamily: FIGTREE, fontSize: 13, lineHeight: "normal", color: state.hovered ? t.text : t.text2, cursor: "pointer", ...ring(state.focusVisible) }}
    >
      {children}
    </button>
  );
}

/* ── the head ── */

/** The h1 is read by screen readers only (the nav names the page); the counts are the visible head, 13 in Text 3. */
export function LibraryHead({ title, meta }: { title: string; meta: ReactNode }) {
  const phone = useIsPhone();
  return (
    <header style={{ marginBottom: 12, ...(phone ? { padding: `0 ${PHONE_MARGIN}px` } : null) }}>
      <h1 className="sr-only" style={{ margin: 0 }}>
        {title}
      </h1>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.label, fontVariantNumeric: "tabular-nums" }}>{meta}</p>
    </header>
  );
}

/* ── loading ── */

/** Rows of the list while it loads, at the row's own height. */
export function TableRowSkeletons({ count }: { count: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", height: ROW_HEIGHT, boxSizing: "border-box" }}>
          <Skeleton height={ROW_HEIGHT - 8} radius={10} />
        </div>
      ))}
    </div>
  );
}

/** The collections list while it loads: three cards. */
export function CollectionSkeletons() {
  return (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} height={56} radius={10} />
      ))}
    </div>
  );
}

/** The Library as it stands before its lists arrive: the route table's Placeholder for /library, and the page's own
    loading state. The head and the panels are drawn; the lists are blocks. */
export function LibraryLoadingView() {
  const layout = useLibraryLayout();
  return (
    <LoadingRegion what="your library" announce>
      <LibraryColumns
        layout={layout}
        testId="library-loading"
        head={<LibraryHead title="Library" meta={" "} />}
        main={<TableRowSkeletons count={7} />}
        side={<CollectionSkeletons />}
      />
    </LoadingRegion>
  );
}

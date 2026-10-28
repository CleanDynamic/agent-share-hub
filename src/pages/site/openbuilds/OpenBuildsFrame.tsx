/* SV-14: the OpenBuilds page's frame, in a small module of its own: the two columns, the controls the page shares, and
   the page as it stands while it loads (`OpenBuildsLoadingView`, the route table's Placeholder and the page's own loading
   state), so the Placeholder carries none of the page's code.

   The board is `design/reference/vision/dusk/openbuilds.html`. The surface and its padding belong to the site frame; what
   is here starts at the columns. Columns `minmax(0, 1fr) 320px`, 72 apart, no rule between; below 1000 one column, the
   side column after the main one, 48 apart. */

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

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

/** The board's breakpoint: two columns above 1000. */
const TWO_MIN = 1001;

/** The boards' root: Geist 13 on a 20px line, numbers tabular. */
const ROOT: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text, fontVariantNumeric: "tabular-nums" };

/** The page: the main column (48 between its groups) and the side column, each 64 above the footer. */
export function OpenBuildsColumns({ main, side, testId = "openbuilds-page" }: { main: ReactNode; side: ReactNode; testId?: string }) {
  const two = useMinWidth(TWO_MIN);
  return (
    <div
      data-testid={testId}
      data-layout={two ? "two" : "one"}
      style={{ ...ROOT, display: "grid", gridTemplateColumns: two ? "minmax(0, 1fr) 320px" : "minmax(0, 1fr)", columnGap: 72, rowGap: two ? undefined : 48 }}
    >
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 48, paddingBottom: two ? 64 : 0 }}>{main}</div>
      <aside aria-label="Your work" style={{ minWidth: 0, display: "flex", flexDirection: "column", paddingBottom: 64 }}>
        {side}
      </aside>
    </div>
  );
}

/* ── controls ── */

const controlBase: CSSProperties = {
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  gap: 6,
  borderRadius: r.control,
  fontFamily: FIGTREE,
  fontSize: 12.5,
  fontWeight: 500,
  lineHeight: "normal",
  whiteSpace: "nowrap",
  textDecoration: "none",
  cursor: "pointer",
};

/** A request's one control: the board's 30 inside its 1px border, 32 in all (44 on a phone), `--control`, 500. A link when it goes somewhere. */
export function RequestAction({ to, onClick, children }: { to?: string; onClick?: () => void; children: ReactNode }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLElement>();
  const style: CSSProperties = { ...controlBase, height: phone ? TOUCH_MIN : 32, padding: "0 12px", color: t.text, ...controlPaint(state), ...ring(state.focusVisible) };
  if (to) {
    return (
      <Link to={to} {...handlers} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} {...handlers} style={style}>
      {children}
    </button>
  );
}

/** The view's one primary: `--action` fill, `--on-action` text 500, radius 6, 32 high (44 on a phone). */
export function OpenBuildsPrimary({ to, children }: { to: string; children: ReactNode }) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link to={to} data-visual-slot="btn-primary" {...handlers} style={{ ...controlBase, ...PRIMARY, height: phone ? TOUCH_MIN : 32, padding: "0 14px", ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

/** The Sort menu's trigger: the board's 28 inside its 1px border, 30 in all (44 on a phone), 12px. */
export const SortControl = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function SortControl({ children, ...rest }, ref) {
  const phone = useIsPhone();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      {...handlers}
      style={{ ...controlBase, height: phone ? TOUCH_MIN : 30, marginBottom: 4, padding: "0 10px", fontSize: 12, fontWeight: 400, color: t.text, ...controlPaint(state), ...ring(state.focusVisible) }}
    >
      {children}
    </button>
  );
});

/* ── loading ── */

/** One request while it loads, at a step request's own sizes. */
function RequestSkeleton({ last }: { last: boolean }) {
  return (
    <div aria-hidden="true" style={{ padding: "28px 0", borderBottom: last ? "none" : `1px solid ${t.hairline}` }}>
      <Skeleton width="55%" height={18} radius={4} />
      <Skeleton width="35%" height={12} radius={4} style={{ marginTop: 8 }} />
      <Skeleton height={62} radius={6} style={{ marginTop: 16 }} />
      <Skeleton width="40%" height={12} radius={4} style={{ marginTop: 16 }} />
    </div>
  );
}

/** Requests while they load. */
export function RequestSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <RequestSkeleton key={index} last={index === count - 1} />
      ))}
    </div>
  );
}

/** A side list while it loads: rows 44 high. */
export function SideRowSkeletons({ count = 2 }: { count?: number }) {
  return (
    <div aria-hidden="true" style={{ marginTop: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ display: "flex", alignItems: "center", height: 44, borderBottom: index === count - 1 ? "none" : `1px solid ${t.hairline}` }}>
          <Skeleton width="60%" height={12} radius={4} />
        </div>
      ))}
    </div>
  );
}

/** A side section's frame: 28 apart with a hairline between (none above the first). */
export function SideSection({ first, label, children }: { first: boolean; label: string; children: ReactNode }) {
  return (
    <section aria-label={label} style={{ padding: first ? "0 0 28px" : "28px 0", borderTop: first ? "none" : `1px solid ${t.hairline}` }}>
      {children}
    </section>
  );
}

/** OpenBuilds as it stands before its reads arrive: the route table's Placeholder for /openbuilds, and the page's own
    loading state. The tab row is a hairline; the requests and the side lists are blocks. */
export function OpenBuildsLoadingView() {
  return (
    <LoadingRegion what="open requests" announce>
      <OpenBuildsColumns
        testId="openbuilds-loading"
        main={
          <section aria-label="Requests">
            <div style={{ height: 36, borderBottom: `1px solid ${t.hairline}` }} />
            <RequestSkeletons />
          </section>
        }
        side={
          <>
            <SideSection first label="Your requests">
              <Skeleton width="50%" height={16} radius={4} />
              <SideRowSkeletons />
            </SideSection>
            <SideSection first={false} label="Top contributors">
              <Skeleton width="50%" height={16} radius={4} />
              <SideRowSkeletons count={3} />
            </SideSection>
          </>
        }
      />
    </LoadingRegion>
  );
}

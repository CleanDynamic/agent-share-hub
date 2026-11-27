/* The phone Builds cards' loading blocks, in a module of their own: the route table's placeholder draws them, and the
   placeholder is in the first download, so it must not bring BuildsPhone's sheets (and the dialog library) with it. */

import { Skeleton } from "@/components/brand/Skeleton";
import { PHONE_ROW_STYLE, usePhoneRowLine } from "@/components/phone/phoneRow";
import { PHONE_MARGIN, PHONE_PILL } from "@/components/shell/chromeSize";
import { t } from "@/lib/theme/tokens";

/** Cards as they load: Panel blocks at the cards' own height, so the page does not jump. */
export function PhoneCardSkeletons({ count, height }: { count: number; height: number }) {
  return (
    <div aria-hidden="true" style={{ paddingTop: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ margin: `0 ${PHONE_MARGIN}px 8px`, padding: "12px 14px", boxSizing: "border-box", height, borderRadius: 12, background: t.surface, display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width="55%" height={14} radius={4} />
          <Skeleton width="35%" height={12} radius={4} />
        </div>
      ))}
    </div>
  );
}


/** 29c: Builds' rows as they load, the shape of the list in `07-builds.jpg`: 64 tall, a 15 bar over a 13 bar at the left, a
    48 square at the right, 12 between rows. Each block is no taller than the text or thumbnail it stands for. */
export const PHONE_ROW_SKELETON = { row: 64, gap: 12, thumb: 48, title: 15, meta: 13 } as const;

export function PhoneRowSkeletons({ count }: { count: number }) {
  const { row, gap, thumb, title, meta } = PHONE_ROW_SKELETON;
  return (
    <div aria-hidden="true" data-testid="phone-row-skeletons" style={{ paddingTop: 12 }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} style={{ margin: `0 ${PHONE_MARGIN}px ${gap}px`, height: row, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton width="62%" height={title} radius={4} />
            <Skeleton width="44%" height={meta} radius={4} />
          </div>
          <Skeleton width={thumb} height={thumb} radius={8} />
        </div>
      ))}
    </div>
  );
}

/** 29f: the lens pills' row as it loads: the 52 row with the structural line, three pills' worth of block, so the bar's line does
    not move when the real row arrives. */
export function PhoneLensRowSkeleton() {
  usePhoneRowLine(true);
  return (
    <div aria-hidden="true" data-testid="phone-lens-skeleton" style={{ ...PHONE_ROW_STYLE, display: "flex", alignItems: "center", gap: 8, padding: `0 ${PHONE_MARGIN}px` }}>
      {[44, 88, 100].map((width) => (
        <Skeleton key={width} width={width} height={PHONE_PILL} radius={PHONE_PILL / 2} />
      ))}
    </div>
  );
}

/* The phone Builds cards' loading blocks, in a module of their own: the route table's placeholder draws them, and the
   placeholder is in the first download, so it must not bring BuildsPhone's sheets (and the dialog library) with it. */

import { Skeleton } from "@/components/brand/Skeleton";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
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


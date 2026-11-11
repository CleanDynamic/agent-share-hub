/* BF-01 P1 (C4): the one way a Builds view shows that a value is missing. An en dash in `--label`, hidden from a screen
   reader, which hears "no value" in its place. Used only where code prints a stand-in for nothing: a real zero stays a
   zero, and a taxonomy value such as "Cost not stated" is a value. */

import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { t } from "@/lib/theme/tokens";

export function Empty() {
  return (
    <span data-testid="empty-value" style={{ color: t.label }}>
      <span aria-hidden="true">–</span>
      <VisuallyHidden>no value</VisuallyHidden>
    </span>
  );
}

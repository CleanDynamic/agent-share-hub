/* CA-23 P2: put the write guard on the REST client while a build is open in the composer.

   It goes on in a layout effect, so it is there before the first read the page makes (the line kept from an earlier load is
   replayed ahead of that read). Writes kept from an earlier load that no live call is waiting on are counted as pending until
   they have gone. */

import { useLayoutEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { pendingWrites } from "@/lib/build/pendingWrites";
import { installWriteGuard } from "@/lib/build/writeGuard";

export function useWriteGuard(buildId: string | undefined): void {
  useLayoutEffect(() => {
    if (!buildId) return;
    const { uninstall } = installWriteGuard(supabase, {
      buildId,
      onChange: ({ orphans }) => pendingWrites.set("queued", orphans),
    });
    return () => {
      uninstall();
      pendingWrites.set("queued", 0);
    };
  }, [buildId]);
}

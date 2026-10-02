// A route element that is one flag away from the old page (UI-P20).
//
//   <FrameRoute site={<NewPage />} legacy={<OldPage />} />
//
// renders `site` when the `site_frame` flag is on and the current path is in
// `SITE_FRAME_ROUTES`, and `legacy` otherwise. Every page prompt (UI-P27 to
// UI-P36) swaps its route element to this, so the legacy page file is never
// edited and stays one flag away. `AppShell` decides the frame with the same two
// conditions, so a page and its frame always agree.
//
// `hold` (UI-P36) is for a page that SPENDS SOMETHING ON MOUNT. The flag reads
// false until its row arrives, so every route renders the legacy page first and
// swaps when the answer comes. That is harmless for a page that only reads, and
// wrong for one that uses a single-use email-link token: the legacy page would
// spend it and the site page, mounted a moment later, would find it dead. A held
// route renders nothing until the answer is known, so exactly one of the two
// ever mounts.

import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { useSiteFrameFlag, useSiteFrameKnown } from "@/lib/shell/flags";

import { usesSiteFrame } from "./siteFrameRoutes";

export interface FrameRouteProps {
  site: ReactNode;
  legacy: ReactNode;
  /** Render nothing until the flag's answer is known. */
  hold?: boolean;
}

/** Its children once the flag's answer is known, and nothing before. */
function WhenKnown({ children }: { children: ReactNode }) {
  return useSiteFrameKnown() ? <>{children}</> : null;
}

export function FrameRoute({ site, legacy, hold = false }: FrameRouteProps) {
  const on = useSiteFrameFlag();
  const { pathname } = useLocation();
  const page = on && usesSiteFrame(pathname) ? site : legacy;
  return hold ? <WhenKnown>{page}</WhenKnown> : <>{page}</>;
}

export default FrameRoute;

// A route element that is one flag away from the old page (UI-P20).
//
//   <FrameRoute site={<NewPage />} legacy={<OldPage />} />
//
// renders `site` when the `site_frame` flag is on and the current path is in
// `SITE_FRAME_ROUTES`, and `legacy` otherwise. Every page prompt (UI-P27 to
// UI-P36) swaps its route element to this, so the legacy page file is never
// edited and stays one flag away. `AppShell` decides the frame with the same two
// conditions, so a page and its frame always agree.

import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { useSiteFrameFlag } from "@/lib/shell/flags";

import { usesSiteFrame } from "./siteFrameRoutes";

export interface FrameRouteProps {
  site: ReactNode;
  legacy: ReactNode;
}

export function FrameRoute({ site, legacy }: FrameRouteProps) {
  const on = useSiteFrameFlag();
  const { pathname } = useLocation();
  return <>{on && usesSiteFrame(pathname) ? site : legacy}</>;
}

export default FrameRoute;

/* UI-P16 — which routes render in `SiteFrame` when the `site_frame` flag is on.

   React Router patterns, matched against the pathname. Starts empty: each page
   prompt (UI-P20 for /notifications, UI-P27 to UI-P36 for the rest) adds its
   own. A route that is not here renders in `FlatShell` whatever the flag says. */

import { matchPath } from "react-router-dom";

export const SITE_FRAME_ROUTES: string[] = [];

/** True when `pathname` is one of `SITE_FRAME_ROUTES`. */
export function usesSiteFrame(pathname: string): boolean {
  return SITE_FRAME_ROUTES.some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null);
}

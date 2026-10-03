// UI-P41: FrameRoute now always renders the site page. The flag has been removed.
// The `legacy` prop is still accepted for backwards compatibility during migration
// but is ignored. After all routes are updated, this file will be deleted.

import type { ReactNode } from "react";

export interface FrameRouteProps {
  site: ReactNode;
  legacy?: ReactNode;
  /** Deprecated: held routes are no longer needed */
  hold?: boolean;
}

export function FrameRoute({ site }: FrameRouteProps) {
  return <>{site}</>;
}

export default FrameRoute;

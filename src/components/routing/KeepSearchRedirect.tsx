/* SV-02: an old address that moved: `/gallery` is `/builds`, `/bounties` is `/openbuilds`. The redirect replaces the
   history entry and keeps the query string and the hash, so a saved link with `?q=` still lands where it meant to.

   SV-04: navigation runs as a transition, so whatever the redirect draws stays on screen until the new page's code is in.
   It draws the new page's placeholder, so the page area is never empty on the way. */

import { Navigate, useLocation } from "react-router-dom";

import { RoutePlaceholder } from "@/lib/routing/RoutePlaceholder";

export function KeepSearchRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return (
    <>
      <Navigate to={{ pathname: to, search, hash }} replace />
      <RoutePlaceholder pathname={to} />
    </>
  );
}

export default KeepSearchRedirect;

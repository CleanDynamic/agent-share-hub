/* SV-02: an old address that moved: `/gallery` is `/builds`, `/bounties` is `/openbuilds`. The redirect replaces the
   history entry and keeps the query string and the hash, so a saved link with `?q=` still lands where it meant to. */

import { Navigate, useLocation } from "react-router-dom";

export function KeepSearchRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}

export default KeepSearchRedirect;

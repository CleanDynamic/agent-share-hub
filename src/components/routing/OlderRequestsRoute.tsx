/* UX-09 Q3: /openbuilds/requests, Older requests, while any request is open; /openbuilds once none is.

   The requests page renders at once and the check runs beside it (one small read), so an open request costs no extra round. When the
   check says no request is open, the address is replaced by /openbuilds. A failed check keeps the page: only a definite "none open"
   retires it. Each request's own page (/openbuilds/<id>/solve) is a different route and is never redirected. */

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { KeepSearchRedirect } from "@/components/routing/KeepSearchRedirect";
import { OPEN_REQUESTS_KEY, hasOpenRequests } from "@/lib/bounty/openRequests";

export function useOlderRequestsOpen(): boolean | undefined {
  const open = useQuery({ queryKey: OPEN_REQUESTS_KEY, queryFn: hasOpenRequests, staleTime: 60_000, retry: false });
  return open.isError ? true : open.data;
}

export function OlderRequestsRoute({ children }: { children: ReactNode }) {
  const open = useOlderRequestsOpen();
  if (open === false) return <KeepSearchRedirect to="/openbuilds" />;
  return <>{children}</>;
}

export default OlderRequestsRoute;

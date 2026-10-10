/* The sessions in no build yet: what a connector has parked and nobody has put
   into a build. ONE QUERY for Drafts' "Sessions" and the composer's "Your
   sessions", so the two panels cannot disagree about how fresh it is.

   A CONNECTOR WRITES THIS LIST FROM OUTSIDE THE BROWSER. finish_import
   (supabase/functions/mcp) parks a conversation as a `parsed` import_sessions
   row while the creator is in another application, and nothing tells this page
   it happened. So the list is read again whenever a panel opens, whenever the
   reader comes back to the tab, and every WAITING_REFRESH_MS while a panel is
   on screen (TanStack pauses that in a background tab). Meanwhile the cached
   list shows at once, so opening a panel never flashes a skeleton; a session
   that arrived since joins it one round trip later.

   It used to be cached for thirty seconds and read again only once older than
   that, so a session parked just after Drafts was read was missing from the
   next panel opened, and from the open one until a reload. */

import { useQuery } from "@tanstack/react-query";

import { listSessions } from "@/lib/build/sessions";

/** How often an open panel asks again while its tab is visible. */
export const WAITING_REFRESH_MS = 10_000;

export const waitingSessionsKey = ["build", "listSessions", false] as const;

export function useWaitingSessions() {
  return useQuery({
    queryKey: waitingSessionsKey,
    queryFn: () => listSessions({ includeAttached: false }),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: WAITING_REFRESH_MS,
  });
}

/* The creator's whole session library: the composer's "Your sessions".

   A SESSION BELONGS TO THE ACCOUNT, NOT TO A BUILD. This list is every session
   the creator can still use — waiting, already in this build or another, or
   marked expired — newest first (listLibrarySessions). Putting one into a build
   does not take it out of the list on any other build.

   A CONNECTOR WRITES TO IT FROM OUTSIDE THE BROWSER, so it is read again the
   way useWaitingSessions is: whenever the panel opens, whenever the reader
   comes back to the tab, and every WAITING_REFRESH_MS while it is on screen.
   The cached list shows at once meanwhile. */

import { useQuery } from "@tanstack/react-query";

import { listLibrarySessions } from "@/lib/build/sessions";

import { WAITING_REFRESH_MS } from "./useWaitingSessions";

export const librarySessionsKey = ["build", "listLibrarySessions"] as const;

export function useLibrarySessions() {
  return useQuery({
    queryKey: librarySessionsKey,
    queryFn: () => listLibrarySessions(),
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: WAITING_REFRESH_MS,
  });
}

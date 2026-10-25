/* UI-P46 — /drafts in the site frame: the container.

   Loads the creator's drafts and sessions through `src/lib/build/` functions
   only, maps them to `DraftsView`'s props and runs its three writes. The old
   page (`src/pages/Drafts.tsx`, content_items and content_blocks) is not edited;
   it lives at /drafts/posts. THIS PAGE MAKES NO REQUEST TO content_items OR
   content_blocks.

   Every write invalidates the same three keys, because a session joining a
   draft changes the drafts list (its count), both session lists, and the
   header's badge.

   THE WAITING SESSIONS ARE READ AGAIN while the page is open
   (`useWaitingSessions`), because a connector adds to them from outside the
   browser. A list already on screen therefore stays when one of those reads
   fails; the error state is for a list that never loaded.

   CA-10 (CA-09 F3): EACH PANEL HAS ITS OWN STATUS. The drafts panel's comes
   from the drafts read alone and the sessions panel's from the waiting read
   alone, so drafts show the moment they arrive, whatever the sessions read is
   doing, and a failure says so in its own panel with its code. Try again asks
   again only for that panel's read. "Show N already in a build" stays
   optional: if its read fails the line is absent, and the failure is logged.
   The waiting read polls only while the Sessions panel is on screen. */

import { useCallback } from "react";
import { usePageReady } from "@/lib/routing/pageReady";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { useConnectorDialog } from "@/components/connect/ConnectorDialog";
import { useOnScreen } from "@/hooks/useOnScreen";
import { librarySessionsKey, useLibrarySessions } from "@/hooks/useLibrarySessions";
import { listDraftsWithSessions, type DraftListItem } from "@/lib/build/drafts";
import { attachSession } from "@/lib/build/sessions";

import { DraftsView } from "./DraftsView";
import { draftTitle } from "./draftsModel";

const STALE_MS = 30_000;

export function DraftsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const connector = useConnectorDialog();

  const draftsQuery = useQuery({
    queryKey: ["build", "listDraftsWithSessions"],
    queryFn: listDraftsWithSessions,
    staleTime: STALE_MS,
  });
  const [sessionsAnchor, sessionsOnScreen] = useOnScreen<HTMLSpanElement>();
  /* CA-12: every finished session, newest first, in pages of 100. Waiting, in a draft, in several, or expired: none is
     hidden and none expires, so there is no second list of "already in a build". */
  const library = useLibrarySessions({ active: sessionsOnScreen, withUnfinished: false });

  const refresh = useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["build", "listDraftsWithSessions"] }),
        qc.invalidateQueries({ queryKey: librarySessionsKey }),
        qc.invalidateQueries({ queryKey: ["build", "listBuildSessions"] }),
        qc.invalidateQueries({ queryKey: ["build", "countDraftBuilds"] }),
      ]),
    [qc],
  );

  const failed = (line: string) => toast.error(line);

  const addToNew = useCallback(
    async (sessionId: string) => {
      try {
        const id = await attachSession(sessionId, { kind: "new" });
        void refresh();
        toast("New build started.", { action: { label: "Open", onClick: () => navigate(`/compose/${id}`) } });
      } catch (error) {
        console.error("[Drafts] attachSession (new) failed", error);
        void refresh();
        failed("Couldn't start a build from that session.");
      }
    },
    [navigate, refresh],
  );

  const addToDraft = useCallback(
    async (sessionId: string, draft: Pick<DraftListItem, "id" | "title">) => {
      try {
        await attachSession(sessionId, { kind: "existing", buildId: draft.id });
        void refresh();
        toast(`Added to ${draftTitle(draft.title)}.`);
      } catch (error) {
        console.error("[Drafts] attachSession (existing) failed", error);
        void refresh();
        failed("Couldn't add that session.");
      }
    },
    [refresh],
  );

  const draftsStatus = draftsQuery.data ? "ready" : draftsQuery.isLoadingError ? "error" : "loading";
  usePageReady("drafts", draftsStatus !== "loading");
  const sessionsStatus = library.data ? "ready" : library.isLoadingError ? "error" : "loading";

  return (
    <>
      <SeoHead title="Drafts — buildgallery" description="Builds in progress, and every session you have sent." path="/drafts" noIndex />
      <DraftsView
        now={Date.now()}
        draftsStatus={draftsStatus}
        draftsError={draftsQuery.isLoadingError ? draftsQuery.error : undefined}
        onRetryDrafts={() => void draftsQuery.refetch()}
        sessionsStatus={sessionsStatus}
        sessionsError={library.isLoadingError ? library.error : undefined}
        onRetrySessions={() => void library.refetch()}
        sessionsAnchor={sessionsAnchor}
        drafts={draftsQuery.data ?? []}
        sessions={library.data ?? []}
        moreSessions={library.hasMore ? { loading: library.loadingMore, onMore: library.fetchMore } : undefined}
        onAddToNew={addToNew}
        onAddToDraft={addToDraft}
        onConnect={connector.open}
      />
    </>
  );
}

export default DraftsPage;

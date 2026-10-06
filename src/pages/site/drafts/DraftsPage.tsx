/* UI-P46 — /drafts in the site frame: the container.

   Loads the creator's drafts and sessions through `src/lib/build/` functions
   only, maps them to `DraftsView`'s props and runs its three writes. The old
   page (`src/pages/Drafts.tsx`, content_items and content_blocks) is not edited;
   it lives at /drafts/posts. THIS PAGE MAKES NO REQUEST TO content_items OR
   content_blocks.

   Every write invalidates the same three keys, because a session joining a
   draft changes the drafts list (its count), both session lists, and the
   header's badge. */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { useConnectorDialog } from "@/components/connect/ConnectorDialog";
import { listDraftsWithSessions, type DraftListItem } from "@/lib/build/drafts";
import { attachSession, listSessions, removeSession } from "@/lib/build/sessions";

import { DraftsView } from "./DraftsView";
import { draftTitle } from "./draftsModel";

const STALE_MS = 30_000;

export function DraftsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const connector = useConnectorDialog();
  const [showAttached, setShowAttached] = useState(false);

  const draftsQuery = useQuery({
    queryKey: ["build", "listDraftsWithSessions"],
    queryFn: listDraftsWithSessions,
    staleTime: STALE_MS,
  });
  const waitingQuery = useQuery({
    queryKey: ["build", "listSessions", false],
    queryFn: () => listSessions({ includeAttached: false }),
    staleTime: STALE_MS,
  });
  const allQuery = useQuery({
    queryKey: ["build", "listSessions", true],
    queryFn: () => listSessions({ includeAttached: true }),
    staleTime: STALE_MS,
  });

  const attached = useMemo(() => (allQuery.data ?? []).filter((session) => session.buildId !== null), [allQuery.data]);

  const refresh = useCallback(
    () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["build", "listDraftsWithSessions"] }),
        qc.invalidateQueries({ queryKey: ["build", "listSessions"] }),
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

  const remove = useCallback(
    async (sessionId: string) => {
      try {
        await removeSession(sessionId);
        void refresh();
        toast("Session removed.");
      } catch (error) {
        console.error("[Drafts] removeSession failed", error);
        void refresh();
        failed("Couldn't remove that session.");
      }
    },
    [refresh],
  );

  const status = draftsQuery.isError || waitingQuery.isError ? "error" : draftsQuery.data && waitingQuery.data ? "ready" : "loading";

  return (
    <>
      <SeoHead title="Drafts — buildgallery" description="Builds in progress, and the sessions waiting to join one." path="/drafts" noIndex />
      <DraftsView
        now={Date.now()}
        status={status}
        onRetry={() => {
          void draftsQuery.refetch();
          void waitingQuery.refetch();
          void allQuery.refetch();
        }}
        drafts={draftsQuery.data ?? []}
        sessions={waitingQuery.data ?? []}
        attached={attached}
        showAttached={showAttached}
        onToggleAttached={() => setShowAttached((value) => !value)}
        onAddToNew={addToNew}
        onAddToDraft={addToDraft}
        onRemove={remove}
        onConnect={connector.open}
      />
    </>
  );
}

export default DraftsPage;

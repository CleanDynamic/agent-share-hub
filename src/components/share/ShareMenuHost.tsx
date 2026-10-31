// SV-26 P2: the share menu and what it needs to load its targets and send. ShareMenuProvider keeps the context and the
// open arguments; this file loads the first time a reader shares, or at idle.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ShareMenu, { type ShareCollection, type ShareContentMeta, type ShareThread } from "./ShareMenu";
import type { ShareableType } from "./ShareMenuProvider";
import { useAuth } from "@/contexts/AuthContext";
import { absoluteUrl, blueprintUrl, copyToClipboard, stageDeepLink, blockDeepLink } from "@/lib/deepLink";
import { getShareTargets } from "@/lib/share/getShareTargets";
import { sendContentShareToThread } from "@/lib/share/sendContentShareToThread";
import { saveToCollection, removeFromCollection } from "@/lib/library/saveToCollection";
import { createCollection } from "@/lib/library/createCollection";
import { supabase } from "@/integrations/supabase/client";

function buildDeepLink(args: {
  contentType: ShareableType;
  contentId: string;
  contentMeta: ShareContentMeta;
}): string {
  const { contentType, contentId, contentMeta } = args;
  if (contentType === "stage" && contentMeta.parentSlug) {
    // parentSlug here actually carries the parent blueprint id
    return absoluteUrl(stageDeepLink(contentMeta.parentSlug, contentId));
  }
  if (contentType === "block" && contentMeta.parentSlug) {
    return absoluteUrl(blockDeepLink(contentMeta.parentSlug, contentId));
  }
  return absoluteUrl(blueprintUrl(contentId));
}

export default function ShareMenuHost({
  isOpen,
  onClose,
  anchorEl,
  contentType,
  contentId,
  contentMeta,
}: {
  isOpen: boolean;
  onClose: () => void;
  anchorEl: HTMLElement | { getBoundingClientRect: () => DOMRect } | null;
  contentType: ShareableType;
  contentId: string;
  contentMeta: ShareContentMeta;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [threads, setThreads] = useState<ShareThread[]>([]);
  const [collections, setCollections] = useState<ShareCollection[]>([]);

  const loadTargets = useCallback(
    async (cType: ShareableType, cId: string) => {
      if (!user?.id) {
        setThreads([]);
        setCollections([]);
        return;
      }
      try {
        const targets = await getShareTargets(user.id);
        setThreads(
          targets.recentThreads.map((t) => ({
            id: t.id,
            displayName:
              t.otherParticipant?.display_name ??
              t.otherParticipant?.username ??
              t.title ??
              "Conversation",
            avatarUrl: t.otherParticipant?.avatar_url ?? null,
          }))
        );

        // Determine which collections already contain this item.
        const collectionIds = targets.collections.map((c) => c.id);
        let containing = new Set<string>();
        if (collectionIds.length) {
          const { data: rows } = await supabase
            .from("collection_items")
            .select("collection_id, item_kind, item_id, content_id")
            .in("collection_id", collectionIds);
          for (const r of (rows ?? []) as any[]) {
            const k = r.item_kind ?? "blueprint";
            const id = r.item_id ?? r.content_id;
            if (k === cType && id === cId) containing.add(r.collection_id);
          }
        }

        setCollections(
          targets.collections.map((c) => ({
            id: c.id,
            name: c.name,
            accentColor: c.accentColor || "var(--text2)",
            itemCount: c.itemCount,
            containsThisItem: containing.has(c.id),
          }))
        );
      } catch (e) {
        console.error("[ShareMenu] failed to load targets", e);
      }
    },
    [user?.id]
  );

  // The targets load when the menu opens (the provider mounts this on the first open, with isOpen already true).
  useEffect(() => {
    if (isOpen && contentId) void loadTargets(contentType, contentId);
  }, [isOpen, contentType, contentId, loadTargets]);

  const handleCopyLink = useCallback(() => {
    const url = buildDeepLink({ contentType, contentId, contentMeta });
    void copyToClipboard(url);
  }, [contentType, contentId, contentMeta]);

  const handleSendToThread = useCallback(
    async (threadId: string) => {
      try {
        await sendContentShareToThread({
          threadId,
          contentType,
          contentId,
        });
        toast.success("Sent");
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "Failed to send");
      }
    },
    [contentType, contentId]
  );

  const handleSaveToCollection = useCallback(
    async (collectionId: string, isAlreadyIn: boolean) => {
      try {
        if (isAlreadyIn) {
          await removeFromCollection(collectionId, contentType as any, contentId);
          toast.success("Removed");
        } else {
          await saveToCollection(collectionId, contentType as any, contentId);
          toast.success("Saved");
        }
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "Failed to save");
      }
    },
    [contentType, contentId]
  );

  const handleCreateCollection = useCallback(
    async (name: string) => {
      if (!user?.id) {
        toast.error("Sign in to create a collection");
        return;
      }
      try {
        const c = await createCollection({ ownerId: user.id, name });
        await saveToCollection(c.id, contentType as any, contentId);
        toast.success(`Saved to ${name}`);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "Failed to create collection");
      }
    },
    [user?.id, contentType, contentId]
  );

  const handleComposeNewThread = useCallback(() => {
    navigate(
      `/messages?compose-with-content=${contentType}-${contentId}`
    );
  }, [navigate, contentType, contentId]);

  return (
      <ShareMenu
        isOpen={isOpen}
        onClose={onClose}
        anchorEl={anchorEl}
        contentType={contentType as any}
        contentId={contentId}
        contentMeta={contentMeta}
        userCollections={collections}
        recentThreads={threads}
        onCopyLink={handleCopyLink}
        onSendToThread={handleSendToThread}
        onSaveToCollection={handleSaveToCollection}
        onCreateCollection={handleCreateCollection}
        onComposeNewThread={handleComposeNewThread}
      />
  );
}

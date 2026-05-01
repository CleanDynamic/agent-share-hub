import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ShareMenu, {
  type ShareCollection,
  type ShareContentMeta,
  type ShareThread,
} from "./ShareMenu";
import { useAuth } from "@/contexts/AuthContext";
import { absoluteUrl, blueprintUrl, copyToClipboard, stageDeepLink, blockDeepLink } from "@/lib/deepLink";
import { getShareTargets } from "@/lib/share/getShareTargets";
import { sendContentShareToThread } from "@/lib/share/sendContentShareToThread";
import { saveToCollection, removeFromCollection } from "@/lib/library/saveToCollection";
import { createCollection } from "@/lib/library/createCollection";
import { supabase } from "@/integrations/supabase/client";

export type ShareableType = "blueprint" | "stage" | "block" | "blog" | "bounty";

export interface OpenShareMenuArgs {
  contentType: ShareableType;
  contentId: string;
  contentMeta: ShareContentMeta;
  /** Element to anchor menu to. For right-click, pass a virtual element with getBoundingClientRect. */
  anchorEl: HTMLElement | { getBoundingClientRect: () => DOMRect };
}

interface ShareMenuContextValue {
  openShareMenu: (args: OpenShareMenuArgs) => void;
  closeShareMenu: () => void;
  isOpen: boolean;
}

const ShareMenuContext = createContext<ShareMenuContextValue | undefined>(
  undefined
);

export function useShareMenu(): ShareMenuContextValue {
  const ctx = useContext(ShareMenuContext);
  if (!ctx) throw new Error("useShareMenu must be used within ShareMenuProvider");
  return ctx;
}

/** Build a virtual anchor element from screen coordinates (for right-click). */
export function virtualAnchorFromPoint(x: number, y: number) {
  return {
    getBoundingClientRect: () =>
      ({
        x,
        y,
        top: y,
        left: x,
        right: x,
        bottom: y,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  };
}

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

export function ShareMenuProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<
    HTMLElement | { getBoundingClientRect: () => DOMRect } | null
  >(null);
  const [contentType, setContentType] = useState<ShareableType>("blueprint");
  const [contentId, setContentId] = useState<string>("");
  const [contentMeta, setContentMeta] = useState<ShareContentMeta>({ title: "" });

  const [threads, setThreads] = useState<ShareThread[]>([]);
  const [collections, setCollections] = useState<ShareCollection[]>([]);

  // Keep latest open args for the keyboard shortcut.
  const lastArgsRef = useRef<OpenShareMenuArgs | null>(null);

  const closeShareMenu = useCallback(() => {
    setIsOpen(false);
    setAnchorEl(null);
  }, []);

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
            accentColor: c.accentColor || "#9CA3AF",
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

  const openShareMenu = useCallback(
    (args: OpenShareMenuArgs) => {
      lastArgsRef.current = args;
      setContentType(args.contentType);
      setContentId(args.contentId);
      setContentMeta(args.contentMeta);
      setAnchorEl(args.anchorEl);
      setIsOpen(true);
      void loadTargets(args.contentType, args.contentId);
    },
    [loadTargets]
  );

  // Cmd/Ctrl + Shift + S re-opens for the last item (best-effort).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === "s") {
        const last = lastArgsRef.current;
        if (last) {
          e.preventDefault();
          openShareMenu(last);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openShareMenu]);

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

  const value = useMemo<ShareMenuContextValue>(
    () => ({ openShareMenu, closeShareMenu, isOpen }),
    [openShareMenu, closeShareMenu, isOpen]
  );

  return (
    <ShareMenuContext.Provider value={value}>
      {children}
      <ShareMenu
        isOpen={isOpen}
        onClose={closeShareMenu}
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
    </ShareMenuContext.Provider>
  );
}

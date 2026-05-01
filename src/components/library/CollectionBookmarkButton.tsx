import * as React from "react";
import { Bookmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  saveToCollection,
  removeFromCollection,
} from "@/lib/library/saveToCollection";
import {
  useShareMenu,
  type ShareableType,
} from "@/components/share/ShareMenuProvider";
import type { CollectionItemKind } from "@/lib/library/types";

interface CollectionBookmarkButtonProps {
  contentType: ShareableType; // "blueprint" | "blog" | "bounty" | "stage" | "block"
  contentId: string;
  contentMeta: { title?: string; slug?: string; parentSlug?: string };
  /** Override pixel size (icon stroke). Default 14. */
  size?: number;
  className?: string;
  /** Visual weight; default "icon" (no chrome). */
  variant?: "icon" | "subtle";
}

const TEAL = "#2EC4B6";

/**
 * Quick bookmark affordance for cards & headers.
 *  - Click: toggle membership in the user's default "Saved items" collection.
 *  - Right-click / long-press: open ShareMenu's Save-to-Library popover for
 *    a specific collection.
 *  - Filled teal when the item is in ANY of the user's collections.
 */
export function CollectionBookmarkButton({
  contentType,
  contentId,
  contentMeta,
  size = 14,
  className,
  variant = "icon",
}: CollectionBookmarkButtonProps) {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { openShareMenu } = useShareMenu();
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const longPressTimer = React.useRef<number | null>(null);

  const itemKind: CollectionItemKind = contentType as CollectionItemKind;

  // Membership query: any collection containing this item.
  const membershipQuery = useQuery({
    queryKey: ["bookmark_membership", user?.id, itemKind, contentId],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: cols } = await supabase
        .from("collections")
        .select("id, is_default")
        .eq("owner_id", user!.id);
      const ownedIds = (cols ?? []).map((c: any) => c.id as string);
      const defaultId =
        ((cols ?? []).find((c: any) => c.is_default)?.id as string) ?? null;
      if (ownedIds.length === 0) {
        return { inAny: false, defaultCollectionId: defaultId, inDefault: false };
      }
      const { data: items } = await supabase
        .from("collection_items")
        .select("collection_id")
        .in("collection_id", ownedIds)
        .or(
          `and(item_kind.eq.${itemKind},item_id.eq.${contentId}),and(item_kind.is.null,content_id.eq.${contentId})`
        );
      const set = new Set((items ?? []).map((i: any) => i.collection_id));
      return {
        inAny: set.size > 0,
        defaultCollectionId: defaultId,
        inDefault: defaultId ? set.has(defaultId) : false,
      };
    },
  });

  const [optimisticSaved, setOptimisticSaved] = React.useState<boolean | null>(
    null
  );
  const isSaved = optimisticSaved ?? membershipQuery.data?.inAny ?? false;

  const ensureDefaultCollection = async (): Promise<string | null> => {
    let id = membershipQuery.data?.defaultCollectionId ?? null;
    if (id) return id;
    // Create one on demand if missing.
    const { data, error } = await supabase
      .from("collections")
      .insert({
        owner_id: user!.id,
        title: "Saved items",
        is_default: true,
        is_public: false,
        visibility: "private",
        accent_color: "rgba(255,255,255,0.4)",
      } as any)
      .select("id")
      .single();
    if (error) return null;
    id = (data as any).id;
    return id;
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isLoggedIn || !user) {
      toast("Sign in to save this");
      setTimeout(() => navigate("/signup"), 800);
      return;
    }

    const data = membershipQuery.data;
    const wasSaved = data?.inAny ?? false;
    setOptimisticSaved(!wasSaved);

    try {
      const defaultId = await ensureDefaultCollection();
      if (!defaultId) throw new Error("Couldn't access Saved items");

      if (wasSaved) {
        // Remove from default ONLY (preserve user-named collections).
        if (data?.inDefault) {
          await removeFromCollection(defaultId, itemKind, contentId);
          toast("Removed from Saved items");
        } else {
          // Item exists only in user-named collections — open picker so they
          // can manage it explicitly instead of silently no-op'ing.
          setOptimisticSaved(null);
          if (btnRef.current) {
            openShareMenu({
              contentType,
              contentId,
              contentMeta,
              anchorEl: btnRef.current,
            });
          }
          return;
        }
      } else {
        await saveToCollection(defaultId, itemKind, contentId);
        toast("Saved to library");
      }

      qc.invalidateQueries({ queryKey: ["bookmark_membership"] });
      qc.invalidateQueries({ queryKey: ["library_collections"] });
      qc.invalidateQueries({ queryKey: ["library_all_items"] });
      qc.invalidateQueries({ queryKey: ["collection_detail"] });
    } catch (err: any) {
      setOptimisticSaved(null);
      toast.error(err?.message ?? "Couldn't update bookmark");
    } finally {
      // Let the next refetch settle the truth.
      setTimeout(() => setOptimisticSaved(null), 600);
    }
  };

  const openSavePopover = () => {
    if (!isLoggedIn || !user) {
      toast("Sign in to save this");
      setTimeout(() => navigate("/signup"), 800);
      return;
    }
    if (btnRef.current) {
      openShareMenu({
        contentType,
        contentId,
        contentMeta,
        anchorEl: btnRef.current,
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openSavePopover();
  };

  const startLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      openSavePopover();
      longPressTimer.current = null;
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchCancel={cancelLongPress}
      onTouchMove={cancelLongPress}
      aria-label={isSaved ? "Saved — right-click for collections" : "Save"}
      title={isSaved ? "Saved (right-click for collections)" : "Save"}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: variant === "subtle" ? "rgba(255,255,255,0.04)" : "transparent",
        border: "none",
        borderRadius: 6,
        padding: variant === "subtle" ? 4 : 2,
        cursor: "pointer",
        color: isSaved ? TEAL : "rgba(255,255,255,0.55)",
        transition: "color 0.12s, background 0.12s",
      }}
    >
      <Bookmark
        size={size}
        strokeWidth={1.75}
        style={{
          fill: isSaved ? TEAL : "transparent",
          color: isSaved ? TEAL : "currentColor",
          transition: "fill 0.15s, color 0.15s",
        }}
      />
    </button>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  QuotableSelectionOverlay,
  type OverlayPosition,
  type SelectionData,
} from "./QuotableSelectionOverlay";
import { useReblogCompose } from "@/contexts/ReblogComposeContext";
import { supabase } from "@/integrations/supabase/client";

const MIN_LEN = 4;

function findQuotableAncestor(node: Node | null): HTMLElement | null {
  let el: Node | null = node;
  while (el) {
    if (el.nodeType === 1) {
      const e = el as HTMLElement;
      if (e.dataset?.quotable === "true") return e;
    }
    el = el.parentNode;
  }
  return null;
}

function findAncestorWithAttr(node: Node | null, attr: string): HTMLElement | null {
  let el: Node | null = node;
  while (el) {
    if (el.nodeType === 1) {
      const e = el as HTMLElement;
      if (e.getAttribute(attr)) return e;
    }
    el = el.parentNode;
  }
  return null;
}

export function QuotableSelectionProvider() {
  const { openReblog } = useReblogCompose();
  const [selection, setSelection] = useState<SelectionData | null>(null);
  const [position, setPosition] = useState<OverlayPosition | null>(null);
  const rafRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    setSelection(null);
    setPosition(null);
  }, []);

  useEffect(() => {
    const handle = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          setSelection(null);
          setPosition(null);
          return;
        }
        const text = sel.toString().trim();
        if (text.length < MIN_LEN) {
          setSelection(null);
          setPosition(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const startQ = findQuotableAncestor(range.startContainer);
        const endQ = findQuotableAncestor(range.endContainer);
        if (!startQ || !endQ || startQ !== endQ) {
          setSelection(null);
          setPosition(null);
          return;
        }
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          setSelection(null);
          setPosition(null);
          return;
        }

        const blockEl = findAncestorWithAttr(range.startContainer, "data-source-block-id");
        const postEl = findAncestorWithAttr(range.startContainer, "data-source-post-id");

        const data: SelectionData = {
          text,
          rect,
          sourceBlockId: blockEl?.getAttribute("data-source-block-id") || undefined,
          sourceBlockTypeLabel:
            blockEl?.getAttribute("data-source-block-label") || undefined,
          sourcePostId: postEl?.getAttribute("data-source-post-id") || undefined,
          sourcePostSlug: postEl?.getAttribute("data-source-post-slug") || undefined,
        };

        const placeAbove = rect.top > 60;
        const pos: OverlayPosition = {
          x: rect.left + rect.width / 2,
          y: placeAbove ? rect.top - 8 : rect.bottom + 12,
          placement: placeAbove ? "above" : "below",
        };

        setSelection(data);
        setPosition(pos);
      });
    };

    document.addEventListener("selectionchange", handle);
    return () => {
      document.removeEventListener("selectionchange", handle);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleQuoteReblog = useCallback(
    async (s: SelectionData) => {
      if (!s.sourcePostId) {
        toast.error("Couldn't determine source post");
        return;
      }
      // Fetch minimal post metadata for the compose sheet
      try {
        const { data: post } = await (supabase.from("content_items") as any)
          .select(
            "id, slug, title, description, content_type, post_category, cover_image_url, created_at, creator_id, creator:profiles!content_items_creator_id_fkey(id, username, display_name, avatar_url)"
          )
          .eq("id", s.sourcePostId)
          .maybeSingle();
        if (!post) {
          toast.error("Source post unavailable");
          return;
        }
        openReblog({
          id: post.id,
          slug: post.slug ?? s.sourcePostSlug ?? post.id,
          title: post.title ?? "Post",
          description: post.description ?? null,
          post_type: post.post_category ?? post.content_type ?? null,
          content_type: post.content_type ?? null,
          cover_image_url: post.cover_image_url ?? null,
          created_at: post.created_at ?? null,
          creator_id: post.creator_id ?? null,
          author: post.creator
            ? {
                id: post.creator.id,
                display_name: post.creator.display_name,
                username: post.creator.username,
                avatar_url: post.creator.avatar_url,
              }
            : null,
          excerptContext: {
            text: s.text,
            sourceBlockId: s.sourceBlockId,
            sourceBlockTypeLabel: s.sourceBlockTypeLabel,
          },
        });
      } catch {
        toast.error("Couldn't open quote composer");
      } finally {
        window.getSelection()?.removeAllRanges();
        dismiss();
      }
    },
    [openReblog, dismiss]
  );

  const handleAnnotate = useCallback(() => {
    toast("Annotations coming soon");
    dismiss();
  }, [dismiss]);

  const handleCopy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Couldn't copy");
      }
      dismiss();
    },
    [dismiss]
  );

  return (
    <QuotableSelectionOverlay
      isOpen={!!selection}
      selection={selection}
      position={position}
      onQuoteReblog={handleQuoteReblog}
      onAnnotate={handleAnnotate}
      onCopy={handleCopy}
      onDismiss={dismiss}
    />
  );
}

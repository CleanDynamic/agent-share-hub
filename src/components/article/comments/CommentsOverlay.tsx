import { useEffect, useMemo, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { CommentThreadCard } from './CommentThreadCard';
import {
  useDocumentComments,
  type CommentAnchor,
  type CommentThread,
} from '@/hooks/useDocumentComments';

interface CommentsOverlayProps {
  documentId: string | null;
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement>;
  // External signal to start a new comment at the current selection
  pendingAnchor: CommentAnchor | null;
  onPendingHandled: () => void;
  onUnresolvedCountChange?: (count: number) => void;
}

interface MarkerPosition {
  threadId: string;
  top: number;
  left: number;
  thread: CommentThread;
}

export function CommentsOverlay({
  documentId,
  editor,
  containerRef,
  pendingAnchor,
  onPendingHandled,
  onUnresolvedCountChange,
}: CommentsOverlayProps) {
  const {
    threads,
    unresolvedCount,
    currentUserId,
    addComment,
    resolveThread,
    deleteComment,
  } = useDocumentComments(documentId);

  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [draftAnchor, setDraftAnchor] = useState<CommentAnchor | null>(null);
  const [draftPos, setDraftPos] = useState<{ top: number; left: number } | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    onUnresolvedCountChange?.(unresolvedCount);
  }, [unresolvedCount, onUnresolvedCountChange]);

  // Recompute marker positions when editor changes
  useEffect(() => {
    if (!editor) return;
    const handler = () => setTick((t) => t + 1);
    editor.on('update', handler);
    editor.on('selectionUpdate', handler);
    const ro = new ResizeObserver(handler);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('scroll', handler, true);
    return () => {
      editor.off('update', handler);
      editor.off('selectionUpdate', handler);
      ro.disconnect();
      window.removeEventListener('scroll', handler, true);
    };
  }, [editor, containerRef]);

  // Handle incoming pending anchor (from Cmd+Shift+M)
  useEffect(() => {
    if (!pendingAnchor || !containerRef.current) return;
    const pos = computeAnchorPosition(pendingAnchor, editor, containerRef.current);
    if (pos) {
      setDraftAnchor(pendingAnchor);
      setDraftPos({ top: pos.top + 22, left: pos.left });
      setOpenThreadId(null);
    }
    onPendingHandled();
  }, [pendingAnchor, editor, containerRef, onPendingHandled]);

  const markerPositions = useMemo<MarkerPosition[]>(() => {
    if (!containerRef.current) return [];
    const result: MarkerPosition[] = [];
    for (const t of threads) {
      if (t.resolved) continue;
      const pos = computeAnchorPosition(
        { type: t.anchor.type, data: t.anchor.data },
        editor,
        containerRef.current
      );
      if (pos) {
        result.push({ threadId: t.threadId, top: pos.top, left: pos.left, thread: t });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, editor, containerRef.current]);

  const openThread = openThreadId ? threads.find((t) => t.threadId === openThreadId) ?? null : null;
  const openMarker = openThreadId ? markerPositions.find((m) => m.threadId === openThreadId) : null;

  return (
    <>
      {/* Markers */}
      {markerPositions.map((m) => (
        <button
          key={m.threadId}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDraftAnchor(null);
            setDraftPos(null);
            setOpenThreadId((cur) => (cur === m.threadId ? null : m.threadId));
          }}
          title={`${m.thread.comments.length} comment${m.thread.comments.length === 1 ? '' : 's'}`}
          style={{
            position: 'absolute',
            top: m.top - 4,
            left: m.left - 26,
            width: 22,
            height: 22,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'hsl(18 79% 54% / 0.18)',
            border: '0.5px solid hsl(18 79% 54% / 0.45)',
            color: 'hsl(18 79% 75%)',
            cursor: 'pointer',
            zIndex: 50,
            boxShadow: '0 2px 6px hsl(240 10% 2% / 0.4)',
          }}
        >
          <MessageCircle size={11} strokeWidth={2} />
        </button>
      ))}

      {/* Open existing thread */}
      {openThread && openMarker && (
        <CommentThreadCard
          thread={openThread}
          position={{ top: openMarker.top + 22, left: Math.max(0, openMarker.left - 30) }}
          currentUserId={currentUserId}
          onClose={() => setOpenThreadId(null)}
          onReply={async (body) => {
            await addComment({
              threadId: openThread.threadId,
              parentCommentId: openThread.comments[0]?.id ?? null,
              body,
              anchor: openThread.anchor,
            });
          }}
          onResolve={() => {
            resolveThread(openThread.threadId);
            setOpenThreadId(null);
          }}
          onDelete={(id) => deleteComment(id)}
        />
      )}

      {/* Draft new thread */}
      {draftAnchor && draftPos && (
        <CommentThreadCard
          thread={null}
          position={draftPos}
          currentUserId={currentUserId}
          onClose={() => {
            setDraftAnchor(null);
            setDraftPos(null);
          }}
          onReply={async (body) => {
            const created = await addComment({ body, anchor: draftAnchor });
            setDraftAnchor(null);
            setDraftPos(null);
            if (created) setOpenThreadId(created.thread_id);
          }}
        />
      )}
    </>
  );
}

function computeAnchorPosition(
  anchor: CommentAnchor,
  editor: Editor | null,
  container: HTMLElement
): { top: number; left: number } | null {
  const cRect = container.getBoundingClientRect();
  if (anchor.type === 'prose' && editor) {
    const from = anchor.data?.from;
    if (typeof from !== 'number') return null;
    try {
      const coords = editor.view.coordsAtPos(from);
      return { top: coords.top - cRect.top, left: coords.left - cRect.left };
    } catch {
      return null;
    }
  }
  if (anchor.type === 'block' || anchor.type === 'stage') {
    const id = anchor.data?.id;
    if (!id) return null;
    const el = container.querySelector<HTMLElement>(`[data-block-id="${id}"], [data-stage-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top - cRect.top + 6, left: r.right - cRect.left };
  }
  if (anchor.type === 'arrow') {
    const id = anchor.data?.id;
    if (!id) return null;
    const el = container.querySelector<HTMLElement>(`[data-arrow-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top - cRect.top + r.height / 2, left: r.left - cRect.left + r.width / 2 };
  }
  return null;
}

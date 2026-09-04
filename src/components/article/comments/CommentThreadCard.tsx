import { useEffect, useRef, useState } from 'react';
import { X, Check, Send, MessageCircle } from 'lucide-react';
import type { CommentThread, DocumentComment } from '@/hooks/useDocumentComments';

interface CommentThreadCardProps {
  thread: CommentThread | null; // null = new (draft) thread
  position: { top: number; left: number };
  currentUserId: string | null;
  onClose: () => void;
  onReply: (body: string) => Promise<void>;
  onResolve?: () => void;
  onDelete?: (commentId: string) => void;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h ago`;
  return d.toLocaleDateString();
};

function Avatar({ comment }: { comment: DocumentComment }) {
  const initial =
    (comment.author?.display_name || comment.author?.username || 'U').charAt(0).toUpperCase();
  if (comment.author?.avatar_url) {
    return (
      <img
        src={comment.author.avatar_url}
        alt=""
        style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
      />
    );
  }
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: 'hsl(18 79% 54% / 0.25)',
        color: 'hsl(18 79% 75%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Figtree, sans-serif',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {initial}
    </div>
  );
}

export function CommentThreadCard({
  thread,
  position,
  currentUserId,
  onClose,
  onReply,
  onResolve,
  onDelete,
}: CommentThreadCardProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [thread?.threadId]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await onReply(body);
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  const isNew = !thread;

  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: 300,
        background: 'hsl(240 20% 9% / 0.96)',
        border: '0.5px solid hsl(var(--foreground) / 0.12)',
        borderRadius: 10,
        boxShadow: '0 16px 40px hsl(240 10% 2% / 0.55)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        zIndex: 9999,
        overflow: 'hidden',
        fontFamily: 'Figtree, sans-serif',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: '0.5px solid hsl(var(--foreground) / 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'hsl(var(--foreground) / 0.7)' }}>
          <MessageCircle size={12} strokeWidth={1.8} />
          <span>
            {isNew ? 'New comment' : `${thread!.comments.length} ${thread!.comments.length === 1 ? 'reply' : 'replies'}`}
          </span>
          {thread?.resolved && (
            <span
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'hsl(142 58% 55% / 0.18)',
                color: 'hsl(142 58% 70%)',
                fontSize: 10,
              }}
            >
              Resolved
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {!isNew && onResolve && !thread!.resolved && (
            <button
              type="button"
              onClick={onResolve}
              title="Resolve"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 4,
                borderRadius: 4,
                cursor: 'pointer',
                color: 'hsl(var(--foreground) / 0.62)',
              }}
            >
              <Check size={13} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              borderRadius: 4,
              cursor: 'pointer',
              color: 'hsl(var(--foreground) / 0.62)',
            }}
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Comments list */}
      {!isNew && (
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px 10px' }}>
          {thread!.comments.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <Avatar comment={c} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground) / 0.92)' }}>
                    {c.author?.display_name || c.author?.username || 'Unknown'}
                  </span>
                  <span style={{ fontSize: 10, color: 'hsl(var(--foreground) / 0.5)' }}>
                    {formatTime(c.created_at)}
                  </span>
                  {c.author_id === currentUserId && onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      style={{
                        marginLeft: 'auto',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'hsl(var(--foreground) / 0.4)',
                        fontSize: 10,
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'hsl(var(--foreground) / 0.85)',
                    marginTop: 2,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {c.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: isNew ? 'none' : '0.5px solid hsl(var(--foreground) / 0.06)',
          display: 'flex',
          gap: 6,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder={isNew ? 'Write a comment…' : 'Reply…'}
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            background: 'hsl(240 20% 6% / 0.6)',
            border: '0.5px solid hsl(var(--foreground) / 0.08)',
            borderRadius: 6,
            color: 'hsl(var(--foreground) / 0.92)',
            fontFamily: 'Figtree, sans-serif',
            fontSize: 12,
            padding: '6px 8px',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || busy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            border: '0.5px solid hsl(18 79% 54% / 0.4)',
            background: draft.trim() ? 'hsl(18 79% 54% / 0.18)' : 'transparent',
            color: 'hsl(18 79% 70%)',
            cursor: draft.trim() && !busy ? 'pointer' : 'not-allowed',
            opacity: draft.trim() && !busy ? 1 : 0.5,
          }}
          title="Send (Cmd+Enter)"
        >
          <Send size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

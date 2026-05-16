import * as React from "react";
import { Heart, MessageCircle, MoreHorizontal, X, ArrowRight } from "lucide-react";
import type { CommentNode, ThreadedCommentProps } from "./types";

const MAX_VISUAL_DEPTH = 4; // 0-indexed → 5 visual levels
const INDENT_PX = 24;
const DEFAULT_VISIBLE_REPLIES = 3;

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function renderRichText(text: string): React.ReactNode[] {
  const parts = text.split(/(@\w+|#\w+|https?:\/\/\S+|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith("@")) {
      return (
        <span key={i} style={{ color: "#E8571A", fontWeight: 500 }}>
          {part}
        </span>
      );
    }
    if (part.startsWith("#")) {
      return (
        <span key={i} style={{ color: "rgba(46,196,182,0.9)", fontWeight: 500 }}>
          {part}
        </span>
      );
    }
    if (part.startsWith("http")) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#E8571A", textDecoration: "underline" }}
        >
          {part}
        </a>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 3,
            padding: "1px 4px",
            fontSize: 12,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ─── Reply Composer ─── */
function ReplyComposer({
  parentHandle,
  parentName,
  parentId,
  onSubmit,
  onCancel,
}: {
  parentHandle: string;
  parentName: string;
  parentId: string;
  onSubmit: (parentId: string, text: string) => void;
  onCancel: (commentId: string) => void;
}) {
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = () => {
    if (!text.trim()) return;
    onSubmit(parentId, text.trim());
    setText("");
  };

  return (
    <div
      style={{
        background: "rgba(68,68,84,0.30)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 8,
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 6 }}
      >
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Replying to @{parentHandle}
        </span>
        <button
          onClick={() => onCancel(parentId)}
          className="flex items-center justify-center"
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.45)",
          }}
          aria-label="Cancel reply"
        >
          <X size={10} />
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        placeholder={`Reply to ${parentName}...`}
        aria-label={`Reply to ${parentName}`}
        rows={2}
        style={{
          width: "100%",
          background: "rgba(82,82,100,0.60)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          padding: "8px 10px",
          color: "rgba(255,255,255,0.92)",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          lineHeight: 1.55,
          resize: "none",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <div className="flex justify-end" style={{ marginTop: 6 }}>
        <button
          onClick={submit}
          disabled={!text.trim()}
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 600,
            padding: "4px 14px",
            borderRadius: 6,
            border: "none",
            cursor: text.trim() ? "pointer" : "default",
            background: text.trim() ? "#E8571A" : "rgba(232,87,26,0.3)",
            color: text.trim() ? "#fff" : "rgba(255,255,255,0.4)",
            transition: "background 150ms ease",
          }}
        >
          Post
        </button>
      </div>
    </div>
  );
}

/* ─── Thread Line ─── */
function ThreadLine() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: -14,
        top: -4,
        bottom: "50%",
        width: 14,
        borderLeft: "1px solid rgba(255,255,255,0.10)",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        borderBottomLeftRadius: 8,
      }}
    />
  );
}

/* ─── Replies List (handles collapsing) ─── */
function RepliesList(props: {
  replies: CommentNode[];
  parentLevel: number;
  parentId: string;
  onReplyClick: (commentId: string) => void;
  onLikeClick: (commentId: string) => void;
  onMore: (commentId: string, anchor: HTMLElement) => void;
  onReplyComposerSubmit: (parentId: string, text: string) => void;
  onReplyComposerCancel: (commentId: string) => void;
  onExpandRepliesClick: (commentId: string) => void;
  onContinuedThreadClick?: (commentId: string) => void;
  openComposerId: string | null;
  highlightedCommentId?: string | null;
  editingCommentId?: string | null;
  onEditSubmit?: (commentId: string, text: string) => void;
  onEditCancel?: () => void;
}) {
  const {
    replies,
    parentLevel,
    parentId,
    onExpandRepliesClick,
    openComposerId,
  } = props;
  const [expanded, setExpanded] = React.useState(false);

  const shouldCollapse =
    replies.length > DEFAULT_VISIBLE_REPLIES && !expanded;
  const visible = shouldCollapse
    ? replies.slice(-DEFAULT_VISIBLE_REPLIES)
    : replies;
  const hidden = shouldCollapse ? replies.length - DEFAULT_VISIBLE_REPLIES : 0;

  return (
    <div>
      {hidden > 0 && (
        <button
          onClick={() => {
            setExpanded(true);
            onExpandRepliesClick(parentId);
          }}
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(255,255,255,0.55)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 0 8px 0",
            marginLeft: `${Math.min(parentLevel + 1, MAX_VISUAL_DEPTH) * INDENT_PX}px`,
          }}
        >
          Show {hidden} earlier {hidden === 1 ? "reply" : "replies"}
        </button>
      )}
      {visible.map((node) => (
        <ThreadedComment
          key={node.comment.id}
          comment={node.comment}
          replies={node.replies}
          level={parentLevel + 1}
          isReplyComposerOpen={openComposerId === node.comment.id}
          onReplyClick={props.onReplyClick}
          onLikeClick={props.onLikeClick}
          onMore={props.onMore}
          onReplyComposerSubmit={props.onReplyComposerSubmit}
          onReplyComposerCancel={props.onReplyComposerCancel}
          onExpandRepliesClick={props.onExpandRepliesClick}
          onContinuedThreadClick={props.onContinuedThreadClick}
          openComposerId={openComposerId}
          highlightedCommentId={props.highlightedCommentId}
        />
      ))}
    </div>
  );
}

/* ─── ThreadedComment ─── */
export function ThreadedComment(props: ThreadedCommentProps) {
  const {
    comment,
    replies,
    level,
    isReplyComposerOpen,
    onReplyClick,
    onLikeClick,
    onMore,
    onReplyComposerSubmit,
    onReplyComposerCancel,
    onExpandRepliesClick,
    onContinuedThreadClick,
    openComposerId,
    isNewReply,
    highlightedCommentId,
  } = props;

  const [textClamped, setTextClamped] = React.useState(true);
  const textRef = React.useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (textRef.current) {
      setIsOverflowing(textRef.current.scrollHeight > textRef.current.clientHeight + 1);
    }
  }, [comment.text, textClamped]);

  // Deep-link scroll + highlight
  React.useEffect(() => {
    if (highlightedCommentId && highlightedCommentId === comment.id && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedCommentId, comment.id]);

  const visualLevel = Math.min(level, MAX_VISUAL_DEPTH);
  const indentPx = visualLevel * INDENT_PX;
  const isContinuedThread = level > MAX_VISUAL_DEPTH;
  const isEdited =
    !!comment.updatedAt && comment.updatedAt !== comment.createdAt;
  const isHighlighted = highlightedCommentId === comment.id;

  /* Deleted placeholder */
  if (comment.isDeleted) {
    return (
      <div style={{ marginLeft: indentPx }}>
        <div style={{ position: "relative" }}>
          {level > 0 && <ThreadLine />}
          <div
            style={{
              background: "rgba(68,68,84,0.25)",
              border: "0.5px solid rgba(255,255,255,0.05)",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              [Comment deleted]
            </span>
          </div>
        </div>
        {replies.length > 0 && (
          <RepliesList
            replies={replies}
            parentLevel={level}
            parentId={comment.id}
            onReplyClick={onReplyClick}
            onLikeClick={onLikeClick}
            onMore={onMore}
            onReplyComposerSubmit={onReplyComposerSubmit}
            onReplyComposerCancel={onReplyComposerCancel}
            onExpandRepliesClick={onExpandRepliesClick}
            onContinuedThreadClick={onContinuedThreadClick}
            openComposerId={openComposerId}
            highlightedCommentId={highlightedCommentId}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ marginLeft: indentPx }}>
      <section
        aria-label={`Comment by ${comment.authorDisplayName}`}
        style={{ position: "relative" }}
      >
        {level > 0 && <ThreadLine />}

        {isContinuedThread && (
          <button
            onClick={() => onContinuedThreadClick?.(comment.id)}
            className="flex items-center gap-1"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 500,
              color: "#E8571A",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 0 4px 0",
            }}
          >
            Continued thread <ArrowRight size={11} />
          </button>
        )}

        <div
          ref={cardRef}
          className={isNewReply ? "ns-comment-new-reply" : ""}
          style={{
            background: "rgba(68,68,84,0.40)",
            border: isHighlighted
              ? "1px solid rgba(232,87,26,0.85)"
              : "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 8,
            transition: "border-color 300ms ease",
            animation: isHighlighted ? "ns-deep-link-pulse 1.2s ease-out" : undefined,
          }}
        >
          {/* Top row */}
          <div
            className="flex items-center"
            style={{ height: 20, gap: 6 }}
          >
            {comment.authorAvatarUrl ? (
              <img
                src={comment.authorAvatarUrl}
                alt=""
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                  flexShrink: 0,
                }}
              />
            )}
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
                whiteSpace: "nowrap",
              }}
            >
              {comment.authorDisplayName}
            </span>
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,0.40)",
                whiteSpace: "nowrap",
              }}
            >
              @{comment.authorHandle}
            </span>
            {comment.isPostAuthor && (
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 9,
                  fontWeight: 600,
                  background: "rgba(245,158,11,0.15)",
                  color: "rgba(245,158,11,0.9)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                Author
              </span>
            )}
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                color: "rgba(255,255,255,0.40)",
                marginLeft: "auto",
              }}
            >
              {formatRelativeTime(comment.createdAt)}
              {isEdited && (
                <span style={{ marginLeft: 4, fontStyle: "italic" }}>
                  (edited)
                </span>
              )}
            </span>
          </div>

          {/* Body */}
          <div style={{ marginTop: 6 }}>
            <div
              ref={textRef}
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 13,
                lineHeight: 1.55,
                color: "rgba(255,255,255,0.85)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                display: textClamped ? "-webkit-box" : "block",
                WebkitLineClamp: textClamped ? 6 : "unset",
                WebkitBoxOrient: "vertical",
                overflow: textClamped ? "hidden" : "visible",
              }}
            >
              {renderRichText(comment.text)}
            </div>
            {isOverflowing && textClamped && (
              <button
                onClick={() => setTextClamped(false)}
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.55)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 0 0 0",
                }}
              >
                Read more
              </button>
            )}
          </div>

          {/* Engagement row */}
          <div
            className="flex items-center"
            style={{ gap: 16, marginTop: 8 }}
          >
            <button
              onClick={() => onLikeClick(comment.id)}
              className="flex items-center gap-1"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: comment.hasLiked ? "#EF4444" : "rgba(255,255,255,0.45)",
                transition: "color 150ms ease",
              }}
              aria-label={comment.hasLiked ? "Unlike" : "Like"}
            >
              <Heart
                size={13}
                fill={comment.hasLiked ? "#EF4444" : "none"}
              />
              <span style={{ fontSize: 11, fontFamily: "Inter, sans-serif" }}>
                {comment.likeCount > 0 ? comment.likeCount : ""}
              </span>
            </button>

            <button
              onClick={() => onReplyClick(comment.id)}
              className="flex items-center gap-1"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: "rgba(255,255,255,0.45)",
              }}
              aria-label="Reply"
            >
              <MessageCircle size={13} />
              <span style={{ fontSize: 11, fontFamily: "Inter, sans-serif" }}>
                {comment.replyCount > 0 ? comment.replyCount : ""}
              </span>
            </button>

            <button
              onClick={(e) => onMore(comment.id, e.currentTarget as HTMLElement)}
              className="flex items-center justify-center"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                marginLeft: "auto",
                color: "rgba(255,255,255,0.30)",
              }}
              aria-label="More options"
            >
              <MoreHorizontal size={13} />
            </button>
          </div>
        </div>
      </section>

      {isReplyComposerOpen && (
        <div style={{ marginLeft: visualLevel > 0 ? 0 : 0 }}>
          <ReplyComposer
            parentHandle={comment.authorHandle}
            parentName={comment.authorDisplayName}
            parentId={comment.id}
            onSubmit={onReplyComposerSubmit}
            onCancel={onReplyComposerCancel}
          />
        </div>
      )}

      {replies.length > 0 && (
        <RepliesList
          replies={replies}
          parentLevel={level}
          parentId={comment.id}
          onReplyClick={onReplyClick}
          onLikeClick={onLikeClick}
          onMore={onMore}
          onReplyComposerSubmit={onReplyComposerSubmit}
          onReplyComposerCancel={onReplyComposerCancel}
          onExpandRepliesClick={onExpandRepliesClick}
          onContinuedThreadClick={onContinuedThreadClick}
          openComposerId={openComposerId}
          highlightedCommentId={highlightedCommentId}
        />
      )}
    </div>
  );
}

export default ThreadedComment;

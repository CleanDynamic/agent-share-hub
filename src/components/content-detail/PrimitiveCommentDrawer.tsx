import * as React from "react";
import {
  X,
  LayoutGrid,
  FileText,
  Image as ImageIcon,
  Target,
  ChevronDown,
  ChevronUp,
  MessageCircleOff,
  ThumbsUp,
  Lightbulb,
  Heart,
  Eye,
  Bold,
  Italic,
  Code,
  Link as LinkIcon,
  AtSign,
  MoreHorizontal,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
export type AnchorType = "post" | "stage" | "block" | "slide" | "solution" | "reblog";
export type ReactionType = "thumbsup" | "lightbulb" | "heart" | "eyes";

export interface CommentReactions {
  thumbsup: number;
  lightbulb: number;
  heart: number;
  eyes: number;
}

export interface CommentAuthor {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string;
  role?: "author" | "trusted_solver" | null;
}

export interface Comment {
  id: string;
  author: CommentAuthor;
  body: string;
  reactions: CommentReactions;
  timestamp: Date;
  replies?: Comment[];
  isNew?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  updatedAt?: Date;
  likeCount?: number;
  hasLiked?: boolean;
  replyCount?: number;
}

export interface BlockAnchorPreview {
  type: "block";
  name: string;
  blockType: string;
  blockColor: string;
  contentPreview: string;
}
export interface StageAnchorPreview {
  type: "stage";
  name: string;
}
export interface PostAnchorPreview {
  type: "post";
  title: string;
}
export interface SlideAnchorPreview {
  type: "slide";
  current: number;
  total: number;
  thumbnailUrl?: string;
}
export interface SolutionAnchorPreview {
  type: "solution";
  solverHandle: string;
  solverAvatarUrl?: string;
  contentPreview: string;
}
export type AnchorPreview =
  | BlockAnchorPreview
  | StageAnchorPreview
  | PostAnchorPreview
  | SlideAnchorPreview
  | SolutionAnchorPreview;

export interface PostOptions {
  mentions?: string[];
  references?: string[];
}

export interface PrimitiveCommentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  anchorType: AnchorType;
  anchorId: string;
  anchorPreview: AnchorPreview;
  threads: Comment[];
  viewerId: string;
  postAuthorId: string;
  onPost: (text: string, options: PostOptions) => void;
  onReply: (parentId: string, text: string) => void;
  onReact: (commentId: string, reaction: ReactionType) => void;
  onMore: (commentId: string) => void;
  onLike?: (commentId: string) => void;
  /** Edit a comment body (5-min window enforced server-side). */
  onEdit?: (commentId: string, text: string) => Promise<void> | void;
  /** Soft-delete a comment. */
  onDelete?: (commentId: string) => Promise<void> | void;
  /** Report a comment. */
  onReport?: (commentId: string) => Promise<void> | void;
  isLoading: boolean;
  /** Comment id to scroll to + flash highlight when the drawer opens. */
  deepLinkCommentId?: string | null;
  /** Post slug for "Continued thread" navigation. */
  postSlug?: string | null;
  /** Newly inserted comment ids that should briefly pulse. */
  newReplyIds?: Set<string>;
}

type SortOption = "newest" | "oldest" | "most-reacted";

// ─── Sub-components ─────────────────────────────────────────────────────────
function AnchorIndicator({
  anchorType,
  anchorPreview,
}: {
  anchorType: AnchorType;
  anchorPreview: AnchorPreview;
}) {
  const pillStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 4,
    background: "rgba(255, 255, 255, 0.14)",
  };
  const textStyle: React.CSSProperties = {
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    fontWeight: 500,
    color: "rgba(255,255,255,0.85)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 200,
  };

  if (anchorType === "block") {
    const p = anchorPreview as BlockAnchorPreview;
    return (
      <div style={pillStyle}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: p.blockColor }} />
        <span style={textStyle}>Block: {p.name}</span>
        <span style={{ ...textStyle, color: "rgba(255,255,255,0.40)" }}>{p.blockType}</span>
      </div>
    );
  }
  if (anchorType === "stage") {
    const p = anchorPreview as StageAnchorPreview;
    return (
      <div style={pillStyle}>
        <LayoutGrid size={11} color="rgba(255,255,255,0.65)" />
        <span style={textStyle}>Stage: {p.name}</span>
      </div>
    );
  }
  if (anchorType === "post") {
    const p = anchorPreview as PostAnchorPreview;
    return (
      <div style={pillStyle}>
        <FileText size={11} color="rgba(255,255,255,0.65)" />
        <span style={textStyle}>Post: {p.title}</span>
      </div>
    );
  }
  if (anchorType === "slide") {
    const p = anchorPreview as SlideAnchorPreview;
    return (
      <div style={pillStyle}>
        <ImageIcon size={11} color="rgba(255,255,255,0.65)" />
        <span style={textStyle}>
          Slide: {p.current} of {p.total}
        </span>
      </div>
    );
  }
  const p = anchorPreview as SolutionAnchorPreview;
  return (
    <div style={pillStyle}>
      <Target size={11} color="rgba(245,158,11,0.85)" />
      <span style={textStyle}>Solution by @{p.solverHandle}</span>
    </div>
  );
}

function AnchorPreviewStrip({
  anchorType,
  anchorPreview,
  isCollapsed,
  onToggle,
}: {
  anchorType: AnchorType;
  anchorPreview: AnchorPreview;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const containerStyle: React.CSSProperties = {
    padding: "12px 18px",
    borderBottom: "0.5px solid rgba(255, 255, 255, 0.14)",
    position: "relative",
  };
  const toggleStyle: React.CSSProperties = {
    position: "absolute",
    top: 8,
    right: 12,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 4,
    color: "rgba(255,255,255,0.5)",
  };

  if (isCollapsed) {
    return (
      <div style={{ ...containerStyle, padding: "6px 18px" }}>
        <button onClick={onToggle} style={toggleStyle} aria-label="Expand preview">
          <ChevronDown size={12} />
        </button>
      </div>
    );
  }

  let body: React.ReactNode = null;
  if (anchorType === "block") {
    const p = anchorPreview as BlockAnchorPreview;
    body = (
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.45, maxHeight: 60, overflow: "hidden" }}>
        {p.contentPreview}
      </div>
    );
  } else if (anchorType === "stage") {
    body = (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ height: 24, borderRadius: 3, background: "rgba(255,255,255,0.05)" }} />
        ))}
      </div>
    );
  } else if (anchorType === "post") {
    const p = anchorPreview as PostAnchorPreview;
    body = (
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{p.title}</div>
    );
  } else if (anchorType === "slide") {
    const p = anchorPreview as SlideAnchorPreview;
    body = p.thumbnailUrl ? (
      <img
        src={p.thumbnailUrl}
        alt=""
        style={{ width: "100%", maxHeight: 80, objectFit: "cover", borderRadius: 4 }}
      />
    ) : (
      <div style={{ height: 60, borderRadius: 4, background: "rgba(255,255,255,0.05)" }} />
    );
  } else {
    const p = anchorPreview as SolutionAnchorPreview;
    body = (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        {p.solverAvatarUrl && (
          <img src={p.solverAvatarUrl} alt="" style={{ width: 22, height: 22, borderRadius: "50%" }} />
        )}
        <div>
          <div style={{ fontSize: 11, color: "rgba(245,158,11,0.85)", fontWeight: 500 }}>
            @{p.solverHandle}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
            {p.contentPreview}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <button onClick={onToggle} style={toggleStyle} aria-label="Collapse preview">
        <ChevronUp size={12} />
      </button>
      {body}
    </div>
  );
}

function RolePill({ role }: { role: "author" | "trusted_solver" }) {
  const map = {
    author: { bg: "rgba(245,158,11,0.15)", text: "rgba(245,158,11,0.9)", label: "Author" },
    trusted_solver: { bg: "rgba(20,184,166,0.15)", text: "rgba(20,184,166,0.9)", label: "Trusted Solver" },
  };
  const c = map[role];
  return (
    <span
      style={{
        fontFamily: "Inter, sans-serif",
        fontSize: 9,
        fontWeight: 600,
        background: c.bg,
        color: c.text,
        padding: "2px 6px",
        borderRadius: 4,
      }}
    >
      {c.label}
    </span>
  );
}

function ReactionButton({
  type,
  count,
  onClick,
}: {
  type: ReactionType;
  count: number;
  onClick: () => void;
}) {
  const Icon = { thumbsup: ThumbsUp, lightbulb: Lightbulb, heart: Heart, eyes: Eye }[type];
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        borderRadius: 10,
        background: "rgba(255, 255, 255, 0.12)",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        color: "rgba(255,255,255,0.65)",
        fontFamily: "Inter, sans-serif",
        fontSize: 11,
        cursor: "pointer",
      }}
    >
      <Icon size={11} />
      {count}
    </button>
  );
}

function CommentCard({
  comment,
  depth = 0,
  onReply,
  onReact,
  onMore,
}: {
  comment: Comment;
  depth?: number;
  onReply: (parentId: string, text: string) => void;
  onReact: (commentId: string, reaction: ReactionType) => void;
  onMore: (commentId: string) => void;
}) {
  const [showReplyInput, setShowReplyInput] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [showAllReplies, setShowAllReplies] = React.useState(false);
  const avatarSize = depth === 0 ? 24 : 20;
  const maxVisibleReplies = 2;

  const submitReply = () => {
    if (replyText.trim()) {
      onReply(comment.id, replyText);
      setReplyText("");
      setShowReplyInput(false);
    }
  };

  const formatTimestamp = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${d}d ago`;
  };

  const visibleReplies = showAllReplies
    ? comment.replies || []
    : (comment.replies || []).slice(0, maxVisibleReplies);
  const hidden = (comment.replies?.length || 0) - maxVisibleReplies;

  return (
    <div
      style={{
        paddingLeft: depth > 0 ? 24 : 0,
        paddingBottom: depth === 0 ? 12 : 8,
        borderBottom: depth === 0 ? "0.5px solid rgba(255, 255, 255, 0.14)" : "none",
        marginBottom: depth === 0 ? 12 : 0,
        animation: comment.isNew ? "tealFlash 1s ease-out" : undefined,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        {comment.author.avatarUrl ? (
          <img
            src={comment.author.avatarUrl}
            alt=""
            style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
              {comment.author.displayName}
            </span>
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              @{comment.author.handle}
            </span>
            {comment.author.role && <RolePill role={comment.author.role} />}
          </div>
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "rgba(255,255,255,0.78)",
              lineHeight: 1.5,
              margin: "6px 0",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {comment.body}
          </p>
          <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
            {(["thumbsup", "lightbulb", "heart", "eyes"] as ReactionType[]).map((r) => (
              <ReactionButton
                key={r}
                type={r}
                count={comment.reactions[r]}
                onClick={() => onReact(comment.id, r)}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {depth < 2 && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(46,196,182,0.85)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Reply
              </button>
            )}
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "rgba(255,255,255,0.40)" }}>
              {formatTimestamp(comment.timestamp)}
            </span>
            <button
              onClick={() => onMore(comment.id)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 2,
                color: "rgba(255,255,255,0.4)",
              }}
              aria-label="More"
            >
              <MoreHorizontal size={12} />
            </button>
          </div>
          {showReplyInput && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                style={{
                  width: "100%",
                  minHeight: 60,
                  padding: 10,
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  color: "rgba(255,255,255,0.9)",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  resize: "vertical",
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submitReply();
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, gap: 8 }}>
                <button
                  onClick={() => setShowReplyInput(false)}
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.5)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px 10px",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitReply}
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#fff",
                    background: "rgba(249,115,22,0.9)",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    padding: "6px 12px",
                  }}
                >
                  Reply
                </button>
              </div>
            </div>
          )}
          {visibleReplies.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {visibleReplies.map((reply) => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  onReply={onReply}
                  onReact={onReact}
                  onMore={onMore}
                />
              ))}
            </div>
          )}
          {!showAllReplies && hidden > 0 && depth < 2 && (
            <button
              onClick={() => setShowAllReplies(true)}
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                fontWeight: 500,
                color: "rgba(46,196,182,0.85)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                marginTop: 8,
              }}
            >
              View {hidden} more {hidden === 1 ? "reply" : "replies"} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ anchorType }: { anchorType: AnchorType }) {
  const labels: Record<AnchorType, string> = {
    post: "post",
    stage: "stage",
    block: "block",
    slide: "slide",
    solution: "solution",
    reblog: "reblog",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px", textAlign: "center" }}>
      <MessageCircleOff size={48} style={{ color: "rgba(255,255,255,0.20)", marginBottom: 16 }} />
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", margin: "0 0 4px" }}>
        No comments yet on this {labels[anchorType]}
      </p>
      <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
        Be the first to comment
      </p>
    </div>
  );
}

function Composer({
  onPost,
  autoFocus,
}: {
  onPost: (text: string, options: PostOptions) => void;
  autoFocus: boolean;
}) {
  const [text, setText] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  const submit = () => {
    if (text.trim()) {
      onPost(text, {});
      setText("");
    }
  };

  const tbStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    background: "transparent",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    color: "rgba(255,255,255,0.5)",
  };

  return (
    <div style={{ padding: "12px 18px", borderTop: "0.5px solid rgba(255,255,255,0.1)", background: "rgba(16,16,24,0.98)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 8 }}>
        <button style={tbStyle} title="Bold"><Bold size={14} /></button>
        <button style={tbStyle} title="Italic"><Italic size={14} /></button>
        <button style={tbStyle} title="Code"><Code size={14} /></button>
        <button style={tbStyle} title="Link"><LinkIcon size={14} /></button>
        <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 6px" }} />
        <button style={tbStyle} title="Mention"><AtSign size={14} /></button>
      </div>
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a comment..."
        style={{
          width: "100%",
          minHeight: 80,
          maxHeight: 160,
          padding: 12,
          background: "rgba(255, 255, 255, 0.12)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 6,
          color: "rgba(255,255,255,0.9)",
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          lineHeight: 1.5,
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button
          onClick={submit}
          disabled={!text.trim()}
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: "#fff",
            background: text.trim() ? "rgba(249,115,22,0.95)" : "rgba(249,115,22,0.4)",
            border: "none",
            borderRadius: 6,
            cursor: text.trim() ? "pointer" : "not-allowed",
            padding: "8px 16px",
          }}
        >
          Post
        </button>
      </div>
    </div>
  );
}

function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const labels: Record<SortOption, string> = {
    newest: "Newest first",
    oldest: "Oldest first",
    "most-reacted": "Most reacted",
  };
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
          fontWeight: 500,
          color: "rgba(255,255,255,0.5)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {labels[value]}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "rgba(24,24,32,0.98)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6,
            padding: 4,
            zIndex: 10,
            minWidth: 120,
          }}
        >
          {(["newest", "oldest", "most-reacted"] as SortOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                fontFamily: "Inter, sans-serif",
                fontSize: 11,
                fontWeight: value === opt ? 500 : 400,
                color: value === opt ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: 4,
              }}
            >
              {labels[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
import { ThreadedComment as ThreadedCommentView } from "@/components/comments/ThreadedComment";
import type { Comment as TCComment, CommentNode as TCNode } from "@/components/comments/types";

function toThreadedNode(c: Comment, postAuthorId: string): TCNode {
  const tc: TCComment = {
    id: c.id,
    text: c.body,
    authorDisplayName: c.author.displayName,
    authorHandle: c.author.handle,
    authorAvatarUrl: c.author.avatarUrl,
    isPostAuthor: c.author.id === postAuthorId,
    createdAt: c.timestamp.toISOString(),
    updatedAt: c.updatedAt ? c.updatedAt.toISOString() : undefined,
    likeCount:
      typeof c.likeCount === "number"
        ? c.likeCount
        : Object.values(c.reactions).reduce((s, n) => s + n, 0),
    hasLiked: !!c.hasLiked,
    replyCount:
      typeof c.replyCount === "number" ? c.replyCount : (c.replies?.length ?? 0),
    isDeleted: !!c.isDeleted,
  };
  return {
    comment: tc,
    replies: (c.replies ?? []).map((r) => toThreadedNode(r, postAuthorId)),
    authorId: c.author.id,
  } as any;
}

/** Walk all comments and find one by id. */
function findCommentById(threads: Comment[], id: string): Comment | null {
  for (const c of threads) {
    if (c.id === id) return c;
    if (c.replies?.length) {
      const r = findCommentById(c.replies, id);
      if (r) return r;
    }
  }
  return null;
}

export function PrimitiveCommentDrawer({
  isOpen,
  onClose,
  anchorType,
  anchorPreview,
  threads,
  postAuthorId,
  onPost,
  onReply,
  onReact,
  onMore,
  onLike,
  isLoading,
  deepLinkCommentId,
  postSlug,
  newReplyIds,
}: PrimitiveCommentDrawerProps) {
  const [previewCollapsed, setPreviewCollapsed] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<SortOption>("newest");
  const [openComposerId, setOpenComposerId] = React.useState<string | null>(null);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Sort top-level. Replies are kept in their incoming (chronological) order
  // because ThreadedComment expects oldest-first reply lists.
  const sortedThreads = React.useMemo(() => {
    const arr = [...threads];
    if (sortBy === "newest") arr.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    else if (sortBy === "oldest") arr.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    else
      arr.sort((a, b) => {
        const aT = Object.values(a.reactions).reduce((s, n) => s + n, 0);
        const bT = Object.values(b.reactions).reduce((s, n) => s + n, 0);
        return bT - aT;
      });
    return arr;
  }, [threads, sortBy]);

  // Scroll to top on open; if deep-linked, highlight target briefly.
  React.useEffect(() => {
    if (!isOpen) return;
    if (deepLinkCommentId) {
      setHighlightId(deepLinkCommentId);
      const t = window.setTimeout(() => setHighlightId(null), 1400);
      return () => window.clearTimeout(t);
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [isOpen, deepLinkCommentId]);

  const handleReplyClick = React.useCallback((commentId: string) => {
    setOpenComposerId((prev) => (prev === commentId ? null : commentId));
  }, []);
  const handleReplyComposerCancel = React.useCallback(() => {
    setOpenComposerId(null);
  }, []);
  const handleReplyComposerSubmit = React.useCallback(
    (parentId: string, text: string) => {
      onReply(parentId, text);
      setOpenComposerId(null);
    },
    [onReply]
  );
  const handleLikeClick = React.useCallback(
    (commentId: string) => {
      if (onLike) onLike(commentId);
      else onReact(commentId, "heart");
    },
    [onLike, onReact]
  );
  const handleContinuedThread = React.useCallback(
    (commentId: string) => {
      if (postSlug) {
        window.location.assign(`/b/${postSlug}?thread=${commentId}`);
      }
    },
    [postSlug]
  );
  const handleExpandReplies = React.useCallback((_: string) => {
    /* Local expand handled inside ThreadedComment's RepliesList. */
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 998 }}
      />
      <div
        className="ns-comment-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: "100%",
          maxWidth: 380,
          background: "rgba(16,16,24,0.96)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderLeft: "0.5px solid rgba(255,255,255,0.10)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s ease-out",
        }}
      >
        <div
          style={{
            height: 60,
            padding: "14px 18px",
            borderBottom: "0.5px solid rgba(255, 255, 255, 0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <AnchorIndicator anchorType={anchorType} anchorPreview={anchorPreview} />
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: "rgba(255,255,255,0.6)",
            }}
            aria-label="Close drawer"
          >
            <X size={14} />
          </button>
        </div>
        <AnchorPreviewStrip
          anchorType={anchorType}
          anchorPreview={anchorPreview}
          isCollapsed={previewCollapsed}
          onToggle={() => setPreviewCollapsed(!previewCollapsed)}
        />
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
          {threads.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <SortDropdown value={sortBy} onChange={setSortBy} />
            </div>
          )}
          {isLoading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: "2px solid rgba(255,255,255,0.1)",
                  borderTopColor: "rgba(46,196,182,0.8)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            </div>
          )}
          {!isLoading && threads.length === 0 && <EmptyState anchorType={anchorType} />}
          {!isLoading &&
            sortedThreads.map((c) => {
              const node = toThreadedNode(c, postAuthorId);
              return (
                <ThreadedCommentView
                  key={node.comment.id}
                  comment={node.comment}
                  replies={node.replies}
                  level={0}
                  isReplyComposerOpen={openComposerId === node.comment.id}
                  onReplyClick={handleReplyClick}
                  onLikeClick={handleLikeClick}
                  onMore={onMore}
                  onReplyComposerSubmit={handleReplyComposerSubmit}
                  onReplyComposerCancel={handleReplyComposerCancel}
                  onExpandRepliesClick={handleExpandReplies}
                  onContinuedThreadClick={postSlug ? handleContinuedThread : undefined}
                  openComposerId={openComposerId}
                  isNewReply={newReplyIds?.has(node.comment.id)}
                  highlightedCommentId={highlightId}
                />
              );
            })}
        </div>
        <Composer onPost={onPost} autoFocus={threads.length === 0} />
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes tealFlash {
          0% { background: rgba(46,196,182,0.15); }
          100% { background: transparent; }
        }
        @keyframes ns-deep-link-pulse {
          0% { box-shadow: 0 0 0 0 rgba(232,87,26,0.55); }
          100% { box-shadow: 0 0 0 8px rgba(232,87,26,0); }
        }
        .ns-comment-new-reply {
          animation: ns-deep-link-pulse 600ms ease-out;
        }
      `}</style>
    </>
  );
}

export default PrimitiveCommentDrawer;

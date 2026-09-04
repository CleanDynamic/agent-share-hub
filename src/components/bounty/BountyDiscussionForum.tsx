import * as React from "react";
import {
  MessageSquare,
  ChevronDown,
  MoreHorizontal,
  ThumbsUp,
  Lightbulb,
  Heart,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { type } from "@/lib/theme/type";

// ─── Types ──────────────────────────────────────────────────────────────
export interface CommentAuthor {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  isTrustedSolver?: boolean;
}

export type ReactionType = "upvote" | "lightbulb" | "heart";

export interface Reaction {
  type: ReactionType;
  count: number;
  hasReacted: boolean;
}

export interface InlineReference {
  type: "blueprint" | "stage" | "block";
  id: string;
  title: string;
}

export interface DiscussionComment {
  id: string;
  author: CommentAuthor;
  content: string;
  timestamp: Date;
  reactions: Reaction[];
  replies?: DiscussionComment[];
  isUnread?: boolean;
  isFromBountyAuthor?: boolean;
  isFromAcceptedSolver?: boolean;
  isJustPosted?: boolean;
  inlineReferences?: InlineReference[];
}

export type DiscussionFilterValue =
  | "all"
  | "author"
  | "solvers"
  | "me"
  | "unread";
export type DiscussionSortValue = "newest" | "oldest" | "reactions";

export interface BountyDiscussionForumProps {
  bountyId: string;
  bountyAuthorId: string;
  acceptedSolverIds: string[];
  threads: DiscussionComment[];
  filter: DiscussionFilterValue;
  sort: DiscussionSortValue;
  onFilterChange: (filter: DiscussionFilterValue) => void;
  onSortChange: (sort: DiscussionSortValue) => void;
  onPost: (text: string, options: { tagBountyAuthor?: boolean }) => void;
  onReply: (parentId: string, text: string) => void;
  onReact: (commentId: string, reactionType: ReactionType) => void;
  onMore: (commentId: string) => void;
  composerExpanded: boolean;
  onToggleComposer: () => void;
  viewerId: string | null;
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 3600000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(m / 1440);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString();
}

function countStats(threads: DiscussionComment[]) {
  let messages = 0;
  const participants = new Set<string>();
  function walk(list: DiscussionComment[]) {
    for (const c of list) {
      messages++;
      participants.add(c.author.id);
      if (c.replies) walk(c.replies);
    }
  }
  walk(threads);
  return { messages, participants };
}

// ─── Dropdown ────────────────────────────────────────────────────────────
function Dropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-foreground/75 hover:bg-white/5"
        style={{
          background: "rgba(255, 255, 255, 0.12)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          fontFamily: "Figtree, sans-serif",
        }}
      >
        {selected?.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-1 z-20 min-w-[180px] rounded-md border border-border bg-popover shadow-lg overflow-hidden"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-white/5"
              style={{
                fontFamily: "Figtree, sans-serif",
                color:
                  opt.value === value
                    ? "rgba(46,196,182,1)"
                    : "rgba(255,255,255,0.75)",
                background:
                  opt.value === value ? "rgba(46,196,182,0.08)" : "transparent",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Composer ────────────────────────────────────────────────────────────
function Composer({
  expanded,
  onToggle,
  onPost,
}: {
  expanded: boolean;
  onToggle: () => void;
  onPost: (text: string, options: { tagBountyAuthor?: boolean }) => void;
}) {
  const [text, setText] = React.useState("");
  const [tagAuthor, setTagAuthor] = React.useState(false);

  const handlePost = () => {
    if (!text.trim()) return;
    onPost(text.trim(), { tagBountyAuthor: tagAuthor });
    setText("");
    setTagAuthor(false);
    onToggle();
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 rounded-md text-xs text-muted-foreground hover:bg-white/5"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "0.5px solid rgba(255,255,255,0.08)",
          fontFamily: "Figtree, sans-serif",
        }}
      >
        Ask a question or start a discussion…
      </button>
    );
  }

  return (
    <div
      className="rounded-md p-3 flex flex-col"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.10)",
      }}
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your message..."
        className="resize-none outline-none bg-transparent text-foreground/90"
        style={{
          fontFamily: "Figtree, sans-serif",
          fontSize: 14,
          minHeight: 80,
        }}
      />
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-white/5">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tagAuthor}
            onChange={(e) => setTagAuthor(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: "#F59E0B" }}
          />
          <span
            className="text-[11px] text-muted-foreground"
            style={{ fontFamily: "Figtree, sans-serif" }}
          >
            Tag bounty author
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setText("");
              onToggle();
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
            style={{ fontFamily: "Figtree, sans-serif" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePost}
            disabled={!text.trim()}
            className="px-4 py-1.5 rounded-md text-xs font-semibold text-black disabled:opacity-40"
            style={{
              background: "#F59E0B",
              fontFamily: "Figtree, sans-serif",
            }}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reaction button ─────────────────────────────────────────────────────
const REACTION_ICONS = {
  upvote: ThumbsUp,
  lightbulb: Lightbulb,
  heart: Heart,
} as const;

function ReactionPill({
  type,
  count,
  hasReacted,
  onClick,
}: {
  type: ReactionType;
  count: number;
  hasReacted: boolean;
  onClick: () => void;
}) {
  const Icon = REACTION_ICONS[type];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded transition-colors"
      style={{
        background: hasReacted ? "rgba(46,196,182,0.12)" : "rgba(255, 255, 255, 0.12)",
        border: hasReacted
          ? "0.5px solid rgba(46,196,182,0.3)"
          : "0.5px solid transparent",
      }}
    >
      <Icon
        size={12}
        color={hasReacted ? "rgba(46,196,182,1)" : "rgba(255,255,255,0.45)"}
      />
      <span
        className="text-[11px]"
        style={{
          fontFamily: "Figtree, sans-serif",
          color: hasReacted ? "rgba(46,196,182,1)" : "rgba(255,255,255,0.55)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ─── Role Pill ───────────────────────────────────────────────────────────
function RolePill({ role }: { role: "author" | "solver" }) {
  const cfg =
    role === "author"
      ? { bg: "rgba(245,158,11,0.15)", color: "#F59E0B", text: "Bounty author" }
      : { bg: "rgba(46,196,182,0.15)", color: "#2EC4B6", text: "Accepted solver" };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{
        background: cfg.bg,
        color: cfg.color,
        fontFamily: "Figtree, sans-serif",
      }}
    >
      {cfg.text}
    </span>
  );
}

function InlineReferenceChip({ reference }: { reference: InlineReference }) {
  const colors: Record<string, string> = {
    blueprint: "#8B5CF6",
    stage: "#3B82F6",
    block: "#10B981",
  };
  const c = colors[reference.type] ?? "#8B5CF6";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded mx-1"
      style={{
        background: `${c}15`,
        border: `0.5px solid ${c}30`,
        fontFamily: "Figtree, sans-serif",
        fontSize: 11,
      }}
    >
      <span style={{ color: c, fontWeight: 500 }}>{reference.type}:</span>
      <span style={{ color: "rgba(255,255,255,0.85)" }}>{reference.title}</span>
    </span>
  );
}

// ─── Comment Card ────────────────────────────────────────────────────────
function CommentCard({
  comment,
  bountyAuthorId,
  acceptedSolverIds,
  onReply,
  onReact,
  onMore,
  depth = 0,
}: {
  comment: DiscussionComment;
  bountyAuthorId: string;
  acceptedSolverIds: string[];
  onReply: (parentId: string, text: string) => void;
  onReact: (commentId: string, reactionType: ReactionType) => void;
  onMore: (commentId: string) => void;
  depth?: number;
}) {
  const [showReplyInput, setShowReplyInput] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [showReactionPicker, setShowReactionPicker] = React.useState(false);
  const [flash, setFlash] = React.useState(!!comment.isJustPosted);

  React.useEffect(() => {
    if (comment.isJustPosted) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1600);
      return () => clearTimeout(t);
    }
  }, [comment.isJustPosted]);

  const isAuthor =
    comment.isFromBountyAuthor ?? comment.author.id === bountyAuthorId;
  const isSolver =
    comment.isFromAcceptedSolver ?? acceptedSolverIds.includes(comment.author.id);
  const isRoot = depth === 0;
  const avatarSize = isRoot ? 28 : 24;
  const indent = depth > 0 ? 32 : 0;

  const handleReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText("");
    setShowReplyInput(false);
  };

  return (
    <div style={{ marginLeft: indent }}>
      <div
        className="relative"
        style={{
          padding: "12px 0",
          borderBottom: isRoot ? "0.5px solid rgba(255, 255, 255, 0.12)" : "none",
          background: flash ? "rgba(46,196,182,0.08)" : "transparent",
          transition: "background 600ms ease-out",
        }}
      >
        {comment.isUnread && (
          <div
            className="absolute left-0 top-0 bottom-0"
            style={{ width: 3, background: "#2EC4B6", borderRadius: 2 }}
          />
        )}

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="rounded-full flex items-center justify-center shrink-0 overflow-hidden"
              style={{
                width: avatarSize,
                height: avatarSize,
                background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
              }}
            >
              {comment.author.avatarUrl ? (
                <img
                  src={comment.author.avatarUrl}
                  alt=""
                  style={{ width: avatarSize, height: avatarSize }}
                />
              ) : (
                <span
                  className="text-white"
                  style={{
                    fontFamily: "Figtree, sans-serif",
                    fontSize: avatarSize * 0.4,
                    fontWeight: 600,
                  }}
                >
                  {(comment.author.displayName || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <span
              className="text-[12px] font-medium text-foreground/90 truncate"
              style={{ fontFamily: "Figtree, sans-serif" }}
            >
              {comment.author.displayName}
            </span>
            <span
              className="text-[11px] text-muted-foreground truncate"
              style={{ fontFamily: "Figtree, sans-serif" }}
            >
              @{comment.author.handle}
            </span>
            {comment.author.isTrustedSolver && (
              <ShieldCheck size={10} color="#2EC4B6" />
            )}
            {isAuthor && <RolePill role="author" />}
            {isSolver && !isAuthor && <RolePill role="solver" />}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className="text-[11px] text-muted-foreground"
              style={{ fontFamily: "Figtree, sans-serif" }}
            >
              {formatRelativeTime(comment.timestamp)}
            </span>
            <button
              type="button"
              onClick={() => onMore(comment.id)}
              className="p-1 rounded hover:bg-white/5 text-muted-foreground"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>

        <div
          className="text-[13px] text-foreground/85 whitespace-pre-wrap leading-relaxed"
          style={{ fontFamily: "Figtree, sans-serif" }}
        >
          {comment.content}
          {comment.inlineReferences?.map((r, i) => (
            <InlineReferenceChip key={`${r.type}-${r.id}-${i}`} reference={r} />
          ))}
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {comment.reactions.map((r) => (
            <ReactionPill
              key={r.type}
              type={r.type}
              count={r.count}
              hasReacted={r.hasReacted}
              onClick={() => onReact(comment.id, r.type)}
            />
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactionPicker((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-muted-foreground hover:bg-white/5"
            >
              <Plus size={12} />
              React
            </button>
            {showReactionPicker && (
              <div
                className="absolute left-0 mt-1 z-20 flex gap-1 p-1 rounded border border-border bg-popover shadow-lg"
              >
                {(Object.keys(REACTION_ICONS) as ReactionType[]).map((t) => {
                  const Icon = REACTION_ICONS[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        onReact(comment.id, t);
                        setShowReactionPicker(false);
                      }}
                      className="p-2 rounded hover:bg-white/10"
                    >
                      <Icon size={14} color="rgba(255,255,255,0.65)" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowReplyInput((v) => !v)}
            className="text-[11px] font-medium px-2 py-1 rounded hover:bg-white/5"
            style={{ color: "rgba(46,196,182,0.85)", fontFamily: "Figtree, sans-serif" }}
          >
            Reply
          </button>
        </div>

        {showReplyInput && (
          <div className="flex items-start gap-2 mt-3" style={{ marginLeft: 0 }}>
            <input
              autoFocus
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 px-3 py-2 rounded-md outline-none text-[12px] text-foreground/90"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                fontFamily: "Figtree, sans-serif",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleReply();
                }
              }}
            />
            <button
              type="button"
              onClick={handleReply}
              disabled={!replyText.trim()}
              className="px-3 py-2 rounded-md text-[11px] font-semibold text-black disabled:opacity-40"
              style={{ background: "#F59E0B", fontFamily: "Figtree, sans-serif" }}
            >
              Reply
            </button>
          </div>
        )}
      </div>

      {comment.replies?.map((reply) => (
        <CommentCard
          key={reply.id}
          comment={reply}
          bountyAuthorId={bountyAuthorId}
          acceptedSolverIds={acceptedSolverIds}
          onReply={onReply}
          onReact={onReact}
          onMore={onMore}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-md border border-dashed border-border/60 p-10 text-center"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      <MessageSquare className="w-6 h-6 mx-auto text-muted-foreground mb-3" />
      <div
        className="text-sm font-medium text-foreground/85 mb-1"
        style={{ fontFamily: "Figtree, sans-serif" }}
      >
        Start the discussion
      </div>
      <div
        className="text-xs text-muted-foreground"
        style={{ fontFamily: "Figtree, sans-serif" }}
      >
        Be the first to ask a question, share an approach, or brainstorm with the
        community.
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────
export function BountyDiscussionForum({
  bountyAuthorId,
  acceptedSolverIds,
  threads,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  onPost,
  onReply,
  onReact,
  onMore,
  composerExpanded,
  onToggleComposer,
}: BountyDiscussionForumProps) {
  const stats = countStats(threads);

  const filterOptions: { value: DiscussionFilterValue; label: string }[] = [
    { value: "all", label: "All messages" },
    { value: "author", label: "From bounty author" },
    { value: "solvers", label: "From accepted solvers" },
    { value: "me", label: "@ Me" },
    { value: "unread", label: "Unread" },
  ];
  const sortOptions: { value: DiscussionSortValue; label: string }[] = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "reactions", label: "Most reactions" },
  ];

  return (
    <section className="mt-10 mb-8">
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h2
            className="flex items-center gap-2 text-lg font-semibold text-foreground"
            style={{ ...type.cardTitle,}}
          >
            <MessageSquare className="w-5 h-5" color="#2EC4B6" />
            Discussion
          </h2>
          <p
            className="text-xs text-muted-foreground mt-1"
            style={{ fontFamily: "Figtree, sans-serif" }}
          >
            {stats.messages} {stats.messages === 1 ? "message" : "messages"} ·{" "}
            {stats.participants.size} active{" "}
            {stats.participants.size === 1 ? "participant" : "participants"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            value={filter}
            options={filterOptions}
            onChange={onFilterChange}
          />
          <Dropdown value={sort} options={sortOptions} onChange={onSortChange} />
        </div>
      </div>

      <div className="mb-4">
        <Composer
          expanded={composerExpanded}
          onToggle={onToggleComposer}
          onPost={onPost}
        />
      </div>

      <div>
        {threads.length === 0 ? (
          <EmptyState />
        ) : (
          threads.map((t) => (
            <CommentCard
              key={t.id}
              comment={t}
              bountyAuthorId={bountyAuthorId}
              acceptedSolverIds={acceptedSolverIds}
              onReply={onReply}
              onReact={onReact}
              onMore={onMore}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default BountyDiscussionForum;

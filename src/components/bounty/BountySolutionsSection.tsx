import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Target,
  Puzzle,
  ChevronDown,
  ArrowBigUp,
  Hand,
  MessageSquare,
  MoreHorizontal,
  ShieldCheck,
  Check,
  Link as LinkIcon,
  Bookmark,
  Flag,
  GitFork,
  X,
} from "lucide-react";
import {
  getSolutionComments,
  postSolutionComment,
  type SolutionComment,
} from "@/lib/bounty-solver/solutionComments";

// ─── Types ──────────────────────────────────────────────────────────────
export interface SolutionSlot {
  id: string;
  kind: "stage" | "block";
  name: string;
  missingDescription: string;
}

export interface SolutionSolverUser {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  isTrustedSolver?: boolean;
}

export interface SolutionContentPreview {
  type: "prompt" | "code" | "stage" | "other";
  text?: string;
  language?: string;
  blockTypes?: string[];
  stageNodes?: Array<{ x: number; y: number; type: string }>;
}

export interface SolutionItem {
  id: string;
  slotId: string;
  solverUser: SolutionSolverUser;
  solverNote: string;
  contentPreview: SolutionContentPreview;
  voteCount: number;
  hasVoted: boolean;
  iWouldImplementCount: number;
  hasIWouldImplement: boolean;
  commentCount: number;
  isAccepted: boolean;
  isExpanded?: boolean;
  isOwnSolution: boolean;
  createdAt: string;
}

export interface BountySolutionsSectionProps {
  slots: SolutionSlot[];
  solutions: SolutionItem[];
  filterSlotId: string | "all";
  onFilterChange: (slotId: string | "all") => void;
  sort: string;
  onSortChange: (sort: string) => void;
  onVote: (solutionId: string) => void;
  onIWouldImplement: (solutionId: string) => void;
  onShareSolution: (solutionId: string, anchorEl: HTMLElement | null) => void;
  onSaveSolution: (solutionId: string) => void;
  onForkSolution: (solutionId: string) => void;
  onAccept: (solutionId: string) => void;
  onSubmitFirstSolution: (slotId: string) => void;
  isBountyAuthor: boolean;
  bountyStatus: "open" | "closed" | "solved";
  viewerId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (solutionId: string) => void;
  renderExpandedContent?: (solution: SolutionItem, slot: SolutionSlot) => React.ReactNode;
}

const blockTypeColors: Record<string, string> = {
  prompt: "#F59E0B",
  code: "#3B82F6",
  data: "#10B981",
  model: "#8B5CF6",
  output: "#EC4899",
  default: "#6B7280",
};

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

// ─── Dropdown ───────────────────────────────────────────────────────────
function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
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
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-white/5"
      >
        <span>
          {label}: <span className="text-foreground/80">{selected?.label}</span>
        </span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-2 text-xs rounded hover:bg-white/5 ${
                value === opt.value ? "text-amber-400" : "text-foreground/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Overflow menu ──────────────────────────────────────────────────────
function OverflowMenu({
  isBountyAuthor,
  bountyStatus,
  isAccepted,
  onShare,
  onSave,
  onReport,
  onAccept,
}: {
  isBountyAuthor: boolean;
  bountyStatus: "open" | "closed" | "solved";
  isAccepted: boolean;
  onShare: () => void;
  onSave: () => void;
  onReport: () => void;
  onAccept: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);
  const canAccept = isBountyAuthor && !isAccepted && bountyStatus !== "closed";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded hover:bg-white/5 text-muted-foreground"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 min-w-[200px] rounded-md border border-border bg-popover p-1 shadow-lg">
          <button
            type="button"
            onClick={() => { onShare(); setOpen(false); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs rounded hover:bg-white/5 text-foreground/80"
          >
            <LinkIcon className="w-3 h-3" /> Copy link to solution
          </button>
          <button
            type="button"
            onClick={() => { onSave(); setOpen(false); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs rounded hover:bg-white/5 text-foreground/80"
          >
            <Bookmark className="w-3 h-3" /> Save to Library
          </button>
          <button
            type="button"
            onClick={() => { onReport(); setOpen(false); }}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs rounded hover:bg-white/5 text-foreground/80"
          >
            <Flag className="w-3 h-3" /> Report solution
          </button>
          {canAccept && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => { onAccept(); setOpen(false); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-medium rounded bg-teal-500/10 hover:bg-teal-500/20 text-teal-300"
              >
                <Check className="w-3 h-3" /> Accept this solution
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stage Mini-map ─────────────────────────────────────────────────────
function StageMiniMap({ nodes }: { nodes: Array<{ x: number; y: number; type: string }> }) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="h-20 rounded border border-dashed border-border/50 flex items-center justify-center text-[10px] text-muted-foreground">
        Stage preview
      </div>
    );
  }
  const W = 200, H = 80, P = 10;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = maxX > minX ? (W - P * 2) / (maxX - minX) : 1;
  const sy = maxY > minY ? (H - P * 2) / (maxY - minY) : 1;
  const s = Math.min(sx, sy, 1);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} className="rounded bg-white/[0.02]">
      {nodes.slice(0, -1).map((n, i) => {
        const next = nodes[i + 1];
        const x1 = P + (n.x - minX) * s + 4;
        const y1 = P + (n.y - minY) * s + 4;
        const x2 = P + (next.x - minX) * s + 4;
        const y2 = P + (next.y - minY) * s + 4;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />;
      })}
      {nodes.map((n, i) => {
        const x = P + (n.x - minX) * s;
        const y = P + (n.y - minY) * s;
        const c = blockTypeColors[n.type] || blockTypeColors.default;
        return <rect key={i} x={x} y={y} width={8} height={8} rx={1.5} fill={c} opacity={0.85} />;
      })}
    </svg>
  );
}

// ─── Inline comments ────────────────────────────────────────────────────
function InlineCommentThread({
  solutionId,
  viewerId,
  onClose,
  onPosted,
}: {
  solutionId: string;
  viewerId: string | null;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [comments, setComments] = useState<SolutionComment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSolutionComments(solutionId)
      .then((rows) => { if (!cancelled) setComments(rows); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [solutionId]);

  const submit = async () => {
    if (!viewerId || !text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await postSolutionComment({ solutionId, authorId: viewerId, body: text.trim() });
      setText("");
      const rows = await getSolutionComments(solutionId);
      setComments(rows);
      onPosted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-border/60 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground/80">Comments</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-muted-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-2 max-h-[240px] overflow-y-auto">
        {loading ? (
          <div className="text-[11px] text-muted-foreground">Loading…</div>
        ) : comments.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">No comments yet.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <img
                src={c.author?.avatar_url || ""}
                alt=""
                className="w-6 h-6 rounded-full bg-muted shrink-0"
              />
              <div className="flex-1">
                <div className="text-[11px] text-foreground/80">
                  @{c.author?.username ?? "user"}{" "}
                  <span className="text-muted-foreground">· {formatRelativeTime(c.created_at)}</span>
                </div>
                <div className="text-xs text-foreground/90 whitespace-pre-wrap">{c.body}</div>
              </div>
            </div>
          ))
        )}
      </div>
      {viewerId ? (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className="w-full bg-white/[0.04] border border-border/60 rounded p-2 text-xs text-foreground/90 min-h-[60px] resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={submit}
              disabled={!text.trim() || submitting}
              className="px-3 py-1 rounded bg-amber-500 text-black text-xs font-semibold disabled:opacity-40"
            >
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[11px] text-muted-foreground">Sign in to comment.</div>
      )}
    </div>
  );
}

// ─── Solution card ──────────────────────────────────────────────────────
function SolutionCard({
  solution,
  slot,
  isBountyAuthor,
  bountyStatus,
  viewerId,
  isExpanded,
  onVote,
  onIWouldImplement,
  onToggleExpand,
  onShareSolution,
  onSaveSolution,
  onForkSolution,
  onAccept,
  renderExpandedContent,
}: {
  solution: SolutionItem;
  slot: SolutionSlot;
  isBountyAuthor: boolean;
  bountyStatus: "open" | "closed" | "solved";
  viewerId: string | null;
  isExpanded: boolean;
  onVote: () => void;
  onIWouldImplement: () => void;
  onToggleExpand: () => void;
  onShareSolution: (anchorEl: HTMLElement | null) => void;
  onSaveSolution: () => void;
  onForkSolution: () => void;
  onAccept: () => void;
  renderExpandedContent?: (s: SolutionItem, slot: SolutionSlot) => React.ReactNode;
}) {
  const [showNoteFull, setShowNoteFull] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState(solution.commentCount);

  useEffect(() => setLocalCommentCount(solution.commentCount), [solution.commentCount]);

  const isAccepted = solution.isAccepted;
  const noteTrunc = (solution.solverNote?.length ?? 0) > 150;
  const noteToShow =
    !showNoteFull && noteTrunc
      ? solution.solverNote.slice(0, 150) + "…"
      : solution.solverNote;

  return (
    <div
      id={`solution-${solution.id}`}
      className={`rounded-lg p-4 transition-colors ${
        isAccepted
          ? "border border-teal-500/40 bg-teal-500/[0.04]"
          : "border border-border/40 bg-white/[0.02] hover:border-border"
      } relative`}
    >
      {isAccepted && (
        <span className="absolute top-2.5 right-3 text-[9px] font-semibold tracking-widest uppercase px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300">
          Accepted
        </span>
      )}

      {/* Solver row */}
      <div className="flex items-center gap-2 mb-2">
        <img
          src={solution.solverUser.avatarUrl}
          alt=""
          className="w-6 h-6 rounded-full bg-muted"
        />
        <span className="text-xs font-medium text-foreground/90">
          {solution.solverUser.displayName}
        </span>
        <span className="text-[11px] text-muted-foreground">@{solution.solverUser.handle}</span>
        {solution.solverUser.isTrustedSolver && (
          <span className="flex items-center gap-1 text-[10px] text-teal-300/80">
            <ShieldCheck className="w-3 h-3" /> Trusted
          </span>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">
          {formatRelativeTime(solution.createdAt)}
        </span>
        {solution.isOwnSolution && (
          <span className="text-[10px] text-amber-300/80 px-1.5 py-0.5 rounded bg-amber-500/10">You</span>
        )}
      </div>

      {/* Solver note */}
      {solution.solverNote && (
        <div className="mb-3">
          <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{noteToShow}</p>
          {noteTrunc && !showNoteFull && (
            <button
              onClick={() => setShowNoteFull(true)}
              className="mt-1 text-[11px] text-amber-400 hover:text-amber-300"
            >
              Read more →
            </button>
          )}
        </div>
      )}

      {/* Preview */}
      <div className="mb-3">
        {solution.contentPreview.type === "stage" && (
          <>
            <StageMiniMap nodes={solution.contentPreview.stageNodes ?? []} />
            {solution.contentPreview.blockTypes && (
              <div className="flex flex-wrap gap-1 mt-2">
                {solution.contentPreview.blockTypes.map((t, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded text-foreground/70"
                    style={{ background: `${blockTypeColors[t] || blockTypeColors.default}22` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        {solution.contentPreview.type === "prompt" && solution.contentPreview.text && (
          <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-foreground/85 line-clamp-3 whitespace-pre-wrap">
            {solution.contentPreview.text}
          </div>
        )}
        {solution.contentPreview.type === "code" && solution.contentPreview.text && (
          <pre className="rounded border border-blue-500/30 bg-blue-500/5 p-2 text-[11px] text-foreground/85 overflow-x-auto max-h-32">
            <code>{solution.contentPreview.text}</code>
          </pre>
        )}
        {solution.contentPreview.type === "other" && (
          <div className="rounded border border-dashed border-border/50 p-3 text-[11px] text-muted-foreground text-center">
            Block preview
          </div>
        )}
      </div>

      {/* Expanded */}
      {isExpanded && (
        <div className="mb-3 rounded border border-border/60 bg-white/[0.02] p-3">
          {renderExpandedContent ? (
            renderExpandedContent(solution, slot)
          ) : (
            <div className="text-[11px] text-muted-foreground">Full solution view</div>
          )}
          <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-border/60">
            <button
              onClick={() => setShowComments((v) => !v)}
              className="text-[11px] text-foreground/70 hover:text-foreground"
            >
              {showComments ? "Hide comments" : "Comment on this solution"}
            </button>
            <button
              onClick={onForkSolution}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border/60 hover:border-border text-foreground/80"
            >
              <GitFork className="w-3 h-3" /> Fork this solution
            </button>
          </div>
        </div>
      )}

      {showComments && (
        <InlineCommentThread
          solutionId={solution.id}
          viewerId={viewerId}
          onClose={() => setShowComments(false)}
          onPosted={() => setLocalCommentCount((n) => n + 1)}
        />
      )}

      {/* Action row */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onVote}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-white/5 ${
              solution.hasVoted ? "text-amber-400" : "text-muted-foreground"
            }`}
          >
            <ArrowBigUp className={`w-4 h-4 ${solution.hasVoted ? "fill-current" : ""}`} />
            {solution.voteCount}
          </button>
          <button
            onClick={onIWouldImplement}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-white/5 ${
              solution.hasIWouldImplement ? "text-teal-300" : "text-muted-foreground"
            }`}
            title="I'd implement this"
          >
            <Hand className="w-4 h-4" />
            {solution.iWouldImplementCount}
          </button>
          <button
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-white/5"
          >
            <MessageSquare className="w-4 h-4" />
            {localCommentCount}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleExpand}
            className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-white/5"
          >
            {isExpanded ? "Collapse ↑" : "Expand →"}
          </button>
          <OverflowMenu
            isBountyAuthor={isBountyAuthor}
            bountyStatus={bountyStatus}
            isAccepted={isAccepted}
            onShare={() => onShareSolution(null)}
            onSave={onSaveSolution}
            onReport={() => {}}
            onAccept={onAccept}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Empty per-slot state ───────────────────────────────────────────────
function SlotEmptyState({ onSubmitFirstSolution }: { onSubmitFirstSolution: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-6 text-center">
      <Puzzle className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
      <div className="text-xs text-muted-foreground mb-3">
        No solutions submitted yet for this slot
      </div>
      <button
        onClick={onSubmitFirstSolution}
        className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold"
      >
        Be the first to submit
      </button>
    </div>
  );
}

// ─── Main section ───────────────────────────────────────────────────────
export function BountySolutionsSection({
  slots,
  solutions,
  filterSlotId,
  onFilterChange,
  sort,
  onSortChange,
  onVote,
  onIWouldImplement,
  onShareSolution,
  onSaveSolution,
  onForkSolution,
  onAccept,
  onSubmitFirstSolution,
  isBountyAuthor,
  bountyStatus,
  viewerId,
  expandedIds,
  onToggleExpand,
  renderExpandedContent,
}: BountySolutionsSectionProps) {
  const solutionsBySlot = useMemo(() => {
    const acc: Record<string, SolutionItem[]> = {};
    for (const slot of slots) acc[slot.id] = [];
    for (const s of solutions) {
      if (!acc[s.slotId]) acc[s.slotId] = [];
      acc[s.slotId].push(s);
    }
    return acc;
  }, [slots, solutions]);

  const totalSolutions = solutions.length;
  const slotsWithSolutions = slots.filter((s) => (solutionsBySlot[s.id]?.length ?? 0) > 0).length;

  const filterOptions = [
    { value: "all", label: "All slots" },
    ...slots.map((s) => ({ value: s.id, label: s.name })),
  ];
  const sortOptions = [
    { value: "most_votes", label: "Most votes" },
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
    { value: "mine", label: "My solutions" },
  ];

  const filteredSlots =
    filterSlotId === "all" ? slots : slots.filter((s) => s.id === filterSlotId);
  const hasAny = totalSolutions > 0;

  return (
    <section className="mt-10 mb-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Target className="w-5 h-5 text-amber-400" />
            Solutions
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {totalSolutions} {totalSolutions === 1 ? "solution" : "solutions"} across {slotsWithSolutions}{" "}
            {slotsWithSolutions === 1 ? "slot" : "slots"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            label="Slot"
            value={filterSlotId}
            options={filterOptions}
            onChange={(v) => onFilterChange(v as string | "all")}
          />
          <Dropdown label="Sort" value={sort} options={sortOptions} onChange={onSortChange} />
        </div>
      </div>

      {!hasAny ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-white/[0.02] p-10 text-center">
          <Target className="w-6 h-6 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm text-foreground/80 mb-4">
            This bounty hasn't been solved yet
          </div>
          {slots.length > 0 && (
            <button
              onClick={() => onSubmitFirstSolution(slots[0].id)}
              className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-black text-sm font-semibold"
            >
              Submit the first solution
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredSlots.map((slot) => {
            const list = solutionsBySlot[slot.id] ?? [];
            return (
              <div key={slot.id}>
                <div className="mb-3">
                  <div className="flex items-center gap-2">
                    {slot.kind === "stage" ? (
                      <Target className="w-4 h-4 text-teal-300" />
                    ) : (
                      <Puzzle className="w-4 h-4 text-blue-300" />
                    )}
                    <span className="text-sm font-medium text-foreground/90">{slot.name}</span>
                    <span className="text-[11px] text-muted-foreground">[{list.length}]</span>
                  </div>
                  {slot.missingDescription && (
                    <p className="text-[11px] text-muted-foreground mt-1 ml-6">
                      {slot.missingDescription}
                    </p>
                  )}
                </div>
                {list.length === 0 ? (
                  <SlotEmptyState onSubmitFirstSolution={() => onSubmitFirstSolution(slot.id)} />
                ) : (
                  <div className="space-y-3">
                    {list.map((sol) => (
                      <SolutionCard
                        key={sol.id}
                        solution={sol}
                        slot={slot}
                        isBountyAuthor={isBountyAuthor}
                        bountyStatus={bountyStatus}
                        viewerId={viewerId}
                        isExpanded={expandedIds.has(sol.id)}
                        onVote={() => onVote(sol.id)}
                        onIWouldImplement={() => onIWouldImplement(sol.id)}
                        onToggleExpand={() => onToggleExpand(sol.id)}
                        onShareSolution={(el) => onShareSolution(sol.id, el)}
                        onSaveSolution={() => onSaveSolution(sol.id)}
                        onForkSolution={() => onForkSolution(sol.id)}
                        onAccept={() => onAccept(sol.id)}
                        renderExpandedContent={renderExpandedContent}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default BountySolutionsSection;

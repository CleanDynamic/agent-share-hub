import { useState } from "react";
import { Target, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Bounty {
  id: string;
  slug: string;
  title: string;
}

interface Slot {
  kind: "stage" | "block";
  id: string;
  name: string;
  missingDescription: string;
  blockType?: string;
}

interface BountyMeta {
  rewardType: string;
  rewardAmount: number;
  rewardCurrency: string;
  deadline: string;
  acceptanceCriteria: string;
  solutionCount: number;
}

interface SolutionSubmissionShellProps {
  bounty: Bounty;
  slot: Slot;
  bountyMeta: BountyMeta;
  isAcceptanceExpanded: boolean;
  onToggleAcceptance: () => void;
  solverNote: string;
  onSolverNoteChange: (value: string) => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onDiscard: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  children?: React.ReactNode;
}

export function SolutionSubmissionShell({
  bounty,
  slot,
  bountyMeta,
  isAcceptanceExpanded,
  onToggleAcceptance,
  solverNote,
  onSolverNoteChange,
  onSaveDraft,
  onSubmit,
  onDiscard,
  isSubmitting,
  canSubmit,
  children,
}: SolutionSubmissionShellProps) {
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const slotLabel =
    slot.kind === "stage"
      ? `Missing stage: ${slot.name}`
      : `Missing block: ${slot.name || (slot.blockType === "prompt" ? "Untitled prompt" : "Untitled code")}`;

  const solutionTitle =
    slot.kind === "stage"
      ? `Your solution: ${slot.name}`
      : `Your solution: ${slot.name || (slot.blockType === "prompt" ? "Untitled prompt" : "Untitled code")}`;

  const criteriaPreview =
    bountyMeta.acceptanceCriteria.length > 70
      ? bountyMeta.acceptanceCriteria.slice(0, 70) + "…"
      : bountyMeta.acceptanceCriteria;

  return (
    <div className="relative flex flex-col min-h-screen" style={{ maxWidth: 920, margin: "0 auto" }}>
      {/* PERSISTENT BOUNTY CONTEXT STRIP */}
      <div
        className="sticky top-0 z-20 flex items-center gap-4"
        style={{
          height: 76,
          background: "rgba(245,158,11,0.06)",
          borderBottom: "0.5px solid rgba(245,158,11,0.20)",
          padding: "12px 24px",
        }}
      >
        <Target size={14} style={{ color: "#F59E0B", flexShrink: 0 }} />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate">
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#F59E0B" }}>
              Solving:
            </span>
            <span className="truncate" style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.92)" }}>
              {bounty.title}
            </span>
          </div>
          <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.55)" }}>
            {slotLabel} · Open · {bountyMeta.solutionCount} solution{bountyMeta.solutionCount !== 1 ? "s" : ""} submitted
          </span>
        </div>
        <a
          href={`/b/${bounty.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 500, color: "#F59E0B", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          View full bounty →
        </a>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 pb-20" style={{ padding: "0 24px" }}>
        {/* ACCEPTANCE CRITERIA */}
        <div
          style={{
            marginTop: 16,
            marginBottom: 16,
            background: "rgba(22,22,30,0.40)",
            border: "0.5px solid rgba(245,158,11,0.20)",
            borderRadius: 8,
            padding: "12px 16px",
            overflow: "hidden",
            transition: "max-height 0.2s ease-out",
          }}
        >
          <div className="flex items-center cursor-pointer" onClick={onToggleAcceptance} style={{ gap: 8 }}>
            <CheckCircle size={12} style={{ color: "#F59E0B", flexShrink: 0 }} />
            <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#F59E0B", flex: 1 }}>
              Acceptance criteria
            </span>
            {isAcceptanceExpanded ? (
              <ChevronUp size={12} style={{ color: "rgba(255,255,255,0.55)" }} />
            ) : (
              <ChevronDown size={12} style={{ color: "rgba(255,255,255,0.55)" }} />
            )}
          </div>

          {!isAcceptanceExpanded && (
            <p className="truncate" style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.65)", marginTop: 6, marginBottom: 0 }}>
              {criteriaPreview}
            </p>
          )}

          {isAcceptanceExpanded && (
            <>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginTop: 12, marginBottom: 12 }}>
                {bountyMeta.acceptanceCriteria}
              </p>
              <p style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.55)", margin: 0 }}>
                Reward: ${bountyMeta.rewardAmount} {bountyMeta.rewardCurrency} · Deadline {bountyMeta.deadline}
              </p>
            </>
          )}
        </div>

        {/* TITLE */}
        <div style={{ height: 32, padding: "0 0 8px 0" }}>
          <h2 style={{ fontFamily: "Inter, sans-serif", fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.92)", margin: 0 }}>
            {solutionTitle}
          </h2>
        </div>

        {/* SOLVER NOTE */}
        <div style={{ background: "rgba(22,22,30,0.40)", border: "0.5px solid rgba(255, 255, 255, 0.14)", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
          <textarea
            value={solverNote}
            onChange={(e) => {
              if (e.target.value.length <= 500) onSolverNoteChange(e.target.value);
            }}
            placeholder="Add a note about your approach (optional)…"
            style={{
              width: "100%",
              minHeight: 60,
              maxHeight: 160,
              resize: "vertical",
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 400,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.85)",
            }}
          />
          <div className="flex justify-end" style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.40)", marginTop: 4 }}>
            {solverNote.length} / 500
          </div>
        </div>

        {/* EDITOR MOUNT */}
        <div
          style={{
            minHeight: 380,
            border: "0.5px dashed rgba(255,255,255,0.10)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {children ?? (
            <div className="flex items-center justify-center" style={{ height: 380 }}>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontStyle: "italic", color: "rgba(255,255,255,0.40)" }}>
                Editor mounts here in solve mode
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ACTION ROW */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-between z-20"
        style={{
          height: 60,
          background: "rgba(8,8,12,0.92)",
          backdropFilter: "blur(24px)",
          borderTop: "0.5px solid rgba(255, 255, 255, 0.14)",
          padding: "12px 24px",
        }}
      >
        <div className="flex items-center" style={{ maxWidth: 920, margin: "0 auto", width: "100%" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={onSaveDraft}
              style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 6, border: "0.5px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer" }}
            >
              Save draft
            </button>
            <button
              onClick={() => setShowDiscardModal(true)}
              style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 500, color: "rgba(239,68,68,0.65)", background: "transparent", border: "none", cursor: "pointer" }}
            >
              Discard
            </button>
          </div>
          <div className="flex-1" />
          <button
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              fontWeight: 600,
              padding: "8px 18px",
              borderRadius: 6,
              border: "none",
              background: "linear-gradient(135deg, #E8571A 0%, #D4470F 100%)",
              color: "#ffffff",
              cursor: canSubmit && !isSubmitting ? "pointer" : "not-allowed",
              opacity: canSubmit && !isSubmitting ? 1 : 0.4,
            }}
          >
            {isSubmitting ? "Submitting…" : "Submit solution"}
          </button>
        </div>
      </div>

      {/* DISCARD MODAL */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.70)" }}>
          <div style={{ width: 380, background: "rgba(22,22,30,1)", borderRadius: 12, border: "0.5px solid rgba(255,255,255,0.10)", padding: 24 }}>
            <h3 style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.92)", margin: "0 0 8px 0" }}>
              Discard solution draft?
            </h3>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 400, color: "rgba(255,255,255,0.55)", margin: "0 0 20px 0" }}>
              Your draft will be permanently deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDiscardModal(false)}
                style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 6, border: "0.5px solid rgba(255,255,255,0.10)", background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDiscardModal(false);
                  onDiscard();
                }}
                style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.85)", color: "#ffffff", cursor: "pointer" }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

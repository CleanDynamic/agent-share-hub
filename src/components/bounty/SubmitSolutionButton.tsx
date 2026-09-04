import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useBountyProvenance } from "./BountyProvenanceContext";

interface SubmitSolutionButtonProps {
  slotKind: "stage" | "block";
  slotId: string;
  size?: "stage" | "block";
}

/**
 * "Submit a solution" CTA rendered inside MissingStageBadge / MissingBlockOverlay
 * when a bounty is open or closed. Reads slug + counts from BountyProvenanceContext.
 */
export function SubmitSolutionButton({
  slotKind,
  slotId,
  size = "stage",
}: SubmitSolutionButtonProps) {
  const ctx = useBountyProvenance();
  const navigate = useNavigate();
  if (!ctx) return null;
  if (ctx.bountyStatus === "solved") return null;

  const count = ctx.slotSolutionCounts[slotId] ?? 0;
  const isStage = size === "stage";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        marginTop: 4,
        pointerEvents: "auto",
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/b/${ctx.bountySlug}/solve/${slotId}?kind=${slotKind}`);
        }}
        style={{
          fontFamily: "Figtree, sans-serif",
          fontSize: isStage ? 11 : 10,
          fontWeight: 600,
          color: "#FFFFFF",
          background: "linear-gradient(135deg, #E8571A, #F59E0B)",
          border: "none",
          borderRadius: 6,
          padding: isStage ? "4px 10px" : "3px 8px",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(232,87,26,0.30)",
        }}
      >
        Submit a solution
      </button>
      {count > 0 && (
        <span
          style={{
            fontFamily: "Figtree, sans-serif",
            fontSize: 9,
            fontWeight: 500,
            color: "rgba(245,158,11,0.75)",
          }}
        >
          {count} solution{count !== 1 ? "s" : ""} submitted
        </span>
      )}
    </div>
  );
}

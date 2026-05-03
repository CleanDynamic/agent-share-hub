import * as React from "react";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";

interface Author {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
}

export interface SolverInfo {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  slotName: string;
  acceptedAt: string;
  isTrustedSolver: boolean;
}

interface BountyBylineProps {
  bountyAuthor: Author;
  solvers: SolverInfo[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onViewProvenance: () => void;
  onAuthorClick?: (id: string) => void;
}

export function BountyByline({
  bountyAuthor,
  solvers,
  isExpanded,
  onToggleExpand,
  onViewProvenance,
  onAuthorClick,
}: BountyBylineProps) {
  const hasSolvers = solvers.length > 0;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={() => onAuthorClick?.(bountyAuthor.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "none",
            border: "none",
            cursor: onAuthorClick ? "pointer" : "default",
            padding: 0,
          }}
        >
          <img
            src={bountyAuthor.avatarUrl}
            alt={bountyAuthor.displayName}
            style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.10)" }}
          />
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.90)",
              }}
            >
              {bountyAuthor.displayName}
            </div>
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              @{bountyAuthor.handle}
            </div>
          </div>
        </button>

        {hasSolvers && (
          <button
            onClick={onToggleExpand}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 100,
              background: "rgba(46,196,182,0.10)",
              border: "0.5px solid rgba(46,196,182,0.25)",
              color: "#2EC4B6",
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + {solvers.length} solver{solvers.length > 1 ? "s" : ""}
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {isExpanded && hasSolvers && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: "rgba(46,196,182,0.04)",
            border: "0.5px solid rgba(46,196,182,0.15)",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {solvers.slice(0, 8).map((solver) => (
            <div
              key={solver.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <img
                  src={solver.avatarUrl}
                  alt={solver.displayName}
                  style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0 }}
                />
                <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    {solver.displayName}
                  </span>
                  <span
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    @{solver.handle}
                  </span>
                  {solver.isTrustedSolver && (
                    <Shield size={10} color="#2EC4B6" style={{ flexShrink: 0 }} />
                  )}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 10,
                  fontWeight: 400,
                  color: "rgba(46,196,182,0.70)",
                  background: "rgba(46,196,182,0.08)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                }}
              >
                Solved {solver.slotName}
              </span>
            </div>
          ))}

          <button
            onClick={onViewProvenance}
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              fontWeight: 500,
              color: "#2EC4B6",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 0",
              textAlign: "left",
              marginTop: 4,
            }}
          >
            View provenance →
          </button>
        </div>
      )}
    </div>
  );
}

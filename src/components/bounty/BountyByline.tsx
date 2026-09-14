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
            style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--line)" }}
          />
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              {bountyAuthor.displayName}
            </div>
            <div
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: 12,
                color: "var(--text2)",
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
              borderRadius: 'var(--r-chip)',
              background: "color-mix(in srgb, var(--evidence) 10%, transparent)",
              border: "0.5px solid color-mix(in srgb, var(--evidence) 25%, transparent)",
              color: "var(--evidence)",
              fontFamily: "Figtree, sans-serif",
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
            background: "color-mix(in srgb, var(--evidence) 4%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--evidence) 15%, transparent)",
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
                      fontFamily: "Figtree, sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    {solver.displayName}
                  </span>
                  <span
                    style={{
                      fontFamily: "Figtree, sans-serif",
                      fontSize: 11,
                      color: "var(--text2)",
                    }}
                  >
                    @{solver.handle}
                  </span>
                  {solver.isTrustedSolver && (
                    <Shield size={10} color="var(--evidence)" style={{ flexShrink: 0 }} />
                  )}
                </div>
              </div>
              <span
                style={{
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 10,
                  fontWeight: 400,
                  color: "color-mix(in srgb, var(--evidence) 70%, transparent)",
                  background: "color-mix(in srgb, var(--evidence) 8%, transparent)",
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
              fontFamily: "Figtree, sans-serif",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--evidence)",
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

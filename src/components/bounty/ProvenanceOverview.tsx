import * as React from "react";
import { Users, Shield, ExternalLink } from "lucide-react";
import type { SolverInfo } from "./BountyByline";

interface Author {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  postedAt: string;
}

interface ProvenanceOverviewProps {
  bountyAuthor: Author;
  solvers: SolverInfo[];
  onSolverClick: (solverId: string) => void;
  onLearnMore: () => void;
}

export function ProvenanceOverview({
  bountyAuthor,
  solvers,
  onSolverClick,
  onLearnMore,
}: ProvenanceOverviewProps) {
  if (solvers.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 32,
        padding: 20,
        background: "rgba(46,196,182,0.03)",
        border: "0.5px solid rgba(46,196,182,0.15)",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={14} color="#2EC4B6" />
          <h3
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
              margin: 0,
            }}
          >
            Contributors
          </h3>
        </div>
        <button
          onClick={onLearnMore}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "Figtree, sans-serif",
            fontSize: 11,
            color: "rgba(46,196,182,0.85)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          How attribution works
          <ExternalLink size={10} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {/* Bounty author card */}
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <img
              src={bountyAuthor.avatarUrl}
              alt={bountyAuthor.displayName}
              style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {bountyAuthor.displayName}
              </div>
              <div
                style={{
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                @{bountyAuthor.handle}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 10,
                  color: "#F59E0B",
                  fontWeight: 600,
                }}
              >
                Bounty author
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.40)",
                }}
              >
                Posted bounty · {bountyAuthor.postedAt}
              </div>
            </div>
          </div>
        </div>

        {solvers.map((solver) => (
          <button
            key={solver.id}
            onClick={() => onSolverClick(solver.id)}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "0.5px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: 12,
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(46,196,182,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <img
                src={solver.avatarUrl}
                alt={solver.displayName}
                style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    style={{
                      fontFamily: "Figtree, sans-serif",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    {solver.displayName}
                  </span>
                  {solver.isTrustedSolver && <Shield size={10} color="#2EC4B6" />}
                </div>
                <div
                  style={{
                    fontFamily: "Figtree, sans-serif",
                    fontSize: 11,
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  @{solver.handle}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: "Figtree, sans-serif",
                    fontSize: 10,
                    color: "#2EC4B6",
                    fontWeight: 600,
                  }}
                >
                  Solver
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: "Figtree, sans-serif",
                    fontSize: 10,
                    color: "rgba(255,255,255,0.40)",
                  }}
                >
                  Solved {solver.slotName} · {solver.acceptedAt}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "0.5px solid rgba(255, 255, 255, 0.14)",
          fontFamily: "Figtree, sans-serif",
          fontSize: 10,
          color: "rgba(255,255,255,0.40)",
          fontStyle: "italic",
        }}
      >
        All accepted solutions are permanently attributed. Provenance cannot be removed by editing.
      </div>
    </div>
  );
}

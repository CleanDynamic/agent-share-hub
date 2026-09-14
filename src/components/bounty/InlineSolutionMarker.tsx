import * as React from "react";
import { UserCheck } from "lucide-react";

interface Solver {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  isTrustedSolver: boolean;
}

interface InlineSolutionMarkerProps {
  kind: "stage" | "block";
  solver: Solver;
  acceptedAt: string;
  onViewOriginal: () => void;
  children: React.ReactNode;
}

/**
 * Wraps a merged stage/block (whose solution was accepted) with provenance UI.
 * Visual spec from v0 session C.
 */
export function InlineSolutionMarker({
  kind,
  solver,
  acceptedAt,
  onViewOriginal,
  children,
}: InlineSolutionMarkerProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);

  if (kind === "stage") {
    return (
      <div style={{ position: "relative", marginTop: 12, marginBottom: 12 }}>
        {/* Provenance ribbon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 12px",
            background: "color-mix(in srgb, var(--evidence) 6%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--evidence) 20%, transparent)",
            borderRadius: "6px 6px 0 0",
            borderBottom: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <UserCheck size={12} color="var(--evidence)" />
            <span
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--text)",
              }}
            >
              Solved by{" "}
              <span style={{ color: "var(--evidence)", fontWeight: 600 }}>
                @{solver.handle}
              </span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: 10,
                color: "var(--text2)",
              }}
            >
              Accepted {acceptedAt}
            </span>
            <button
              onClick={onViewOriginal}
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--evidence)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              Original solution →
            </button>
          </div>
        </div>

        {/* Stage content with teal left border */}
        <div
          style={{
            borderLeft: "2px solid color-mix(in srgb, var(--evidence) 40%, transparent)",
            borderRadius: "0 0 6px 6px",
            paddingLeft: 4,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // Block variant
  return (
    <div style={{ position: "relative" }}>
      {/* Attribution badge */}
      <div
        style={{ position: "absolute", top: 4, right: 4, zIndex: 5 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--evidence) 20%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--evidence) 40%, transparent)",
            cursor: "help",
          }}
        >
          <UserCheck size={10} color="var(--evidence)" />
        </div>

        {showTooltip && (
          <div
            style={{
              position: "absolute",
              top: 22,
              right: 0,
              minWidth: 180,
              padding: 8,
              borderRadius: 6,
              background: "var(--bg)",
              border: "0.5px solid color-mix(in srgb, var(--evidence) 30%, transparent)",
              boxShadow: "var(--elev-raised)",
              zIndex: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <UserCheck size={11} color="var(--evidence)" />
              <span
                style={{
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                Solved by @{solver.handle}
              </span>
            </div>
            <button
              onClick={onViewOriginal}
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--evidence)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              View original solution →
            </button>
          </div>
        )}
      </div>

      {/* Block content with teal border */}
      <div
        style={{
          borderRadius: 6,
          boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--evidence) 25%, transparent)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

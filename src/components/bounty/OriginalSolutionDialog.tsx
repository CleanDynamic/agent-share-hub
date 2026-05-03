import * as React from "react";
import { X } from "lucide-react";

interface OriginalSolutionDialogProps {
  open: boolean;
  onClose: () => void;
  original: any;
  current: any;
  slotKind: "stage" | "block";
  slotId: string;
}

/**
 * Side-by-side diff modal: original submitted content_payload vs the
 * currently-merged stage/block state. Used after a bounty author edits
 * the merged content post-acceptance.
 */
export function OriginalSolutionDialog({
  open,
  onClose,
  original,
  current,
  slotKind,
  slotId,
}: OriginalSolutionDialogProps) {
  if (!open) return null;
  const fmt = (v: any) => {
    try {
      return JSON.stringify(v ?? null, null, 2);
    } catch {
      return String(v);
    }
  };
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1080px, 100%)",
          maxHeight: "82vh",
          background: "#0F0F14",
          border: "0.5px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            Original solution · {slotKind} · {slotId.slice(0, 8)}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", flex: 1, minHeight: 0 }}>
          <Pane title="Original submission" json={fmt(original)} />
          <Pane title="Current (merged) state" json={fmt(current)} />
        </div>
      </div>
    </div>
  );
}

function Pane({ title, json }: { title: string; json: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderRight: "0.5px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(46,196,182,0.85)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        }}
      >
        {title}
      </div>
      <pre
        style={{
          flex: 1,
          margin: 0,
          padding: 12,
          overflow: "auto",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: 11,
          color: "rgba(255,255,255,0.80)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {json}
      </pre>
    </div>
  );
}

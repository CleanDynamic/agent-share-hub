/* UX-11: what an old request shows on /content/:id now. The page is history: its status as it was recorded, and one line saying
   requests have closed and where to ask instead. "starting a topic" opens the New topic window (the page hosts it). */

import type { CSSProperties } from "react";

export type RequestStatus = "open" | "closed" | "solved";

const STATUS_WORDS: Record<RequestStatus, string> = { open: "Open when it closed", closed: "Closed", solved: "Solved" };

const line: CSSProperties = { margin: 0, fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 400, lineHeight: "20px" };

export function ClosedRequestLine({ status, onStartTopic }: { status: RequestStatus; onStartTopic: () => void }) {
  return (
    <div data-testid="old-request-history" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 0 16px" }}>
      <p data-testid="old-request-status" style={{ ...line, color: "var(--text2)" }}>
        Status: {STATUS_WORDS[status]}
      </p>
      <p data-testid="old-request-closed" style={{ ...line, color: "var(--text)" }}>
        Requests have closed. Ask in OpenBuilds by{" "}
        <button
          type="button"
          onClick={onStartTopic}
          style={{ all: "unset", cursor: "pointer", color: "var(--text)", textDecoration: "underline" }}
        >
          starting a topic
        </button>
        .
      </p>
    </div>
  );
}

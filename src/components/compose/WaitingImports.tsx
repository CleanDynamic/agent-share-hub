// Waiting imports — what the connector left on the upload page (EX-P09).
//
// A creator typed "put this on buildgallery" in their AI chat, and the whole
// conversation arrived here, parsed and parked. This panel is where they find
// it: one row per waiting import, with enough on the row to recognise the
// conversation — which tool sent it, when, how much it holds, how long it will
// wait — and two things to do with it. REVIEW opens the same tick-box screen a
// pasted transcript gets; DISCARD bins it, after asking once.
//
// NOTHING HERE READS THE CONVERSATION. The row shows counts and states lifted
// off the import; the proposal itself is loaded only when Review is pressed and
// handed to the review surface as data. Text inside an import is never an
// instruction to this component or to anything it calls.
//
// A PEER OF THE OTHER WAYS IN, laid out as the repository and Build File cards
// are: its own bordered block in the intake column, so nothing already on the
// page had to move to make room for it. Rows inside it use the workspace's
// flat card — this is a working surface, and working surfaces carry no glass.

import { useState } from "react";
import type { CSSProperties } from "react";
import type { WaitingImport } from "@/lib/build/imports";
import { bodyText, labelText } from "@/components/build/tokens";
import { workspaceCard } from "@/components/shell/WorkspaceBar";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { data as dataText } from "@/lib/theme/type";
import { feedback } from "@/lib/theme/motion";

/** The six clients the connector admits, as a creator would name them. */
const TOOL_NAMES: Record<string, string> = {
  claude: "Claude",
  "claude-code": "Claude Code",
  chatgpt: "ChatGPT",
  cursor: "Cursor",
  web: "the web",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The registry's fallback reader; it takes whatever nothing else claims. */
const FALLBACK_READER_ID = "transcript";

/** What the fallback reports when it found no speaker convention and kept the text whole. */
const UNSTRUCTURED_FORMAT = "unstructured";

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-GB")} ${count === 1 ? one : many}`;
}

/**
 * "Claude Code", or null when the caller did not say what it was. Exported for
 * the destination step (EX-P10), which names the tool in the sentence saying
 * where a target draft came from.
 */
export function importToolName(item: Pick<WaitingImport, "client">): string | null {
  if (!item.client) return null;
  return TOOL_NAMES[item.client] ?? null;
}

/**
 * "From Claude Code, 84 steps" — the review's provenance line, in the same
 * voice the Build File path uses. Parts are named only when there are any: a
 * conversation with nothing pulled out of the replies is still 84 steps.
 */
function importSourceLine(item: WaitingImport): string {
  const steps = plural(item.event_count, "step", "steps");
  const parts = item.node_count > 0 ? ` and ${plural(item.node_count, "part", "parts")}` : "";
  const tool = importToolName(item);
  return tool ? `From ${tool}, ${steps}${parts}` : `${steps}${parts}`;
}

/**
 * Whether to warn that the structure may be rougher than usual.
 *
 * Two signals. The connector records "uncertain: …" as the detection reason
 * when routing could not decide (EX-P11). And the fallback reader, having found
 * no speaker convention, keeps the whole conversation as one event — which is
 * honest, and which a creator expecting 84 tick boxes should be told about
 * before they open it.
 */
function importStructureIsRough(item: WaitingImport): boolean {
  const reason = item.detection_reason?.trim().toLowerCase() ?? "";
  if (reason.startsWith("uncertain")) return true;
  return item.reader_id === FALLBACK_READER_ID && item.detected_format === UNSTRUCTURED_FORMAT;
}

/**
 * "3 hours ago", "yesterday", "12 Sep". Exported for the destination step
 * (EX-P10), so a draft's "last touched" reads in the same words as an
 * import's "arrived".
 */
export function arrivedAgo(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const elapsed = Math.max(0, now - then);
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), "hour ago", "hours ago");
  if (elapsed < 2 * DAY) return "yesterday";
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)} days ago`;
  const date = new Date(then);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "expires in 6 days", "expires tomorrow", "expires today". */
function expiresIn(iso: string, now = Date.now()): string {
  const until = Date.parse(iso);
  if (!Number.isFinite(until)) return "";
  const days = Math.ceil((until - now) / DAY);
  if (days <= 0) return "expires today";
  if (days === 1) return "expires tomorrow";
  return `expires in ${days} days`;
}

/** "84 steps · 3 parts · 120,000 characters". */
function countsLine(item: WaitingImport): string {
  const parts: string[] = [plural(item.event_count, "step", "steps")];
  if (item.node_count > 0) parts.push(plural(item.node_count, "part", "parts"));
  parts.push(plural(item.total_chars, "character", "characters"));
  return parts.join(" · ");
}

function secretsLine(item: WaitingImport): string | null {
  const total = item.secret_findings.reduce((sum, finding) => sum + finding.count, 0);
  if (total === 0) return null;
  return total === 1
    ? "1 secret was removed before it arrived."
    : `${total} secrets were removed before they arrived.`;
}

/** Secondary: a hairline on the glass-2 ground, the page's own treatment. */
const secondaryControl: CSSProperties = {
  ...labelText,
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
  height: 34,
  padding: "0 16px",
  borderRadius: r.control,
  backgroundColor: "var(--glass-2)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: t.line,
  color: t.text,
  whiteSpace: "nowrap",
  transition: feedback("background-color", "border-color", "color"),
};

/** Tertiary: a ghost, the way "Choose a file" is drawn on this page. */
const tertiaryControl: CSSProperties = {
  ...labelText,
  fontFamily: "inherit",
  background: "transparent",
  borderWidth: 0,
  borderStyle: "none",
  padding: 0,
  color: t.text2,
  textDecoration: "underline",
  textUnderlineOffset: 3,
  whiteSpace: "nowrap",
};

interface WaitingImportsProps {
  imports: WaitingImport[];
  /** The page is busy elsewhere — a paste is parsing, a draft is being created. */
  busy: boolean;
  /** The import whose proposal is being fetched, if any. */
  openingId: string | null;
  /** The import being binned, if any. */
  discardingId: string | null;
  /** Review, with the provenance line the review surface should carry. */
  onReview: (item: WaitingImport, sourceLine: string) => void;
  onDiscard: (item: WaitingImport) => void;
  error: string | null;
}

export function WaitingImports({
  imports,
  busy,
  openingId,
  discardingId,
  onReview,
  onDiscard,
  error,
}: WaitingImportsProps) {
  /** Discard asks once. The question is held per row, and dropped on Keep. */
  const [askingId, setAskingId] = useState<string | null>(null);

  if (imports.length === 0) return null;

  return (
    <section
      data-visual-slot="intake-waiting-imports"
      data-testid="waiting-imports"
      aria-label="Waiting for your review"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: t.line,
        background: "var(--glass-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...labelText, textTransform: "uppercase" }}>Waiting for your review</span>
        <span data-testid="waiting-imports-count" style={{ ...dataText, color: t.text2 }}>
          {plural(imports.length, "conversation", "conversations")}
        </span>
      </div>

      <span style={{ ...bodyText, fontSize: 12, color: t.text2 }}>
        Sent from a chat through the buildgallery connector. Nothing is saved to a
        build until you have looked at it and chosen what to keep.
      </span>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {imports.map((item) => {
          const tool = importToolName(item);
          const asking = askingId === item.id;
          const opening = openingId === item.id;
          const discarding = discardingId === item.id;
          const rowBusy = busy || opening || discarding;
          const secrets = secretsLine(item);

          return (
            <li key={item.id} style={{ listStyle: "none" }}>
              <div
                data-testid="waiting-import"
                data-import-id={item.id}
                style={{
                  ...workspaceCard,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: "11px 13px",
                  opacity: discarding ? 0.55 : 1,
                  transition: feedback("opacity"),
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  {/* Provenance and counts are data, so both lines are mono. */}
                  <span data-testid="waiting-import-source" style={{ ...dataText, color: t.text }}>
                    {tool ? `From ${tool}` : "From an unknown tool"}
                    {" · "}
                    arrived {arrivedAgo(item.created_at)}
                  </span>
                  <span data-testid="waiting-import-counts" style={{ ...dataText, color: t.text2 }}>
                    {countsLine(item)}
                    {" · "}
                    {expiresIn(item.expires_at)}
                  </span>
                  {secrets ? (
                    <span style={{ ...bodyText, fontSize: 12, color: t.text2 }}>{secrets}</span>
                  ) : null}
                  {importStructureIsRough(item) ? (
                    <span
                      data-testid="waiting-import-rough"
                      style={{ ...bodyText, fontSize: 12, color: t.text2 }}
                    >
                      It was hard to tell where each turn began, so the structure may be
                      rougher than usual.
                    </span>
                  ) : null}
                </div>

                {asking ? (
                  <div
                    role="group"
                    aria-label="Confirm discard"
                    style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                  >
                    <span style={{ ...bodyText, fontSize: 12, color: t.text }}>
                      Discard this conversation? It cannot be brought back here.
                    </span>
                    <button
                      type="button"
                      data-testid="waiting-import-discard-confirm"
                      onClick={() => {
                        setAskingId(null);
                        onDiscard(item);
                      }}
                      disabled={rowBusy}
                      style={{
                        ...secondaryControl,
                        color: t.catBreakage,
                        cursor: rowBusy ? "wait" : "pointer",
                      }}
                    >
                      Discard it
                    </button>
                    <button
                      type="button"
                      data-testid="waiting-import-discard-keep"
                      onClick={() => setAskingId(null)}
                      disabled={rowBusy}
                      style={{ ...tertiaryControl, cursor: rowBusy ? "wait" : "pointer" }}
                    >
                      Keep it
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      data-testid="waiting-import-review"
                      onClick={() => onReview(item, importSourceLine(item))}
                      disabled={rowBusy}
                      style={{
                        ...secondaryControl,
                        color: rowBusy ? t.text2 : t.text,
                        cursor: rowBusy ? "wait" : "pointer",
                      }}
                    >
                      {opening ? "Opening…" : "Review"}
                    </button>
                    <button
                      type="button"
                      data-testid="waiting-import-discard"
                      onClick={() => setAskingId(item.id)}
                      disabled={rowBusy}
                      style={{ ...tertiaryControl, cursor: rowBusy ? "wait" : "pointer" }}
                    >
                      {discarding ? "Discarding…" : "Discard"}
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {error ? (
        <p
          role="alert"
          data-testid="waiting-imports-error"
          style={{
            ...bodyText,
            margin: 0,
            padding: "10px 12px",
            backgroundColor: t.recess,
            borderWidth: 1,
            borderStyle: "solid",
            borderColor: t.line,
            borderRadius: r.panel,
            borderLeftWidth: 2,
            borderLeftStyle: "solid",
            borderLeftColor: t.catBreakage,
            color: t.text,
          }}
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

/* UI-P74 — "Before you send it": what to paste and attach before a step's text goes into its chat.

   One row per paste-in (an arrow, "Paste what step {n} gave you" over the title and the tool it came
   from, and a link that goes to that step), one per attachment ("Attach {name}" over "File · {size}",
   with Download). Inside an agent or a team the rows read "Uses". Left out when the step has nothing.
   The same panel fills the reading panel of the Map and the full prompt window in reader mode. */

import { ArrowLeft, Paperclip } from "lucide-react";
import type { CSSProperties } from "react";

import type { ReaderStep } from "@/lib/build/readerSteps";
import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export const BEFORE_YOU_SEND = "Before you send it";

const mono: CSSProperties = { fontFamily: DM_MONO, fontSize: 11.5, lineHeight: "normal", color: t.text2 };
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${t.hairline}` };

function LinkButton({ children, onClick, label }: { children: string; onClick: () => void; label: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      {...handlers}
      style={{ background: "none", border: 0, padding: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, color: t.text, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, ...ring(state.focusVisible) }}
    >
      {children}
    </button>
  );
}

export interface BeforeYouSendProps {
  entry: ReaderStep;
  /** The tool a step's chat was in, by step id, for "{title} · {tool}". */
  toolOf: (stepId: string) => string | null;
  /** Select the box of another step. */
  onSelect: (stepId: string) => void;
}

/** True when there is something to show: a paste-in, an attachment, or (inside an agent or a team) a use. */
export function hasBeforeYouSend(entry: ReaderStep): boolean {
  return inside(entry) ? entry.uses.length > 0 : entry.pasteIns.length > 0 || entry.attach.length > 0;
}

const inside = (entry: ReaderStep): boolean => entry.step.number.includes(".") || entry.step.kind === "agent" || entry.step.kind === "team";

export function BeforeYouSend({ entry, toolOf, onSelect }: BeforeYouSendProps) {
  if (!hasBeforeYouSend(entry)) return null;
  return (
    <section data-testid="before-you-send" aria-label={BEFORE_YOU_SEND}>
      <h3 style={{ margin: "0 0 4px", fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>{BEFORE_YOU_SEND}</h3>
      {inside(entry) ? (
        entry.uses.map((use) => (
          <div key={use} data-testid="before-row" style={row}>
            <span style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>Uses</span>
            <span style={{ fontFamily: FIGTREE, fontSize: 14, color: t.text }}>{use}</span>
          </div>
        ))
      ) : (
        <>
          {entry.pasteIns.map((paste) => {
            const tool = toolOf(paste.stepId);
            return (
              <div key={paste.stepId} data-testid="before-row" style={row}>
                <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" color={t.text2} style={{ flexShrink: 0 }} />
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>Paste what step {paste.number} gave you</div>
                  <div style={mono}>{[paste.title, tool].filter(Boolean).join(" · ")}</div>
                </div>
                <LinkButton label={`Go to step ${paste.number}`} onClick={() => onSelect(paste.stepId)}>
                  {`Step ${paste.number}`}
                </LinkButton>
              </div>
            );
          })}
          {entry.attach.map((file) => (
            <div key={file.id} data-testid="before-row" style={row}>
              <Paperclip size={14} strokeWidth={1.8} aria-hidden="true" color={t.text2} style={{ flexShrink: 0 }} />
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text, overflowWrap: "anywhere" }}>Attach {file.name}</div>
                <div style={mono}>{["File", file.size].filter(Boolean).join(" · ")}</div>
              </div>
              {file.download ? (
                <a href={file.download} download={file.name} aria-label={`Download ${file.name}`} style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, color: t.text }}>
                  Download
                </a>
              ) : null}
            </div>
          ))}
        </>
      )}
    </section>
  );
}

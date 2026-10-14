/* UI-P90 — "Before you send it" in the refined look, as `design/reference/refined/{dusk,noon}/build-map.html` draws
   it in the reading panel.

   A FORK, NOT AN EDIT. `BeforeYouSend` stays the current look; this takes its props (imported, not copied) and says
   the same rows in the same order with the same accessible names. The heading is 13/500 over a `--hairline-module`
   rule; each row is 48 high on that rule: a 16px glyph in `--label`, the line 12.5/500 over its detail 11.5 `--label`,
   and the link at the right 12.5/500. */

import type { CSSProperties } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BEFORE_YOU_SEND, hasBeforeYouSend, type BeforeYouSendProps } from "./BeforeYouSend";

const text = (px: number, weight: 400 | 500, color: string): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
});

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minHeight: 48,
  borderBottom: `1px solid ${t.hairlineModule}`,
};

const lines: CSSProperties = { display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 };

const inside = (entry: BeforeYouSendProps["entry"]): boolean =>
  entry.step.number.includes(".") || entry.step.kind === "agent" || entry.step.kind === "team";

function LinkButton({ children, onClick, label }: { children: string; onClick: () => void; label: string }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      {...handlers}
      style={{
        ...text(12.5, 500, t.text),
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
        textDecoration: state.hovered ? "underline" : "none",
        textUnderlineOffset: 3,
        flexShrink: 0,
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

export function RefinedBeforeYouSend({ entry, toolOf, onSelect }: BeforeYouSendProps) {
  if (!hasBeforeYouSend(entry)) return null;
  return (
    <section data-testid="before-you-send" aria-label={BEFORE_YOU_SEND} style={{ display: "flex", flexDirection: "column" }}>
      <h3 style={{ ...text(13, 500, t.text), margin: 0, paddingBottom: 8, borderBottom: `1px solid ${t.hairlineModule}` }}>
        {BEFORE_YOU_SEND}
      </h3>
      {inside(entry) ? (
        entry.uses.map((use) => (
          <div key={use} data-testid="before-row" style={row}>
            <span style={text(12.5, 500, t.text)}>Uses</span>
            <span style={{ ...text(12.5, 400, t.text2), minWidth: 0, overflowWrap: "anywhere" }}>{use}</span>
          </div>
        ))
      ) : (
        <>
          {entry.pasteIns.map((paste) => {
            const tool = toolOf(paste.stepId);
            return (
              <div key={paste.stepId} data-testid="before-row" style={row}>
                <span aria-hidden="true" style={{ display: "inline-flex", color: t.label, flexShrink: 0 }}>
                  <Glyph name="larr" size={16} />
                </span>
                <div style={lines}>
                  <span style={text(12.5, 500, t.text)}>Paste what step {paste.number} gave you</span>
                  <span style={text(11.5, 400, t.label)}>{[paste.title, tool].filter(Boolean).join(" · ")}</span>
                </div>
                <LinkButton label={`Go to step ${paste.number}`} onClick={() => onSelect(paste.stepId)}>
                  {`Step ${paste.number}`}
                </LinkButton>
              </div>
            );
          })}
          {entry.attach.map((file) => (
            <div key={file.id} data-testid="before-row" style={row}>
              <span aria-hidden="true" style={{ display: "inline-flex", color: t.label, flexShrink: 0 }}>
                <Glyph name="file" size={16} />
              </span>
              <div style={lines}>
                <span style={{ ...text(12.5, 500, t.text), overflowWrap: "anywhere" }}>Attach {file.name}</span>
                <span style={text(11.5, 400, t.label)}>{["File", file.size].filter(Boolean).join(" · ")}</span>
              </div>
              {file.download ? (
                <a
                  href={file.download}
                  download={file.name}
                  aria-label={`Download ${file.name}`}
                  style={{ ...text(12.5, 500, t.text), textDecoration: "none", flexShrink: 0 }}
                >
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

export default RefinedBeforeYouSend;

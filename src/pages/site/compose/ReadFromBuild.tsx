/* CA-16 P5: "Read from your build": every facet the tiles say, where it came from, and what the maker can correct.

   GAP QUESTIONS come first. They are questions, never errors: each has its action (Add code) and Dismiss. Under them,
   one row per derived facet: its name, its value (the maker's correction when there is one), a provenance dot (Derived,
   Stated by you, Not stated), a Source link that selects the tile the value came from, and Dispute for the facets a
   maker can correct (Human oversight, Skill needed, Cost to run, What was built). Dispute opens a small form: the
   corrected value from the list, and a reason. A disputed value reads "Stated by you". "Confirmed free" is the dispute
   that makes Cost to run "Free plans are enough". */

import { useId, useState, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { ProvenanceDot } from "@/components/classify/ClassificationBits";
import type { GapQuestion, QuestionAction } from "@/lib/classify/derive";
import { shownValues } from "@/lib/classify/facets";
import { labelFor } from "@/lib/classify/lines";
import { DERIVED_FACETS, DISPUTABLE_FACETS, FACET_LABEL, TAXONOMY, type Facet } from "@/lib/classify/taxonomy";
import type { Classification, Dispute } from "@/lib/classify/types";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { PickMenu } from "./PickMenu";
import { bareButton, text, typedField } from "./refinedStyles";

export const CONFIRMED_FREE = "Confirmed free";

export interface ReadFromBuildProps {
  /** The classification as the draft would make it: derived values, disputes. */
  classification: Classification;
  /** Questions the maker has not dismissed. */
  questions: readonly GapQuestion[];
  phone: boolean;
  onDispute: (facet: Facet, dispute: Dispute | null) => void;
  onDismiss: (questionId: string) => void;
  onSource?: (tileId: string) => void;
  onAction?: (action: QuestionAction, question: GapQuestion) => void;
  now?: () => string;
}

const link: CSSProperties = { ...bareButton, ...text(12, 400, t.text2), textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: t.line, borderRadius: 4 };

function LinkButton({ children, onClick, label, phone }: { children: string; onClick: () => void; label?: string; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" aria-label={label} onClick={onClick} {...handlers} style={{ ...link, minHeight: phone ? 44 : 24, padding: phone ? "0 6px" : "0 2px", ...ring(state.focusVisible) }}>
      {children}
    </button>
  );
}

function DisputeForm({ facet, phone, current, onApply, onCancel }: { facet: Facet; phone: boolean; current: string | null; onApply: (value: string, reason: string) => void; onCancel: () => void }) {
  const id = useId();
  const options = TAXONOMY[facet].filter((value) => value.selectable);
  const [value, setValue] = useState(current ?? options[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const name = FACET_LABEL[facet];
  const field = typedField(phone, { width: "100%" });
  const free = facet === "cost" && value === "free-plans-are-enough";
  return (
    <form
      aria-label={`Dispute ${name}`}
      onSubmit={(event) => {
        event.preventDefault();
        const why = (reason.trim() || (free ? CONFIRMED_FREE : "")).slice(0, 280);
        if (!value || !why) return;
        onApply(value, why);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 6, background: t.tile, border: `1px solid ${t.tileBorder}` }}
    >
      <span style={text(12.5, 500, t.text)}>{`Corrected value for ${name}`}</span>
      <PickMenu label={`Corrected value for ${name}`} options={options.map((option) => ({ value: option.id, label: option.label }))} value={value || null} onChange={setValue} phone={phone} id={`${id}-value`} />
      <label htmlFor={`${id}-reason`} style={text(12.5, 500, t.text)}>
        {`Reason for changing ${name}`}
      </label>
      <input
        id={`${id}-reason`}
        type="text"
        autoComplete="off"
        maxLength={280}
        value={reason}
        placeholder={free ? CONFIRMED_FREE : "e.g. a friend set it up without writing any code"}
        onChange={(event) => setReason(event.target.value)}
        style={field}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Button type="submit" size={phone ? 44 : 30} fontSize={13} disabled={!value || !(reason.trim() || free)}>
          Use this value
        </Button>
        <Button variant="ghost" size={phone ? 44 : 30} fontSize={13} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReadFromBuild({ classification, questions, phone, onDispute, onDismiss, onSource, onAction, now = () => new Date().toISOString() }: ReadFromBuildProps) {
  const [editing, setEditing] = useState<Facet | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {questions.length > 0 ? (
        <section aria-label="Questions" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ ...text(12.5, 500, t.text), margin: 0 }}>Questions</h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {questions.map((question) => (
              <li key={question.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, borderRadius: 6, background: t.tile, border: `1px solid ${t.tileBorder}` }}>
                <p style={{ margin: 0, ...text(13, 400, t.text), lineHeight: "20px" }}>{question.text}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" size={phone ? 44 : 28} fontSize={13} onClick={() => onAction?.(question.action, question)}>
                    {question.actionLabel}
                  </Button>
                  <Button variant="ghost" size={phone ? 44 : 28} fontSize={13} onClick={() => onDismiss(question.id)}>
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ul aria-label="Read from your build" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
        {DERIVED_FACETS.map((facet) => {
          const shown = shownValues(classification, facet);
          const from = classification.derived[facet]?.from ?? [];
          const disputable = DISPUTABLE_FACETS.includes(facet);
          const disputed = classification.disputes[facet];
          const name = FACET_LABEL[facet];
          const labels = shown.values.map((id) => labelFor(facet, id));
          return (
            <li key={facet} data-facet={facet} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderBottom: `1px solid ${t.hairlineModule}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <span style={{ ...text(12.5, 500, t.text), flex: "0 0 124px", minWidth: 0 }}>{name}</span>
                <span style={{ ...text(12.5, 400, labels.length > 0 ? t.text : t.label), flex: "1 1 120px", minWidth: 0, overflowWrap: "anywhere" }}>{labels.length > 0 ? labels.join(", ") : "Not stated"}</span>
                <ProvenanceDot kind={shown.provenance} viewer="maker" showWord />
              </div>
              {disputed ? <p style={{ margin: 0, ...text(12, 400, t.text2) }}>{`Your reason: ${disputed.reason}`}</p> : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minHeight: 0 }}>
                {from.length > 0 && !disputed ? (
                  <LinkButton label={`Source of ${name}`} phone={phone} onClick={() => onSource?.(from[0])}>
                    Source
                  </LinkButton>
                ) : null}
                {disputable && editing !== facet ? (
                  <LinkButton label={`Dispute ${name}`} phone={phone} onClick={() => setEditing(facet)}>
                    Dispute
                  </LinkButton>
                ) : null}
                {disputed && editing !== facet ? (
                  <LinkButton label={`Undo your change to ${name}`} phone={phone} onClick={() => onDispute(facet, null)}>
                    Undo
                  </LinkButton>
                ) : null}
              </div>
              {editing === facet ? (
                <DisputeForm
                  facet={facet}
                  phone={phone}
                  current={shown.values[0] ?? null}
                  onCancel={() => setEditing(null)}
                  onApply={(value, reason) => {
                    onDispute(facet, { values: [value], reason, at: now() });
                    setEditing(null);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}


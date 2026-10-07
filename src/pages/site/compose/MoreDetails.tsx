/* UI-P48 — More details: everything else, behind one optional line.

   PURE. Values in, edits out; `ComposePage` saves them as it does a title.

   Closed by default. Open, one flat panel: where it broke (two fields that
   make one breakage part), what it costs and how soon it gives a first result
   (three numbers on the build), and a switch that leaves one part open for
   someone else to solve (a gap part). */

import { useId, useState, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { Panel } from "@/components/brand/Panel";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { move } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { Field } from "./composeControls";
import { fieldBase, useRing } from "./composeFields";

export interface ComposeDetails {
  /** "What broke". */
  symptom: string;
  /** "How you fixed it". */
  resolution: string;
  costMonthly: string;
  costSetup: string;
  /** Minutes. */
  firstResult: string;
  gapOn: boolean;
  /** "What's left open?" */
  gapProblem: string;
}

export type ComposeDetailKey = "symptom" | "resolution" | "costMonthly" | "costSetup" | "firstResult" | "gapProblem";

export interface MoreDetailsProps {
  phone: boolean;
  details: ComposeDetails;
  onDetail: (key: ComposeDetailKey, value: string) => void;
  onGapSwitch: (on: boolean) => void;
}

function TextArea({ id, value, placeholder, phone, onChange }: { id: string; value: string; placeholder: string; phone: boolean; onChange: (value: string) => void }) {
  const focus = useRing<HTMLTextAreaElement>();
  return (
    <textarea
      id={id}
      rows={2}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      {...focus.handlers}
      style={{ ...fieldBase, display: "block", padding: "10px 14px", fontSize: phone ? 16 : 15, lineHeight: 1.5, resize: "vertical", ...focus.style }}
    />
  );
}

function NumberField({
  id,
  label,
  value,
  whole,
  phone,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  whole?: boolean;
  phone: boolean;
  onChange: (value: string) => void;
}) {
  const focus = useRing<HTMLInputElement>();
  return (
    <div style={{ flex: "1 1 140px", minWidth: 0 }}>
      <Field id={id} label={label}>
        <input
          id={id}
          type="number"
          inputMode={whole ? "numeric" : "decimal"}
          min={0}
          step={whole ? 1 : "any"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          {...focus.handlers}
          style={{ ...fieldBase, height: phone ? 44 : 40, padding: "0 12px", fontSize: phone ? 16 : 15, ...focus.style }}
        />
      </Field>
    </div>
  );
}

function Switch({ on, label, onChange, phone }: { on: boolean; label: string; onChange: (on: boolean) => void; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      {...handlers}
      style={{
        alignSelf: "flex-start",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        padding: "0 4px",
        margin: "0 -4px",
        border: 0,
        borderRadius: r.control,
        background: "transparent",
        color: t.text,
        fontFamily: FIGTREE,
        fontSize: phone ? 15 : 14,
        textAlign: "left",
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <span
        aria-hidden="true"
        style={{ position: "relative", width: 36, height: 22, borderRadius: 12, background: on ? t.evidence : t.line, flexShrink: 0 }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: 3,
            width: 16,
            height: 16,
            borderRadius: r.full,
            background: t.field,
            transform: on ? "translateX(14px)" : "none",
            transition: move(),
          }}
        />
      </span>
      {label}
    </button>
  );
}

export function MoreDetails({ phone, details, onDetail, onGapSwitch }: MoreDetailsProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const gapRing = useRing<HTMLInputElement>();
  const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Button
        variant="ghost"
        size={phone ? 44 : 38}
        fontSize={14}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => setOpen((value) => !value)}
        style={{ alignSelf: "flex-start", padding: "0 8px", marginLeft: -8, color: t.text, gap: 0 }}
      >
        <span aria-hidden="true" style={{ fontFamily: DM_MONO, color: t.text2, width: 16 }}>
          {open ? "−" : "+"}
        </span>
        More details
        <span style={{ color: t.text2, whiteSpace: "pre" }}> (optional)</span>
      </Button>

      {open ? (
        <div id={`${id}-panel`}>
          <Panel surface="flat" padding={phone ? "16px" : "24px"}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                <legend style={{ padding: 0, marginBottom: 10, fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>Where it broke</legend>
                <div style={row}>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <Field id={`${id}-broke`} label="What broke">
                      <TextArea
                        id={`${id}-broke`}
                        value={details.symptom}
                        placeholder="exiftool: command not found"
                        phone={phone}
                        onChange={(value) => onDetail("symptom", value)}
                      />
                    </Field>
                  </div>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <Field id={`${id}-fixed`} label="How you fixed it">
                      <TextArea
                        id={`${id}-fixed`}
                        value={details.resolution}
                        placeholder="Install it first with brew install exiftool."
                        phone={phone}
                        onChange={(value) => onDetail("resolution", value)}
                      />
                    </Field>
                  </div>
                </div>
              </fieldset>

              <div style={row}>
                <NumberField id={`${id}-monthly`} label="Monthly cost (£)" value={details.costMonthly} phone={phone} onChange={(value) => onDetail("costMonthly", value)} />
                <NumberField id={`${id}-setup`} label="Setup cost (£)" value={details.costSetup} phone={phone} onChange={(value) => onDetail("costSetup", value)} />
                <NumberField
                  id={`${id}-first`}
                  label="First result in (minutes)"
                  value={details.firstResult}
                  whole
                  phone={phone}
                  onChange={(value) => onDetail("firstResult", value)}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Switch on={details.gapOn} label="Leave one part open for someone else to solve" phone={phone} onChange={onGapSwitch} />
                {details.gapOn ? (
                  <>
                    <Field id={`${id}-open`} label="What's left open?">
                      <input
                        id={`${id}-open`}
                        type="text"
                        value={details.gapProblem}
                        autoComplete="off"
                        onChange={(event) => onDetail("gapProblem", event.target.value)}
                        {...gapRing.handlers}
                        style={{ ...fieldBase, height: phone ? 44 : 40, padding: "0 14px", fontSize: phone ? 16 : 15, ...gapRing.style }}
                      />
                    </Field>
                    <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>
                      Readers will see it as one part left open. You can add a reward on Bounties after publishing.
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

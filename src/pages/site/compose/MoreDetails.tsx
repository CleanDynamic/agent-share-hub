/* UI-P48 — More details: everything else, behind one optional line.

   PURE. Values in, edits out; `ComposePage` saves them as it does a title.

   Closed by default. Open, one flat panel: where it broke (two fields that
   make one breakage part), what it costs and how soon it gives a first result
   (three numbers on the build), and a switch that leaves one part open for
   someone else to solve (a gap part).

   THE REFINED LOOK (UI-P94, `refined/{dusk,noon}/composer-card.html`): the line is a disclosure 32 high, a `chev`
   glyph in `--label` (`chevd` when open), "More details" 13/500 and "(optional)" in `--text2` 400. Only the look
   branches. */

import { useId, useState, type CSSProperties } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { Panel } from "@/components/brand/Panel";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { move } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { Field } from "./composeControls";
import { fieldBase, useRing } from "./composeFields";
import { size } from "@/lib/theme/space";

export interface ComposeDetails {
  /** "What broke". */
  symptom: string;
  /** "How you fixed it". */
  resolution: string;
  costMonthly: string;
  costSetup: string;
  /** Minutes. */
  firstResult: string;
  /** UX-07 P6: others can start topics from this build (builds.allow_as_post_source). Absent: on, the default. */
  allowAsTopicSource?: boolean;
}

export type ComposeDetailKey = "symptom" | "resolution" | "costMonthly" | "costSetup" | "firstResult";

export interface MoreDetailsProps {
  phone: boolean;
  details: ComposeDetails;
  onDetail: (key: ComposeDetailKey, value: string) => void;
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
      style={{ ...fieldBase, display: "block", padding: "7px 10px", fontSize: phone ? 16 : 14, lineHeight: 1.5, resize: "vertical", ...focus.style }}
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
          style={{ ...fieldBase, height: phone ? 44 : 33, padding: "0 9px", fontSize: phone ? 16 : 14, ...focus.style }}
        />
      </Field>
    </div>
  );
}

/** UI-P94: the refined disclosure, 32 high (44 on a phone). */
function RefinedDisclosure({ open, controls, phone, onClick }: { open: boolean; controls: string | undefined; phone: boolean; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
      {...handlers}
      style={{
        alignSelf: "flex-start",
        height: phone ? 44 : 32,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0 12px 0 0",
        border: 0,
        borderRadius: 6,
        background: "transparent",
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 500,
        color: t.text,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <Glyph name={open ? "chevd" : "chev"} size={size.icon} color={t.label} />
      More details
      <span style={{ color: t.text2, fontWeight: 400, whiteSpace: "pre" }}> (optional)</span>
    </button>
  );
}

export function MoreDetails({ phone, details, onDetail }: MoreDetailsProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 9 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <RefinedDisclosure open={open} controls={open ? `${id}-panel` : undefined} phone={phone} onClick={() => setOpen((value) => !value)} />

      {open ? (
        <div id={`${id}-panel`}>
          <Panel surface="flat" padding={phone ? "16px" : "24px"}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <fieldset style={{ margin: 0, padding: 0, border: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
                <legend style={{ padding: 0, marginBottom: 7, fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>Where it broke</legend>
                <div style={row}>
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <Field id={`${id}-broke`} label="What broke">
                      <TextArea
                        id={`${id}-broke`}
                        value={details.symptom}
                        placeholder="e.g. exiftool: command not found"
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
                        placeholder="e.g. Install it first with brew install exiftool."
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
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

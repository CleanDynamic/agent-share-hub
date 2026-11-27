/* "What the app added": what the maker can state about a message but not paste. Where it was sent from (an app, an API call, a
   harness by name, or another app by name), whether web search, memory and project files were on, how many earlier messages the
   chat had, and the connectors used (8 at most). The tile shows none of it; the reader's meta line and the copies say it.

   PURE: the saved context in, a patch of `payload.context` out (null takes it off). */

import { useState } from "react";

import { mappedHarnesses } from "@/lib/build/harnessMap";
import { ATTACHMENT_COPY } from "@/lib/build/attachments";
import { CONNECTORS_MAX, EARLIER_MAX, SENT_FROM, SENT_FROM_LABEL, SENT_FROM_NAME_MAX, linesOf, type PromptContext, type SentFrom } from "@/lib/build/tileExtras";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, textStep } from "@/lib/theme/type";
import { space } from "@/lib/theme/space";
import { r } from "@/lib/theme/radius";
import { BlockHead, FieldArea, FieldInput, SegmentedField } from "@/pages/site/compose/modalRecipes";

type Choice = SentFrom | "none";

/** The context in the payload's own key names, ready for `payload.context`; null when nothing is left. */
export function contextPayload(context: PromptContext): Record<string, unknown> | null {
  const out: Record<string, unknown> = {
    ...(context.from ? { from: context.from } : null),
    ...(context.fromName && (context.from === "harness" || context.from === "other") ? { from_name: context.fromName } : null),
    ...(context.webSearch ? { web_search: true } : null),
    ...(context.memory ? { memory: true } : null),
    ...(context.projectFiles ? { project_files: true } : null),
    ...(context.earlier ? { earlier: context.earlier } : null),
    ...(context.connectors?.length ? { connectors: context.connectors } : null),
  };
  return Object.keys(out).length > 0 ? out : null;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: space[2], minHeight: 32, fontFamily: FIGTREE, fontSize: textStep.meta, color: t.text, cursor: "pointer" }}>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function PromptContextFields({ id, context, phone, onSave }: { id: string; context: PromptContext | undefined; phone: boolean; onSave: (next: Record<string, unknown> | null) => void }) {
  const now: PromptContext = context ?? {};
  const [name, setName] = useState(now.fromName ?? "");
  const [earlier, setEarlier] = useState(now.earlier ? String(now.earlier) : "");
  const [connectors, setConnectors] = useState((now.connectors ?? []).join("\n"));
  const save = (patch: Partial<PromptContext>) => onSave(contextPayload({ ...now, ...patch }));
  const harnesses = mappedHarnesses().map((entry) => entry.name);
  const from: Choice = now.from ?? "none";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[3], minWidth: 0 }}>
      <SegmentedField<Choice>
        label={ATTACHMENT_COPY.sentFrom}
        phone={phone}
        scroll
        items={[{ value: "none", label: "Not given" }, ...SENT_FROM.map((value) => ({ value, label: SENT_FROM_LABEL[value] }))]}
        value={from}
        onChange={(value) => save({ from: value === "none" ? undefined : value, fromName: value === "harness" || value === "other" ? name.trim() || undefined : undefined })}
      />
      {from === "harness" ? (
        <label style={{ display: "flex", flexDirection: "column", gap: space[1], fontFamily: FIGTREE, fontSize: textStep.meta, color: t.text2 }}>
          {ATTACHMENT_COPY.fromName}
          <select
            aria-label="Harness"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              save({ fromName: event.target.value || undefined });
            }}
            style={{ height: phone ? 44 : 32, fontFamily: FIGTREE, fontSize: phone ? 16 : textStep.meta, color: t.text, background: t.recess, border: `1px solid ${t.line}`, borderRadius: r.area }}
          >
            <option value="">Not given</option>
            {harnesses.map((harness) => (
              <option key={harness} value={harness}>
                {harness}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {from === "other" ? (
        <FieldInput phone={phone} aria-label={ATTACHMENT_COPY.fromName} maxLength={SENT_FROM_NAME_MAX} value={name} onChange={(event) => setName(event.target.value)} onBlur={() => save({ fromName: name.trim() || undefined })} />
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space[4] }}>
        <Check label={ATTACHMENT_COPY.webSearch} checked={Boolean(now.webSearch)} onChange={(on) => save({ webSearch: on || undefined })} />
        <Check label={ATTACHMENT_COPY.memory} checked={Boolean(now.memory)} onChange={(on) => save({ memory: on || undefined })} />
        <Check label={ATTACHMENT_COPY.projectFiles} checked={Boolean(now.projectFiles)} onChange={(on) => save({ projectFiles: on || undefined })} />
      </div>
      <BlockHead label={ATTACHMENT_COPY.earlier} htmlFor={`earlier-${id}`} />
      <FieldInput
        phone={phone}
        id={`earlier-${id}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={EARLIER_MAX}
        value={earlier}
        onChange={(event) => setEarlier(event.target.value)}
        onBlur={() => {
          const n = Number(earlier);
          save({ earlier: Number.isInteger(n) && n > 0 && n <= EARLIER_MAX ? n : undefined });
        }}
      />
      <BlockHead label={ATTACHMENT_COPY.connectors} htmlFor={`connectors-${id}`} count={ATTACHMENT_COPY.connectorsHint} />
      <FieldArea
        phone={phone}
        id={`connectors-${id}`}
        rows={2}
        value={connectors}
        onChange={(event) => setConnectors(event.target.value)}
        onBlur={() => save({ connectors: [...new Set(linesOf(connectors))].slice(0, CONNECTORS_MAX) })}
      />
    </div>
  );
}

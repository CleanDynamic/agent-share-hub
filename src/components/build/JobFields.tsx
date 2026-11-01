/* SV-28 P3: a job's fields, under Optional fields in the prompt window, for a prompt inside an agent (n.2 onward) only.

   - Deliverable: its kind (sheet, doc, draft, report, message, file, other) and its name, up to 60 characters.
   - Destination: one of the agent's Available tools, or typed text up to 60 characters ("Google Drive, Clients folder").
   - "A person approves before it's delivered": a checkbox.
   Each change is written through `onExtras` (the existing extras writer). */

import { useState } from "react";

import { Checkbox } from "@/components/brand/Checkbox";
import type { Step } from "@/lib/build/graph";
import { DELIVERABLE_KINDS, DELIVERABLE_LABEL, DELIVERABLE_NAME_MAX, DESTINATION_MAX, JOB_COPY, jobLine, type DeliverableKind, type Job } from "@/lib/build/teamFields";
import { t } from "@/lib/theme/tokens";
import { FieldInput, Row } from "@/pages/site/compose/modalRecipes";
import { OptionalField } from "@/pages/site/compose/OptionalSection";
import { PickMenu } from "@/pages/site/compose/PickMenu";

const TYPED = "__typed";
const NONE = "__none";

/** The agent a prompt sits in, or null for a prompt that is no job (top level, or an agent's instructions). */
export function agentOfPrompt(steps: readonly Step[], id: string): Step | null {
  for (const step of steps) {
    const inner = [step, ...step.children];
    for (const candidate of inner) if (candidate.kind === "agent" && candidate.children.some((child) => child.id === id && !child.id.endsWith(":instructions"))) return candidate;
  }
  return null;
}

export function JobFields({ step, agent, names, phone, onExtras }: { step: Step; agent: Step; names: Readonly<Record<string, string>>; phone: boolean; onExtras: (id: string, patch: Record<string, unknown>) => void }) {
  const job: Job = step.job ?? {};
  const tools = (agent.toolRefs ?? []).map((id) => ({ value: id, label: names[id] ?? id }));
  const typedNow = Boolean(job.destination) && !tools.some((tool) => tool.value === job.destination);
  const [name, setName] = useState(job.deliverable?.name ?? "");
  const [typing, setTyping] = useState(typedNow);
  const [typed, setTyped] = useState(typedNow ? (job.destination ?? "") : "");
  const kind = job.deliverable?.kind;
  const nameOf = (destination: string) => names[destination] ?? destination;
  return (
    <OptionalField name={JOB_COPY.deliverable} summary={jobLine(job, nameOf)} phone={phone}>
      <Row id={`job-kind-${step.id}`} label={JOB_COPY.kind} noRule phone={phone}>
        <PickMenu<DeliverableKind | typeof NONE>
          id={`job-kind-${step.id}`}
          label={JOB_COPY.kind}
          options={[...DELIVERABLE_KINDS.map((value) => ({ value, label: DELIVERABLE_LABEL[value] })), { value: NONE, label: "None" }]}
          value={kind ?? NONE}
          placeholder="None"
          phone={phone}
          field
          onChange={(value) => onExtras(step.id, { deliverable: value === NONE ? null : { kind: value, name: name.trim() } })}
        />
      </Row>
      {kind ? (
        <Row id={`job-name-${step.id}`} label={JOB_COPY.name} noRule phone={phone}>
          <FieldInput phone={phone} id={`job-name-${step.id}`} maxLength={DELIVERABLE_NAME_MAX} value={name} placeholder={JOB_COPY.namePlaceholder} onChange={(event) => setName(event.target.value)} onBlur={() => name.trim() !== (job.deliverable?.name ?? "") && onExtras(step.id, { deliverable: { kind, name: name.trim() } })} />
        </Row>
      ) : null}
      <Row id={`job-destination-${step.id}`} label={JOB_COPY.destination} noRule phone={phone}>
        <PickMenu<string>
          id={`job-destination-${step.id}`}
          label={JOB_COPY.destination}
          options={[...tools, { value: TYPED, label: "Somewhere else" }, { value: NONE, label: "None" }]}
          value={typing ? TYPED : (job.destination ?? NONE)}
          placeholder="None"
          phone={phone}
          field
          onChange={(value) => {
            setTyping(value === TYPED);
            if (value !== TYPED) onExtras(step.id, { destination: value === NONE ? null : value });
          }}
        />
      </Row>
      {typing ? (
        <FieldInput phone={phone} aria-label={JOB_COPY.destination} maxLength={DESTINATION_MAX} value={typed} placeholder={JOB_COPY.destinationPlaceholder} onChange={(event) => setTyped(event.target.value)} onBlur={() => typed.trim() !== (job.destination ?? "") && onExtras(step.id, { destination: typed.trim() || null })} />
      ) : null}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.text }}>
        <Checkbox checked={job.needsApproval === true} onChange={(event) => onExtras(step.id, { needs_approval: event.target.checked || null })} />
        {JOB_COPY.approval}
      </label>
    </OptionalField>
  );
}

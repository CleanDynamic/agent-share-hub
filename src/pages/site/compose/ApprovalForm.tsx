/* SV-28 P4: Add > Approval, and an Approval step's own window: the manual step window's form for a gate.

   - What is approved, up to 80 characters ("The client email draft").
   - Who approves: the maker, a reviewer agent (then which agent), the client, or someone on the team. A real radio group.
   - Steps that wait for it: a checklist of the steps numbered after it. An approval added at the end of the build has none yet.
   - Why, optional, up to 120 characters.
   Built from the window's recipes (ModalForm, Block, OptionGrid, FieldInput, Checkbox): no new look. */

import { useState } from "react";

import { Checkbox } from "@/components/brand/Checkbox";
import { stepTitle, type Step } from "@/lib/build/graph";
import { GATE_APPROVES_MAX, GATE_BY, GATE_BY_LABEL, GATE_COPY, GATE_REASON_MAX, type Gate, type GateBy } from "@/lib/build/teamFields";
import { t } from "@/lib/theme/tokens";

import { MODAL_COPY, ModalForm, missingLabels } from "./ModalFrame";
import { Block, BlockHead, FieldInput, OptionGrid } from "./modalRecipes";
import { PickMenu } from "./PickMenu";

export interface ApprovalChoices {
  /** The build's steps, in order. */
  steps: readonly Step[];
  /** The step it goes after (Add), or the Approval step itself (its window); null: it goes at the end. */
  afterId: string | null;
}

/** The steps an approval can hold back: the top-level steps after where it sits, and the agents of a team among them. */
export function blockable(steps: readonly Step[], afterId: string | null, self?: string): Step[] {
  const at = afterId ? steps.findIndex((step) => step.id === afterId) : steps.length - 1;
  return steps.slice(at + 1).filter((step) => step.id !== self);
}

const agentsOf = (steps: readonly Step[]): Step[] => steps.flatMap((step) => (step.kind === "agent" ? [step] : step.kind === "team" ? step.children.filter((child) => child.kind === "agent") : []));

export function ApprovalForm({ choices, gate, self, phone, editing, onSubmit, onCancel }: { choices: ApprovalChoices; gate?: Gate | null; self?: string; phone: boolean; editing: boolean; onSubmit: (gate: Gate) => void; onCancel: () => void }) {
  const [approves, setApproves] = useState(gate?.approves ?? "");
  const [by, setBy] = useState<GateBy>(gate?.by ?? "maker");
  const [reviewer, setReviewer] = useState(gate?.reviewer_agent ?? "");
  const [blocks, setBlocks] = useState<string[]>(gate?.blocks ?? []);
  const [reason, setReason] = useState(gate?.reason ?? "");
  const options = blockable(choices.steps, choices.afterId, self);
  const agents = agentsOf(choices.steps);
  const missing = missingLabels([
    [approves.trim().length > 0, GATE_COPY.approves],
    [by !== "reviewer" || Boolean(reviewer), GATE_COPY.reviewer],
  ]);
  const toggle = (id: string, on: boolean) => setBlocks((now) => (on ? [...now, id] : now.filter((entry) => entry !== id)));
  return (
    <ModalForm
      phone={phone}
      missing={missing}
      onCancel={onCancel}
      addLabel={editing ? MODAL_COPY.save : undefined}
      onSubmit={() =>
        onSubmit({
          approves: approves.trim(),
          by,
          ...(by === "reviewer" && reviewer ? { reviewer_agent: reviewer } : null),
          blocks: blocks.filter((id) => options.some((step) => step.id === id)),
          ...(reason.trim() ? { reason: reason.trim() } : null),
        })
      }
    >
      <Block label={GATE_COPY.approves} noRule>
        <BlockHead label={GATE_COPY.approves} />
        <FieldInput phone={phone} aria-label={GATE_COPY.approves} maxLength={GATE_APPROVES_MAX} value={approves} placeholder={GATE_COPY.approvesPlaceholder} onChange={(event) => setApproves(event.target.value)} />
      </Block>
      <Block label={GATE_COPY.by}>
        <BlockHead label={GATE_COPY.by} />
        <OptionGrid<GateBy> label={GATE_COPY.by} phone={phone} columns={2} items={GATE_BY.map((value) => ({ value, label: GATE_BY_LABEL[value] }))} chosen={[by]} onPick={setBy} />
        {by === "reviewer" ? (
          <PickMenu<string> label={GATE_COPY.reviewer} options={agents.map((agent) => ({ value: agent.id, label: `${agent.number} · ${stepTitle(agent)}` }))} value={reviewer} placeholder="Select an agent" phone={phone} field onChange={setReviewer} />
        ) : null}
      </Block>
      <Block label={GATE_COPY.blocks}>
        <BlockHead label={GATE_COPY.blocks} />
        {options.length === 0 ? (
          <span style={{ fontSize: 12.5, color: t.label }}>No steps come after it yet.</span>
        ) : (
          <div role="group" aria-label={GATE_COPY.blocks} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((step) => (
              <label key={step.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.text }}>
                <Checkbox checked={blocks.includes(step.id)} onChange={(event) => toggle(step.id, event.target.checked)} />
                {`${step.number} · ${stepTitle(step)}`}
              </label>
            ))}
          </div>
        )}
      </Block>
      <Block label={GATE_COPY.reason}>
        <BlockHead label={GATE_COPY.reason} />
        <FieldInput phone={phone} aria-label={GATE_COPY.reason} maxLength={GATE_REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Block>
    </ModalForm>
  );
}

/* UI-P69, CA-15 P7, CA-15b P2: Add › "Agent": a model that runs on its own, with instructions and tools.

   Built from `modalRecipes` as the board "Add an agent" draws it, 560 wide (a `BottomSheet` below 768). Required: a model
   (`setupReady`). Visible:

   - Single agent or Multi-agent team: a real radio group, with the chosen one's line under it. A team is made holding one agent,
     which takes the model too, so the dialog describes the agent that leads it (it is titled for that agent). When the team node
     type is not live (UI-P61's Deploy queue item), "Multi-agent team" is disabled and says why.
   - Name: empty saves as null, so the default "Agent {n}" or "Team {n}" shows.
   - Models: the primary model, and up to three more with their roles (`AgentSetupFields`).

   Then the Optional section, in this order: System instructions, Available tools, Trigger (Manual, Scheduled, Event; Event asks
   for the triggering event), Host platform, Memory, Supporting models, Limits, Output and destination, Sample run (a trace
   link, or a pasted transcript) and, for a team only, Orchestration pattern.

   "Add as an agent" (CA-02 P4) opens it with the tool as the host platform and the prompt's text as the system instructions.
   Nothing here asks for, shows or stores a secret. */

import { useId, useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { TITLE_MAX, WHEN_DETAIL_MAX, firstLineOf, type AgentModel, type Runs } from "@/lib/build/graph";
import type { Helper } from "@/lib/build/helpers";
import { AGENT_PATTERNS, AGENT_PATTERN_LABEL, LIMITS_MAX, LIMIT_LINE_MAX, OUTPUT_MAX, SAMPLE_MAX, linesOf, type AgentPattern } from "@/lib/build/tileExtras";
import { TEAM_INSTRUCTIONS_COPY } from "@/lib/build/teamFields";
import { traceRefusal } from "@/lib/build/trace";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import { startingModel } from "@/lib/tools/modelRules";
import { toolName } from "@/lib/tools/registry";

import { AGENT_SETUP_COPY, savedModels, setupReady, useAgentSetupFields, type AgentSetupValue } from "./AgentSetupFields";
import { ChoiceGrid } from "./ChoiceGrid";
import { HelpersField } from "./HelpersField";
import { MODAL_COPY, ModalForm, ModalShell, missingLabels, type EditMode } from "./ModalFrame";
import { Block, FieldArea, FieldInput, Hint, MODAL_WIDTH, Row, SegmentedField } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";

export const AGENT_DIALOG_COPY = {
  title: "Add an agent",
  /** CA-02 P5: a team is led by its first agent, which this dialog describes. */
  leadTitle: "The agent that leads the team",
  subtitle: "Autonomous model with instructions and tools",
  one: "Single agent",
  oneLine: "Autonomous model with instructions and tools",
  team: "Multi-agent team",
  teamsMissing: "Not available yet",
  add: "Add",
  cancel: "Cancel",
  name: "Name",
  /** CA-12 P11. */
  instructions: "System instructions",
  instructionsPlaceholder: "Every Monday, write this week's menu from what is in stock",
  starts: "Trigger",
  schedule: "Schedule",
  schedulePlaceholder: "Weekdays 07:30",
  event: "Triggering event",
  eventPlaceholder: "A new email arrives",
  limits: "Limits",
  limitsLine: "Steps, budget, run time, prohibited actions",
  limitsPlaceholder: "One per line",
  output: "Output and destination",
  outputLine: "Format and destination",
  outputPlaceholder: "Menu document in the shared drive",
  sample: "Sample run",
  sampleLine: "Transcript or trace of one run",
  trace: "Trace link",
  transcript: "Sample transcript",
  transcriptPlaceholder: "User: Summarise today's orders\nAgent: Three orders came in ...",
  pattern: "Orchestration pattern",
  patternLine: "Sequential, lead and delegates, parallel then merge, writer and reviewer",
  patternCount: "Multi-agent only",
  memoryLine: "Stored between runs, and where",
  toolsLine: "Apps the agent can call",
  helpersLine: "Models that summarise history or extract fields",
} as const;

/** CA-12 P11, CA-15 P7: how an agent starts, in the words the dialog asks it. "ask" is stored as no `runs` at all. */
export const START_CHOICES: readonly { value: "ask" | "schedule" | "event"; label: string }[] = [
  { value: "ask", label: "Manual" },
  { value: "schedule", label: "Scheduled" },
  { value: "event", label: "Event" },
];

export interface AddAgentInput {
  kind: "agent" | "team";
  /** Null when left empty: the default title shows. */
  name: string | null;
  model: string;
  /** CA-02 P4: the system instructions, when the dialog was opened by "Add as an agent" or the maker wrote them. */
  instructions?: string;
  /** CA-02 P5: the harness, as an id or typed; null when it names none. */
  harness: string | null;
  /** SV-27: Built in code (no harness); absent with no harness is Not sure. */
  builtInCode?: boolean;
  /** CA-02 P5: every model with its role, the main one first; only when there is more than one. */
  models?: AgentModel[];
  /** CA-02 P5: the tools it can use, as ids or typed names. */
  tools: string[];
  /** CA-03 P6: its memory; only when it says. */
  memory?: string;
  /** CA-12 P11: how it starts; absent for "Manual". */
  runs?: Runs;
  /** CA-13 P6: the supporting models it used. For a team, they go to the agent that leads it. */
  helpers?: Helper[];
  /** CA-15 P7: what it must not do, one per entry. */
  limits?: string[];
  /** CA-15 P7: what it produces and where that goes. */
  output?: string;
  /** CA-15 P7: a pasted transcript of one run. */
  sample?: string;
  /** CA-15 P7: a trace link (https only). */
  traceUrl?: string;
  /** CA-15 P7: a team's orchestration pattern; never given for a single agent. */
  pattern?: AgentPattern;
}

/** CA-02 P4: what "Add as an agent" opens the dialog with. */
export interface AgentSeed {
  harness: string | null;
  instructions: string;
}

/** CA-18: what the form starts with on an agent or a team that is there. */
export interface AgentCurrent {
  kind: "agent" | "team";
  name: string;
  setup: AgentSetupValue;
  instructions: string;
  limits: string[];
  output: string;
  trace: string;
  transcript: string;
  pattern: AgentPattern | null;
  helpers: Helper[];
}

export interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The number the new step will take, for the placeholder ("Agent 4"). */
  nextNumber: number;
  /** False while the `team` node type is not live. */
  teamsAvailable: boolean;
  onAdd?: (input: AddAgentInput) => void;
  /** CA-02 P4: set when "Add as an agent" opened the dialog. */
  seed?: AgentSeed | null;
  /** The tools the build already uses, first in the pickers. */
  inBuild?: readonly string[];
  /** CA-18: an agent or a team that is there. */
  current?: AgentCurrent | null;
  edit?: EditMode<AddAgentInput>;
}

/** The model a new agent starts on. */
export const DEFAULT_AGENT_MODEL = MODEL_VERSIONS[0].name;

/** Where a new agent starts: its host from "Add as an agent", else none, on the model that host offers. */
function firstSetup(seed: AgentSeed | null | undefined): AgentSetupValue {
  const harness = seed?.harness ?? null;
  return { harness, models: [{ model: startingModel(harness, DEFAULT_AGENT_MODEL), role: "main" }], tools: [] };
}

function Form({
  nextNumber,
  teamsAvailable,
  onAdd,
  onCancel,
  phone,
  seed,
  inBuild = [],
  onKind,
  current,
  edit,
}: Pick<AddAgentDialogProps, "nextNumber" | "teamsAvailable" | "onAdd" | "seed" | "inBuild" | "current" | "edit"> & { onCancel: () => void; phone: boolean; onKind: (kind: "agent" | "team") => void }) {
  const [kind, setKind] = useState<"agent" | "team">(current?.kind ?? "agent");
  const [name, setName] = useState(current?.name ?? "");
  const [setup, setSetup] = useState<AgentSetupValue>(() => current?.setup ?? firstSetup(seed));
  const [instructions, setInstructions] = useState(current?.instructions ?? seed?.instructions ?? "");
  const [start, setStart] = useState<"ask" | "schedule" | "event">("ask");
  const [startDetail, setStartDetail] = useState("");
  const [helpers, setHelpers] = useState<Helper[]>(current?.helpers ?? []);
  const [limits, setLimits] = useState((current?.limits ?? []).join("\n"));
  const [output, setOutput] = useState(current?.output ?? "");
  const [trace, setTrace] = useState(current?.trace ?? "");
  const [transcript, setTranscript] = useState(current?.transcript ?? "");
  const [pattern, setPattern] = useState<AgentPattern | null>(current?.pattern ?? null);
  /** A team has no model, instructions, tools or notes of its own: only a name, how it runs and its pattern. */
  const team = kind === "team" && Boolean(edit);
  const [tried, setTried] = useState(false);
  const uid = useId();
  const ready = setupReady(setup);
  const parts = useAgentSetupFields({ value: setup, onChange: setSetup, phone, inBuild, dialog: true, bare: true });
  const limitLines = linesOf(limits);
  const why = traceRefusal(trace) ?? (limitLines.length > LIMITS_MAX ? `Limits: ${LIMITS_MAX} max, one per line` : limitLines.some((line) => line.length > LIMIT_LINE_MAX) ? `Each limit: ${LIMIT_LINE_MAX} characters max` : null);
  const toolNames = setup.tools.map((tool) => toolName(tool) ?? tool);

  const choose = (next: "agent" | "team") => {
    setKind(next);
    onKind(next);
  };
  const draftInput: AddAgentInput = {
    kind,
    name: name.trim() || null,
    ...savedModels(setup),
    harness: setup.harness,
    ...(!setup.harness && setup.builtInCode ? { builtInCode: true } : null),
    tools: setup.tools,
    ...(instructions.trim() ? { instructions } : null),
    ...(start !== "ask" ? { runs: { how: start, ...(startDetail.trim() ? { detail: startDetail.trim() } : null) } as Runs } : null),
    ...(setup.memory?.trim() ? { memory: setup.memory.trim() } : null),
    ...(helpers.length ? { helpers } : null),
    ...(limitLines.length ? { limits: limitLines } : null),
    ...(output.trim() ? { output: output.trim() } : null),
    ...(transcript.trim() ? { sample: transcript.trim() } : null),
    ...(trace.trim() ? { traceUrl: trace.trim() } : null),
    ...(kind === "team" && pattern ? { pattern } : null),
  };
  const submit = () => {
    setTried(true);
    if (!(ready || team) || why) return;
    if (edit) edit.onSave(draftInput);
    else onAdd?.(draftInput);
  };

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={missingLabels([[ready || team, "Models"]])} addLabel={edit ? MODAL_COPY.save : undefined} alert={tried ? why : null}>
      {edit?.before ? edit.before(draftInput) : null}
      {edit ? null : (
      <Block noRule>
        <SegmentedField<"agent" | "team">
          label="Type"
          phone={phone}
          value={kind}
          onChange={choose}
          items={[
            { value: "agent", label: AGENT_DIALOG_COPY.one },
            { value: "team", label: AGENT_DIALOG_COPY.team, disabled: !teamsAvailable },
          ]}
        />
        {!teamsAvailable ? <Hint>{AGENT_DIALOG_COPY.teamsMissing}</Hint> : null}
      </Block>
      )}

      <Row id={`${uid}-name`} label={AGENT_DIALOG_COPY.name} phone={phone} noRule={Boolean(edit)}>
        <FieldInput phone={phone} id={`${uid}-name`} value={name} maxLength={TITLE_MAX} placeholder={`${kind === "team" ? "Team" : "Agent"} ${nextNumber}`} onChange={(event) => setName(event.target.value)} />
      </Row>

      {team ? null : parts.models}

      <OptionalSection>
        {/* SV-28 P1: a team's window edits the team's own instructions, which every agent in it follows; `{name}` variables allowed. */}
        <OptionalField name={team ? TEAM_INSTRUCTIONS_COPY.label : AGENT_DIALOG_COPY.instructions} summary={summaryOf(firstLineOf(instructions, 120))} phone={phone}>
          <FieldArea phone={phone} rows={4} aria-label={team ? TEAM_INSTRUCTIONS_COPY.label : AGENT_DIALOG_COPY.instructions} value={instructions} placeholder={team ? TEAM_INSTRUCTIONS_COPY.placeholder : AGENT_DIALOG_COPY.instructionsPlaceholder} onChange={(event) => setInstructions(event.target.value)} />
        </OptionalField>

        {team ? null : (
        <OptionalField name="Available tools" description={AGENT_DIALOG_COPY.toolsLine} summary={summaryOf(toolNames)} phone={phone}>
          {parts.tools}
        </OptionalField>
        )}

        <OptionalField name={AGENT_DIALOG_COPY.starts} summary={edit ? (edit.slots?.startsSummary as string | null) ?? null : start === "ask" ? null : summaryOf(START_CHOICES.find((choice) => choice.value === start)?.label, startDetail)} phone={phone}>
          {edit?.slots?.starts ? edit.slots.starts : <SegmentedField label={AGENT_DIALOG_COPY.starts} phone={phone} value={start} onChange={(next) => setStart(next)} items={START_CHOICES} />}
          {!edit && start !== "ask" ? (
            <FieldInput
              phone={phone}
              aria-label={start === "event" ? AGENT_DIALOG_COPY.event : AGENT_DIALOG_COPY.schedule}
              value={startDetail}
              maxLength={WHEN_DETAIL_MAX}
              placeholder={start === "event" ? AGENT_DIALOG_COPY.eventPlaceholder : AGENT_DIALOG_COPY.schedulePlaceholder}
              onChange={(event) => setStartDetail(event.target.value)}
            />
          ) : null}
        </OptionalField>

        {team ? null : (
        <OptionalField name={AGENT_SETUP_COPY.runsIn} summary={summaryOf(setup.harness ? (toolName(setup.harness) ?? setup.harness) : setup.builtInCode ? AGENT_SETUP_COPY.ownCode : null)} phone={phone}>
          {parts.host}
        </OptionalField>
        )}

        {team ? null : (
        <OptionalField name="Memory" description={AGENT_DIALOG_COPY.memoryLine} summary={summaryOf(setup.memory)} phone={phone}>
          {parts.memory}
          {edit?.slots?.memory}
        </OptionalField>
        )}

        {team || edit ? null : (
        <OptionalField name="Helpers" description={AGENT_DIALOG_COPY.helpersLine} summary={helpers.length ? `${helpers.length} ${helpers.length === 1 ? "helper" : "helpers"}` : null} phone={phone}>
          <HelpersField helpers={helpers} toolNames={toolNames} decisions={[]} phone={phone} onChange={setHelpers} bare />
        </OptionalField>
        )}

        {team ? null : (
        <OptionalField name={AGENT_DIALOG_COPY.limits} description={AGENT_DIALOG_COPY.limitsLine} summary={summaryOf(limitLines)} phone={phone}>
          <FieldArea phone={phone} rows={3} aria-label={AGENT_DIALOG_COPY.limits} value={limits} placeholder={AGENT_DIALOG_COPY.limitsPlaceholder} onChange={(event) => setLimits(event.target.value)} />
        </OptionalField>
        )}

        {team ? null : (
        <OptionalField name={AGENT_DIALOG_COPY.output} description={AGENT_DIALOG_COPY.outputLine} summary={summaryOf(output)} phone={phone}>
          <FieldInput phone={phone} aria-label={AGENT_DIALOG_COPY.output} maxLength={OUTPUT_MAX} value={output} placeholder={AGENT_DIALOG_COPY.outputPlaceholder} onChange={(event) => setOutput(event.target.value)} />
        </OptionalField>
        )}

        {team ? null : (
        <OptionalField name={AGENT_DIALOG_COPY.sample} description={AGENT_DIALOG_COPY.sampleLine} summary={summaryOf(trace, transcript ? firstLineOf(transcript, 80) : null)} phone={phone}>
          {edit ? null : <FieldInput phone={phone} aria-label={AGENT_DIALOG_COPY.trace} inputMode="url" value={trace} onChange={(event) => setTrace(event.target.value)} />}
          <FieldArea phone={phone} rows={4} mono aria-label={AGENT_DIALOG_COPY.transcript} maxLength={SAMPLE_MAX} value={transcript} placeholder={AGENT_DIALOG_COPY.transcriptPlaceholder} onChange={(event) => setTranscript(event.target.value)} />
          <Hint>Key names only, not values</Hint>
        </OptionalField>
        )}

        {kind === "team" ? (
          <OptionalField name={AGENT_DIALOG_COPY.pattern} description={AGENT_DIALOG_COPY.patternLine} titleCount={AGENT_DIALOG_COPY.patternCount} summary={pattern ? AGENT_PATTERN_LABEL[pattern] : null} phone={phone}>
            <ChoiceGrid<AgentPattern> label={AGENT_DIALOG_COPY.pattern} items={AGENT_PATTERNS.map((value) => ({ value, label: AGENT_PATTERN_LABEL[value] }))} value={pattern} onChange={setPattern} phone={phone} columns={2} allowClear />
          </OptionalField>
        ) : null}
      </OptionalSection>
      {edit?.after ? edit.after(draftInput) : null}
    </ModalForm>
  );
}

export function AddAgentDialog({ open, onOpenChange, nextNumber, teamsAvailable, onAdd, seed = null, inBuild = [], current = null, edit }: AddAgentDialogProps) {
  const phone = useIsPhone();
  const [kind, setKind] = useState<"agent" | "team">("agent");
  const title = kind === "team" ? AGENT_DIALOG_COPY.leadTitle : AGENT_DIALOG_COPY.title;
  const openChange = (next: boolean) => {
    if (!next) setKind("agent");
    onOpenChange(next);
  };
  const close = () => openChange(false);
  const add = (input: AddAgentInput) => {
    onAdd?.(input);
    close();
  };
  // Each opening starts clean: the shell mounts its form only while open.
  return (
    <ModalShell open={open} onOpenChange={openChange} title={edit ? edit.title : title} eyebrow={edit ? MODAL_COPY.edit : undefined} subtitle={AGENT_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId={edit ? "edit-agent-dialog" : "add-agent-dialog"}>
      <Form nextNumber={nextNumber} teamsAvailable={teamsAvailable} onAdd={add} onCancel={close} phone={phone} seed={seed} inBuild={inBuild} onKind={setKind} current={current} edit={edit && { ...edit, onSave: (input) => { edit.onSave(input); close(); } }} />
    </ModalShell>
  );
}

export default AddAgentDialog;

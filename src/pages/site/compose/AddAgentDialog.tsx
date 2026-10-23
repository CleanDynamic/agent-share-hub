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
import { traceRefusal } from "@/lib/build/trace";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import { startingModel } from "@/lib/tools/modelRules";
import { toolName } from "@/lib/tools/registry";

import { savedModels, setupReady, useAgentSetupFields, type AgentSetupValue } from "./AgentSetupFields";
import { ChoiceGrid } from "./ChoiceGrid";
import { HelpersField } from "./HelpersField";
import { ModalForm, ModalShell, firstMissing } from "./ModalFrame";
import { Block, FieldArea, FieldInput, Hint, MODAL_WIDTH, Row, SegmentedField } from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";

export const AGENT_DIALOG_COPY = {
  title: "Add an agent",
  /** CA-02 P5: a team is led by its first agent, which this dialog describes. */
  leadTitle: "The agent that leads the team",
  subtitle: "A model that runs on its own, with instructions and tools",
  one: "Single agent",
  oneLine: "A model that runs on its own, with instructions and tools",
  team: "Multi-agent team",
  teamLine: "Several agents working together",
  teamsMissing: "Teams need the Deploy queue item from UI-P61.",
  add: "Add",
  cancel: "Cancel",
  name: "Name",
  /** CA-12 P11. */
  instructions: "System instructions",
  instructionsLine: "What the agent is told to do",
  instructionsPlaceholder: "e.g. Every Monday, write this week's menu from what is in stock",
  starts: "Trigger",
  startsLine: "Manual, scheduled, or started by an event",
  schedule: "Schedule",
  schedulePlaceholder: "e.g. Weekdays 07:30",
  event: "Triggering event",
  eventPlaceholder: "e.g. A new email arrives",
  limits: "Limits",
  limitsLine: "Maximum steps, budget or run time, approvals and prohibited actions",
  limitsPlaceholder: "One limit per line",
  output: "Output and destination",
  outputLine: "A file, a message or a pull request, and where it is delivered",
  outputPlaceholder: "e.g. A menu document saved to the shared drive",
  sample: "Sample run",
  sampleLine: "A transcript or trace of one real run",
  trace: "Trace link",
  tracePlaceholder: "Link to a transcript or trace",
  transcript: "Sample transcript",
  transcriptPlaceholder: "e.g. User: Summarise today's orders\nAgent: Three orders came in ...",
  pattern: "Orchestration pattern",
  patternLine: "Sequential, lead with delegates, parallel then merged, or writer and reviewer",
  patternCount: "Multi-agent only",
  patternShown: "Shown when Multi-agent team is selected.",
  memoryLine: "What the agent keeps between runs, and where",
  toolsLine: "Applications the agent can call",
  hostLine: "Where the agent runs",
  helpersLine: "Models that summarise history or extract fields for the agent",
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
  /** CA-02 P5: the host platform, as an id or typed; null for its maker's own code. */
  harness: string | null;
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

export interface AddAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The number the new step will take, for the placeholder ("Agent 4"). */
  nextNumber: number;
  /** False while the `team` node type is not live. */
  teamsAvailable: boolean;
  onAdd: (input: AddAgentInput) => void;
  /** CA-02 P4: set when "Add as an agent" opened the dialog. */
  seed?: AgentSeed | null;
  /** The tools the build already uses, first in the pickers. */
  inBuild?: readonly string[];
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
}: Pick<AddAgentDialogProps, "nextNumber" | "teamsAvailable" | "onAdd" | "seed" | "inBuild"> & { onCancel: () => void; phone: boolean; onKind: (kind: "agent" | "team") => void }) {
  const [kind, setKind] = useState<"agent" | "team">("agent");
  const [name, setName] = useState("");
  const [setup, setSetup] = useState<AgentSetupValue>(() => firstSetup(seed));
  const [instructions, setInstructions] = useState(seed?.instructions ?? "");
  const [start, setStart] = useState<"ask" | "schedule" | "event">("ask");
  const [startDetail, setStartDetail] = useState("");
  const [helpers, setHelpers] = useState<Helper[]>([]);
  const [limits, setLimits] = useState("");
  const [output, setOutput] = useState("");
  const [trace, setTrace] = useState("");
  const [transcript, setTranscript] = useState("");
  const [pattern, setPattern] = useState<AgentPattern | null>(null);
  const [tried, setTried] = useState(false);
  const uid = useId();
  const ready = setupReady(setup);
  const parts = useAgentSetupFields({ value: setup, onChange: setSetup, phone, inBuild, dialog: true, bare: true });
  const limitLines = linesOf(limits);
  const why = traceRefusal(trace) ?? (limitLines.length > LIMITS_MAX ? `Limits are at most ${LIMITS_MAX}, one per line.` : limitLines.some((line) => line.length > LIMIT_LINE_MAX) ? `A limit is at most ${LIMIT_LINE_MAX} characters.` : null);
  const toolNames = setup.tools.map((tool) => toolName(tool) ?? tool);

  const choose = (next: "agent" | "team") => {
    setKind(next);
    onKind(next);
  };
  const submit = () => {
    setTried(true);
    if (!ready || why) return;
    onAdd({
      kind,
      name: name.trim() || null,
      ...savedModels(setup),
      harness: setup.harness,
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
    });
  };

  return (
    <ModalForm phone={phone} onSubmit={submit} onCancel={onCancel} missing={firstMissing([[ready, "a model"]])} alert={tried ? why : null}>
      <Block noRule>
        <SegmentedField<"agent" | "team">
          label="What to add"
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

      <Row id={`${uid}-name`} label={AGENT_DIALOG_COPY.name} phone={phone}>
        <FieldInput phone={phone} id={`${uid}-name`} value={name} maxLength={TITLE_MAX} placeholder={`${kind === "team" ? "Team" : "Agent"} ${nextNumber}`} onChange={(event) => setName(event.target.value)} />
      </Row>

      {parts.models}

      <OptionalSection>
        <OptionalField name={AGENT_DIALOG_COPY.instructions} description={AGENT_DIALOG_COPY.instructionsLine} summary={summaryOf(firstLineOf(instructions, 120))} phone={phone}>
          <FieldArea phone={phone} rows={4} aria-label={AGENT_DIALOG_COPY.instructions} value={instructions} placeholder={AGENT_DIALOG_COPY.instructionsPlaceholder} onChange={(event) => setInstructions(event.target.value)} />
        </OptionalField>

        <OptionalField name="Available tools" description={AGENT_DIALOG_COPY.toolsLine} summary={summaryOf(toolNames)} phone={phone}>
          {parts.tools}
        </OptionalField>

        <OptionalField name={AGENT_DIALOG_COPY.starts} description={AGENT_DIALOG_COPY.startsLine} summary={start === "ask" ? null : summaryOf(START_CHOICES.find((choice) => choice.value === start)?.label, startDetail)} phone={phone}>
          <SegmentedField label={AGENT_DIALOG_COPY.starts} phone={phone} value={start} onChange={(next) => setStart(next)} items={START_CHOICES} />
          {start !== "ask" ? (
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

        <OptionalField name="Host platform" description={AGENT_DIALOG_COPY.hostLine} summary={summaryOf(setup.harness ? (toolName(setup.harness) ?? setup.harness) : null)} phone={phone}>
          {parts.host}
        </OptionalField>

        <OptionalField name="Memory" description={AGENT_DIALOG_COPY.memoryLine} summary={summaryOf(setup.memory)} phone={phone}>
          {parts.memory}
        </OptionalField>

        <OptionalField name="Supporting models" description={AGENT_DIALOG_COPY.helpersLine} summary={helpers.length ? `${helpers.length} ${helpers.length === 1 ? "supporting model" : "supporting models"}` : null} phone={phone}>
          <HelpersField helpers={helpers} toolNames={toolNames} decisions={[]} phone={phone} onChange={setHelpers} bare />
        </OptionalField>

        <OptionalField name={AGENT_DIALOG_COPY.limits} description={AGENT_DIALOG_COPY.limitsLine} summary={summaryOf(limitLines)} phone={phone}>
          <FieldArea phone={phone} rows={3} aria-label={AGENT_DIALOG_COPY.limits} value={limits} placeholder={AGENT_DIALOG_COPY.limitsPlaceholder} onChange={(event) => setLimits(event.target.value)} />
        </OptionalField>

        <OptionalField name={AGENT_DIALOG_COPY.output} description={AGENT_DIALOG_COPY.outputLine} summary={summaryOf(output)} phone={phone}>
          <FieldInput phone={phone} aria-label={AGENT_DIALOG_COPY.output} maxLength={OUTPUT_MAX} value={output} placeholder={AGENT_DIALOG_COPY.outputPlaceholder} onChange={(event) => setOutput(event.target.value)} />
        </OptionalField>

        <OptionalField name={AGENT_DIALOG_COPY.sample} description={AGENT_DIALOG_COPY.sampleLine} summary={summaryOf(trace, transcript ? firstLineOf(transcript, 80) : null)} phone={phone}>
          <FieldInput phone={phone} aria-label={AGENT_DIALOG_COPY.trace} inputMode="url" value={trace} placeholder={AGENT_DIALOG_COPY.tracePlaceholder} onChange={(event) => setTrace(event.target.value)} />
          <FieldArea phone={phone} rows={4} mono aria-label={AGENT_DIALOG_COPY.transcript} maxLength={SAMPLE_MAX} value={transcript} placeholder={AGENT_DIALOG_COPY.transcriptPlaceholder} onChange={(event) => setTranscript(event.target.value)} />
          <Hint>Leave out anything secret. Name a key, never paste its value.</Hint>
        </OptionalField>

        {kind === "team" ? (
          <OptionalField name={AGENT_DIALOG_COPY.pattern} description={AGENT_DIALOG_COPY.patternLine} titleCount={AGENT_DIALOG_COPY.patternCount} summary={pattern ? AGENT_PATTERN_LABEL[pattern] : null} phone={phone}>
            <ChoiceGrid<AgentPattern> label={AGENT_DIALOG_COPY.pattern} items={AGENT_PATTERNS.map((value) => ({ value, label: AGENT_PATTERN_LABEL[value] }))} value={pattern} onChange={setPattern} phone={phone} columns={2} allowClear />
          </OptionalField>
        ) : null}
      </OptionalSection>
    </ModalForm>
  );
}

export function AddAgentDialog({ open, onOpenChange, nextNumber, teamsAvailable, onAdd, seed = null, inBuild = [] }: AddAgentDialogProps) {
  const phone = useIsPhone();
  const [kind, setKind] = useState<"agent" | "team">("agent");
  const title = kind === "team" ? AGENT_DIALOG_COPY.leadTitle : AGENT_DIALOG_COPY.title;
  const openChange = (next: boolean) => {
    if (!next) setKind("agent");
    onOpenChange(next);
  };
  const close = () => openChange(false);
  const add = (input: AddAgentInput) => {
    onAdd(input);
    close();
  };
  // Each opening starts clean: the shell mounts its form only while open.
  return (
    <ModalShell open={open} onOpenChange={openChange} title={title} subtitle={AGENT_DIALOG_COPY.subtitle} width={MODAL_WIDTH.standard} testId="add-agent-dialog">
      <Form nextNumber={nextNumber} teamsAvailable={teamsAvailable} onAdd={add} onCancel={close} phone={phone} seed={seed} inBuild={inBuild} onKind={setKind} />
    </ModalShell>
  );
}

export default AddAgentDialog;

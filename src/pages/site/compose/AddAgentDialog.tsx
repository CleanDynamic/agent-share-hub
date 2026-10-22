/* UI-P69, CA-15 P7 — Add › "Agent": a model that runs on its own, with instructions and tools.

   The shared modal frame, 520 wide (a `BottomSheet` below 768). Required: a model (`setupReady`). Visible:

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

import { Segmented } from "@/components/brand/Segmented";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { TITLE_MAX, WHEN_DETAIL_MAX, firstLineOf, type AgentModel, type Runs } from "@/lib/build/graph";
import type { Helper } from "@/lib/build/helpers";
import { AGENT_PATTERNS, AGENT_PATTERN_LABEL, LIMITS_MAX, LIMIT_LINE_MAX, OUTPUT_MAX, SAMPLE_MAX, linesOf, type AgentPattern } from "@/lib/build/tileExtras";
import { traceRefusal } from "@/lib/build/trace";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import { startingModel } from "@/lib/tools/modelRules";
import { toolName } from "@/lib/tools/registry";
import { t } from "@/lib/theme/tokens";

import { savedModels, setupReady, useAgentSetupFields, type AgentSetupValue } from "./AgentSetupFields";
import { ChoiceGrid } from "./ChoiceGrid";
import { Field } from "./composeControls";
import { HelpersField } from "./HelpersField";
import { FieldRow, FieldRows, Hint, ModalForm, ModalShell, firstMissing } from "./ModalFrame";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { text, tnum, typedArea, typedField } from "./refinedStyles";

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
  instructionsPlaceholder: "e.g. Triage the inbox and draft a reply to each message",
  starts: "Trigger",
  startsLine: "How a run begins",
  schedule: "Schedule",
  schedulePlaceholder: "e.g. Weekdays 07:30",
  event: "Triggering event",
  eventPlaceholder: "e.g. A new email arrives",
  limits: "Limits",
  limitsLine: "What it must not do, one per line",
  limitsPlaceholder: "e.g. Never sends email without approval\nStops after 20 steps",
  output: "Output and destination",
  outputLine: "What it produces and where that goes",
  outputPlaceholder: "e.g. A weekly summary posted to the team's Slack channel",
  sample: "Sample run",
  sampleLine: "A trace link, or a pasted transcript of one run",
  trace: "Trace link",
  tracePlaceholder: "e.g. https://smith.langchain.com/o/example/runs/1",
  transcript: "Sample transcript",
  transcriptPlaceholder: "e.g. User: Summarise today's orders\nAgent: Three orders came in ...",
  pattern: "Orchestration pattern",
  patternLine: "How the agents in the team work together",
  memoryLine: "What it remembers between runs",
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
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Segmented
          label="What to add"
          semantics="radio"
          size={phone ? 50 : 30}
          fullWidth
          value={kind}
          onChange={(next) => choose(next)}
          items={[
            { value: "agent", label: AGENT_DIALOG_COPY.one },
            { value: "team", label: AGENT_DIALOG_COPY.team, disabled: !teamsAvailable },
          ]}
        />
        <span style={text(12, 400, t.text2)}>{!teamsAvailable ? AGENT_DIALOG_COPY.teamsMissing : kind === "team" ? AGENT_DIALOG_COPY.teamLine : AGENT_DIALOG_COPY.oneLine}</span>
      </div>

      <FieldRows>
        <FieldRow id={`${uid}-name`} label={AGENT_DIALOG_COPY.name} phone={phone}>
          <input id={`${uid}-name`} type="text" value={name} maxLength={TITLE_MAX} placeholder={`${kind === "team" ? "Team" : "Agent"} ${nextNumber}`} onChange={(event) => setName(event.target.value)} style={typedField(phone)} />
        </FieldRow>
      </FieldRows>

      {parts.models}

      <OptionalSection>
        <OptionalField name={AGENT_DIALOG_COPY.instructions} description={AGENT_DIALOG_COPY.instructionsLine} summary={summaryOf(firstLineOf(instructions, 120))} phone={phone}>
          <textarea aria-label={AGENT_DIALOG_COPY.instructions} rows={6} value={instructions} placeholder={AGENT_DIALOG_COPY.instructionsPlaceholder} onChange={(event) => setInstructions(event.target.value)} style={typedArea(phone, { resize: "vertical" })} />
        </OptionalField>

        <OptionalField name="Available tools" description="The applications it could call" summary={summaryOf(toolNames)} phone={phone}>
          {parts.tools}
        </OptionalField>

        <OptionalField name={AGENT_DIALOG_COPY.starts} description={AGENT_DIALOG_COPY.startsLine} summary={start === "ask" ? null : summaryOf(START_CHOICES.find((choice) => choice.value === start)?.label, startDetail)} phone={phone}>
          <Segmented
            label={AGENT_DIALOG_COPY.starts}
            semantics="radio"
            size={phone ? 50 : 30}
            fullWidth
            value={start}
            onChange={(next) => setStart(next)}
            items={START_CHOICES.map((choice) => ({ value: choice.value, label: choice.label }))}
          />
          {start !== "ask" ? (
            <input
              type="text"
              aria-label={start === "event" ? AGENT_DIALOG_COPY.event : AGENT_DIALOG_COPY.schedule}
              value={startDetail}
              maxLength={WHEN_DETAIL_MAX}
              placeholder={start === "event" ? AGENT_DIALOG_COPY.eventPlaceholder : AGENT_DIALOG_COPY.schedulePlaceholder}
              onChange={(event) => setStartDetail(event.target.value)}
              style={typedField(phone)}
            />
          ) : null}
        </OptionalField>

        <OptionalField name="Host platform" description="The tool or framework it ran on" summary={summaryOf(setup.harness ? (toolName(setup.harness) ?? setup.harness) : null)} phone={phone}>
          {parts.host}
        </OptionalField>

        <OptionalField name="Memory" description={AGENT_DIALOG_COPY.memoryLine} summary={summaryOf(setup.memory)} phone={phone}>
          {parts.memory}
        </OptionalField>

        <OptionalField name="Supporting models" description="Smaller models that kept it on track" summary={helpers.length ? `${helpers.length} ${helpers.length === 1 ? "supporting model" : "supporting models"}` : null} phone={phone}>
          <HelpersField helpers={helpers} toolNames={toolNames} decisions={[]} phone={phone} onChange={setHelpers} bare />
        </OptionalField>

        <OptionalField name={AGENT_DIALOG_COPY.limits} description={AGENT_DIALOG_COPY.limitsLine} summary={summaryOf(limitLines)} phone={phone}>
          <textarea aria-label={AGENT_DIALOG_COPY.limits} rows={3} value={limits} placeholder={AGENT_DIALOG_COPY.limitsPlaceholder} onChange={(event) => setLimits(event.target.value)} style={typedArea(phone)} />
        </OptionalField>

        <OptionalField name={AGENT_DIALOG_COPY.output} description={AGENT_DIALOG_COPY.outputLine} summary={summaryOf(output)} phone={phone}>
          <textarea aria-label={AGENT_DIALOG_COPY.output} rows={2} maxLength={OUTPUT_MAX} value={output} placeholder={AGENT_DIALOG_COPY.outputPlaceholder} onChange={(event) => setOutput(event.target.value)} style={typedArea(phone)} />
          <span style={{ ...text(11.5, 400, t.text2), ...tnum, alignSelf: "flex-end" }}>
            {output.length} / {OUTPUT_MAX}
          </span>
        </OptionalField>

        <OptionalField name={AGENT_DIALOG_COPY.sample} description={AGENT_DIALOG_COPY.sampleLine} summary={summaryOf(trace, transcript ? firstLineOf(transcript, 80) : null)} phone={phone}>
          <Field id={`${uid}-trace`} label={AGENT_DIALOG_COPY.trace}>
            <input id={`${uid}-trace`} type="text" inputMode="url" value={trace} placeholder={AGENT_DIALOG_COPY.tracePlaceholder} onChange={(event) => setTrace(event.target.value)} style={typedField(phone)} />
          </Field>
          <Field id={`${uid}-transcript`} label={AGENT_DIALOG_COPY.transcript}>
            <textarea id={`${uid}-transcript`} rows={5} maxLength={SAMPLE_MAX} value={transcript} placeholder={AGENT_DIALOG_COPY.transcriptPlaceholder} onChange={(event) => setTranscript(event.target.value)} style={typedArea(phone, { fontFamily: "var(--font-data)" })} />
          </Field>
          <Hint>Leave out anything secret. Name a key, never paste its value.</Hint>
        </OptionalField>

        {kind === "team" ? (
          <OptionalField name={AGENT_DIALOG_COPY.pattern} description={AGENT_DIALOG_COPY.patternLine} summary={pattern ? AGENT_PATTERN_LABEL[pattern] : null} phone={phone}>
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
    <ModalShell open={open} onOpenChange={openChange} title={title} subtitle={AGENT_DIALOG_COPY.subtitle} width={520} testId="add-agent-dialog">
      <Form nextNumber={nextNumber} teamsAvailable={teamsAvailable} onAdd={add} onCancel={close} phone={phone} seed={seed} inBuild={inBuild} onKind={setKind} />
    </ModalShell>
  );
}

export default AddAgentDialog;

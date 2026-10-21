/* UI-P69 — Add › "Agent or team".

   A Radix dialog, 420 wide, on the Card's surface tokens; below 768 it is a
   `BottomSheet`. A real radio group chooses "One agent" or "A team of agents",
   then a name (empty saves as null, so the default "Agent {n}" or "Team {n}"
   shows) and, for an agent, a model from the registry. "Add" is the dialog's
   one primary.

   A team is made holding one agent, which takes the model too, so the model is
   asked for both. When the team node type is not live (UI-P61's Deploy queue
   item), "A team of agents" is disabled and says why.

   CA-02 P5: under the name, what the agent runs in, its models with their roles
   and the tools it can use (`AgentSetupFields`). A team is led by its first
   agent, so with a team chosen the dialog is titled for that agent. "Add as an
   agent" (P4) opens it with the tool as the harness and the prompt's text as
   the instructions.

   CA-03 P2: "One agent" or "A team of agents" is the segmented radio group, as the List and Map switch is drawn,
   with the chosen one's line under it in quiet text. Labels are the composer's `Field`; the name is a 30-high well;
   the dialog is the window recipe with a 15/500 title. */

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useState } from "react";

import { Button } from "@/components/brand/Button";
import { Segmented } from "@/components/brand/Segmented";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { TITLE_MAX, WHEN_DETAIL_MAX, type AgentModel, type Runs } from "@/lib/build/graph";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import { startingModel } from "@/lib/tools/modelRules";
import { toolName } from "@/lib/tools/registry";
import type { Helper } from "@/lib/build/helpers";
import { t } from "@/lib/theme/tokens";

import { AgentSetupFields, savedModels, setupReady, type AgentSetupValue } from "./AgentSetupFields";
import { Field } from "./composeControls";
import { HelpersField } from "./HelpersField";
import { dialogTitle, text, typedArea, typedField, windowStyle } from "./refinedStyles";

export const AGENT_DIALOG_COPY = {
  title: "Add an agent or a team",
  /** CA-02 P5: a team is led by its first agent, which this dialog describes. */
  leadTitle: "The agent that leads the team",
  one: "One agent",
  oneLine: "Prompts that run by themselves",
  team: "A team of agents",
  teamLine: "Several agents working together",
  teamsMissing: "Teams need the Deploy queue item from UI-P61.",
  add: "Add",
  cancel: "Cancel",
  /** CA-12 P11. */
  instructions: "Instructions",
  instructionsPlaceholder: "What this agent is told to do",
  starts: "How does it start?",
  startsDetail: "When, in a few words",
} as const;

/** CA-12 P11: how an agent starts, in the words the dialog asks it. */
export const START_CHOICES: readonly { value: "ask" | "schedule" | "event"; label: string }[] = [
  { value: "ask", label: "When I ask" },
  { value: "schedule", label: "On a schedule" },
  { value: "event", label: "When something happens" },
];

export interface AddAgentInput {
  kind: "agent" | "team";
  /** Null when left empty: the default title shows. */
  name: string | null;
  model: string;
  /** CA-02 P4: the text of the prompt field, when the dialog was opened by "Add as an agent". */
  instructions?: string;
  /** CA-02 P5: the tool it runs in, as an id or typed; null for its maker's own code. */
  harness: string | null;
  /** CA-02 P5: every model with its role, the main one first; only when there is more than one. */
  models?: AgentModel[];
  /** CA-02 P5: the tools it can use, as ids or typed names. */
  tools: string[];
  /** CA-03 P6: what it remembers; only when it says. */
  memory?: string;
  /** CA-12 P11: how it starts; absent for "When I ask". */
  runs?: Runs;
  /** CA-13 P6: the helper models it used, for an agent (a team has none of its own). */
  helpers?: Helper[];
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

/** Where a new agent starts: its harness from "Add as an agent", else none, on the model that harness offers. */
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
  const uid = useId();
  const ready = setupReady(setup);

  const choose = (next: "agent" | "team") => {
    setKind(next);
    onKind(next);
  };
  const submit = () => {
    if (!ready) return;
    onAdd({
      kind,
      name: name.trim() || null,
      ...savedModels(setup),
      harness: setup.harness,
      tools: setup.tools,
      ...(instructions.trim() ? { instructions } : null),
      ...(start !== "ask" ? { runs: { how: start, ...(startDetail.trim() ? { detail: startDetail.trim() } : null) } as Runs } : null),
      ...(setup.memory?.trim() ? { memory: setup.memory.trim() } : null),
      ...(kind === "agent" && helpers.length ? { helpers } : null),
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      /* The global field rule makes a field inherit its size on a desktop, so the form sets the fields' 13 here. */
      style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: phone ? 16 : 13 }}
    >
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

      <Field id={`${uid}-name`} label="Name">
        <input
          id={`${uid}-name`}
          type="text"
          value={name}
          maxLength={TITLE_MAX}
          placeholder={`${kind === "team" ? "Team" : "Agent"} ${nextNumber}`}
          onChange={(event) => setName(event.target.value)}
          style={typedField(phone)}
        />
      </Field>

      <Field id={`${uid}-instructions`} label={AGENT_DIALOG_COPY.instructions}>
        <textarea
          id={`${uid}-instructions`}
          rows={6}
          value={instructions}
          placeholder={AGENT_DIALOG_COPY.instructionsPlaceholder}
          onChange={(event) => setInstructions(event.target.value)}
          style={typedArea(phone, { resize: "vertical" })}
        />
      </Field>

      <AgentSetupFields
        dialog
        value={setup}
        onChange={setSetup}
        phone={phone}
        inBuild={inBuild}
        between={
          <Field id={`${uid}-starts`} label={AGENT_DIALOG_COPY.starts} group>
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
              <input type="text" aria-label={AGENT_DIALOG_COPY.startsDetail} value={startDetail} maxLength={WHEN_DETAIL_MAX} placeholder={AGENT_DIALOG_COPY.startsDetail} onChange={(event) => setStartDetail(event.target.value)} style={typedField(phone)} />
            ) : null}
          </Field>
        }
      />

      {kind === "agent" ? <HelpersField helpers={helpers} toolNames={setup.tools.map((tool) => toolName(tool) ?? tool)} decisions={[]} phone={phone} onChange={setHelpers} /> : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 36} onClick={onCancel}>
          {AGENT_DIALOG_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 36} type="submit" disabled={!ready}>
          {AGENT_DIALOG_COPY.add}
        </Button>
      </div>
    </form>
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

  // Each opening starts clean: Radix unmounts the content on close, and the sheet's form is mounted only while open.
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={openChange} title={title}>
        {open ? <Form nextNumber={nextNumber} teamsAvailable={teamsAvailable} onAdd={add} onCancel={close} phone seed={seed} inBuild={inBuild} onKind={setKind} /> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={openChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="add-agent-dialog"
          style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 51, ...windowStyle(420) }}
        >
          <Dialog.Title style={dialogTitle}>{title}</Dialog.Title>
          <Form nextNumber={nextNumber} teamsAvailable={teamsAvailable} onAdd={add} onCancel={close} phone={false} seed={seed} inBuild={inBuild} onKind={setKind} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddAgentDialog;

/* UI-P69 — Add › "Agent or team".

   A Radix dialog, 420 wide, on the Card's surface tokens; below 768 it is a
   `BottomSheet`. A real radio group chooses "One agent" or "A team of agents",
   then a name (empty saves as null, so the default "Agent {n}" or "Team {n}"
   shows) and, for an agent, a model from the registry. "Add" is the dialog's
   one primary.

   A team is made holding one agent, which takes the model too, so the model is
   asked for both. When the team node type is not live (UI-P61's Deploy queue
   item), "A team of agents" is disabled and says why. */

import * as Dialog from "@radix-ui/react-dialog";
import { useId, useState, type CSSProperties } from "react";

import { Button } from "@/components/brand/Button";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { TITLE_MAX } from "@/lib/build/graph";
import { MODEL_VERSIONS } from "@/lib/models/registry";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { fieldBase } from "./composeFields";

export const AGENT_DIALOG_COPY = {
  title: "Add an agent or a team",
  one: "One agent",
  oneLine: "Prompts that run by themselves",
  team: "A team of agents",
  teamLine: "Several agents working together",
  teamsMissing: "Teams need the Deploy queue item from UI-P61.",
  add: "Add",
  cancel: "Cancel",
} as const;

export interface AddAgentInput {
  kind: "agent" | "team";
  /** Null when left empty: the default title shows. */
  name: string | null;
  model: string;
  /** CA-02 P4: the text of the prompt field, when the dialog was opened by "Add as an agent". */
  instructions?: string;
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
}

/** The model a new agent starts on. */
export const DEFAULT_AGENT_MODEL = MODEL_VERSIONS[0].name;

function Choice({
  checked,
  disabled,
  name,
  value,
  title,
  line,
  phone,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  name: string;
  value: string;
  title: string;
  line: string;
  phone: boolean;
  onChange: () => void;
}) {
  const { state, handlers } = useInteractive<HTMLLabelElement>();
  return (
    <label
      {...handlers}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: phone ? 44 : 40,
        padding: "6px 10px",
        boxSizing: "border-box",
        borderRadius: r.control,
        border: `1px solid ${checked ? t.text : t.line}`,
        background: checked ? tokenAlpha("action", 0.12) : "transparent",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        ...(state.focusVisible ? ring(true) : null),
      }}
    >
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} style={{ margin: 0 }} />
      <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 600, color: t.text }}>{title}</span>
        <span style={{ fontFamily: FIGTREE, fontSize: 12, color: t.text2 }}>{line}</span>
      </span>
    </label>
  );
}

function Form({ nextNumber, teamsAvailable, onAdd, onCancel, phone, seed }: Pick<AddAgentDialogProps, "nextNumber" | "teamsAvailable" | "onAdd" | "seed"> & { onCancel: () => void; phone: boolean }) {
  const [kind, setKind] = useState<"agent" | "team">("agent");
  const [name, setName] = useState("");
  const [model, setModel] = useState(DEFAULT_AGENT_MODEL);
  const uid = useId();

  const submit = () => onAdd({ kind, name: name.trim() || null, model, ...(seed?.instructions ? { instructions: seed.instructions } : null) });
  const label: CSSProperties = { fontFamily: DM_MONO, fontSize: 11.5, color: t.text2, textTransform: "uppercase", letterSpacing: "0.06em" };
  const control: CSSProperties = { ...fieldBase, padding: "7px 10px", minHeight: phone ? 44 : 34, fontSize: phone ? 16 : 13.5 };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <div role="radiogroup" aria-label="What to add" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Choice checked={kind === "agent"} name={`${uid}-kind`} value="agent" title={AGENT_DIALOG_COPY.one} line={AGENT_DIALOG_COPY.oneLine} phone={phone} onChange={() => setKind("agent")} />
        <Choice
          checked={kind === "team"}
          disabled={!teamsAvailable}
          name={`${uid}-kind`}
          value="team"
          title={AGENT_DIALOG_COPY.team}
          line={teamsAvailable ? AGENT_DIALOG_COPY.teamLine : AGENT_DIALOG_COPY.teamsMissing}
          phone={phone}
          onChange={() => setKind("team")}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label htmlFor={`${uid}-name`} style={label}>
          Name
        </label>
        <input
          id={`${uid}-name`}
          type="text"
          value={name}
          maxLength={TITLE_MAX}
          placeholder={`${kind === "team" ? "Team" : "Agent"} ${nextNumber}`}
          onChange={(event) => setName(event.target.value)}
          style={control}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label htmlFor={`${uid}-model`} style={label}>
          {kind === "team" ? "Model of its first agent" : "Model"}
        </label>
        <select id={`${uid}-model`} value={model} onChange={(event) => setModel(event.target.value)} style={control}>
          {MODEL_VERSIONS.map((version) => (
            <option key={version.id} value={version.name}>
              {version.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="secondary" size={phone ? 44 : 36} onClick={onCancel}>
          {AGENT_DIALOG_COPY.cancel}
        </Button>
        <Button variant="primary" size={phone ? 44 : 36} type="submit">
          {AGENT_DIALOG_COPY.add}
        </Button>
      </div>
    </form>
  );
}

export function AddAgentDialog({ open, onOpenChange, nextNumber, teamsAvailable, onAdd, seed = null }: AddAgentDialogProps) {
  const phone = useIsPhone();
  const close = () => onOpenChange(false);
  const add = (input: AddAgentInput) => {
    onAdd(input);
    close();
  };

  // Each opening starts clean: Radix unmounts the content on close, and the sheet's form is mounted only while open.
  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={AGENT_DIALOG_COPY.title}>
        {open ? <Form nextNumber={nextNumber} teamsAvailable={teamsAvailable} onAdd={add} onCancel={close} phone seed={seed} /> : null}
      </BottomSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 50 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="add-agent-dialog"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 51,
            width: 420,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "90dvh",
            overflowY: "auto",
            boxSizing: "border-box",
            padding: 20,
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadowFloat,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <Dialog.Title style={{ margin: "0 0 14px", fontFamily: FIGTREE, fontSize: 16, fontWeight: 600, color: t.text }}>{AGENT_DIALOG_COPY.title}</Dialog.Title>
          <Form nextNumber={nextNumber} teamsAvailable={teamsAvailable} onAdd={add} onCancel={close} phone={false} seed={seed} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AddAgentDialog;

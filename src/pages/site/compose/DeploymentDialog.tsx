/* SV-27 P7: the window for one deployment tile, Add or Edit. Built from ModalFrame and modalRecipes, as every tile's window is;
   one window, its fields chosen by the kind (Part 3's payloads). Lazy: its own chunk, fetched when Add › Deployment is warmed.

   - For: the agent or team it belongs to, or The whole build; a Relay takes two or more agents instead.
   - Providers are typed or picked from the tool list where it has them; nothing here takes an address, a port or a key, and
     `deploymentRefusal` says so when one is pasted. */

import { useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import {
  BILLING_CHARGES,
  BILLING_MODELS,
  CHANNEL_DIRECTIONS,
  DEPLOYMENT_ADD_ITEMS,
  KB_FORMATS,
  KB_SYNCS,
  KB_WRITERS,
  MACHINES,
  MEASURES,
  MEMORY_LIVES,
  REACHES,
  RELAY_IDENTIFIES,
  SERVER_APIS,
  VOICE_MODE_LABEL,
  VOICE_MODES,
  agentChoicesOf,
  deploymentRefusal,
  type DeploymentKind,
} from "@/lib/build/deployment";
import { t } from "@/lib/theme/tokens";

import { Field } from "./composeControls";
import { Checkbox } from "@/components/brand/Checkbox";
import { MODAL_COPY, ModalForm, ModalShell } from "./ModalFrame";
import { FieldInput, MODAL_WIDTH } from "./modalRecipes";
import { PickMenu } from "./PickMenu";

export const DEPLOYMENT_DIALOG_COPY = {
  title: (name: string) => `Add ${name.toLowerCase()}`,
  for: "For",
  wholeBuild: "The whole build",
  provider: "Provider",
  name: "Name",
  kbHelp: "The notes you write for your agents. Memory is what the agents write themselves.",
  relayHelp: "How your agents reach each other. Never paste an address or key here.",
  tagged: "Tagged by agent",
  taggedLine: "Each entry records which agent saved it",
  review: "Review after (days)",
  joins: "Agents it joins",
} as const;

type Payload = Record<string, unknown>;

export interface DeploymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: DeploymentKind;
  /** The build's agents and teams, for For (and a Relay's agents). */
  agents: readonly { id: string; label: string }[];
  /** The agent the tile is aimed at, if any (Add deployment on an agent, or a build with one agent). */
  forAgent?: string | null;
  current?: Payload;
  /** Edit: the window says Edit and saves. */
  editTitle?: string;
  onSave: (payload: Payload) => void;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const options = <V extends string>(list: readonly V[], label: (value: V) => string = capital) => list.map((value) => ({ value, label: label(value) }));

function Text({ id, label, value, max, placeholder, phone, onChange, numeric = false }: { id: string; label: string; value: string; max: number; placeholder?: string; phone: boolean; onChange: (value: string) => void; numeric?: boolean }) {
  return (
    <Field id={id} label={label}>
      <FieldInput id={id} phone={phone} maxLength={max} placeholder={placeholder} value={value} inputMode={numeric ? "numeric" : undefined} onChange={(event) => onChange(numeric ? event.target.value.replace(/[^\d]/g, "") : event.target.value)} />
    </Field>
  );
}

function Pick<V extends string>({ id, label, value, list, phone, onChange }: { id: string; label: string; value: V; list: { value: V; label: string }[]; phone: boolean; onChange: (value: V) => void }) {
  return (
    <Field id={id} label={label} group>
      <PickMenu<V> label={label} options={list} value={value} phone={phone} onChange={onChange} />
    </Field>
  );
}

function Toggle({ label, line, checked, onChange }: { label: string; line?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: t.text }}>
      <Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {label}
        {line ? <span style={{ fontSize: 12, color: t.label }}>{line}</span> : null}
      </span>
    </label>
  );
}

const str = (value: unknown): string => (typeof value === "string" ? value : value === undefined || value === null ? "" : String(value));

export function DeploymentDialog({ open, onOpenChange, kind, agents, forAgent = null, current, editTitle, onSave }: DeploymentDialogProps) {
  const phone = useIsPhone();
  const item = DEPLOYMENT_ADD_ITEMS.find((entry) => entry.kind === kind) ?? DEPLOYMENT_ADD_ITEMS[0];
  const defaultFor = forAgent ?? (agents.length === 1 ? agents[0].id : null);
  const [payload, setPayload] = useState<Payload>(() => current ?? { agent: kind === "relay" ? null : defaultFor, ...(kind === "relay" ? { joins: forAgent ? [forAgent] : [] } : null), ...(kind === "front_end" && defaultFor ? { front_end_of: defaultFor } : null) });
  const set = (patch: Payload) => setPayload((was) => ({ ...was, ...patch }));
  const id = (key: string) => `deploy-${kind}-${key}`;
  const refusal = deploymentRefusal(kind, payload);
  const needsProvider = kind !== "host" && kind !== "knowledge_base" && kind !== "relay" && kind !== "front_end" && !str(payload.provider).trim();
  const missing = needsProvider ? DEPLOYMENT_DIALOG_COPY.provider : kind === "front_end" && !payload.front_end_of ? DEPLOYMENT_DIALOG_COPY.for : null;
  const close = () => onOpenChange(false);
  const provider = (placeholder: string) => <Text id={id("provider")} label={DEPLOYMENT_DIALOG_COPY.provider} value={str(payload.provider)} max={60} placeholder={placeholder} phone={phone} onChange={(value) => set({ provider: value })} />;
  const forField =
    kind === "relay" ? (
      <Field id={id("joins")} label={DEPLOYMENT_DIALOG_COPY.joins} group>
        {agents.map((agent) => {
          const joins = Array.isArray(payload.joins) ? (payload.joins as string[]) : [];
          return <Toggle key={agent.id} label={agent.label} checked={joins.includes(agent.id)} onChange={(on) => set({ joins: on ? [...joins, agent.id] : joins.filter((entry) => entry !== agent.id) })} />;
        })}
      </Field>
    ) : agents.length > 0 ? (
      <Pick
        id={id("for")}
        label={DEPLOYMENT_DIALOG_COPY.for}
        value={str(kind === "front_end" ? payload.front_end_of : payload.agent) || "build"}
        list={[...agents.map((agent) => ({ value: agent.id, label: agent.label })), ...(kind === "front_end" ? [] : [{ value: "build", label: DEPLOYMENT_DIALOG_COPY.wholeBuild }])]}
        phone={phone}
        onChange={(value) => set(kind === "front_end" ? { front_end_of: value, agent: value } : { agent: value === "build" ? null : value })}
      />
    ) : null;

  return (
    <ModalShell open={open} onOpenChange={onOpenChange} title={editTitle ?? DEPLOYMENT_DIALOG_COPY.title(item.name)} eyebrow={editTitle ? MODAL_COPY.edit : undefined} subtitle={item.line} width={MODAL_WIDTH.standard} testId={`deployment-dialog-${kind}`}>
      <ModalForm phone={phone} missing={missing} blocked={refusal !== null} alert={refusal} addLabel={editTitle ? MODAL_COPY.save : MODAL_COPY.add} onCancel={close} onSubmit={() => {
        onSave(payload);
        close();
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: phone ? "0 16px" : 0 }}>
          {forField}
          {kind === "host" ? (
            <>
              <Pick id={id("machine")} label="Machine" value={str(payload.machine) || "other"} list={options(MACHINES)} phone={phone} onChange={(value) => set({ machine: value })} />
              <Text id={id("name")} label={DEPLOYMENT_DIALOG_COPY.name} value={str(payload.name)} max={40} placeholder="Mac Mini" phone={phone} onChange={(value) => set({ name: value })} />
              <Toggle label="Always on" line="The host stays on, so the agent can answer at any time" checked={payload.always_on === true} onChange={(on) => set({ always_on: on })} />
            </>
          ) : null}
          {kind === "inference_server" ? (
            <>
              {provider("Ollama")}
              <Pick id={id("api")} label="API" value={str(payload.api) || "OpenAI-compatible"} list={SERVER_APIS.map((value) => ({ value, label: value === "other" ? "Other" : value }))} phone={phone} onChange={(value) => set({ api: value })} />
              <Pick id={id("reach")} label="Reach" value={str(payload.reach) || "this machine only"} list={options(REACHES)} phone={phone} onChange={(value) => set({ reach: value })} />
            </>
          ) : null}
          {kind === "memory" ? (
            <>
              {provider("Letta")}
              <Text id={id("keeps")} label="What it keeps" value={str(payload.keeps)} max={200} placeholder="Facts about clients and past conversations" phone={phone} onChange={(value) => set({ keeps: value })} />
              <Pick id={id("lives")} label="Where it lives" value={str(payload.lives) || "cloud"} list={options(MEMORY_LIVES)} phone={phone} onChange={(value) => set({ lives: value })} />
              <Toggle label={DEPLOYMENT_DIALOG_COPY.tagged} line={DEPLOYMENT_DIALOG_COPY.taggedLine} checked={payload.tagged_by_agent === true} onChange={(on) => set({ tagged_by_agent: on })} />
              <Text id={id("review")} label={DEPLOYMENT_DIALOG_COPY.review} value={str(payload.review_after_days)} max={4} placeholder="90" phone={phone} numeric onChange={(value) => set({ review_after_days: value ? Number(value) : undefined })} />
            </>
          ) : null}
          {kind === "knowledge_base" ? (
            <>
              <span style={{ fontSize: 12, color: t.label }}>{DEPLOYMENT_DIALOG_COPY.kbHelp}</span>
              <Pick id={id("format")} label="Format" value={str(payload.format) || "markdown files"} list={options(KB_FORMATS)} phone={phone} onChange={(value) => set({ format: value })} />
              <Text id={id("app")} label="App" value={str(payload.app)} max={60} placeholder="Obsidian" phone={phone} onChange={(value) => set({ app: value })} />
              <Pick id={id("sync")} label="Sync" value={str(payload.sync) || "none"} list={options(KB_SYNCS)} phone={phone} onChange={(value) => set({ sync: value })} />
              <Pick id={id("written")} label="Written by" value={str(payload.written_by) || "the maker"} list={options(KB_WRITERS)} phone={phone} onChange={(value) => set({ written_by: value })} />
            </>
          ) : null}
          {kind === "relay" ? (
            <>
              <span style={{ fontSize: 12, color: t.label }}>{DEPLOYMENT_DIALOG_COPY.relayHelp}</span>
              <Text id={id("provider")} label={DEPLOYMENT_DIALOG_COPY.provider} value={str(payload.provider)} max={60} placeholder="Agent Tincan" phone={phone} onChange={(value) => set({ provider: value })} />
              <Text id={id("network")} label="Network" value={str(payload.network)} max={60} placeholder="Tailscale" phone={phone} onChange={(value) => set({ network: value })} />
              <Toggle label="Queues requests" line="Requests wait while an agent is offline" checked={payload.queues === true} onChange={(on) => set({ queues: on })} />
              <Pick id={id("identifies")} label="Identifies agents by" value={str(payload.identifies_by) || "network identity"} list={options(RELAY_IDENTIFIES)} phone={phone} onChange={(value) => set({ identifies_by: value })} />
            </>
          ) : null}
          {kind === "channel" ? (
            <>
              {provider("Telegram")}
              <Pick id={id("direction")} label="Direction" value={str(payload.direction) || "both"} list={options(CHANNEL_DIRECTIONS)} phone={phone} onChange={(value) => set({ direction: value })} />
              <Toggle label="Starts runs" line="A message here starts the agent" checked={payload.starts_runs === true} onChange={(on) => set({ starts_runs: on })} />
            </>
          ) : null}
          {kind === "voice" ? (
            <>
              {provider("ElevenLabs")}
              <Pick id={id("mode")} label="Mode" value={str(payload.mode) || "tts"} list={VOICE_MODES.map((value) => ({ value, label: VOICE_MODE_LABEL[value] }))} phone={phone} onChange={(value) => set({ mode: value })} />
            </>
          ) : null}
          {kind === "monitoring" ? (
            <>
              {provider("Grafana")}
              <Field id={id("measures")} label="Measures" group>
                {MEASURES.map((measure) => {
                  const measures = Array.isArray(payload.measures) ? (payload.measures as string[]) : [];
                  return <Toggle key={measure} label={capital(measure)} checked={measures.includes(measure)} onChange={(on) => set({ measures: on ? [...measures, measure] : measures.filter((entry) => entry !== measure) })} />;
                })}
              </Field>
              <Toggle label="Test traffic tagged" line="Test runs are tagged apart from real users" checked={payload.test_traffic_tagged === true} onChange={(on) => set({ test_traffic_tagged: on })} />
            </>
          ) : null}
          {kind === "billing" ? (
            <>
              {provider("Stripe")}
              <Pick id={id("model")} label="Model" value={str(payload.model) || "usage-based"} list={options(BILLING_MODELS)} phone={phone} onChange={(value) => set({ model: value })} />
              {str(payload.model || "usage-based") === "usage-based" ? <Text id={id("unit")} label="Per" value={str(payload.unit)} max={20} placeholder="1M tokens" phone={phone} onChange={(value) => set({ unit: value })} /> : null}
              <Pick id={id("charges")} label="Charges" value={str(payload.charges) || "the agent's users"} list={options(BILLING_CHARGES)} phone={phone} onChange={(value) => set({ charges: value })} />
            </>
          ) : null}
          {kind === "front_end" ? <Text id={id("built")} label="Built with" value={str(payload.built_with)} max={60} placeholder="Claude Design" phone={phone} onChange={(value) => set({ built_with: value })} /> : null}
        </div>
      </ModalForm>
    </ModalShell>
  );
}

/** The window as the composer opens it: the build's agents worked out here, the tile written through `add`. */
export function DeploymentWindow({ steps, add, onAdded, ...rest }: Omit<DeploymentDialogProps, "agents" | "onSave"> & { steps: Parameters<typeof agentChoicesOf>[0]; add: (input: { kind: DeploymentKind; payload: Payload }) => Promise<string | null>; onAdded: (id: string) => void }) {
  return (
    <DeploymentDialog
      {...rest}
      agents={agentChoicesOf(steps)}
      onSave={(payload) => {
        void add({ kind: rest.kind, payload }).then((id) => {
          if (id) onAdded(id);
        });
      }}
    />
  );
}

export default DeploymentDialog;

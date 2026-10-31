/* SV-27 P5: an agent's or team's deployment fields, in its window after the fields it already has. Built from the window's
   existing quiet controls (Field, PickMenu, typed fields, removable tags): no new look.

   - Deployment: one line naming its deployment tiles ("Mac Mini · Letta · Telegram, WhatsApp · ElevenLabs · Front end"), each a
     button that opens the tile; with none, "Add deployment" (when the composer gives a way to add one).
   - Framework, when the harness is Built in code (no harness): the agent frameworks in the tool list.
   - Compatible models: "Add compatible models", stored as the maker's claim, never as a result.
   - Model routing, Approvals (with a reviewer model for the AI reviewer), Sandbox.
   - Role, for an agent inside a team.
   - A permission on each of its Available tools.
   Every write goes through `onExtras` (the existing extras writer), held by the window until Save. */

import { Fragment, useState, type ReactNode } from "react";

import {
  APPROVAL_LABEL,
  APPROVAL_MODES,
  APPROVALS_COPY,
  COMPATIBLE_COPY,
  COMPATIBLE_MODELS_MAX,
  FRAMEWORK_COPY,
  ROLE_COPY,
  ROLE_MAX,
  ROUTING_COPY,
  ROUTING_LABEL,
  ROUTING_MODES,
  ROUTING_RULE_MAX,
  SANDBOX_COPY,
  SANDBOX_LABEL,
  SANDBOXES,
  approvalsPatch,
  type AgentFields,
  type ApprovalMode,
  type RoutingMode,
  type Sandbox,
} from "@/lib/build/agentFields";
import { harnessDefaultLine, sandboxShown } from "@/lib/build/harnessFacts";
import { TOOL_PERMISSION_LABEL, TOOL_PERMISSIONS, type ToolPermission } from "@/lib/build/tileExtras";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { TOOLS, toolName } from "@/lib/tools/registry";

import { Field, TextButton } from "./composeControls";
import { RemovableTag, TagList } from "./modalRecipes";
import { PickMenu } from "./PickMenu";
import { typedField } from "./refinedStyles";

export const DEPLOYMENT_LINE_COPY = { label: "Deployment", add: "Add deployment", open: (name: string) => `Open ${name}` } as const;

const FRAMEWORKS = TOOLS.filter((tool) => tool.group === "runtime-frameworks" && tool.status === "current");
const NOT_SAID = "none";

function Typed({ label, value, max, placeholder, phone, onCommit }: { label: string; value: string; max: number; placeholder?: string; phone: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const { state, handlers } = useInteractive<HTMLInputElement>({ onBlur: () => draft.trim() !== value.trim() && onCommit(draft.trim()) });
  return (
    <input
      type="text"
      aria-label={label}
      maxLength={max}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (draft.trim() !== value.trim()) onCommit(draft.trim());
        }
      }}
      {...handlers}
      style={typedField(phone, ring(state.focusVisible))}
    />
  );
}

/** The Deployment line: kinds apart by " · ", tiles of one kind by ", ", each name a button that opens its tile. */
export function DeploymentLine({ entries, phone, onOpen, onAdd }: { entries: readonly { id: string; kind: string; name: string }[]; phone: boolean; onOpen?: (id: string) => void; onAdd?: () => void }) {
  if (entries.length === 0) {
    return onAdd ? (
      <span>
        <TextButton underline target={phone} onClick={onAdd}>
          {DEPLOYMENT_LINE_COPY.add}
        </TextButton>
      </span>
    ) : null;
  }
  const parts: ReactNode[] = [];
  entries.forEach((entry, at) => {
    if (at > 0) parts.push(<span key={`sep-${entry.id}`} style={{ color: t.label }}>{entries[at - 1].kind === entry.kind ? ", " : " · "}</span>);
    parts.push(
      onOpen ? (
        <TextButton key={entry.id} target={phone} aria-label={DEPLOYMENT_LINE_COPY.open(entry.name)} onClick={() => onOpen(entry.id)}>
          {entry.name}
        </TextButton>
      ) : (
        <span key={entry.id}>{entry.name}</span>
      ),
    );
  });
  return (
    <p data-testid="deployment-line" aria-label={DEPLOYMENT_LINE_COPY.label} style={{ margin: 0, fontSize: 12.5, color: t.text2 }}>
      {parts.map((part, at) => (
        <Fragment key={at}>{part}</Fragment>
      ))}
    </p>
  );
}

export interface AgentRuntimeFieldsProps {
  id: string;
  kind: "agent" | "team";
  phone: boolean;
  fields: AgentFields;
  /** The harness the window has now (null: Built in code). */
  harness: string | null;
  /** The Available tools the window has now, by id or typed name. */
  tools: readonly string[];
  /** The agent sits inside a team. */
  inTeam: boolean;
  deployment: readonly { id: string; kind: string; name: string }[];
  /** SV-27 P6: its own setup items. */
  ownSetup?: readonly { id: string; kind: string; name: string; origin: string | null }[];
  onExtras?: (id: string, patch: Record<string, unknown>) => void;
  onOpenTile?: (id: string) => void;
  onAddDeployment?: (agentId: string) => void;
}

export function AgentRuntimeFields({ id, kind, phone, fields, harness, tools, inTeam, deployment, ownSetup = [], onExtras, onOpenTile, onAddDeployment }: AgentRuntimeFieldsProps) {
  const [shown, setShown] = useState<AgentFields>(fields);
  const [addingModels, setAddingModels] = useState(false);
  const write = (patch: Record<string, unknown>, next: Partial<AgentFields>) => {
    setShown((current) => ({ ...current, ...next }));
    onExtras?.(id, patch);
  };
  const routingMode: RoutingMode = shown.modelRouting?.mode ?? "fixed";
  const harnessLine = harnessDefaultLine(harness);
  const compatible = shown.compatibleModels ?? [];
  return (
    <>
      <Field id={`${id}-deployment`} label={DEPLOYMENT_LINE_COPY.label} group>
        <DeploymentLine entries={deployment} phone={phone} onOpen={onOpenTile} onAdd={onAddDeployment ? () => onAddDeployment(id) : undefined} />
      </Field>

      {ownSetup.length > 0 ? (
        <Field id={`${id}-setup`} label="Setup" group>
          {ownSetup.map((item) => (
            <span key={item.id} style={{ fontSize: 12.5, color: t.text2 }}>
              {[item.kind, item.name, item.origin].filter(Boolean).join(" · ")}
            </span>
          ))}
        </Field>
      ) : null}

      {kind === "agent" && !harness ? (
        <Field id={`${id}-framework`} label={FRAMEWORK_COPY.label} hint={FRAMEWORK_COPY.help} group>
          <PickMenu<string>
            label={FRAMEWORK_COPY.label}
            options={[...FRAMEWORKS.map((tool) => ({ value: tool.id, label: tool.name })), { value: NOT_SAID, label: APPROVALS_COPY.notSaid }]}
            value={shown.framework ?? NOT_SAID}
            placeholder={FRAMEWORK_COPY.select}
            phone={phone}
            onChange={(choice) => write({ framework: choice === NOT_SAID ? null : choice }, { framework: choice === NOT_SAID ? undefined : choice })}
          />
        </Field>
      ) : null}

      <Field id={`${id}-compatible`} label={COMPATIBLE_COPY.shown} group>
        {compatible.length > 0 ? (
          <TagList label={COMPATIBLE_COPY.shown}>
            {compatible.map((model) => (
              <RemovableTag key={model} phone={phone} removeLabel={`Remove ${model}`} onRemove={() => {
                const next = compatible.filter((entry) => entry !== model);
                write({ compatible_models: next }, { compatibleModels: next });
              }}>
                {model}
              </RemovableTag>
            ))}
          </TagList>
        ) : null}
        {addingModels && compatible.length < COMPATIBLE_MODELS_MAX ? (
          <Typed
            key={compatible.join("|")}
            label={COMPATIBLE_COPY.add}
            value=""
            max={60}
            placeholder="GPT, Gemini"
            phone={phone}
            onCommit={(typed) => {
              const added = typed.split(",").map((entry) => entry.trim()).filter(Boolean);
              const next = [...new Set([...compatible, ...added])].slice(0, COMPATIBLE_MODELS_MAX);
              write({ compatible_models: next }, { compatibleModels: next });
            }}
          />
        ) : compatible.length < COMPATIBLE_MODELS_MAX ? (
          <span>
            <TextButton underline target={phone} onClick={() => setAddingModels(true)}>
              {COMPATIBLE_COPY.add}
            </TextButton>
          </span>
        ) : null}
      </Field>

      <Field id={`${id}-routing`} label={ROUTING_COPY.label} group>
        <PickMenu<RoutingMode>
          label={ROUTING_COPY.label}
          options={ROUTING_MODES.map((mode) => ({ value: mode, label: ROUTING_LABEL[mode] }))}
          value={routingMode}
          phone={phone}
          onChange={(mode) => {
            if (mode === "fixed") write({ model_routing: null }, { modelRouting: undefined });
            else if (mode === "maker_switches") write({ model_routing: { mode, ...(shown.modelRouting?.rule ? { rule: shown.modelRouting.rule } : null) } }, { modelRouting: { mode, rule: shown.modelRouting?.rule } });
            // A router is asked for before anything is written: "router" needs one.
            else setShown((current) => ({ ...current, modelRouting: { mode, rule: current.modelRouting?.rule } }));
          }}
        />
        {routingMode === "router" ? (
          <Typed
            label={ROUTING_COPY.router}
            value={shown.modelRouting?.router ?? ""}
            max={60}
            placeholder="OpenRouter"
            phone={phone}
            onCommit={(router) => write({ model_routing: router ? { mode: "router", router, ...(shown.modelRouting?.rule ? { rule: shown.modelRouting.rule } : null) } : null }, { modelRouting: router ? { mode: "router", router, rule: shown.modelRouting?.rule } : undefined })}
          />
        ) : null}
        {routingMode !== "fixed" ? (
          <Typed
            label={ROUTING_COPY.rule}
            value={shown.modelRouting?.rule ?? ""}
            max={ROUTING_RULE_MAX}
            placeholder={ROUTING_COPY.rulePlaceholder}
            phone={phone}
            onCommit={(rule) => {
              const current = shown.modelRouting;
              if (!current || (current.mode === "router" && !current.router)) {
                setShown((was) => ({ ...was, modelRouting: { mode: routingMode as "router", router: current?.router, rule } }));
                return;
              }
              write({ model_routing: { ...current, rule: rule || undefined } }, { modelRouting: { ...current, rule: rule || undefined } });
            }}
          />
        ) : null}
      </Field>

      <Field id={`${id}-approvals`} label={APPROVALS_COPY.label} hint={harnessLine ?? undefined} group>
        <PickMenu<ApprovalMode | typeof NOT_SAID>
          label={APPROVALS_COPY.label}
          options={[...APPROVAL_MODES.map((mode) => ({ value: mode, label: APPROVAL_LABEL[mode] })), { value: NOT_SAID, label: APPROVALS_COPY.notSaid }]}
          value={shown.approvalMode ?? NOT_SAID}
          placeholder={APPROVALS_COPY.notSaid}
          phone={phone}
          onChange={(mode) => {
            const chosen = mode === NOT_SAID ? null : mode;
            write(approvalsPatch(chosen, shown.reviewerModel), { approvalMode: chosen ?? undefined, reviewerModel: chosen === "reviewer" ? shown.reviewerModel : undefined });
          }}
        />
        {shown.approvalMode === "reviewer" ? (
          <Typed label={APPROVALS_COPY.reviewer} value={shown.reviewerModel ?? ""} max={60} placeholder="Haiku 5.5" phone={phone} onCommit={(model) => write({ reviewer_model: model || null }, { reviewerModel: model || undefined })} />
        ) : null}
      </Field>

      <Field id={`${id}-sandbox`} label={SANDBOX_COPY.label} group>
        <PickMenu<Sandbox | typeof NOT_SAID>
          label={SANDBOX_COPY.label}
          options={[...SANDBOXES.map((value) => ({ value, label: SANDBOX_LABEL[value] })), { value: NOT_SAID, label: SANDBOX_COPY.notSaid }]}
          value={sandboxShown(shown.sandbox, harness) ?? NOT_SAID}
          placeholder={SANDBOX_COPY.notSaid}
          phone={phone}
          onChange={(value) => write({ sandbox: value === NOT_SAID ? null : value }, { sandbox: value === NOT_SAID ? undefined : value })}
        />
      </Field>

      {kind === "agent" && inTeam ? (
        <Field id={`${id}-role`} label={ROLE_COPY.label} group>
          <Typed label={ROLE_COPY.label} value={shown.role ?? ""} max={ROLE_MAX} placeholder={ROLE_COPY.placeholder} phone={phone} onCommit={(role) => write({ role: role || null }, { role: role || undefined })} />
        </Field>
      ) : null}

      {kind === "agent" && tools.length > 0 ? (
        <Field id={`${id}-permissions`} label="What it may do with each tool" group>
          {tools.map((tool) => {
            const name = toolName(tool) ?? tool;
            const permission = shown.toolPermissions?.[tool];
            return (
              <div key={tool} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, color: t.text }}>{name}</span>
                <PickMenu<ToolPermission | typeof NOT_SAID>
                  label={`Permission for ${name}`}
                  options={[...TOOL_PERMISSIONS.map((value) => ({ value, label: TOOL_PERMISSION_LABEL[value] })), { value: NOT_SAID, label: APPROVALS_COPY.notSaid }]}
                  value={permission ?? NOT_SAID}
                  placeholder={APPROVALS_COPY.notSaid}
                  phone={phone}
                  onChange={(value) => {
                    const next = { ...(shown.toolPermissions ?? {}) };
                    if (value === NOT_SAID) delete next[tool];
                    else next[tool] = value;
                    write({ tool_permissions: Object.keys(next).length > 0 ? next : null }, { toolPermissions: Object.keys(next).length > 0 ? next : undefined });
                  }}
                />
              </div>
            );
          })}
        </Field>
      ) : null}
    </>
  );
}

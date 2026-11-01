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

import { deploymentLineOf, deploymentTilesOf } from "@/lib/build/deployment";
import { agentSetupItemsOf, SETUP_KIND_LABEL, skillOriginLine } from "@/lib/build/setup";
import type { NodeTree } from "@/lib/build/types";
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
  agentFieldsOf,
  approvalsPatch,
  type AgentFields,
  type ApprovalMode,
  type RoutingMode,
  type Sandbox,
} from "@/lib/build/agentFields";
import { harnessDefaultLine, sandboxShown } from "@/lib/build/harnessFacts";
import { Checkbox } from "@/components/brand/Checkbox";
import {
  HANDOFF_COPY,
  HANDOFF_WHEN_MAX,
  HANDOFFS_MAX,
  OUTPUT_RULE_MAX,
  OUTPUT_RULES_MAX,
  RULE_TEXT_MAX,
  RULES_COPY,
  RULES_FOLLOWED_MAX,
  agentLabel,
  agentsOfTeam,
  handoffsOf,
  httpsUrl,
  outputRulesOf,
  rulesFollowedOf,
  teamOfAgent,
  type Handoff,
  type RuleFollowed,
} from "@/lib/build/teamFields";
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
  /** The harness the window has now; null when it names none. */
  harness: string | null;
  /** SV-27: Built in code (no harness); Framework shows only then, never for Not said. */
  builtInCode?: boolean;
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

/** The agent's deployment data, worked out from the build's tiles: its fields, its Deployment line and its own setup. */
export function AgentRuntimeSection({ tree, ...rest }: Omit<AgentRuntimeFieldsProps, "fields" | "deployment" | "ownSetup"> & { tree: readonly NodeTree[] }) {
  const find = (nodes: readonly NodeTree[]): NodeTree | null => {
    for (const node of nodes) {
      if (node.id === rest.id) return node;
      const inner = find(node.children ?? []);
      if (inner) return inner;
    }
    return null;
  };
  const ownSetup = agentSetupItemsOf(tree as NodeTree[], rest.id).map((item) => ({ id: item.id, kind: SETUP_KIND_LABEL[item.kind], name: item.name, origin: skillOriginLine(item) }));
  const payload = find(tree)?.payload;
  const team = teamOfAgent(tree, rest.id);
  const mates = team ? agentsOfTeam(tree, team.id).filter((agent) => agent.id !== rest.id).map((agent) => ({ id: agent.id, label: agentLabel(agent) })) : [];
  return (
    <>
      <AgentRuntimeFields {...rest} fields={agentFieldsOf(payload)} deployment={deploymentLineOf(deploymentTilesOf(tree), rest.id)} ownSetup={ownSetup} />
      {rest.kind === "agent" ? <AgentTeamFields id={rest.id} phone={rest.phone} mates={mates} handoffs={handoffsOf(payload)} rules={outputRulesOf(payload)} follows={rulesFollowedOf(payload)} onExtras={rest.onExtras} /> : null}
    </>
  );
}

export function AgentRuntimeFields({ id, kind, phone, fields, harness, builtInCode = false, tools, inTeam, deployment, ownSetup = [], onExtras, onOpenTile, onAddDeployment }: AgentRuntimeFieldsProps) {
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

      {kind === "agent" && !harness && builtInCode ? (
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

/* ── SV-28 P1 and P3: Hands off to, Output rules, Follows ── */

/**
 * The agent's handoff rules (an agent in a team: one line per rule, an agent picker then the condition, and "A person approves
 * first"), its output rules (one per line) and the published guidance it follows (text and an https link). Writes go through
 * `onExtras`, held by the window until Save; the writer refuses a rule to an agent outside the team.
 */
export function AgentTeamFields({ id, phone, mates, handoffs, rules, follows, onExtras }: { id: string; phone: boolean; mates: readonly { id: string; label: string }[]; handoffs: readonly Handoff[]; rules: readonly string[]; follows: readonly RuleFollowed[]; onExtras?: (id: string, patch: Record<string, unknown>) => void }) {
  const [shownHandoffs, setHandoffs] = useState<Handoff[]>([...handoffs]);
  const [draftRule, setDraftRule] = useState<{ to: string; when: string } | null>(null);
  const [shownRules, setRules] = useState(rules.join("\n"));
  const [shownFollows, setFollows] = useState<RuleFollowed[]>([...follows]);
  const [draftFollow, setDraftFollow] = useState<{ text: string; url: string } | null>(null);
  const writeHandoffs = (next: Handoff[]) => {
    setHandoffs(next);
    onExtras?.(id, { handoffs: next.length > 0 ? next : null });
  };
  const writeFollows = (next: RuleFollowed[]) => {
    setFollows(next);
    onExtras?.(id, { rules_followed: next.length > 0 ? next : null });
  };
  const nameOf = (to: string) => mates.find((mate) => mate.id === to)?.label ?? "Agent";
  const ruleLines = shownRules.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const followUrl = draftFollow ? httpsUrl(draftFollow.url) : null;
  return (
    <>
      {mates.length > 0 ? (
        <Field id={`${id}-handoffs`} label={HANDOFF_COPY.label} group>
          {shownHandoffs.map((rule, at) => (
            <div key={`${rule.to}-${at}`} data-testid="handoff-row" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <PickMenu<string>
                  label={`${HANDOFF_COPY.label}: ${HANDOFF_COPY.to}`}
                  options={mates.map((mate) => ({ value: mate.id, label: mate.label }))}
                  value={rule.to}
                  phone={phone}
                  onChange={(to) => writeHandoffs(shownHandoffs.map((entry, i) => (i === at ? { ...entry, to } : entry)))}
                />
                <span style={{ flexGrow: 1, minWidth: 160 }}>
                  <Typed label={`${HANDOFF_COPY.when} ${nameOf(rule.to)}`} value={rule.when} max={HANDOFF_WHEN_MAX} placeholder={HANDOFF_COPY.whenPlaceholder} phone={phone} onCommit={(when) => when && writeHandoffs(shownHandoffs.map((entry, i) => (i === at ? { ...entry, when } : entry)))} />
                </span>
                <TextButton target={phone} aria-label={HANDOFF_COPY.remove} onClick={() => writeHandoffs(shownHandoffs.filter((_, i) => i !== at))}>
                  Remove
                </TextButton>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: t.text2 }}>
                <Checkbox
                  checked={rule.needs_approval === true}
                  onChange={(event) => {
                    const { needs_approval: _was, ...rest } = rule;
                    writeHandoffs(shownHandoffs.map((entry, i) => (i === at ? (event.target.checked ? { ...rest, needs_approval: true } : rest) : entry)));
                  }}
                />
                {HANDOFF_COPY.approval}
              </label>
            </div>
          ))}
          {draftRule ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <PickMenu<string> label={`${HANDOFF_COPY.label}: ${HANDOFF_COPY.to}`} options={mates.map((mate) => ({ value: mate.id, label: mate.label }))} value={draftRule.to} placeholder={HANDOFF_COPY.pick} phone={phone} onChange={(to) => setDraftRule({ ...draftRule, to })} />
              <span style={{ flexGrow: 1, minWidth: 160 }}>
                <Typed
                  label={HANDOFF_COPY.when}
                  value=""
                  max={HANDOFF_WHEN_MAX}
                  placeholder={HANDOFF_COPY.whenPlaceholder}
                  phone={phone}
                  onCommit={(when) => {
                    if (!when || !draftRule.to) return setDraftRule({ ...draftRule, when });
                    writeHandoffs([...shownHandoffs, { to: draftRule.to, when }]);
                    setDraftRule(null);
                  }}
                />
              </span>
            </div>
          ) : shownHandoffs.length < HANDOFFS_MAX ? (
            <span>
              <TextButton underline target={phone} onClick={() => setDraftRule({ to: "", when: "" })}>
                {HANDOFF_COPY.add}
              </TextButton>
            </span>
          ) : null}
        </Field>
      ) : null}

      <Field id={`${id}-output-rules`} label={RULES_COPY.output} hint={RULES_COPY.outputHint}>
        <textarea
          id={`${id}-output-rules`}
          rows={3}
          value={shownRules}
          placeholder={RULES_COPY.outputPlaceholder}
          onChange={(event) => setRules(event.target.value)}
          onBlur={() => {
            if (ruleLines.join("\n") === rules.join("\n")) return;
            if (ruleLines.length > OUTPUT_RULES_MAX || ruleLines.some((line) => line.length > OUTPUT_RULE_MAX)) return;
            onExtras?.(id, { output_rules: ruleLines.length > 0 ? ruleLines : null });
          }}
          style={{ ...typedField(phone, {}), height: "auto", minHeight: 72, resize: "vertical", padding: 8 }}
        />
        {ruleLines.length > OUTPUT_RULES_MAX ? <span role="alert" style={{ fontSize: 12, color: t.text }}>{`Output rules: ${OUTPUT_RULES_MAX} max, one per line`}</span> : null}
        {ruleLines.some((line) => line.length > OUTPUT_RULE_MAX) ? <span role="alert" style={{ fontSize: 12, color: t.text }}>{`Each output rule: ${OUTPUT_RULE_MAX} characters max`}</span> : null}
      </Field>

      <Field id={`${id}-follows`} label={RULES_COPY.follows} hint={RULES_COPY.followsHint} group>
        {shownFollows.map((rule, at) => (
          <div key={rule.url} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, color: t.text, minWidth: 0, overflowWrap: "anywhere" }}>{rule.text}</span>
            <TextButton target={phone} aria-label={`${RULES_COPY.remove}: ${rule.text}`} onClick={() => writeFollows(shownFollows.filter((_, i) => i !== at))}>
              Remove
            </TextButton>
          </div>
        ))}
        {draftFollow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input type="text" aria-label={RULES_COPY.text} maxLength={RULE_TEXT_MAX} value={draftFollow.text} placeholder="GOV.UK style guide" onChange={(event) => setDraftFollow({ ...draftFollow, text: event.target.value })} style={typedField(phone, {})} />
            <input type="url" aria-label={RULES_COPY.url} value={draftFollow.url} placeholder="https://" onChange={(event) => setDraftFollow({ ...draftFollow, url: event.target.value })} style={typedField(phone, {})} />
            {draftFollow.url.trim() && !followUrl ? <span role="alert" style={{ fontSize: 12, color: t.text }}>{RULES_COPY.https}</span> : null}
            <span>
              <TextButton
                underline
                target={phone}
                disabled={!draftFollow.text.trim() || !followUrl}
                onClick={() => {
                  if (!followUrl || !draftFollow.text.trim()) return;
                  writeFollows([...shownFollows, { text: draftFollow.text.trim(), url: followUrl }]);
                  setDraftFollow(null);
                }}
              >
                {RULES_COPY.add}
              </TextButton>
            </span>
          </div>
        ) : shownFollows.length < RULES_FOLLOWED_MAX ? (
          <span>
            <TextButton underline target={phone} onClick={() => setDraftFollow({ text: "", url: "" })}>
              {RULES_COPY.add}
            </TextButton>
          </span>
        ) : null}
      </Field>
    </>
  );
}

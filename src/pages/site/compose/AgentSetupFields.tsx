/* CA-02 P5 — what an agent ran in, the models it used and the tools it could call.

   One set of controls, in the Add dialog and in Details:

   - Runs in: the tool picker for an agent, its first row "My own code (API)", which saves no harness.
   - Models: one row to start, its menu reading the harness (`ModelPicker`); "Add a model" adds a row, four at most.
     Every row after the first has a role, from the harness's own roles, else main, plans, acts, reviews, other. The
     first is always main. A harness that hides its model shows its note and saves its own name; one that names
     tiers offers them.
   - Tools it can use: optional, the tool picker for a tool, several allowed, shown as removable chips.

   Controlled: the caller holds the value and decides when it is written.

   CA-03 P2: every label is the composer's `Field` (13/500, sentence case, 6 above its control), in the dialog and in
   Details alike. One row per model: its model menu, then its role menu (rows after the first; the first shows "Main"
   as quiet text in that place, so the columns line up), then the remove button, centred on one line, 8 apart. The
   role is a menu, never a native select.

   CA-03 P6: under Tools it can use, What it remembers: optional, one well that grows from one row to three, up to 200
   characters, saved as `payload.memory`. It hands its words over when the field is left, not on every key. */

import { X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { AGENT_MODELS_MAX, MEMORY_MAX, type AgentModel } from "@/lib/build/graph";
import { harnessTool, hiddenModelName, modelMenu, modelRoles, nextModelAfterToolChange } from "@/lib/tools/modelRules";
import { toolFor, toolName } from "@/lib/tools/registry";
import { t } from "@/lib/theme/tokens";

import { Field, TextButton } from "./composeControls";
import { MODEL_CLEARED_MS, MODEL_PICKER_COPY, ModelPicker } from "./ModelPicker";
import { PickMenu } from "./PickMenu";
import { chipStyle, text, typedArea } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";

export const AGENT_SETUP_COPY = {
  runsIn: "Runs in",
  ownCode: "My own code (API)",
  models: "Models",
  addModel: "Add a model",
  tools: "Tools it can use",
  toolsLine: "Optional",
  /** CA-03: where the first row's role menu would be. */
  main: "Main",
  /** CA-03 P6. */
  memory: "What it remembers",
  memoryHint: "Optional",
  memoryPlaceholder: "Which dishes it featured, in a notes file it keeps",
  role: (n: number) => `Role of model ${n}`,
  removeModel: (n: number) => `Remove model ${n}`,
  removeTool: (name: string) => `Remove ${name}`,
} as const;

/** One row of the Models list while it is being edited: the model can be empty until one is picked. */
export interface SetupModelRow {
  model: string | null;
  role: string;
}

export interface AgentSetupValue {
  /** A tool id or a typed name; null for the maker's own code. */
  harness: string | null;
  /** The main model first. */
  models: SetupModelRow[];
  /** Tool ids or typed names, in the order they were added. */
  tools: string[];
  /** CA-03 P6: what it remembers; absent or empty when it says nothing. */
  memory?: string;
}

/** Whether every model row names a model: an agent is never saved without one. */
export const setupReady = (value: AgentSetupValue): boolean => value.models.length > 0 && value.models.every((row) => Boolean(row.model?.trim()));

/** The rows as saved: the main model, and every row with its role when there is more than one. */
export function savedModels(value: AgentSetupValue): { model: string; models?: AgentModel[] } {
  const rows = value.models.map((row, index) => ({ model: (row.model ?? "").trim(), role: index === 0 ? "main" : row.role }));
  return rows.length > 1 ? { model: rows[0].model, models: rows } : { model: rows[0]?.model ?? "" };
}

/** The roles a later row can take: the harness's own, and "other" for anything it does not name. */
export function roleChoices(harness: string | null): string[] {
  const roles = modelRoles(harness);
  return roles.includes("other") ? roles : [...roles, "other"];
}

/** The role a new row starts on: the first one that is not main. */
const nextRole = (harness: string | null): string => roleChoices(harness).find((role) => role !== "main") ?? "other";

/** A new harness: the models it does not offer are cleared, one that hides its model saves its own name. */
export function withHarness(value: AgentSetupValue, harness: string | null): { value: AgentSetupValue; cleared: string | null } {
  const tool = harnessTool(harness);
  const hidden = hiddenModelName(tool);
  if (hidden) return { value: { ...value, harness, models: [{ model: hidden, role: "main" }] }, cleared: null };
  let cleared: string | null = null;
  const roles = roleChoices(harness);
  const models = value.models.map((row, index) => {
    const after = nextModelAfterToolChange(tool, row.model);
    if (after.cleared && row.model && !cleared) cleared = MODEL_PICKER_COPY.cleared(toolName(harness) ?? (harness ?? "").trim(), row.model);
    return { model: after.model, role: index === 0 ? "main" : roles.includes(row.role) ? row.role : nextRole(harness) };
  });
  // A harness with tiers names one level, not several models.
  const single = modelMenu(tool).state === "tiers";
  return { value: { ...value, harness, models: single ? models.slice(0, 1) : models }, cleared };
}

/** The role column's width, so the remove buttons line up under each other. */
const ROLE_WIDTH = 96;

export interface AgentSetupFieldsProps {
  value: AgentSetupValue;
  onChange: (next: AgentSetupValue) => void;
  phone: boolean;
  /** The tools the build already uses, first in the pickers. */
  inBuild: readonly string[];
  /** CA-02 P8: opens the main model's menu each time it changes ("Change the model"). */
  openMainModel?: number;
}

/** One row to three, as the words need: a line per 32 characters (the Details column is the narrowest) or line break. */
export const memoryRows = (text: string): number => Math.min(3, Math.max(1, text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 32)), 0)));

export function AgentSetupFields({ value, onChange, phone, inBuild, openMainModel }: AgentSetupFieldsProps) {
  const [cleared, setCleared] = useState<string | null>(null);
  const [memory, setMemory] = useState(value.memory ?? "");
  const uid = useId();
  const tool = harnessTool(value.harness);
  const menu = modelMenu(tool);
  const several = menu.state === "options";
  const roles = roleChoices(value.harness);
  const removeSide = phone ? 44 : 26;

  useEffect(() => {
    if (!cleared) return;
    const timer = window.setTimeout(() => setCleared(null), MODEL_CLEARED_MS);
    return () => window.clearTimeout(timer);
  }, [cleared]);

  const setRow = (index: number, row: Partial<SetupModelRow>) =>
    onChange({ ...value, models: value.models.map((entry, i) => (i === index ? { ...entry, ...row } : entry)) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Field id={`${uid}-runs-in`} label={AGENT_SETUP_COPY.runsIn} group>
        <span>
          <ToolPicker
            label={AGENT_SETUP_COPY.runsIn}
            value={value.harness}
            onChange={(next) => {
              const result = withHarness(value, next);
              setCleared(result.cleared);
              onChange(result.value);
            }}
            inBuild={inBuild}
            allowNone
            noneLabel={AGENT_SETUP_COPY.ownCode}
            phone={phone}
            step="agent"
          />
        </span>
      </Field>

      <Field id={`${uid}-models`} label={AGENT_SETUP_COPY.models} group>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {value.models.map((row, index) => (
            <div key={index} data-testid="agent-model-row" style={{ display: "grid", gridTemplateColumns: several ? `minmax(0, 1fr) ${ROLE_WIDTH}px ${removeSide}px` : "minmax(0, 1fr)", alignItems: "center", gap: 8, minWidth: 0 }}>
              <ModelPicker
                block
                tool={tool}
                value={row.model}
                onChange={(model) => setRow(index, { model })}
                phone={phone}
                allowNone={false}
                name={index === 0 ? undefined : `model ${index + 1}`}
                openSignal={index === 0 ? openMainModel : undefined}
              />
              {several ? (
                index > 0 ? (
                  <PickMenu
                    label={AGENT_SETUP_COPY.role(index + 1)}
                    options={roles.filter((role) => role !== "main" || row.role === "main").map((role) => ({ value: role }))}
                    value={row.role}
                    onChange={(role) => setRow(index, { role })}
                    phone={phone}
                    style={{ width: "100%", justifyContent: "space-between" }}
                  />
                ) : (
                  <span data-testid="agent-model-main" style={{ ...text(12.5, 400, t.text2), paddingLeft: 12 }}>
                    {AGENT_SETUP_COPY.main}
                  </span>
                )
              ) : null}
              {index > 0 ? (
                <IconButton
                  icon={X}
                  glyph="x"
                  boxed={false}
                  label={AGENT_SETUP_COPY.removeModel(index + 1)}
                  size={26}
                  onClick={() => onChange({ ...value, models: value.models.filter((_, i) => i !== index) })}
                  style={{ width: removeSide, height: removeSide, flexShrink: 0 }}
                />
              ) : null}
            </div>
          ))}
          {several && value.models.length < AGENT_MODELS_MAX ? (
            <span>
              <TextButton target={phone} style={text(12.5, 500, t.text2)} onClick={() => onChange({ ...value, models: [...value.models, { model: null, role: nextRole(value.harness) }] })}>
                {AGENT_SETUP_COPY.addModel}
              </TextButton>
            </span>
          ) : null}
          <div aria-live="polite" data-testid="agent-model-cleared">
            {cleared ? <span style={text(12, 400, t.text2)}>{cleared}</span> : null}
          </div>
        </div>
      </Field>

      <Field id={`${uid}-tools`} label={AGENT_SETUP_COPY.tools} group>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          {value.tools.length > 0 ? (
            <div role="list" aria-label={AGENT_SETUP_COPY.tools} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {value.tools.map((entry) => {
                const name = toolName(entry) ?? entry;
                return (
                  <span key={entry} role="listitem" style={{ ...chipStyle, paddingRight: 2, height: phone ? 44 : 24 }}>
                    {name}
                    <IconButton
                      icon={X}
                      glyph="x"
                      boxed={false}
                      label={AGENT_SETUP_COPY.removeTool(name)}
                      size={26}
                      onClick={() => onChange({ ...value, tools: value.tools.filter((other) => other !== entry) })}
                      style={{ width: phone ? 44 : 20, height: phone ? 44 : 20, color: t.label }}
                    />
                  </span>
                );
              })}
            </div>
          ) : null}
          <ToolPicker
            label={AGENT_SETUP_COPY.tools}
            value={null}
            onChange={(next) => {
              if (!next) return;
              const id = toolFor(next)?.id ?? next;
              if (value.tools.some((entry) => (toolFor(entry)?.id ?? entry).toLowerCase() === id.toLowerCase())) return;
              onChange({ ...value, tools: [...value.tools, id] });
            }}
            inBuild={inBuild}
            phone={phone}
            step="tool"
          />
        </div>
      </Field>

      <Field id={`${uid}-memory`} label={AGENT_SETUP_COPY.memory} hint={AGENT_SETUP_COPY.memoryHint}>
        <textarea
          id={`${uid}-memory`}
          rows={memoryRows(memory)}
          maxLength={MEMORY_MAX}
          value={memory}
          placeholder={AGENT_SETUP_COPY.memoryPlaceholder}
          onChange={(event) => setMemory(event.target.value)}
          onBlur={() => {
            if (memory.trim() !== (value.memory ?? "").trim()) onChange({ ...value, memory: memory.trim() });
          }}
          style={typedArea(phone, { resize: "none" })}
        />
      </Field>
    </div>
  );
}

export default AgentSetupFields;

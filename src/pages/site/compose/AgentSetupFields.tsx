/* CA-02 P5 — what an agent ran in, the models it used and the tools it could call.

   One set of controls, in the Add dialog and in Details:

   - Runs in: the tool picker for an agent, its first row "My own code (API)", which saves no harness.
   - Models: one row to start, its menu reading the harness (`ModelPicker`); "Add a model" adds a row, four at most.
     Every row after the first has a role, from the harness's own roles, else main, plans, acts, reviews, other. The
     first is always main. A harness that hides its model shows its note and saves its own name; one that names
     tiers offers them.
   - Tools it can use: optional, the tool picker for a tool, several allowed, shown as removable chips.

   Controlled: the caller holds the value and decides when it is written. */

import { X } from "lucide-react";
import { useEffect, useId, useState, type CSSProperties } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { AGENT_MODELS_MAX, type AgentModel } from "@/lib/build/graph";
import { harnessTool, hiddenModelName, modelMenu, modelRoles, nextModelAfterToolChange } from "@/lib/tools/modelRules";
import { toolFor, toolName } from "@/lib/tools/registry";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { fieldBase } from "./composeFields";
import { TextButton } from "./composeControls";
import { MODEL_CLEARED_MS, MODEL_PICKER_COPY, ModelPicker } from "./ModelPicker";
import { chipStyle, text } from "./refinedStyles";
import { ToolPicker } from "./ToolPicker";

export const AGENT_SETUP_COPY = {
  runsIn: "Runs in",
  ownCode: "My own code (API)",
  models: "Models",
  addModel: "Add a model",
  tools: "Tools it can use",
  toolsLine: "Optional",
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

const dialogLabel: CSSProperties = { fontFamily: DM_MONO, fontSize: 11.5, color: t.text2, textTransform: "uppercase", letterSpacing: "0.06em" };

/** The Details panel's own field label: 11.5 in `--label`. */
const panelLabel: CSSProperties = text(11.5, 400, t.label);

export interface AgentSetupFieldsProps {
  value: AgentSetupValue;
  onChange: (next: AgentSetupValue) => void;
  phone: boolean;
  /** The tools the build already uses, first in the pickers. */
  inBuild: readonly string[];
  /** CA-02 P8: opens the main model's menu each time it changes ("Change the model"). */
  openMainModel?: number;
  /** The labels as the dialog draws them (DM Mono capitals, the default) or as the Details panel draws its own. */
  labels?: "dialog" | "panel";
}

export function AgentSetupFields({ value, onChange, phone, inBuild, openMainModel, labels = "dialog" }: AgentSetupFieldsProps) {
  const labelStyle = labels === "panel" ? panelLabel : dialogLabel;
  const [cleared, setCleared] = useState<string | null>(null);
  const uid = useId();
  const tool = harnessTool(value.harness);
  const menu = modelMenu(tool);
  const several = menu.state === "options";
  const roles = roleChoices(value.harness);
  const control: CSSProperties = { ...fieldBase, padding: "4px 8px", minHeight: phone ? 44 : 28, fontSize: phone ? 16 : 12.5, width: "auto" };

  useEffect(() => {
    if (!cleared) return;
    const timer = window.setTimeout(() => setCleared(null), MODEL_CLEARED_MS);
    return () => window.clearTimeout(timer);
  }, [cleared]);

  const setRow = (index: number, row: Partial<SetupModelRow>) =>
    onChange({ ...value, models: value.models.map((entry, i) => (i === index ? { ...entry, ...row } : entry)) });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
        <span style={labelStyle}>{AGENT_SETUP_COPY.runsIn}</span>
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
      </div>

      <div role="group" aria-labelledby={`${uid}-models`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span id={`${uid}-models`} style={labelStyle}>
          {AGENT_SETUP_COPY.models}
        </span>
        {value.models.map((row, index) => (
          <div key={index} data-testid="agent-model-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {index > 0 ? (
              <select aria-label={AGENT_SETUP_COPY.role(index + 1)} value={row.role} onChange={(event) => setRow(index, { role: event.target.value })} style={control}>
                {roles
                  .filter((role) => role !== "main" || row.role === "main")
                  .map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
              </select>
            ) : null}
            <ModelPicker
              tool={tool}
              value={row.model}
              onChange={(model) => setRow(index, { model })}
              phone={phone}
              allowNone={false}
              name={index === 0 ? undefined : `model ${index + 1}`}
              openSignal={index === 0 ? openMainModel : undefined}
            />
            {index > 0 ? (
              <IconButton
                icon={X}
                glyph="x"
                boxed={false}
                label={AGENT_SETUP_COPY.removeModel(index + 1)}
                size={26}
                onClick={() => onChange({ ...value, models: value.models.filter((_, i) => i !== index) })}
                style={{ width: phone ? 44 : 24, height: phone ? 44 : 24, color: t.label }}
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

      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
        <span style={labelStyle}>{AGENT_SETUP_COPY.tools}</span>
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
    </div>
  );
}

export default AgentSetupFields;

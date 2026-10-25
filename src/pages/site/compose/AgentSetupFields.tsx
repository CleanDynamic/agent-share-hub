/* CA-02 P5, CA-15 P7: the host platform an agent ran on, the models it used and the tools it could call.

   One set of controls, in the Add dialog and in Details:

   - Runs in: the tool picker for an agent, its first row "Own code (API)", which saves no harness.
   - Models: one row to start, its menu reading the harness (`ModelPicker`); "Add a model" adds a row, four at most.
     Every row after the first has a role, from the harness's own roles, else main, plans, acts, reviews, other. The
     first is always main. A harness that hides its model shows its note and saves its own name; one that names
     tiers offers them.
   - Tools it can use: optional, the tool picker for a tool, several allowed, shown as removable chips.

   Controlled: the caller holds the value and decides when it is written.

   CA-15 P7: the four fields are built once (`useAgentSetupFields`) and handed back as separate pieces, so Add › Agent can put
   Models up front and the rest in its Optional section, and Details can lay them out in its own order (`AgentSetupFields`). The
   words are the new ones: Host platform (was Runs in), Available tools (was Tools it can use), Memory (was What it remembers),
   Primary (was Main).

   CA-03 P2: every label is the composer's `Field` (13/500, sentence case, 6 above its control), in the dialog and in
   Details alike. One row per model: its model menu, then its role menu (rows after the first; the first shows "Main"
   as quiet text in that place, so the columns line up), then the remove button, centred on one line, 8 apart. The
   role is a menu, never a native select.

   CA-03 P6: under Tools it can use, What it remembers: optional, one well that grows from one row to three, up to 200
   characters, saved as `payload.memory`. It hands its words over when the field is left, not on every key.

   CA-15b: in the Add dialog (`dialog` and `bare`) the pieces are the modal recipes, as the board "Add an agent" draws them:
   Models is a top-aligned row, each model a picker field with the "Primary" tag beside the first and "Add a model" as a
   text link under them; Host platform a picker field ("Select a platform"); Available tools a small "Select tools" button
   with the chosen tools as tags; Memory one field. Details keeps its own look. */

import { useAnnounce } from "./BuildAnnouncer";
import { X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

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
import { FieldInput, Hint, IconSquare, PICKER_ROW, RemovableTag, Row, Tag, TagList, TextLink } from "./modalRecipes";

export const AGENT_SETUP_COPY = {
  runsIn: "Host platform",
  runsInLine: "Tool or framework",
  ownCode: "Own code (API)",
  notSure: "Not sure",
  models: "Models",
  addModel: "Add a model",
  tools: "Available tools",
  toolsLine: "Apps it could call",
  /** CA-03: where the first row's role menu would be; "main" is what is stored, "Primary" is what is shown. */
  main: "Primary",
  /** CA-03 P6. */
  memory: "Memory",
  memoryLine: "Stored between runs",
  memoryPlaceholder: "Which dishes it featured, in a notes file it keeps",
  /** CA-15b: the Add dialog's words. */
  memoryDialogPlaceholder: "Dishes already featured, stored in a notes file",
  selectPlatform: "Select a platform",
  selectTools: "Select tools",
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

/** CA-15 P7: how a stored role reads: "main" is "Primary"; any other role as saved. */
export const roleLabel = (role: string): string => (role === "main" ? AGENT_SETUP_COPY.main : role);

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
  /**
   * CA-12 P11: the Add dialog's order: Model, Tools it can use, `between` (How does it start?), Runs in, Memory. "Runs in"
   * has no default there: it says "Select a tool" until chosen, and "Not sure" is a choice. Details keeps its own order.
   */
  dialog?: boolean;
  between?: ReactNode;
  /** CA-15 P7: the Optional section's row names the field already; draw Host platform, Available tools and Memory without a label of their own. */
  bare?: boolean;
}

/** The four fields, each drawn once, for a caller that lays them out itself. */
export interface AgentSetupParts {
  host: ReactNode;
  models: ReactNode;
  tools: ReactNode;
  memory: ReactNode;
}

/** One row to three, as the words need: a line per 32 characters (the Details column is the narrowest) or line break. */
export const memoryRows = (text: string): number => Math.min(3, Math.max(1, text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 32)), 0)));

export function useAgentSetupFields({ value, onChange, phone, inBuild, openMainModel, dialog = false, bare = false }: Omit<AgentSetupFieldsProps, "between">): AgentSetupParts {
  const [runsChosen, setRunsChosen] = useState(!dialog);
  const [cleared, setCleared] = useState<string | null>(null);
  const announce = useAnnounce();
  useEffect(() => {
    if (cleared) announce(cleared);
  }, [cleared, announce]);
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

  const runsInPicker = (
        <span>
          <ToolPicker
            label={AGENT_SETUP_COPY.runsIn}
            value={value.harness}
            onChange={(next) => {
              const result = withHarness(value, next);
              setCleared(result.cleared);
              setRunsChosen(true);
              onChange(result.value);
            }}
            inBuild={inBuild}
            runtime
            allowNone
            noneLabel={dialog ? AGENT_SETUP_COPY.notSure : AGENT_SETUP_COPY.ownCode}
            unpicked={dialog && !runsChosen}
            phone={phone}
            step="agent"
          />
        </span>
  );
  const recipes = dialog && bare;
  const runsInRecipe = (
    <ToolPicker
      label={AGENT_SETUP_COPY.runsIn}
      value={value.harness}
      onChange={(next) => {
        const result = withHarness(value, next);
        setCleared(result.cleared);
        setRunsChosen(true);
        onChange(result.value);
      }}
      inBuild={inBuild}
      runtime
      allowNone
      noneLabel={AGENT_SETUP_COPY.notSure}
      unpicked={!runsChosen}
      phone={phone}
      step="agent"
      placeholder={AGENT_SETUP_COPY.selectPlatform}
      field
    />
  );
  const runsInField = recipes ? runsInRecipe : bare ? (
    runsInPicker
  ) : (
    <Field id={`${uid}-runs-in`} label={AGENT_SETUP_COPY.runsIn} group>
      {runsInPicker}
    </Field>
  );

  const toolsBody = (
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
            list="app"
          />
        </div>
      
  );
  const addTool = (next: string | null) => {
    if (!next) return;
    const id = toolFor(next)?.id ?? next;
    if (value.tools.some((entry) => (toolFor(entry)?.id ?? entry).toLowerCase() === id.toLowerCase())) return;
    onChange({ ...value, tools: [...value.tools, id] });
  };
  const toolsRecipe = (
    <div role="group" aria-label={AGENT_SETUP_COPY.tools}>
      {value.tools.length > 0 ? (
        <TagList label={AGENT_SETUP_COPY.tools}>
          {value.tools.map((entry) => {
            const name = toolName(entry) ?? entry;
            return (
              <RemovableTag key={entry} removeLabel={AGENT_SETUP_COPY.removeTool(name)} phone={phone} onRemove={() => onChange({ ...value, tools: value.tools.filter((other) => other !== entry) })}>
                {name}
              </RemovableTag>
            );
          })}
        </TagList>
      ) : null}
      <ToolPicker label={AGENT_SETUP_COPY.tools} value={null} onChange={addTool} inBuild={inBuild} phone={phone} step="tool" list="app" placeholder={AGENT_SETUP_COPY.selectTools} small />
    </div>
  );
  const tools = recipes ? toolsRecipe : bare ? (
    <div role="group" aria-label={AGENT_SETUP_COPY.tools}>
      {toolsBody}
    </div>
  ) : (
    <Field id={`${uid}-tools`} label={AGENT_SETUP_COPY.tools} group>
      {toolsBody}
    </Field>
  );
  const memoryBox = (
        <textarea
          id={`${uid}-memory`}
          aria-label={bare ? AGENT_SETUP_COPY.memory : undefined}
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
      
  );
  const memoryRecipe = (
    <FieldInput
      phone={phone}
      id={`${uid}-memory`}
      aria-label={AGENT_SETUP_COPY.memory}
      maxLength={MEMORY_MAX}
      value={memory}
      placeholder={AGENT_SETUP_COPY.memoryDialogPlaceholder}
      onChange={(event) => setMemory(event.target.value)}
      onBlur={() => {
        if (memory.trim() !== (value.memory ?? "").trim()) onChange({ ...value, memory: memory.trim() });
      }}
    />
  );
  const memoryField = recipes ? memoryRecipe : bare ? (
    memoryBox
  ) : (
    <Field id={`${uid}-memory`} label={AGENT_SETUP_COPY.memory}>
      {memoryBox}
    </Field>
  );
  const addModel = () => onChange({ ...value, models: [...value.models, { model: null, role: nextRole(value.harness) }] });
  const modelsRecipe = (
    <Row id={`${uid}-models`} label={AGENT_SETUP_COPY.models} group top phone={phone}>
      {value.models.map((row, index) => (
        <div key={index} data-testid="agent-model-row" style={PICKER_ROW}>
          <ModelPicker
            field
            tool={tool}
            value={row.model}
            onChange={(model) => setRow(index, { model })}
            phone={phone}
            allowNone={false}
            name={index === 0 ? undefined : `model ${index + 1}`}
            openSignal={index === 0 ? openMainModel : undefined}
          />
          {index === 0 ? (
            <Tag testId="agent-model-main">{AGENT_SETUP_COPY.main}</Tag>
          ) : (
            <>
              <PickMenu
                label={AGENT_SETUP_COPY.role(index + 1)}
                options={roles.filter((role) => role !== "main" || row.role === "main").map((role) => ({ value: role, label: roleLabel(role) }))}
                value={row.role}
                onChange={(role) => setRow(index, { role })}
                phone={phone}
              />
              <IconSquare glyph="x" label={AGENT_SETUP_COPY.removeModel(index + 1)} phone={phone} onClick={() => onChange({ ...value, models: value.models.filter((_, i) => i !== index) })} />
            </>
          )}
        </div>
      ))}
      {several && value.models.length < AGENT_MODELS_MAX ? (
        <TextLink phone={phone} onClick={addModel}>
          {AGENT_SETUP_COPY.addModel}
        </TextLink>
      ) : null}
      <div data-testid="agent-model-cleared">
        {cleared ? <Hint>{cleared}</Hint> : null}
      </div>
    </Row>
  );
  if (recipes) return { host: runsInField, models: modelsRecipe, tools, memory: memoryField };
  return { host: runsInField, models: (
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
                    options={roles.filter((role) => role !== "main" || row.role === "main").map((role) => ({ value: role, label: roleLabel(role) }))}
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
          <div data-testid="agent-model-cleared">
            {cleared ? <span style={text(12, 400, t.text2)}>{cleared}</span> : null}
          </div>
        </div>
      </Field>
  ), tools, memory: memoryField };
}

export function AgentSetupFields({ between, ...props }: AgentSetupFieldsProps) {
  const { host, models, tools, memory } = useAgentSetupFields(props);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {props.dialog ? null : host}
      {models}
      {tools}
      {between}
      {props.dialog ? host : null}
      {memory}
    </div>
  );
}

export default AgentSetupFields;

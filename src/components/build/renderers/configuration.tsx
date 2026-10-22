// configuration — agent_config, and the shared card behind model_params,
// tool_definition, integration and stack.
//
// ConfigCard is deliberately not four components. It reads the schema and
// sorts the fields by what they ARE — scalars into a two-column grid, prose
// into blocks, structured text into monospace, lists into tables — so the four
// configuration types share one code path and a fifth added to the registry
// renders without a change here. Nothing in this file switches on node.type.

import type { ReactNode } from "react";
import { agentModelsOf } from "@/lib/build/graph";
import { modelLabel } from "@/lib/models/registry";
import { agentExtrasOf } from "@/lib/build/tileExtras";
import { t } from "@/lib/theme/tokens";
import { toolName } from "@/lib/tools/registry";
import {
  Bullets,
  Caption,
  Chip,
  ChipRow,
  Field,
  KeyValueGrid,
  MonoBlock,
  NodeRef,
  Prose,
  type GetCopyText,
  type NodeProps,
  Rest,
  SampleTable,
  StatRow,
  Stack,
  bool,
  fieldsOf,
  formatDate,
  formatNumber,
  isPresent,
  labelFor,
  looksStructured,
  num,
  payloadOf,
  rows,
  scalarsAsText,
  str,
} from "./shared";

// --- agent_config ------------------------------------------------------------

/** CA-03 P6: the words this renderer shows of its own. A field it has no value for reads "·", as the build page's other empty cells. */
export const CONFIGURATION_COPY = {
  memory: "Memory",
  /** CA-15 P12: the words the agent modal asks these with. */
  instructions: "System instructions",
  tools: "Available tools",
  limits: "Limits",
  output: "Output and destination",
  sample: "Sample run",
  none: "·",
} as const;

const AGENT_PARAM_KEYS = ["model", "temperature", "max_tokens", "top_p"];
const AGENT_TEST_KEYS = ["test_passing", "test_total", "test_run_at"];

/** The system prompt opens collapsed: it is context, not the headline. */
const SYSTEM_PROMPT_LINES = 6;

/** renderer key: "agent_config" */
export function AgentConfigRenderer(props: NodeProps) {
  const payload = payloadOf(props.node);

  const systemPrompt = str(payload, "system_prompt");
  const tools = rows(payload, "tools");
  const guardrails = rows(payload, "guardrails");
  const memory = str(payload, "memory");
  // CA-15 P12: what the maker said it must not do, where its output goes and a sample run; each only when given.
  const { limits = [], output, sample } = agentExtrasOf(payload);

  const params = AGENT_PARAM_KEYS.filter((key) => isPresent(payload[key])).map((key) => ({
    label: labelFor(props.nodeType, key),
    value: str(payload, key) as ReactNode,
  }));

  // CA-02 P5: what it ran in, and every model with its role. An agent saved before has neither, and reads as it did.
  const harness = str(payload, "harness")?.trim();
  const models = agentModelsOf(payload);

  const passing = num(payload, "test_passing");
  const total = num(payload, "test_total");
  const runAt = formatDate(str(payload, "test_run_at"));

  const handled = [
    "system_prompt",
    "tools",
    "guardrails",
    "memory",
    "limits",
    "output",
    "sample",
    "harness",
    "models",
    ...AGENT_PARAM_KEYS,
    ...AGENT_TEST_KEYS,
  ];

  return (
    <div data-visual-slot="renderer-agent-config" style={{ minWidth: 0 }}>
      <Stack gap={14}>
        {systemPrompt ? (
          <Field label={CONFIGURATION_COPY.instructions}>
            <MonoBlock text={systemPrompt} collapseTo={SYSTEM_PROMPT_LINES} />
          </Field>
        ) : null}

        <KeyValueGrid pairs={params} />

        {harness ? (
          <Field label="Host platform">
            <Prose>{toolName(harness) ?? harness}</Prose>
          </Field>
        ) : null}

        {models.length > 1 ? (
          <Field label="Models">
            <Stack gap={2}>
              {models.map((row, index) => (
                <Prose key={index}>{`${modelLabel(row.model)} · ${row.role}`}</Prose>
              ))}
            </Stack>
          </Field>
        ) : null}

        {guardrails.length > 0 ? (
          <Field label={labelFor(props.nodeType, "guardrails", "Guardrails")}>
            <Bullets
              colour={t.evidence}
              items={guardrails.map((rule) => String(rule.rule ?? rule.value ?? ""))}
            />
          </Field>
        ) : null}

        {tools.length > 0 ? (
          <Field label={CONFIGURATION_COPY.tools}>
            <ChipRow>
              {tools.map((tool, index) => {
                const reference = tool.tool_ref ?? tool.value;
                return typeof reference === "string" ? (
                  <NodeRef key={index} id={reference} resolveNode={props.resolveNode} />
                ) : null;
              })}
            </ChipRow>
          </Field>
        ) : null}

        {memory ? (
          <Field label={CONFIGURATION_COPY.memory}>
            <Prose style={{ color: t.text2 }}>{memory}</Prose>
          </Field>
        ) : null}

        {limits.length > 0 ? (
          <Field label={CONFIGURATION_COPY.limits}>
            <Bullets colour={t.evidence} items={limits} />
          </Field>
        ) : null}

        {output ? (
          <Field label={CONFIGURATION_COPY.output}>
            <Prose>{output}</Prose>
          </Field>
        ) : null}

        {sample ? (
          <Field label={CONFIGURATION_COPY.sample}>
            <MonoBlock text={sample} collapseTo={SYSTEM_PROMPT_LINES} />
          </Field>
        ) : null}

        {typeof passing === "number" && typeof total === "number" ? (
          <Caption>
            {`Tests ${formatNumber(passing)}/${formatNumber(total)}${runAt ? `, run ${runAt}` : ""}`}
          </Caption>
        ) : null}

        <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
      </Stack>
    </div>
  );
}

// --- the shared configuration card -------------------------------------------

/**
 * Numeric fields worth showing as figures rather than grid rows. Keyed by
 * field key, so this stays true for a config type added later without naming
 * a node type anywhere.
 */
const STAT_KEYS = ["top_k", "context_window", "stars"];

/** renderer key: "configuration" — model_params, tool_definition, integration, stack. */
export function ConfigCard(props: NodeProps) {
  const payload = payloadOf(props.node);
  const fields = fieldsOf(props.nodeType).filter((field) => isPresent(payload[field.key]));

  const statFields = fields.filter(
    (field) => STAT_KEYS.includes(field.key) && typeof num(payload, field.key) === "number"
  );
  const stats = statFields.map((field) => ({
    label: field.label,
    value: formatNumber(num(payload, field.key) as number),
  }));

  // Scalars — string, number, boolean, enum — become the two-column grid.
  const gridFields = fields.filter(
    (field) =>
      field.type !== "list" &&
      field.type !== "text" &&
      !statFields.includes(field) &&
      field.format !== "node_id"
  );

  const pairs = gridFields.map((field) => {
    if (field.type === "boolean") {
      return { label: field.label, value: (bool(payload, field.key) ? "Yes" : "No") as ReactNode };
    }
    if (field.type === "number") {
      const value = num(payload, field.key);
      return {
        label: field.label,
        value: (typeof value === "number" ? formatNumber(value) : CONFIGURATION_COPY.none) as ReactNode,
      };
    }
    if (field.format === "timestamp") {
      return { label: field.label, value: (formatDate(str(payload, field.key)) ?? CONFIGURATION_COPY.none) as ReactNode };
    }
    if (field.type === "enum") {
      return { label: field.label, value: <Chip>{str(payload, field.key)}</Chip> as ReactNode };
    }
    if (field.format === "url") {
      const url = str(payload, field.key) as string;
      return {
        label: field.label,
        value: (
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            /* Underlined at rest: colour alone fails WCAG 1.4.1, and `--action`
               is the token for somewhere to go. */
            style={{
              color: t.action,
              textDecoration: "underline",
              textUnderlineOffset: "3px",
              wordBreak: "break-all",
            }}
          >
            {url}
          </a>
        ) as ReactNode,
      };
    }
    return { label: field.label, value: str(payload, field.key) as ReactNode };
  });

  // Prose and structured text each get a labelled block of their own.
  const textFields = fields.filter((field) => field.type === "text");
  const referenceFields = fields.filter((field) => field.format === "node_id");
  const listFields = fields.filter((field) => field.type === "list");

  const handled = [
    ...statFields.map((field) => field.key),
    ...gridFields.map((field) => field.key),
    ...textFields.map((field) => field.key),
    ...referenceFields.map((field) => field.key),
    ...listFields.map((field) => field.key),
  ];

  return (
    <div data-visual-slot="renderer-configuration" style={{ minWidth: 0 }}>
      <Stack gap={14}>
        <StatRow stats={stats} />
        <KeyValueGrid pairs={pairs} />

        {textFields.map((field) => {
          const value = str(payload, field.key) as string;
          return (
            <Field key={field.key} label={field.label}>
              {looksStructured(value) ? (
                <MonoBlock text={value} collapseTo={12} />
              ) : (
                <Prose>{value}</Prose>
              )}
              {field.help ? <Caption>{field.help}</Caption> : null}
            </Field>
          );
        })}

        {referenceFields.map((field) => (
          <Field key={field.key} label={field.label}>
            <div>
              <NodeRef id={str(payload, field.key)} resolveNode={props.resolveNode} />
            </div>
          </Field>
        ))}

        {listFields.map((field) => {
          const records = rows(payload, field.key);
          return (
            <Field key={field.key} label={field.label}>
              <SampleTable members={field.of ?? []} records={records} cap={records.length} />
            </Field>
          );
        })}

        <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
      </Stack>
    </div>
  );
}

/**
 * A configuration is copied to be pasted into a config file, so the clipboard
 * gets its scalar fields as "label: value" lines. The default — first required
 * text field — would return nothing for model_params, which declares none.
 */
export const getCopyText: GetCopyText = (node, nodeType) => scalarsAsText(node, nodeType);

export default ConfigCard;

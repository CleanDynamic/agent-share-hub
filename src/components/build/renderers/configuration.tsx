// configuration — agent_config, and a shared card for model_params,
// tool_definition, integration and stack.
//
// ConfigCard serves four node types from one component. It does that WITHOUT
// switching on node.type: the shape it renders is read off the type's schema,
// so a fifth configuration type added to node_types renders here the day it is
// seeded, with no code change. Numbers become a two-column grid, prose stays
// prose, lists become tables, and a lone required string leads.

import {
  Caption,
  Chip,
  ChipRow,
  DetailGrid,
  MiniTable,
  MonoBlock,
  Prose,
  Revealable,
  Section,
  Stack,
} from "./shared";
import {
  bool,
  fieldsOf,
  formatDate,
  formatNumber,
  isPresent,
  joinCaption,
  labelFor,
  num,
  payloadOf,
  rowsOf,
  str,
  type Stat,
} from "./payload";
import { CATEGORY_COLOUR, TEXT_MUTED } from "../tokens";
import type { GetCopyText, NodeProps } from "./types";
import type { FieldDef } from "@/lib/build";

const AGENT = CATEGORY_COLOUR.agent;
const CONFIG = CATEGORY_COLOUR.configuration;

/** The system prompt is shown at reading length, not at full length. */
const COLLAPSED_LINES = 6;

function scalarValue(record: ReturnType<typeof payloadOf>, field: FieldDef): string | undefined {
  const raw = record[field.key];
  if (!isPresent(raw)) return undefined;
  if (field.type === "number" && typeof raw === "number") return formatNumber(raw);
  if (field.type === "boolean") return raw ? "Yes" : "No";
  if (field.format === "timestamp") return formatDate(String(raw));
  return String(raw);
}

// --- agent_config ------------------------------------------------------------

export function AgentConfigRenderer({ node, nodeType, resolveNode }: NodeProps) {
  const record = payloadOf(node);

  const systemPrompt = str(record, "system_prompt");
  const memory = str(record, "memory");
  const guardrails = rowsOf(record, "guardrails");

  // A node_id that points outside the placed tree resolves to nothing. The
  // reference is still shown, dimmed, rather than silently dropped.
  const tools = rowsOf(record, "tools").map((row) => {
    const ref = typeof row.tool_ref === "string" ? row.tool_ref : undefined;
    return { ref, node: resolveNode(ref) };
  });

  const params: Stat[] = [
    ["model", str(record, "model")],
    ["temperature", num(record, "temperature")],
    ["max_tokens", num(record, "max_tokens")],
    ["top_p", num(record, "top_p")],
  ]
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      label: labelFor(nodeType, key as string),
      value: typeof value === "number" ? formatNumber(value) : String(value),
    }));

  const passing = num(record, "test_passing");
  const total = num(record, "test_total");
  const runAt = formatDate(str(record, "test_run_at"));
  const tests =
    passing !== undefined && total !== undefined
      ? joinCaption([`${formatNumber(passing)}/${formatNumber(total)} passing`, runAt ? `run ${runAt}` : undefined])
      : undefined;

  return (
    <Stack>
      {systemPrompt ? (
        <Section label={labelFor(nodeType, "system_prompt", "System prompt")}>
          <Revealable
            text={systemPrompt}
            lines={COLLAPSED_LINES}
            accent={AGENT}
            label="system prompt"
          />
        </Section>
      ) : null}

      <DetailGrid items={params} />

      {tools.length > 0 ? (
        <Section label={labelFor(nodeType, "tools", "Tools")}>
          <ChipRow>
            {tools.map((tool, index) => (
              <Chip
                key={tool.ref ?? index}
                colour={tool.node ? AGENT : undefined}
                dim={!tool.node}
              >
                {tool.node ? tool.node.title : "Tool not in this build"}
              </Chip>
            ))}
          </ChipRow>
        </Section>
      ) : null}

      {guardrails.length > 0 ? (
        <Section label={labelFor(nodeType, "guardrails", "Guardrails")}>
          <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 4 }}>
            {guardrails.map((rule, index) => (
              <li key={index} style={{ color: AGENT }}>
                <Prose>{String(rule.rule ?? "")}</Prose>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {memory ? (
        <Section label={labelFor(nodeType, "memory", "Memory")}>
          <Prose dim>{memory}</Prose>
        </Section>
      ) : null}

      {tests ? <Caption>{tests}</Caption> : null}
    </Stack>
  );
}

// --- model_params, tool_definition, integration, stack -----------------------

export function ConfigCard({ node, nodeType }: NodeProps) {
  const record = payloadOf(node);
  const fields = fieldsOf(nodeType);

  const lead = fields.find(
    (field) => field.required && (field.type === "text" || field.type === "string")
  );

  const grid: Stat[] = [];
  const prose: Array<{ field: FieldDef; value: string }> = [];
  const code: Array<{ field: FieldDef; value: string }> = [];
  const lists: FieldDef[] = [];

  for (const field of fields) {
    if (field.key === lead?.key) continue;
    if (field.type === "list") {
      if (rowsOf(record, field.key).length > 0) lists.push(field);
      continue;
    }
    const value = scalarValue(record, field);
    if (value === undefined) continue;

    if (field.type === "text") {
      // A parameter schema or a return shape is written as JSON, not as prose.
      const looksStructured = /^[[{]/.test(value.trim());
      (looksStructured ? code : prose).push({ field, value });
      continue;
    }
    grid.push({ label: field.label, value });
  }

  const leadValue = lead ? scalarValue(record, lead) : undefined;

  return (
    <Stack>
      {leadValue ? (
        lead?.type === "text" ? (
          <Prose>{leadValue}</Prose>
        ) : (
          <Section label={lead?.label}>
            <Prose>{leadValue}</Prose>
          </Section>
        )
      ) : null}

      <DetailGrid items={grid} />

      {prose.map(({ field, value }) => (
        <Section key={field.key} label={field.label}>
          <Prose dim>{value}</Prose>
        </Section>
      ))}

      {code.map(({ field, value }) => (
        <Section key={field.key} label={field.label}>
          <MonoBlock text={value} accent={CONFIG} />
        </Section>
      ))}

      {lists.map((field) => {
        const rows = rowsOf(record, field.key);
        const members: FieldDef[] =
          field.of && field.of.length > 0
            ? field.of
            : [{ key: "value", label: field.label, type: "string" }];
        return (
          <Section key={field.key} label={field.label}>
            <MiniTable
              columns={members.map((member) => member.label)}
              rows={rows.map((row) =>
                members.map((member) =>
                  isPresent(row[member.key]) ? (
                    <span>{String(row[member.key])}</span>
                  ) : (
                    <span style={{ color: TEXT_MUTED }}>—</span>
                  )
                )
              )}
            />
          </Section>
        );
      })}

      {bool(record, "entrypoint") ? <Caption>Start reading here</Caption> : null}
    </Stack>
  );
}

/**
 * A configuration is copied to be pasted into a config file, so the clipboard
 * gets every scalar the creator filled in as `key: value` lines — not just the
 * first required string, which for model_params would be the model name alone.
 */
export const getCopyText: GetCopyText = (node, nodeType) => {
  const record = payloadOf(node);
  const lines = fieldsOf(nodeType)
    .filter((field) => field.type !== "list")
    .map((field) => {
      const value = scalarValue(record, field);
      return value === undefined ? null : `${field.key}: ${value}`;
    })
    .filter((line): line is string => line !== null);

  return lines.length > 0 ? lines.join("\n") : null;
};

/** agent_config copies the system prompt — the part anyone would want to run. */
export const getAgentConfigCopyText: GetCopyText = (node) =>
  str(payloadOf(node), "system_prompt") ?? null;

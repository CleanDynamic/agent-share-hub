// instruction — prompt and system_prompt.
//
// A prompt is text somebody will run. So it renders as text somebody can run:
// monospace, whitespace exactly as written, nothing wrapped around it that
// would end up on the clipboard. The copy control itself lives in NodeCard,
// which asks this module for the raw string through getCopyText below.
//
// Model and parameters are a caption, not a heading. They describe the
// conditions the prompt was run under; they are not the thing being read.

import {
  Caption,
  Chip,
  ChipRow,
  MiniTable,
  MonoBlock,
  Section,
  Stack,
} from "./shared";
import {
  formatDate,
  joinCaption,
  labelFor,
  payloadOf,
  rowsOf,
  str,
} from "./payload";
import { ORANGE, TEXT_MUTED } from "../tokens";
import type { GetCopyText, NodeProps } from "./types";

/** The one field both instruction types carry, and the only one copied. */
function promptText(record: ReturnType<typeof payloadOf>): string | undefined {
  return str(record, "text");
}

function Variables({ nodeType, rows }: { nodeType: NodeProps["nodeType"]; rows: ReturnType<typeof rowsOf> }) {
  if (rows.length === 0) return null;

  return (
    <Section label={labelFor(nodeType, "variables", "Variables")}>
      <MiniTable
        columns={["Name", "Description", "Example"]}
        rows={rows.map((row) => [
          <Chip colour={ORANGE}>{`{{${String(row.name ?? "")}}}`}</Chip>,
          <span>{String(row.description ?? "")}</span>,
          <span style={{ color: TEXT_MUTED }}>{String(row.example ?? "")}</span>,
        ])}
      />
    </Section>
  );
}

export function PromptRenderer({ node, nodeType, resolveNode }: NodeProps) {
  const record = payloadOf(node);
  const text = promptText(record);
  const output = resolveNode(str(record, "output_ref"));

  const caption = joinCaption([
    str(record, "model"),
    str(record, "params"),
    formatDate(str(record, "sent_at")),
  ]);

  return (
    <Stack>
      {text ? <MonoBlock text={text} accent={ORANGE} /> : null}
      {caption ? <Caption>{caption}</Caption> : null}
      <Variables nodeType={nodeType} rows={rowsOf(record, "variables")} />
      {output ? (
        <ChipRow>
          <Chip dim>{`Produced → ${output.title}`}</Chip>
        </ChipRow>
      ) : null}
    </Stack>
  );
}

export function SystemPromptRenderer({ node, nodeType }: NodeProps) {
  const record = payloadOf(node);
  const text = promptText(record);

  const caption = joinCaption([
    str(record, "model"),
    str(record, "version"),
    str(record, "scope"),
  ]);

  return (
    <Stack>
      {text ? <MonoBlock text={text} accent={ORANGE} /> : null}
      {caption ? <Caption>{caption}</Caption> : null}
      <Variables nodeType={nodeType} rows={rowsOf(record, "variables")} />
    </Stack>
  );
}

/** Raw prompt text and nothing else — no label, no fence, no trailing note. */
export const getCopyText: GetCopyText = (node) => promptText(payloadOf(node)) ?? null;

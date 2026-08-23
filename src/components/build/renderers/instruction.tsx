// instruction — prompt, system_prompt.
//
// The text IS the artefact here, so it gets the whole card: a monospace block
// with the creator's whitespace intact, its {{variables}} tinted, and the
// model and parameters demoted to a caption underneath. Nothing about the
// model is a heading; the prompt is the heading.
//
// The copy control is NodeCard's, not this module's — see getCopyText at the
// foot of the file, which hands NodeCard the raw text with no markup around
// it and no meta line appended.

import type { ReactNode } from "react";
import { ORANGE } from "../tokens";
import {
  Caption,
  Field,
  MonoBlock,
  NodeRef,
  type GetCopyText,
  type NodeProps,
  Rest,
  SampleTable,
  Stack,
  fieldsOf,
  formatDate,
  labelFor,
  payloadOf,
  rows,
  str,
  withVariablesHighlighted,
} from "./shared";

/** Meta that belongs on the quiet line rather than in a labelled block. */
const CAPTION_KEYS = ["model", "params", "version", "scope"];

/** The one list field these schemas declare. */
const VARIABLES_KEY = "variables";

/** Every reference out of an instruction node. */
const REFERENCE_KEYS = ["output_ref"];

function captionParts(props: NodeProps): string[] {
  const payload = payloadOf(props.node);
  const parts: string[] = [];

  for (const key of CAPTION_KEYS) {
    const value = str(payload, key);
    if (value) parts.push(value);
  }

  // Any timestamp the schema declares, named by its own label: "Sent at 28 Jul".
  for (const field of fieldsOf(props.nodeType)) {
    if (field.format !== "timestamp") continue;
    const value = formatDate(str(payload, field.key));
    if (value) parts.push(`${field.label} ${value}`);
  }

  return parts;
}

function timestampKeys(props: NodeProps): string[] {
  return fieldsOf(props.nodeType)
    .filter((field) => field.format === "timestamp")
    .map((field) => field.key);
}

function InstructionBody(props: NodeProps): ReactNode {
  const payload = payloadOf(props.node);
  const text = str(payload, "text");
  const variables = rows(payload, VARIABLES_KEY);
  const variableFields = fieldsOf(props.nodeType).find((field) => field.key === VARIABLES_KEY);
  const caption = captionParts(props);
  const references = REFERENCE_KEYS.filter((key) => str(payload, key));

  const handled = [
    "text",
    VARIABLES_KEY,
    ...CAPTION_KEYS,
    ...REFERENCE_KEYS,
    ...timestampKeys(props),
  ];

  return (
    <Stack gap={12} style={{ minWidth: 0 }}>
      {text ? (
        <MonoBlock text={text}>{withVariablesHighlighted(text, ORANGE)}</MonoBlock>
      ) : null}

      {caption.length > 0 ? <Caption>{caption.join(" · ")}</Caption> : null}

      {variables.length > 0 ? (
        <Field label={labelFor(props.nodeType, VARIABLES_KEY, "Variables")}>
          <SampleTable
            members={variableFields?.of ?? []}
            records={variables}
            cap={variables.length}
          />
        </Field>
      ) : null}

      {references.map((key) => (
        <Field key={key} label={labelFor(props.nodeType, key)}>
          <div>
            <NodeRef id={str(payload, key)} resolveNode={props.resolveNode} />
          </div>
        </Field>
      ))}

      <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
    </Stack>
  );
}

/** renderer key: "prompt" */
export function PromptRenderer(props: NodeProps) {
  return (
    <div data-visual-slot="renderer-prompt" style={{ minWidth: 0 }}>
      <InstructionBody {...props} />
    </div>
  );
}

/** renderer key: "instruction" — system_prompt, and any instruction type added later. */
export function SystemPromptRenderer(props: NodeProps) {
  return (
    <div data-visual-slot="renderer-instruction" style={{ minWidth: 0 }}>
      <InstructionBody {...props} />
    </div>
  );
}

/**
 * The clipboard gets the prompt and nothing else: no label, no model line, no
 * variables table. Someone copying a prompt is pasting it into a model.
 */
export const getCopyText: GetCopyText = (node) => str(payloadOf(node), "text") ?? null;

export default PromptRenderer;

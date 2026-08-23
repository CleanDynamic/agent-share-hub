// data — dataset, retrieval_config, data_schema, test_set.
//
// One renderer, four types, no switch on node.type. The emphasis is chosen by
// which field KEYS the schema declares:
//
//   dataset          record_count + format lead as a stat row
//   test_set         case_count leads the same way
//   retrieval_config top_k leads
//   data_schema      has no count, so the definition leads on its own
//
// The sample list is capped at five rows with the cap stated in words, because
// a truncated table that does not say it is truncated is a lie about the data.

import { TEXT_SECONDARY } from "../tokens";
import {
  Chip,
  ChipRow,
  Field,
  KeyValueGrid,
  MonoBlock,
  Prose,
  type GetCopyText,
  type NodeProps,
  Rest,
  SampleTable,
  StatRow,
  Stack,
  fieldsOf,
  firstRequiredTextField,
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

/** Counts that deserve to be a figure rather than a grid row, in this order. */
const COUNT_KEYS = ["record_count", "case_count", "top_k"];

/** Short scalars that belong beside the count, not in the body. */
const QUALIFIER_KEYS = ["format", "strategy"];

/** The lead prose field, whichever of these the schema declares. */
const LEAD_TEXT_KEYS = ["description", "definition"];

/** The capped list. Every data schema names it the same thing. */
const SAMPLE_KEY = "sample";

const SAMPLE_CAP = 5;

/** renderer key: "data" */
export function DataRenderer(props: NodeProps) {
  const payload = payloadOf(props.node);
  const fields = fieldsOf(props.nodeType).filter((field) => isPresent(payload[field.key]));

  const stats = COUNT_KEYS.filter((key) => typeof num(payload, key) === "number").map((key) => ({
    label: labelFor(props.nodeType, key),
    value: formatNumber(num(payload, key) as number),
  }));

  const qualifiers = QUALIFIER_KEYS.filter((key) => str(payload, key));
  const leadKey = LEAD_TEXT_KEYS.find((key) => str(payload, key));
  const leadText = leadKey ? (str(payload, leadKey) as string) : undefined;

  const sampleRecords = rows(payload, SAMPLE_KEY);
  const sampleField = fields.find((field) => field.key === SAMPLE_KEY);

  // Everything else scalar: chunk strategy, embedding model, licence, filters.
  const gridFields = fields.filter(
    (field) =>
      field.type !== "list" &&
      field.type !== "text" &&
      !COUNT_KEYS.includes(field.key) &&
      !QUALIFIER_KEYS.includes(field.key)
  );

  const remainingText = fields.filter(
    (field) => field.type === "text" && field.key !== leadKey
  );

  const handled = [
    ...COUNT_KEYS,
    ...QUALIFIER_KEYS,
    ...(leadKey ? [leadKey] : []),
    SAMPLE_KEY,
    ...gridFields.map((field) => field.key),
    ...remainingText.map((field) => field.key),
  ];

  return (
    <div data-visual-slot="renderer-data" style={{ minWidth: 0 }}>
      <Stack gap={14}>
        {stats.length > 0 || qualifiers.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 20 }}>
            <StatRow stats={stats} />
            {qualifiers.length > 0 ? (
              <ChipRow>
                {qualifiers.map((key) => (
                  <Chip key={key} title={labelFor(props.nodeType, key)}>
                    {str(payload, key)}
                  </Chip>
                ))}
              </ChipRow>
            ) : null}
          </div>
        ) : null}

        {leadText ? (
          looksStructured(leadText) ? (
            <Field label={labelFor(props.nodeType, leadKey as string)}>
              <MonoBlock text={leadText} collapseTo={14} />
            </Field>
          ) : (
            <Prose>{leadText}</Prose>
          )
        ) : null}

        {sampleRecords.length > 0 ? (
          <Field label={labelFor(props.nodeType, SAMPLE_KEY, "Sample")}>
            <SampleTable
              members={sampleField?.of ?? []}
              records={sampleRecords}
              cap={SAMPLE_CAP}
            />
          </Field>
        ) : null}

        {remainingText.map((field) => {
          const value = str(payload, field.key) as string;
          return (
            <Field key={field.key} label={field.label}>
              {looksStructured(value) ? (
                <MonoBlock text={value} collapseTo={12} />
              ) : (
                <Prose style={{ color: TEXT_SECONDARY }}>{value}</Prose>
              )}
            </Field>
          );
        })}

        <KeyValueGrid
          pairs={gridFields.map((field) => ({
            label: field.label,
            value:
              field.type === "number"
                ? formatNumber(num(payload, field.key) as number)
                : str(payload, field.key),
          }))}
        />

        <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
      </Stack>
    </div>
  );
}

/**
 * data_schema copies as its definition; retrieval_config, which declares no
 * required text field, copies as its scalar settings.
 */
export const getCopyText: GetCopyText = (node, nodeType) =>
  firstRequiredTextField(node, nodeType) ?? scalarsAsText(node, nodeType);

export default DataRenderer;

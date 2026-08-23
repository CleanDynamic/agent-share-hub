// narrative — note, decision, prerequisite, and the two red ones.
//
// breakage and gap are why this registry has a narrative category at all. A
// build that only shows what worked teaches nobody anything; these two carry
// what went wrong and what is still wrong, and they are the only nodes on the
// page permitted to use red.

import {
  Caption,
  Chip,
  ChipRow,
  DetailGrid,
  Prose,
  Section,
  Stack,
} from "./shared";
import {
  bool,
  fieldsOf,
  formatNumber,
  isPresent,
  joinCaption,
  labelFor,
  num,
  payloadOf,
  str,
  type Stat,
} from "./payload";
import { GAP_RED, TEXT_SECONDARY, bodyText, hexToRgba, labelText } from "../tokens";
import type { GetCopyText, NodeProps } from "./types";
import type { FieldDef } from "@/lib/build";

export function NarrativeRenderer({ node, nodeType }: NodeProps) {
  const record = payloadOf(node);
  const fields = fieldsOf(nodeType);

  const prose: Array<{ field: FieldDef; value: string }> = [];
  const grid: Stat[] = [];

  for (const field of fields) {
    const raw = record[field.key];
    if (!isPresent(raw)) continue;

    if (field.type === "text") {
      prose.push({ field, value: String(raw) });
      continue;
    }
    if (field.type === "boolean") {
      grid.push({ label: field.label, value: raw ? "Yes" : "No" });
      continue;
    }
    grid.push({
      label: field.label,
      value: field.type === "number" && typeof raw === "number" ? formatNumber(raw) : String(raw),
    });
  }

  // The first required text field is the note itself; it needs no label above
  // it, because the card's title already says what it is.
  const [lead, ...rest] = prose;

  return (
    <Stack>
      {bool(record, "optional") ? (
        <ChipRow>
          <Chip dim>optional</Chip>
        </ChipRow>
      ) : null}

      {lead ? <Prose>{lead.value}</Prose> : null}

      {rest.map(({ field, value }) => (
        <Section key={field.key} label={field.label}>
          <Prose dim>{value}</Prose>
        </Section>
      ))}

      <DetailGrid items={grid.filter((item) => item.label !== labelFor(nodeType, "optional"))} />
    </Stack>
  );
}

// --- breakage ----------------------------------------------------------------

/** One of the three parts of a failure, under a red rule. */
function BreakageSection({ label, children }: { label: string; children: string }) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${GAP_RED}`,
        paddingLeft: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ ...labelText, fontSize: 11, color: GAP_RED, textTransform: "uppercase" }}>
        {label}
      </span>
      <Prose>{children}</Prose>
    </div>
  );
}

export function BreakageRenderer({ node, nodeType }: NodeProps) {
  const record = payloadOf(node);

  // Symptom, cause, resolution — always in that order, because that is the
  // order somebody hitting the same failure will read them in.
  const parts: Array<{ key: string; value: string | undefined }> = [
    { key: "symptom", value: str(record, "symptom") },
    { key: "cause", value: str(record, "cause") },
    { key: "resolution", value: str(record, "resolution") },
  ];

  const attempts = num(record, "attempts");
  const start = num(record, "event_start");
  const end = num(record, "event_end");

  const caption = joinCaption([
    attempts !== undefined
      ? str(record, "resolution")
        ? `Resolved after ${formatNumber(attempts)} attempt${attempts === 1 ? "" : "s"}`
        : `${formatNumber(attempts)} attempt${attempts === 1 ? "" : "s"} so far`
      : undefined,
    start !== undefined && end !== undefined
      ? `events ${formatNumber(start)}–${formatNumber(end)}`
      : start !== undefined
        ? `from event ${formatNumber(start)}`
        : undefined,
  ]);

  return (
    <Stack>
      {parts.map((part) =>
        part.value ? (
          <BreakageSection key={part.key} label={labelFor(nodeType, part.key)}>
            {part.value}
          </BreakageSection>
        ) : null
      )}
      {caption ? <Caption>{caption}</Caption> : null}
    </Stack>
  );
}

// --- gap ---------------------------------------------------------------------

/**
 * The bounty primitive.
 *
 * A gap is an open invitation, so it is written as one: what is broken, what
 * has already been tried so nobody repeats it, and exactly what "solved" would
 * mean. The red callout is not a warning — it is the loudest thing on the page
 * because it is the part somebody else can act on.
 */
export function GapRenderer({ node, nodeType }: NodeProps) {
  const record = payloadOf(node);

  const problem = str(record, "problem");
  const tried = str(record, "what_i_tried");
  const criteria = str(record, "acceptance_criteria");
  const reward = str(record, "reward_note");

  return (
    <div
      data-gap-callout="true"
      style={{
        border: `1px solid ${hexToRgba(GAP_RED, 0.35)}`,
        background: hexToRgba(GAP_RED, 0.06),
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <span
        style={{
          ...labelText,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: GAP_RED,
        }}
      >
        Unsolved
      </span>

      {problem ? <Prose>{problem}</Prose> : null}

      {tried ? (
        <Section label={labelFor(nodeType, "what_i_tried", "What was tried")}>
          <Prose dim>{tried}</Prose>
        </Section>
      ) : null}

      {criteria ? (
        <div
          style={{
            border: `1px solid ${hexToRgba(GAP_RED, 0.28)}`,
            borderRadius: 8,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span style={{ ...labelText, fontSize: 11, color: GAP_RED }}>
            {labelFor(nodeType, "acceptance_criteria", "Solved when")}
          </span>
          <Prose>{criteria}</Prose>
        </div>
      ) : null}

      {reward ? (
        <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY, whiteSpace: "pre-wrap" }}>
          {reward}
        </p>
      ) : null}
    </div>
  );
}

/** Narrative copies the note itself — the first required text field. */
export const getCopyText: GetCopyText = (node, nodeType) => {
  const record = payloadOf(node);
  const lead = fieldsOf(nodeType).find((field) => field.required && field.type === "text");
  return lead ? str(record, lead.key) ?? null : null;
};

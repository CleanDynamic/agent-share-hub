// narrative — note, decision, breakage, prerequisite, gap.
//
// Two of these five carry the red: breakage, which is what went wrong and how
// it was fixed, and gap, which is what is still wrong. The gap card is the
// bounty primitive — it is read by someone deciding whether to take the
// problem on, so it states the problem, what has already been tried and what
// would count as solved, and it reads as an invitation rather than a warning.

import { GAP_RED, TEAL, TEXT_SECONDARY, bodyText } from "../tokens";
import {
  AccentSection,
  Caption,
  Callout,
  Chip,
  ChipRow,
  Field,
  Prose,
  type GetCopyText,
  type NodeProps,
  Rest,
  Stack,
  bool,
  fieldsOf,
  formatNumber,
  isPresent,
  labelFor,
  num,
  payloadOf,
  str,
} from "./shared";

// --- note, decision, prerequisite --------------------------------------------

/** renderer key: "narrative" */
export function NarrativeRenderer(props: NodeProps) {
  const payload = payloadOf(props.node);
  const fields = fieldsOf(props.nodeType).filter((field) => isPresent(payload[field.key]));

  const textFields = fields.filter((field) => field.type === "text");
  const flagFields = fields.filter((field) => field.type === "boolean");
  const [lead, ...supporting] = textFields;

  const handled = [
    ...textFields.map((field) => field.key),
    ...flagFields.map((field) => field.key),
  ];

  return (
    <div data-visual-slot="renderer-narrative" style={{ minWidth: 0 }}>
      <Stack gap={12}>
        {flagFields.length > 0 ? (
          <ChipRow>
            {flagFields.map((field) => (
              <Chip key={field.key}>
                {bool(payload, field.key) ? field.label : `Not ${field.label.toLowerCase()}`}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        {/* The lead text is the node's substance and needs no label above it —
            the card already carries the type pill and the title. */}
        {lead ? <Prose>{str(payload, lead.key)}</Prose> : null}

        {supporting.map((field) => (
          <Field key={field.key} label={field.label}>
            <Prose style={{ color: TEXT_SECONDARY }}>{str(payload, field.key)}</Prose>
          </Field>
        ))}

        <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
      </Stack>
    </div>
  );
}

// --- breakage ----------------------------------------------------------------

/** The three parts of a breakage, in the order they happened. */
const BREAKAGE_SECTIONS = ["symptom", "cause", "resolution"];

/** Event ordinals belong to the Run view (NS-P06), not to this card. */
const BREAKAGE_EVENT_KEYS = ["event_start", "event_end"];

/** renderer key: "breakage" */
export function BreakageRenderer(props: NodeProps) {
  const payload = payloadOf(props.node);
  const attempts = num(payload, "attempts");
  const resolution = str(payload, "resolution");

  const sections = BREAKAGE_SECTIONS.filter((key) => str(payload, key));

  const handled = [...BREAKAGE_SECTIONS, "attempts", ...BREAKAGE_EVENT_KEYS];

  return (
    <div data-visual-slot="renderer-breakage" style={{ minWidth: 0 }}>
      <Stack gap={12}>
        {sections.map((key) => (
          <AccentSection key={key} label={labelFor(props.nodeType, key)} colour={GAP_RED}>
            <Prose>{str(payload, key)}</Prose>
          </AccentSection>
        ))}

        {typeof attempts === "number" ? (
          <Caption>
            {resolution
              ? `Resolved after ${formatNumber(attempts)} ${attempts === 1 ? "attempt" : "attempts"}`
              : `${formatNumber(attempts)} ${attempts === 1 ? "attempt" : "attempts"} so far`}
          </Caption>
        ) : null}

        <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
      </Stack>
    </div>
  );
}

// --- gap ---------------------------------------------------------------------

const GAP_PROBLEM = "problem";
const GAP_TRIED = "what_i_tried";
const GAP_CRITERIA = "acceptance_criteria";
const GAP_REWARD = "reward_note";

/**
 * renderer key: "gap"
 *
 * An unsolved problem, stated well enough that a stranger could pick it up:
 * what is wrong, what has already failed so they do not repeat it, and the bar
 * that would settle whether they have solved it.
 */
export function GapRenderer(props: NodeProps) {
  const payload = payloadOf(props.node);

  const problem = str(payload, GAP_PROBLEM);
  const tried = str(payload, GAP_TRIED);
  const criteria = str(payload, GAP_CRITERIA);
  const reward = str(payload, GAP_REWARD);

  const handled = [GAP_PROBLEM, GAP_TRIED, GAP_CRITERIA, GAP_REWARD];

  return (
    <div data-visual-slot="renderer-gap" style={{ minWidth: 0 }}>
      <Callout colour={GAP_RED} heading="Unsolved">
        <Stack gap={12}>
          {problem ? <Prose>{problem}</Prose> : null}

          {tried ? (
            <Field label={labelFor(props.nodeType, GAP_TRIED, "What was tried")}>
              <Prose style={{ color: TEXT_SECONDARY }}>{tried}</Prose>
            </Field>
          ) : null}

          {criteria ? (
            <Field label={labelFor(props.nodeType, GAP_CRITERIA, "Acceptance criteria")}>
              {/* Teal, not red: this is the part someone can act on. */}
              <Prose style={{ color: bodyText.color as string }}>{criteria}</Prose>
              <Caption style={{ color: TEAL }}>
                Solve this and the build is finished.
              </Caption>
            </Field>
          ) : null}

          {reward ? (
            <Field label={labelFor(props.nodeType, GAP_REWARD, "Reward")}>
              <Prose style={{ color: TEXT_SECONDARY }}>{reward}</Prose>
            </Field>
          ) : null}

          <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
        </Stack>
      </Callout>
    </div>
  );
}

export default NarrativeRenderer;

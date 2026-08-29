// A solution's payload, checked against the gap node's type schema (NS-P50).
//
// WHY THIS IS NOT A NEW VALIDATOR. The six-type field dialect already has one
// implementation — coerceField and splitPayload in src/lib/build/buildfile.ts,
// written for NS-P32 — and a second one written here would be a second opinion
// about what a "number" field accepts. The two would agree on the day this was
// written and drift on the first day a field type gains a rule. So this reuses
// them, and only changes what happens to their findings.
//
// WHAT CHANGES BETWEEN A BUILD FILE AND A SOLUTION. A Build File import is a
// creator handing over their own transcript: a value the schema did not expect
// is kept as written, warned about, and shown to them in the review screen,
// because losing a creator's work to a strict parser is worse than storing a
// string where a number was declared. A bounty solution is a stranger's payload
// on its way into somebody else's build, with no review screen between it and
// the node it replaces — so the same finding that produces a warning there is a
// refusal here. Nothing is coerced silently that would not have been coerced
// silently there: "0.7" into a number field is the same value written
// differently and passes; "about 0.7" is a judgement and is refused.

import { coerceField, splitPayload, type FieldWarnings } from "@/lib/build/buildfile";
import type { FieldDef, NodePayload } from "@/lib/build/types";

export interface PayloadRejection {
  /** The warning code the field dialect raised, or the check that failed here. */
  code: string;
  message: string;
}

/**
 * The verdict, as a pair rather than a discriminated union: this project builds
 * with `strict: false`, where narrowing an `{ok: true} | {ok: false}` union by
 * its discriminant does not survive the compiler, and a result shape that only
 * type-checks under a stricter setting is a trap for the next caller.
 * `errors.length === 0` is the whole test.
 */
export interface PayloadCheck {
  /** Empty when the payload is good. */
  errors: PayloadRejection[];
  /** The COERCED payload. Meaningless while `errors` is non-empty. */
  payload: NodePayload;
}

/** Where the messages say the problem is. One phrase, used by every branch. */
const WHERE = "This solution";

/** Empty, for a required field, means absent — not "false" and not "0". */
function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * A payload for one node type, or the reasons it cannot be one.
 *
 * `fields` is passed in rather than fetched. getFieldsFor is async and caches
 * the registry per session, the caller has already resolved the gap node's type
 * to get here, and a pure function is the only version of this a test can drive
 * against a two-field schema.
 *
 * On success the returned payload is the COERCED one, not the input: a caller
 * that stores the input instead would store the "0.7" this accepted as a
 * string, and the node it eventually replaces declares a number.
 */
export function checkNodePayload(
  raw: unknown,
  fields: FieldDef[],
): PayloadCheck {
  const errors: PayloadRejection[] = [];

  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      payload: {},
      errors: [
        {
          code: "NOT_AN_OBJECT",
          message: `${WHERE} must be an object of the node type's fields.`,
        },
      ],
    };
  }

  const source = raw as Record<string, unknown>;

  // A node type with no declared fields accepts nothing rather than everything.
  // The alternative — waving through an arbitrary blob because the registry row
  // is empty — is how a payload that no renderer can read gets into a build.
  if (fields.length === 0) {
    if (Object.keys(source).length > 0) {
      errors.push({
        code: "NO_SCHEMA",
        message: `${WHERE} carries fields, but this node type declares none.`,
      });
    }
    return { payload: {}, errors };
  }

  // splitPayload is the reused half: it coerces every declared key through
  // coerceField and warns about every key the schema does not declare. Its
  // `extras` — the note lines a Build File import would have kept — are
  // deliberately dropped, because the UNKNOWN_FIELD warning they come with is
  // already a refusal here and nothing downstream will read them.
  const sink: FieldWarnings = { warnings: [] };
  const { payload } = splitPayload(source, fields, sink, WHERE);

  for (const warning of sink.warnings) {
    errors.push({ code: warning.code, message: warning.message });
  }

  for (const field of fields) {
    if (!field.required) continue;
    if (!(field.key in source) || isBlank(payload[field.key])) {
      errors.push({
        code: "MISSING_REQUIRED_FIELD",
        message: `${WHERE} is missing "${field.label || field.key}", which this node type requires.`,
      });
    }
  }

  return { payload: payload as NodePayload, errors };
}

/**
 * One value against one field, for a caller checking as it types.
 *
 * The same coercion the whole-payload check runs, exposed one field at a time
 * so an inspector can say "that is not a number" before a solver submits. It is
 * the NS-P32 helper unchanged; only the verdict is stated differently.
 */
export function checkNodeField(
  value: unknown,
  field: FieldDef,
): { value: unknown; errors: PayloadRejection[] } {
  const sink: FieldWarnings = { warnings: [] };
  const coerced = coerceField(value, field, sink, WHERE);
  return {
    value: coerced,
    errors: sink.warnings.map((w) => ({ code: w.code, message: w.message })),
  };
}

/** The rejections as one line, for a toast or a thrown message. */
export function payloadRejectionMessage(errors: PayloadRejection[]): string {
  return errors.map((e) => e.message).join(" ");
}

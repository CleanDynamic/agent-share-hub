// Presentation for a build_event's payload, shared by the replay and the
// breakage view.
//
// WHY THIS IS NOT A RENDERER
// --------------------------
// Nodes have a renderer registry: node_types.renderer picks the component and
// nothing in src/components/build/renderers switches on a type. Events have no
// equivalent and should not grow one — build_events.payload is deliberately
// loose, a jsonb bag whose useful keys differ by kind and whose shape the
// transcript parser is still free to widen.
//
// So an event's payload is presented the way an unregistered node's payload is
// presented: one lead line, then GenericPayload over whatever is left. A key
// nobody anticipated shows up unstyled but present, which is the same contract
// the node fallback keeps.

import type { FieldDef, BuildEvent, NodePayload } from "@/lib/build";
import { CATEGORY_COLOUR, GAP_RED, TEAL } from "./tokens";

/** Event kind -> the colour it borrows. Kinds are a fixed CHECK constraint. */
export const KIND_COLOUR: Record<string, string> = {
  prompt: CATEGORY_COLOUR.instruction,
  milestone: TEAL,
  breakage: GAP_RED,
  deploy: CATEGORY_COLOUR.artefact,
  note: CATEGORY_COLOUR.narrative,
};

export function kindColour(kind: string | null | undefined): string {
  return KIND_COLOUR[kind ?? ""] ?? CATEGORY_COLOUR.narrative;
}

/**
 * The keys worth a label, in the order they read best.
 *
 * Anything absent from this map still renders — it falls to the tail of the
 * field list under its own key. The map is about ordering and wording, never
 * about permission.
 */
const KNOWN: Array<[key: string, label: string, type: FieldDef["type"]]> = [
  ["text", "What happened", "text"],
  ["symptom", "Symptom", "text"],
  ["cause", "Cause", "text"],
  ["resolution", "Resolution", "text"],
  ["note", "Note", "text"],
  ["model", "Model", "string"],
  ["attempts", "Attempts", "number"],
  ["url", "URL", "string"],
];

const KNOWN_ORDER = new Map(KNOWN.map(([key], index) => [key, index]));

/** The one line a collapsed event shows. Null when the payload says nothing. */
export function eventLead(event: BuildEvent): { key: string; text: string } | null {
  const payload = asPayload(event.payload);
  for (const key of ["text", "symptom", "note", "resolution"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return { key, text: value.trim() };
  }
  return null;
}

export function asPayload(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

/** A payload value read as a trimmed string, or null. */
export function payloadText(payload: unknown, key: string): string | null {
  const value = asPayload(payload)[key];
  if (typeof value === "string") return value.trim() || null;
  return null;
}

/** A payload value read as a finite number, or null. */
export function payloadNumber(payload: unknown, key: string): number | null {
  const value = asPayload(payload)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

/**
 * Field definitions synthesised from the keys a payload actually carries.
 *
 * GenericPayload walks a schema, and an event has none — so this makes one out
 * of the payload, labelling the keys it recognises and passing the rest
 * through under their own names.
 */
export function eventFields(
  payload: unknown,
  { omit = [] }: { omit?: string[] } = {}
): FieldDef[] {
  const bag = asPayload(payload);
  const skip = new Set(omit);

  const fields: FieldDef[] = [];
  for (const [key, label, type] of KNOWN) {
    if (skip.has(key) || !(key in bag)) continue;
    fields.push(
      key === "url" ? { key, label, type: "string", format: "url" } : { key, label, type }
    );
  }

  for (const key of Object.keys(bag)) {
    if (skip.has(key) || KNOWN_ORDER.has(key)) continue;
    const value = bag[key];
    fields.push({
      key,
      label: key.replace(/_/g, " "),
      type: Array.isArray(value)
        ? "list"
        : typeof value === "number"
          ? "number"
          : typeof value === "boolean"
            ? "boolean"
            : typeof value === "string" && value.length > 120
              ? "text"
              : "string",
    });
  }

  return fields;
}

/** The payload as GenericPayload wants it. */
export function eventPayload(event: BuildEvent): NodePayload {
  return asPayload(event.payload) as NodePayload;
}

/** "28 Jul, 09:26". Falls back to the raw value rather than to nothing. */
export function eventTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

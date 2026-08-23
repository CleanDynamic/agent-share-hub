// Payload and schema readers.
//
// A payload is Json off the wire and a schema is the six-field-type dialect
// from NS-P02. These narrow one key at a time and return undefined rather than
// throwing, because a creator's half-filled node still has to render.
//
// Pure functions only — no JSX — so the renderer modules can import them
// without dragging a component module along.

import type { FieldDef, NodePayload, NodeType } from "@/lib/build";
import { CATEGORY_COLOUR } from "../tokens";

/** The monospace stack every code and prompt block uses. */
export const MONO_STACK = "'Courier New', ui-monospace, SFMono-Regular, monospace";

/** One label/value pair, as a stat, a grid row or a caption fragment. */
export interface Stat {
  label: string;
  value: string;
}

export type PayloadRecord = Record<string, unknown>;

export function payloadOf(node: { payload?: unknown }): PayloadRecord {
  const payload = node.payload as NodePayload | null | undefined;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as PayloadRecord)
    : {};
}

export function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

export function str(record: PayloadRecord, key: string): string | undefined {
  const value = record[key];
  if (typeof value === "string" && value.trim().length > 0) return value;
  return undefined;
}

export function num(record: PayloadRecord, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

export function bool(record: PayloadRecord, key: string): boolean {
  return record[key] === true;
}

/** A list field's rows, each narrowed to an object. Never throws on junk. */
export function rowsOf(record: PayloadRecord, key: string): PayloadRecord[] {
  const value = record[key];
  if (!Array.isArray(value)) return [];
  return value.map((row) =>
    row && typeof row === "object" && !Array.isArray(row)
      ? (row as PayloadRecord)
      : { value: row }
  );
}

// --- schema access -----------------------------------------------------------

export function fieldsOf(nodeType?: NodeType): FieldDef[] {
  return nodeType?.schema?.fields ?? [];
}

export function fieldMap(nodeType?: NodeType): Map<string, FieldDef> {
  return new Map(fieldsOf(nodeType).map((field) => [field.key, field]));
}

export function labelFor(nodeType: NodeType | undefined, key: string, fallback?: string): string {
  return fieldMap(nodeType).get(key)?.label ?? fallback ?? key;
}

/** The accent for a node's category, with the registry's per-row override. */
export function accentOf(nodeType?: NodeType): string {
  return (
    nodeType?.colour ??
    CATEGORY_COLOUR[nodeType?.category ?? ""] ??
    CATEGORY_COLOUR.narrative
  );
}

// --- formatting --------------------------------------------------------------

export function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

/** Joins the parts that are actually there with a middot. */
export function joinCaption(parts: Array<string | number | undefined | null>): string {
  return parts
    .filter((part) => part !== null && part !== undefined && String(part).trim().length > 0)
    .join(" · ");
}

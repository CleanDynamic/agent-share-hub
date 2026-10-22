// CA-15: the optional keys a tile's modal, Details and the tile itself read, all inside the node's own `payload`.
//
// NOTHING HERE IS A MIGRATION. Every key is optional: a key that is absent means "not given", and no key that existed
// before is renamed or dropped. A reader is defensive (anything that is not the shape it expects reads as absent); a
// writer (`cleanExtras`) refuses what is out of range with a plain sentence, and a null value takes the key off.
//
// PURE: no I/O. `setExtras` in `graph.ts` writes what `cleanExtras` returns.

import type { Json } from "@/integrations/supabase/types";

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** A trimmed string, or "" for anything else. */
export const clean = (value: unknown, max = Number.POSITIVE_INFINITY): string => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** A list of trimmed non-empty strings, each cut at `max`, at most `limit` of them. */
export const cleanList = (value: unknown, max: number, limit: number): string[] =>
  Array.isArray(value) ? value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim().slice(0, max)] : [])).slice(0, limit) : [];

/** One value per line, blanks dropped. */
export const linesOf = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** A finite number, or null. */
export const finite = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** How many columns a CSV or TSV's first line has, counting the delimiter that appears most (comma, tab, semicolon); null for an empty text or a single column. */
export function csvColumns(head: string): number | null {
  const first = head.split(/\r?\n/).find((line) => line.trim()) ?? "";
  if (!first) return null;
  const counts = [",", "\t", ";"].map((delimiter) => first.split(delimiter).length);
  const columns = Math.max(...counts);
  return columns > 1 ? columns : null;
}

/* ── a prompt: model settings and variables (P2) ── */

export const EFFORTS = ["default", "low", "high"] as const;
export type Effort = (typeof EFFORTS)[number];
export const EFFORT_LABEL: Record<Effort, string> = { default: "Default", low: "Low", high: "High" };

export const SETTINGS_INSTRUCTIONS_MAX = 2000;
export const SETTINGS_MODEL_MAX = 80;

/** What a prompt ran with. `payload.settings`; the older `payload.model` is left alone and read as the fallback. */
export interface PromptSettings {
  model: string;
  effort: Effort;
  instructions: string;
}

/** The settings as saved; null when none of the three was given (an effort of "default" is "not given"). */
export function settingsOf(raw: unknown): PromptSettings | null {
  if (!isRecord(raw)) return null;
  const model = clean(raw.model, SETTINGS_MODEL_MAX);
  const instructions = clean(raw.instructions, SETTINGS_INSTRUCTIONS_MAX);
  const effort = EFFORTS.includes(raw.effort as Effort) ? (raw.effort as Effort) : "default";
  return model || instructions || effort !== "default" ? { model, effort, instructions } : null;
}

export const VARIABLE_DESCRIPTION_MAX = 140;
export const VARIABLES_MAX = 40;

/** A variable: any `{name}` written in the text, with an optional line about it. */
export interface PromptVariable {
  name: string;
  description: string;
}

/** `{name}`: letters, digits, spaces, dots, dashes and underscores, so a JSON example is not read as a variable. */
const VARIABLE = /\{\s*([A-Za-z_][A-Za-z0-9_ .-]{0,59}?)\s*\}/g;

/** The variables a text names, once each, in the order they first appear. */
export function variableNamesIn(text: string): string[] {
  const seen: string[] = [];
  for (const match of text.matchAll(VARIABLE)) if (!seen.includes(match[1])) seen.push(match[1]);
  return seen;
}

/** The variables as saved: only those with a description are kept. */
export function variablesOf(raw: unknown): PromptVariable[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((entry) => {
      if (!isRecord(entry)) return [];
      const name = clean(entry.name, 60);
      return name ? [{ name, description: clean(entry.description, VARIABLE_DESCRIPTION_MAX) }] : [];
    })
    .slice(0, VARIABLES_MAX);
}

/** What the Variables row lists: each name found in the text, with its description when one was given. */
export function variablesFor(text: string, saved: readonly PromptVariable[]): PromptVariable[] {
  return variableNamesIn(text).map((name) => ({ name, description: saved.find((entry) => entry.name === name)?.description ?? "" }));
}

/** The text with the selected range wrapped in braces; null when the range holds nothing. */
export function markVariable(text: string, start: number, end: number): string | null {
  const from = Math.max(0, Math.min(start, end));
  const to = Math.min(text.length, Math.max(start, end));
  const picked = text.slice(from, to);
  if (!picked.trim()) return null;
  const lead = picked.length - picked.trimStart().length;
  const trail = picked.length - picked.trimEnd().length;
  return `${text.slice(0, from + lead)}{${picked.trim()}}${text.slice(to - trail)}`;
}

/* ── the writer ── */

type Cleaner = (value: unknown) => Json | null;

/** The keys each node type's extras write, and how each is cleaned: a cleaner returns the value to store, or null to take the key off. */
const CLEANERS: Record<string, Record<string, Cleaner>> = {
  prompt: {
    settings: (value) => {
      const raw = isRecord(value) ? value : {};
      if (clean(raw.instructions).length > SETTINGS_INSTRUCTIONS_MAX) throw new Error(`The custom instructions are at most ${SETTINGS_INSTRUCTIONS_MAX} characters.`);
      const settings = settingsOf(raw);
      return settings ? { model: settings.model, effort: settings.effort, instructions: settings.instructions } : null;
    },
    variables: (value) => {
      const list = variablesOf(value).filter((entry) => entry.description);
      return list.length > 0 ? list.map((entry) => ({ name: entry.name, description: entry.description })) : null;
    },
  },
};

/** Registers the cleaners for another node type. Each part of CA-15 adds its own below. */
export function addCleaners(type: string, cleaners: Record<string, Cleaner>): void {
  CLEANERS[type] = { ...CLEANERS[type], ...cleaners };
}

/** The patch as it will be stored. Throws, with a plain sentence, for a key the type does not take or a value out of range. */
export function cleanExtras(type: string, patch: Record<string, unknown>): Record<string, Json | null> {
  const known = CLEANERS[type];
  if (!known) throw new Error("That has no more fields to change.");
  const out: Record<string, Json | null> = {};
  for (const [key, value] of Object.entries(patch)) {
    const cleaner = known[key];
    if (!cleaner) throw new Error("That is not a field of this piece.");
    out[key] = cleaner(value);
  }
  return out;
}

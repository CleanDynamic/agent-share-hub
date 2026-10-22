/* CA-16 P2 — what is computed from a classification: its `facets` array, the Regulated area flag, the old `shape`.

   PURE. The `facets` array is rebuilt from `classification` on every save, so it can never disagree with it. */

import type { BuildShape } from "@/lib/build/types";

import { ancestorsOf, isKnown, REGULATED_DATA, REGULATED_FIELD_ROOTS, TAXONOMY_VERSION, DERIVED_FACETS, type Facet } from "./taxonomy";
import { isCustomEntry, type Classification, type Declared, type Entry, type Provenance } from "./types";

export const CUSTOM_PREFIX = "custom:";

const EMPTY_DECLARED: Declared = { field: [], task: [], setting: [], data: [], age: null, stack: [] };

export function emptyClassification(): Classification {
  return { version: TAXONOMY_VERSION, declared: { ...EMPTY_DECLARED, field: [], task: [], setting: [], data: [], stack: [] }, derived: {}, disputes: {}, questions_dismissed: [] };
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

function entriesOf(value: unknown): Entry[] {
  if (!Array.isArray(value)) return [];
  const out: Entry[] = [];
  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const primary = raw.primary === true ? ({ primary: true } as const) : null;
    if (typeof raw.id === "string" && raw.id) out.push({ id: raw.id, ...primary });
    else if (typeof raw.custom === "string" && raw.custom.trim()) out.push({ custom: raw.custom.trim(), ...primary });
  }
  return out;
}

/** What the column holds, read defensively: anything that is not a classification reads as an empty one. */
export function readClassification(raw: unknown): Classification {
  const out = emptyClassification();
  if (!isRecord(raw)) return out;
  if (typeof raw.version === "number") out.version = raw.version;
  if (isRecord(raw.declared)) {
    const declared = raw.declared;
    out.declared = {
      field: entriesOf(declared.field),
      task: entriesOf(declared.task),
      setting: entriesOf(declared.setting),
      data: entriesOf(declared.data),
      age: typeof declared.age === "string" && declared.age ? declared.age : null,
      stack: entriesOf(declared.stack),
    };
  }
  if (isRecord(raw.derived)) {
    for (const [facet, value] of Object.entries(raw.derived)) {
      if (isRecord(value)) out.derived[facet as Facet] = { values: strings(value.values), from: strings(value.from) };
    }
  }
  if (isRecord(raw.disputes)) {
    for (const [facet, value] of Object.entries(raw.disputes)) {
      if (isRecord(value)) out.disputes[facet as Facet] = { values: strings(value.values), reason: typeof value.reason === "string" ? value.reason : "", at: typeof value.at === "string" ? value.at : "" };
    }
  }
  out.questions_dismissed = strings(raw.questions_dismissed);
  return out;
}

/** True when the maker has said anything, or a derived value is stored. */
export const hasClassification = (c: Classification): boolean => {
  const d = c.declared;
  return d.field.length + d.task.length + d.setting.length + d.data.length + d.stack.length > 0 || d.age !== null || Object.keys(c.derived).length > 0 || Object.keys(c.disputes).length > 0;
};

/** A derived facet's values after any dispute: the disputed values replace the derived ones. */
export function shownValues(c: Classification, facet: Facet): { values: string[]; provenance: Provenance } {
  const dispute = c.disputes[facet];
  if (dispute && dispute.values.length > 0) return { values: dispute.values, provenance: "stated" };
  const derived = c.derived[facet]?.values ?? [];
  return { values: derived, provenance: derived.length > 0 ? "derived" : "none" };
}

const add = (out: Set<string>, facet: Facet, id: string) => {
  if (!id.startsWith(CUSTOM_PREFIX) && isKnown(facet, id)) out.add(`${facet}:${id}`);
};

/** A value and every ancestor of it: a Field brings its Domain or Area, a Task its group, a Setting its group, a tool its group. */
const addWithAncestors = (out: Set<string>, facet: Facet, id: string) => {
  add(out, facet, id);
  for (const ancestor of ancestorsOf(id, facet)) add(out, facet, ancestor);
};

/**
 * The `facets` array: `<facet>:<id>`. A Field value brings every ancestor, so filtering by an Area or a Domain finds
 * everything beneath it; Task, Setting and Tools and stack bring their group the same way, so a group's count is the
 * number of builds and not a sum. Custom entries never appear. A dispute replaces the derived value.
 */
export function computeFacets(c: Classification): string[] {
  const out = new Set<string>();
  const { declared } = c;
  for (const facet of ["field", "task", "setting", "stack"] as const) {
    for (const entry of declared[facet]) if (!isCustomEntry(entry)) addWithAncestors(out, facet, entry.id);
  }
  for (const entry of declared.data) if (!isCustomEntry(entry)) add(out, "data", entry.id);
  if (declared.age) add(out, "age", declared.age);
  for (const facet of DERIVED_FACETS) {
    for (const id of shownValues(c, facet).values) addWithAncestors(out, facet, id);
  }
  return [...out].sort();
}

/** Regulated area: a Field under Medicine and health, Law, Finance and investing or Quantitative finance; or Health, Student or child, or Financial data. */
export function regulatedArea(c: Classification): boolean {
  const fieldHit = c.declared.field.some((entry) => !isCustomEntry(entry) && REGULATED_FIELD_ROOTS.includes(entry.id.split(".")[0]));
  const dataHit = c.declared.data.some((entry) => !isCustomEntry(entry) && REGULATED_DATA.includes(entry.id));
  return fieldHit || dataHit;
}

const SHAPE_OF_BUILT: Record<string, BuildShape> = {
  "web-app": "app",
  "mobile-app": "app",
  game: "app",
  "autonomous-agent": "agent",
  "multi-agent-system": "agent",
  "automation-workflow": "workflow",
  "prompt-library": "prompt",
  dataset: "dataset",
  "image-set": "media",
  video: "media",
  audio: "media",
};

/** The old `shape` a What was built value gives, or null to leave `shape` unchanged. The first value that maps wins. */
export function shapeFromBuilt(built: readonly string[]): BuildShape | null {
  for (const id of built) if (SHAPE_OF_BUILT[id]) return SHAPE_OF_BUILT[id];
  return null;
}

/** The custom entries of a classification, as `{ facet, text }`, for review. */
export function customEntriesOf(c: Classification): { facet: Facet; text: string }[] {
  const out: { facet: Facet; text: string }[] = [];
  for (const facet of ["field", "task", "setting", "data", "stack"] as const) {
    for (const entry of c.declared[facet]) if (isCustomEntry(entry)) out.push({ facet, text: entry.custom });
  }
  for (const [facet, derived] of Object.entries(c.derived)) {
    for (const value of derived?.values ?? []) if (value.startsWith(CUSTOM_PREFIX)) out.push({ facet: facet as Facet, text: value.slice(CUSTOM_PREFIX.length) });
  }
  return out;
}

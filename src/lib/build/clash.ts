// clash: what changed in two places at once, worked out from three versions (CA-23 P4). PURE.
//
// A CLASH is one thing (a tile, a session, a part, the post, a field of the build) that this tab has an edit to and that was
// changed somewhere else too, to something different. The three versions are `base` (what this tab last knew), `mine` (what it
// is writing) and `theirs` (what the database holds now). A change made in only one place is not a clash: it merges.
//
//   - a tile: the row's `title`, `note` and `payload`, field by field;
//   - the build's `making`: the top-level keys, and inside `sessions_meta` each session, inside `workstreams` each part;
//   - everything else of the build (the post, the title ...): the whole value.

import type { BuildNode } from "./types";

type Obj = Record<string, unknown>;
const asObject = (value: unknown): Obj => (value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {});

/** JSON with the keys in order, so two objects that say the same thing compare equal. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out: Obj = {};
    for (const key of Object.keys(value as Obj).sort()) if ((value as Obj)[key] !== undefined) out[key] = canonical((value as Obj)[key]);
    return out;
  }
  return value === undefined ? null : value;
}

export const same = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/* ── tiles ── */

/** What of a node row is its contents, not its place: what two tabs can disagree about. */
export function nodeContent(row: Pick<BuildNode, "title" | "note" | "payload">): Obj {
  return { title: row.title ?? null, note: row.note ?? null, ...flatPayload(row.payload) };
}

function flatPayload(payload: unknown): Obj {
  const out: Obj = {};
  for (const [key, value] of Object.entries(asObject(payload))) out[`payload.${key}`] = value;
  return out;
}

/** The fields of two versions that differ, in the order they first appear, as { key, mine, theirs } (a missing field is null). */
export function differingFields(mine: Obj, theirs: Obj): { key: string; mine: unknown; theirs: unknown }[] {
  const keys = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])];
  return keys.filter((key) => !same(mine[key], theirs[key])).map((key) => ({ key, mine: mine[key] ?? null, theirs: theirs[key] ?? null }));
}

/** Whether two tabs disagree about a tile: the fields where theirs left base and mine left base and mine is not theirs. */
export function tileConflict(base: Obj, mine: Obj, theirs: Obj): { key: string; mine: unknown; theirs: unknown }[] {
  return differingFields(mine, theirs).filter(({ key }) => !same(theirs[key], base[key]) && !same(mine[key], base[key]));
}

/* ── labels ── */

const LABELS: Record<string, string> = {
  title: "Title",
  note: "Note",
  "payload.text": "Text",
  "payload.prompt": "Prompt",
  "payload.model": "Model",
  "payload.tool": "Tool",
  "payload.name": "Name",
  "payload.body": "Text",
  "payload.session": "Session",
  "payload.colour": "Colour",
  outcome: "Description",
};

/** "payload.first_result" → "First result": the field's name, in a word or two, for a panel. */
export function fieldLabel(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const last = key.split(".").pop() ?? key;
  const spaced = last.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A value as the words a panel shows: text as it is, anything else as short JSON. */
export function valueWords(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/* ── the build's own row ── */

export interface FieldClash {
  /** The column ("title", "post_doc" ...). */
  key: string;
  mine: unknown;
  theirs: unknown;
}

export interface MakingClash {
  kind: "session" | "part";
  /** The session's key, or the part's. */
  key: string;
  mine: unknown;
  theirs: unknown;
}

export interface MakingMerge {
  /** Mine where only mine changed, theirs where only theirs did, and theirs where both did (the clash decides). */
  merged: Obj;
  clashes: MakingClash[];
}

/** Items of a list by `key`. */
const byKey = (list: unknown): Map<string, Obj> => new Map((Array.isArray(list) ? list : []).filter((item) => item && typeof item === "object" && typeof (item as Obj).key === "string").map((item) => [(item as Obj).key as string, item as Obj]));

/**
 * Three versions of `making`. Per top-level key: if only one place changed it, that is the value; if both did and differ,
 * a session (inside `sessions_meta`) or a part (inside `workstreams`) is merged item by item and any other key takes mine
 * (the clash windows are for the things the maker names: sessions, parts, tiles, the post).
 */
export function mergeMaking(base: unknown, mine: unknown, theirs: unknown): MakingMerge {
  const b = asObject(base);
  const m = asObject(mine);
  const t = asObject(theirs);
  const merged: Obj = { ...t };
  const clashes: MakingClash[] = [];

  for (const key of new Set([...Object.keys(m), ...Object.keys(t)])) {
    const mineChanged = !same(m[key], b[key]);
    const theirsChanged = !same(t[key], b[key]);
    if (!mineChanged) {
      // Only theirs (or neither) changed it.
      if (key in t) merged[key] = t[key];
      else delete merged[key];
      continue;
    }
    if (!theirsChanged || same(m[key], t[key])) {
      if (key in m) merged[key] = m[key];
      else delete merged[key];
      continue;
    }
    // Both changed it, to different things.
    if (key === "sessions_meta") {
      const sb = asObject(b[key]);
      const sm = asObject(m[key]);
      const st = asObject(t[key]);
      const out: Obj = { ...st };
      for (const session of new Set([...Object.keys(sm), ...Object.keys(st)])) {
        const mineHas = !same(sm[session], sb[session]);
        const theirsHas = !same(st[session], sb[session]);
        if (!mineHas || same(sm[session], st[session])) continue;
        if (!theirsHas) {
          if (session in sm) out[session] = sm[session];
          else delete out[session];
        } else clashes.push({ kind: "session", key: session, mine: sm[session] ?? null, theirs: st[session] ?? null });
      }
      merged[key] = out;
    } else if (key === "workstreams") {
      const pb = byKey(b[key]);
      const pm = byKey(m[key]);
      const pt = byKey(t[key]);
      const order = [...new Set([...(Array.isArray(t[key]) ? (t[key] as Obj[]).map((part) => part.key as string) : []), ...pm.keys()])];
      const out: Obj[] = [];
      for (const part of order) {
        const mineHas = !same(pm.get(part), pb.get(part));
        const theirsHas = !same(pt.get(part), pb.get(part));
        if (!mineHas || same(pm.get(part), pt.get(part))) {
          if (pt.has(part)) out.push(pt.get(part) as Obj);
        } else if (!theirsHas) {
          if (pm.has(part)) out.push(pm.get(part) as Obj);
        } else {
          clashes.push({ kind: "part", key: part, mine: pm.get(part) ?? null, theirs: pt.get(part) ?? null });
          if (pt.has(part)) out.push(pt.get(part) as Obj);
        }
      }
      merged[key] = out;
    } else if (key in m) merged[key] = m[key];
    else delete merged[key];
  }
  return { merged, clashes };
}

/**
 * Which of the keys a patch writes to the build's row collide with a change made elsewhere. A key is a clash when this tab
 * changes it (mine is not base) and so did the other place (theirs is not base) and they are not the same.
 */
export function rowClashes(base: Obj, patch: Obj, theirs: Obj): FieldClash[] {
  return Object.keys(patch)
    .filter((key) => key !== "making" && !same(patch[key], base[key]) && !same(theirs[key], base[key]) && !same(patch[key], theirs[key]))
    .map((key) => ({ key, mine: patch[key], theirs: theirs[key] ?? null }));
}

/* ── a tile, merged ── */

const PLACE = ["parent_id", "position"] as const;

/** A row with some of its content fields set (`title`, `note`, `payload.x`); a field set to null leaves the payload. */
export function applyFields<T extends Pick<BuildNode, "title" | "note" | "payload">>(row: T, fields: Obj): T {
  const out = { ...row } as T & Obj;
  const payload = { ...asObject(row.payload) };
  for (const [key, value] of Object.entries(fields)) {
    if (key === "title" || key === "note") out[key] = value as never;
    else if (key.startsWith("payload.")) {
      const name = key.slice("payload.".length);
      if (value === null || value === undefined) delete payload[name];
      else payload[name] = value;
    }
  }
  out.payload = payload as never;
  return out;
}

export interface TileMerge {
  /** The row to write: mine where only mine changed, theirs where only theirs did, theirs where both did. */
  row: BuildNode;
  /** The fields both changed, to different things. */
  conflicts: { key: string; mine: unknown; theirs: unknown }[];
}

/** Three versions of a node row. Its place follows whoever moved it last (mine, if both did). */
export function mergeTile(base: BuildNode, mine: BuildNode, theirs: BuildNode): TileMerge {
  const b = nodeContent(base);
  const m = nodeContent(mine);
  const t = nodeContent(theirs);
  const conflicts = tileConflict(b, m, t);
  const fields: Obj = {};
  for (const key of new Set([...Object.keys(m), ...Object.keys(t)])) {
    const mineChanged = !same(m[key], b[key]);
    fields[key] = mineChanged && (same(t[key], b[key]) || same(m[key], t[key])) ? (m[key] ?? null) : (t[key] ?? null);
  }
  for (const key of Object.keys(b)) if (!(key in fields)) fields[key] = null;
  let row = applyFields({ ...theirs } as BuildNode, fields);
  for (const key of PLACE) {
    const mineMoved = !same(mine[key], base[key]);
    row = { ...row, [key]: mineMoved ? mine[key] : theirs[key] };
  }
  return { row, conflicts };
}

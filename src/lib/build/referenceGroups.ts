// referenceGroups: single colours and reference groups (CA-19 P1). PURE.
//
// TWO WAYS TO COLOUR, BOTH OPTIONAL. A single colour sits on one component where CA-06 and CA-17 put it: a tile's
// `payload.colour`, a session's `making.sessions_meta[key].colour`, a part's `making.workstreams[].colour`. A reference
// group is one colour shared by two or more components, with an optional name and notes, kept in
// `making.reference_groups` in the maker's order. "Component" is this file's word for a part, a session or a tile; the
// screen always names the real thing ("Part B", "Session 2", "Code 4").
//
// EXACTLY ONE OF THREE STATES. A component is uncoloured, has a single colour, or is in one group. A member shows its
// group's colour even if an old single colour is still stored on it, and a tile never takes its session's or its part's.
//
// THE SIZE RULE. A saved group has two or more members. When one falls to one member (one is removed, or its tile,
// session or part is deleted) the group goes and that member keeps the group's colour as its single colour; the name
// and the notes go too. That is one step, with Undo, like every move here.
//
// EVERY MOVE returns the writes it needs and the writes that undo it. Nothing is fetched and nothing is written here; the
// composer hands the writes to the existing writers. Saved data is never rewritten on read: a value that does not read
// is left where it is and not shown.

import { groupKey, type SessionGroup, type Step } from "./graph";
import { sessionsMetaOf, storedWorkstreamsOf } from "./making";
import { parseRefTo, refTo } from "./thread";
import { normaliseHex } from "@/lib/theme/partColour";

/* ── what is stored ── */

export interface ReferenceGroup {
  /** `rg-<uuid>`. */
  id: string;
  /** `#RRGGBB`, through normaliseHex. */
  colour: string;
  /** 1 to 40 characters, trimmed. */
  name?: string;
  /** Up to 2,000 characters. */
  notes?: string;
  /** `node:<id>`, `session:<key>` or `workstream:<key>`, in the maker's order. */
  members: string[];
}

export const REFERENCE_GROUP_PREFIX = "rg-";
export const GROUP_NAME_MAX = 40;
export const GROUP_NOTES_MAX = 2000;
/** A saved group has at least this many members. */
export const GROUP_MIN_MEMBERS = 2;

/** A group's id: `rg-` and a uuid, in the shape a link's `to` can carry. */
const GROUP_ID = /^rg-[A-Za-z0-9][A-Za-z0-9_-]{0,76}$/;

/** A new group's id. */
export function newGroupId(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  return `${REFERENCE_GROUP_PREFIX}${uuid}`;
}

/** The `to` of a link to a group. */
export const groupTo = (id: string): string => refTo({ kind: "group", id });

/** Whether a ref names a component a group can hold: a tile, a session or a part. */
export function isMemberRef(ref: unknown): ref is string {
  const target = parseRefTo(ref);
  return Boolean(target && target.kind !== "group");
}

/** A group name as it is kept: trimmed, empty as none, cut at 40. */
export function cleanGroupName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, GROUP_NAME_MAX) : undefined;
}

/** Notes as they are kept: empty as none, cut at 2,000. */
export function cleanNotes(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.slice(0, GROUP_NOTES_MAX);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * `making.reference_groups`, read defensively, in the maker's order. A group with no readable id or colour, or a
 * repeated id, is skipped; members that are not a component's ref, or repeat, are left out; a component already in an
 * earlier group is left out of the later one, so each is in one group at most. A group left with fewer than two members
 * is still returned: what it shows is `colourStateOf`'s, and the composer folds it with `pruneGroups`.
 */
export function referenceGroupsOf(making: unknown): ReferenceGroup[] {
  const raw = asObject(making).reference_groups;
  if (!Array.isArray(raw)) return [];
  const ids = new Set<string>();
  const taken = new Set<string>();
  const out: ReferenceGroup[] = [];
  for (const value of raw) {
    const entry = asObject(value);
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const colour = normaliseHex(entry.colour);
    if (!GROUP_ID.test(id) || ids.has(id) || !colour) continue;
    ids.add(id);
    const members: string[] = [];
    for (const member of Array.isArray(entry.members) ? entry.members : []) {
      if (!isMemberRef(member) || taken.has(member)) continue;
      taken.add(member);
      members.push(member);
    }
    const group: ReferenceGroup = { id, colour, members };
    const name = cleanGroupName(entry.name);
    if (name) group.name = name;
    const notes = cleanNotes(entry.notes);
    if (notes) group.notes = notes;
    out.push(group);
  }
  return out;
}

/** `making.single_colour_order`, read defensively: component refs, once each. */
export function singleColourOrderOf(making: unknown): string[] | undefined {
  const raw = asObject(making).single_colour_order;
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const ref of raw) if (isMemberRef(ref) && !out.includes(ref)) out.push(ref);
  return out;
}

/** Why a list of groups cannot be saved, or null. */
export function referenceGroupsRefusal(groups: readonly ReferenceGroup[]): string | null {
  const ids = new Set<string>();
  const taken = new Set<string>();
  for (const group of groups) {
    if (!GROUP_ID.test(group.id)) return "That group is not saved yet.";
    if (ids.has(group.id)) return "Two groups have the same id.";
    ids.add(group.id);
    if (normaliseHex(group.colour) !== group.colour) return "A colour is written like #7FA7D9.";
    if (group.name !== undefined && (group.name.trim() !== group.name || !group.name || group.name.length > GROUP_NAME_MAX)) return `A group name is 1 to ${GROUP_NAME_MAX} characters.`;
    if (group.notes !== undefined && group.notes.length > GROUP_NOTES_MAX) return `Notes are at most ${GROUP_NOTES_MAX.toLocaleString("en-US")} characters.`;
    if (group.members.length < GROUP_MIN_MEMBERS) return "A group needs two or more components";
    for (const member of group.members) {
      if (!isMemberRef(member)) return "A group holds parts, sessions and tiles only.";
      if (taken.has(member)) return "A component is in one group at most.";
      taken.add(member);
    }
  }
  return null;
}

/* ── the colours as they stand ── */

/** What the composer reads colours from: the build's tiles (each with its own `payload.colour`), and `making`. */
export type ColourNodes = readonly { id: string; colour?: string | null }[];

export interface ColourModel {
  /** `making.reference_groups`, as read. */
  groups: ReferenceGroup[];
  /** Every stored single colour, by ref, members' stale ones included. */
  singles: Record<string, string>;
  /** `making.single_colour_order`, when the maker has set one. */
  order?: string[];
}

/** The build's colours: its groups, every stored single colour, and the maker's order of single colours. */
export function colourModelOf(making: unknown, nodes: ColourNodes): ColourModel {
  const singles: Record<string, string> = {};
  for (const node of nodes) {
    const hex = normaliseHex(node.colour);
    if (hex) singles[refTo({ kind: "node", id: node.id })] = hex;
  }
  for (const [key, meta] of Object.entries(sessionsMetaOf(making))) if (meta.colour) singles[refTo({ kind: "session", id: key })] = meta.colour;
  for (const part of storedWorkstreamsOf(making)) if (part.colour) singles[refTo({ kind: "workstream", id: part.key })] = part.colour;
  const order = singleColourOrderOf(making);
  return { groups: referenceGroupsOf(making), singles, ...(order ? { order } : null) };
}

export type ColourStateName = "none" | "single" | "group";

export interface ColourState {
  state: ColourStateName;
  colour: string | null;
  group?: ReferenceGroup;
}

/** The group a component is in, or undefined. A group of one is not a group: it shows as its member's single colour. */
export function groupOf(model: Pick<ColourModel, "groups">, ref: string): ReferenceGroup | undefined {
  return model.groups.find((group) => group.members.length >= GROUP_MIN_MEMBERS && group.members.includes(ref));
}

/** What a component shows, in a model. */
export function stateIn(model: ColourModel, ref: string): ColourState {
  const group = groupOf(model, ref);
  if (group) return { state: "group", colour: group.colour, group };
  // A group fallen to one member shows its colour as that member's single colour, as the size rule will make it.
  const alone = model.groups.find((candidate) => candidate.members.length < GROUP_MIN_MEMBERS && candidate.members.includes(ref));
  if (alone) return { state: "single", colour: alone.colour };
  const single = model.singles[ref];
  return single ? { state: "single", colour: single } : { state: "none", colour: null };
}

/** What a component shows: uncoloured, a single colour, or its group's. */
export function colourStateOf(ref: string, making: unknown, nodes: ColourNodes): ColourState {
  return stateIn(colourModelOf(making, nodes), ref);
}

/** The other components with this single colour, for the picker's "Also used by" line. Members of groups are not counted. */
export function alsoUsedBy(model: ColourModel, hex: string | null, except: string): string[] {
  const colour = normaliseHex(hex);
  if (!colour) return [];
  return Object.keys(model.singles).filter((ref) => ref !== except && stateIn(model, ref).state === "single" && stateIn(model, ref).colour === colour);
}

/** The single colours, in the maker's order, then the rest in build order. `buildOrder` lists every component that is in the build. */
export function singlesInOrder(model: ColourModel, buildOrder: readonly string[]): string[] {
  const live = new Set(buildOrder);
  const single = (ref: string) => live.has(ref) && stateIn(model, ref).state === "single";
  const first = (model.order ?? []).filter(single);
  return [...first, ...buildOrder.filter((ref) => single(ref) && !first.includes(ref))];
}

/* ── the moves ── */

/** What a move writes. */
export interface ColourWrites {
  /** Single colours to set, or (null) take off, by ref. */
  singles: Record<string, string | null>;
  /** The whole list of groups, when it changes. */
  groups?: ReferenceGroup[];
  /** `single_colour_order`, when it changes. */
  order?: string[];
}

/** What a move does to links in the post: the composer hands it to linkRules. */
export interface LinkInstructions {
  /** Every link to these becomes plain words. */
  drop?: string[];
  /** Every link to `from` points at `to` instead. */
  retarget?: { from: string; to: string }[];
}

export interface ColourMove {
  writes: ColourWrites;
  undo: ColourWrites;
  links?: LinkInstructions;
  /** Groups the size rule folded in this step. */
  folded?: ReferenceGroup[];
}

const cloneGroups = (groups: readonly ReferenceGroup[]): ReferenceGroup[] => groups.map((group) => ({ ...group, members: [...group.members] }));
const sameGroups = (a: readonly ReferenceGroup[], b: readonly ReferenceGroup[]) => JSON.stringify(a) === JSON.stringify(b);

/** The model with a move's writes applied. */
export function applyWrites(model: ColourModel, writes: ColourWrites): ColourModel {
  const singles = { ...model.singles };
  for (const [ref, hex] of Object.entries(writes.singles)) {
    if (hex) singles[ref] = hex;
    else delete singles[ref];
  }
  // An empty order is no order: the build's own follows.
  const order = writes.order ?? model.order;
  return { groups: writes.groups ? cloneGroups(writes.groups) : model.groups, singles, ...(order?.length ? { order } : null) };
}

/**
 * The move from `model` to the next groups and single colours. The size rule runs on the next groups first: a group with
 * one member left goes, and that member keeps the group's colour. Undo writes back every value this changed.
 */
function commit(model: ColourModel, nextGroups: ReferenceGroup[], singles: Record<string, string | null>, links: LinkInstructions = {}): ColourMove | null {
  const kept: ReferenceGroup[] = [];
  const folded: ReferenceGroup[] = [];
  const nextSingles = { ...singles };
  const retarget = [...(links.retarget ?? [])];
  const drop = [...(links.drop ?? [])];
  for (const group of nextGroups) {
    if (group.members.length >= GROUP_MIN_MEMBERS) {
      kept.push(group);
      continue;
    }
    folded.push(group);
    const [last] = group.members;
    if (last) {
      nextSingles[last] = group.colour;
      // The group's linked text now points at the one component left.
      retarget.push({ from: groupTo(group.id), to: last });
    } else drop.push(groupTo(group.id));
  }
  const writes: ColourWrites = { singles: {} };
  const undo: ColourWrites = { singles: {} };
  for (const [ref, hex] of Object.entries(nextSingles)) {
    const before = model.singles[ref] ?? null;
    if (before === hex) continue;
    writes.singles[ref] = hex;
    undo.singles[ref] = before;
  }
  if (!sameGroups(kept, model.groups)) {
    writes.groups = kept;
    undo.groups = cloneGroups(model.groups);
  }
  const changedLinks = drop.length > 0 || retarget.length > 0;
  if (Object.keys(writes.singles).length === 0 && !writes.groups && !changedLinks) return null;
  return {
    writes,
    undo,
    ...(changedLinks ? { links: { ...(drop.length ? { drop } : null), ...(retarget.length ? { retarget } : null) } } : null),
    ...(folded.length ? { folded } : null),
  };
}

/** The groups without `ref` anywhere. */
const without = (groups: readonly ReferenceGroup[], ref: string): ReferenceGroup[] => cloneGroups(groups).map((group) => ({ ...group, members: group.members.filter((member) => member !== ref) }));

/** Give one component a single colour. A member leaves its group for it. */
export function setSingleColour(model: ColourModel, ref: string, hex: string): ColourMove | null {
  const colour = normaliseHex(hex);
  if (!colour || !isMemberRef(ref)) return null;
  return commit(model, without(model.groups, ref), { [ref]: colour });
}

/** Take a component's colour off: its single colour, or its place in a group. */
export function clearColour(model: ColourModel, ref: string): ColourMove | null {
  if (!isMemberRef(ref)) return null;
  return commit(model, without(model.groups, ref), { [ref]: null });
}

/**
 * A new group holding this one component, its colour (or `colour`, as the picker has it) as the group's. Not saved: a
 * group is saved only once it has two members (`saveGroup`). Its colour is empty when there is none to give it: the
 * group window asks for one before Save.
 */
export function makeGroup(model: ColourModel, ref: string, colour?: string | null, id: string = newGroupId()): ReferenceGroup {
  const hex = normaliseHex(colour) ?? stateIn(model, ref).colour ?? "";
  return { id, colour: hex, members: [ref] };
}

/**
 * Save a group as the group window holds it: new or changed, its members in order. Each member's stored single colour is
 * replaced (Undo puts it back) and it leaves any other group; a group that falls to one member folds. `keepLinkOf` names
 * the member whose linked text the group keeps when the group has none of its own; other members' links become plain words.
 */
export function saveGroup(model: ColourModel, draft: ReferenceGroup, keepLinkOf?: string | null): ColourMove | null {
  const colour = normaliseHex(draft.colour);
  const members = draft.members.filter((ref, at) => isMemberRef(ref) && draft.members.indexOf(ref) === at);
  if (!colour || members.length < GROUP_MIN_MEMBERS) return null;
  const group: ReferenceGroup = { id: draft.id, colour, members };
  const name = cleanGroupName(draft.name);
  if (name) group.name = name;
  const notes = cleanNotes(draft.notes);
  if (notes) group.notes = notes;
  const others = cloneGroups(model.groups)
    .filter((candidate) => candidate.id !== group.id)
    .map((candidate) => ({ ...candidate, members: candidate.members.filter((member) => !members.includes(member)) }));
  const at = model.groups.findIndex((candidate) => candidate.id === group.id);
  const next = at < 0 ? [...others, group] : [...others.slice(0, at), group, ...others.slice(at)];
  const singles: Record<string, string | null> = Object.fromEntries(members.map((ref) => [ref, null]));
  // A member's linked text moves to the group when it keeps it; every other member's becomes plain words (drops run first).
  const keep = keepLinkOf && members.includes(keepLinkOf) ? keepLinkOf : null;
  const links: LinkInstructions = keep
    ? { drop: [...members.filter((ref) => ref !== keep), groupTo(group.id)], retarget: [{ from: keep, to: groupTo(group.id) }] }
    : { drop: members };
  return commit(model, next, singles, links);
}

/**
 * Add a component to a group. Its stored single colour is replaced, with Undo, and it leaves any other group. `keep` says
 * whose linked text stays when both have one: "group" (the default) or "member". The member's own link moves to the group
 * when the group has none: pass "member" for that.
 */
export function addToGroup(model: ColourModel, groupId: string, ref: string, keep: "group" | "member" = "group"): ColourMove | null {
  const group = model.groups.find((candidate) => candidate.id === groupId);
  if (!group || !isMemberRef(ref) || group.members.includes(ref)) return null;
  const next = without(model.groups, ref).map((candidate) => (candidate.id === groupId ? { ...candidate, members: [...candidate.members, ref] } : candidate));
  const links: LinkInstructions = keep === "member" ? { drop: [groupTo(groupId)], retarget: [{ from: ref, to: groupTo(groupId) }] } : { drop: [ref] };
  return commit(model, next, { [ref]: null }, links);
}

/** Take a component out of a group: it becomes uncoloured. A group left with one member folds. */
export function removeFromGroup(model: ColourModel, groupId: string, ref: string): ColourMove | null {
  const group = model.groups.find((candidate) => candidate.id === groupId);
  if (!group || !group.members.includes(ref)) return null;
  const next = cloneGroups(model.groups).map((candidate) => (candidate.id === groupId ? { ...candidate, members: candidate.members.filter((member) => member !== ref) } : candidate));
  return commit(model, next, { [ref]: null });
}

function editGroup(model: ColourModel, groupId: string, change: (group: ReferenceGroup) => ReferenceGroup): ColourMove | null {
  if (!model.groups.some((group) => group.id === groupId)) return null;
  return commit(
    model,
    cloneGroups(model.groups).map((group) => (group.id === groupId ? change(group) : group)),
    {},
  );
}

/** Name a group, or (empty) take its name off. */
export function renameGroup(model: ColourModel, groupId: string, name: string): ColourMove | null {
  return editGroup(model, groupId, (group) => {
    const { name: _old, ...rest } = group;
    const clean = cleanGroupName(name);
    return clean ? { ...rest, name: clean } : rest;
  });
}

/** Change a group's colour. */
export function recolourGroup(model: ColourModel, groupId: string, hex: string): ColourMove | null {
  const colour = normaliseHex(hex);
  return colour ? editGroup(model, groupId, (group) => ({ ...group, colour })) : null;
}

/** Write a group's notes, or (empty) take them off. */
export function setNotes(model: ColourModel, groupId: string, notes: string): ColourMove | null {
  return editGroup(model, groupId, (group) => {
    const { notes: _old, ...rest } = group;
    const clean = cleanNotes(notes);
    return clean ? { ...rest, notes: clean } : rest;
  });
}

/** Put a group's members in this order. Refs that are not members are ignored; members not named keep their place at the end. */
export function orderMembers(model: ColourModel, groupId: string, refs: readonly string[]): ColourMove | null {
  return editGroup(model, groupId, (group) => {
    const first = refs.filter((ref, at) => group.members.includes(ref) && refs.indexOf(ref) === at);
    return { ...group, members: [...first, ...group.members.filter((ref) => !first.includes(ref))] };
  });
}

/** Put the groups in this order (the Colours window). */
export function orderGroups(model: ColourModel, ids: readonly string[]): ColourMove | null {
  const byId = new Map(model.groups.map((group) => [group.id, group]));
  const first = ids.filter((id, at) => byId.has(id) && ids.indexOf(id) === at).map((id) => byId.get(id) as ReferenceGroup);
  return commit(model, cloneGroups([...first, ...model.groups.filter((group) => !first.includes(group))]), {});
}

/** Put the single colours in this order (the Colours window). */
export function orderSingles(model: ColourModel, refs: readonly string[]): ColourMove | null {
  const order = refs.filter((ref, at) => isMemberRef(ref) && refs.indexOf(ref) === at);
  if (JSON.stringify(order) === JSON.stringify(model.order ?? [])) return null;
  return { writes: { singles: {}, order }, undo: { singles: {}, order: [...(model.order ?? [])] } };
}

/** Delete a group: its members become uncoloured, and its linked text becomes plain words. */
export function deleteGroup(model: ColourModel, groupId: string): ColourMove | null {
  const group = model.groups.find((candidate) => candidate.id === groupId);
  if (!group) return null;
  const singles = Object.fromEntries(group.members.map((ref) => [ref, null]));
  return commit(
    model,
    cloneGroups(model.groups).filter((candidate) => candidate.id !== groupId),
    singles,
    { drop: [groupTo(groupId)] },
  );
}

/**
 * Merge one group into another. `from`'s members follow `into`'s; `into` keeps its name and colour, and `from`'s notes go
 * under `into`'s after a blank line. `keepLinkOf` says whose linked text stays when both have one ("into", the default);
 * pass "from" also when only `from` has linked text, so it moves to `into`.
 */
export function mergeGroups(model: ColourModel, fromId: string, intoId: string, keepLinkOf: "from" | "into" = "into"): ColourMove | null {
  const from = model.groups.find((group) => group.id === fromId);
  const into = model.groups.find((group) => group.id === intoId);
  if (!from || !into || fromId === intoId) return null;
  const notes = [into.notes, from.notes].filter((part): part is string => Boolean(part && part.trim())).join("\n\n");
  const merged: ReferenceGroup = { ...into, members: [...into.members, ...from.members.filter((ref) => !into.members.includes(ref))] };
  const clean = cleanNotes(notes);
  if (clean) merged.notes = clean;
  else delete merged.notes;
  const next = cloneGroups(model.groups)
    .filter((group) => group.id !== fromId)
    .map((group) => (group.id === intoId ? merged : group));
  const links: LinkInstructions = keepLinkOf === "from" ? { drop: [groupTo(intoId)], retarget: [{ from: groupTo(fromId), to: groupTo(intoId) }] } : { drop: [groupTo(fromId)] };
  return commit(model, next, {}, links);
}

/** Clear every colour and link: every group goes and every component is uncoloured. */
export function clearAll(model: ColourModel, linkedTargets: readonly string[] = []): ColourMove | null {
  const singles = Object.fromEntries(Object.keys(model.singles).map((ref) => [ref, null]));
  const move = commit(model, [], singles, { drop: [...linkedTargets, ...model.groups.map((group) => groupTo(group.id))].filter((to, at, all) => all.indexOf(to) === at) });
  if (!move) return null;
  if (model.order?.length) {
    move.writes.order = [];
    move.undo.order = [...model.order];
  }
  return move;
}

/**
 * The size rule after a tile, a session or a part was deleted elsewhere: members no longer in the build are taken out, and
 * a group left with one member folds into that member's single colour. Null when nothing changes.
 */
export function pruneGroups(model: ColourModel, inBuild: (ref: string) => boolean): ColourMove | null {
  const next = cloneGroups(model.groups).map((group) => ({ ...group, members: group.members.filter(inBuild) }));
  if (sameGroups(next, model.groups)) return null;
  return commit(model, next, {});
}

/* ── drawing: the colours every place reads ── */

const isInstructions = (step: Pick<Step, "id">) => step.id.endsWith(":instructions");

function recolour(steps: readonly Step[], colourOf: (id: string) => string | null | undefined): Step[] {
  return steps.map((step) => {
    const children = step.children.length ? recolour(step.children, colourOf) : step.children;
    const sentWith = step.sentWith ? recolour(step.sentWith, colourOf) : step.sentWith;
    const next: Step = { ...step, children, ...(sentWith ? { sentWith } : null) };
    const colour = isInstructions(step) ? undefined : colourOf(step.id);
    if (colour) next.colour = colour;
    else if (colour === null) delete next.colour;
    return next;
  });
}

/**
 * The steps and sessions as they are drawn: a member of a group in its group's colour, everything else as stored. The
 * same helpers then draw it (`borderFor`, `outlineFor`, the links' fill), so a group's colour reaches every place a single
 * colour does. Returns what it was given when there are no groups.
 */
export function withGroupColours(steps: Step[], groups: SessionGroup[], making: unknown): { steps: Step[]; groups: SessionGroup[] } {
  const model: ColourModel = { groups: referenceGroupsOf(making), singles: {} };
  if (model.groups.length === 0) return { steps, groups };
  const shown = (ref: string): string | undefined => {
    const state = stateIn(model, ref);
    return state.state === "none" ? undefined : (state.colour ?? undefined);
  };
  return {
    steps: recolour(steps, (id) => shown(refTo({ kind: "node", id }))),
    groups: groups.map((group) => {
      const colour = shown(refTo({ kind: "session", id: groupKey(group) }));
      return colour ? { ...group, colour } : group;
    }),
  };
}

/** `making` with every grouped part's colour laid over its `workstreams` entry, for the part heads, the map and the links. */
export function makingWithGroupColours(making: unknown): unknown {
  const model: ColourModel = { groups: referenceGroupsOf(making), singles: {} };
  if (model.groups.length === 0 || !making || typeof making !== "object") return making;
  const list = (making as { workstreams?: unknown }).workstreams;
  if (!Array.isArray(list)) return making;
  let changed = false;
  const next = list.map((entry) => {
    const key = asObject(entry).key;
    if (typeof key !== "string") return entry;
    const state = stateIn(model, refTo({ kind: "workstream", id: key }));
    if (state.state === "none" || !state.colour) return entry;
    changed = true;
    return { ...asObject(entry), colour: state.colour };
  });
  return changed ? { ...(making as object), workstreams: next } : making;
}

/** Each member's group, by ref, for the labels (P5). Only groups of two or more. */
export function groupByMember(making: unknown): Map<string, ReferenceGroup> {
  const out = new Map<string, ReferenceGroup>();
  for (const group of referenceGroupsOf(making)) if (group.members.length >= GROUP_MIN_MEMBERS) for (const ref of group.members) out.set(ref, group);
  return out;
}

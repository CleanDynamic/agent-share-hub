// referenceBridge: the only way CA-20 touches references (CA-20 P2, P3, P7).
//
// WHAT THIS IS. Colours, reference groups and the post's linked text are CA-19's. Removing, restoring, duplicating, grouping
// and ungrouping all have something to say to them: a removed tile leaves its group (and a group left with one member ends),
// the words that linked to it become plain words, and an undo puts them back. Everything CA-20 does about references goes
// through the functions here, and every one of them calls CA-19's own (`referenceGroups.ts`, `linkRules.ts`); none repeats
// CA-19's rules.
//
// WHAT IT NEEDS. The colours as they stand, the post's editor, and the way a step is taken (`step`, which is CA-19's
// `useReferenceHistory().step`: it writes the colours, edits the post's links and records the step, which is then one
// step of the build's history too). Until a page hands those over the bridge is "not available": Group and Ungroup do not
// show, and a removal takes nothing from the post.
//
// A COMPONENT IS A REF: `node:<id>`, `session:<key>` or `workstream:<key>` (`refTo`).

import type { Transaction } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";

import { SUGGESTED_COLOURS, normaliseHex } from "@/lib/theme/partColour";

import { findWords, linkOf, linkWords } from "./linkRules";
import {
  addToGroup,
  applyWrites,
  GROUP_MIN_MEMBERS,
  groupOf as groupIn,
  newGroupId,
  pruneGroups,
  saveGroup,
  setSingleColour,
  stateIn,
  type ColourModel,
  type ColourMove,
  type ColourWrites,
  type ReferenceGroup,
} from "./referenceGroups";

/** What a page gives the bridge. Absent: not available. */
export interface BridgeContext {
  /** The colours as they stand, writes not yet saved included. */
  model: () => ColourModel;
  /** The post's editor, when it is on the page. */
  editor: () => Editor | null;
  /** CA-19's `history.step`: writes the move, edits the post and records the step. False: nothing was done. */
  step: (sentence: string, change: { move?: ColourMove | null; edit?: (tr: Transaction) => { inserted?: { at: number; size: number } } | void | false }) => boolean;
}

/** The references that belong to some components, as they were: what Restore puts back. */
export interface ReferenceSnapshot {
  /** The groups the components were in. */
  members: { ref: string; groupId: string }[];
  /** The linked words each had in the post. */
  links: { ref: string; words: string; post: number }[];
}

export interface ReferenceBridge {
  /** True once a page has handed over CA-19's code. */
  available: () => boolean;
  /** The group a component is in, if it is in one. */
  groupOf: (ref: string) => ReferenceGroup | undefined;
  /** Put the components in a new group (one step) and say which. Null when it cannot be made. */
  makeGroup: (refs: readonly string[], sentence?: string) => ReferenceGroup | null;
  /** Take the components out of their groups (one step); each keeps its group's colour as its own. */
  ungroup: (refs: readonly string[], sentence?: string) => boolean;
  /** The groups and linked words that belong to these components. Taken before they go. */
  snapshot: (refs: readonly string[]) => ReferenceSnapshot;
  /** Put a snapshot back where it still fits (one step): members rejoin a group that is still there, words are linked again. */
  restore: (snapshot: ReferenceSnapshot, sentence?: string) => boolean;
  /** The words that link to these components become plain words (one step). */
  unlink: (refs: readonly string[], sentence?: string) => boolean;
  /** CA-19's size rule for components that are going (they leave their groups, a group left with one ends) and their links become plain words, in one step. */
  release: (refs: readonly string[], sentence?: string) => boolean;
}

export const BRIDGE_COPY = {
  grouped: (n: number) => `Grouped ${n} ${n === 1 ? "component" : "components"}`,
  ungroupedOne: (name: string, group: string) => `Ungrouped ${name} from ${group}`,
  ungrouped: (n: number) => `Ungrouped ${n} ${n === 1 ? "component" : "components"}`,
  released: "Took the removed components out of their groups and links",
  restored: "Put back the groups and links",
  unlinked: "Removed the links",
  noName: "No name",
} as const;

/** The bridge before a page has handed anything over: nothing is there to touch. */
export const NOT_AVAILABLE: ReferenceBridge = {
  available: () => false,
  groupOf: () => undefined,
  makeGroup: () => null,
  ungroup: () => false,
  snapshot: () => ({ members: [], links: [] }),
  restore: () => false,
  unlink: () => false,
  release: () => false,
};

/** The first suggested colour no group and no single colour is using, else the first. */
export function nextSuggested(model: ColourModel): string {
  const used = new Set<string>([...model.groups.map((group) => group.colour), ...Object.values(model.singles)].flatMap((hex) => normaliseHex(hex) ?? []));
  return SUGGESTED_COLOURS.find((hex) => !used.has(normaliseHex(hex) ?? hex)) ?? SUGGESTED_COLOURS[0];
}

/** Several moves, each made from the model the one before left, as one move from the model they started at. */
export function mergeMoves(start: ColourModel, make: (model: ColourModel, at: number) => ColourMove | null, count: number): ColourMove | null {
  let model = start;
  const moves: ColourMove[] = [];
  for (let at = 0; at < count; at += 1) {
    const move = make(model, at);
    if (!move) continue;
    moves.push(move);
    model = applyWrites(model, move.writes);
  }
  if (moves.length === 0) return null;
  const writes: ColourWrites = { singles: {} };
  const drop: string[] = [];
  const retarget: { from: string; to: string }[] = [];
  const folded: ReferenceGroup[] = [];
  for (const move of moves) {
    Object.assign(writes.singles, move.writes.singles);
    if (move.writes.groups) writes.groups = move.writes.groups;
    if (move.writes.order) writes.order = move.writes.order;
    drop.push(...(move.links?.drop ?? []));
    retarget.push(...(move.links?.retarget ?? []));
    folded.push(...(move.folded ?? []));
  }
  const undo: ColourWrites = { singles: Object.fromEntries(Object.keys(writes.singles).map((ref) => [ref, start.singles[ref] ?? null])) };
  if (writes.groups) undo.groups = start.groups.map((group) => ({ ...group, members: [...group.members] }));
  if (writes.order) undo.order = [...(start.order ?? [])];
  return { writes, undo, ...(drop.length || retarget.length ? { links: { ...(drop.length ? { drop } : null), ...(retarget.length ? { retarget } : null) } } : null), ...(folded.length ? { folded } : null) };
}

/** The bridge for a page that has CA-19's code. */
export function createReferenceBridge(ctx: BridgeContext): ReferenceBridge {
  const doc = () => {
    const editor = ctx.editor();
    return editor && !editor.isDestroyed ? editor.state.doc : null;
  };
  const linked = (refs: readonly string[]): string[] => {
    const current = doc();
    return current ? refs.filter((ref) => linkOf(current, ref)) : [];
  };

  return {
    available: () => true,

    groupOf: (ref) => groupIn(ctx.model(), ref),

    makeGroup: (refs, sentence) => {
      const members = [...new Set(refs)];
      if (members.length < GROUP_MIN_MEMBERS) return null;
      const model = ctx.model();
      // The colour of the first one that has one, else the next suggested.
      const colour = members.map((ref) => stateIn(model, ref).colour).find((hex): hex is string => Boolean(hex)) ?? nextSuggested(model);
      const draft: ReferenceGroup = { id: newGroupId(), colour, members };
      const keepLinkOf = linked(members)[0] ?? null;
      const move = saveGroup(model, draft, keepLinkOf);
      if (!move) return null;
      return ctx.step(sentence ?? BRIDGE_COPY.grouped(members.length), { move }) ? draft : null;
    },

    ungroup: (refs, sentence) => {
      const members = [...new Set(refs)];
      const model = ctx.model();
      // Each keeps the colour of the group it leaves; a group left with one member ends, as CA-19's size rule has it.
      const move = mergeMoves(
        model,
        (current, at) => {
          const group = groupIn(current, members[at]);
          return group ? setSingleColour(current, members[at], group.colour) : null;
        },
        members.length,
      );
      if (!move) return false;
      return ctx.step(sentence ?? BRIDGE_COPY.ungrouped(members.length), { move });
    },

    snapshot: (refs) => {
      const model = ctx.model();
      const current = doc();
      return {
        members: refs.flatMap((ref) => {
          const group = groupIn(model, ref);
          return group ? [{ ref, groupId: group.id }] : [];
        }),
        links: refs.flatMap((ref) => {
          const link = current ? linkOf(current, ref) : null;
          return link ? [{ ref, words: link.text, post: link.post }] : [];
        }),
      };
    },

    restore: (snapshot, sentence) => {
      const model = ctx.model();
      const rejoin = snapshot.members.filter((entry) => model.groups.some((group) => group.id === entry.groupId));
      const move = mergeMoves(model, (current, at) => (rejoin[at] ? addToGroup(current, rejoin[at].groupId, rejoin[at].ref) : null), rejoin.length);
      const words = snapshot.links;
      const edit =
        words.length > 0 && doc()
          ? (tr: Transaction) => {
              let any = false;
              for (const link of words) {
                const hit = findWords(tr.doc, link.words, 1)[0];
                if (hit && linkWords(tr, hit.from, hit.to, link.ref).ok) any = true;
              }
              return any ? undefined : (false as const);
            }
          : undefined;
      if (!move && !edit) return false;
      return ctx.step(sentence ?? BRIDGE_COPY.restored, { ...(move ? { move } : null), ...(edit ? { edit } : null) });
    },

    unlink: (refs, sentence) => {
      const drop = linked(refs);
      if (drop.length === 0) return false;
      return ctx.step(sentence ?? BRIDGE_COPY.unlinked, { move: { writes: { singles: {} }, undo: { singles: {} }, links: { drop } } });
    },

    release: (refs, sentence) => {
      const going = new Set(refs);
      const pruned = pruneGroups(ctx.model(), (ref) => !going.has(ref));
      const drop = linked(refs);
      if (!pruned && drop.length === 0) return false;
      const move: ColourMove = pruned
        ? { ...pruned, links: { drop: [...drop, ...(pruned.links?.drop ?? [])], ...(pruned.links?.retarget ? { retarget: pruned.links.retarget } : null) } }
        : { writes: { singles: {} }, undo: { singles: {} }, links: { drop } };
      return ctx.step(sentence ?? BRIDGE_COPY.released, { move });
    },
  };
}

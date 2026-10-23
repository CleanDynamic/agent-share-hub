/* CA-19 P4 — what the colour picker (and later the group and Colours windows) does with colours and links, on top of
   `useReferences`: every action is one step of the history, named in the notice's words.

   - Done in the picker: a single colour set or taken off (with the tiles or sessions "Also colour…" names), or a group's
     colour when the picker was opened for the group.
   - Linked text from the picker: a phrase found in the post, linked as it is; Select words in the post instead (the post
     asks for one stretch and links it); Remove the link.
   - Groups from the picker: Make a group (the group window opens with this component), Make a group from the "Also used by"
     line (a group of the two, at once), Add to a group, Open group, Remove from group.
   - When a component with linked text joins a group that has some too, the maker chooses which to keep. */

import { useCallback, useMemo, useState } from "react";

import type { PickerGroup, PickerReferences } from "@/components/brand/ColourPicker";
import { findWords, linkOf, linkWords, unlinkTarget } from "@/lib/build/linkRules";
import type { RefEntry } from "@/lib/build/postRefs";
import {
  addToGroup,
  alsoUsedBy,
  clearColour,
  deleteGroup,
  GROUP_MIN_MEMBERS,
  groupTo,
  makeGroup,
  newGroupId,
  recolourGroup,
  removeFromGroup,
  saveGroup,
  setSingleColours,
  stateIn,
  type ColourMove,
  type ReferenceGroup,
} from "@/lib/build/referenceGroups";
import { NOTICE_COPY } from "@/lib/build/referenceHistory";
import { parseRefTo } from "@/lib/build/thread";

import { KeepLinkDialog, type KeepChoice } from "./referencePieces";
import type { References } from "./useReferences";

export const ACTIONS_COPY = {
  keepTitle: (group: string) => `Which linked text should ${group} keep?`,
  keepBody: "The other becomes plain words.",
  keep: "Keep",
} as const;

/** The post is asking for words to link to a component (the picker's "Select words in the post instead"). */
export interface Selecting {
  to: string;
  name: string;
}

/** The group window: a saved group, or one being made (P6). */
export interface GroupWindowState {
  draft: ReferenceGroup;
  isNew: boolean;
}

export interface ReferenceActionsInput {
  references: References;
  /** Every target by its `to`, groups too. */
  lookup: ReadonlyMap<string, RefEntry>;
  nameOf: (to: string) => string;
  /** Drops the picker's live colour (a group made from the picker draws in its own colour). */
  dropPreview: () => void;
}

export function useReferenceActions({ references, lookup, nameOf, dropPreview }: ReferenceActionsInput) {
  const { model, history, editor } = references;
  const [selecting, setSelecting] = useState<Selecting | null>(null);
  const [groupWindow, setGroupWindow] = useState<GroupWindowState | null>(null);
  const [keep, setKeep] = useState<{ title: string; choices: KeepChoice[]; run: (key: string) => void } | null>(null);

  const doc = useCallback(() => (editor && !editor.isDestroyed ? editor.state.doc : null), [editor]);
  const linkedOf = useCallback((to: string) => {
    const current = doc();
    return current ? linkOf(current, to) : null;
  }, [doc]);
  const groupName = (group: Pick<ReferenceGroup, "name"> | undefined) => group?.name ?? NOTICE_COPY.noName;

  /** Done in the picker. */
  const commit = useCallback(
    (to: string, colour: string | null, also: readonly string[]) => {
      const target = parseRefTo(to);
      if (target?.kind === "group") {
        if (!colour) return;
        const group = model.groups.find((candidate) => candidate.id === target.id);
        history.step(NOTICE_COPY.recoloured(groupName(group), colour), { move: recolourGroup(model, target.id, colour) });
        return;
      }
      const move = colour ? setSingleColours(model, [to, ...also], colour) : clearColour(model, to);
      history.step(colour ? NOTICE_COPY.coloured(nameOf(to), colour) : NOTICE_COPY.uncoloured(nameOf(to)), { move });
    },
    [model, history, nameOf],
  );

  /** Runs a group move whose member may bring linked text: asks which to keep when both have some. */
  const withKeep = useCallback(
    (group: ReferenceGroup | undefined, member: string, run: (keepMember: boolean) => void) => {
      const mine = linkedOf(member);
      const theirs = group ? linkedOf(groupTo(group.id)) : null;
      if (mine && theirs && group) {
        setKeep({
          title: ACTIONS_COPY.keepTitle(groupName(group)),
          choices: [
            { key: "group", owner: groupName(group), words: theirs.text, post: theirs.post },
            { key: "member", owner: nameOf(member), words: mine.text, post: mine.post },
          ],
          run: (key) => run(key === "member"),
        });
        return;
      }
      run(Boolean(mine) && !theirs);
    },
    [linkedOf, nameOf],
  );

  const addMember = useCallback(
    (groupId: string, member: string) => {
      const group = model.groups.find((candidate) => candidate.id === groupId);
      // A linked component joining a group with no linked text brings its link along: the notice says where it points now.
      const moves = Boolean(linkedOf(member)) && !linkedOf(groupTo(groupId));
      withKeep(group, member, (keepMember) => {
        const move = addToGroup(model, groupId, member, keepMember ? "member" : "group");
        if (!move) return;
        dropPreview();
        history.step(moves ? NOTICE_COPY.pointsAt(groupName(group)) : NOTICE_COPY.added(nameOf(member), groupName(group)), { move });
      });
    },
    [model, withKeep, history, nameOf, linkedOf, dropPreview],
  );

  const removeMember = useCallback(
    (groupId: string, member: string) => {
      const group = model.groups.find((candidate) => candidate.id === groupId);
      history.step(NOTICE_COPY.removedFrom(nameOf(member), groupName(group)), { move: removeFromGroup(model, groupId, member) });
    },
    [model, history, nameOf],
  );

  /** Saves a group as the group window holds it: one step. */
  const saveDraft = useCallback(
    (draft: ReferenceGroup, isNew: boolean): boolean => {
      const linkedMembers = draft.members.filter((ref) => linkedOf(ref));
      const keepLinkOf = linkedOf(groupTo(draft.id)) ? null : (linkedMembers[0] ?? null);
      const move: ColourMove | null = saveGroup(model, draft, keepLinkOf);
      if (!move) return false;
      return history.step(isNew ? NOTICE_COPY.madeGroup(groupName(draft)) : NOTICE_COPY.savedGroup(groupName(draft)), { move });
    },
    [model, history, linkedOf],
  );

  const pickerGroups = useMemo<PickerGroup[]>(
    () => model.groups.filter((group) => group.members.length >= GROUP_MIN_MEMBERS).map((group) => ({ id: group.id, colour: group.colour, count: group.members.length, ...(group.name ? { name: group.name } : null) })),
    [model.groups],
  );

  /** The picker's references for a component; none for a group's own colour. */
  const pickerReferences = useCallback(
    (to: string, controls: { finish: () => void }): PickerReferences | undefined => {
      const target = parseRefTo(to);
      if (!target || target.kind === "group") return undefined;
      const state = stateIn(model, to);
      const linked = linkedOf(to);
      const entry = lookup.get(to);
      return {
        ...(state.group ? { group: { id: state.group.id, colour: state.group.colour, count: state.group.members.length, ...(state.group.name ? { name: state.group.name } : null) } } : null),
        alsoUsedBy: (hex) => alsoUsedBy(model, hex, to).map((ref) => ({ to: ref, name: nameOf(ref) })),
        onGroupWith: (other, colour) => {
          const draft: ReferenceGroup = { id: newGroupId(), colour, members: [to, other] };
          const keepLinkOf = linkedOf(to) ? to : linkedOf(other) ? other : null;
          dropPreview();
          history.step(NOTICE_COPY.madeGroupOf(nameOf(to), nameOf(other)), { move: saveGroup(model, draft, keepLinkOf) });
        },
        linked: linked ? { words: linked.text, post: linked.post, colour: state.colour, number: entry?.number ?? "" } : null,
        findWords: (query) => {
          const current = doc();
          return current ? findWords(current, query) : [];
        },
        onLinkFound: (hit) => {
          const name = nameOf(to);
          history.step(NOTICE_COPY.linked(hit.match, name), { edit: (tr) => (linkWords(tr, hit.from, hit.to, to).ok ? undefined : false) });
        },
        onSelectWords: () => {
          controls.finish();
          setSelecting({ to, name: nameOf(to) });
        },
        onRemoveLink: () => history.step(NOTICE_COPY.removed, { edit: (tr) => (unlinkTarget(tr, to).length ? undefined : false) }),
        groups: pickerGroups,
        onMakeGroup: (colour) => {
          controls.finish();
          setGroupWindow({ draft: makeGroup(model, to, colour), isNew: true });
        },
        onAddToGroup: (groupId) => addMember(groupId, to),
        onOpenGroup: (groupId) => {
          controls.finish();
          const group = model.groups.find((candidate) => candidate.id === groupId);
          if (group) setGroupWindow({ draft: { ...group, members: [...group.members] }, isNew: false });
        },
        onRemoveFromGroup: () => {
          if (state.group) removeMember(state.group.id, to);
        },
      };
    },
    [model, linkedOf, lookup, nameOf, dropPreview, history, doc, pickerGroups, addMember, removeMember],
  );

  const deleteOne = useCallback(
    (groupId: string) => {
      const group = model.groups.find((candidate) => candidate.id === groupId);
      history.step(NOTICE_COPY.deleted(groupName(group)), { move: deleteGroup(model, groupId) });
    },
    [model, history],
  );

  const openGroup = useCallback(
    (groupId: string) => {
      const group = model.groups.find((candidate) => candidate.id === groupId);
      if (group) setGroupWindow({ draft: { ...group, members: [...group.members] }, isNew: false });
    },
    [model.groups],
  );

  const keepDialog = keep ? (
    <KeepLinkDialog
      open
      title={keep.title}
      body={ACTIONS_COPY.keepBody}
      action={ACTIONS_COPY.keep}
      choices={keep.choices}
      onCancel={() => setKeep(null)}
      onPick={(key) => {
        const run = keep.run;
        setKeep(null);
        run(key);
      }}
    />
  ) : null;

  return {
    commit,
    pickerReferences,
    selecting,
    setSelecting,
    groupWindow,
    setGroupWindow,
    openGroup,
    addMember,
    removeMember,
    saveDraft,
    deleteGroup: deleteOne,
    keepDialog,
    askKeep: setKeep,
    linkedOf,
    history: { canUndo: history.canUndo, canRedo: history.canRedo, onUndo: history.undo, onRedo: history.redo },
  };
}

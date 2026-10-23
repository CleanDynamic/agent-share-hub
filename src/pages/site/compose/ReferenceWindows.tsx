/* CA-19 P6, P7: the reference windows on a page: the group window (and, from P7, the Colours window), wired to the
   composer's colour model, its history and its actions. The composer and the References dev page draw the same. */

import { useColourSwatches } from "@/components/brand/useColourSwatches";
import { centre } from "@/components/build/partNav";
import { flashOutline } from "@/components/post/RefLinks";
import { findWords, linkOf, linkRanges, linkWords, unlinkTarget } from "@/lib/build/linkRules";
import type { RefEntry, RefGroup } from "@/lib/build/postRefs";
import { groupTo } from "@/lib/build/referenceGroups";
import { NOTICE_COPY } from "@/lib/build/referenceHistory";

import { ColoursWindow } from "./ColoursWindow";
import { ReferenceGroupWindow } from "./ReferenceGroupWindow";
import type { useReferenceActions } from "./useReferenceActions";
import { useHistoryKeys } from "./useReferenceHistory";
import type { References } from "./useReferences";

export interface ReferenceWindowsProps {
  references: References;
  actions: ReturnType<typeof useReferenceActions>;
  refGroups: readonly RefGroup[];
  lookup: ReadonlyMap<string, RefEntry>;
  phone: boolean;
}

/** The words a link is made of, in the post: to the middle, focused, outlined. */
export function showWords(to: string) {
  window.setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`[data-ref="${CSS.escape(to)}"]`);
    if (!el) return;
    centre(el);
    el.focus({ preventScroll: true });
    flashOutline(el);
  }, 0);
}

export function ReferenceWindows({ references, actions, refGroups, lookup, phone }: ReferenceWindowsProps) {
  const [swatches, setSwatches] = useColourSwatches();
  const { history, editor } = references;
  const open = actions.groupWindow;
  useHistoryKeys(Boolean(open) || actions.coloursOpen, history);
  const doc = editor && !editor.isDestroyed ? editor.state.doc : null;
  const colours = actions.coloursOpen ? (
    <ColoursWindow
      open
      phone={phone}
      model={references.model}
      refGroups={refGroups}
      lookup={lookup}
      isLinked={(target) => Boolean(doc && linkOf(doc, target))}
      linkedWords={(target) => {
        const range = doc ? linkOf(doc, target) : null;
        return range ? { words: range.text, post: range.post } : null;
      }}
      linkCount={doc ? linkRanges(doc).length : 0}
      swatches={swatches}
      onSwatches={setSwatches}
      history={actions.history}
      onOpenGroup={(groupId) => {
        actions.setColoursOpen(false);
        actions.openGroup(groupId);
      }}
      onMerge={actions.merge}
      onDelete={actions.deleteGroup}
      onGroupThese={actions.groupThese}
      onOrderGroups={actions.orderGroups}
      onOrderSingles={actions.orderSingles}
      onClearAll={actions.clearEverything}
      askKeep={actions.askKeep}
      onClose={() => actions.setColoursOpen(false)}
    />
  ) : null;
  if (!open) return colours;
  const to = groupTo(open.draft.id);
  const range = doc ? linkOf(doc, to) : null;
  const name = open.draft.name ?? NOTICE_COPY.noName;
  const close = () => actions.setGroupWindow(null);
  return (
    <>
      {colours}
      <ReferenceGroupWindow
      open
      phone={phone}
      draft={open.draft}
      isNew={open.isNew}
      refGroups={refGroups}
      lookup={lookup}
      groups={references.groups}
      linked={range ? { words: range.text, post: range.post, colour: open.draft.colour || null, number: open.draft.name ?? "Group" } : null}
      findWords={(query) => (doc ? findWords(doc, query) : [])}
      onLinkFound={(hit) => history.step(NOTICE_COPY.linked(hit.match, name), { edit: (tr) => (linkWords(tr, hit.from, hit.to, to).ok ? undefined : false) })}
      onSelectWords={() => {
        close();
        actions.setSelecting({ to, name });
      }}
      onGoToLink={() => {
        close();
        showWords(to);
      }}
      onRemoveLink={() => history.step(NOTICE_COPY.removed, { edit: (tr) => (unlinkTarget(tr, to).length ? undefined : false) })}
      swatches={swatches}
      onSwatches={setSwatches}
      history={actions.history}
      onSave={(draft) => actions.saveDraft(draft, open.isNew)}
      onDelete={() => actions.deleteGroup(open.draft.id)}
      onClose={close}
      />
    </>
  );
}

export default ReferenceWindows;

/* CA-19 P6: the reference group window (board "References: groups and the Colours window", left).

   A 560 window from the modal recipes (a BottomSheet on a phone). It opens from a group's label, from Make a group, from
   Open group and from the Colours window. Head: "Reference group", "Components under one colour", and
   the close square. Then, top to bottom:

   1. Name: a row with the field, "Add a name".
   2. Colour: a 30 square of the colour (radius 7), the code in the data face in a 110-wide field, and Change… at the right,
      which opens the colour picker for the group.
   3. Components: "3 · drag to set the order", Add components (the link panel's list, with components in other groups shown
      greyed under their group), then one 40-tall row per member: a grip, a badge, the name, the kind, a remove ×.
   4. Notes: "How these components work together · optional", the count "112 / 2,000", and an 80-tall text area.
   5. Linked text: an inner panel, "Linked text · 1 of 1", with Go to it and Remove; or Find words and Select words.

   The footer: Undo and Redo, Delete group in the danger colour, then Cancel and Save. Save is one step and needs two or more
   components ("2 components min"). Delete group asks first.

   What the window holds is its own until Save; Cancel, Escape and the close square leave the group as it was. */

import { useEffect, useMemo, useState } from "react";

import { ColourPicker, type Swatches } from "@/components/brand/ColourPicker";
import { refPaint, refWordsStyle } from "@/components/post/RefLinks";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import type { FoundWords } from "@/lib/build/linkRules";
import { shownName, type RefEntry, type RefGroup } from "@/lib/build/postRefs";
import { GROUP_MIN_MEMBERS, GROUP_NAME_MAX, GROUP_NOTES_MAX, type ReferenceGroup } from "@/lib/build/referenceGroups";
import { normaliseHex } from "@/lib/theme/partColour";
import { t } from "@/lib/theme/tokens";
import { useInteractive } from "@/lib/theme/interactive";
import { ring } from "@/lib/theme/controls";

import { GlyphButton, ModalShell } from "./ModalFrame";
import { COUNT, FOOT_NOTE, FieldArea, FieldInput, MODAL_PAD, ModalInset, RecipeButton, Row, TextLink, bodyStyle, footerStyle } from "./modalRecipes";
import { Badge, BlockTitle, ConfirmDialog, DANGER, ELLIPSIS, GAP, InnerPanel, PAD, SECTION_LABEL, SortableRows, SquareSwatch, UndoRedo, data, words } from "./referencePieces";

export const GROUP_WINDOW_COPY = {
  title: "Reference group",
  subtitle: "Components under one colour",
  name: "Name",
  namePlaceholder: "Name",
  colour: "Colour",
  colourCode: "Colour code",
  change: "Change…",
  components: "Components",
  order: (n: number) => `${n}`,
  add: "Add components",
  remove: (name: string) => `Remove ${name}`,
  notes: "Notes",
  notesCount: (n: number) => `${n.toLocaleString("en-US")} / ${GROUP_NOTES_MAX.toLocaleString("en-US")}`,
  linkedText: "Linked text",
  oneOfOne: (has: boolean) => ` · ${has ? 1 : 0} of 1`,
  goTo: "Go to it",
  removeLink: "Remove",
  findWords: "Find words in the post",
  selectWords: "Selecting in the post",
  saveFirst: "Linking needs a saved group",
  noMatch: "Not in the post",
  delete: "Delete group",
  cancel: "Cancel",
  save: "Save",
  needsTwo: "2 components min",
  needsColour: "Colour required",
  deleteTitle: (name: string) => `Delete ${name}?`,
  deleteBody: (n: number) => `${n} ${n === 1 ? "component loses" : "components lose"} this colour. Linked text becomes plain text.`,
  deleteAction: "Delete",
  noName: "No name",
  inGroup: "In another group",
  post: (n: number) => `Post ${n}`,
} as const;

export interface GroupWindowLinked {
  words: string;
  post: number;
  colour: string | null;
  number: string;
}

export interface ReferenceGroupWindowProps {
  open: boolean;
  phone: boolean;
  draft: ReferenceGroup;
  /** A group being made: no Delete group, and no linked text until it is saved. */
  isNew: boolean;
  /** The build's parts, sessions and tiles, as the link panel lists them. */
  refGroups: readonly RefGroup[];
  /** Every target by its `to`. */
  lookup: ReadonlyMap<string, RefEntry>;
  /** The build's other groups, for Add components. */
  groups: readonly ReferenceGroup[];
  linked: GroupWindowLinked | null;
  findWords: (query: string) => FoundWords[];
  onLinkFound: (hit: FoundWords) => void;
  onSelectWords: () => void;
  onGoToLink: () => void;
  onRemoveLink: () => void;
  swatches: Swatches;
  onSwatches: (next: Swatches) => void;
  history: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void };
  /** Save: one step. False when the group cannot be saved. */
  onSave: (draft: ReferenceGroup) => boolean;
  onDelete: () => void;
  onClose: () => void;
}

/* ── one member row ── */

function MemberRow({ grip, entry, phone, onRemove }: { grip: React.ReactNode; entry: RefEntry | undefined; phone: boolean; onRemove: () => void }) {
  const name = entry ? (entry.kind === "Session" || entry.kind === "Part" ? shownName(entry) : entry.title) : "";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: GAP.row, flexGrow: 1, minWidth: 0 }}>
      {grip}
      <Badge>{entry?.number ?? ""}</Badge>
      <span style={{ ...words(13, 500, t.text), ...ELLIPSIS, flexGrow: 1 }}>{name}</span>
      <span style={{ ...words(12.5, 400, t.text2), flexShrink: 0 }}>{entry?.kind ?? ""}</span>
      <GlyphButton glyph="x" label={GROUP_WINDOW_COPY.remove(name)} phone={phone} onClick={onRemove} />
    </span>
  );
}

/* ── Add components ── */

function AddChoice({ entry, indent, disabled, onPick }: { entry: RefEntry; indent: number; disabled: boolean; onPick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      data-add-choice={entry.to}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={onPick}
      {...handlers}
      style={{
        appearance: "none",
        border: 0,
        width: "100%",
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: GAP.row,
        height: 34,
        padding: PAD.row,
        paddingLeft: GAP.row + indent,
        borderRadius: 7,
        background: state.hovered && !disabled ? t.controlOn : "transparent",
        cursor: disabled ? "default" : "pointer",
        ...(disabled ? { filter: t.dimFilter } : null),
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ ...data(11, t.text2), minWidth: 22, flexShrink: 0 }}>{entry.number}</span>
      <span style={{ ...words(13, 400, t.text), ...ELLIPSIS, flexGrow: 1 }}>{entry.title}</span>
      <span style={{ ...words(12, 400, t.label), flexShrink: 0 }}>{entry.kind}</span>
    </button>
  );
}

function AddList({ refGroups, lookup, groups, draft, onAdd }: { refGroups: readonly RefGroup[]; lookup: ReadonlyMap<string, RefEntry>; groups: readonly ReferenceGroup[]; draft: ReferenceGroup; onAdd: (to: string) => void }) {
  const others = groups.filter((group) => group.id !== draft.id && group.members.length >= GROUP_MIN_MEMBERS);
  const elsewhere = new Set(others.flatMap((group) => group.members));
  const rows = refGroups.flatMap((group) => group.entries).filter((entry) => !draft.members.includes(entry.to) && !elsewhere.has(entry.to));
  return (
    <InnerPanel testId="group-add-list" style={{ padding: PAD.list, display: "flex", flexDirection: "column", maxHeight: 280, overflowY: "auto" }}>
      {others.map((group) => (
        <div key={group.id} style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ ...SECTION_LABEL, padding: PAD.label, display: "flex", alignItems: "center", gap: 8 }}>
            <SquareSwatch colour={group.colour} />
            {group.name ?? GROUP_WINDOW_COPY.noName}
          </span>
          {group.members.flatMap((ref) => (lookup.get(ref) ? [lookup.get(ref) as RefEntry] : [])).map((entry) => (
            <AddChoice key={entry.to} entry={entry} indent={12} disabled onPick={() => undefined} />
          ))}
        </div>
      ))}
      {rows.map((entry) => (
        <AddChoice key={entry.to} entry={entry} indent={entry.kind === "Part" ? 0 : entry.kind === "Session" ? 12 : 24} disabled={false} onPick={() => onAdd(entry.to)} />
      ))}
    </InnerPanel>
  );
}

/* ── linked text ── */

function LinkedText({ isNew, linked, phone, findWords, onLinkFound, onSelectWords, onGoToLink, onRemoveLink }: Pick<ReferenceGroupWindowProps, "isNew" | "linked" | "phone" | "findWords" | "onLinkFound" | "onSelectWords" | "onGoToLink" | "onRemoveLink">) {
  const theme = useResolvedTheme();
  const [query, setQuery] = useState("");
  const found = useMemo(() => (query.trim() ? findWords(query) : []), [query, findWords]);
  return (
    <InnerPanel testId="group-linked" style={{ display: "flex", flexDirection: "column", gap: GAP.column }}>
      <span style={words(12.5, 500, t.text)}>
        {GROUP_WINDOW_COPY.linkedText}
        <span style={words(12.5, 400, t.label)}>{GROUP_WINDOW_COPY.oneOfOne(Boolean(linked))}</span>
      </span>
      {linked ? (
        <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span data-testid="group-linked-words" style={{ ...words(13, 400, t.text), ...refWordsStyle(refPaint({ colour: linked.colour, number: linked.number }, theme)), ...ELLIPSIS, cursor: "default" }}>
            {linked.words}
          </span>
          <span style={{ ...data(11, t.label), flexGrow: 1 }}>{GROUP_WINDOW_COPY.post(linked.post)}</span>
          <TextLink phone={phone} onClick={onGoToLink}>
            {GROUP_WINDOW_COPY.goTo}
          </TextLink>
          <TextLink phone={phone} onClick={onRemoveLink}>
            {GROUP_WINDOW_COPY.removeLink}
          </TextLink>
        </span>
      ) : isNew ? (
        <span style={words(12.5, 400, t.text2, 18)}>{GROUP_WINDOW_COPY.saveFirst}</span>
      ) : (
        <>
          <FieldInput phone={phone} aria-label={GROUP_WINDOW_COPY.findWords} placeholder={GROUP_WINDOW_COPY.findWords} value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" spellCheck={false} />
          {query.trim() ? (
            <ul aria-label={GROUP_WINDOW_COPY.findWords} style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              {found.length === 0 ? <li style={words(12.5, 400, t.text2)}>{GROUP_WINDOW_COPY.noMatch}</li> : null}
              {found.map((hit) => (
                <li key={hit.from}>
                  <TextLink phone={phone} onClick={() => onLinkFound(hit)} aria-label={`${hit.match} · ${GROUP_WINDOW_COPY.post(hit.post)}`}>
                    {`…${hit.before}${hit.match}${hit.after}… · ${GROUP_WINDOW_COPY.post(hit.post)}`}
                  </TextLink>
                </li>
              ))}
            </ul>
          ) : null}
          <TextLink phone={phone} onClick={onSelectWords}>
            {GROUP_WINDOW_COPY.selectWords}
          </TextLink>
        </>
      )}
    </InnerPanel>
  );
}

/* ── the window ── */

function GroupForm(props: ReferenceGroupWindowProps) {
  const { draft: start, isNew, phone, lookup, history, onSave, onDelete, onClose, swatches, onSwatches } = props;
  const [draft, setDraft] = useState<ReferenceGroup>(() => ({ ...start, members: [...start.members] }));
  const [code, setCode] = useState(start.colour);
  const [adding, setAdding] = useState(false);
  const [picking, setPicking] = useState<HTMLElement | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => setCode(draft.colour), [draft.colour]);

  const enough = draft.members.length >= GROUP_MIN_MEMBERS;
  const coloured = Boolean(normaliseHex(draft.colour));
  const note = !enough ? GROUP_WINDOW_COPY.needsTwo : !coloured ? GROUP_WINDOW_COPY.needsColour : null;
  const notes = draft.notes ?? "";
  const named = start.name ?? GROUP_WINDOW_COPY.noName;
  const inset = phone ? 0 : MODAL_PAD;
  const block = { display: "flex", flexDirection: "column" as const, gap: GAP.column, padding: `14px ${inset}px 16px`, borderTop: `1px solid ${t.hairlineModule}`, minWidth: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto", fontSize: phone ? 16 : 13 }}>
      <ModalInset.Provider value={inset}>
        <div data-testid="group-window-body" style={bodyStyle(phone)}>
          <Row label={GROUP_WINDOW_COPY.name} id="group-name" phone={phone} noRule>
            <FieldInput id="group-name" phone={phone} placeholder={GROUP_WINDOW_COPY.namePlaceholder} maxLength={GROUP_NAME_MAX} value={draft.name ?? ""} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
          </Row>
          <Row label={GROUP_WINDOW_COPY.colour} id="group-colour" phone={phone}>
            <span style={{ display: "flex", alignItems: "center", gap: GAP.row, minWidth: 0 }}>
              <SquareSwatch colour={coloured ? draft.colour : null} size={30} />
              <FieldInput
                id="group-colour"
                phone={phone}
                mono
                width={110}
                aria-label={GROUP_WINDOW_COPY.colourCode}
                value={code}
                placeholder="#RRGGBB"
                maxLength={9}
                onChange={(event) => setCode(event.target.value)}
                onBlur={() => {
                  const hex = normaliseHex(code);
                  if (hex) setDraft((current) => ({ ...current, colour: hex }));
                  else setCode(draft.colour);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const hex = normaliseHex(code);
                  if (hex) setDraft((current) => ({ ...current, colour: hex }));
                }}
              />
              <span style={{ flexGrow: 1 }} />
              <RecipeButton small phone={phone} aria-expanded={Boolean(picking)} onClick={(event) => setPicking(picking ? null : event.currentTarget)}>
                {GROUP_WINDOW_COPY.change}
              </RecipeButton>
            </span>
            {picking ? (
              <ColourPicker
                open
                inline
                anchor={picking}
                what={`${GROUP_WINDOW_COPY.title} · ${draft.name?.trim() || named}`}
                initial={coloured ? draft.colour : null}
                swatches={swatches}
                onSwatches={onSwatches}
                onPreview={() => undefined}
                onDone={(colour) => {
                  if (colour) setDraft((current) => ({ ...current, colour }));
                  setPicking(null);
                }}
                onCancel={() => setPicking(null)}
                phone={phone}
              />
            ) : null}
          </Row>
          <div role="group" aria-labelledby="group-components" data-testid="group-components" style={block}>
            <BlockTitle title={GROUP_WINDOW_COPY.components} id="group-components" sub={GROUP_WINDOW_COPY.order(draft.members.length)}>
              <RecipeButton small phone={phone} aria-expanded={adding} onClick={() => setAdding((open) => !open)} data-testid="group-add">
                {`+ ${GROUP_WINDOW_COPY.add}`}
              </RecipeButton>
            </BlockTitle>
            {adding ? <AddList refGroups={props.refGroups} lookup={lookup} groups={props.groups} draft={draft} onAdd={(to) => setDraft((current) => ({ ...current, members: [...current.members, to] }))} /> : null}
            <SortableRows
              label={GROUP_WINDOW_COPY.components}
              onOrder={(keys) => setDraft((current) => ({ ...current, members: keys }))}
              rows={draft.members.map((ref) => {
                const entry = lookup.get(ref);
                const name = entry ? (entry.kind === "Session" || entry.kind === "Part" ? shownName(entry) : entry.title) : ref;
                return {
                  key: ref,
                  name,
                  render: (grip) => <MemberRow grip={grip} entry={entry} phone={phone} onRemove={() => setDraft((current) => ({ ...current, members: current.members.filter((member) => member !== ref) }))} />,
                };
              })}
            />
          </div>
          <div role="group" aria-labelledby="group-notes" data-testid="group-notes" style={block}>
            <BlockTitle title={GROUP_WINDOW_COPY.notes} id="group-notes">
              <span data-testid="group-notes-count" style={COUNT}>
                {GROUP_WINDOW_COPY.notesCount(notes.length)}
              </span>
            </BlockTitle>
            <FieldArea phone={phone} rows={3} aria-labelledby="group-notes" maxLength={GROUP_NOTES_MAX} value={notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
          </div>
          <div style={{ ...block, gap: 0 }}>
            <LinkedText isNew={isNew} linked={props.linked} phone={phone} findWords={props.findWords} onLinkFound={props.onLinkFound} onSelectWords={props.onSelectWords} onGoToLink={props.onGoToLink} onRemoveLink={props.onRemoveLink} />
          </div>
        </div>
      </ModalInset.Provider>
      <div data-testid="group-window-footer" style={footerStyle(phone)}>
        <UndoRedo phone={phone} canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.onUndo} onRedo={history.onRedo} />
        {isNew ? null : (
          <button type="button" data-testid="group-delete" onClick={() => setDeleting(true)} style={{ appearance: "none", background: "none", border: 0, padding: phone ? "12px 0" : 0, cursor: "pointer", ...words(12.5, 500, DANGER) }}>
            {GROUP_WINDOW_COPY.delete}
          </button>
        )}
        <span data-testid="group-window-note" role="status" style={FOOT_NOTE}>
          {note ?? ""}
        </span>
        <RecipeButton phone={phone} onClick={onClose}>
          {GROUP_WINDOW_COPY.cancel}
        </RecipeButton>
        <RecipeButton variant="primary" phone={phone} disabled={Boolean(note)} onClick={() => onSave(draft) && onClose()}>
          {GROUP_WINDOW_COPY.save}
        </RecipeButton>
      </div>
      <ConfirmDialog
        open={deleting}
        testId="group-delete-confirm"
        title={GROUP_WINDOW_COPY.deleteTitle(named)}
        body={GROUP_WINDOW_COPY.deleteBody(start.members.length)}
        action={GROUP_WINDOW_COPY.deleteAction}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false);
          onDelete();
          onClose();
        }}
      />
    </div>
  );
}

export function ReferenceGroupWindow(props: ReferenceGroupWindowProps) {
  const { open, onClose, draft } = props;
  return (
    <ModalShell open={open} onOpenChange={(next) => !next && onClose()} title={GROUP_WINDOW_COPY.title} subtitle={GROUP_WINDOW_COPY.subtitle} testId="group-window">
      <GroupForm key={`${draft.id}:${open}`} {...props} />
    </ModalShell>
  );
}

export default ReferenceGroupWindow;

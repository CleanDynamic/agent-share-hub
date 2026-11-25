/* CA-19 P7: the Colours window (board "References: groups and the Colours window", right).

   "Colours…" in the composer's View menu opens a 600 window: "Colours", "Every reference group and single colour in this
   build". Top to bottom:

   1. Reference groups, "2 · drag to set the order": 44-tall rows under rules, each a grip, a 12 swatch, the name (or "No
      name"), the code in the data face, "3 components · linked text" at the right and a 26 menu button. The menu: Open,
      Merge into… (the other groups), then Delete group… in the danger colour. The row whose menu is open is `--tile`.
   2. Single colours, with their count: the same rows with the component's badge before its name, and "linked text" when it
      has some. When two share a code, an inner panel says so, with Make them a group.
   3. Your saved colours, "Shared across builds", with the picker's menu.

   The footer: Undo and Redo, "Clear all colours and links…" as a ghost button (Synth 09), and Done. Deleting, merging and clearing
   ask first; everything else happens at once, and Undo is the way back. Readers never get this window. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useMemo, useState } from "react";

import { SavedSwatch, type Swatches } from "@/components/brand/ColourPicker";
import { GROUP_MIN_MEMBERS, singlesInOrder, stateIn, type ColourModel, type ReferenceGroup } from "@/lib/build/referenceGroups";
import { shownName, type RefEntry, type RefGroup } from "@/lib/build/postRefs";
import { t } from "@/lib/theme/tokens";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";

import { MenuContent, MenuSubContent } from "./ComposeMenu";
import { ModalShell } from "./ModalFrame";
import { COUNT, LAYER, MODAL_PAD, ModalInset, RecipeButton, bodyStyle, footerStyle, iconButtonSide, MODAL_WIDTH } from "./modalRecipes";
import { menuItem, menuSurface } from "./refinedStyles";
import { Badge, BlockTitle, ConfirmDialog, DANGER, ELLIPSIS, GAP, GhostIcon, InnerPanel, SortableRows, SquareSwatch, UndoRedo, words } from "./referencePieces";
import { r } from "@/lib/theme/radius";

import { textStep } from "@/lib/theme/type";
export const COLOURS_COPY = {
  title: "Colours",
  subtitle: "Reference groups and single colours",
  groups: "Reference groups",
  order: (n: number) => `${n}`,
  singles: "Single colours",
  singlesCount: (n: number) => `${n}`,
  saved: "Saved colours",
  savedHint: "Shared across builds",
  noSaved: "No saved colours",
  noGroups: "No reference groups",
  noSingles: "No single colours",
  noName: "No name",
  components: (n: number) => `${n} ${n === 1 ? "component" : "components"}`,
  linked: "linked text",
  menu: (name: string) => `${name} options`,
  open: "Open",
  mergeInto: "Merge into…",
  delete: "Delete group…",
  shared: (names: string) => `${names}: same colour, not grouped`,
  makeThemGroup: "Make them a group",
  clear: "Clear all colours and links…",
  done: "Done",
  clearTitle: "Clear all colours and links?",
  clearBody: (groups: number, singles: number, links: number) =>
    `Removes ${groups} ${groups === 1 ? "group" : "groups"}, ${singles} single ${singles === 1 ? "colour" : "colours"} and ${links} ${links === 1 ? "link" : "links"}. The words and components stay.`,
  clearAction: "Clear all",
  deleteTitle: (name: string) => `Delete ${name}?`,
  deleteBody: (n: number) => `${n} ${n === 1 ? "component loses" : "components lose"} this colour. Linked text becomes plain text.`,
  deleteAction: "Delete",
  mergeTitle: (from: string, into: string) => `Merge ${from} into ${into}?`,
  mergeBody: (into: string) => `Components join ${into}. ${into} keeps its name and colour.`,
  mergeAction: "Merge",
  keepTitle: "Linked text to keep",
  keepBody: "The other becomes plain text",
} as const;

/** "Data model and Landing page", "A, B and C". */
export function andList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export interface ColoursWindowProps {
  open: boolean;
  phone: boolean;
  model: ColourModel;
  /** The build's parts, sessions and tiles in build order. */
  refGroups: readonly RefGroup[];
  lookup: ReadonlyMap<string, RefEntry>;
  /** Whether a target has linked text, and how many stretches the post links. */
  isLinked: (to: string) => boolean;
  linkedWords: (to: string) => { words: string; post: number } | null;
  linkCount: number;
  swatches: Swatches;
  onSwatches: (next: Swatches) => void;
  history: { canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void };
  onOpenGroup: (groupId: string) => void;
  onMerge: (fromId: string, intoId: string, keep: "from" | "into") => void;
  onDelete: (groupId: string) => void;
  onGroupThese: (refs: readonly string[], colour: string) => void;
  onOrderGroups: (ids: string[]) => void;
  onOrderSingles: (refs: string[]) => void;
  onClearAll: () => void;
  /** Two linked texts, one to keep: the composer's dialog. */
  askKeep: (ask: { title: string; body: string; action: string; choices: { key: string; owner: string; words: string; post: number }[]; run: (key: string) => void }) => void;
  onClose: () => void;
}

/** A phone footer draws no rule above itself. */
const rulesOff = { borderTop: 0, boxShadow: "none" } as const;

const groupName = (group: Pick<ReferenceGroup, "name">) => group.name ?? COLOURS_COPY.noName;

/* ── a group's menu ── */

function GroupMenu({ group, others, onOpen, onMerge, onDelete, onOpenChange }: { group: ReferenceGroup; others: readonly ReferenceGroup[]; onOpen: () => void; onMerge: (intoId: string) => void; onDelete: () => void; onOpenChange: (open: boolean) => void }) {
  return (
    <Menu.Root onOpenChange={onOpenChange} modal={false}>
      <Menu.Trigger asChild>
        <GhostIcon glyph="more" label={COLOURS_COPY.menu(groupName(group))} style={{ ...iconButtonSide(), borderRadius: r.control }} />
      </Menu.Trigger>
      <Menu.Portal>
        <MenuContent align="end" sideOffset={4} style={{ ...menuSurface(200), zIndex: LAYER.floating }}>
          <Menu.Item onSelect={onOpen} style={menuItem(true, false)}>
            {COLOURS_COPY.open}
          </Menu.Item>
          <Menu.Sub>
            <Menu.SubTrigger disabled={others.length === 0} style={menuItem(others.length > 0, false)}>
              {COLOURS_COPY.mergeInto}
            </Menu.SubTrigger>
            <Menu.Portal>
              <MenuSubContent sideOffset={4} style={{ ...menuSurface(200), zIndex: LAYER.floatingOver }}>
                {others.map((other) => (
                  <Menu.Item key={other.id} onSelect={() => onMerge(other.id)} style={{ ...menuItem(true, false), gap: 8 }}>
                    <SquareSwatch colour={other.colour} />
                    {groupName(other)}
                  </Menu.Item>
                ))}
              </MenuSubContent>
            </Menu.Portal>
          </Menu.Sub>
          <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} />
          <Menu.Item onSelect={onDelete} data-tone="danger" style={{ ...menuItem(true, false), color: DANGER }}>
            {COLOURS_COPY.delete}
          </Menu.Item>
        </MenuContent>
      </Menu.Portal>
    </Menu.Root>
  );
}

/* ── the window's body ── */

function ColoursBody(props: ColoursWindowProps) {
  const { model, lookup, refGroups, phone, isLinked, history } = props;
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete"; group: ReferenceGroup } | { kind: "merge"; from: ReferenceGroup; into: ReferenceGroup } | { kind: "clear" } | null>(null);
  const groups = model.groups.filter((group) => group.members.length >= GROUP_MIN_MEMBERS);
  const buildOrder = useMemo(() => refGroups.flatMap((group) => group.entries.map((entry) => entry.to)), [refGroups]);
  const singles = useMemo(() => singlesInOrder(model, buildOrder), [model, buildOrder]);
  const nameOf = (to: string) => {
    const entry = lookup.get(to);
    return entry ? (entry.kind === "Session" || entry.kind === "Part" ? shownName(entry) : entry.title) : to;
  };
  /** Single colours that share a code, each set once. */
  const shared = useMemo(() => {
    const byColour = new Map<string, string[]>();
    for (const ref of singles) {
      const colour = stateIn(model, ref).colour;
      if (colour) byColour.set(colour, [...(byColour.get(colour) ?? []), ref]);
    }
    return [...byColour].filter(([, refs]) => refs.length >= 2);
  }, [singles, model]);
  const inset = phone ? 0 : MODAL_PAD;
  /* Prompt 24: on a phone the sections are spaced, not ruled. */
  const block = { display: "flex", flexDirection: "column" as const, gap: GAP.column, padding: `14px ${inset}px 16px`, borderTop: phone ? 0 : `1px solid ${t.hairlineModule}`, minWidth: 0 };

  const merge = (from: ReferenceGroup, into: ReferenceGroup) => {
    const fromWords = props.linkedWords(`group:${from.id}`);
    const intoWords = props.linkedWords(`group:${into.id}`);
    if (fromWords && intoWords) {
      props.askKeep({
        title: COLOURS_COPY.keepTitle,
        body: COLOURS_COPY.keepBody,
        action: COLOURS_COPY.mergeAction,
        choices: [
          { key: "into", owner: groupName(into), words: intoWords.words, post: intoWords.post },
          { key: "from", owner: groupName(from), words: fromWords.words, post: fromWords.post },
        ],
        run: (key) => props.onMerge(from.id, into.id, key === "from" ? "from" : "into"),
      });
      return;
    }
    setConfirm({ kind: "merge", from, into });
  };

  const singlesCount = singles.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: "1 1 auto" }}>
      <ModalInset.Provider value={inset}>
        <div data-testid="colours-body" style={bodyStyle(phone)}>
          <div role="group" aria-labelledby="colours-groups" data-testid="colours-groups" style={{ ...block, borderTop: 0 }}>
            <BlockTitle title={COLOURS_COPY.groups} small={phone} id="colours-groups" sub={COLOURS_COPY.order(groups.length)} />
            {groups.length === 0 ? <span style={words(textStep.meta, 400, t.text2)}>{COLOURS_COPY.noGroups}</span> : null}
            <SortableRows
              label={COLOURS_COPY.groups}
              height={44}
              onOrder={props.onOrderGroups}
              rows={groups.map((group) => ({
                key: group.id,
                name: groupName(group),
                render: (grip) => (
                  <span data-colours-group={group.id} data-menu-open={menuOpen === group.id || undefined} style={{ display: "flex", alignItems: "center", gap: GAP.row, flexGrow: 1, minWidth: 0, alignSelf: "stretch", padding: "0 4px", borderRadius: 6, background: menuOpen === group.id ? t.tile : "transparent" }}>
                    {grip}
                    {phone ? (
                      /* Prompt 24: on a phone the group is a row that opens it: a 16 swatch (radius 4), the name 15/500, "3 components"
                         13 Text 3 and a chevron. */
                      <button type="button" data-testid="colours-group-open" onClick={() => props.onOpenGroup(group.id)} style={{ display: "flex", alignItems: "center", gap: 12, flexGrow: 1, minWidth: 0, minHeight: 52, padding: 0, border: 0, background: "transparent", color: t.text, textAlign: "left", cursor: "pointer" }}>
                        <span aria-hidden="true" style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 4, background: group.colour }} />
                        <span style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
                          <span style={{ ...words(15, 500, group.name ? t.text : t.text2), ...ELLIPSIS }}>{groupName(group)}</span>
                          <span style={{ ...words(13, 400, t.label), ...ELLIPSIS }}>
                            {COLOURS_COPY.components(group.members.length)}
                            {isLinked(`group:${group.id}`) ? ` · ${COLOURS_COPY.linked}` : ""}
                          </span>
                        </span>
                        <span aria-hidden="true" style={{ display: "inline-flex", color: t.label }}>
                          <MobileIcon name="chevr" size={20} />
                        </span>
                      </button>
                    ) : (
                      <>
                        <SquareSwatch colour={group.colour} size={14} />
                        <span style={{ ...words(textStep.body, 500, group.name ? t.text : t.text2), ...ELLIPSIS }}>{groupName(group)}</span>
                        <span style={{ ...COUNT, flexGrow: 1 }}>{group.colour}</span>
                        <span style={{ ...words(textStep.meta, 400, t.label), flexShrink: 0 }}>
                          {COLOURS_COPY.components(group.members.length)}
                          {isLinked(`group:${group.id}`) ? ` · ${COLOURS_COPY.linked}` : ""}
                        </span>
                      </>
                    )}
                    <GroupMenu
                      group={group}
                      others={groups.filter((other) => other.id !== group.id)}
                      onOpenChange={(open) => setMenuOpen(open ? group.id : null)}
                      onOpen={() => props.onOpenGroup(group.id)}
                      onMerge={(intoId) => {
                        const into = groups.find((candidate) => candidate.id === intoId);
                        if (into) merge(group, into);
                      }}
                      onDelete={() => setConfirm({ kind: "delete", group })}
                    />
                  </span>
                ),
              }))}
            />
          </div>
          <div role="group" aria-labelledby="colours-singles" data-testid="colours-singles" style={block}>
            <BlockTitle title={COLOURS_COPY.singles} small={phone} id="colours-singles" sub={COLOURS_COPY.singlesCount(singlesCount)} />
            {singlesCount === 0 ? <span style={words(textStep.meta, 400, t.text2)}>{COLOURS_COPY.noSingles}</span> : null}
            <SortableRows
              label={COLOURS_COPY.singles}
              height={44}
              onOrder={props.onOrderSingles}
              rows={singles.map((ref) => {
                const colour = stateIn(model, ref).colour ?? "";
                return {
                  key: ref,
                  name: nameOf(ref),
                  render: (grip) => (
                    phone ? (
                      /* Prompt 24: a single colour on a phone: a 16 swatch (radius 4), the name 15/500, "linked text" 13 Text 3. */
                      <span data-colours-single={ref} style={{ display: "flex", alignItems: "center", gap: 12, flexGrow: 1, minWidth: 0, minHeight: 52 }}>
                        {grip}
                        <span aria-hidden="true" style={{ width: 16, height: 16, flexShrink: 0, borderRadius: 4, background: colour }} />
                        <span style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
                          <span style={{ ...words(15, 500, t.text), ...ELLIPSIS }}>{nameOf(ref)}</span>
                          {isLinked(ref) ? <span style={words(13, 400, t.label)}>{COLOURS_COPY.linked}</span> : null}
                        </span>
                      </span>
                    ) : (
                    <span data-colours-single={ref} style={{ display: "flex", alignItems: "center", gap: GAP.row, flexGrow: 1, minWidth: 0, padding: "0 4px" }}>
                      {grip}
                      <SquareSwatch colour={colour} size={14} />
                      <Badge>{lookup.get(ref)?.number ?? ""}</Badge>
                      <span style={{ ...words(textStep.body, 500, t.text), ...ELLIPSIS }}>{nameOf(ref)}</span>
                      <span style={{ ...COUNT, flexGrow: 1 }}>{colour}</span>
                      {isLinked(ref) ? <span style={{ ...words(textStep.meta, 400, t.label), flexShrink: 0 }}>{COLOURS_COPY.linked}</span> : null}
                    </span>
                    )
                  ),
                };
              })}
            />
            {shared.map(([colour, refs]) => (
              <InnerPanel key={colour} testId="colours-shared" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ ...words(textStep.meta, 400, t.text2, 17), flexGrow: 1, minWidth: 0 }}>{COLOURS_COPY.shared(andList(refs.map(nameOf)))}</span>
                <RecipeButton small phone={phone} onClick={() => props.onGroupThese(refs, colour)}>
                  {COLOURS_COPY.makeThemGroup}
                </RecipeButton>
              </InnerPanel>
            ))}
          </div>
          <div role="group" aria-labelledby="colours-saved" data-testid="colours-saved" style={block}>
            <BlockTitle title={COLOURS_COPY.saved} small={phone} id="colours-saved" sub={COLOURS_COPY.savedHint} />
            {props.swatches.favourites.length === 0 ? <span style={words(textStep.meta, 400, t.text2)}>{COLOURS_COPY.noSaved}</span> : null}
            <div data-swatch-row="" style={{ display: "flex", flexWrap: "wrap", gap: phone ? 16 : GAP.swatch, ...(phone ? { padding: 8 } : null) }}>
              {props.swatches.favourites.map((hex) => (
                <SavedSwatch key={hex} large touch={phone} hex={hex} current={false} onUse={() => undefined} onRemove={() => props.onSwatches({ ...props.swatches, favourites: props.swatches.favourites.filter((entry) => entry !== hex) })} />
              ))}
            </div>
          </div>
        </div>
      </ModalInset.Provider>
      <div data-testid="colours-footer" style={phone ? { ...footerStyle(phone), ...rulesOff, margin: `12px -${PHONE_MARGIN}px 0`, padding: `12px ${PHONE_MARGIN}px calc(12px + env(safe-area-inset-bottom))`, background: t.surface } : footerStyle(phone)}>
        {phone ? null : <UndoRedo phone={phone} canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.onUndo} onRedo={history.onRedo} />}
        {/* Synth 09: a ghost button; the danger is in the question it asks. */}
        <RecipeButton variant="ghost" phone={phone} data-testid="colours-clear" onClick={() => setConfirm({ kind: "clear" })}>
          {COLOURS_COPY.clear}
        </RecipeButton>
        <span style={{ flexGrow: 1 }} />
        <RecipeButton variant="primary" phone={phone} onClick={props.onClose}>
          {COLOURS_COPY.done}
        </RecipeButton>
      </div>
      <ConfirmDialog
        open={confirm?.kind === "clear"}
        width={MODAL_WIDTH.standard}
        testId="colours-clear-confirm"
        title={COLOURS_COPY.clearTitle}
        body={COLOURS_COPY.clearBody(groups.length, singlesCount, props.linkCount)}
        action={COLOURS_COPY.clearAction}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          props.onClearAll();
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        testId="colours-delete-confirm"
        title={confirm?.kind === "delete" ? COLOURS_COPY.deleteTitle(groupName(confirm.group)) : ""}
        body={confirm?.kind === "delete" ? COLOURS_COPY.deleteBody(confirm.group.members.length) : ""}
        action={COLOURS_COPY.deleteAction}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "delete") props.onDelete(confirm.group.id);
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === "merge"}
        testId="colours-merge-confirm"
        title={confirm?.kind === "merge" ? COLOURS_COPY.mergeTitle(groupName(confirm.from), groupName(confirm.into)) : ""}
        body={confirm?.kind === "merge" ? COLOURS_COPY.mergeBody(groupName(confirm.into)) : ""}
        action={COLOURS_COPY.mergeAction}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "merge") props.onMerge(confirm.from.id, confirm.into.id, "into");
          setConfirm(null);
        }}
      />
    </div>
  );
}

export function ColoursWindow(props: ColoursWindowProps) {
  const { open, onClose } = props;
  return (
    <ModalShell open={open} onOpenChange={(next) => !next && onClose()} title={COLOURS_COPY.title} subtitle={COLOURS_COPY.subtitle} width={MODAL_WIDTH.standard} testId="colours-window" phoneHeight="half">
      <ColoursBody {...props} />
    </ModalShell>
  );
}

export default ColoursWindow;

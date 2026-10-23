/* CA-19 — colour and references on the composer: the build's colours as one model, the one history every colour and link
   step goes through, the writes, and the names the screen uses.

   THE MODEL is read from `builds.making` and the tiles' own `payload.colour` (`colourModelOf`). A step's writes go to the
   composer's writers at once: single colours through `writeColour` (a tile's payload, a session's or a part's entry in
   `making`), groups and the order of single colours through `setReferenceGroups`, one after another in the node queue.
   Until the saved build shows them, what was written is laid over it (`pending`), so the List, the map, Details and the
   post draw it straight away and the next step starts from it.

   THE SIZE RULE after a deletion elsewhere: when a tile, a session or a part this visit has seen is gone, the groups it
   was in lose it, and a group left with one member folds into that member's single colour, as one step with Undo. */

import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { allParts } from "@/components/build/PartWindow";
import type { SessionGroup, Step } from "@/lib/build/graph";
import { groupKey } from "@/lib/build/graph";
import { linkRanges } from "@/lib/build/linkRules";
import { groupRefEntries, shownName, withGroupEntries, type RefEntry } from "@/lib/build/postRefs";
import { applyWrites, colourModelOf, pruneGroups, referenceGroupsOf, singleColourOrderOf, type ColourModel, type ColourWrites, type ReferenceGroup } from "@/lib/build/referenceGroups";
import { setReferenceGroups } from "@/lib/build/referenceGroupsWrite";
import { NOTICE_COPY } from "@/lib/build/referenceHistory";
import { refTo } from "@/lib/build/thread";
import { storedWorkstreamsOf } from "@/lib/build/making";

import { useReferenceHistory, type ReferenceHistoryControls } from "./useReferenceHistory";

/** How long a write is laid over the saved build at most, should the saved build never show it. */
const PENDING_MS = 8000;

interface Pending {
  singles: Record<string, string | null>;
  groups?: ReferenceGroup[];
  order?: string[];
}

export interface ReferencesInput {
  /** `builds.making` as saved. */
  made: unknown;
  /** The build's steps as saved (no preview), for the tiles' own colours. */
  savedSteps: readonly Step[];
  savedGroups: readonly SessionGroup[];
  /** Writes one component's single colour, or takes it off. */
  writeColour: (to: string, colour: string | null) => void;
  /** Saves the groups and the order of single colours. */
  saveGroups: (groups: ReferenceGroup[], order?: string[]) => Promise<void>;
  /** Whether the build has loaded: nothing is folded before it has. */
  loaded: boolean;
  /** The screen's name for a component: "Code 4", "Session 2". */
  nameOf: (to: string) => string;
}

export interface References {
  history: ReferenceHistoryControls;
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  /** The colours as they stand, writes not yet saved included. */
  model: ColourModel;
  /** `making` with the groups and the order as they stand. */
  making: unknown;
  /** Single colours written and not yet saved, by ref, for drawing. */
  pending: Readonly<Record<string, string | null>>;
  groups: ReferenceGroup[];
  /** A lookup with every group as a link target too. */
  withGroups: (lookup: ReadonlyMap<string, RefEntry>) => Map<string, RefEntry>;
  /** The groups as link targets, by `to`. */
  groupEntries: (lookup: ReadonlyMap<string, RefEntry>) => Map<string, RefEntry>;
  /** The screen's name for a target in a lookup. */
  nameIn: (lookup: ReadonlyMap<string, RefEntry>, to: string) => string;
  /** The targets the post links to now, each once. */
  linkedTargets: () => string[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useReferences({ made, savedSteps, savedGroups, writeColour, saveGroups, loaded, nameOf }: ReferencesInput): References {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState<Pending>({ singles: {} });
  const timer = useRef<number | undefined>(undefined);

  const making = useMemo(() => {
    if (!pending.groups && !pending.order) return made;
    const base = made && typeof made === "object" ? (made as Record<string, unknown>) : {};
    return { ...base, ...(pending.groups ? { reference_groups: pending.groups } : null), ...(pending.order ? { single_colour_order: pending.order } : null) };
  }, [made, pending.groups, pending.order]);
  const tiles = useMemo(() => allParts(savedSteps), [savedSteps]);
  const saved = useMemo(() => colourModelOf(made, tiles), [made, tiles]);
  const model = useMemo(() => applyWrites(colourModelOf(making, tiles), { singles: pending.singles }), [making, tiles, pending.singles]);

  // What was written goes once the saved build shows it.
  useEffect(() => {
    setPending((current) => {
      const singles = Object.fromEntries(Object.entries(current.singles).filter(([ref, hex]) => (saved.singles[ref] ?? null) !== hex));
      const groups = current.groups && !same(current.groups, referenceGroupsOf(made)) ? current.groups : undefined;
      const order = current.order && !same(current.order, singleColourOrderOf(made) ?? []) ? current.order : undefined;
      if (Object.keys(singles).length === Object.keys(current.singles).length && groups === current.groups && order === current.order) return current;
      return { singles, ...(groups ? { groups } : null), ...(order ? { order } : null) };
    });
  }, [saved, made]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const writeRef = useRef(writeColour);
  writeRef.current = writeColour;
  const saveRef = useRef(saveGroups);
  saveRef.current = saveGroups;
  const orderRef = useRef<string[] | undefined>(undefined);
  orderRef.current = model.order;

  const applyColours = useCallback((writes: ColourWrites) => {
    for (const [ref, hex] of Object.entries(writes.singles)) writeRef.current(ref, hex);
    if (writes.groups || writes.order) void saveRef.current(writes.groups ?? [], writes.order ?? orderRef.current).catch(() => undefined);
    setPending((current) => ({
      singles: { ...current.singles, ...writes.singles },
      ...(writes.groups ? { groups: writes.groups } : current.groups ? { groups: current.groups } : null),
      ...(writes.order ? { order: writes.order } : current.order ? { order: current.order } : null),
    }));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPending({ singles: {} }), PENDING_MS);
  }, []);

  // Groups are saved whole: a write that changes only single colours keeps the groups as they stand.
  const groupsRef = useRef<ReferenceGroup[]>([]);
  groupsRef.current = model.groups;
  const apply = useCallback((writes: ColourWrites) => applyColours(writes.order && !writes.groups ? { ...writes, groups: groupsRef.current } : writes), [applyColours]);

  const history = useReferenceHistory({ editor, applyColours: apply });

  /* The size rule after a deletion elsewhere: only components this visit has seen, so a build still loading folds nothing. */
  const seen = useRef<Set<string>>(new Set());
  const present = useMemo(() => {
    const refs = new Set<string>();
    for (const tile of tiles) refs.add(refTo({ kind: "node", id: tile.id }));
    for (const group of savedGroups) refs.add(refTo({ kind: "session", id: groupKey(group) }));
    for (const part of storedWorkstreamsOf(made)) refs.add(refTo({ kind: "workstream", id: part.key }));
    return refs;
  }, [tiles, savedGroups, made]);
  const step = history.step;
  const nameRef = useRef(nameOf);
  nameRef.current = nameOf;
  useEffect(() => {
    if (!loaded) return;
    for (const ref of present) seen.current.add(ref);
    const gone = (ref: string) => seen.current.has(ref) && !present.has(ref);
    const move = pruneGroups(model, (ref) => !gone(ref));
    if (!move) return;
    const folded = move.folded?.[0];
    const left = folded?.members.find((ref) => !gone(ref));
    const shrunk = model.groups.find((group) => group.members.some(gone));
    const sentence = folded && left ? NOTICE_COPY.folded(folded.name ?? NOTICE_COPY.noName, nameRef.current(left)) : NOTICE_COPY.trimmed(shrunk?.name ?? NOTICE_COPY.noName);
    step(sentence, { move });
  }, [present, loaded, model, step]);

  const withGroups = useCallback((lookup: ReadonlyMap<string, RefEntry>) => withGroupEntries(lookup, model.groups), [model.groups]);
  const groupEntries = useCallback((lookup: ReadonlyMap<string, RefEntry>) => new Map(groupRefEntries(model.groups, lookup).map((entry) => [entry.to, entry] as const)), [model.groups]);
  const nameIn = useCallback((lookup: ReadonlyMap<string, RefEntry>, to: string) => shownName(lookup.get(to)) || NOTICE_COPY.noName, []);
  const linkedTargets = useCallback(() => (editor && !editor.isDestroyed ? [...new Set(linkRanges(editor.state.doc).map((range) => range.to))] : []), [editor]);

  return { history, editor, setEditor, model, making, pending: pending.singles, groups: model.groups, withGroups, groupEntries, nameIn, linkedTargets };
}

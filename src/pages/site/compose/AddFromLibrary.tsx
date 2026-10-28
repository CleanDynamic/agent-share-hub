/* SV-18: Add from Library, with its reads. This is the window's own chunk: the composer loads it on hover or focus of
   Add › From Library and at idle once it is ready (`preloadAddFromLibrary`), and shows it through React.lazy.

   The reader's saved items are one request, with Used in (one) and the collections (one, then one for what is in them) started
   with it; the makers' handles follow, which need the first. A saved item that does not fit where the maker is adding is not in
   the list, and what fits is looked up, not searched (`fitsPlace`, `rowsFor`). The host holds the tab, the search, the choice
   and the version: the window is pure.

   Insert hands the page the saved items to put in (one for a step, a part or a session; the collection's, in order, for a
   collection) and closes. The page writes them, through the composer's one writer, and says the one sentence on its history. */

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { reportError } from "@/lib/errors/report";
import { fitWords, missingKindWords, type LibraryPlace } from "@/lib/build/fromLibrary";
import { collectionSavedItemIds, makerHandles, type LibrarySavedItem } from "@/lib/library/savedItems";

import { insertReads } from "./addFromLibraryReads";
import { AddFromLibraryWindow, type LibraryTab, type LibraryVersion } from "./AddFromLibraryWindow";
import { COLLECTION_FOOTER, collectionRows, footerFor, rowsFor } from "./libraryWindowModel";

export interface AddFromLibraryProps {
  open: boolean;
  place: LibraryPlace;
  phone: boolean;
  /** Called with the saved items to put in, in order. The window has closed. */
  onInsert: (items: LibrarySavedItem[], place: LibraryPlace, version: LibraryVersion) => void;
  onClose: () => void;
  onCloseFocus?: (event: Event) => void;
}

/** A failed read is told about once, by its name (never its content). */
function useReported(error: unknown, context: string) {
  useEffect(() => {
    if (error) reportError(error, { source: "query", context });
  }, [error, context]);
}

const noun = (place: LibraryPlace): string => (place.kind === "agent" ? "prompt" : place.kind === "team" ? "agent" : "step");

export default function AddFromLibrary({ open, place, phone, onInsert, onClose, onCloseFocus }: AddFromLibraryProps) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const [tab, setTab] = useState<LibraryTab>("steps");
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [version, setVersion] = useState<LibraryVersion>("saved");

  const reads = insertReads(viewerId);
  const saved = useQuery({ ...reads.saved, enabled: open && viewerId !== null });
  const usedIn = useQuery({ ...reads.usedIn, enabled: open && viewerId !== null });
  const collections = useQuery({ ...reads.collections, enabled: open && viewerId !== null });
  const collectionIds = (collections.data ?? []).map((collection) => collection.id);
  const contents = useQuery({ queryKey: ["library", "collectionSavedItemIds", collectionIds], queryFn: () => collectionSavedItemIds(collectionIds), enabled: open && collectionIds.length > 0, staleTime: 30_000 });
  const items = useMemo(() => (saved.data?.items ?? []).filter((item) => item.kind === "step" || item.kind === "part" || item.kind === "session"), [saved.data]);
  const makerIds = [...new Set(items.flatMap((item) => ((item.snapshot as { source?: { makerId?: string | null } }).source?.makerId ? [(item.snapshot as { source: { makerId: string } }).source.makerId] : [])))].sort();
  const handles = useQuery({ queryKey: ["library", "makerHandles", makerIds], queryFn: () => makerHandles(makerIds), enabled: open && makerIds.length > 0, staleTime: 5 * 60_000 });
  useReported(saved.error, "add-from-library-saved");
  useReported(collections.error, "add-from-library-collections");

  const facts = useMemo(() => ({ usedIn: usedIn.data ?? new Map<string, number>(), handles: handles.data ?? new Map<string, string>() }), [usedIn.data, handles.data]);
  const steps = useMemo(() => rowsFor(items, place, facts), [items, place, facts]);
  const kept = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const grouped = useMemo(
    () => collectionRows((collections.data ?? []).map((collection) => ({ id: collection.id, name: collection.name, itemIds: contents.data?.get(collection.id) ?? [] })), kept, place),
    [collections.data, contents.data, kept, place],
  );

  const rows = tab === "steps" ? steps.rows : grouped.rows;
  const selected = rows.some((row) => row.id === chosen) ? chosen : null;
  const status = saved.isError || (tab === "collections" && collections.isError) ? "error" : saved.isLoading || (tab === "collections" && (collections.isLoading || contents.isLoading)) ? "loading" : "ready";
  const item = selected && tab === "steps" ? (steps.byId.get(selected) ?? null) : null;

  const insert = (id: string) => {
    const picked = tab === "steps" ? [steps.byId.get(id)] : grouped.items.get(id);
    const list = (picked ?? []).filter((entry): entry is LibrarySavedItem => Boolean(entry));
    if (list.length === 0) return;
    onClose();
    onInsert(list, place, version);
  };

  return (
    <AddFromLibraryWindow
      open={open}
      phone={phone}
      place={place.name}
      fits={fitWords(place)}
      noun={noun(place)}
      tab={tab}
      counts={{ steps: steps.rows.length, collections: grouped.rows.length }}
      missing={missingKindWords(place)}
      query={query}
      status={status}
      rows={rows}
      selectedId={selected}
      version={version}
      footer={tab === "steps" ? (item ? footerFor(item, facts, viewerId) : "") : COLLECTION_FOOTER}
      onTab={(next) => {
        setTab(next);
        setChosen(null);
      }}
      onQuery={setQuery}
      onSelect={setChosen}
      onVersion={setVersion}
      onInsert={insert}
      onClose={onClose}
      onRetry={() => void Promise.all([saved.refetch(), collections.refetch(), contents.refetch()])}
      onCloseFocus={onCloseFocus}
    />
  );
}

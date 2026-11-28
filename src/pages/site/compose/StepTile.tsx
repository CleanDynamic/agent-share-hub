/* MS-05 — the map's tile: the List's own card (README Decision 14), drawn through `ListTile` with `variant="map"`.

   No markup lives here. `BuildList.tsx` exports the card dispatcher the List itself draws with (`ListTile`), the Result's
   card (`ListResultTile`) and `TileVariantContext`, which tells a card it is on the map: it then leaves out the drag handle,
   the List's menu, the colour button, the footer link, Uses chips and nest buttons, shows the map's number, and draws only
   the parts in `show`. The List's handlers the map has no use for are no-ops: nothing on the map edits a step. */

import { useMemo, type ReactNode } from "react";

import type { Step } from "@/lib/build/graph";
import type { MapTilePart } from "@/lib/build/mapLayout";

import { ListResultTile, ListTile, TileVariantContext, type BuildListProps, type TileVariant } from "./BuildList";
import type { ListResult } from "./buildListModel";

const none = () => undefined;
const no = async () => false;
const NO_DIVIDERS = new Map();
const NO_IDS: ReadonlySet<string> = new Set();

export interface StepTileProps {
  /** A top-level step, or a Result (which isn't a step: `ListResult`). */
  tile: { step: Step } | { result: ListResult };
  /** The build's top-level steps, for the numbers a tile's foot names ("made by prompt 1"). */
  steps: readonly Step[];
  /** File and tool names by node id, as the List has them. */
  names?: Readonly<Record<string, string>>;
  variant?: TileVariant["variant"];
  show?: readonly MapTilePart[];
  badge?: string;
  menu?: ReactNode;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

/** One tile as the List draws it, for the map. */
export function StepTile({ tile, steps, names = {}, variant = "map", show, badge, menu, selected = false, onSelect = none }: StepTileProps) {
  const id = "step" in tile ? tile.step.id : tile.result.id;
  const props = useMemo<BuildListProps>(
    () => ({
      phone: false,
      steps,
      dividers: NO_DIVIDERS,
      names,
      suggestions: [],
      intoResult: NO_IDS,
      results: [],
      selectedId: selected ? id : null,
      onSelect,
      onRename: none,
      onMove: none,
      onRemove: none,
      onAccept: none,
      onDismiss: none,
      onAddPrompt: no,
      onAddAgentPrompt: no,
      onAddAgentTo: none,
    }),
    [steps, names, selected, id, onSelect],
  );
  const context = useMemo<TileVariant>(() => ({ variant, show, badge, menu }), [variant, show, badge, menu]);
  return (
    <TileVariantContext.Provider value={context}>
      {"step" in tile ? <ListTile step={tile.step} index={0} last props={props} /> : <ListResultTile result={tile.result} selected={selected} onSelect={onSelect} />}
    </TileVariantContext.Provider>
  );
}

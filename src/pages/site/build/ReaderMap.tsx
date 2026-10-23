/* CA-17 P4 — the build page's map of sessions: the same column and panel the composer draws (`SessionMap`,
   `SessionMapPanel`), read-only. A reader's head has Fit to screen and nothing else (no direction switch, no Map options);
   the maker's direction is the one drawn (vertical below 768 wide); the panel has no "Open in the build".

   It is loaded on demand when a reader chooses Map, as `StepsList` always did. Whether the reader is offered the Map at all
   is the maker's choice (`readerSeesMap`, CA-17 P6). */

import { useMemo, useState } from "react";

import { readerMapDirection } from "@/lib/build/making";
import { sessionMapFor } from "@/lib/build/sessionMap";
import { BETWEEN, useMinWidth } from "@/components/shell/useMinWidth";
import { MAP_AND_PANEL, MAP_COLUMN, MAP_STACKED } from "@/pages/site/compose/mapRecipes";
import { SessionMapColumn } from "@/pages/site/compose/SessionMap";
import { SessionMapPanel } from "@/pages/site/compose/SessionMapPanel";

import type { BuildStepsView } from "./buildModel";

export interface ReaderMapProps {
  view: BuildStepsView;
  announce: (text: string) => void;
  /** Open the full prompt window on a step. */
  onRead: (id: string) => void;
  /** Where the map starts: a session selected (a link to it, or `#session-` in the address). */
  start?: { selected: string | null } | null;
}

export default function ReaderMap({ view, start }: ReaderMapProps) {
  const [selected, setSelected] = useState<string | null>(start?.selected ?? null);
  const steps = useMemo(() => view.steps.map((entry) => entry.step), [view.steps]);
  const model = useMemo(() => sessionMapFor({ groups: view.map.groups, steps, files: view.map.files, making: view.making ?? {} }), [view.map, steps, view.making]);
  const stacked = !useMinWidth(BETWEEN.stack);
  const shown = selected && model.sessions.some((session) => session.key === selected) ? selected : null;
  return (
    <div data-testid="reader-map" style={stacked ? MAP_STACKED : MAP_AND_PANEL}>
      <div style={MAP_COLUMN}>
        <SessionMapColumn model={model} direction={readerMapDirection(view.making)} selected={shown} onSelect={setSelected} />
      </div>
      <SessionMapPanel model={model} selected={shown} stacked={stacked} />
    </div>
  );
}

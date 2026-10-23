/* CA-17 P4 — the map of sessions on a dev page: the same column and panel the composer draws, from a fixture's steps and
   groups (and its `making`, when it has parts), with a selection of its own. Nothing is written. */

import { useMemo, useState, type ReactNode } from "react";

import type { MapFixture } from "@/dev/fixtures/sandbox";
import type { MapDirection } from "@/lib/build/sessionMap";
import { sessionMapFor } from "@/lib/build/sessionMap";
import { NoMap, SessionMapColumn } from "@/pages/site/compose/SessionMap";
import { SessionMapPanel } from "@/pages/site/compose/SessionMapPanel";

export interface DevMapOptions {
  fixture: MapFixture;
  /** `builds.making`, for parts, labels and the map's settings. */
  making?: unknown;
  direction?: MapDirection;
  /** The selection the page starts with, and where the page keeps it when the page owns it. */
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  /** Draw "No map for this build." in place of the map. */
  none?: boolean;
  reader?: boolean;
}

/** The map's column and its panel. */
export function useDevMap({ fixture, making = {}, direction: first = "horizontal", selected: initial = null, onSelect, none = false, reader = false }: DevMapOptions): { column: ReactNode; panel: ReactNode } {
  const [own, setOwn] = useState<string | null>(initial);
  const [direction, setDirection] = useState<MapDirection>(first);
  const [onBuildPage, setOnBuildPage] = useState(true);
  const model = useMemo(() => sessionMapFor({ groups: fixture.groups, steps: fixture.steps, files: fixture.files, making }), [fixture, making]);
  const selected = onSelect ? (initial && model.sessions.some((session) => session.key === initial) ? initial : null) : own && model.sessions.some((session) => session.key === own) ? own : null;
  const select = onSelect ?? setOwn;
  if (none) return { column: <NoMap onCreate={() => undefined} />, panel: null };
  return {
    column: (
      <SessionMapColumn
        model={model}
        direction={direction}
        selected={selected}
        onSelect={select}
        shownLine={reader ? undefined : onBuildPage ? "Shown on build page" : "Not on build page"}
        controls={reader ? undefined : { onDirection: setDirection, onBuildPage, onToggleBuildPage: setOnBuildPage, onRemove: () => undefined }}
      />
    ),
    panel: <SessionMapPanel model={model} selected={selected} onOpenInBuild={reader ? undefined : () => undefined} />,
  };
}

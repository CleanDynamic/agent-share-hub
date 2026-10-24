/* CA-21 P0: /dev/kit/pages/sandbox?build=ca21: "Moving", the build page moved on a fixture.

   Two parts: Part 1 holds Session 1 (Prompts 1 to 3 and a team of two agents) and Session 2 (an agent, a tool, a decision, a manual
   step and a file); Part 2 is empty. Every move goes through the same rules as the composer (`moveBy` for Move up and Move down,
   the live order of a drag for the mouse and the keys); the "database" is this page's memory, so nothing is written anywhere.

   `&select=<id>` selects a tile or a session. */

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { ca21Making, ca21Tree } from "@/dev/fixtures/ca21";
import { sandboxSourcesProps, sandboxViewProps } from "@/dev/fixtures/sandbox";
import { sessionFacts, shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeSource } from "@/dev/fixtures/shapes";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { buildSteps, groupKey, sessionGroups } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, type Making } from "@/lib/build/making";
import { applyWrite, type MemoryBuild } from "@/lib/build/moveMemory";
import { moveBy, movedLine, writeOf, type MoveModel } from "@/lib/build/moveRules";
import { BuildList } from "@/pages/site/compose/BuildList";
import { dividers } from "@/pages/site/compose/buildListModel";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";
import { listPartsOf } from "@/pages/site/compose/partsModel";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";

import { useDevMap } from "./DevMap";
import type { DesignPageProps } from "./KitPages";

const TITLE = "An order page for a bakery";

export default function MovingDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const phone = useIsPhone();
  const fine = useFinePointer();
  const theme = useDesignTheme();
  const [build, setBuild] = useState<MemoryBuild>(() => ({ tree: ca21Tree, making: ca21Making }));
  const [selectedId, setSelectedId] = useState<string | null>(params.get("select"));
  const [said, setSaid] = useState("");

  const steps = useMemo(() => buildSteps(build.tree), [build.tree]);
  const groups = useMemo(() => sessionGroups(steps, build.making.sessions, build.making.session_tools ?? {}, sessionsMetaOf(build.making), sessionOrderOf(build.making)), [steps, build.making]);
  const partsModel = useMemo(() => listPartsOf(build.making, groups, theme), [build.making, groups, theme]);
  const addToParts = useMemo(() => partsModel?.list.map((part) => ({ key: part.view.key, label: part.view.label, title: part.title, colour: part.view.colour })), [partsModel]);
  const source: ShapeSource = useMemo(() => ({ tree: build.tree, making: build.making, selected: selectedId ?? "" }), [build, selectedId]);
  const list = { ...shapeListProps("one-sitting", source), steps };
  const { counts } = sessionFacts(build.tree);
  const heads = useMemo(() => dividers(steps, groups, counts, {}), [steps, groups, counts]);

  const model = useMemo<MoveModel>(
    () => ({
      hasParts: Boolean(partsModel),
      parts: partsModel ? partsModel.list.map((part) => ({ key: part.view.key, sessions: [...part.sessions] })) : [{ key: "", sessions: groups.filter((group) => !group.implicit).map((group) => groupKey(group)) }],
      tiles: Object.fromEntries(groups.filter((group) => !group.implicit).map((group) => [groupKey(group), steps.filter((step) => group.stepNumbers.includes(step.number)).map((step) => step.id)])),
      nested: Object.fromEntries(steps.filter((step) => step.children.length > 0 || (step.sentWith?.length ?? 0) > 0).map((step) => [step.id, (step.sentWith?.length ? step.sentWith : step.children).map((child) => child.id)])),
      loose: [],
    }),
    [partsModel, groups, steps],
  );
  const onMove = useCallback(
    (id: string, by: -1 | 1) => {
      const result = moveBy(model, id, by);
      const write = result ? writeOf(model, result.model, id) : null;
      if (!result || !write) return;
      setBuild((previous) => applyWrite(previous, write));
      setSaid(movedLine(result.move, { tile: (tile) => steps.find((step) => step.id === tile)?.defaultTitle ?? "that tile", session: (key) => `Session ${groups.find((group) => groupKey(group) === key)?.number ?? ""}`.trim(), part: (key) => partsModel?.titles.get(key) ?? "that part" }));
    },
    [model, steps, groups, partsModel],
  );

  const mapData = { ...shapeMapProps("one-sitting", source), steps, groups };
  const devMap = useDevMap({ fixture: mapData, making: build.making as Making, direction: "horizontal", selected: selectedId, onSelect: setSelectedId, none: false });

  return (
    <SandboxView
      fit={fit}
      {...sandboxViewProps("fox", state)}
      counts={{ sessions: 2, prompts: 3, files: 1 }}
      title={TITLE}
      lens="list"
      onLens={() => undefined}
      list={
        <BuildList
          {...list}
          phone={phone}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={onMove}
          said={said}
          parts={
            partsModel
              ? {
                  parts: partsModel.list,
                  withAbove: partsModel.withAbove,
                  ops: { onName: () => undefined, onMove, onRemove: () => undefined, onStartsAfter: () => undefined },
                  onToggle: () => undefined,
                  onAddSession: () => undefined,
                }
              : undefined
          }
          onAddPart={() => undefined}
          onDropSession={() => undefined}
          sessionOps={{ onTitle: () => undefined, onMove, onRemove: () => undefined, onMoveToPart: () => undefined, onWithAbove: () => undefined }}
          addSession={{ library: sandboxSourcesProps("bakery").library, adding: false, onAdd: () => undefined, onStartNew: () => undefined, parts: addToParts }}
          onDropOnWorkstream={() => undefined}
          onDropWorkstream={() => undefined}
          dividers={heads}
        />
      }
      sources={<SourcesPanel {...sandboxSourcesProps("bakery", state)} phone={phone} fine={fine} parts={addToParts} />}
      map={devMap.column}
      mapPanel={devMap.panel}
      selection={selectedId ? <DetailsPanel {...shapeDetailsProps("one-sitting", selectedId, source)} phone={phone} onSelect={setSelectedId} /> : undefined}
    />
  );
}

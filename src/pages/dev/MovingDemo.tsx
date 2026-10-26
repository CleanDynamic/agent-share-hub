/* CA-21 P0: /dev/kit/pages/sandbox?build=ca21: "Moving", the build page moved on a fixture.

   Two parts: Part 1 holds Session 1 (Prompts 1 to 3 and a team of two agents) and Session 2 (an agent, a tool, a decision, a manual
   step and a file); Part 2 is empty. Every move goes through the same rules as the composer (`moveBy` for Move up and Move down,
   the live order of a drag for the mouse and the keys); the "database" is this page's memory, so nothing is written anywhere.

   `&select=<id>` selects a tile or a session. `&prompts=<n>` gives the first chat in Sources n prompts (3 by default), for SV-06's
   timing of an import of 1, 4, 8 and 18 prompts. */

import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { ca21Making, ca21Tree } from "@/dev/fixtures/ca21";
import { sandboxSourcesProps, sandboxViewProps } from "@/dev/fixtures/sandbox";
import { sessionFacts, shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeSource } from "@/dev/fixtures/shapes";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { buildSteps, groupKey, sessionGroups } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, storedWorkstreamsOf, type Making } from "@/lib/build/making";
import { applyWrite, type MemoryBuild } from "@/lib/build/moveMemory";
import { locate, moveBy, movedLine, placePart, placeSession, writeOf, type MoveModel, type Write } from "@/lib/build/moveRules";
import { BuildList } from "@/pages/site/compose/BuildList";
import type { Arriving } from "@/pages/site/compose/arrival";
import { NO_APP, type SourceLibraryItem } from "@/pages/site/compose/sourcesModel";
import type { NodeTree } from "@/lib/build/types";
import type { Json } from "@/integrations/supabase/types";
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
  const groups = useMemo(() => sessionGroups(steps, build.making.sessions, build.making.session_tools ?? {}, sessionsMetaOf(build.making), sessionOrderOf(build.making), storedWorkstreamsOf(build.making)), [steps, build.making]);
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

  /* The writes a drop asks for, kept in memory (a short wait, as a save takes). */
  const write = useCallback((made: Write | null) => {
    if (!made) return Promise.resolve(false);
    return new Promise<boolean>((resolve) =>
      window.setTimeout(() => {
        setBuild((previous) => applyWrite(previous, made));
        resolve(true);
      }, 120),
    );
  }, []);
  const onMoveToSession = useCallback(
    (id: string, key: string, options?: { order?: readonly string[]; sentence?: string }) => write({ kind: "tile", id, session: key, reassign: { id, session: key }, atEnd: options?.order ? [...options.order] : [id] }),
    [write],
  );
  const onDropSession = useCallback(
    (key: string, over: string) => {
      const found = locate(model, over);
      if (found?.kind !== "session") return Promise.resolve();
      const next = placeSession(model, key, found.part, found.index);
      return write(writeOf(model, next, key)).then(() => undefined);
    },
    [model, write],
  );
  const onDropOnWorkstream = useCallback((key: string, part: string) => write(writeOf(model, placeSession(model, key, part, Number.MAX_SAFE_INTEGER), key)).then(() => undefined), [model, write]);
  const onDropWorkstream = useCallback(
    (key: string, over: string) => {
      const found = locate(model, over);
      return write(found?.kind === "part" ? writeOf(model, placePart(model, key, found.index), key) : null).then(() => undefined);
    },
    [model, write],
  );
  const onNest = useCallback((id: string, parent: string | null, index: number) => write(parent ? { kind: "nested", id, parent, index } : null), [write]);

  /* Adding a session from a chat or starting an empty one: a short wait, then its prompts are in the build (CA-21 P7). */
  const firstCount = Number(params.get("prompts")) || 3;
  const [library] = useState<SourceLibraryItem[]>(() => sandboxSourcesProps("bakery").library.map((row, at) => ({ ...row, promptCount: at === 0 ? firstCount : row.promptCount, line: at === 0 ? `${row.date} · ${firstCount} ${firstCount === 1 ? "prompt" : "prompts"}` : row.line })));
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  const [arriving, setArriving] = useState<Arriving | null>(null);
  const added = useRef(0);
  const sessionsNow = groups.filter((group) => !group.implicit);
  const add = useCallback(
    (item: SourceLibraryItem | null, part?: string) => {
      const key = item ? item.id : `typed-0c21c21c-0000-4000-8000-0000000000b${(added.current += 1)}`;
      const number = sessionsNow.length + 1;
      const target = part ?? partsModel?.list[partsModel.list.length - 1].view.key;
      const count = item ? item.promptCount : 0;
      setAdding((previous) => new Set(previous).add(key));
      setArriving({ key, kind: item ? "chat" : "empty", head: { key, number, tool: item ? item.label : NO_APP, detail: item ? item.date : "", prompts: [], date: item?.date ?? "23 Oct" }, count, part: target, status: "writing" });
      setSaid(item ? `Adding ${item.label} · ${item.date} as Session ${number}…` : "");
      window.setTimeout(() => {
        setBuild((previous) => {
          const nodes: NodeTree[] = Array.from({ length: count }, (_, at) => ({ id: `${key}-p${at + 1}`, build_id: "ca21-build", parent_id: null, type: "prompt", title: null, note: null, payload: { text: `Prompt ${at + 1} of the new session, written in the chat.`, tool: "claude", model: "Opus 5.5", session: key } as Json, position: 100 + at, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-23T09:00:00Z", children: [] }) as NodeTree);
          const making = { ...previous.making, session_order: [...(previous.making.session_order ?? []), key], sessions_meta: { ...(previous.making.sessions_meta ?? {}), [key]: { tool: item ? "claude" : null, date: "2026-10-23", ...(target ? { workstream: target } : null) } } };
          return { tree: [...previous.tree, ...nodes], making: making as Making };
        });
        setArriving((current) => (current ? { ...current, status: "written" } : current));
        setAdding((previous) => {
          const next = new Set(previous);
          next.delete(key);
          return next;
        });
      }, 1600);
    },
    [sessionsNow.length, partsModel],
  );
  const libraryRows = useMemo(() => library.map((row) => ({ ...row, adding: adding.has(row.id), inThisDraft: row.inThisDraft || Boolean(build.making.session_order?.includes(row.id)) })), [library, adding, build.making.session_order]);

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
          onMoveToSession={onMoveToSession}
          onNest={onNest}
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
          onDropSession={onDropSession}
          sessionOps={{ onTitle: () => undefined, onMove, onRemove: () => undefined, onMoveToPart: () => undefined, onWithAbove: () => undefined }}
          addSession={{ library: libraryRows, adding: adding.size > 0, onAdd: (id, part) => add(libraryRows.find((row) => row.id === id) ?? null, part), onStartNew: (part) => add(null, part), parts: addToParts }}
          arriving={arriving}
          onArrived={(key, status) => {
            setArriving((current) => (current && current.key === key ? null : current));
            if (status === "written") setSaid((line) => (line.startsWith("Adding") ? `Added Session ${arriving?.head.number ?? ""} with ${arriving?.count ?? 0} prompts.` : line));
          }}
          onDropOnWorkstream={onDropOnWorkstream}
          onDropWorkstream={onDropWorkstream}
          dividers={heads}
        />
      }
      sources={<SourcesPanel {...sandboxSourcesProps("bakery", state)} library={libraryRows} onAddSession={(id, part) => add(libraryRows.find((row) => row.id === id) ?? null, part)} phone={phone} fine={fine} parts={addToParts} />}
      map={devMap.column}
      mapPanel={devMap.panel}
      selection={selectedId ? <DetailsPanel {...shapeDetailsProps("one-sitting", selectedId, source)} phone={phone} onSelect={setSelectedId} /> : undefined}
    />
  );
}

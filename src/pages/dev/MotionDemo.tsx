/* CA-22 P0: /dev/kit/pages/sandbox?build=ca22: the build page's sixteen moments on a fixture.

   The build lives in memory with its own history (undo and redo), so nothing is written anywhere. A bar of buttons at the top of the
   page makes each change the way the composer's actions do (it says what it is about to do through `announce`, then changes the
   build); `&bar=0` hides it for the at-rest screens. `&tiles=300` adds a long session for the smoothness measures; `&select=<id>`
   selects a tile. DEV ONLY. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { CA22_A, CA22_B, CA22_S, ca22Build, node } from "@/dev/fixtures/ca22";
import { ca27Build } from "@/dev/fixtures/ca27";
import { sandboxSourcesProps, sandboxViewProps } from "@/dev/fixtures/sandbox";
import { sessionFacts, shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeSource } from "@/dev/fixtures/shapes";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { announce } from "@/lib/build/motionIntent";
import { buildSteps, groupKey, sessionGroups } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, type Making } from "@/lib/build/making";
import { applyWrite, type MemoryBuild } from "@/lib/build/moveMemory";
import { locate, moveBy, placePart, placeSession, writeOf, type MoveModel, type Write } from "@/lib/build/moveRules";
import type { NodeTree } from "@/lib/build/types";
import { BuildList } from "@/pages/site/compose/BuildList";
import { dividers } from "@/pages/site/compose/buildListModel";
import { goToIt, useHeld } from "@/pages/site/compose/buildMotion";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";
import { listPartsOf } from "@/pages/site/compose/partsModel";
import { ReferenceNotice } from "@/pages/site/compose/referencePieces";
import { SelectionBar } from "@/pages/site/compose/removePieces";
import { BuildAnnouncer } from "@/pages/site/compose/BuildAnnouncer";
import { findTargetsOf } from "@/pages/site/compose/findIndex";
import { shortcutOf } from "@/lib/build/shortcuts";
import { BuildHistoryContext, type BuildHistoryApi } from "@/pages/site/compose/useBuildHistory";
import { useBuildFind } from "@/pages/site/compose/useBuildFind";
import { takesKeys } from "@/pages/site/compose/useBuildSelection";
import { SandboxView, type SandboxLens } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";
import { BASE } from "@/lib/theme/motion";

import { useDevMap } from "./DevMap";
import type { DesignPageProps } from "./KitPages";

const TITLE = "An order page for a bakery";
const flat = (tree: readonly NodeTree[]): NodeTree[] => tree.flatMap((entry) => [entry, ...flat(entry.children ?? [])]);
const sessionOf = (entry: NodeTree) => (entry.payload as { session?: string } | null)?.session ?? "";
let counter = 0;
const fresh = (base: string) => `${base}-${(counter += 1)}-${Date.now().toString(36)}`;

interface Entry {
  build: MemoryBuild;
  sentence: string;
}

/** The page's announcer stands above the demo, as it does above the composer's page. */
export default function MotionDemo(props: DesignPageProps) {
  return (
    <BuildAnnouncer>
      <MotionDemoPage {...props} />
    </BuildAnnouncer>
  );
}

function MotionDemoPage({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const phone = useIsPhone();
  const fine = useFinePointer();
  const theme = useDesignTheme();
  const extra = Number(params.get("tiles") ?? 0) || 0;
  const [build, setBuild] = useState<MemoryBuild>(() => {
    const { tree, making } = params.get("build") === "ca27" ? ca27Build(Number(params.get("tiles")) || undefined) : ca22Build(extra);
    return { tree, making };
  });
  const [past, setPast] = useState<Entry[]>([]);
  const [future, setFuture] = useState<Entry[]>([]);
  const [notice, setNotice] = useState<{ sentence: string; n: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("select"));
  const [picked, setPicked] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [lens, setLens] = useState<SandboxLens>("list");
  const said = useRef("");

  const note = useCallback((sentence: string) => setNotice((current) => ({ sentence, n: (current?.n ?? 0) + 1 })), []);
  /** A step: says what it does, changes the build, and is undoable. */
  const step = useCallback(
    (kind: Parameters<typeof announce>[0], sentence: string, change: (previous: MemoryBuild) => MemoryBuild) => {
      announce(kind, sentence);
      setBuild((previous) => {
        const next = change(previous);
        if (next !== previous) {
          setPast((stack) => [...stack, { build: previous, sentence }]);
          setFuture([]);
        }
        return next;
      });
      note(sentence);
    },
    [note],
  );
  const undo = useCallback(() => {
    const last = past.at(-1);
    if (!last) return;
    announce("undo", last.sentence);
    setPast((stack) => stack.slice(0, -1));
    setFuture((stack) => [...stack, { build, sentence: last.sentence }]);
    setBuild(last.build);
  }, [past, build]);
  const redo = useCallback(() => {
    const next = future.at(-1);
    if (!next) return;
    announce("redo", next.sentence);
    setFuture((stack) => stack.slice(0, -1));
    setPast((stack) => [...stack, { build, sentence: next.sentence }]);
    setBuild(next.build);
  }, [future, build]);

  const steps = useMemo(() => buildSteps(build.tree), [build.tree]);
  const groups = useMemo(() => sessionGroups(steps, build.making.sessions, build.making.session_tools ?? {}, sessionsMetaOf(build.making), sessionOrderOf(build.making)), [steps, build.making]);
  const partsModel = useMemo(() => listPartsOf(build.making, groups, theme), [build.making, groups, theme]);
  const source: ShapeSource = useMemo(() => ({ tree: build.tree, making: build.making, selected: selectedId ?? "" }), [build, selectedId]);
  const list = { ...shapeListProps("one-sitting", source), steps };
  const { counts } = sessionFacts(build.tree);
  const heads = useMemo(() => dividers(steps, groups, counts, {}), [steps, groups, counts]);
  const sessionKeys = sessionOrderOf(build.making);
  /* CA-27 P1: Find in build, as the page holds it. */
  const findTargets = useMemo(() => findTargetsOf({ steps, dividers: heads, parts: partsModel ? { parts: partsModel.list } : undefined }), [steps, heads, partsModel]);
  const isFolded = useCallback((key: string) => collapsed.has(key) || Boolean(partsModel?.list.find((part) => part.view.key === key)?.view.collapsed), [collapsed, partsModel]);
  const find = useBuildFind({ targets: findTargets, isFolded, enabled: !phone });
  const openFind = find.show;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.defaultPrevented && !takesKeys(event.target) && shortcutOf(event) === "find") {
        event.preventDefault();
        openFind();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openFind]);
  const nameOfTile = (id: string) => `Prompt ${steps.find((candidate) => candidate.id === id)?.number ?? ""}`.trim();

  /* ── the changes ── */
  const remove = (id: string) => step("remove", `Removed ${nameOfTile(id)}`, (previous) => ({ ...previous, tree: previous.tree.filter((entry) => entry.id !== id) }));
  const removeSession = (key: string, mode: "all" | "keep") =>
    step("remove", `Removed Session ${Math.max(1, sessionKeys.indexOf(key) + 1)}`, (previous) => {
      const order = sessionOrderOf(previous.making);
      const upper = order[Math.max(0, order.indexOf(key) - 1)] === key ? order[order.indexOf(key) + 1] : order[order.indexOf(key) - 1];
      const tree = mode === "all" ? previous.tree.filter((entry) => sessionOf(entry) !== key) : previous.tree.map((entry) => (sessionOf(entry) === key ? ({ ...entry, payload: { ...(entry.payload as object), session: upper } } as NodeTree) : entry));
      const meta = { ...(previous.making.sessions_meta ?? {}) };
      delete meta[key];
      return { tree, making: { ...previous.making, session_order: order.filter((other) => other !== key), sessions_meta: meta } as Making };
    });
  const merge = (key: string) => {
    announce("merge");
    removeSession(key, "keep");
  };
  const clear = () => step("clear", "Cleared the build", (previous) => ({ tree: [], making: { ...previous.making, session_order: [], sessions_meta: {}, workstreams: [] } as Making }));
  const addTile = (session: string) =>
    step("add", "Added a prompt", (previous) => ({ ...previous, tree: [...previous.tree, node(fresh("c22-new"), "prompt", { text: "A prompt written just now, in this session.", tool: "claude", model: "Opus 5.5", session }, Math.max(...previous.tree.map((entry) => entry.position)) + 1)] }));
  const duplicate = (ids: string[]) =>
    step("duplicate", ids.length === 1 ? `Duplicated ${nameOfTile(ids[0])}` : `Duplicated ${ids.length} tiles`, (previous) => {
      const copies = previous.tree.filter((entry) => ids.includes(entry.id)).map((entry) => ({ ...entry, id: fresh(`${entry.id}-copy`), position: entry.position + 0.5, children: [] }) as NodeTree);
      return { ...previous, tree: [...previous.tree, ...copies] };
    });
  const split = (id: string) =>
    step("split", `Split Session 1 at ${nameOfTile(id)}`, (previous) => {
      const target = previous.tree.find((entry) => entry.id === id);
      if (!target) return previous;
      const from = sessionOf(target);
      const key = `typed-0c22c22c-0000-4000-8000-0000000000c${(counter += 1)}`;
      const tail = previous.tree.filter((entry) => sessionOf(entry) === from && entry.position >= target.position).map((entry) => entry.id);
      const order = sessionOrderOf(previous.making);
      const meta = { ...(previous.making.sessions_meta ?? {}), [key]: { ...(previous.making.sessions_meta?.[from] ?? { tool: "claude", date: "2026-10-22" }), title: undefined } };
      return {
        tree: previous.tree.map((entry) => (tail.includes(entry.id) ? ({ ...entry, payload: { ...(entry.payload as object), session: key } } as NodeTree) : entry)),
        making: { ...previous.making, session_order: [...order.slice(0, order.indexOf(from) + 1), key, ...order.slice(order.indexOf(from) + 1)], sessions_meta: meta } as Making,
      };
    });
  const addPart = () => step("part", "Added Part 3", (previous) => ({ ...previous, making: { ...previous.making, workstreams: [...(previous.making.workstreams ?? []), { key: fresh("ws-new") }] } as Making }));
  const convert = (id: string) =>
    step("convert", `Converted ${nameOfTile(id)} to a manual step`, (previous) => ({ ...previous, tree: previous.tree.map((entry) => (entry.id === id ? ({ ...entry, type: "manual_step", payload: { tool: "vercel", text: (entry.payload as { text?: string }).text ?? "", session: sessionOf(entry) } } as NodeTree) : entry)) }));
  const toggle = (key: string, closed: boolean) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (closed) next.add(key);
      else next.delete(key);
      return next;
    });
  const foldParts = (key: string, closed: boolean) =>
    setBuild((previous) => ({ ...previous, making: { ...previous.making, workstreams: (previous.making.workstreams ?? []).map((part) => (part.key === key ? { ...part, collapsed: closed } : part)) } as Making }));

  /* ── moving, as CA-21's demo does it ── */
  const model = useMemo<MoveModel>(
    () => ({
      hasParts: Boolean(partsModel),
      parts: partsModel ? partsModel.list.map((part) => ({ key: part.view.key, sessions: [...part.sessions] })) : [{ key: "", sessions: groups.filter((group) => !group.implicit).map((group) => groupKey(group)) }],
      tiles: Object.fromEntries(groups.filter((group) => !group.implicit).map((group) => [groupKey(group), steps.filter((candidate) => group.stepNumbers.includes(candidate.number)).map((candidate) => candidate.id)])),
      nested: Object.fromEntries(steps.filter((candidate) => candidate.children.length > 0 || (candidate.sentWith?.length ?? 0) > 0).map((candidate) => [candidate.id, (candidate.sentWith?.length ? candidate.sentWith : candidate.children).map((child) => child.id)])),
      loose: [],
    }),
    [partsModel, groups, steps],
  );
  const onMove = useCallback(
    (id: string, by: -1 | 1) => {
      const result = moveBy(model, id, by);
      const write = result ? writeOf(model, result.model, id) : null;
      if (!result || !write) return;
      step("move", "Moved", (previous) => applyWrite(previous, write));
    },
    [model, step],
  );
  const write = useCallback(
    (made: Write | null, sentence = "Moved") => {
      if (!made) return Promise.resolve(false);
      return new Promise<boolean>((resolve) =>
        window.setTimeout(() => {
          step("move", sentence, (previous) => applyWrite(previous, made));
          resolve(true);
        }, 60),
      );
    },
    [step],
  );
  const onMoveToSession = useCallback((id: string, key: string, options?: { order?: readonly string[] }) => write({ kind: "tile", id, session: key, reassign: { id, session: key }, atEnd: options?.order ? [...options.order] : [id] }, "Moved a tile"), [write]);
  const onDropSession = useCallback(
    (key: string, over: string) => {
      const found = locate(model, over);
      if (found?.kind !== "session") return Promise.resolve();
      return write(writeOf(model, placeSession(model, key, found.part, found.index), key), "Moved a session").then(() => undefined);
    },
    [model, write],
  );
  const onDropOnWorkstream = useCallback((key: string, part: string) => write(writeOf(model, placeSession(model, key, part, Number.MAX_SAFE_INTEGER), key), `Moved Session to ${part}`).then(() => undefined), [model, write]);
  const onDropWorkstream = useCallback(
    (key: string, over: string) => {
      const found = locate(model, over);
      return write(found?.kind === "part" ? writeOf(model, placePart(model, key, found.index), key) : null).then(() => undefined);
    },
    [model, write],
  );
  const onNest = useCallback((id: string, parent: string | null, index: number) => write(parent ? { kind: "nested", id, parent, index } : null, "Sent together"), [write]);

  const mapData = { ...shapeMapProps("one-sitting", source), steps, groups };
  const devMap = useDevMap({ fixture: mapData, making: build.making as Making, direction: "horizontal", selected: selectedId, onSelect: setSelectedId, none: false });

  const barProps = picked.length >= 2 ? { phone, count: picked.length, moveTo: { sessions: [], parts: [] }, holds: { tiles: picked.length, sessions: 0 }, onMoveToSession: () => undefined, onMoveToPart: () => undefined, onDuplicate: () => duplicate(picked), onRemove: () => undefined, onClear: () => setPicked([]) } : null;
  const heldBar = useHeld(barProps, BASE);

  const buttons: [string, () => void][] = [
    ["remove-p2", () => remove("c22-p2")],
    ["undo", undo],
    ["redo", redo],
    ["remove-session-2", () => removeSession(CA22_S[1], "all")],
    ["merge-session-2", () => merge(CA22_S[1])],
    ["clear", clear],
    ["add-tile", () => addTile(CA22_S[0])],
    ["duplicate-p2", () => duplicate(["c22-p2"])],
    ["duplicate-two", () => duplicate(["c22-p1", "c22-p3"])],
    ["split-p3", () => split("c22-p3")],
    ["add-part", addPart],
    ["convert-p3", () => convert("c22-p3")],
    ["fold-s1", () => toggle(CA22_S[0], !collapsed.has(CA22_S[0]))],
    ["collapse-all", () => setCollapsed(new Set([...CA22_S]))],
    ["expand-all", () => setCollapsed(new Set())],
    ["fold-part-1", () => foldParts(CA22_A, !(build.making.workstreams ?? []).find((part) => part.key === CA22_A)?.collapsed)],
    ["pick-two", () => setPicked(["c22-p1", "c22-p2"])],
    ["pick-three", () => setPicked(["c22-p1", "c22-p2", "c22-p3"])],
    ["pick-none", () => setPicked([])],
    ["select-p1", () => setSelectedId("c22-p1")],
    ["select-p3", () => setSelectedId("c22-p3")],
    ["move-s2-to-part-2", () => void onDropOnWorkstream(CA22_S[1], CA22_B)],
    ["nest-p3-in-p2", () => void onNest("c22-p3", "c22-p2", Number.MAX_SAFE_INTEGER)],
    ["unnest-p2n", () => void onNest("c22-p2n", null, 99)],
    ["note", () => note("Something happened")],
    ["go-to-p3", () => { const el = document.querySelector<HTMLElement>('[data-skel-id="c22-p3"]'); if (el) goToIt(el, "#7FA7D9"); }],
    ["lens-map", () => document.querySelector<HTMLElement>('[data-testid="sandbox-tab-map"]')?.click()],
    ["lens-list", () => document.querySelector<HTMLElement>('[data-testid="sandbox-tab-list"]')?.click()],
  ];

  /* CA-26 P5: `&history=1` gives the title row its Undo and Redo, as the composer has them, for the touch-target measures. Off by default: the boards do not show them. */
  const history = useMemo<BuildHistoryApi | null>(
    () =>
      params.get("history") === "1"
        ? ({ canUndo: past.length > 0, canRedo: future.length > 0, undoSentence: past.at(-1)?.sentence ?? null, redoSentence: future.at(-1)?.sentence ?? null, undo: async () => undo(), redo: async () => redo() } as unknown as BuildHistoryApi)
        : null,
    [params, past, future, undo, redo],
  );

  return (
    <>
      {params.get("bar") === "0" ? null : (
        <div data-testid="motion-bar" style={{ ...(params.get("bar") === "hide" ? { display: "none" } : null), position: "fixed", left: 0, top: 0, right: 0, zIndex: 300, display: "flex", flexWrap: "wrap", gap: 2, padding: 2, background: "#000", opacity: 0.85 }}>
          {buttons.map(([name, run]) => (
            <button key={name} type="button" data-testid={`act-${name}`} onClick={run} style={{ font: "10px monospace", padding: "1px 4px" }}>
              {name}
            </button>
          ))}
        </div>
      )}
      <BuildHistoryContext.Provider value={history}>
      <SandboxView
        fit={fit}
        {...sandboxViewProps("fox", state)}
        counts={{ sessions: 3, prompts: 5, files: 0 }}
        title={TITLE}
        lens={lens}
        onLens={setLens}
        mapAvailable
        find={phone ? undefined : find}
        viewOptions={params.get("build") === "ca27" ? { sessionList: false, sessionCount: sessionKeys.length, onChange: () => undefined } : undefined}
        list={
          <BuildList
            {...list}
            phone={phone}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={onMove}
            onMoveToSession={onMoveToSession}
            onNest={onNest}
            onSplitHere={split}
            onRemove={remove}
            said={said.current}
            collapsed={collapsed}
            onToggleCollapsed={toggle}
            find={find.open ? { view: find.view, forced: find.forced, release: find.release } : undefined}
            parts={
              partsModel
                ? {
                    parts: partsModel.list,
                    withAbove: partsModel.withAbove,
                    ops: { onName: () => undefined, onMove, onRemove: () => undefined, onStartsAfter: () => undefined },
                    onToggle: foldParts,
                    onAddSession: () => undefined,
                  }
                : undefined
            }
            onAddPart={addPart}
            onDropSession={onDropSession}
            sessionOps={{ onTitle: () => undefined, onMove, onRemove: (key) => removeSession(key, "all"), onMoveToPart: () => undefined, onWithAbove: () => undefined }}
            onDropOnWorkstream={onDropOnWorkstream}
            onDropWorkstream={onDropWorkstream}
            dividers={heads}
            addToSession={(key) => (
              <button type="button" data-testid={`add-tile-${key}`} onClick={() => addTile(key)} style={{ alignSelf: "flex-start", font: "13px inherit", padding: "4px 0", background: "none", border: 0, color: "var(--text2)" }}>
                + Add Tile
              </button>
            )}
          />
        }
        sources={<SourcesPanel {...sandboxSourcesProps("bakery", state)} phone={phone} fine={fine} />}
        map={devMap.column}
        mapPanel={devMap.panel}
        selection={selectedId ? <DetailsPanel {...shapeDetailsProps("one-sitting", selectedId, source)} phone={phone} onSelect={setSelectedId} /> : undefined}
        selectionBar={heldBar.value ? <SelectionBar {...heldBar.value} leaving={heldBar.leaving} /> : null}
      />
      </BuildHistoryContext.Provider>
      <ReferenceNotice notice={notice} onUndo={undo} onDone={() => setNotice(null)} phone={phone} />
    </>
  );
}

// Parts 1 and 2 of the fixture, for the buttons above that name them.
export const CA22_PARTS = [CA22_A, CA22_B] as const;

/* CA-19 P8: /dev/kit/pages/sandbox?build=references: "References", colour and references working on a fixture.

   CA-17's "Two parts" with the group Login flow (Session 2, Code 4, Check 5, linked in post 2), Data model and Landing page
   sharing #7FA7D9 (Data model linked in post 1), an unnamed group of Prompts 7 and 8, and an old post with two links to
   Prompt 1. Every colour and link action goes through the same history, actions and windows as the composer
   (`useReferences`, `useReferenceActions`); the "database" is this page's memory, so nothing is written anywhere.

   `&lens=map` starts on the Map, `&select=<id>` selects a tile or a session, `&swatches=filled` fills Saved and Recent. */

import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { configureSwatchSaving } from "@/components/brand/useColourSwatches";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { PartRegistryProvider, type PartRegistry } from "@/components/build/partNav";
import { allParts, PartWindow } from "@/components/build/PartWindow";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { LINKS_SWATCHES } from "@/dev/fixtures/postLinks";
import { referencesBuild, referencesPost } from "@/dev/fixtures/references";
import { sandboxSourcesProps, sandboxViewProps } from "@/dev/fixtures/sandbox";
import { sessionFacts, shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeSource } from "@/dev/fixtures/shapes";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { previewColours, previewWorkstreams, type ColourPreview } from "@/lib/build/colourPreview";
import { groupKey, sessionGroups, type Step } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, type Making } from "@/lib/build/making";
import { refGroups, refLookup } from "@/lib/build/postRefs";
import { makingWithGroupColours, previewGroupColour, withGroupColours, type ReferenceGroup } from "@/lib/build/referenceGroups";
import { parseRefTo, type ThreadDoc } from "@/lib/build/thread";
import { BuildList, partName } from "@/pages/site/compose/BuildList";
import { dividers } from "@/pages/site/compose/buildListModel";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";
import { listPartsOf } from "@/pages/site/compose/partsModel";
import { PostTab } from "@/pages/site/compose/PostTab";
import { ReferenceNotice } from "@/pages/site/compose/referencePieces";
import { SandboxView, type SandboxLens } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";
import { useColourPicking } from "@/pages/site/compose/useColourPicking";
import type { ComposeThread } from "@/pages/site/compose/useComposeThread";
import { usePostLinks } from "@/pages/site/compose/usePostLinks";
import { useReferenceActions } from "@/pages/site/compose/useReferenceActions";
import { ReferenceWindows } from "@/pages/site/compose/ReferenceWindows";
import { useHistoryKeys } from "@/pages/site/compose/useReferenceHistory";
import { useReferences } from "@/pages/site/compose/useReferences";
import { GroupLabelsProvider } from "@/pages/site/compose/groupLabels";

import { useDevMap } from "./DevMap";
import type { DesignPageProps } from "./KitPages";

const TITLE = "A tenant portal and its support agent";

function demoThread(doc: ThreadDoc): ComposeThread {
  return {
    buildId: undefined,
    ensureBuild: () => Promise.reject(new Error("The dev page has no build to upload to.")),
    status: "ready",
    version: 1,
    readDoc: () => doc,
    onDoc: () => undefined,
    posts: 3,
    save: "idle",
    hold: null,
    flush: async () => undefined,
    retry: () => undefined,
    retryLoad: () => undefined,
  };
}

/** The tiles with the colours this page has written laid over the fixture's. */
function withTileColours(steps: Step[], colours: Readonly<Record<string, string | null>>): Step[] {
  return steps.map((step) => {
    const next: Step = { ...step, children: withTileColours(step.children, colours), ...(step.sentWith ? { sentWith: withTileColours(step.sentWith, colours) } : null) };
    if (step.id in colours) {
      const colour = colours[step.id];
      if (colour) next.colour = colour;
      else delete next.colour;
    }
    return next;
  });
}

export default function ReferencesDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  useState(() => configureSwatchSaving(null, params.get("swatches") === "filled" ? LINKS_SWATCHES : { recent: [], favourites: [] }));
  const phone = useIsPhone();
  const fine = useFinePointer();
  const theme = useDesignTheme();
  const fixture = useMemo(() => referencesBuild(), []);

  /* The page's memory stands in for the build: tiles' colours, and `making` (sessions, parts, groups). */
  const [made, setMade] = useState<Making>(fixture.making);
  const [tileColours, setTileColours] = useState<Record<string, string | null>>({});
  const savedSteps = useMemo(() => withTileColours(fixture.steps, tileColours), [fixture, tileColours]);
  const savedGroups = useMemo(() => sessionGroups(savedSteps, made.sessions, made.session_tools ?? {}, sessionsMetaOf(made), sessionOrderOf(made)), [savedSteps, made]);
  const writeColour = useCallback((to: string, colour: string | null) => {
    const target = parseRefTo(to);
    if (!target || target.kind === "group") return;
    if (target.kind === "node") setTileColours((previous) => ({ ...previous, [target.id]: colour }));
    else if (target.kind === "session")
      setMade((previous) => {
        const meta = { ...(previous.sessions_meta ?? {}) };
        const { colour: _old, ...rest } = meta[target.id] ?? { tool: null, date: "" };
        meta[target.id] = colour ? { ...rest, colour } : rest;
        return { ...previous, sessions_meta: meta };
      });
    else setMade((previous) => ({ ...previous, workstreams: (previous.workstreams ?? []).map((part) => (part.key === target.id ? { ...part, colour: colour ?? undefined } : part)) }));
  }, []);
  const saveGroups = useCallback(async (list: ReferenceGroup[], order?: string[]) => {
    setMade((previous) => ({ ...previous, reference_groups: list, ...(order ? { single_colour_order: order } : null) }) as Making);
  }, []);

  const nameRef = useRef<(to: string) => string>((to) => to);
  const references = useReferences({ made, savedSteps, savedGroups, writeColour, saveGroups, loaded: true, nameOf: (to) => nameRef.current(to) });

  const [preview, setPreview] = useState<ColourPreview | null>(null);
  const previewedGroup = preview && parseRefTo(preview.to)?.kind === "group" ? (parseRefTo(preview.to)?.id ?? null) : null;
  const makingDrawn = useMemo(() => previewGroupColour(references.making, previewedGroup, preview?.colour ?? null), [references.making, previewedGroup, preview?.colour]);
  const shown = useMemo(() => {
    const drawn = withGroupColours(savedSteps, savedGroups, makingDrawn, references.pending);
    return previewColours(drawn.steps, drawn.groups, preview);
  }, [savedSteps, savedGroups, makingDrawn, references.pending, preview]);
  const shownMaking = useMemo(() => previewWorkstreams(makingWithGroupColours(makingDrawn, references.pending), preview) as Making, [makingDrawn, references.pending, preview]);

  const [lens, setLens] = useState<SandboxLens>(params.get("lens") === "map" ? "map" : "list");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("select"));
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const registry = useRef<PartRegistry>(new Map()).current;
  const partsModel = useMemo(() => listPartsOf(shownMaking, shown.groups, theme), [shownMaking, shown.groups, theme]);
  const addToParts = useMemo(() => partsModel?.list.map((part) => ({ key: part.view.key, label: part.view.label, title: part.title, colour: part.view.colour })), [partsModel]);
  const postRefGroups = useMemo(() => refGroups({ steps: shown.steps, groups: shown.groups, making: shownMaking }), [shown, shownMaking]);
  const baseLookup = useMemo(() => refLookup(postRefGroups), [postRefGroups]);
  const groupEntriesOf = references.groupEntries;
  const groupTargets = useMemo(() => groupEntriesOf(baseLookup), [groupEntriesOf, baseLookup]);
  const links = usePostLinks({ steps: shown.steps, groups: shown.groups, refGroups: postRefGroups, registry, lens: phone ? "list" : lens, phone, setSelectedId, setOpenPromptId, groupEntries: groupTargets });
  const withGroupTargets = references.withGroups;
  const nameIn = references.nameIn;
  const allTargets = useMemo(() => withGroupTargets(links.lookup), [withGroupTargets, links.lookup]);
  const nameOf = useCallback((to: string) => nameIn(allTargets, to), [nameIn, allTargets]);
  nameRef.current = nameOf;

  const actions = useReferenceActions({ references, lookup: allTargets, nameOf, dropPreview: () => setPreview(null) });
  const { onColour, picker, open: pickerOpen } = useColourPicking({
    preview,
    setPreview,
    savedSteps,
    savedGroups,
    write: writeColour,
    phone,
    sessionsOfPart: (workstream) => partsModel?.groups.find((part) => part.key === workstream)?.sessions ?? [],
    commit: actions.commit,
    references: actions.pickerReferences,
    history: actions.history,
  });
  useHistoryKeys(pickerOpen, references.history);

  const source: ShapeSource = useMemo(() => ({ tree: fixture.tree, making: fixture.making, selected: selectedId ?? "" }), [fixture, selectedId]);
  const thread = useMemo(() => demoThread(referencesPost), []);
  const list = { ...shapeListProps("one-sitting", source), steps: shown.steps };
  const mapData = { ...shapeMapProps("one-sitting", source), steps: shown.steps, groups: shown.groups };
  const devMap = useDevMap({ fixture: mapData, making: shownMaking, direction: params.get("direction") === "vertical" ? "vertical" : "horizontal", selected: selectedId, onSelect: setSelectedId, none: params.get("map") === "none" });
  const { counts } = sessionFacts(fixture.tree);
  const detailsColour = useMemo(() => {
    const group = shown.groups.find((candidate) => groupKey(candidate) === selectedId);
    if (group) {
      const what = `Session ${group.number}`;
      return { what, colour: group.colour ?? null, to: `session:${groupKey(group)}`, onPick: (anchor: HTMLElement) => onColour(`session:${groupKey(group)}`, anchor, what, group.colour ?? null) };
    }
    const step = allParts(shown.steps).find((candidate) => candidate.id === selectedId);
    if (!step) return null;
    const what = partName(step);
    return { what, colour: step.colour ?? null, to: `node:${step.id}`, onPick: (anchor: HTMLElement) => onColour(`node:${step.id}`, anchor, what, step.colour ?? null) };
  }, [selectedId, shown, onColour]);

  return (
    <PartRegistryProvider registry={registry}>
      <GroupLabelsProvider making={makingDrawn} onOpen={actions.openGroup}>
      <SandboxView
        fit={fit}
        {...sandboxViewProps("fox", state)}
        counts={{ sessions: 5, prompts: 4, files: 0 }}
        title={TITLE}
        lens={lens}
        onLens={setLens}
        mapAvailable
        viewOptions={{ sessionList: false, splitMerge: false, onChange: () => undefined, labels: { value: "letters", onChange: () => undefined }, onColours: () => actions.setColoursOpen(true) }}
        list={
          <BuildList
            {...list}
            phone={phone}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenPrompt={setOpenPromptId}
            mentioned={links.mentioned}
            onBackToPost={links.backToMention}
            reveal={links.reveal}
            onColour={onColour}
            parts={
              partsModel
                ? {
                    parts: partsModel.list,
                    ops: { onName: () => undefined, onMove: () => undefined, onRemove: () => undefined, onStartsAfter: () => undefined },
                    onToggle: () => undefined,
                    onColour: (partKey: string, anchor: HTMLElement, what: string, colour: string | null) => onColour(`workstream:${partKey}`, anchor, what, colour),
                    onAddSession: () => undefined,
                    withAbove: partsModel.withAbove,
                  }
                : undefined
            }
            onAddPart={() => undefined}
            onDropSession={() => undefined}
            sessionOps={{ onTitle: () => undefined, onMove: () => undefined, onRemove: () => undefined, onMoveToPart: () => undefined, onWithAbove: () => undefined }}
            addSession={{ library: sandboxSourcesProps("bakery").library, adding: false, onAdd: () => undefined, onStartNew: () => undefined, parts: addToParts }}
            onDropOnWorkstream={() => undefined}
            onDropWorkstream={() => undefined}
            dividers={dividers(shown.steps, shown.groups, counts, {})}
          />
        }
        sources={<SourcesPanel {...sandboxSourcesProps("bakery", state)} phone={phone} fine={fine} parts={addToParts} />}
        map={devMap.column}
        mapPanel={devMap.panel}
        selection={selectedId ? <DetailsPanel {...shapeDetailsProps("one-sitting", selectedId, source)} phone={phone} onSelect={setSelectedId} onOpenPrompt={setOpenPromptId} colour={detailsColour} /> : undefined}
        post={
          <PostTab
            thread={thread}
            phone={phone}
            draft={{ build: null, title: TITLE, maker: { id: "dev-maker", name: "Sam Rivera", handle: "sam", avatar: null } }}
            references={{
              groups: postRefGroups,
              lookup: allTargets,
              onGo: links.goTo,
              onMentions: links.onMentions,
              history: references.history,
              onEditor: references.setEditor,
              nameOf,
              selecting: actions.selecting,
              onSelectingDone: () => actions.setSelecting(null),
            }}
          />
        }
      />
      <FullPromptWindow
        steps={shown.steps}
        groups={shown.groups}
        names={list.names}
        openId={openPromptId}
        mode="maker"
        onTitle={() => undefined}
        onNavigate={setOpenPromptId}
        onClose={() => {
          setOpenPromptId(null);
          links.closeWindows();
        }}
        fromPost={links.fromPost}
        onBackToPost={links.backToPost}
        onCloseAutoFocus={links.onCloseAutoFocus}
      />
      {picker}
      <PartWindow
        steps={shown.steps}
        groups={shown.groups}
        names={list.names}
        open={links.openPart}
        fromPost={links.fromPost}
        onBackToPost={links.backToPost}
        onClose={links.closeWindows}
        onGo={links.goFromWindow}
        onDownload={() => undefined}
        setupCounts={counts}
        onCloseAutoFocus={links.onCloseAutoFocus}
      />
      <ReferenceNotice notice={references.history.notice} onUndo={references.history.undo} onDone={references.history.dismiss} phone={phone} />
      {actions.keepDialog}
      <ReferenceWindows references={references} actions={actions} refGroups={postRefGroups} lookup={allTargets} phone={phone} />
    </GroupLabelsProvider>
      </PartRegistryProvider>
  );
}

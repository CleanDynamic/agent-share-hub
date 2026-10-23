/* CA-06 P7 — /dev/kit/pages/sandbox?build=links: "A post with links", the composer's links working on a fixture.

   The one-sitting build (CA-04) with a check, three parts coloured, and a post that links two sessions, a prompt, a
   team's agent, the check, the code tile sent with prompt 2 and a tile that is gone. Clicking a link brings its part
   in, outlines it and opens its window, as the composer does (`usePostLinks`); nothing is written. `&lens=map` starts
   on the Map. */

import { useMemo, useRef, useState } from "react";

import { configureSwatchSaving } from "@/components/brand/useColourSwatches";
import { useSearchParams } from "react-router-dom";

import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { PartRegistryProvider, type PartRegistry } from "@/components/build/partNav";
import { allParts, PartWindow } from "@/components/build/PartWindow";
import { previewColours, type ColourPreview } from "@/lib/build/colourPreview";
import { groupKey } from "@/lib/build/graph";
import { dividers } from "@/pages/site/compose/buildListModel";
import { useColourPicking } from "@/pages/site/compose/useColourPicking";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { linksBuild, linksPost, LINKS_SWATCHES } from "@/dev/fixtures/postLinks";
import { partsBuild, partsPost } from "@/dev/fixtures/parts";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { previewWorkstreams } from "@/lib/build/colourPreview";
import { listPartsOf } from "@/pages/site/compose/partsModel";
import { sandboxSourcesProps, sandboxViewProps } from "@/dev/fixtures/sandbox";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";
import { useFinePointer } from "@/components/shell/useMinWidth";
import { sessionFacts, shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeSource } from "@/dev/fixtures/shapes";
import { refGroups } from "@/lib/build/postRefs";
import type { ThreadDoc } from "@/lib/build/thread";
import { BuildList, partName } from "@/pages/site/compose/BuildList";
import { useDevMap } from "./DevMap";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";
import { PostTab } from "@/pages/site/compose/PostTab";
import { SandboxView, type SandboxLens } from "@/pages/site/compose/SandboxView";
import { usePostLinks } from "@/pages/site/compose/usePostLinks";
import type { ComposeThread } from "@/pages/site/compose/useComposeThread";

import type { DesignPageProps } from "./KitPages";

function demoThread(doc: ThreadDoc): ComposeThread {
  return {
    buildId: undefined,
    ensureBuild: () => Promise.reject(new Error("The dev page has no build to upload to.")),
    status: "ready",
    version: 1,
    readDoc: () => doc,
    onDoc: () => undefined,
    posts: 2,
    save: "idle",
    hold: null,
    flush: async () => undefined,
    retry: () => undefined,
    retryLoad: () => undefined,
  };
}

export default function LinksDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  // The dev page keeps the maker's colours in memory: nothing is read from or written to a profile.
  const filled = params.get("swatches") === "filled";
  useState(() => configureSwatchSaving(null, filled ? LINKS_SWATCHES : { recent: [], favourites: [] }));
  const phone = useIsPhone();
  const presets = params.get("presets") === "1";
  const twoParts = params.get("build") === "parts";
  const theme = useDesignTheme();
  const fixture = useMemo(() => (twoParts ? partsBuild() : linksBuild(presets)), [presets, twoParts]);
  /* CA-06 P5: a colour Done keeps is laid over the fixture for the visit; nothing is written. */
  const [kept, setKept] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<ColourPreview | null>(null);
  const saved = useMemo(
    () => Object.entries(kept).reduce((at, [to, colour]) => previewColours(at.steps, at.groups, { to, colour, alsoTiles: false }), { steps: fixture.steps, groups: fixture.groups }),
    [fixture, kept],
  );
  const shown = useMemo(() => previewColours(saved.steps, saved.groups, preview), [saved, preview]);
  const build = { ...fixture, steps: shown.steps, groups: shown.groups };
  const source: ShapeSource = useMemo(() => ({ tree: fixture.tree, making: fixture.making, selected: twoParts ? "pt-p4" : "o-p2" }), [fixture, twoParts]);
  /* CA-17 P7: the parts, with the colours Done kept and the one being previewed laid over them. */
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const keptMaking = useMemo(() => {
    const list = fixture.making.workstreams ?? [];
    const next = list.map((part) => {
      const colour = kept[`workstream:${part.key}`];
      const copy = { ...part, collapsed: folded[part.key] ?? part.collapsed, name: renamed[part.key] ?? part.name };
      if (colour === null) delete copy.colour;
      else if (colour) copy.colour = colour;
      return copy;
    });
    return { ...fixture.making, workstreams: next };
  }, [fixture, kept, folded, renamed]);
  const shownMaking = useMemo(() => previewWorkstreams(keptMaking, preview) as typeof fixture.making, [keptMaking, preview, fixture]);
  const [lens, setLens] = useState<SandboxLens>(params.get("lens") === "map" ? "map" : "list");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("session"));
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const registry = useRef<PartRegistry>(new Map()).current;
  const partsModel = useMemo(() => (twoParts ? listPartsOf(shownMaking, shown.groups, theme) : null), [twoParts, shownMaking, shown.groups, theme]);
  const fine = useFinePointer();
  const addToParts = useMemo(() => partsModel?.list.map((part) => ({ key: part.view.key, label: part.view.label, title: part.title, colour: part.view.colour })), [partsModel]);
  const groups = useMemo(() => refGroups({ steps: shown.steps, groups: shown.groups, ...(twoParts ? { making: shownMaking } : null) }), [shown, twoParts, shownMaking]);
  const { onColour, picker } = useColourPicking({
    preview,
    setPreview,
    savedSteps: saved.steps,
    savedGroups: saved.groups,
    write: (to, colour) => setKept((previous) => ({ ...previous, [to]: colour })),
    phone,
    sessionsOfPart: (workstream) => partsModel?.groups.find((part) => part.key === workstream)?.sessions ?? [],
  });
  const links = usePostLinks({ steps: build.steps, groups: build.groups, refGroups: groups, registry, lens: phone ? "list" : lens, phone, setSelectedId, setOpenPromptId });
  const thread = useMemo(() => demoThread(twoParts ? partsPost : linksPost), [twoParts]);
  const list = { ...shapeListProps("one-sitting", source), steps: shown.steps };
  const mapData = { ...shapeMapProps("one-sitting", source), steps: shown.steps, groups: shown.groups };
  const devMap = useDevMap({ fixture: mapData, making: twoParts ? shownMaking : {}, direction: params.get("direction") === "vertical" ? "vertical" : "horizontal", selected: selectedId, onSelect: setSelectedId, none: params.get("map") === "none" });
  const { counts } = sessionFacts(fixture.tree);
  const detailsColour = useMemo(() => {
    const group = shown.groups.find((candidate) => groupKey(candidate) === selectedId);
    if (group) {
      const what = `Session ${group.number}`;
      return { what, colour: group.colour ?? null, onPick: (anchor: HTMLElement) => onColour(`session:${groupKey(group)}`, anchor, what, group.colour ?? null) };
    }
    const step = allParts(shown.steps).find((candidate) => candidate.id === selectedId);
    if (!step) return null;
    const what = partName(step);
    return { what, colour: step.colour ?? null, onPick: (anchor: HTMLElement) => onColour(`node:${step.id}`, anchor, what, step.colour ?? null) };
  }, [selectedId, shown, onColour]);

  return (
    <PartRegistryProvider registry={registry}>
      <SandboxView
        fit={fit}
        {...sandboxViewProps("fox", state)}
        {...(twoParts ? { counts: { sessions: 5, prompts: 7, files: 1 } } : null)}
        title={twoParts ? "A tenant portal and its support agent" : "A bakery order page, one sitting then agents"}
        lens={lens}
        onLens={setLens}
        mapAvailable
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
            {...(partsModel
              ? {
                  parts: {
                    parts: partsModel.list,
                    ops: {
                      onName: (partKey: string, name: string) => setRenamed((previous) => ({ ...previous, [partKey]: name })),
                      onMove: () => undefined,
                      onRemove: () => undefined,
                      onStartsAfter: () => undefined,
                    },
                    onToggle: (partKey: string, collapsed: boolean) => setFolded((previous) => ({ ...previous, [partKey]: collapsed })),
                    onColour: (partKey: string, anchor: HTMLElement, what: string, colour: string | null) => onColour(`workstream:${partKey}`, anchor, what, colour),
                    onAddSession: () => undefined,
                    withAbove: partsModel.withAbove,
                  },
                  onAddPart: () => undefined,
                  onDropSession: () => undefined,
                  sessionOps: { onTitle: () => undefined, onMove: () => undefined, onRemove: () => undefined, onMoveToPart: () => undefined, onWithAbove: () => undefined },
                  addSession: {
                    library: sandboxSourcesProps("bakery").library,
                    adding: false,
                    onAdd: () => undefined,
                    onStartNew: () => undefined,
                    parts: addToParts,
                  },
                  onDropOnWorkstream: () => undefined,
                  onDropWorkstream: () => undefined,
                }
              : null)}
            dividers={dividers(shown.steps, shown.groups, counts, {})}
          />
        }
        {...(twoParts ? { sources: <SourcesPanel {...sandboxSourcesProps("bakery", state)} phone={phone} fine={fine} parts={addToParts} /> } : null)}
        map={devMap.column}
        mapPanel={devMap.panel}
        selection={selectedId ? <DetailsPanel {...shapeDetailsProps("one-sitting", selectedId, source)} phone={phone} onSelect={setSelectedId} onOpenPrompt={setOpenPromptId} colour={detailsColour} /> : undefined}
        post={
          <PostTab
            thread={thread}
            phone={phone}
            draft={{ build: null, title: twoParts ? "A tenant portal and its support agent" : "A bakery order page, one sitting then agents", maker: { id: "dev-maker", name: "Sam Rivera", handle: "sam", avatar: null } }}
            references={{ groups, lookup: links.lookup, onGo: links.goTo, onMentions: links.onMentions }}
          />
        }
      />
      <FullPromptWindow
        steps={build.steps}
        groups={build.groups}
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
        steps={build.steps}
        groups={build.groups}
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
    </PartRegistryProvider>
  );
}

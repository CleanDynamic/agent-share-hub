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
import { sandboxViewProps } from "@/dev/fixtures/sandbox";
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
  const fixture = useMemo(() => linksBuild(presets), [presets]);
  /* CA-06 P5: a colour Done keeps is laid over the fixture for the visit; nothing is written. */
  const [kept, setKept] = useState<Record<string, string | null>>({});
  const [preview, setPreview] = useState<ColourPreview | null>(null);
  const saved = useMemo(
    () => Object.entries(kept).reduce((at, [to, colour]) => previewColours(at.steps, at.groups, { to, colour, alsoTiles: false }), { steps: fixture.steps, groups: fixture.groups }),
    [fixture, kept],
  );
  const shown = useMemo(() => previewColours(saved.steps, saved.groups, preview), [saved, preview]);
  const build = { ...fixture, steps: shown.steps, groups: shown.groups };
  const source: ShapeSource = useMemo(() => ({ tree: fixture.tree, making: fixture.making, selected: "o-p2" }), [fixture]);
  const [lens, setLens] = useState<SandboxLens>(params.get("lens") === "map" ? "map" : "list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const registry = useRef<PartRegistry>(new Map()).current;
  const groups = useMemo(() => refGroups({ steps: shown.steps, groups: shown.groups }), [shown]);
  const { onColour, picker } = useColourPicking({
    preview,
    setPreview,
    savedSteps: saved.steps,
    savedGroups: saved.groups,
    write: (to, colour) => setKept((previous) => ({ ...previous, [to]: colour })),
    phone,
  });
  const links = usePostLinks({ steps: build.steps, groups: build.groups, refGroups: groups, registry, lens: phone ? "list" : lens, phone, setSelectedId, setOpenPromptId });
  const thread = useMemo(() => demoThread(linksPost), []);
  const list = { ...shapeListProps("one-sitting", source), steps: shown.steps };
  const mapData = { ...shapeMapProps("one-sitting", source), steps: shown.steps, groups: shown.groups };
  const devMap = useDevMap({ fixture: mapData, selected: selectedId, onSelect: setSelectedId });
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
        title="A bakery order page, one sitting then agents"
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
            dividers={dividers(shown.steps, shown.groups, counts, {})}
          />
        }
        map={devMap.column}
        mapPanel={devMap.panel}
        selection={selectedId ? <DetailsPanel {...shapeDetailsProps("one-sitting", selectedId, source)} phone={phone} onSelect={setSelectedId} onOpenPrompt={setOpenPromptId} colour={detailsColour} /> : undefined}
        post={
          <PostTab
            thread={thread}
            phone={phone}
            draft={{ build: null, title: "A bakery order page, one sitting then agents", maker: { id: "dev-maker", name: "Sam Rivera", handle: "sam", avatar: null } }}
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

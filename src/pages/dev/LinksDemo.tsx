/* CA-06 P7 — /dev/kit/pages/sandbox?build=links: "A post with links", the composer's links working on a fixture.

   The one-sitting build (CA-04) with a check, three parts coloured, and a post that links two sessions, a prompt, a
   team's agent, the check, the code tile sent with prompt 2 and a tile that is gone. Clicking a link brings its part
   in, outlines it and opens its window, as the composer does (`usePostLinks`); nothing is written. `&lens=map` starts
   on the Map. */

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { PartRegistryProvider, type PartRegistry } from "@/components/build/partNav";
import { PartWindow } from "@/components/build/PartWindow";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { linksBuild, linksPost } from "@/dev/fixtures/postLinks";
import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { sessionFacts, shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeSource } from "@/dev/fixtures/shapes";
import { refGroups } from "@/lib/build/postRefs";
import type { ThreadDoc } from "@/lib/build/thread";
import { BuildList } from "@/pages/site/compose/BuildList";
import { BuildMap } from "@/pages/site/compose/BuildMap";
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
  const phone = useIsPhone();
  const build = useMemo(() => linksBuild(), []);
  const source: ShapeSource = useMemo(() => ({ tree: build.tree, making: build.making, selected: "o-p2" }), [build]);
  const [lens, setLens] = useState<SandboxLens>(params.get("lens") === "map" ? "map" : "list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const [trail, setTrail] = useState<readonly string[]>([]);
  const registry = useRef<PartRegistry>(new Map()).current;
  const groups = useMemo(() => refGroups({ steps: build.steps, groups: build.groups }), [build]);
  const links = usePostLinks({ steps: build.steps, groups: build.groups, refGroups: groups, registry, lens: phone ? "list" : lens, phone, setSelectedId, setOpenPromptId, setTrail });
  const thread = useMemo(() => demoThread(linksPost), []);
  const list = shapeListProps("one-sitting", source);
  const map = shapeMapProps("one-sitting", source);
  const opened = trail.length ? (build.steps.find((step) => step.id === trail[trail.length - 1]) ?? null) : null;
  const { counts } = sessionFacts(build.tree);

  return (
    <PartRegistryProvider registry={registry}>
      <SandboxView
        fit={fit}
        {...sandboxViewProps("fox", state)}
        title="A bakery order page, one sitting then agents"
        lens={lens}
        onLens={setLens}
        mapAvailable
        trail={opened ? [{ id: opened.id, title: opened.title ?? opened.defaultTitle }] : []}
        onTrail={(depth) => setTrail((previous) => previous.slice(0, depth))}
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
          />
        }
        map={
          <BuildMap
            {...map}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onClear={() => setSelectedId(null)}
            onOpenPrompt={setOpenPromptId}
            opened={opened}
            onOpenContainer={(id) => setTrail((previous) => [...previous, id])}
            onBack={() => setTrail((previous) => previous.slice(0, -1))}
            onLeave={(id) => {
              setTrail([]);
              setSelectedId(id);
            }}
          />
        }
        selection={selectedId ? <DetailsPanel {...shapeDetailsProps("one-sitting", selectedId, source)} phone={phone} onSelect={setSelectedId} onOpenPrompt={setOpenPromptId} /> : undefined}
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

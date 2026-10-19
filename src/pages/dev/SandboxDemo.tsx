/* UI-P63 — /dev/kit/pages/sandbox?theme=noon|dusk&viewport=desktop|mobile.

   `SandboxView` with the sample builds, whatever SANDBOX_COMPOSER_ENABLED says.
   `?build=bakery` draws the second (S3); the default is the fox poster (S1).
   `?open=1` opens the full prompt window on the selected prompt (UI-P67).
   `?lens=map` draws the Map; `?build=big` is 60 steps for the long-task measurement (UI-P68).
   `?build=team` is the team build (S5): add `&lens=map` for its Map, and `&opened=t3` (or `t3b`) for the
   opened team (V5-TeamMap) (UI-P69).
   `?build=manual` is the manual step build (D2 option B): add `&lens=map` for its Map (UI-P70).
   `?details=prompt|session|agent|file|tool|result` picks what Details shows (UI-P66).
   `?post=thread` writes a two-post thread in the post above the build; the default is an empty post (PT-05).
   `?build=shape-alone|shape-retrieval|shape-agent|shape-team|shape-code|shape-team-checks` draws one of CA-02's five
   shapes of AI use, or CA-03's sixth
   (src/dev/fixtures/shapes.ts) in the List, the Map (`&lens=map`) and Details (`&select=<node id>`).
   `?details=pair` is a typed prompt saved as Claude with Grok 4.7, for the note on a pair that breaks the rules (CA-02 P8).
   The Add menu opens the agent, manual step, tool and code dialogs here, writing nothing (CA-02 P10).
   No board image is compared. */

import { useMemo, useState } from "react";

import { AddAgentDialog } from "@/pages/site/compose/AddAgentDialog";
import { AddCheckDialog } from "@/pages/site/compose/AddCheckDialog";
import { AddCodeDialog } from "@/pages/site/compose/AddCodeDialog";
import { canCheck } from "@/lib/build/graph";
import { buildSummary } from "@/lib/build/buildSummary";
import { AddManualStepDialog } from "@/pages/site/compose/AddManualStepDialog";
import { AddToolDialog } from "@/pages/site/compose/AddToolDialog";
import { useSearchParams } from "react-router-dom";

import { FullPromptWindow } from "@/components/build/FullPromptWindow";

import { SHAPES, SHAPE_KEYS, shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeKey } from "@/dev/fixtures/shapes";
import { sandboxDetailsProps, sandboxMapProps, sandboxListProps, sandboxSourcesProps, sandboxManualFixture, sandboxTeamFixture, sandboxViewProps, type SandboxDetails, type SandboxFixture, type SandboxMapFixture } from "@/dev/fixtures/sandbox";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { BuildMap } from "@/pages/site/compose/BuildMap";
import { BuildList } from "@/pages/site/compose/BuildList";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";
import { PostTab } from "@/pages/site/compose/PostTab";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";

import type { ThreadDoc } from "@/lib/build/thread";
import type { ComposeThread } from "@/pages/site/compose/useComposeThread";

import type { DesignPageProps } from "./KitPages";

const EMPTY_POST: ThreadDoc = { type: "doc", content: [{ type: "paragraph" }] };
const THREAD_POST: ThreadDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "A poster of a fox, from one photo and three prompts." }] },
    { type: "postBreak" },
    { type: "paragraph", content: [{ type: "text", text: "The second prompt is the one that fixed the colours." }] },
  ],
} as ThreadDoc;

/** A thread that writes nowhere: the dev page has no build to save to. */
function demoThread(doc: ThreadDoc): ComposeThread {
  return {
    buildId: undefined,
    ensureBuild: () => Promise.reject(new Error("The dev page has no build to upload to.")),
    status: "ready",
    version: 1,
    readDoc: () => doc,
    onDoc: () => undefined,
    posts: 1,
    save: "idle",
    hold: null,
    flush: async () => undefined,
    retry: () => undefined,
    retryLoad: () => undefined,
  };
}

/** A typed prompt saved as Claude with Grok 4.7, which Claude does not offer (CA-02 P8). */
function brokenPair() {
  const base = sandboxDetailsProps("prompt", "bakery");
  return base.view?.kind === "prompt" ? { ...base, onModel: () => undefined, view: { ...base.view, typed: true, tool: "Claude", model: "Grok 4.7", sessionLine: "Typed here · Claude", detailLine: "Grok 4.7" } } : base;
}

/** A CA-02 shape as the List and the Map take it, Details' selection marked in both. */
function shapeFixture(key: ShapeKey, select: string | null) {
  const selectedId = select ?? SHAPES[key].selected;
  return { list: { ...shapeListProps(key), selectedId }, map: { ...shapeMapProps(key), selectedId } };
}

export default function SandboxDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const asBuild = params.get("build");
  const which: SandboxFixture = asBuild === "bakery" || asBuild === "big" ? "bakery" : "fox";
  const mapOf: SandboxMapFixture = asBuild === "big" ? "big" : which;
  const asked = params.get("details");
  const details: SandboxDetails = (["session", "agent", "file", "tool", "result"] as const).find((kind) => kind === asked) ?? "prompt";
  const [dialog, setDialog] = useState<"agent" | "manual" | "tool" | "code" | "check" | null>(null);
  const [open, setOpen] = useState<string | null>(params.get("open") ? (which === "fox" ? "p1" : "p3") : null);
  const phone = useIsPhone();
  const fine = useFinePointer();
  const shape = SHAPE_KEYS.find((key) => asBuild === `shape-${key}`) ?? null;
  const team = shape ? shapeFixture(shape, params.get("select")) : asBuild === "team" ? sandboxTeamFixture() : asBuild === "manual" ? sandboxManualFixture() : null;
  const list = team?.list ?? sandboxListProps(which);
  const openedId = params.get("opened");
  const opened = team && openedId ? (team.map.steps.flatMap((step) => [step, ...step.children]).find((step) => step.id === openedId) ?? null) : null;
  const postDoc = params.get("post") === "thread" ? THREAD_POST : EMPTY_POST;
  const thread = useMemo(() => demoThread(postDoc), [postDoc]);
  return (
    <>
      <SandboxView
        fit={fit}
        {...sandboxViewProps(which, state)}
        {...(shape ? { title: SHAPES[shape].title } : null)}
        lens={params.get("lens") === "map" ? "map" : "list"}
        mapAvailable={Boolean(team) || params.get("lens") === "map" || sandboxViewProps(which, state).mapAvailable}
        list={<BuildList {...list} phone={phone} onOpenPrompt={setOpen} />}
        map={<BuildMap {...(team?.map ?? sandboxMapProps(mapOf))} opened={opened} onOpenPrompt={setOpen} />}
        trail={opened ? [{ id: opened.id, title: opened.title ?? opened.defaultTitle }] : []}
        selection={<DetailsPanel {...(shape ? shapeDetailsProps(shape, params.get("select") ?? undefined) : asked === "pair" ? brokenPair() : sandboxDetailsProps(details, which))} phone={phone} onOpenPrompt={setOpen} />}
        onAddAgent={() => setDialog("agent")}
        onAddManual={() => setDialog("manual")}
        onAddTool={() => setDialog("tool")}
        onAddCode={() => setDialog("code")}
        onAddCheck={() => setDialog("check")}
        checkable={canCheck(list.steps)}
        summary={list.steps.length > 1 ? buildSummary(list.steps) || undefined : undefined}
        sources={<SourcesPanel {...sandboxSourcesProps(which, state)} phone={phone} fine={fine} />}
        post={<PostTab thread={thread} phone={phone} draft={{ build: null, title: sandboxViewProps(which, state).title, maker: { id: "dev-maker", name: "Sam Rivera", handle: "sam", avatar: null } }} />}
      />
      <AddAgentDialog open={dialog === "agent"} onOpenChange={(next) => setDialog(next ? "agent" : null)} nextNumber={list.steps.length + 1} teamsAvailable onAdd={() => undefined} />
      <AddManualStepDialog open={dialog === "manual"} onOpenChange={(next) => setDialog(next ? "manual" : null)} after={null} available onAdd={() => undefined} />
      <AddToolDialog open={dialog === "tool"} onOpenChange={(next) => setDialog(next ? "tool" : null)} onAdd={() => undefined} />
      <AddCodeDialog open={dialog === "code"} onOpenChange={(next) => setDialog(next ? "code" : null)} onAdd={() => undefined} />
      <AddCheckDialog open={dialog === "check"} onOpenChange={(next) => setDialog(next ? "check" : null)} onAdd={() => undefined} />
      <FullPromptWindow steps={list.steps} names={list.names} openId={open} mode="maker" onTitle={() => undefined} onNavigate={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}

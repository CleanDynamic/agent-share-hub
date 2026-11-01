/* UI-P63 — /dev/kit/pages/sandbox?theme=noon|dusk&viewport=desktop|mobile.

   `SandboxView` with the sample builds, whatever SANDBOX_COMPOSER_ENABLED says.
   `?build=bakery` draws the second (S3); the default is the fox poster (S1).
   `?select=3` selects the step numbered 3 (or with that id) in the List and the Map, and opens Details' overlay in a window too narrow
   to hold it beside the build; on a build of CA-02's shapes `select` is a node id, as below.
   `?open=1` opens the full prompt window on the selected prompt (UI-P67).
   `?lens=map` draws the Map of sessions (CA-17); `&direction=vertical`, `&session=<key>` and `&map=none` pick its direction, selection and the
   empty state. `?build=big` is 60 steps for the long-task measurement (UI-P68).
   `?build=team` is the team build (S5): add `&lens=map` for its Map (UI-P69).
   `?build=manual` is the manual step build (D2 option B): add `&lens=map` for its Map (UI-P70).
   `?details=prompt|session|agent|file|tool|result` picks what Details shows (UI-P66).
   `?post=thread` writes a two-post thread in the post above the build; the default is an empty post (PT-05).
   `?build=shape-everything` is CA-05's Everything at once; `&open=e-p1` opens its first prompt in the full window.
   `?build=shape-alone|shape-retrieval|shape-agent|shape-team|shape-code|shape-team-checks` draws one of CA-02's five
   shapes of AI use, or CA-03's sixth; `&check=failed` draws its check with one run failed
   (src/dev/fixtures/shapes.ts) in the List, the Map (`&lens=map`) and Details (`&select=<node id>`).
   `?build=parts` is CA-17's "Two parts": Part A, Part B starting after Session 2, letters, the map and a post that links a part (LinksDemo).
   `?build=links` is CA-06's "A post with links": the post's links work, and nothing is written (LinksDemo).
   `?build=references` is CA-19's "References": groups, single colours, linked text and the windows, kept in memory (ReferencesDemo).
   `?build=ca21` is CA-21's "Moving": two parts, the second empty, moved by the composer's own rules, kept in memory (MovingDemo).
   `?build=ca22` is CA-22's "Motion": the sixteen moments on a fixture, with a bar of buttons that make each change (MotionDemo; `&bar=0` hides the bar, `&tiles=300` adds a long session).
   `?build=ca24&show=<what>` is CA-24's loading, empty and error states (Ca24Demo). `?build=ca23&show=<what>` is CA-23's "Saving, offline and two tabs": the status line's states, the strips, the notice and the two windows (SavingDemo).
   `?build=ca25&show=<what>` is CA-25's Publish checklist, Confirm and a published build's menu (Ca25Demo).
   `?details=pair` is a typed prompt saved as Claude with Grok 4.7, for the note on a pair that breaks the rules (CA-02 P8).
   The Add menu opens the agent, manual step, tool and code dialogs here, writing nothing (CA-02 P10).
   No board image is compared. */

import { lazy, Suspense } from "react";
const DeploymentDemo = lazy(() => import("./DeploymentDemo"));
import { useMemo, useState } from "react";

import { AddAgentDialog } from "@/pages/site/compose/AddAgentDialog";
import { AddCheckDialog } from "@/pages/site/compose/AddCheckDialog";
import { AddCodeDialog } from "@/pages/site/compose/AddCodeDialog";
import { canCheck, type Runs, type Step } from "@/lib/build/graph";
import { buildSummary } from "@/lib/build/buildSummary";
import { AddManualStepDialog } from "@/pages/site/compose/AddManualStepDialog";
import { AddToolDialog } from "@/pages/site/compose/AddToolDialog";
import { useSearchParams } from "react-router-dom";

import { FullPromptWindow } from "@/components/build/FullPromptWindow";

import { SHAPES, SHAPE_KEYS, shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeKey } from "@/dev/fixtures/shapes";
import { sandboxDetailsProps, sandboxMapProps, sandboxListProps, sandboxSourcesProps, sandboxManualFixture, sandboxTeamFixture, sandboxViewProps, type SandboxDetails, type SandboxFixture, type SandboxMapFixture } from "@/dev/fixtures/sandbox";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { useDevMap } from "./DevMap";
import { BuildList } from "@/pages/site/compose/BuildList";
import { DetailsPanel, type DetailsPanelProps } from "@/pages/site/compose/DetailsPanel";
import { PostTab } from "@/pages/site/compose/PostTab";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";

import type { ThreadDoc } from "@/lib/build/thread";
import type { ComposeThread } from "@/pages/site/compose/useComposeThread";

import type { DesignPageProps } from "./KitPages";
import LinksDemo from "./LinksDemo";
import MovingDemo from "./MovingDemo";
import MotionDemo from "./MotionDemo";
import SavingDemo from "./SavingDemo";
import Ca24Demo from "./Ca24Demo";
import Ca25Demo from "./Ca25Demo";
import Ca28Demo from "./Ca28Demo";
import ReferencesDemo from "./ReferencesDemo";

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
  return base.view?.kind === "prompt" ? { ...base, onModel: () => undefined, view: { ...base.view, typed: true, tool: "Claude", model: "Grok 4.7", sessionLine: "Claude", detailLine: "Grok 4.7" } } : base;
}

/** A CA-02 shape as the List and the Map take it, Details' selection marked in both. */
/** CA-03 P10: `&check=failed` draws a shape's check as if one of its runs failed, for the List's failing state. */
const failedCheck = (steps: readonly Step[]): Step[] => steps.map((step) => (step.check && step.check.total ? { ...step, check: { ...step.check, passed: step.check.total - 1 } } : step));

function shapeFixture(key: ShapeKey, select: string | null, failed = false) {
  const selectedId = select ?? SHAPES[key].selected;
  const list = shapeListProps(key);
  const map = shapeMapProps(key);
  return {
    list: { ...list, steps: failed ? failedCheck(list.steps) : list.steps, selectedId },
    map: { ...map, steps: failed ? failedCheck(map.steps) : map.steps, selectedId },
  };
}

export default function SandboxDemo(props: DesignPageProps) {
  const [params] = useSearchParams();
  // CA-06 P7: "A post with links".
  if (params.get("build") === "links" || params.get("build") === "parts") return <LinksDemo {...props} />;
  if (params.get("build") === "references") return <ReferencesDemo {...props} />;
  if (params.get("build") === "ca21") return <MovingDemo {...props} />;
  if (params.get("build") === "ca22" || params.get("build") === "ca27") return <MotionDemo {...props} />;
  if (params.get("build") === "ca23") return <SavingDemo {...props} />;
  if (params.get("build") === "ca24") return <Ca24Demo {...props} />;
  if (params.get("build") === "ca25") return <Ca25Demo {...props} />;
  if (params.get("build") === "ca28") return <Ca28Demo {...props} />;
  // SV-28 P9: the deployment fixtures (SV-27's three and the chief of staff), in their own chunk.
  if (params.get("build")?.startsWith("deployment-") || params.get("build")?.startsWith("pipeline-") || params.get("build")?.startsWith("sessions-")) return <Suspense fallback={null}><DeploymentDemo {...props} /></Suspense>;
  return <ShapesDemo {...props} />;
}

function ShapesDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const asBuild = params.get("build");
  const which: SandboxFixture = asBuild === "bakery" || asBuild === "big" ? "bakery" : "fox";
  const mapOf: SandboxMapFixture = asBuild === "big" ? "big" : which;
  const asked = params.get("details");
  const details: SandboxDetails = (["session", "agent", "file", "tool", "result"] as const).find((kind) => kind === asked) ?? "prompt";
  const [dialog, setDialog] = useState<"agent" | "manual" | "tool" | "code" | "check" | null>(null);
  // CA-05 P11: `&open=<step id>` opens the full prompt window on that prompt of a shape.
  const [open, setOpen] = useState<string | null>(params.get("open") ? (params.get("open") !== "1" ? params.get("open") : which === "fox" ? "p1" : "p3") : null);
  const phone = useIsPhone();
  const fine = useFinePointer();
  const shape = SHAPE_KEYS.find((key) => asBuild === `shape-${key}`) ?? null;
  const team = shape ? shapeFixture(shape, params.get("select"), params.get("check") === "failed") : asBuild === "team" ? sandboxTeamFixture() : asBuild === "manual" ? sandboxManualFixture() : null;
  const baseList = team?.list ?? sandboxListProps(which);
  // CA-18: `?select=3` marks the step with that number or id, as a click on it would.
  const asSelect = shape ? null : params.get("select");
  const picked = asSelect ? (baseList.steps.flatMap((step) => [step, ...step.children]).find((step) => step.number === asSelect || step.id === asSelect) ?? null) : null;
  const list = picked ? { ...baseList, selectedId: picked.id } : baseList;
  const devMap = useDevMap({
    fixture: team?.map ?? sandboxMapProps(mapOf),
    direction: params.get("direction") === "vertical" ? "vertical" : "horizontal",
    selected: params.get("session"),
    none: params.get("map") === "none",
  });
  /* CA-03 P10: How did it run? keeps what you pick here, writing nothing, so its fields can be seen. */
  const [runsPicked, setRunsPicked] = useState<{ id: string; runs: Runs | null } | null>(null);
  const withRuns = (props: DetailsPanelProps): DetailsPanelProps => ({
    ...props,
    view: props.view && runsPicked && "runs" in props.view && props.view.id === runsPicked.id ? { ...props.view, runs: runsPicked.runs } : props.view,
    onRuns: (id, runs) => setRunsPicked({ id, runs }),
  });
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
        map={devMap.column}
        mapPanel={devMap.panel}
        selectedKey={picked?.id ?? null}
        selection={asked === "none" ? undefined : <DetailsPanel {...withRuns(shape ? shapeDetailsProps(shape, params.get("select") ?? undefined) : asked === "pair" ? brokenPair() : sandboxDetailsProps(details, which))} phone={phone} onOpenPrompt={setOpen} />}
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
      <FullPromptWindow steps={list.steps} names={list.names} openId={open} mode="maker" onTitle={() => undefined} onChanges={() => undefined} onNavigate={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}

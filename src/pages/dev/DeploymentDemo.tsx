/* SV-28 P9: the deployment fixtures in the composer, for the screens: `?build=deployment-assistant|deployment-self-hosted|
   deployment-agent-team|deployment-chief-of-staff`. The real List, Details, windows and Architecture map, over the fixture's tree,
   writing nothing.

     &select=<id>                 Details on that tile (an agent shows Hands off to, Mentions not matched, Trust boundary)
     &lens=map                    the Architecture map
     &window=setup&for=<id>       Show setup prompt (&harness=<id> starts Rebuild in there)
     &window=approval             Add > Approval, after the team
     &window=edit&for=<id>        the tile's own window (an agent's Hands off to, a team's workspace and example run)
     &window=prompt&for=<id>      the prompt window, a job's fields open
     &open=<team id>              the List with that team's example run open */

import { useState, type ComponentProps } from "react";
import { useSearchParams } from "react-router-dom";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { agentTeamTree } from "@/dev/fixtures/deployment/agent-team";
import { assistantTree } from "@/dev/fixtures/deployment/assistant";
import { chiefOfStaffTree } from "@/dev/fixtures/deployment/chief-of-staff";
import { selfHostedTree } from "@/dev/fixtures/deployment/self-hosted";
import { sandboxListProps, sandboxViewProps } from "@/dev/fixtures/sandbox";
import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";
import { AddManualStepDialog } from "@/pages/site/compose/AddManualStepDialog";
import { MapViews } from "@/pages/site/compose/ArchitectureMap";
import { BuildList } from "@/pages/site/compose/BuildList";
import { DetailsPanel, type DetailsHandlers } from "@/pages/site/compose/DetailsPanel";
import { resolveView } from "@/pages/site/compose/detailsView";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { SetupPromptWindow } from "@/pages/site/compose/SetupPromptWindow";
import { TileEditDialog } from "@/pages/site/compose/TileEditDialog";

import type { DesignPageProps } from "./KitPages";

export const DEPLOYMENT_FIXTURES: Record<string, { tree: NodeTree[]; title: string }> = {
  "deployment-assistant": { tree: assistantTree, title: "A personal assistant" },
  "deployment-self-hosted": { tree: selfHostedTree, title: "A self-hosted support swarm" },
  "deployment-agent-team": { tree: agentTeamTree, title: "A launch team" },
  "deployment-chief-of-staff": { tree: chiefOfStaffTree, title: "A chief of staff and three specialists" },
};

const flat = (nodes: readonly NodeTree[]): NodeTree[] => nodes.flatMap((node) => [node, ...flat(node.children ?? [])]);
const noop = () => undefined;
const HANDLERS: DetailsHandlers = { onRename: noop, onModel: noop, onAddUse: noop, onRemoveUse: noop, onRuns: noop, onRemoveInside: noop, onToggleSessionPrompt: noop, onExtras: noop } as unknown as DetailsHandlers;

export default function DeploymentDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const phone = useIsPhone();
  const fixture = DEPLOYMENT_FIXTURES[params.get("build") ?? ""] ?? DEPLOYMENT_FIXTURES["deployment-chief-of-staff"];
  const tree = fixture.tree;
  const steps = buildSteps(tree);
  const names = Object.fromEntries(flat(tree).flatMap((node) => (node.type === "integration" && typeof (node.payload as Record<string, unknown>)?.service === "string" ? [[node.id, (node.payload as Record<string, string>).service]] : [])));
  const [selected, setSelected] = useState<string | null>(params.get("select"));
  const [windowFor, setWindowFor] = useState<{ kind: string; id: string | null } | null>(params.get("window") ? { kind: params.get("window") as string, id: params.get("for") } : null);
  const view = (id: string | null) =>
    id ? resolveView({ selectedId: id, steps, groups: [], tree, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set(), media: () => undefined }) : null;
  const base = sandboxViewProps("bakery", state);
  const teamId = steps.find((step) => step.kind === "team")?.id ?? null;
  return (
    <>
      <SandboxView
        fit={fit}
        {...base}
        title={fixture.title}
        lens={params.get("lens") === "map" ? "map" : "list"}
        mapAvailable
        list={<BuildList {...sandboxListProps("bakery")} dividers={new Map()} results={[]} costGroups={[]} steps={steps} names={names} selectedId={selected} onSelect={setSelected} phone={phone} onSetupPrompt={(id, how) => (how === "show" ? setWindowFor({ kind: "setup", id }) : undefined)} />}
        map={<MapViews made={{ map: { view: "architecture" } }} sessions={1} tree={tree} direction={params.get("direction") === "vertical" ? "vertical" : "horizontal"} sessionsMap={null} onView={noop} onOpen={setSelected} />}
        selectedKey={selected}
        selection={<DetailsPanel {...(HANDLERS as unknown as ComponentProps<typeof DetailsPanel>)} view={view(selected)} phone={phone} />}
      />
      {windowFor?.kind === "setup" ? <SetupPromptWindow key={params.get("harness") ?? "own"} harness={params.get("harness") ?? undefined} id={windowFor.id ?? teamId} tree={tree} onCopy={noop} onClose={() => setWindowFor(null)} /> : null}
      {windowFor?.kind === "approval" ? <AddManualStepDialog open onOpenChange={() => setWindowFor(null)} after={null} available approval={{ steps, afterId: teamId }} onAdd={noop} /> : null}
      {windowFor?.kind === "edit" ? <TileEditDialog view={view(windowFor.id)} handlers={HANDLERS} onClose={() => setWindowFor(null)} /> : null}
      <FullPromptWindow steps={steps} names={names} openId={windowFor?.kind === "prompt" ? windowFor.id : null} mode="maker" onExtras={noop} onTitle={noop} onClose={() => setWindowFor(null)} />
    </>
  );
}

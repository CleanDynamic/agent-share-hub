/* CA-28 P0: /dev/kit/pages/sandbox?build=ca28&window=<key>: one window, open as it opens in the build, on its own.

   `window=` takes agent, check, code, dataset, decision, manual, repo, result, system-prompt, tool, prompt (the prompt's window),
   session, or edit-<kind> for a saved tile of that kind in the edit window (tool, code, check, agent, decision, result, ...).
   Nothing is written anywhere. */

import { useSearchParams } from "react-router-dom";

import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { tileView } from "@/dev/fixtures/detailsKinds";
import { AddAgentDialog } from "@/pages/site/compose/AddAgentDialog";
import { AddCheckDialog } from "@/pages/site/compose/AddCheckDialog";
import { AddCodeDialog } from "@/pages/site/compose/AddCodeDialog";
import { AddDatasetDialog } from "@/pages/site/compose/AddDatasetDialog";
import { AddDecisionDialog } from "@/pages/site/compose/AddDecisionDialog";
import { AddManualStepDialog } from "@/pages/site/compose/AddManualStepDialog";
import { AddRepoDialog } from "@/pages/site/compose/AddRepoDialog";
import { AddResultDialog } from "@/pages/site/compose/AddResultDialog";
import { AddSystemPromptDialog } from "@/pages/site/compose/AddSystemPromptDialog";
import { AddToolDialog } from "@/pages/site/compose/AddToolDialog";
import type { DetailsHandlers, SessionView } from "@/pages/site/compose/DetailsPanel";
import { SessionDialog } from "@/pages/site/compose/SessionDialog";
import { TileEditDialog } from "@/pages/site/compose/TileEditDialog";

import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;
const handlers = new Proxy({}, { get: () => noop }) as unknown as DetailsHandlers;
const CODE_TILES = [{ id: "c1", label: "Code 2 · classify.ts", source: "export const classify = () => 'refund';" }];
const STEP_CHOICES = [
  { id: "p1", label: "Prompt 1" },
  { id: "p2", label: "Prompt 2" },
];

export default function Ca28Demo(_props: DesignPageProps) {
  const [params] = useSearchParams();
  const which = params.get("window") ?? "tool";
  const common = { open: true, onOpenChange: noop };
  const list = sandboxListProps("bakery");
  const edit = which.startsWith("edit-") ? tileView(which.slice(5) as Parameters<typeof tileView>[0], "full") : null;
  return (
    <div style={{ minHeight: "100dvh" }}>
      {which === "agent" ? <AddAgentDialog {...common} nextNumber={5} teamsAvailable onAdd={noop} /> : null}
      {which === "check" ? <AddCheckDialog {...common} onAdd={noop} /> : null}
      {which === "code" ? <AddCodeDialog {...common} onAdd={noop} /> : null}
      {which === "dataset" ? <AddDatasetDialog {...common} onAdd={noop} /> : null}
      {which === "decision" ? <AddDecisionDialog {...common} codeTiles={CODE_TILES} stepChoices={STEP_CHOICES} onAdd={noop} /> : null}
      {which === "manual" ? <AddManualStepDialog {...common} after={null} available onAdd={noop} /> : null}
      {which === "repo" ? <AddRepoDialog {...common} onAdd={noop} fetchRepo={async () => null} /> : null}
      {which === "result" ? <AddResultDialog {...common} onAdd={noop} /> : null}
      {which === "system-prompt" ? <AddSystemPromptDialog {...common} prompts={STEP_CHOICES} session="s1" onAdd={noop} /> : null}
      {which === "tool" ? <AddToolDialog {...common} onAdd={noop} /> : null}
      {which === "prompt" ? <FullPromptWindow steps={list.steps} names={list.names} openId="p3" mode="maker" onTitle={noop} onChanges={noop} onNavigate={noop} onClose={noop} onExtras={noop} /> : null}
      {which === "session" ? <SessionDialog view={tileView("session", "full") as SessionView} handlers={handlers} inBuild={[]} onClose={noop} /> : null}
      {edit ? <TileEditDialog view={edit} handlers={handlers} inBuild={[]} onClose={noop} /> : null}
    </div>
  );
}

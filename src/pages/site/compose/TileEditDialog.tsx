/* CA-18 P2: every tile's window, opened on a tile that is there.

   The Add dialogs are the windows: this opens one in edit mode, filled in from the tile's own view (`tileEdits`), its title the
   tile's own line under the eyebrow "Edit", its primary button Save. It also draws what only the tile's own window has (what it
   uses, what it makes, how it runs: `editKit`), and holds back every write in a `WriteBuffer` until Save, through the handlers
   Details used (`bufferedHandlers`). Cancel and Escape drop the buffer: nothing is written.

   A prompt opens in `FullPromptWindow`; a session is `SessionDialog`; this takes every other kind that has a window. */

import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { asksHowRun } from "@/lib/build/modelRun";

import { AddAgentDialog } from "./AddAgentDialog";
import { AddCheckDialog } from "./AddCheckDialog";
import { AddCodeDialog } from "./AddCodeDialog";
import { AddDatasetDialog } from "./AddDatasetDialog";
import { AddDecisionDialog } from "./AddDecisionDialog";
import { AddManualStepDialog } from "./AddManualStepDialog";
import { AddRepoDialog } from "./AddRepoDialog";
import { AddResultDialog } from "./AddResultDialog";
import { AddSystemPromptDialog } from "./AddSystemPromptDialog";
import { AddToolDialog } from "./AddToolDialog";
import { ChangesEachRoundField, MemoryTidyField } from "./AgentNotesFields";
import { CheckRunsField } from "./SessionExtrasFields";
import type { DetailsHandlers, DetailsView } from "./DetailsPanel";
import { WriteBuffer } from "./editBuffer";
import { bufferedHandlers } from "./editHandlers";
import { useBuildHistoryContext } from "./useBuildHistory";
import { GoesBlock, InsideBlock, MakesBlock, PicturesBlock, RuntimeBlocks, SummaryRow, TitleRow, ToolsUsedBlock, TrainedBlock, UsesBlock, WhereRanBlock } from "./editKit";
import { ModelRunFields } from "./ModelRunFields";
import { SessionDialog } from "./SessionDialog";
import { RunsGroup } from "./RunsFields";
import {
  agentCurrent,
  checkCurrent,
  codeCurrent,
  datasetCurrent,
  editTitle,
  manualCurrent,
  repoCurrent,
  resultCurrent,
  saveAgent,
  saveCheck,
  saveCode,
  saveDataset,
  saveManual,
  saveRepo,
  saveResult,
  saveSystemPrompt,
  saveTool,
  systemPromptCurrent,
  toolCurrent,
} from "./tileEdits";

type V<K extends DetailsView["kind"]> = Extract<DetailsView, { kind: K }>;

export interface TileEditDialogProps {
  /** The tile to change. Null, or a prompt or a session (they have their own windows): nothing is drawn. */
  view: DetailsView | null;
  handlers: DetailsHandlers;
  inBuild?: readonly string[];
  onClose: () => void;
  /** The tool and file pieces the window offers as inputs are in the view; a team's agents too. */
  teamsAvailable?: boolean;
}

/** The kinds this window takes. */
export const EDITABLE_KINDS: readonly DetailsView["kind"][] = ["manual", "code", "check", "decision", "tool", "agent", "team", "result", "system_prompt", "dataset", "repo", "session"];

export function opensEditDialog(view: DetailsView | null): boolean {
  return Boolean(view) && EDITABLE_KINDS.includes((view as DetailsView).kind);
}

interface Session {
  /** The handlers, queued until Save. */
  h: DetailsHandlers;
  /** Run the queued writes. */
  flush: () => void;
  /** Close, dropping what is queued. */
  discard: (open: boolean) => void;
}


/** SV-27 P5: the agent's deployment fields, their own chunk (the composer's stays within its budget). */
const AgentRuntimeFields = lazy(() => import("./AgentRuntimeFields").then((m) => ({ default: m.AgentRuntimeFields })));

function useEditing(handlers: DetailsHandlers, onClose: () => void, view?: DetailsView | null): Session {
  const [buffer] = useState(() => new WriteBuffer());
  // The buffered handlers read the page's handlers as they are when each call is made, so the buffer outlives a re-render.
  const h = useMemo(() => bufferedHandlers(handlers, buffer), [handlers, buffer]);
  const history = useBuildHistoryContext();
  return {
    h,
    // CA-20 P5: Save is one step of the build's history, however many writes it makes.
    flush: () => {
      if (!history || buffer.size === 0) {
        buffer.flush();
        return;
      }
      // Taken out now, before the window closes and drops what is queued; written inside the step.
      const writes = buffer.drain();
      void history.track(view ? `Saved ${editTitle(view)}` : "Saved changes", async () => {
        for (const run of writes) run();
      });
    },
    discard: (open) => {
      if (open) return;
      buffer.clear();
      onClose();
    },
  };
}

/** What a tile that takes inputs shows after its own fields: what it uses, what it makes, where its work goes, how it runs. */
function inputs(view: Extract<DetailsView, { uses: readonly unknown[] }>, h: DetailsHandlers, phone: boolean, makes: boolean): ReactNode {
  return (
    <>
      <UsesBlock id={view.id} rows={view.uses} options={view.options} phone={phone} handlers={h} />
      {makes ? <MakesBlock id={view.id} rows={"makes" in view ? view.makes : []} phone={phone} handlers={h} /> : null}
      <GoesBlock rows={view.goesInto} />
    </>
  );
}

function ToolEdit({ view, handlers, inBuild, onClose }: TileEditDialogProps & { view: V<"tool"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  const [runsAt, setRunsAt] = useState(view.runsAt ?? null);
  return (
    <AddToolDialog
      open
      onOpenChange={discard}
      inBuild={inBuild}
      seed={toolCurrent(view)}
      edit={{
        title: editTitle(view),
        onSave: (input) => {
          saveTool(view, input, runsAt, h);
          flush();
        },
        after: (input) => (
          <>
            {input.connection === "mcp" ? <WhereRanBlock runsAt={runsAt} onChange={setRunsAt} phone={phone} /> : null}
            <ToolsUsedBlock toolsUsed={view.toolsUsed ?? []} />
            <GoesBlock rows={view.usedBy} label="Used by" />
            <RuntimeBlocks view={view} phone={phone} handlers={h} />
          </>
        ),
      }}
    />
  );
}

function ManualEdit({ view, handlers, inBuild, onClose }: TileEditDialogProps & { view: V<"manual"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  return (
    <AddManualStepDialog
      open
      onOpenChange={discard}
      after={null}
      available
      inBuild={inBuild}
      seed={manualCurrent(view)}
      edit={{
        title: editTitle(view),
        before: () => <TitleRow id={view.id} title={view.title} defaultTitle={view.defaultTitle} phone={phone} handlers={h} />,
        onSave: (input) => {
          saveManual(view, input, h);
          flush();
        },
        after: () => (
          <>
            {inputs(view, h, phone, true)}
            <RuntimeBlocks view={view} phone={phone} handlers={h} />
          </>
        ),
      }}
    />
  );
}

function CodeEdit({ view, handlers, inBuild, onClose }: TileEditDialogProps & { view: V<"code"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  // A rule or a skill opened from a session's setup is a code tile too; its own fields are not written here.
  return (
    <AddCodeDialog
      open
      onOpenChange={discard}
      inBuild={inBuild}
      current={codeCurrent(view)}
      edit={{
        title: editTitle(view),
        before: () => <TitleRow id={view.id} title={view.title} defaultTitle={view.defaultTitle} phone={phone} handlers={h} />,
        onSave: (input) => {
          saveCode(view, input, h);
          flush();
        },
        after: () => (
          <>
            {inputs(view, h, phone, true)}
            <RuntimeBlocks view={view} phone={phone} handlers={h} />
          </>
        ),
      }}
    />
  );
}

function CheckEdit({ view, handlers, onClose }: TileEditDialogProps & { view: V<"check"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  const [runs, setRuns] = useState(view.check.runs ?? []);
  return (
    <AddCheckDialog
      open
      onOpenChange={discard}
      seed={checkCurrent(view)}
      edit={{
        title: editTitle(view),
        before: () => <TitleRow id={view.id} title={view.title} defaultTitle={view.defaultTitle} phone={phone} handlers={h} />,
        slots: { runs: h.onCheckRuns ? <CheckRunsField id={view.id} runs={runs} phone={phone} onChange={(next) => { setRuns(next); h.onCheckRuns?.(view.id, next); }} /> : undefined },
        onSave: (input) => {
          saveCheck(view, input, h);
          flush();
        },
        after: () => (
          <>
            <UsesBlock id={view.id} rows={view.uses} options={view.options} phone={phone} handlers={h} />
            <GoesBlock rows={view.goesInto} />
          </>
        ),
      }}
    />
  );
}

function DecisionEdit({ view, handlers, inBuild, onClose }: TileEditDialogProps & { view: V<"decision"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  return (
    <AddDecisionDialog
      open
      onOpenChange={discard}
      inBuild={inBuild}
      codeTiles={view.codeTiles}
      stepChoices={view.stepChoices}
      current={view.draft}
      edit={{
        title: editTitle(view),
        // The dialog reads its form into a `DecisionInput` (its own refusals are said inside it); Save writes it through `onDecision`.
        onSave: (input) => {
          h.onDecision?.(view.id, input);
          flush();
        },
        after: () => <RuntimeBlocks view={view} phone={phone} handlers={h} />,
      }}
    />
  );
}

function AgentEdit({ view, handlers, inBuild, teamsAvailable = true, onClose }: TileEditDialogProps & { view: V<"agent" | "team"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  const current = agentCurrent(view);
  const how = view.runs?.how ?? (view.sessionGoal ? "goal" : "once");
  const startsSummary = how === "once" ? null : [view.runs?.detail, how === "parallel" ? `${view.runs?.count ?? ""} at the same time` : null].filter(Boolean).join(" · ") || how;
  return (
    <AddAgentDialog
      open
      onOpenChange={discard}
      nextNumber={Number.parseInt(view.number, 10) || 1}
      teamsAvailable={teamsAvailable}
      inBuild={inBuild}
      current={current}
      edit={{
        title: editTitle(view),
        slots: {
          startsSummary: startsSummary as ReactNode,
          starts: <RunsGroup view={view} phone={phone} onRuns={h.onRuns} onAgentNotes={h.onAgentNotes} />,
          memory: view.kind === "agent" && h.onAgentNotes ? <MemoryTidyField id={view.id} value={view.memoryTidy ?? ""} phone={phone} onCommit={(said) => h.onAgentNotes?.(view.id, { memoryTidy: said })} /> : undefined,
        },
        onSave: (input) => {
          saveAgent(view, input, h);
          flush();
        },
        after: (input) => (
          <>
            {view.kind === "agent" && h.onModelRun && asksHowRun(input.harness, input.model) ? <ModelRunFields id={view.id} run={view.modelRun ?? null} hosts={view.runHosts} phone={phone} onChange={(run) => h.onModelRun?.(view.id, run)} /> : null}
            {/* SV-27 P5: framework, compatible models, model routing, approvals, sandbox, role, tool permissions, the Deployment line. */}
            <Suspense fallback={null}>
            <AgentRuntimeFields
              id={view.id}
              kind={view.kind}
              phone={phone}
              fields={view.fields ?? {}}
              harness={input.harness ?? null}
              builtInCode={!input.harness && input.builtInCode === true}
              tools={input.tools ?? []}
              inTeam={Boolean(view.parent)}
              deployment={view.deployment ?? []}
              ownSetup={view.ownSetup}
              onExtras={h.onExtras}
              onOpenTile={h.onSelect}
              onAddDeployment={h.onAddDeployment}
            />
            </Suspense>
            <InsideBlock label={view.inside} rows={view.insideRows} phone={phone} handlers={h} />
            {inputs(view, h, phone, false)}
            <RuntimeBlocks view={view} phone={phone} handlers={h} />
          </>
        ),
      }}
    />
  );
}

function ResultEdit({ view, handlers, inBuild, onClose }: TileEditDialogProps & { view: V<"result"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  return (
    <AddResultDialog
      open
      onOpenChange={discard}
      inBuild={inBuild}
      current={resultCurrent(view)}
      edit={{
        title: editTitle(view),
        before: () => <SummaryRow id={view.id} value={view.summary} phone={phone} handlers={h} />,
        onSave: (input) => {
          saveResult(view, input, h);
          flush();
        },
        after: (input) => (
          <>
            {input.kind === "pictures" || view.pictures.length > 0 ? <PicturesBlock id={view.id} pictures={view.pictures} phone={phone} handlers={h} /> : null}
            {input.kind === "model" ? <TrainedBlock id={view.id} trainedOn={view.trained?.trainedOn ?? null} phone={phone} handlers={h} /> : null}
          </>
        ),
      }}
    />
  );
}

function SystemPromptEdit({ view, handlers, onClose }: TileEditDialogProps & { view: V<"system_prompt"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  return (
    <AddSystemPromptDialog
      open
      onOpenChange={discard}
      prompts={view.prompts}
      session={view.session}
      current={systemPromptCurrent(view)}
      edit={{
        title: editTitle(view),
        onSave: (input) => {
          saveSystemPrompt(view, input, h);
          flush();
        },
        after: () => inputs(view, h, phone, false),
      }}
    />
  );
}

function DatasetEdit({ view, handlers, onClose }: TileEditDialogProps & { view: V<"dataset"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  return (
    <AddDatasetDialog
      open
      onOpenChange={discard}
      current={datasetCurrent(view)}
      edit={{
        title: editTitle(view),
        onSave: (input) => {
          saveDataset(view, input, h);
          flush();
        },
        after: () => inputs(view, h, phone, false),
      }}
    />
  );
}

function RepoEdit({ view, handlers, inBuild, onClose }: TileEditDialogProps & { view: V<"repo"> }) {
  const phone = useIsPhone();
  const { h, flush, discard } = useEditing(handlers, onClose, view);
  const current = repoCurrent(view);
  if (!current) return null;
  return (
    <AddRepoDialog
      open
      onOpenChange={discard}
      inBuild={inBuild}
      current={current}
      edit={{
        title: editTitle(view),
        onSave: (input) => {
          saveRepo(view, input, h);
          flush();
        },
        after: () => inputs(view, h, phone, false),
      }}
    />
  );
}

/** The window for the selected tile, in edit mode. */
export function TileEditDialog(props: TileEditDialogProps) {
  const { view } = props;
  if (!view) return null;
  // `key` gives each tile (and each opening) its own buffer and its own starting values.
  const key = `${view.kind}:${"id" in view ? view.id : view.key}`;
  switch (view.kind) {
    case "session":
      return <SessionDialog key={key} view={view} handlers={props.handlers} inBuild={props.inBuild} onClose={props.onClose} />;
    case "tool":
      return <ToolEdit key={key} {...props} view={view} />;
    case "manual":
      return <ManualEdit key={key} {...props} view={view} />;
    case "code":
      return <CodeEdit key={key} {...props} view={view} />;
    case "check":
      return <CheckEdit key={key} {...props} view={view} />;
    case "decision":
      return <DecisionEdit key={key} {...props} view={view} />;
    case "agent":
    case "team":
      return <AgentEdit key={key} {...props} view={view} />;
    case "result":
      return <ResultEdit key={key} {...props} view={view} />;
    case "system_prompt":
      return <SystemPromptEdit key={key} {...props} view={view} />;
    case "dataset":
      return <DatasetEdit key={key} {...props} view={view} />;
    case "repo":
      return <RepoEdit key={key} {...props} view={view} />;
    default:
      return null;
  }
}

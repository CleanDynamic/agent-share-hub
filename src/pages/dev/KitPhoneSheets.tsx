/* Prompt 24 - the editor's sheets on a phone, for /dev/kit/phone: the Add sheet, a form sheet in the shared frame (labels above,
   chips, the twelve-tile grid, a titled box with Expand, the footer that takes a tap while a field is missing) and the Clear
   action sheet. DEV ONLY. */

import { useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";

import { BigButton } from "@/components/phone";
import { ClearBuildDialog } from "@/pages/site/compose/ClearBuildDialog";
import { ModalForm, ModalShell } from "@/pages/site/compose/ModalFrame";
import { Block, BlockHead, FieldArea, FieldInput, OptionGrid, Row, SegmentedField } from "@/pages/site/compose/modalRecipes";
import { AddMenu } from "@/pages/site/compose/SandboxView";
import { AddAgentDialog } from "@/pages/site/compose/AddAgentDialog";
import { AddManualStepDialog } from "@/pages/site/compose/AddManualStepDialog";
import { AddSystemPromptDialog } from "@/pages/site/compose/AddSystemPromptDialog";
import { OpenRequestDialog } from "@/pages/site/compose/OpenRequestDialog";
import { PublishConfirm } from "@/pages/site/compose/PublishConfirm";
import { RecentlyRemovedDialog } from "@/pages/site/compose/RecentlyRemovedDialog";
import { ReferenceGroupWindow } from "@/pages/site/compose/ReferenceGroupWindow";
import { ModelPicker } from "@/pages/site/compose/ModelPicker";
import { ToolPicker } from "@/pages/site/compose/ToolPicker";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { sandboxMapProps } from "@/dev/fixtures/sandbox";
import type { RemovedEntry } from "@/lib/build/removedLog";
import { SUGGESTED_COLOURS } from "@/lib/theme/partColour";

const KINDS = ["Link", "Image or video", "File", "Model", "Text", "Audio", "Deployed app or website", "Data table", "Sent message", "Change in an external app", "Metric", "Offline outcome"];
const PERMISSIONS = [
  { value: "read", label: "Read only" },
  { value: "write", label: "Read and write" },
  { value: "acts", label: "Acts as the maker" },
];

const noop = () => undefined;

const REMOVED = [
  { id: "r1", kind: "session", badge: "S2", name: "Session 2", detail: "4 tiles", at: Date.now() - 120_000, visible: true },
  { id: "r2", kind: "tile", badge: "7", name: "Prompt 7", at: Date.now() - 600_000, visible: true },
] as unknown as RemovedEntry[];

export function KitPhoneSheets() {
  const phone = useIsPhone();
  const [form, setForm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const fixture = sandboxMapProps("bakery");
  const prompts = fixture.steps.filter((step) => step.kind === "prompt");
  const [promptId, setPromptId] = useState<string | null>(null);
  const shut = () => setOpen(null);
  const button = (key: string, words: string) => (
    <BigButton full onClick={() => setOpen(key)}>
      {words}
    </BigButton>
  );
  const [clear, setClear] = useState(false);
  const [app, setApp] = useState("");
  const [permission, setPermission] = useState<string | null>("read");
  const [kind, setKind] = useState<string[]>(["Link"]);
  return (
    <section data-catalogue="editor-sheets" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <AddMenu phone={phone} variant="title" onAddFile={noop} onAddPromptFocus={noop} onAddTool={noop} onAddResult={noop} onAddAgent={noop} onAddManual={noop} onAddCode={noop} onAddCheck={noop} checkable onAddFromLibrary={noop} />
      <BigButton full onClick={() => setForm(true)}>Open a form sheet</BigButton>
      <BigButton full onClick={() => setClear(true)}>Open Clear the build</BigButton>
      {button("manual", "Open Add a manual step")}
      {button("agent", "Open Add an agent")}
      {button("system", "Open Add a system prompt")}
      {button("still", "Open Mark still open")}
      {button("removed", "Open Recently removed")}
      {button("publish", "Open Publish")}
      {button("group", "Open Reference group")}
      <BigButton full onClick={() => setPromptId(prompts[0]?.id ?? null)}>Open the step sheet</BigButton>
      <AddManualStepDialog open={open === "manual"} onOpenChange={(next) => !next && shut()} after="Prompt 3" available onAdd={shut} />
      <AddAgentDialog open={open === "agent"} onOpenChange={(next) => !next && shut()} onAdd={shut} nextNumber={4} teamsAvailable={false} />
      <AddSystemPromptDialog open={open === "system"} onOpenChange={(next) => !next && shut()} onAdd={shut} prompts={prompts.map((step) => ({ id: step.id, label: `Prompt ${step.number}` }))} session={null} />
      <OpenRequestDialog open={open === "still"} title="Still open: Session 2" onClose={shut} onSubmit={shut} />
      <RecentlyRemovedDialog open={open === "removed"} entries={REMOVED} onRestore={shut} onClose={shut} />
      <PublishConfirm open={open === "publish"} title="Kit rebuild" rows={[{ key: "post", name: "Post", value: "3 posts" }, { key: "build", name: "Build", value: "3 sessions · 12 steps" }]} onCancel={shut} onPublish={shut} />
      <ReferenceGroupWindow
        open={open === "group"}
        phone={phone}
        draft={{ id: "g1", name: "Ordering flow", colour: SUGGESTED_COLOURS[1], members: prompts.slice(0, 3).map((step) => `node:${step.id}`), notes: "" } as never}
        isNew={false}
        refGroups={[]}
        lookup={new Map(prompts.slice(0, 3).map((step) => [`node:${step.id}`, { to: `node:${step.id}`, number: String(step.number), title: `Prompt ${step.number}`, kind: "Prompt" } as never]))}
        groups={[]}
        linked={null}
        findWords={() => []}
        onLinkFound={noop}
        onSelectWords={noop}
        onGoToLink={noop}
        onRemoveLink={noop}
        swatches={{ favourites: [], recent: [] } as never}
        onSwatches={noop}
        history={{ canUndo: false, canRedo: false, onUndo: noop, onRedo: noop }}
        onSave={() => true}
        onDelete={noop}
        onClose={shut}
        onGoToMember={shut}
      />
      <FullPromptWindow steps={fixture.steps} groups={fixture.groups} openId={promptId} mode="reader" onClose={() => setPromptId(null)} onNavigate={setPromptId} />
      <ModalShell open={form} onOpenChange={setForm} title="Add a tool" subtitle="External app the model used" testId="kit-form">
        <ModalForm phone={phone} missing={app.trim() ? null : "Application"} status={app.trim() ? null : "Required: an application"} onSubmit={() => setForm(false)} onCancel={() => setForm(false)}>
          <Row id="kit-app" label="Application" phone={phone}>
            <FieldInput id="kit-app" phone={phone} value={app} onChange={(event) => setApp(event.target.value)} />
          </Row>
          <Row id="kit-harness" label="Harness" group phone={phone}>
            <ToolPicker label="Harness" value={tool} onChange={setTool} inBuild={[]} phone={phone} step="session" field />
          </Row>
          <Row id="kit-model" label="Model" group phone={phone}>
            <ModelPicker tool={tool} value={model} onChange={setModel} phone={phone} field anyWithoutTool />
          </Row>
          <Row id="kit-perm" label="Permissions" group phone={phone}>
            <SegmentedField label="Permissions" phone={phone} items={PERMISSIONS} value={permission} onChange={setPermission} />
          </Row>
          <Block>
            <BlockHead label="Actions performed" htmlFor="kit-actions" />
            <FieldArea id="kit-actions" phone={phone} rows={3} aria-label="Actions performed" />
          </Block>
          <Block>
            <BlockHead label="Output type" count="12 types" />
            <OptionGrid label="Output type" phone={phone} items={KINDS.map((value) => ({ value, label: value }))} chosen={kind} onPick={(value) => setKind([value])} />
          </Block>
        </ModalForm>
      </ModalShell>
      <ClearBuildDialog open={clear} counts={{ parts: 0, sessions: 3, tiles: 12, files: 0 }} onClose={() => setClear(false)} onConfirm={() => setClear(false)} />
    </section>
  );
}

export default KitPhoneSheets;

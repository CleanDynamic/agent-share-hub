/* Prompt 24 - the editor's sheets on a phone, for /dev/kit/phone: the Add sheet, a form sheet in the shared frame (labels above,
   chips, the twelve-tile grid, a titled box with Expand, the footer that takes a tap while a field is missing) and the Clear
   action sheet. DEV ONLY. */

import { useState } from "react";

import { BigButton } from "@/components/phone";
import { ClearBuildDialog } from "@/pages/site/compose/ClearBuildDialog";
import { ModalForm, ModalShell } from "@/pages/site/compose/ModalFrame";
import { Block, BlockHead, FieldArea, FieldInput, OptionGrid, Row, SegmentedField } from "@/pages/site/compose/modalRecipes";
import { AddMenu } from "@/pages/site/compose/SandboxView";

const KINDS = ["Link", "Image or video", "File", "Model", "Text", "Audio", "Deployed app or website", "Data table", "Sent message", "Change in an external app", "Metric", "Offline outcome"];
const PERMISSIONS = [
  { value: "read", label: "Read only" },
  { value: "write", label: "Read and write" },
  { value: "acts", label: "Acts as the maker" },
];

const noop = () => undefined;

export function KitPhoneSheets() {
  const [form, setForm] = useState(false);
  const [clear, setClear] = useState(false);
  const [app, setApp] = useState("");
  const [permission, setPermission] = useState<string | null>("read");
  const [kind, setKind] = useState<string[]>(["Link"]);
  return (
    <section data-catalogue="editor-sheets" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <AddMenu phone variant="title" onAddFile={noop} onAddPromptFocus={noop} onAddTool={noop} onAddResult={noop} onAddAgent={noop} onAddManual={noop} onAddCode={noop} onAddCheck={noop} checkable onAddFromLibrary={noop} />
      <BigButton full onClick={() => setForm(true)}>Open a form sheet</BigButton>
      <BigButton full onClick={() => setClear(true)}>Open Clear the build</BigButton>
      <ModalShell open={form} onOpenChange={setForm} title="Add a tool" subtitle="External app the model used" testId="kit-form">
        <ModalForm phone missing={app.trim() ? null : "Application"} status={app.trim() ? null : "Required: an application"} onSubmit={() => setForm(false)} onCancel={() => setForm(false)}>
          <Row id="kit-app" label="Application" phone>
            <FieldInput id="kit-app" phone value={app} onChange={(event) => setApp(event.target.value)} />
          </Row>
          <Row id="kit-perm" label="Permissions" group phone>
            <SegmentedField label="Permissions" phone items={PERMISSIONS} value={permission} onChange={setPermission} />
          </Row>
          <Block>
            <BlockHead label="Actions performed" htmlFor="kit-actions" />
            <FieldArea id="kit-actions" phone rows={3} aria-label="Actions performed" />
          </Block>
          <Block>
            <BlockHead label="Output type" count="12 types" />
            <OptionGrid label="Output type" phone items={KINDS.map((value) => ({ value, label: value }))} chosen={kind} onPick={(value) => setKind([value])} />
          </Block>
        </ModalForm>
      </ModalShell>
      <ClearBuildDialog open={clear} counts={{ parts: 0, sessions: 3, tiles: 12, files: 0 }} onClose={() => setClear(false)} onConfirm={() => setClear(false)} />
    </section>
  );
}

export default KitPhoneSheets;

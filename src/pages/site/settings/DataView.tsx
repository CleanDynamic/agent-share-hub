/* UX-15 P6: Your data. PURE.

   Download your data: the button prepares one file, then shows its name and size with `Save file` (the size is known before the
   download is saved). Once an hour; a refusal reads `You can download again in <n> minutes.`
   Delete account: a `module` box at the foot of the page. It opens the confirmation window (the modal recipe) with the sentence
   that matches the database, `Download your data first`, and a field that must hold the username before `Delete my account` works. */

import { useState } from "react";

import { Button } from "@/components/brand/Button";
import { DATA_COPY, DELETE_STATEMENT, formatBytes, typingMatches, type PreparedExport } from "@/lib/settings/data";
import { useAction } from "@/lib/settings/useAction";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { ModalShell } from "@/pages/site/compose/ModalFrame";
import { FieldMessage } from "@/pages/site/signin/AuthParts";

import { Group, Note, SectionPage, SettingRow } from "./SettingParts";

export interface DataViewProps {
  username: string | null;
  /** Build the file. Resolves with it; throws a SettingsError with the sentence to show. */
  onPrepare: () => Promise<PreparedExport>;
  onSave: (file: PreparedExport) => void;
  onDelete: (typed: string) => Promise<void>;
}

function DownloadGroup({ onPrepare, onSave }: Pick<DataViewProps, "onPrepare" | "onSave">) {
  const [file, setFile] = useState<PreparedExport | null>(null);
  const action = useAction(async () => {
    setFile(await onPrepare());
  }, "settings-export");
  const preparing = action.state.status === "sending";
  return (
    <Group title="Download your data">
      <SettingRow
        last
        label="Download your data"
        hint="One file with your profile, builds, drafts, topics, replies, likes, follows, saves, collections, comments, the messages you sent, your notifications and the reports you made. Once an hour."
        control={
          <Button variant="secondary" size={32} fontSize={12} disabled={preparing} onClick={() => { setFile(null); void action.run(); }}>
            {preparing ? "Preparing" : "Download your data"}
          </Button>
        }
        below={
          file || action.state.status === "error" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {file ? (
                <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13, color: t.text }}>
                  <span style={{ overflowWrap: "anywhere" }}>{`${file.fileName} · ${formatBytes(file.bytes)}`}</span>
                  <Button variant="secondary" size={32} fontSize={12} onClick={() => onSave(file)}>
                    Save file
                  </Button>
                </div>
              ) : null}
              {file && file.incomplete.length > 0 ? <Note>{`Some of it couldn't be read, so this file is not whole: ${file.incomplete.join(", ")}.`}</Note> : null}
              {action.state.status === "error" ? <FieldMessage>{action.state.message}</FieldMessage> : null}
            </div>
          ) : null
        }
      />
    </Group>
  );
}

function DeleteWindow({ open, username, onClose, onPrepare, onSave, onDelete }: DataViewProps & { open: boolean; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const [file, setFile] = useState<PreparedExport | null>(null);
  const first = useAction(async () => {
    const prepared = await onPrepare();
    setFile(prepared);
    onSave(prepared);
  }, "settings-export-first");
  const remove = useAction(onDelete, "settings-delete");
  const ready = typingMatches(typed, username);
  const busy = remove.state.status === "sending";
  return (
    <ModalShell open={open} onOpenChange={(next) => (!next && !busy ? onClose() : undefined)} title="Delete your account?" subtitle="Read what is removed before you go on." width={480} testId="delete-account-window">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !busy) void remove.run(typed);
        }}
        style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, fontFamily: FIGTREE }}
      >
        <p style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: t.text }}>{DELETE_STATEMENT}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Button variant="secondary" size={32} fontSize={12} disabled={first.state.status === "sending"} onClick={() => void first.run()}>
            Download your data first
          </Button>
          {file ? <span style={{ fontSize: 12, color: t.label }}>{`${file.fileName} · ${formatBytes(file.bytes)}`}</span> : null}
        </div>
        {first.state.status === "error" ? <FieldMessage>{first.state.message}</FieldMessage> : null}
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: t.label }}>
          {`Type your username${username ? ` (${username})` : ""} to confirm`}
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Your username"
            style={{ height: 32, padding: "0 12px", borderRadius: 6, border: `1px solid ${t.line}`, background: t.field, color: t.text, fontFamily: FIGTREE, fontSize: 16 }}
          />
        </label>
        {remove.state.status === "error" ? <FieldMessage>{remove.state.message}</FieldMessage> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" size={32} fontSize={12} disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="secondary" size={32} fontSize={12} disabled={!ready || busy}>
            {busy ? "Deleting" : "Delete my account"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

export function DataView(props: DataViewProps) {
  const [asking, setAsking] = useState(false);
  return (
    <SectionPage title="Your data">
      <DownloadGroup onPrepare={props.onPrepare} onSave={props.onSave} />
      <Group title="Delete account" testId="delete-account-box">
        <SettingRow
          last
          label="Delete account"
          hint="Removes your account and what you made. This can't be undone."
          control={
            <Button variant="secondary" size={32} fontSize={12} onClick={() => setAsking(true)}>
              Delete account
            </Button>
          }
        />
      </Group>
      <DeleteWindow {...props} open={asking} onClose={() => setAsking(false)} />
    </SectionPage>
  );
}

export { DATA_COPY };
export default DataView;

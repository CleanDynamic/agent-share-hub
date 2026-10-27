// The Library's two collection dialogs (RC-P18), moved unchanged from LibraryBuilds.tsx when SV-09 redrew the page:
// naming a collection (new or rename) and deleting one. Each is the existing Dialog (STATES.md row 17): one field or one
// sentence, and one primary that names the act.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { isPermissionError } from "@/lib/errors/permission";
import { COLLECTION_NAME_MAX, renameCollection, startCollection, type BuildCollection } from "@/lib/library";
import { fieldStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body, label as labelType } from "@/lib/theme/type";
import { LIBRARY_COLLECTIONS_KEY } from "./addToCollection";

export const refusalText = (error: unknown) =>
  isPermissionError(error) ? "You don't have access to this." : "Something went wrong.";

/* ── Naming a collection ─────────────────────────────────────────────────── */

export type NameCollectionDialogProps =
  | { mode: "new"; collection?: undefined; onClose: () => void; onNamed: (made: BuildCollection | null) => void }
  | { mode: "rename"; collection: BuildCollection; onClose: () => void; onNamed: (made: BuildCollection | null) => void };

/** The existing Dialog (STATES.md row 17): one field, one primary that names the act. */
export function NameCollectionDialog({ mode, collection, onClose, onNamed }: NameCollectionDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(collection?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const field = useInteractive<HTMLInputElement>();

  const submit = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    setRefusal(null);
    try {
      if (mode === "new") {
        const made = await startCollection(name);
        void queryClient.invalidateQueries({ queryKey: [LIBRARY_COLLECTIONS_KEY] });
        onNamed(made);
      } else {
        await renameCollection(collection.id, name);
        onNamed(null);
      }
    } catch (error) {
      setRefusal(refusalText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent data-testid="name-collection-dialog" style={{ maxWidth: 440 }}>
        <DialogTitle style={{ ...body, fontSize: 18, fontWeight: 600 }}>
          {mode === "new" ? "New collection" : "Rename collection"}
        </DialogTitle>
        <DialogDescription style={{ ...body, color: t.text2 }}>
          {mode === "new" ? "Only you see it until you make it public." : "The builds in it stay as they are."}
        </DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          style={{ display: "flex", flexDirection: "column", gap: SPACE.sm }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
            <span style={{ ...labelType, color: t.text2 }}>Name</span>
            <input
              value={name}
              maxLength={COLLECTION_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              {...field.handlers}
              style={{ ...fieldStyle(field.state), ...body, height: 44, padding: "0 12px", width: "100%" }}
            />
          </label>
          {refusal ? (
            <p role="alert" style={{ ...body, color: t.text, margin: 0 }}>
              {refusal}
            </p>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: SPACE.xs }}>
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose} style={{ minHeight: 44 }}>
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={busy || !name.trim()} style={{ minHeight: 44 }}>
              {mode === "new" ? "Create collection" : "Save name"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Deleting a collection ───────────────────────────────────────────────── */

export function DeleteCollectionDialog({ open, busy, onCancel, onConfirm }: { open: boolean; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !busy ? onCancel() : undefined)}>
      <DialogContent data-testid="delete-collection-dialog" style={{ maxWidth: 440 }}>
        <DialogTitle style={{ ...body, fontSize: 18, fontWeight: 600 }}>Delete this collection?</DialogTitle>
        <DialogDescription style={{ ...body, color: t.text2 }}>
          The builds in it stay where they are; only this group goes.
        </DialogDescription>
        <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: SPACE.xs }}>
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel} style={{ minHeight: 44 }}>
            Cancel
          </Button>
          <Button type="button" variant="default" disabled={busy} onClick={onConfirm} style={{ minHeight: 44 }}>
            Delete collection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

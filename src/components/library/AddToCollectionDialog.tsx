// "Add to a collection" (RC-P18), opened from the Save toast's one text action.
//
// THE EXISTING DIALOG (STATES.md row 17), its scrim and --r-panel, so the page
// recedes and the choice is the only figure ⟦law-of-figure-ground › Overlays
// and scrims⟧. The reader's collections, the one they used last first
// ⟦hicks-law › Remedies 6 Customise⟧, each a 44px row with its count as scent;
// at most seven show before the list scrolls ⟦hicks-law › Budgets⟧. Under them
// a "New collection" field that makes one and puts the build in it. Choosing a
// row is the act, so nothing here is filled ⟦von-restorff-effect⟧.
//
// A collection's name is the reader's own text: it appears in the list and in
// the toast that confirms, and never in an error ⟦neoscale-error-monitoring ›
// Privacy⟧; a refusal is one sentence (STATES.md row 21).

import { useId, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { isPermissionError } from "@/lib/errors/permission";
import {
  COLLECTION_NAME_MAX,
  addBuildToCollection,
  listCollections,
  startCollection,
  type BuildCollection,
} from "@/lib/library";
import { fieldStyle, ring, skeletonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, body, label as labelType, tabular } from "@/lib/theme/type";
import {
  LIBRARY_COLLECTIONS_KEY,
  LIBRARY_COLLECTION_BUILDS_KEY,
  LIBRARY_COLLECTION_KEY,
} from "./addToCollection";

/** One row's height, and so the list's step. */
export const COLLECTION_ROW_HEIGHT = 44;

/** Rows visible before the list scrolls ⟦hicks-law › Budgets⟧. */
export const COLLECTIONS_VISIBLE = 7;

const SECONDARY = { background: "transparent", minHeight: 44 } as const;

const countText = (n: number) => `${n} ${n === 1 ? "build" : "builds"}`;

export interface AddToCollectionDialogProps {
  buildId: string;
  onClose: () => void;
}

export function AddToCollectionDialog({ buildId, onClose }: AddToCollectionDialogProps) {
  const queryClient = useQueryClient();
  const collections = useQuery({
    queryKey: [LIBRARY_COLLECTIONS_KEY, "mine"],
    queryFn: () => listCollections(),
    refetchOnWindowFocus: false,
  });

  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [name, setName] = useState("");
  const fieldId = useId();
  const field = useInteractive<HTMLInputElement>();

  const done = (collection: Pick<BuildCollection, "id" | "name">) => {
    void queryClient.invalidateQueries({ queryKey: [LIBRARY_COLLECTIONS_KEY] });
    void queryClient.invalidateQueries({ queryKey: [LIBRARY_COLLECTION_KEY, collection.id] });
    void queryClient.invalidateQueries({ queryKey: [LIBRARY_COLLECTION_BUILDS_KEY, collection.id] });
    toast(`Added to ${collection.name}.`);
    onClose();
  };

  const refused = (error: unknown) =>
    setRefusal(isPermissionError(error) ? "You don't have access to this." : "Something went wrong.");

  const addTo = async (collection: BuildCollection) => {
    if (busy) return;
    setBusy(true);
    setRefusal(null);
    try {
      await addBuildToCollection(collection.id, buildId);
      done(collection);
    } catch (error) {
      refused(error);
    } finally {
      setBusy(false);
    }
  };

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setRefusal(null);
    try {
      const made = await startCollection(name);
      await addBuildToCollection(made.id, buildId);
      done(made);
    } catch (error) {
      refused(error);
      void queryClient.invalidateQueries({ queryKey: [LIBRARY_COLLECTIONS_KEY] });
    } finally {
      setBusy(false);
    }
  };

  const list = collections.data ?? [];

  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent data-testid="add-to-collection-dialog" style={{ maxWidth: 440 }}>
        <DialogTitle style={{ ...body, fontSize: 18, fontWeight: 600 }}>Add to a collection</DialogTitle>
        <DialogDescription style={{ ...body, color: t.text2 }}>The one you used last is first.</DialogDescription>

        {collections.isLoading ? (
          <div aria-hidden style={{ display: "flex", flexDirection: "column" }}>
            {[0, 1, 2].map((index) => (
              <div key={index} style={{ ...skeletonStyle(), height: COLLECTION_ROW_HEIGHT - SPACE.xs, marginBlock: SPACE.xs / 2 }} />
            ))}
          </div>
        ) : collections.isError ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs }}>
            <p style={{ ...body, color: t.text, margin: 0 }}>
              {isPermissionError(collections.error) ? "You don't have access to this." : "Something went wrong."}
            </p>
            <Button type="button" variant="outline" onClick={() => void collections.refetch()} style={SECONDARY}>
              Try again
            </Button>
          </div>
        ) : list.length === 0 ? (
          <p data-testid="collection-choices-empty" style={{ ...body, color: t.text2, margin: 0 }}>
            No collections yet.
          </p>
        ) : (
          <ul
            data-testid="collection-choices"
            aria-label="Your collections"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              maxHeight: COLLECTION_ROW_HEIGHT * COLLECTIONS_VISIBLE,
              overflowY: "auto",
            }}
          >
            {list.map((collection) => (
              <li key={collection.id}>
                <ChoiceRow collection={collection} disabled={busy} onChoose={() => void addTo(collection)} />
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(event) => void create(event)}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: SPACE.xs,
            borderTop: `1px solid ${t.line}`,
            paddingTop: SPACE.sm,
          }}
        >
          <label htmlFor={fieldId} style={{ ...labelType, color: t.text2 }}>
            New collection
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
            <input
              id={fieldId}
              value={name}
              maxLength={COLLECTION_NAME_MAX}
              placeholder="Name it"
              onChange={(event) => setName(event.target.value)}
              {...field.handlers}
              style={{
                ...fieldStyle(field.state),
                ...body,
                flex: "1 1 200px",
                minWidth: 0,
                height: 44,
                padding: "0 12px",
              }}
            />
            <Button type="submit" variant="outline" disabled={busy || !name.trim()} style={SECONDARY}>
              Create and add
            </Button>
          </div>
        </form>

        {refusal ? (
          <p role="alert" style={{ ...body, color: t.text, margin: 0 }}>
            {refusal}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ChoiceRow({
  collection,
  disabled,
  onChoose,
}: {
  collection: BuildCollection;
  disabled: boolean;
  onChoose: () => void;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button
      type="button"
      data-testid="collection-choice"
      disabled={disabled}
      onClick={onChoose}
      {...handlers}
      style={{
        width: "100%",
        height: COLLECTION_ROW_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.xs,
        padding: `0 ${SPACE.xs}px`,
        border: "none",
        borderRadius: r.control,
        background: state.hovered && !disabled ? t.recess : "transparent",
        color: t.text,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        transition: feedback("background-color"),
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ ...body, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {collection.name}
      </span>
      <span style={{ fontFamily: DM_MONO, fontSize: 12, lineHeight: 1.3, color: t.text2, flexShrink: 0, ...tabular }}>
        {countText(collection.itemCount)}
      </span>
    </button>
  );
}

export default AddToCollectionDialog;

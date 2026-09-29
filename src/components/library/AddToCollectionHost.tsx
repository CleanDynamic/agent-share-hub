// RC-P18 — where the "Add to a collection" dialog lives: mounted once, beside
// the app's toasters, and fetched only the first time a reader asks for it.
// addToCollection.ts says why it is not rendered inside the card that asked.

import { Suspense, lazy } from "react";
import { closeAddToCollection, useAddToCollectionRequest } from "./addToCollection";

const AddToCollectionDialog = lazy(() => import("./AddToCollectionDialog"));

export function AddToCollectionHost() {
  const buildId = useAddToCollectionRequest();
  if (!buildId) return null;
  return (
    <Suspense fallback={null}>
      <AddToCollectionDialog buildId={buildId} onClose={closeAddToCollection} />
    </Suspense>
  );
}

export default AddToCollectionHost;

/* CA-20: the reference bridge for the composer: `lib/build/referenceBridge.ts` made from CA-19's own hooks.

   The page builds it once from `useReferences` (the colours as they stand, the post's editor and the history step) and hands
   it to everything that removes, restores, duplicates, groups or ungroups, by context. Outside the composer there is none:
   `NOT_AVAILABLE`, and Group and Ungroup do not show. */

import { createContext, useContext, useMemo, useRef } from "react";

import { NOT_AVAILABLE, createReferenceBridge, type ReferenceBridge } from "@/lib/build/referenceBridge";

import type { References } from "./useReferences";

export const ReferenceBridgeContext = createContext<ReferenceBridge>(NOT_AVAILABLE);

/** The page's bridge; `NOT_AVAILABLE` outside the composer. */
export const useReferenceBridgeContext = (): ReferenceBridge => useContext(ReferenceBridgeContext);

/** The bridge, over the references as they stand on every render. */
export function useReferenceBridge(references: References): ReferenceBridge {
  const latest = useRef(references);
  latest.current = references;
  return useMemo(
    () =>
      createReferenceBridge({
        model: () => latest.current.model,
        editor: () => latest.current.editor,
        step: (sentence, change) => latest.current.history.step(sentence, change),
      }),
    [],
  );
}

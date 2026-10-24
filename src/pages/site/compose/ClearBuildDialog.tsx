/* CA-20 P4: "Clear the build?" A 420 window of the modal recipes: the words, then Cancel and Clear the build in the danger text
   colour. Counts that are zero are left out. */

import { useIsPhone } from "@/components/shell/useMinWidth";
import { CLEAR_COPY, type ClearCounts } from "@/lib/build/componentMenus";

import { RecipeButton } from "./modalRecipes";
import { DangerButton, SmallWindow } from "./removePieces";

export function ClearBuildDialog({ open, counts, onClose, onConfirm }: { open: boolean; counts: ClearCounts; onClose: () => void; onConfirm: () => void }) {
  const phone = useIsPhone();
  return (
    <SmallWindow
      open={open}
      onClose={onClose}
      title={CLEAR_COPY.title}
      body={CLEAR_COPY.body(counts)}
      testId="clear-build-window"
      buttons={
        <>
          <RecipeButton small={!phone} phone={phone} onClick={onClose}>
            {CLEAR_COPY.cancel}
          </RecipeButton>
          <DangerButton phone={phone} testId="clear-build-confirm" onClick={onConfirm}>
            {CLEAR_COPY.confirm}
          </DangerButton>
        </>
      }
    />
  );
}

/* CA-20 P4: "Clear the build?" A 420 window of the modal recipes: the words, then Cancel and Clear the build in the danger text
   colour. Counts that are zero are left out. */

import { ActionSheet } from "@/components/phone/ActionSheet";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { CLEAR_COPY, type ClearCounts } from "@/lib/build/componentMenus";

import { RecipeButton } from "./modalRecipes";
import { DangerButton, SmallWindow } from "./removePieces";

export function ClearBuildDialog({ open, counts, onClose, onConfirm }: { open: boolean; counts: ClearCounts; onClose: () => void; onConfirm: () => void }) {
  const phone = useIsPhone();
  /* Prompt 24: on a phone, an action sheet with the repo's words; its action "Clear the build" in Danger. */
  if (phone) {
    return (
      <ActionSheet
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={CLEAR_COPY.title}
        explanation={CLEAR_COPY.body(counts)}
        action={{ label: CLEAR_COPY.confirm, danger: true, onSelect: onConfirm }}
        cancelLabel={CLEAR_COPY.cancel}
        data-testid="clear-build-window"
        actionTestId="clear-build-confirm"
      />
    );
  }
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

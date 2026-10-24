/* CA-20 P7: the window that asks before a tile is converted to another kind and something would not carry over.
   When nothing is lost the tile converts at once and this is not drawn. */

import { useIsPhone } from "@/components/shell/useMinWidth";
import { CONVERT_COPY, type ConvertTo } from "@/lib/build/duplicate";

import { RecipeButton } from "./modalRecipes";
import { SmallWindow } from "./removePieces";

export interface Conversion {
  id: string;
  to: ConvertTo;
  /** "Prompt 3". */
  name: string;
  /** What would not come across: "Effort", "Model". */
  lost: string[];
}

export function ConvertWindow({ conversion, onClose, onConfirm }: { conversion: Conversion | null; onClose: () => void; onConfirm: () => void }) {
  const phone = useIsPhone();
  if (!conversion) return null;
  return (
    <SmallWindow
      open
      onClose={onClose}
      title={CONVERT_COPY.title(conversion.name, CONVERT_COPY.targets[conversion.to])}
      body={CONVERT_COPY.lost(conversion.lost)}
      testId="convert-window"
      buttons={
        <>
          <RecipeButton small={!phone} phone={phone} onClick={onClose}>
            Cancel
          </RecipeButton>
          <RecipeButton variant="primary" small={!phone} phone={phone} data-testid="convert-confirm" onClick={onConfirm}>
            {CONVERT_COPY.convert}
          </RecipeButton>
        </>
      }
    />
  );
}

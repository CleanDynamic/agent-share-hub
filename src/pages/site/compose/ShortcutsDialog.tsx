/* CA-20 P8: "Keyboard shortcuts": every key of the build page, a group at a time. A 560 window; the rows are 36 tall with the keys
   at the right, in the data face. */

import { useIsPhone } from "@/components/shell/useMinWidth";
import { SHORTCUT_COPY, SHORTCUT_GROUPS, SHORTCUTS, isMac } from "@/lib/build/shortcuts";
import { t } from "@/lib/theme/tokens";

import { COUNT, GROUP_TITLE, RecipeButton, MODAL_WIDTH } from "./modalRecipes";
import { words } from "./referencePieces";
import { SmallWindow } from "./removePieces";

import { textStep } from "@/lib/theme/type";
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const phone = useIsPhone();
  const mac = isMac();
  return (
    <SmallWindow
      open={open}
      onClose={onClose}
      title={SHORTCUT_COPY.title}
      width={MODAL_WIDTH.standard}
      testId="shortcuts-window"
      buttons={
        <RecipeButton variant="primary" small={!phone} phone={phone} onClick={onClose}>
          {SHORTCUT_COPY.done}
        </RecipeButton>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "60vh", overflowY: "auto" }}>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group} aria-label={group}>
            <h3 style={{ ...GROUP_TITLE, fontSize: textStep.body }}>{group}</h3>
            {SHORTCUTS.filter((entry) => entry.group === group).map((entry) => (
              <div key={entry.id} data-testid="shortcut-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 36 }}>
                <span style={words(textStep.body, 400, t.text)}>{entry.label}</span>
                {/* Synth 09: the key in a 24-tall Raised box, radius 6, mono 13. */}
                <kbd style={{ ...COUNT, margin: 0, display: "inline-flex", alignItems: "center", height: 24, padding: "0 8px", boxSizing: "border-box", borderRadius: 6, background: t.control, color: t.text }}>{mac ? entry.mac : entry.other}</kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
    </SmallWindow>
  );
}

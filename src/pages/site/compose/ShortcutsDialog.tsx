/* CA-20 P8: "Keyboard shortcuts": every key of the build page, a group at a time. A 560 window; the rows are 36 tall with the keys
   at the right, in the data face. */

import { useIsPhone } from "@/components/shell/useMinWidth";
import { SHORTCUT_COPY, SHORTCUT_GROUPS, SHORTCUTS, isMac } from "@/lib/build/shortcuts";
import { t } from "@/lib/theme/tokens";

import { COUNT, GROUP_TITLE, RecipeButton } from "./modalRecipes";
import { words } from "./referencePieces";
import { SmallWindow } from "./removePieces";

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const phone = useIsPhone();
  const mac = isMac();
  return (
    <SmallWindow
      open={open}
      onClose={onClose}
      title={SHORTCUT_COPY.title}
      width={560}
      testId="shortcuts-window"
      buttons={
        <RecipeButton small={!phone} phone={phone} onClick={onClose}>
          {SHORTCUT_COPY.done}
        </RecipeButton>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "60vh", overflowY: "auto" }}>
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group} aria-label={group}>
            <h3 style={{ ...GROUP_TITLE, fontSize: 13 }}>{group}</h3>
            {SHORTCUTS.filter((entry) => entry.group === group).map((entry) => (
              <div key={entry.id} data-testid="shortcut-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 36, borderBottom: `1px solid ${t.hairline}` }}>
                <span style={words(13, 400, t.text)}>{entry.label}</span>
                <kbd style={{ ...COUNT, margin: 0 }}>{mac ? entry.mac : entry.other}</kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
    </SmallWindow>
  );
}

/* CA-23 P4: "{Name} changed in another tab", a 560 window of the modal recipes.

   Under the title one grey line of 12.5 (`--text2`) says where the version that is not kept goes. Two panels sit side by side,
   12 apart, each a well with a 1px `--hairline-module` and radius 10, padding 12 14: the label at 12 `--label` ("This tab · 20:41",
   "Other tab · 20:42"), then the text at 13/19 `--text`; a tile with several fields shows only the fields that differ, each under
   its label (12, `--label`). The footer has "Use other tab's" (secondary) and "Keep this tab's" (primary). It cannot be dismissed:
   a clash is settled one way or the other. A sheet on a phone, the panels one above the other. */

import { useIsPhone } from "@/components/shell/useMinWidth";
import { CLASH_COPY, type ClashView, type PanelField } from "@/lib/build/clashView";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { RecipeButton } from "./modalRecipes";
import { RecipeWindow } from "./saveWindows";

const PANEL = { boxSizing: "border-box", minWidth: 0, flex: "1 1 0", padding: "12px 14px", background: t.well, border: `1px solid ${t.hairlineModule}`, borderRadius: 10, display: "flex", flexDirection: "column", gap: 8 } as const;
const LABEL = { fontFamily: FIGTREE, fontSize: 12, fontWeight: 400, lineHeight: "16px", color: t.label, margin: 0 } as const;
const TEXT = { fontFamily: FIGTREE, fontSize: 13, fontWeight: 400, lineHeight: "19px", color: t.text, margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" } as const;

function Panel({ label, fields, testId }: { label: string; fields: readonly PanelField[]; testId: string }) {
  return (
    <section aria-label={label} data-testid={testId} style={PANEL}>
      <p style={LABEL}>{label}</p>
      {fields.map((field, at) => (
        <div key={at} data-testid="clash-field" style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          {field.label ? <p style={LABEL}>{field.label}</p> : null}
          <p style={TEXT}>{field.text}</p>
        </div>
      ))}
    </section>
  );
}

export function ClashWindow({ view, onUseOther, onKeepThis, busy = false }: { view: ClashView | null; onUseOther: () => void; onKeepThis: () => void; busy?: boolean }) {
  const phone = useIsPhone();
  return (
    <RecipeWindow
      open={view !== null}
      onClose={() => undefined}
      title={view?.title ?? ""}
      note={CLASH_COPY.body}
      small
      testId="clash-window"
      width={560}
      buttons={
        <>
          <RecipeButton small={!phone} phone={phone} disabled={busy} data-testid="clash-use-other" onClick={onUseOther}>
            {CLASH_COPY.useOther}
          </RecipeButton>
          <RecipeButton variant="primary" small={!phone} phone={phone} disabled={busy} data-testid="clash-keep-this" onClick={onKeepThis}>
            {CLASH_COPY.keepThis}
          </RecipeButton>
        </>
      }
    >
      {view ? (
        <div style={{ display: "flex", flexDirection: phone ? "column" : "row", gap: 12, minWidth: 0 }}>
          <Panel label={view.mineLabel} fields={view.mine} testId="clash-mine" />
          <Panel label={view.theirsLabel} fields={view.theirs} testId="clash-theirs" />
        </div>
      ) : null}
    </RecipeWindow>
  );
}

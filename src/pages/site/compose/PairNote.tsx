/* CA-02 P8, CA-18 P2: a saved pair that breaks the rules, said in the window that changes the model.

   One quiet line and one text button, for a tool and model saved together that the tool's rules do not allow. Only the maker
   sees it; nothing changes until they press the button. An unknown tool or model says nothing. */

import { harnessTool, pairCheck } from "@/lib/tools/modelRules";
import { toolName } from "@/lib/tools/registry";
import { t } from "@/lib/theme/tokens";

import { TextButton } from "./composeControls";
import { text } from "./refinedStyles";

export const PAIR_COPY = {
  notOffered: (tool: string, model: string) => `${tool} doesn't offer ${model}.`,
  runsNoModel: (tool: string) => `${tool} doesn't run a model.`,
  hidesModel: (tool: string) => `${tool} doesn't show which model it used.`,
  change: "Change the model",
  remove: "Remove the model",
} as const;

/**
 * One quiet line and one text button, for a tool and model saved together that the tool's rules do not allow. Only
 * the maker sees Details, so only the maker sees it; nothing changes until they press the button. An unknown tool
 * or model says nothing.
 */
export function PairNote({ tool, model, phone, onChange, onRemove }: { tool: string | null | undefined; model: string | null | undefined; phone: boolean; onChange: () => void; onRemove: () => void }) {
  const check = pairCheck(tool, model);
  if (check !== "not-offered" && check !== "tool-runs-no-model" && check !== "tool-hides-model") return null;
  const name = toolName(tool) ?? (tool ?? "").trim();
  const line = check === "not-offered" ? PAIR_COPY.notOffered(name, (model ?? "").trim()) : check === "tool-runs-no-model" ? PAIR_COPY.runsNoModel(name) : PAIR_COPY.hidesModel(name);
  return (
    <div data-testid="pair-note" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <span style={text(12, 400, t.text2)}>{line}</span>
      <TextButton target={phone} underline style={text(12, 500, t.text)} onClick={check === "not-offered" ? onChange : onRemove}>
        {check === "not-offered" ? PAIR_COPY.change : PAIR_COPY.remove}
      </TextButton>
    </div>
  );
}


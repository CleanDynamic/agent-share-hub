// SV-30 P9: the one line above a Code tile's code: what it belongs to and where it runs, in --label. Nothing when neither is set.

import type { CSSProperties } from "react";

import { partLine } from "@/lib/build/codePart";
import { t } from "@/lib/theme/tokens";
import { text } from "./refinedStyles";
import type { Step } from "@/lib/build/graph";

export function CodePartLine({ step, style }: { step: Pick<Step, "partOf" | "runsWhere">; style?: CSSProperties }) {
  const line = partLine(step);
  if (!line) return null;
  return (
    <span data-testid="code-part-line" style={{ ...text(12, 400, t.label), ...style }}>
      {line}
    </span>
  );
}

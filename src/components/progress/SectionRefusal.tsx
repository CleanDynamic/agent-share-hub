// RC-P27 — a progress section whose read failed: STATES.md row 21.
//
// One sentence, "You don't have access to this." for a refusal and "Something
// went wrong." for anything else, and a secondary "Try again": transparent,
// the 1px --line border, 44 tall, the same block YOUR BUILDS draws
// ⟦law-of-similarity⟧. Never a level of 1, a week at nothing or a row of
// unearned badges that nobody measured.

import { Button } from "@/components/ui/button";
import { isPermissionError } from "@/lib/errors/permission";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body } from "@/lib/theme/type";

export interface SectionRefusalProps {
  error: unknown;
  onRetry: () => void;
  "data-testid": string;
}

export function SectionRefusal({ error, onRetry, "data-testid": testId }: SectionRefusalProps) {
  return (
    <div
      data-testid={testId}
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs }}
    >
      <p style={{ ...body, color: t.text, margin: 0 }}>
        {isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}
      </p>
      <Button type="button" variant="outline" onClick={onRetry} style={{ background: "transparent", minHeight: 44 }}>
        Try again
      </Button>
    </div>
  );
}

export default SectionRefusal;

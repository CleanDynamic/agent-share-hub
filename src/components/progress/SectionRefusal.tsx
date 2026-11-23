// RC-P27 — a progress section whose read failed: STATES.md row 21.
//
// One sentence, "You don't have access to this." for a refusal and "Something went wrong." for anything else, and a
// secondary "Try again" (Synth 15: the secondary recipe). Never a level of 1, a week at nothing or a row of
// unearned badges that nobody measured.

import { Button } from "@/components/ui/button";
import { isPermissionError } from "@/lib/errors/permission";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, textStep } from "@/lib/theme/type";

export interface SectionRefusalProps {
  error: unknown;
  onRetry: () => void;
  "data-testid": string;
}

export function SectionRefusal({ error, onRetry, "data-testid": testId }: SectionRefusalProps) {
  return (
    <div data-testid={testId} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <p style={{ fontFamily: FIGTREE, fontSize: textStep.body, lineHeight: "20px", color: t.text, margin: 0 }}>
        {isPermissionError(error) ? "You don't have access to this." : "Something went wrong."}
      </p>
      <Button type="button" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export default SectionRefusal;

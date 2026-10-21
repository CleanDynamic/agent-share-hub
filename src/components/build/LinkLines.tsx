/* CA-13 rule 4 — the quiet lines that join code to what it sets up: "Calls Decision 'team' (Jev)" on a Code tile that a
   decision names, and "Defines agent 'Kitchen agent'" on one an agent is defined in. Each is a link to the other tile. */

import { TextButton } from "@/pages/site/compose/composeControls";
import { t } from "@/lib/theme/tokens";
import { text } from "@/pages/site/compose/refinedStyles";

export function LinkLines({ lines, onOpen, indent = 0 }: { lines: readonly { id: string; label: string }[]; onOpen?: (id: string) => void; indent?: number }) {
  if (lines.length === 0) return null;
  return (
    <div data-testid="link-lines" style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: indent }}>
      {lines.map((line) =>
        onOpen ? (
          <TextButton key={line.id} underline onClick={(event) => { event.stopPropagation(); onOpen(line.id); }} style={{ ...text(12, 400, t.label), alignSelf: "flex-start", textAlign: "left" }}>
            {line.label}
          </TextButton>
        ) : (
          <span key={line.id} style={text(12, 400, t.label)}>{line.label}</span>
        ),
      )}
    </div>
  );
}

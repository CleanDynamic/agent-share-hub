/* CA-20 P6: "Recently removed", a 480 window of the modal recipes (a sheet on a phone).

   The head says "Recently removed" with "Kept until you leave this page" under it. The rows are newest first, 44 tall, with
   `--hairline` rules between them, as the reference's Logs list is: the thing's badge (its number, "S2", "B", or a file's glyph),
   its name at 13/500, what it held at 13 `--text2` (" · 3 tiles"), at the right how long ago at 12.5 `--text2`, then Restore. Clearing
   the build is one row, "The whole build". Nothing removed: "Nothing removed during this visit." The footer says that after leaving
   the page removed things are gone, and has Done. */

import { useEffect, useState } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { REMOVED_COPY, agoLine, type RemovedEntry } from "@/lib/build/removedLog";
import { t } from "@/lib/theme/tokens";

import { ModalShell } from "./ModalFrame";
import { FOOT_NOTE, LABEL, RecipeButton, bodyStyle, footerStyle } from "./modalRecipes";
import { Badge, ELLIPSIS, words } from "./referencePieces";

export function RecentlyRemovedDialog({ open, entries, onRestore, onClose }: { open: boolean; entries: readonly RemovedEntry[]; onRestore: (id: string) => void; onClose: () => void }) {
  const phone = useIsPhone();
  // How long ago moves on while the window is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 20_000);
    return () => window.clearInterval(timer);
  }, [open]);
  return (
    <ModalShell open={open} onOpenChange={(next) => !next && onClose()} title={REMOVED_COPY.title} subtitle={REMOVED_COPY.subtitle} width={480} testId="recently-removed-window">
      <div style={bodyStyle(phone)}>
        {entries.length === 0 ? (
          <p data-testid="removed-empty" style={{ ...LABEL, margin: 0, padding: "20px" }}>
            {REMOVED_COPY.empty}
          </p>
        ) : (
          <ul aria-label={REMOVED_COPY.title} style={{ listStyle: "none", margin: 0, padding: "0 20px", display: "flex", flexDirection: "column", minWidth: 0 }}>
            {entries.map((entry, at) => (
              <li
                key={entry.id}
                data-testid="removed-row"
                style={{ boxSizing: "border-box", height: phone ? 56 : 44, display: "flex", alignItems: "center", gap: 12, minWidth: 0, borderTop: at === 0 ? undefined : `1px solid ${t.hairline}` }}
              >
                <Badge>{typeof entry.badge === "string" ? entry.badge : <Glyph name={entry.badge.glyph} size={14} />}</Badge>
                <span style={{ ...ELLIPSIS, flexGrow: 1, display: "flex", alignItems: "baseline", gap: 0 }}>
                  <span style={words(13, 500, t.text)}>{entry.name}</span>
                  {entry.detail ? <span style={words(13, 400, t.text2)}>{` · ${entry.detail}`}</span> : null}
                </span>
                <span style={{ ...words(12.5, 400, t.text2), whiteSpace: "nowrap", flexShrink: 0 }}>{agoLine(entry.at, now)}</span>
                <RecipeButton small={!phone} phone={phone} aria-label={`${REMOVED_COPY.restore} ${entry.name}`} data-testid="removed-restore" onClick={() => onRestore(entry.id)}>
                  {REMOVED_COPY.restore}
                </RecipeButton>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={footerStyle(phone)}>
        <span style={FOOT_NOTE}>{REMOVED_COPY.note}</span>
        <RecipeButton variant="primary" small={!phone} phone={phone} onClick={onClose}>
          {REMOVED_COPY.done}
        </RecipeButton>
      </div>
    </ModalShell>
  );
}


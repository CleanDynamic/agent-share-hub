// AltSheet: a picture's description, from its ALT badge (CA-07 P7).
//
// A sheet up from the bottom of the window: Image description, the maker's words, and Dismiss. Esc closes it too, and
// focus goes back to the badge. A Radix dialog, so focus stays inside while it is open.

import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";

import { Button } from "@/components/brand/Button";
import { t } from "@/lib/theme/tokens";
import { dialogTitle, text } from "@/pages/site/compose/refinedStyles";

export const ALT_SHEET_COPY = { title: "Image description", dismiss: "Dismiss" } as const;

export interface AltSheetProps {
  /** The description, or null while the sheet is closed. */
  alt: string | null;
  /** Where focus goes back to. */
  returnTo: HTMLElement | null;
  onClose: () => void;
}

export function AltSheet({ alt, returnTo, onClose }: AltSheetProps) {
  // Kept past the close: the caller clears returnTo with alt.
  const back = useRef<HTMLElement | null>(null);
  if (returnTo) back.current = returnTo;
  return (
    <Dialog.Root open={alt !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 70 }} />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid="alt-sheet"
          onClick={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            back.current?.focus();
          }}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 71,
            maxHeight: "70dvh",
            overflowY: "auto",
            boxSizing: "border-box",
            padding: "20px 16px 24px",
            background: t.window,
            borderTop: `1px solid ${t.windowBorder}`,
            borderRadius: "12px 12px 0 0",
            boxShadow: t.sheetShadow,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <Dialog.Title style={{ ...dialogTitle, margin: 0 }}>{ALT_SHEET_COPY.title}</Dialog.Title>
            <p style={{ ...text(15, 400, t.text), margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{alt}</p>
            <Button variant="secondary" size={44} fontSize={14} fullWidth onClick={onClose}>
              {ALT_SHEET_COPY.dismiss}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default AltSheet;

// The phone's window (UI-P19, centred since Synth 09): a real dialog, pinned to the centre of the screen like every
// window on a computer. (Its name is kept from when it rose from the bottom edge.)
//
// Built on `@radix-ui/react-dialog`, so focus is trapped, Escape closes and the
// page behind is inert. It takes the window recipe: `--window`, a 1px
// `--window-border`, radius 12, `--sheet-shadow`, over `--scrim`, no blur;
// 16 from the screen's sides, at most the screen's height less 16 above and
// below (clear of the notch and the home indicator), scrolling on its own. A
// visible Close control (an `IconButton`) closes it, as Escape and a tap on the
// scrim do. The title is required: it is the dialog's accessible name, and may
// be visually hidden.
//
// 9 between its parts, 12 around them, the title 15px.

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { useWindowFocus } from "@/lib/focus/windowFocus";
import { IconButton } from "@/components/brand/IconButton";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";

/** How far the window stands in from the screen's edges. */
export const SHEET_EDGE = 16;

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: the dialog's accessible name. */
  title: string;
  /** Hide the visible title (the name stays). */
  hideTitle?: boolean;
  children?: ReactNode;
}

export function BottomSheet({ open, onOpenChange, title, hideTitle = false, children }: BottomSheetProps) {
  const focus = useWindowFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-motion="scrim" style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 40 }} />
        <Dialog.Content
          data-testid="bottom-sheet"
          aria-describedby={undefined}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 41,
            display: "flex",
            flexDirection: "column",
            gap: 9,
            width: `calc(100vw - ${2 * SHEET_EDGE}px)`,
            maxHeight: `calc(100dvh - ${2 * SHEET_EDGE}px - env(safe-area-inset-top) - env(safe-area-inset-bottom))`,
            overflowY: "auto",
            overscrollBehavior: "contain",
            boxSizing: "border-box",
            /* No padding at the foot: a footer pinned to the bottom of the scroll sits on the window's edge, with nothing under it. */
            padding: "12px 12px 0",
            borderRadius: 12,
            background: t.window,
            border: `1px solid ${t.windowBorder}`,
            boxShadow: t.sheetShadow,
            color: t.text,
            fontFamily: FIGTREE,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9 }}>
            <Dialog.Title
              style={
                hideTitle
                  ? VISUALLY_HIDDEN
                  : { margin: 0, fontFamily: FIGTREE, fontSize: 15, fontWeight: 500, color: t.text }
              }
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} glyph="x" label={`Close ${title}`} size={32} style={{ marginLeft: "auto" }} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default BottomSheet;

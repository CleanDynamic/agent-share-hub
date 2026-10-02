// The bottom sheet (UI-P19): a real dialog that rises from the bottom edge.
//
// Built on `@radix-ui/react-dialog`, so focus is trapped, Escape closes and the
// page behind is inert. The overlay is `--sheet-dim`; the sheet is `--solid`
// with a 1px `--glass-border` top edge and `--shadow-sheet`, radius 22px 22px
// 0 0, padded to clear the home indicator, at most 88dvh tall and scrolling on
// its own. A grabber (40×5, `--line`) sits centred at the top: dragging it down
// more than 80px closes the sheet. A visible Close control (an `IconButton`) is
// there for keyboard and pointer users who do not drag. The title is required —
// it is the dialog's accessible name — and may be visually hidden.
//
// NOTHING BLURS: the sheet is solid on purpose; only the header and dock blur.

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";

/** A downward drag of more than this many px on the grabber closes the sheet. */
export const SHEET_DRAG_CLOSE_PX = 80;

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
  const start = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    start.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return;
    setDrag(Math.max(0, event.clientY - start.current));
  };
  const onUp = () => {
    const far = drag > SHEET_DRAG_CLOSE_PX;
    start.current = null;
    setDrag(0);
    if (far) onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.sheetDim, zIndex: 40 }} />
        <Dialog.Content
          data-testid="bottom-sheet"
          aria-describedby={undefined}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 41,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxHeight: "88dvh",
            overflowY: "auto",
            boxSizing: "border-box",
            padding: "10px 16px calc(24px + env(safe-area-inset-bottom))",
            borderRadius: "22px 22px 0 0",
            background: t.solid,
            borderTop: `1px solid ${t.glassBorder}`,
            boxShadow: t.shadowSheet,
            color: t.text,
            fontFamily: FIGTREE,
            transform: drag ? `translateY(${drag}px)` : undefined,
          }}
        >
          <div
            data-testid="sheet-grabber"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{ alignSelf: "center", padding: "6px 24px", touchAction: "none", cursor: "grab" }}
          >
            <div style={{ width: 40, height: 5, borderRadius: 3, background: t.line }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Dialog.Title
              style={
                hideTitle
                  ? VISUALLY_HIDDEN
                  : { margin: 0, fontFamily: FIGTREE, fontSize: 16, fontWeight: 600, color: t.text }
              }
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" size={44} style={{ marginLeft: "auto" }} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default BottomSheet;

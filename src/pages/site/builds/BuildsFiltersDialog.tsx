/* BF-06 (A1): the one Filters dialog, the same in Table, Maps and Classification. Pure: it frames what it is given.

   Framed as `SetDialogs.tsx` frames its own (Radix `Dialog` used directly, the refined tokens): the overlay `--sheet-dim` at
   z 40, the content `--solid` with the glass border, the panel radius and the sheet shadow at z 41. 820 by 640 at most and
   centred on a desktop; the whole screen on a phone. Three rows: the header (the title and Close), the body that scrolls,
   and the footer (Done unless another is given). Escape, Close and Done close it, and Radix returns focus to the button
   that opened it. */

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, display } from "@/lib/theme/type";

import { BuildsControl } from "./BuildsFrame";

export interface BuildsFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Absent: a right-aligned Done. */
  footer?: ReactNode;
  /** Drawn in the header between the title and Close (BF-07: the search and the order control). */
  headerExtra?: ReactNode;
}

/** The content's frame. Exported because jsdom drops `min()` and `dvh` from an inline style, so the test reads it here. */
export const dialogFrame = (phone: boolean): CSSProperties => ({
  position: "fixed",
  zIndex: 41,
  boxSizing: "border-box",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto",
  background: t.solid,
  boxShadow: t.shadowSheet,
  color: t.text,
  fontFamily: FIGTREE,
  ...(phone
    ? { inset: 0, borderRadius: 0, border: 0 }
    : {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(820px, calc(100vw - 28px))",
        height: "min(640px, calc(100dvh - 28px))",
        borderRadius: r.panel,
        border: `1px solid ${t.glassBorder}`,
      }),
});

export function BuildsFiltersDialog({ open, onOpenChange, children, footer, headerExtra }: BuildsFiltersDialogProps) {
  const phone = useIsPhone();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.sheetDim, zIndex: 40 }} />
        <Dialog.Content data-testid="builds-filters-dialog" style={dialogFrame(phone)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: `1px solid ${t.hairline}` }}>
            <Dialog.Title style={{ ...display(22), margin: 0, color: t.text }}>Filters</Dialog.Title>
            <Dialog.Description style={VISUALLY_HIDDEN}>Choose which builds are shown.</Dialog.Description>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12 }}>{headerExtra}</div>
            <Dialog.Close asChild>
              <IconButton icon={X} label="Close" size={38} />
            </Dialog.Close>
          </div>
          <div style={{ overflowY: "auto", padding: "0 16px" }}>{children}</div>
          <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.hairline}` }}>
            {footer ?? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Dialog.Close asChild>
                  <BuildsControl>Done</BuildsControl>
                </Dialog.Close>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* CA-18 P5: Details in a window too narrow to hold it beside the build.

   From 768 up to where Details fits (about 1244): a 360-wide panel over the right of the page, opened by a click on a tile, closed by its
   button or Escape, not modal. Clicking what is in it opens the tile's window, except Copy, a link, Read all and the close button.
   Its foot reads "Click to edit". On a phone the same content sits in the "Details" sheet with "Tap to edit".
   Where Details fits beside the build none of this is drawn: there is no foot and a click on the content does nothing. */

import { X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { t } from "@/lib/theme/tokens";

import { OVERLAY_EDGE, OVERLAY_FOOT_COPY, OVERLAY_FOOT_PAD, OVERLAY_PAD, OVERLAY_WIDTH } from "./detailsRecipes";
import { text } from "./refinedStyles";

/** What a click on the content must not take as "edit": the controls inside it. */
const CONTROLS = "button, a, input, select, textarea, [role='button'], [role='menuitem']";

/** The content, clickable as a whole to open the window, with the foot that says so. */
export function ClickToEdit({ onEdit, phone, pad = 0, children }: { onEdit?: () => void; phone: boolean; pad?: number; children: ReactNode }) {
  if (!onEdit) return <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: pad }}>{children}</div>;
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(CONTROLS)) return;
    onEdit();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && event.target === event.currentTarget) onEdit();
  };
  return (
    <>
      <div data-testid="details-clickable" tabIndex={0} onClick={onClick} onKeyDown={onKeyDown} style={{ cursor: "pointer", outline: "none", flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: pad }}>
        {children}
      </div>
      <p data-testid="details-foot" style={{ ...text(12, 400, t.label), margin: 0, padding: OVERLAY_FOOT_PAD, borderTop: `1px solid ${t.hairline}`, flex: "0 0 auto" }}>
        {phone ? OVERLAY_FOOT_COPY.tap : OVERLAY_FOOT_COPY.click}
      </p>
    </>
  );
}

export interface DetailsOverlayProps {
  /** The selected tile's key; a new one opens the panel. */
  selectedKey: string | null | undefined;
  /** The tab row's rule: the panel sits 8 below it. */
  below: RefObject<HTMLElement>;
  onEdit?: () => void;
  children: ReactNode;
}

export function DetailsOverlay({ selectedKey, below, onEdit, children }: DetailsOverlayProps) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(OVERLAY_EDGE);
  const returnTo = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selectedKey) {
      setOpen(false);
      return;
    }
    const active = document.activeElement;
    returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
    setOpen(true);
  }, [selectedKey]);

  useEffect(() => {
    if (!open) return;
    const place = () => setTop(Math.max(52, Math.round(below.current?.getBoundingClientRect().bottom ?? 52)) + OVERLAY_EDGE);
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, below]);

  function close() {
    setOpen(false);
    returnTo.current?.focus?.({ preventScroll: true });
  }

  if (!open || !selectedKey) return null;
  const style: CSSProperties = {
    position: "fixed",
    top,
    right: OVERLAY_EDGE,
    bottom: OVERLAY_EDGE,
    width: OVERLAY_WIDTH,
    zIndex: 15,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    background: t.module,
    border: `1px solid ${t.windowBorder}`,
    borderRadius: 8,
    boxShadow: t.windowShadow,
    overflow: "hidden",
  };
  return (
    <section ref={panel} aria-label="Details" data-testid="details-overlay" style={style}>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: `${OVERLAY_EDGE}px ${OVERLAY_EDGE}px 0` }}>
        <IconButton icon={X} glyph="x" boxed={false} label="Close details" size={26} onClick={close} />
      </div>
      <ClickToEdit onEdit={onEdit} phone={false} pad={OVERLAY_PAD}>
        {children}
      </ClickToEdit>
    </section>
  );
}

export default DetailsOverlay;

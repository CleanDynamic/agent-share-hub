// The round create button (29d): the only control on the phone that creates. 56 round, Mint, a 24 plus in Page colour, 16 from
// the right edge and 16 above the dock. A tap opens the New sheet; a press held for 500ms opens a new build directly, with a
// light haptic in the native app. On Home it slides away with the bars and comes back with them. Hidden while the keyboard is open.

import { useEffect, useRef, type PointerEvent } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { PHONE_DOCK, PHONE_FAB, PHONE_FAB_HOLD_MS, PHONE_FAB_SHADOW, PHONE_MARGIN } from "@/components/shell/chromeSize";
import { useBarsHidden } from "@/components/shell/phoneBars";
import { hapticLight } from "@/components/feed/haptics";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { phoneSlide, phoneSlideOpacity } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { useKeyboardOpen } from "./useKeyboardInset";

export interface CreateButtonProps {
  /** A tap: opens the New sheet. */
  onTap: () => void;
  /** A press held for 500ms: a new build. */
  onHold: () => void;
  /** The sheet it opens is open. */
  expanded?: boolean;
}

export function CreateButton({ onTap, onHold, expanded = false }: CreateButtonProps) {
  const keyboard = useKeyboardOpen();
  const away = useBarsHidden();
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const stop = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  if (keyboard) return null;

  const down = (event: PointerEvent<HTMLButtonElement>) => {
    handlers.onPointerDown(event);
    held.current = false;
    stop();
    timer.current = setTimeout(() => {
      timer.current = null;
      held.current = true;
      hapticLight();
      onHold();
    }, PHONE_FAB_HOLD_MS);
  };

  return (
    <button
      data-motion="bar"
      type="button"
      aria-label="New"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      data-testid="create-button"
      data-away={away ? "" : undefined}
      {...handlers}
      onPointerDown={down}
      onPointerUp={(event) => {
        handlers.onPointerUp(event);
        stop();
      }}
      onPointerCancel={(event) => {
        handlers.onPointerCancel(event);
        stop();
      }}
      onPointerLeave={stop}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        // The press that already opened a new build must not also open the sheet.
        if (held.current) {
          held.current = false;
          return;
        }
        onTap();
      }}
      style={{
        position: "fixed",
        right: PHONE_MARGIN,
        bottom: `calc(${PHONE_DOCK}px + env(safe-area-inset-bottom) + ${PHONE_MARGIN}px)`,
        zIndex: 25,
        boxSizing: "border-box",
        width: PHONE_FAB,
        height: PHONE_FAB,
        borderRadius: r.full,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border: 0,
        background: t.brandAccent,
        color: t.bg,
        boxShadow: PHONE_FAB_SHADOW,
        cursor: "pointer",
        touchAction: "manipulation",
        WebkitTouchCallout: "none",
        userSelect: "none",
        transform: away ? `translateY(${PHONE_FAB + PHONE_MARGIN}px)` : "translateY(0)",
        transition: phoneSlide(),
        opacity: phoneSlideOpacity(away),
        ...ring(state.focusVisible),
      }}
    >
      <MobileIcon name="new" size={24} strokeWidth={2.4} />
    </button>
  );
}

export default CreateButton;

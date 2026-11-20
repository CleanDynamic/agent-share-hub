// SV-26 P2: the header's account button, the avatar that opens the account menu. Its own small module so the header can
// draw it at once while the menu (and the menu library under it) loads apart, in `AccountMenu`. The same button is the
// menu's trigger once the menu is here, so nothing on screen changes when it arrives.

import { ChevronDown } from "lucide-react";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

import type { FrameViewer } from "./frameTypes";

export interface AccountButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  viewer: FrameViewer;
  avatarSize: number;
}

export const AccountButton = forwardRef<HTMLButtonElement, AccountButtonProps>(function AccountButton(
  { viewer, avatarSize, onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel, ...rest },
  ref,
) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({ onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel });
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Open account menu"
      {...rest}
      {...handlers}
      style={{ boxSizing: "border-box", width: 44, height: 32, padding: 0, border: 0, background: "transparent", borderRadius: r.control, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: t.text2, flexShrink: 0, ...ring(state.focusVisible), outlineColor: state.focusVisible ? t.brandAccent : undefined }}
    >
      <Avatar size={avatarSize} userId={viewer.id} name={viewer.name} hue={viewer.hue} src={viewer.avatarUrl} />
      <ChevronDown size={8} aria-hidden="true" />
    </button>
  );
});

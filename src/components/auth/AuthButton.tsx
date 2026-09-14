import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { buttonSlot, buttonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { FIGTREE } from "@/lib/theme/type";

interface AuthButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  type?: "submit" | "button";
}

/**
 * The one primary action on an auth card, on BG-P07's primary button.
 *
 * WHAT CHANGED AND WHY. The fill was a `#E8571A → #C44514` gradient, which is
 * the legacy orange and a shape this system does not have: a primary button is
 * a flat `--action` fill with an `--on-action` label, measured at 5.65:1 on
 * Exhibition and 6.35:1 on Dusk. The 10px radius is `--r-control`. Hover is
 * `buttonStyle`'s measured brightness step and 1px lift rather than a 1%
 * scale — a scale on a 48px control blurs its own text for the duration — and
 * it is gated on a fine pointer by `useInteractive`, so a tap on a phone no
 * longer leaves the button lit.
 *
 * `data-visual-slot="btn-primary"` marks this as a reserved primary surface
 * (`neoscale-ui` RULE 3), the same mark `ui/button.tsx` carries, and the kit's
 * style object is spread FIRST so a visual component dropped in later wins.
 */
export function AuthButton({
  children,
  onClick,
  disabled = false,
  isLoading = false,
  loadingText,
  type = "submit",
}: AuthButtonProps) {
  const isDisabled = disabled || isLoading;
  const { state, handlers } = useInteractive<HTMLButtonElement>(
    {},
    { disabled: isDisabled },
  );

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      data-visual-slot={buttonSlot("default")}
      {...handlers}
      style={{
        ...buttonStyle("default", state),
        height: "48px",
        width: "100%",
        marginTop: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontFamily: FIGTREE,
        fontSize: "14px",
        fontWeight: 600,
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {isLoading && <Loader2 size={18} className="animate-spin" />}
      {isLoading ? loadingText || children : children}
    </button>
  );
}

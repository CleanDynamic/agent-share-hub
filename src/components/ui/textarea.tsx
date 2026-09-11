import * as React from "react";

import { cn } from "@/lib/utils";
import { fieldStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P07 — the textarea. The same field treatment as `input.tsx`, for the same
   reasons; see that file for the full note on `--recess`, `aria-invalid` and
   the placeholder.

   `min-h-[80px]` and every padding stay where they are: this is a repaint.
   ──────────────────────────────────────────────────────────────────────────── */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      style,
      disabled,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
      onPointerDown,
      onPointerUp,
      onPointerCancel,
      ...props
    },
    ref,
  ) => {
    const { state, handlers } = useInteractive<HTMLTextAreaElement>(
      { onMouseEnter, onMouseLeave, onFocus, onBlur, onPointerDown, onPointerUp, onPointerCancel },
      { disabled },
    );

    const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-[color:var(--text2)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        disabled={disabled}
        style={{ ...fieldStyle({ ...state, invalid }), ...style }}
        {...props}
        {...handlers}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };

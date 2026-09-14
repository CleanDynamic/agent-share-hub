import { useState } from "react";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";

import { fieldMessageStyle, fieldStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { eyebrow, FIGTREE } from "@/lib/theme/type";

export interface InputValidation {
  state: "idle" | "checking" | "valid" | "invalid";
  message?: string;
}

interface AuthInputProps {
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  helperText?: string;
  validation?: InputValidation;
  showPasswordToggle?: boolean;
  required?: boolean;
  autoComplete?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
   The auth field, on BG-P07's field treatment. The props are unchanged: this
   component's API is what every auth card calls, and a restyle that moved it
   would be a rewrite of six cards for no visual gain.

   `fieldStyle()` is the whole paint — `--recess` well, `--line` hairline,
   `--action` once focused, `--cat-breakage` when invalid — and it is the same
   object `ui/input.tsx` spends, so a field here and a field in the workspace
   are one control rather than two that resemble each other.

   TWO FOCUS FACTS, NOT ONE. A mouse click brightens the border to `--action`;
   only a keyboard focus adds the ring. That is why `focused` and `keyboardFocus`
   are separate states rather than one: `fieldStyle` takes `focusVisible` for
   the ring, and the resting-border override below is what keeps the pointer
   case looking the way it always has.

   THE iOS RULE IS UNTOUCHED. `index.css` forces 16px on every `input` below
   768px so mobile Safari does not zoom the viewport on focus and never zoom
   back. Nothing here sets a font size that could outrank it — the 14px below is
   the desktop size, and the `!important` in the stylesheet wins on the phone.
   ──────────────────────────────────────────────────────────────────────────── */

export function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  helperText,
  validation,
  showPasswordToggle = false,
  required = false,
  autoComplete,
}: AuthInputProps) {
  const [focused, setFocused] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputType = showPasswordToggle ? (showPassword ? "text" : "password") : type;
  const invalid = validation?.state === "invalid";

  const labelStyle = {
    ...eyebrow,
    color: t.text2,
    paddingBottom: "6px",
    display: "block",
  };

  const inputContainerStyle = {
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
  };

  const inputStyle = {
    ...fieldStyle({ invalid, focusVisible: keyboardFocus }),
    /* A pointer focus keeps the accent border it has always had; only the ring
       above is reserved for the keyboard. Invalid outranks both. */
    ...(focused && !invalid ? { borderColor: t.action } : null),
    height: "48px",
    width: "100%",
    padding: showPasswordToggle || validation ? "0 44px 0 14px" : "0 14px",
    fontFamily: FIGTREE,
    fontSize: "14px",
    fontWeight: 400,
  };

  /* The placeholder, which is the one thing an inline style cannot reach. The
     rule already existed; only its colour moved, onto the token that means
     "absent content" everywhere else in the kit. */
  const placeholderStyle = `
    .auth-input::placeholder {
      color: var(--text2);
      font-family: Figtree, sans-serif;
      font-size: 14px;
      font-weight: 400;
    }
  `;

  /* The four declarations this always had, with the colour on a token. `display`
     and `alignItems` are deliberately NOT added: the validation icon is a
     static span whose box this prompt has no reason to change, and adding a
     layout property to an existing element is the thing the review rules
     forbid. The reveal below is the one control whose box does move, and it
     moves for a stated accessibility reason. */
  const iconStyle = {
    position: "absolute" as const,
    right: "14px",
    color: t.text2,
    cursor: showPasswordToggle ? "pointer" : "default",
  };

  /* THE REVEAL'S TARGET, AND WHY IT COSTS NOTHING. The eye was an 18px icon
     with no padding: an 18×18 tap target, well under the 44px floor
     `critique-affordance` sets for touch. The padding takes it to 44×44 and
     `right` comes back by the same amount, so the icon sits on exactly the
     pixel it always did — and the field is 48px tall, so a 44px control inside
     it moves no box. Nothing structural changes; the target that was there all
     along is simply the size of a thumb. */
  const revealStyle = {
    ...iconStyle,
    right: "1px",
    padding: "13px",
    background: "none",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const helperStyle = {
    fontFamily: FIGTREE,
    fontSize: "11px",
    fontWeight: 400,
    fontStyle: "italic" as const,
    color: t.text2,
    marginTop: "6px",
  };

  /* Beneath the field, always — never only a toast. Breakage red is legal as
     text on both grounds (≥4.83 Exhibition, ≥5.75 Dusk), which is what lets the
     message and the border share one token; a confirmation is `--evidence`, the
     token that means "it worked" everywhere else. */
  const validationMessageStyle = {
    ...fieldMessageStyle,
    marginTop: "6px",
    color: validation?.state === "valid" ? t.evidence : t.catBreakage,
  };

  return (
    <div>
      <style>{placeholderStyle}</style>
      <label>
        <span style={labelStyle}>{label}</span>
        <div style={inputContainerStyle}>
          <input
            className="auth-input"
            type={inputType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={inputStyle}
            onFocus={(event) => {
              setFocused(true);
              let visible = true;
              try {
                visible = event.currentTarget.matches(":focus-visible");
              } catch {
                /* :focus-visible unsupported. Show the ring rather than hide it. */
              }
              if (visible) setKeyboardFocus(true);
            }}
            onBlur={() => {
              setFocused(false);
              setKeyboardFocus(false);
              onBlur?.();
            }}
            required={required}
            aria-required={required}
            aria-invalid={validation?.state === "invalid"}
            autoComplete={autoComplete}
          />
          {showPasswordToggle && (
            <button
              type="button"
              style={revealStyle}
              onClick={() => setShowPassword(!showPassword)}
              aria-pressed={showPassword}
              /* `tabIndex={-1}` stood here, which put the ONLY control that can
                 reveal a password outside the tab order — a keyboard-only
                 reader could not operate it at all (WCAG 2.1.1). It is a tab
                 stop now, between the field and whatever follows it; nothing
                 about the field, the form or its submission moves. */
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
          {validation && !showPasswordToggle && (
            <span style={iconStyle}>
              {validation.state === "checking" && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {validation.state === "valid" && (
                <Check size={16} style={{ color: t.evidence }} />
              )}
              {validation.state === "invalid" && (
                <X size={16} style={{ color: t.catBreakage }} />
              )}
            </span>
          )}
        </div>
      </label>
      {helperText && <p style={helperStyle}>{helperText}</p>}
      {validation?.message && (
        <p style={validationMessageStyle}>{validation.message}</p>
      )}
    </div>
  );
}

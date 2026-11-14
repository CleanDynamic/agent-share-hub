/* UI-P36 — the pieces the sign-in, join, reset and verify cards are made of.

   Each one is the reference's own markup: the provider button, the "or with
   email" rule, the field with its icon, the checkbox row and the primary action.
   They are PURE: values and handlers come in as props, nothing here reads the
   router, the session or the network, so the live pages and the compare page
   draw the same thing.

   TWO SIZES, ONE SET. Desktop and phone differ in the numbers the reference
   states (fields 44 and 48, buttons 44/14 and 48/15, the rule's gap and margin),
   so each piece asks `useAuthSizes()` (authSizes.ts) itself, as the page views
   read the breakpoint themselves, and the live page and the compare page behave
   alike.

   THE FIELD'S HEIGHT IS ITS CONTENT BOX. The reference draws `height: 44px` on
   a `<span>` that has a 1px border and no `box-sizing`, so the field is 46 tall
   with its border and 50 on the phone. The app's stylesheet makes everything
   border-box, so the field says `content-box` back, as the Gallery's search does.

   THE INPUT IS TRANSPARENT INSIDE THE BOX. index.css paints every `<input>` with
   a `--recess` fill, a border and a focus outline, all `!important`, which no
   inline style can beat. As the header's search does, the input switches those
   off with Tailwind's own important utilities (generated utilities, not new CSS
   classes) and the box carries the border and the focus ring instead. The
   placeholder is a pseudo-element, which only a utility can reach. */

import { useId, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Check, Eye, EyeOff, Github, X, type LucideIcon } from "lucide-react";

import type { InputValidation } from "@/components/auth/AuthInput";
import { GoogleIcon, XIcon, type OAuthProvider } from "@/components/auth/OAuthButtons";
import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { InlineLoader } from "@/components/brand/InlineLoader";
import { useRoom } from "@/components/brand/useRoom";
import { checkboxStyle, ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { DIALOG, useAuthSizes } from "./authSizes";
import { PendingRing } from "./PendingRing";
import { SIGNIN_COLOURS } from "./signinColours";

/** A fixed vertical space in the dialog's form column: 4, 8, 16 or 24 (G3), and nothing else. */
export function Gap({ size }: { size: 4 | 8 | 16 | 24 }) {
  return <div aria-hidden="true" style={{ height: size, flexShrink: 0 }} />;
}

/** The flexible space above the primary: at least 24, and whatever the column has left, so the primary sits on the bottom padding line. */
export function PushDown() {
  return <div aria-hidden="true" style={{ flex: "1 0 24px" }} />;
}

/** The dialog's field label and divider words: 11px mono in a 16 line. */
const MONO_LINE: CSSProperties = { fontFamily: DM_MONO, fontSize: 11, fontWeight: 400, lineHeight: `${DIALOG.line}px`, height: DIALOG.line };

/**
 * A view's heading in the dialog (Reference A, other views): the title at 16 / 500 and, 8 below it, one or two lines of
 * 13px helper text. The words are each state's existing words.
 */
export function ViewHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div data-testid="signin-view-heading" style={{ flexShrink: 0 }}>
      <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 16, fontWeight: 500, lineHeight: "20px", color: t.text }}>{title}</h2>
      {children ? <p style={{ margin: "8px 0 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text2 }}>{children}</p> : null}
    </div>
  );
}

/* ── providers ── */

/* G12: while a provider is opening, its button shows the ring and says so: "Opening Google" and the like. */
const PROVIDERS: readonly { id: OAuthProvider; label: string; opening: string; mark: ReactNode }[] = [
  { id: "google", label: "Continue with Google", opening: "Opening Google", mark: <GoogleIcon size={16} /> },
  { id: "github", label: "Continue with GitHub", opening: "Opening GitHub", mark: <Github size={16} strokeWidth={1.6} aria-hidden="true" /> },
  { id: "x", label: "Continue with X", opening: "Opening X", mark: <XIcon size={16} /> },
];

export interface ProviderButtonsProps {
  onProvider: (provider: OAuthProvider) => void;
  /** The one that was clicked and has not answered: it shows a spinner and every button waits. */
  loadingProvider: OAuthProvider | null;
}

/** One button per provider, as siblings of the card's column, so the card's gap is the reference's. */
export function ProviderButtons({ onProvider, loadingProvider }: ProviderButtonsProps) {
  const sizes = useAuthSizes();
  /* Under the refined look a labelled button carries no icon: the words name the provider. A spinner stays, it is state. */
  const buttons = (
    <>
      {PROVIDERS.map((provider) => (
        <Button
          key={provider.id}
          variant="secondary"
          size={sizes.provider}
          fontSize={sizes.providerFont}
          fullWidth
          disabled={loadingProvider !== null}
          onClick={() => onProvider(provider.id)}
          style={{ gap: 7 }}
        >
          {loadingProvider === provider.id ? <PendingRing /> : null}
          {loadingProvider === provider.id ? provider.opening : provider.label}
        </Button>
      ))}
    </>
  );
  /* In the dialog the three are one column, 8 apart; on a phone they stay siblings of the card's column. */
  return sizes.phone ? buttons : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{buttons}</div>;
}

/* ── the rule ── */

/** Two hairlines either side of a mono eyebrow: "or with email". */
export function OrRule({ children }: { children: ReactNode }) {
  const sizes = useAuthSizes();
  const line = { flexGrow: 1, height: 1, background: t.line } as const;
  if (!sizes.phone) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: sizes.ruleGap, height: DIALOG.line }}>
        <span aria-hidden="true" style={line} />
        <span style={{ ...MONO_LINE, color: t.text2, whiteSpace: "nowrap" }}>{children}</span>
        <span aria-hidden="true" style={line} />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: sizes.ruleGap, margin: sizes.ruleMargin }}>
      <span aria-hidden="true" style={line} />
      <Eyebrow size={10}>{children}</Eyebrow>
      <span aria-hidden="true" style={line} />
    </div>
  );
}

/* ── messages ── */

const MESSAGE = { margin: 0, fontFamily: FIGTREE, fontSize: 12, lineHeight: 1.4 } as const;

/**
 * One sentence under whatever it is about, announced politely.
 *
 * THE REGION IS ALWAYS THERE, EMPTY WHEN THERE IS NOTHING TO SAY. A live region
 * that arrives with its text in it is not announced by every reader; one that
 * already exists and is then filled is. An empty one has no margin and no height.
 */
export function FieldMessage({
  id,
  children,
  tone = "error",
  reserve = false,
}: {
  id?: string;
  children?: ReactNode;
  tone?: "error" | "good";
  /** The dialog's error line: always 16 high and 4 below what it is about, empty until there is something to say, so nothing moves when it fills. */
  reserve?: boolean;
}) {
  return (
    <p
      id={id}
      aria-live="polite"
      data-testid="field-message"
      style={{
        ...MESSAGE,
        ...(reserve ? { marginTop: 4, height: DIALOG.line, lineHeight: `${DIALOG.line}px`, whiteSpace: "nowrap" } : { marginTop: children ? 4 : 0 }),
        color: tone === "good" ? t.evidence : t.catBreakage,
      }}
    >
      {children}
    </p>
  );
}

/* ── the field ── */

/** Switches off what index.css paints on a raw input; the box around it draws the field. */
const INPUT_CLASS =
  "placeholder:text-[color:var(--text2)] !bg-transparent !border-0 focus-visible:!outline-none focus-visible:!border-0";

export interface AuthFieldProps {
  label: string;
  icon: LucideIcon;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** A quiet line under the field: the address a username will have. */
  helperText?: string;
  /** What the field's value has been checked against; its message is shown under it. */
  validation?: InputValidation;
  /** An error that belongs to this field, shown under it. */
  error?: string;
  /** A password field the reader may reveal. */
  showPasswordToggle?: boolean;
  required?: boolean;
  autoComplete?: string;
  /** In the dialog: keep the 16px message line under the field whether or not it has anything in it. */
  reserveMessage?: boolean;
}

export function AuthField({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  helperText,
  validation,
  error,
  showPasswordToggle = false,
  required = false,
  autoComplete,
  reserveMessage = false,
}: AuthFieldProps) {
  const sizes = useAuthSizes();
  const [focused, setFocused] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const messageId = useId();

  const invalid = Boolean(error) || validation?.state === "invalid";
  const message = error || validation?.message;
  const confirmed = !error && validation?.state === "valid";

  return (
    <div>
      <label style={{ display: "flex", flexDirection: "column", gap: sizes.phone ? 5 : 8 }}>
        {sizes.phone ? (
          <Eyebrow size={10} as="span">
            {label}
          </Eyebrow>
        ) : (
          <Eyebrow as="span" style={{ ...MONO_LINE, letterSpacing: 0 }}>
            {label}
          </Eyebrow>
        )}
        <span
          data-testid="auth-field-box"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            height: sizes.field,
            /* In the dialog the field is 32 with its border; a phone's keeps its 44 content box. */
            boxSizing: sizes.phone ? "content-box" : "border-box",
            padding: sizes.phone ? "0 10px" : "0 12px",
            borderRadius: r.control,
            background: t.field,
            border: `1px solid ${invalid ? t.catBreakage : focused ? t.action : t.line}`,
            color: t.text2,
            fontFamily: FIGTREE,
            fontSize: 13,
            ...ring(focusVisible),
          }}
        >
          <Icon size={16} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />
          <input
            className={INPUT_CLASS}
            type={showPasswordToggle ? (revealed ? "text" : "password") : type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            required={required}
            aria-label={label}
            aria-required={required}
            aria-invalid={invalid}
            aria-describedby={message ? messageId : undefined}
            autoComplete={autoComplete}
            onFocus={(event) => {
              setFocused(true);
              // Where :focus-visible is unsupported the ring is shown rather than hidden.
              let visible = true;
              try {
                visible = event.currentTarget.matches(":focus-visible");
              } catch {
                /* keep the ring */
              }
              setFocusVisible(visible);
            }}
            onBlur={() => {
              setFocused(false);
              setFocusVisible(false);
              onBlur?.();
            }}
            style={{
              flexGrow: 1,
              minWidth: 0,
              background: "transparent",
              border: 0,
              outline: "none",
              fontFamily: FIGTREE,
              fontSize: 13,
              color: t.text,
            }}
          />
          {showPasswordToggle ? (
            <button
              type="button"
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              onClick={() => setRevealed((shown) => !shown)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                /* A 44px target around a 16px icon on a phone (36 above it, as the
                   tightened board), pulled back so the icon sits where the field's own
                   padding would put it and the box does not grow. */
                width: sizes.phone ? 44 : 32,
                height: sizes.phone ? 44 : DIALOG.control - 2,
                margin: sizes.phone ? "0 -14px 0 -8px" : "0 -8px 0 -4px",
                padding: 0,
                border: 0,
                background: "transparent",
                color: t.text2,
                cursor: "pointer",
              }}
            >
              {revealed ? <EyeOff size={16} strokeWidth={1.6} aria-hidden="true" /> : <Eye size={16} strokeWidth={1.6} aria-hidden="true" />}
            </button>
          ) : validation && validation.state !== "idle" ? (
            <span aria-hidden="true" style={{ display: "flex", flexShrink: 0 }}>
              {validation.state === "checking" ? <InlineLoader size={16} label="Checking the username" /> : null}
              {validation.state === "valid" ? <Check size={16} strokeWidth={1.6} style={{ color: t.evidence }} /> : null}
              {validation.state === "invalid" ? <X size={16} strokeWidth={1.6} style={{ color: t.catBreakage }} /> : null}
            </span>
          ) : null}
        </span>
      </label>
      {helperText ? (
        <p style={{ ...MESSAGE, marginTop: 4, fontStyle: "normal", color: t.text2 }}>{helperText}</p>
      ) : null}
      <FieldMessage id={messageId} tone={confirmed ? "good" : "error"} reserve={reserveMessage && !sizes.phone}>
        {message}
      </FieldMessage>
    </div>
  );
}

/* ── the checkbox row ── */

export interface AuthCheckProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

/**
 * "Keep me signed in" and "I agree to the Terms".
 *
 * The real control is an `sr-only` input inside a wrapper that also holds the
 * box drawn in its place, so the label is `label[for] > div`: a click on the
 * box ticks it, and the words (which may carry links) are not the target. That
 * is the shape the join form's spec clicks, so it is kept. The label takes a
 * 28px target and gives the 12px back in negative margin, so the row stays the
 * height the reference draws.
 */
export function AuthCheck({ id, checked, onChange, children }: AuthCheckProps) {
  const [focusVisible, setFocusVisible] = useState(false);
  const { phone } = useAuthSizes();
  const room = useRoom();
  /* In the dialog the row is 24 high and the label fills it; a phone keeps the 28px target in a 19px line. */
  const tick = phone ? t.action : SIGNIN_COLOURS[room].primary;
  return (
    <label
      htmlFor={id}
      data-hit=""
      style={{
        display: "flex",
        alignItems: "center",
        gap: phone ? 6 : 8,
        padding: phone ? "6px 0" : 0,
        margin: phone ? "-6px 0" : 0,
        height: phone ? undefined : DIALOG.row,
        cursor: "pointer",
        fontFamily: FIGTREE,
        fontSize: 12,
        /* The reference's row is 19px tall (a 13px box and its margins): a native
           checkbox the density pass does not touch, so the row keeps 19. */
        lineHeight: phone ? "19px" : `${DIALOG.row}px`,
        color: t.text2,
      }}
    >
      <div style={{ position: "relative" }}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="sr-only"
          onFocus={(event) => {
            let visible = true;
            try {
              visible = event.currentTarget.matches(":focus-visible");
            } catch {
              /* keep the ring */
            }
            setFocusVisible(visible);
          }}
          onBlur={() => setFocusVisible(false)}
        />
        <div
          style={{
            ...checkboxStyle({ focusVisible }),
            width: 16,
            height: 16,
            /* The kit's 8px chip radius makes a 16px box a circle, which reads as a
               radio; 5px is the radius the reference draws on its 16px marks. */
            borderRadius: 5,
            background: checked ? tick : t.recess,
            borderColor: checked ? tick : t.line,
            color: phone ? t.onAction : SIGNIN_COLOURS[room].onPrimary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : null}
        </div>
      </div>
      <span>{children}</span>
    </label>
  );
}

/* ── the primary action ── */

export interface PrimaryActionProps {
  children: ReactNode;
  /** What it says while the request is out. */
  loadingText?: string;
  loading?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}

/** The one primary action of a card: 46/15 on desktop, a full-width 48/15 on a phone. */
export function PrimaryAction({ children, loadingText, loading = false, disabled = false, type = "submit", onClick }: PrimaryActionProps) {
  const sizes = useAuthSizes();
  if (!sizes.phone) {
    return (
      <DialogPrimary type={type} disabled={disabled || loading} onClick={onClick}>
        {loading ? <PendingRing /> : null}
        {loading ? (loadingText ?? children) : children}
      </DialogPrimary>
    );
  }
  return (
    <Button
      variant="primary"
      size={sizes.primary}
      fontSize={13}
      fullWidth
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <PendingRing /> : null}
      {loading ? (loadingText ?? children) : children}
    </Button>
  );
}

/**
 * The dialog's primary (D5): the prototype's green with black ink, a colour change on hover and never an opacity fade.
 * Local to the sign-in dialog, so no other primary on the site changes. 432 wide by the column, 32 high.
 */
export function DialogPrimary({
  children,
  type = "submit",
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const room = useRoom();
  const colours = SIGNIN_COLOURS[room];
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  const fill = state.hovered && !disabled ? colours.primaryHover : colours.primary;
  return (
    <button
      data-ui="button"
      data-variant="signin-primary"
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...handlers}
      style={{
        boxSizing: "border-box",
        width: "100%",
        height: DIALOG.control,
        flexShrink: 0,
        padding: "0 12px",
        borderRadius: r.control,
        border: `1px solid ${fill}`,
        background: fill,
        color: colours.onPrimary,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

/** A form that is a column of the card's own rhythm, and says what it sends. In the dialog it fills the form column, so its primary can sit on the bottom padding line. */
export function AuthForm({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  const sizes = useAuthSizes();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  if (!sizes.phone) {
    return (
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0, margin: 0 }}>
        {children}
      </form>
    );
  }
  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: sizes.gap, margin: 0 }}>
      {children}
    </form>
  );
}

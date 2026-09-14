import { Loader2, Github } from "lucide-react";
import type { ReactNode } from "react";

import { buttonSlot, buttonStyle } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { FIGTREE } from "@/lib/theme/type";

export type OAuthProvider = "google" | "github" | "x";

/* THE PROVIDER MARKS ARE UNTOUCHED, DELIBERATELY. Google's four-colour G and
   X's wordmark are other companies' trademarks, reproduced under brand
   guidelines that specify their colours exactly; repainting either onto a
   buildgallery token would be both off-brand for them and legally wrong. They
   are the one place on these pages where a raw hex is correct. GitHub's mark is
   monochrome by its own guidelines and takes `currentColor`, which is now
   `--text` — the same thing it has always been, one token later. */

// Google G Icon SVG
function GoogleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// X (Twitter) Logo SVG
function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface OAuthButtonProps {
  label: string;
  mark: ReactNode;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

/**
 * One provider button, on BG-P07's SECONDARY treatment: `--glass` fill,
 * `--line` hairline, `--text` label.
 *
 * A SECONDARY, NOT A THIRD TREATMENT. These three sit directly above the card's
 * one primary action, and the theme allows exactly one primary per view — so
 * the question is not what colour they should be but which rung of the existing
 * ladder they are on, and "another way to do the same thing as the button
 * below" is the definition of a secondary. `--glass` here is a translucent
 * FILL and not a blur: this button is inside a blurred card, and a second
 * blurred layer inside the first is the nesting the theme forbids.
 *
 * Each button owns its own interactive state, which is why this is a component
 * rather than three copies of a style object with three sets of mouse handlers
 * — the version this replaces wrote hover colours straight onto `currentTarget`,
 * so a button hovered while its sibling was loading kept the hover paint.
 */
function OAuthButton({ label, mark, loading, disabled, onClick }: OAuthButtonProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });

  return (
    <button
      type="button"
      data-visual-slot={buttonSlot("secondary")}
      {...handlers}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        ...buttonStyle("secondary", state),
        height: "48px",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        fontFamily: FIGTREE,
        fontSize: "13px",
        fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : mark}
      <span>{label}</span>
    </button>
  );
}

interface OAuthButtonsProps {
  onOAuthClick: (provider: OAuthProvider) => void;
  loadingProvider: OAuthProvider | null;
}

export function OAuthButtons({ onOAuthClick, loadingProvider }: OAuthButtonsProps) {
  const providers: { id: OAuthProvider; label: string; mark: ReactNode }[] = [
    { id: "google", label: "Continue with Google", mark: <GoogleIcon /> },
    { id: "github", label: "Continue with GitHub", mark: <Github size={18} /> },
    { id: "x", label: "Continue with X", mark: <XIcon /> },
  ];

  return (
    <div className="flex flex-col" style={{ gap: "8px" }}>
      {providers.map((provider) => (
        <OAuthButton
          key={provider.id}
          label={provider.label}
          mark={provider.mark}
          loading={loadingProvider === provider.id}
          disabled={loadingProvider !== null}
          onClick={() => onOAuthClick(provider.id)}
        />
      ))}
    </div>
  );
}

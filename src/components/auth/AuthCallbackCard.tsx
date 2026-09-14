import { Loader2 } from "lucide-react";

import { AuthButton } from "./AuthButton";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { cardTitle, FIGTREE } from "@/lib/theme/type";

interface AuthCallbackCardProps {
  state: "pending" | "failed";
  provider?: "google" | "github" | "x";
  onBackToSignIn?: () => void;
}

const providerNames: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  x: "X",
};

/**
 * The OAuth return. Two states, and the theme's colour for each: pending is
 * `--text2`, because a wait is not an outcome and colouring it would make the
 * reader think something had already happened; failure is `--cat-breakage`.
 *
 * Each state says what happens next in one plain sentence, which is the whole
 * job of a card a reader lands on without having asked for it.
 */
export function AuthCallbackCard({
  state,
  provider,
  onBackToSignIn,
}: AuthCallbackCardProps) {
  const headingStyle = { ...cardTitle, marginTop: "20px", color: t.text };
  const bodyStyle = {
    marginTop: "6px",
    fontFamily: FIGTREE,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.55,
    color: t.text2,
  };

  return (
    <div className="flex flex-col items-center text-center">
      {state === "pending" ? (
        <>
          <Loader2
            className="animate-spin"
            style={{
              width: "56px",
              height: "56px",
              color: t.text2,
              strokeWidth: 2.5,
            }}
          />
          <h2 style={headingStyle}>Signing you in…</h2>
          <p style={bodyStyle}>
            We&apos;re confirming your account with{" "}
            {provider ? providerNames[provider] : "your provider"}. This takes a
            moment, and buildgallery opens on its own when it&apos;s done.
          </p>
        </>
      ) : (
        <>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: r.full,
              backgroundColor: tokenAlpha("cat-breakage", 0.1),
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: tokenAlpha("cat-breakage", 0.28),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke={t.catBreakage}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 style={headingStyle}>Couldn&apos;t complete sign-in</h2>
          <p style={bodyStyle}>
            Something went wrong with{" "}
            {provider ? providerNames[provider] : "the provider"}. Go back and
            try again, or sign in with a different provider — nothing was
            created.
          </p>
          <div style={{ width: "100%", marginTop: "12px" }}>
            <AuthButton type="button" onClick={onBackToSignIn}>
              Back to sign in
            </AuthButton>
          </div>
        </>
      )}
    </div>
  );
}

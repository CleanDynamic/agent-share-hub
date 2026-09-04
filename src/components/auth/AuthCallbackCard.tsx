import { Loader2 } from "lucide-react";

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

export function AuthCallbackCard({
  state,
  provider,
  onBackToSignIn,
}: AuthCallbackCardProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {state === "pending" ? (
        <>
          <Loader2
            className="animate-spin"
            style={{
              width: "56px",
              height: "56px",
              color: "#E8571A",
              strokeWidth: 2.5,
            }}
          />
          <h2
            style={{
              marginTop: "20px",
              fontFamily: "Figtree, sans-serif",
              fontSize: "16px",
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.92)",
            }}
          >
            Signing you in…
          </h2>
          <p
            style={{
              marginTop: "6px",
              fontFamily: "Figtree, sans-serif",
              fontSize: "13px",
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.60)",
            }}
          >
            Just a moment while we verify your account.
          </p>
        </>
      ) : (
        <>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "0.5px solid rgba(239, 68, 68, 0.20)",
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
              stroke="#EF4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2
            style={{
              marginTop: "20px",
              fontFamily: "Figtree, sans-serif",
              fontSize: "16px",
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.92)",
            }}
          >
            Couldn&apos;t complete sign-in
          </h2>
          <p
            style={{
              marginTop: "6px",
              fontFamily: "Figtree, sans-serif",
              fontSize: "13px",
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.60)",
            }}
          >
            Something went wrong with {provider ? providerNames[provider] : "the provider"}. Please try again.
          </p>
          <button
            onClick={onBackToSignIn}
            style={{
              marginTop: "20px",
              width: "100%",
              height: "44px",
              borderRadius: "10px",
              backgroundColor: "#E8571A",
              border: "none",
              fontFamily: "Figtree, sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              color: "#FFFFFF",
              cursor: "pointer",
              transition: "background-color 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D14E17")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E8571A")}
          >
            Back to sign in
          </button>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

import { AuthButton } from "./AuthButton";
import { prefersReducedMotion } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { cardTitle, FIGTREE } from "@/lib/theme/type";

interface AuthEmailErrorCardProps {
  onResend: () => void;
  onBackToSignIn: () => void;
}

/**
 * A dead verification link. `--cat-breakage` is the token for something that
 * stopped working, and a stale link is exactly that — the copy stays a prompt
 * rather than a reprimand, because nothing the reader did caused it.
 */
export function AuthEmailErrorCard({
  onResend,
  onBackToSignIn,
}: AuthEmailErrorCardProps) {
  const [still] = useState(prefersReducedMotion);
  const [showIcon, setShowIcon] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowIcon(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const shown = still || showIcon;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Error Icon */}
      <div
        style={{
          transform: shown ? "scale(1)" : "scale(0.6)",
          opacity: shown ? 1 : 0,
          transition: still
            ? undefined
            : "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease",
        }}
      >
        <AlertCircle
          style={{
            width: "56px",
            height: "56px",
            color: t.catBreakage,
            strokeWidth: 1.5,
          }}
        />
      </div>

      <h2 style={{ ...cardTitle, marginTop: "20px", color: t.text }}>
        This link doesn&apos;t work
      </h2>

      <p
        style={{
          marginTop: "8px",
          fontFamily: FIGTREE,
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: 1.55,
          color: t.text2,
        }}
      >
        It may have expired or been used already. Send a new link and we&apos;ll
        email another one straight away — your account is still there.
      </p>

      <div style={{ width: "100%", marginTop: "16px" }}>
        <AuthButton type="button" onClick={onResend}>
          Send a new link
        </AuthButton>
      </div>

      <button
        onClick={onBackToSignIn}
        style={{
          marginTop: "6px",
          background: "none",
          border: "none",
          padding: "6px 0",
          fontFamily: FIGTREE,
          fontSize: "13px",
          fontWeight: 500,
          color: t.action,
          cursor: "pointer",
          textDecoration: "underline",
          textUnderlineOffset: "4px",
          textDecorationThickness: "1px",
        }}
      >
        Back to sign in
      </button>
    </div>
  );
}

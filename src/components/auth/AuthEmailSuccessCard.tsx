import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { AuthButton } from "./AuthButton";
import { prefersReducedMotion } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { cardTitle, FIGTREE } from "@/lib/theme/type";

interface AuthEmailSuccessCardProps {
  onContinue: () => void;
}

/**
 * Verification succeeded. `--evidence` is the token for that everywhere in this
 * system — it is the colour of a reproduction that worked, and a confirmed
 * email is the same claim about a smaller thing.
 */
export function AuthEmailSuccessCard({ onContinue }: AuthEmailSuccessCardProps) {
  const [still] = useState(prefersReducedMotion);
  const [showIcon, setShowIcon] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowIcon(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const shown = still || showIcon;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Success Icon */}
      <div
        style={{
          transform: shown ? "scale(1)" : "scale(0.6)",
          opacity: shown ? 1 : 0,
          transition: still
            ? undefined
            : "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease",
        }}
      >
        <CheckCircle2
          style={{
            width: "56px",
            height: "56px",
            color: t.evidence,
            strokeWidth: 1.5,
          }}
        />
      </div>

      <h2 style={{ ...cardTitle, marginTop: "20px", color: t.text }}>
        You&apos;re in
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
        Your email is confirmed and your account is active. Continue and
        buildgallery picks up where you left off.
      </p>

      <div style={{ width: "100%", marginTop: "16px" }}>
        <AuthButton type="button" onClick={onContinue}>
          Continue to buildgallery
        </AuthButton>
      </div>
    </div>
  );
}

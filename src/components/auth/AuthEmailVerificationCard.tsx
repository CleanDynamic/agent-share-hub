import { Mail } from "lucide-react";

export type ResendState = "idle" | "sending" | "sent" | "cooldown";

interface AuthEmailVerificationCardProps {
  email: string;
  onResend: () => void;
  resendState: ResendState;
  cooldownSeconds?: number;
  onChangeEmail: () => void;
}

export function AuthEmailVerificationCard({
  email,
  onResend,
  resendState,
  cooldownSeconds = 0,
  onChangeEmail,
}: AuthEmailVerificationCardProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Icon Container */}
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          backgroundColor: "rgba(232, 87, 26, 0.08)",
          border: "0.5px solid rgba(232, 87, 26, 0.20)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "iconEntrance 320ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        }}
      >
        <Mail
          style={{
            width: "56px",
            height: "56px",
            color: "#E8571A",
            strokeWidth: 1.5,
          }}
        />
      </div>

      <h2
        style={{
          marginTop: "20px",
          fontFamily: "Inter, sans-serif",
          fontSize: "18px",
          fontWeight: 700,
          color: "rgba(255, 255, 255, 0.95)",
        }}
      >
        Check your inbox
      </h2>

      <p
        style={{
          marginTop: "8px",
          fontFamily: "Inter, sans-serif",
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: 1.55,
          color: "rgba(255, 255, 255, 0.60)",
          textAlign: "center",
        }}
      >
        We sent a verification link to{" "}
        <span style={{ color: "rgba(255, 255, 255, 0.85)" }}>{email}</span>. Tap it to activate your account.
      </p>

      {/* Resend Section */}
      <div
        style={{
          marginTop: "20px",
          paddingTop: "16px",
          borderTop: "0.5px solid rgba(255, 255, 255, 0.10)",
          width: "100%",
        }}
      >
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            fontWeight: 400,
            color: "rgba(255, 255, 255, 0.45)",
            textAlign: "center",
          }}
        >
          Didn&apos;t get the email?
        </p>

        {resendState === "sent" ? (
          <p
            style={{
              marginTop: "8px",
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              color: "#22C55E",
              textAlign: "center",
            }}
          >
            Resent ✓ — check your inbox
          </p>
        ) : resendState === "cooldown" ? (
          <p
            style={{
              marginTop: "8px",
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              color: "rgba(255, 255, 255, 0.45)",
              textAlign: "center",
            }}
          >
            Resend available in {cooldownSeconds}s
          </p>
        ) : (
          <button
            onClick={onResend}
            disabled={resendState === "sending"}
            style={{
              marginTop: "8px",
              background: "none",
              border: "none",
              padding: 0,
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              color: resendState === "sending" ? "rgba(232, 87, 26, 0.5)" : "#E8571A",
              cursor: resendState === "sending" ? "default" : "pointer",
              transition: "opacity 150ms ease",
              display: "block",
              width: "100%",
            }}
          >
            {resendState === "sending" ? "Sending…" : "Resend verification"}
          </button>
        )}
      </div>

      {/* Change Email */}
      <p
        style={{
          marginTop: "16px",
          fontFamily: "Inter, sans-serif",
          fontSize: "12px",
          fontWeight: 400,
          color: "rgba(255, 255, 255, 0.45)",
        }}
      >
        Wrong email?{" "}
        <button
          onClick={onChangeEmail}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            fontWeight: 400,
            color: "#E8571A",
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          }}
        >
          Sign up again
        </button>
      </p>

      <style>{`
        @keyframes iconEntrance {
          from {
            transform: scale(0.6);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

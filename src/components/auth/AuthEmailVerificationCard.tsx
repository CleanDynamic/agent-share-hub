import { Mail } from "lucide-react";

import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { cardTitle, FIGTREE } from "@/lib/theme/type";

export type ResendState = "idle" | "sending" | "sent" | "cooldown";

interface AuthEmailVerificationCardProps {
  email: string;
  onResend: () => void;
  resendState: ResendState;
  cooldownSeconds?: number;
  onChangeEmail: () => void;
}

/**
 * "Check your inbox" — the card a reader lands on after signing up.
 *
 * PENDING IS `--text2`, NOT AN ACCENT. Nothing has succeeded here and nothing
 * has failed; the account exists and the reader has to go somewhere else to
 * finish. Painting the mail mark in the accent would put the loudest thing on
 * the card on the state that is waiting, which is the opposite of what the
 * reader needs to see (`visual-hierarchy`). The quiet `--recess` disc with a
 * `--line` edge is the pending treatment the reset and callback cards share.
 *
 * A CONFIRMED RESEND IS `--evidence`, which is the token that means "it worked"
 * everywhere else in this system.
 */
export function AuthEmailVerificationCard({
  email,
  onResend,
  resendState,
  cooldownSeconds = 0,
  onChangeEmail,
}: AuthEmailVerificationCardProps) {
  const linkStyle = {
    background: "none",
    border: "none",
    padding: 0,
    fontFamily: FIGTREE,
    color: t.action,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: "4px",
    textDecorationThickness: "1px",
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* Icon Container */}
      <div
        data-bg-animated
        style={{
          width: "80px",
          height: "80px",
          borderRadius: r.full,
          backgroundColor: t.recess,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: t.line,
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
            color: t.text2,
            strokeWidth: 1.5,
          }}
        />
      </div>

      <h2 style={{ ...cardTitle, marginTop: "20px", color: t.text }}>
        Check your inbox
      </h2>

      <p
        style={{
          marginTop: "8px",
          fontFamily: FIGTREE,
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: 1.55,
          color: t.text2,
          textAlign: "center",
        }}
      >
        We sent a verification link to{" "}
        <span style={{ color: t.text }}>{email}</span>. Open it and your account
        is active — you can close this page.
      </p>

      {/* Resend Section */}
      <div
        style={{
          marginTop: "20px",
          paddingTop: "16px",
          borderTopWidth: "0.5px",
          borderTopStyle: "solid",
          borderTopColor: t.line,
          width: "100%",
        }}
      >
        <p
          style={{
            fontFamily: FIGTREE,
            fontSize: "12px",
            fontWeight: 400,
            color: t.text2,
            textAlign: "center",
          }}
        >
          Didn&apos;t get the email?
        </p>

        {resendState === "sent" ? (
          <p
            style={{
              marginTop: "8px",
              fontFamily: FIGTREE,
              fontSize: "13px",
              fontWeight: 500,
              color: t.evidence,
              textAlign: "center",
            }}
          >
            Sent again — it should arrive in a minute.
          </p>
        ) : resendState === "cooldown" ? (
          <p
            style={{
              marginTop: "8px",
              fontFamily: FIGTREE,
              fontSize: "13px",
              fontWeight: 500,
              color: t.text2,
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
              ...linkStyle,
              marginTop: "8px",
              /* A standalone control, so it carries its own target rather than
                 the 16px its text happens to be. */
              padding: "6px 0",
              fontSize: "13px",
              fontWeight: 500,
              cursor: resendState === "sending" ? "default" : "pointer",
              opacity: resendState === "sending" ? 0.5 : 1,
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
          fontFamily: FIGTREE,
          fontSize: "12px",
          fontWeight: 400,
          color: t.text2,
        }}
      >
        Wrong email?{" "}
        <button onClick={onChangeEmail} style={{ ...linkStyle, fontSize: "12px" }}>
          Sign up again
        </button>
      </p>
    </div>
  );
}

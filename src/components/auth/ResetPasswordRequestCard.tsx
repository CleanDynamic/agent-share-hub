import { Link } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { AuthInput } from "./AuthInput";
import { AuthButton } from "./AuthButton";
import { fieldMessageStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { cardTitle, FIGTREE } from "@/lib/theme/type";

export interface ResetPasswordRequestCardProps {
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  /** Inline error shown below the form (e.g. server / network error). */
  error?: string;
}

export function ResetPasswordRequestCard({
  email,
  onEmailChange,
  onSubmit,
  isSubmitting,
  error,
}: ResetPasswordRequestCardProps) {
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const isFormValid = email.trim().length > 0;

  return (
    <AuthShell>
      <h2 style={{ ...cardTitle, margin: 0, color: t.text }}>
        Reset your password
      </h2>
      <p
        style={{
          marginTop: "8px",
          marginBottom: "20px",
          fontFamily: FIGTREE,
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: 1.55,
          color: t.text2,
        }}
      >
        Enter your email and we&apos;ll send a link that lets you set a new
        password. The link works once and expires after an hour.
      </p>

      <form onSubmit={handleFormSubmit}>
        <AuthInput
          label="Email"
          type="email"
          value={email}
          onChange={onEmailChange}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        {error && (
          /* Under the field it is about, never only a toast. */
          <p
            role="alert"
            style={{ ...fieldMessageStyle, marginTop: "14px", textAlign: "center" }}
          >
            {error}
          </p>
        )}

        <AuthButton
          type="submit"
          disabled={!isFormValid}
          isLoading={isSubmitting}
          loadingText="Sending..."
        >
          Send reset link
        </AuthButton>
      </form>

      <div
        style={{
          marginTop: "20px",
          textAlign: "center",
          fontFamily: FIGTREE,
          fontSize: "12px",
          fontWeight: 400,
          color: t.text2,
        }}
      >
        <Link
          to="/login"
          style={{
            display: "inline-block",
            padding: "6px 0",
            color: t.action,
            textDecoration: "underline",
            textUnderlineOffset: "4px",
            textDecorationThickness: "1px",
          }}
        >
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}

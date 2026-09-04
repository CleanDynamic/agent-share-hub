import { Link } from "react-router-dom";
import { AuthShell } from "./AuthShell";
import { AuthInput } from "./AuthInput";
import { AuthButton } from "./AuthButton";

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
      <h2
        style={{
          margin: 0,
          fontFamily: "Figtree, sans-serif",
          fontSize: "18px",
          fontWeight: 700,
          color: "rgba(255, 255, 255, 0.95)",
        }}
      >
        Reset your password
      </h2>
      <p
        style={{
          marginTop: "8px",
          marginBottom: "20px",
          fontFamily: "Figtree, sans-serif",
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: 1.55,
          color: "rgba(255, 255, 255, 0.60)",
        }}
      >
        Enter your email and we&apos;ll send you a link to reset your password.
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
          <p
            style={{
              marginTop: "14px",
              fontFamily: "Figtree, sans-serif",
              fontSize: "12px",
              fontWeight: 400,
              color: "#ef4444",
              textAlign: "center",
            }}
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
          fontFamily: "Figtree, sans-serif",
          fontSize: "12px",
          fontWeight: 400,
          color: "rgba(255, 255, 255, 0.55)",
        }}
      >
        <Link to="/login" style={{ color: "#E8571A", textDecoration: "none" }}>
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}

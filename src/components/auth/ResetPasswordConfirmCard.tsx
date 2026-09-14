import { AuthShell } from "./AuthShell";
import { AuthInput } from "./AuthInput";
import { AuthButton } from "./AuthButton";
import {
  PasswordStrengthMeter,
  type PasswordStrength,
} from "./PasswordStrengthMeter";
import { fieldMessageStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { cardTitle, FIGTREE } from "@/lib/theme/type";

export interface ResetPasswordConfirmCardProps {
  password: string;
  confirmPassword: string;
  passwordStrength: PasswordStrength;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  /** Inline error shown below the confirm field (e.g. passwords don't match). */
  mismatchError?: string;
  /** General submit error shown below the form (e.g. server error). */
  error?: string;
}

export function ResetPasswordConfirmCard({
  password,
  confirmPassword,
  passwordStrength,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  isSubmitting,
  mismatchError,
  error,
}: ResetPasswordConfirmCardProps) {
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const isFormValid = password.length >= 8 && confirmPassword.length > 0;

  return (
    <AuthShell>
      <h2 style={{ ...cardTitle, margin: 0, color: t.text }}>
        Choose a new password
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
        Your reset link is valid. Set a new password below and we&apos;ll sign
        you in with it.
      </p>

      <form onSubmit={handleFormSubmit}>
        <div className="flex flex-col" style={{ gap: "16px" }}>
          <div>
            <AuthInput
              label="New password"
              value={password}
              onChange={onPasswordChange}
              placeholder="At least 8 characters"
              showPasswordToggle
              required
              autoComplete="new-password"
            />
            {password && <PasswordStrengthMeter strength={passwordStrength} />}
          </div>

          <div>
            <AuthInput
              label="Confirm password"
              value={confirmPassword}
              onChange={onConfirmPasswordChange}
              placeholder="Re-enter your password"
              showPasswordToggle
              required
              autoComplete="new-password"
            />
            {mismatchError && (
              <p role="alert" style={{ ...fieldMessageStyle, marginTop: "6px" }}>
                {mismatchError}
              </p>
            )}
          </div>
        </div>

        {error && (
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
          loadingText="Updating..."
        >
          Update password
        </AuthButton>
      </form>
    </AuthShell>
  );
}

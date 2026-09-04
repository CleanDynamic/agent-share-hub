import { useState } from "react";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";

export interface InputValidation {
  state: "idle" | "checking" | "valid" | "invalid";
  message?: string;
}

interface AuthInputProps {
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  helperText?: string;
  validation?: InputValidation;
  showPasswordToggle?: boolean;
  required?: boolean;
  autoComplete?: string;
}

export function AuthInput({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  helperText,
  validation,
  showPasswordToggle = false,
  required = false,
  autoComplete,
}: AuthInputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const inputType = showPasswordToggle ? (showPassword ? "text" : "password") : type;

  const labelStyle = {
    fontFamily: "Figtree, sans-serif",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "rgba(255, 255, 255, 0.55)",
    paddingBottom: "6px",
    display: "block",
  };

  const inputContainerStyle = {
    position: "relative" as const,
    display: "flex",
    alignItems: "center",
  };

  const inputStyle = {
    height: "48px",
    width: "100%",
    background: "rgba(82, 82, 100, 0.50)",
    border: focused
      ? "1px solid #E8571A"
      : validation?.state === "invalid"
      ? "1px solid #ef4444"
      : "0.5px solid rgba(255, 255, 255, 0.14)",
    borderRadius: "10px",
    padding: showPasswordToggle || validation ? "0 44px 0 14px" : "0 14px",
    fontFamily: "Figtree, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    color: "rgba(255, 255, 255, 0.92)",
    outline: "none",
    transition: "border-color 180ms",
  };

  const placeholderStyle = `
    .auth-input::placeholder {
      color: rgba(255, 255, 255, 0.40);
      font-family: Figtree, sans-serif;
      font-size: 14px;
      font-weight: 400;
    }
  `;

  const iconStyle = {
    position: "absolute" as const,
    right: "14px",
    color: "rgba(255, 255, 255, 0.55)",
    cursor: showPasswordToggle ? "pointer" : "default",
  };

  const helperStyle = {
    fontFamily: "Figtree, sans-serif",
    fontSize: "11px",
    fontWeight: 400,
    fontStyle: "italic" as const,
    color: "rgba(255, 255, 255, 0.45)",
    marginTop: "6px",
  };

  const validationMessageStyle = {
    fontFamily: "Figtree, sans-serif",
    fontSize: "11px",
    fontWeight: 400,
    marginTop: "6px",
    color: validation?.state === "valid" ? "#2EC4B6" : "#ef4444",
  };

  return (
    <div>
      <style>{placeholderStyle}</style>
      <label>
        <span style={labelStyle}>{label}</span>
        <div style={inputContainerStyle}>
          <input
            className="auth-input"
            type={inputType}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={inputStyle}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            required={required}
            aria-required={required}
            aria-invalid={validation?.state === "invalid"}
            autoComplete={autoComplete}
          />
          {showPasswordToggle && (
            <button
              type="button"
              style={iconStyle}
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
          {validation && !showPasswordToggle && (
            <span style={iconStyle}>
              {validation.state === "checking" && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {validation.state === "valid" && (
                <Check size={16} style={{ color: "#2EC4B6" }} />
              )}
              {validation.state === "invalid" && (
                <X size={16} style={{ color: "#ef4444" }} />
              )}
            </span>
          )}
        </div>
      </label>
      {helperText && <p style={helperStyle}>{helperText}</p>}
      {validation?.message && (
        <p style={validationMessageStyle}>{validation.message}</p>
      )}
    </div>
  );
}

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

interface PasswordStrengthMeterProps {
  strength: PasswordStrength;
}

const strengthConfig = {
  weak: { segments: 1, color: "#ef4444", label: "Weak" },
  fair: { segments: 2, color: "#f59e0b", label: "Fair" },
  good: { segments: 3, color: "#2EC4B6", label: "Good" },
  strong: { segments: 4, color: "#E8571A", label: "Strong" },
};

export function PasswordStrengthMeter({ strength }: PasswordStrengthMeterProps) {
  const config = strengthConfig[strength];

  return (
    <div className="flex items-center" style={{ gap: "8px", marginTop: "8px" }}>
      <div className="flex" style={{ gap: "4px", flex: 1 }}>
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            style={{
              height: "4px",
              flex: 1,
              borderRadius: "2px",
              background:
                segment <= config.segments
                  ? config.color
                  : "rgba(255, 255, 255, 0.10)",
              transition: "background 200ms",
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "11px",
          fontWeight: 500,
          color: config.color,
          minWidth: "48px",
        }}
      >
        {config.label}
      </span>
    </div>
  );
}

/**
 * Strength tiers (Phase 17 spec):
 *  - weak:   <8 chars, or only letters, or only numbers
 *  - fair:   8+ chars with mixed letters/numbers
 *  - good:   10+ chars with letters/numbers/symbols
 *  - strong: 12+ chars with upper + lower + numbers + symbols
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) return "weak";

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const hasLetter = hasLower || hasUpper;
  const len = password.length;

  if (len < 8 || (hasLetter && !hasNumber && !hasSymbol) || (!hasLetter && hasNumber && !hasSymbol)) {
    return "weak";
  }

  if (len >= 12 && hasUpper && hasLower && hasNumber && hasSymbol) {
    return "strong";
  }

  if (len >= 10 && hasLetter && hasNumber && hasSymbol) {
    return "good";
  }

  return "fair";
}

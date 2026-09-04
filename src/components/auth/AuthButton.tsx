import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

interface AuthButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  type?: "submit" | "button";
}

export function AuthButton({
  children,
  onClick,
  disabled = false,
  isLoading = false,
  loadingText,
  type = "submit",
}: AuthButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        height: "48px",
        width: "100%",
        background: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
        borderRadius: "10px",
        border: "none",
        fontFamily: "Figtree, sans-serif",
        fontSize: "14px",
        fontWeight: 600,
        color: "white",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.5 : 1,
        marginTop: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        transition: "transform 150ms, opacity 150ms",
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.transform = "scale(1.01)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {isLoading && <Loader2 size={18} className="animate-spin" />}
      {isLoading ? loadingText || children : children}
    </button>
  );
}

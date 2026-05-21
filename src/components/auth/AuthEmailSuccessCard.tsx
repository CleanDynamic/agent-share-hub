import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

interface AuthEmailSuccessCardProps {
  onContinue: () => void;
}

export function AuthEmailSuccessCard({ onContinue }: AuthEmailSuccessCardProps) {
  const [showIcon, setShowIcon] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowIcon(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Success Icon */}
      <div
        style={{
          transform: showIcon ? "scale(1)" : "scale(0.6)",
          opacity: showIcon ? 1 : 0,
          transition: "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease",
        }}
      >
        <CheckCircle2
          style={{
            width: "56px",
            height: "56px",
            color: "#22C55E",
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
        You&apos;re in
      </h2>

      <p
        style={{
          marginTop: "8px",
          fontFamily: "Inter, sans-serif",
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: 1.55,
          color: "rgba(255, 255, 255, 0.60)",
        }}
      >
        Your account is verified. Let&apos;s get started.
      </p>

      <button
        onClick={onContinue}
        style={{
          marginTop: "24px",
          width: "100%",
          height: "44px",
          borderRadius: "10px",
          backgroundColor: "#E8571A",
          border: "none",
          fontFamily: "Inter, sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          color: "#FFFFFF",
          cursor: "pointer",
          transition: "background-color 150ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D14E17")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E8571A")}
      >
        Continue to NeoScale
      </button>
    </div>
  );
}

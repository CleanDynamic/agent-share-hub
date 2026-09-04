import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

interface AuthEmailErrorCardProps {
  onResend: () => void;
  onBackToSignIn: () => void;
}

export function AuthEmailErrorCard({
  onResend,
  onBackToSignIn,
}: AuthEmailErrorCardProps) {
  const [showIcon, setShowIcon] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowIcon(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Error Icon */}
      <div
        style={{
          transform: showIcon ? "scale(1)" : "scale(0.6)",
          opacity: showIcon ? 1 : 0,
          transition: "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 320ms ease",
        }}
      >
        <AlertCircle
          style={{
            width: "56px",
            height: "56px",
            color: "#EF4444",
            strokeWidth: 1.5,
          }}
        />
      </div>

      <h2
        style={{
          marginTop: "20px",
          fontFamily: "Figtree, sans-serif",
          fontSize: "18px",
          fontWeight: 700,
          color: "rgba(255, 255, 255, 0.95)",
        }}
      >
        This link doesn&apos;t work
      </h2>

      <p
        style={{
          marginTop: "8px",
          fontFamily: "Figtree, sans-serif",
          fontSize: "13px",
          fontWeight: 400,
          lineHeight: 1.55,
          color: "rgba(255, 255, 255, 0.60)",
        }}
      >
        It may have expired or been used already. We can send you a fresh one.
      </p>

      <button
        onClick={onResend}
        style={{
          marginTop: "24px",
          width: "100%",
          height: "44px",
          borderRadius: "10px",
          backgroundColor: "#E8571A",
          border: "none",
          fontFamily: "Figtree, sans-serif",
          fontSize: "14px",
          fontWeight: 600,
          color: "#FFFFFF",
          cursor: "pointer",
          transition: "background-color 150ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D14E17")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#E8571A")}
      >
        Send a new link
      </button>

      <button
        onClick={onBackToSignIn}
        style={{
          marginTop: "12px",
          background: "none",
          border: "none",
          padding: 0,
          fontFamily: "Figtree, sans-serif",
          fontSize: "13px",
          fontWeight: 500,
          color: "#E8571A",
          cursor: "pointer",
          transition: "opacity 150ms ease",
        }}
      >
        Back to sign in
      </button>
    </div>
  );
}

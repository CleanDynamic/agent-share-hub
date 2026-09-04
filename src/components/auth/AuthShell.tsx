import { useEffect, useState, type ReactNode } from "react";

interface AuthShellProps {
  children: ReactNode;
}

/**
 * Full-screen dedicated entry point for all auth routes. Rendered without
 * the app shell (no left/right rail, no mobile chrome) — see Layout.tsx.
 */
export function AuthShell({ children }: AuthShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        padding: "40px 16px",
        backgroundColor: "#25252F",
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      }}
    >
      <div className="flex flex-col items-center" style={{ gap: "24px" }}>
        {/* Brand Header */}
        <div
          className="flex flex-col items-center"
          style={{ height: "80px", justifyContent: "center" }}
        >
          <span
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: "24px",
              fontWeight: 700,
              color: "#E8571A",
              letterSpacing: "0.04em",
            }}
          >
            NeoScale
          </span>
          <span
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: "13px",
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.55)",
              letterSpacing: "0.02em",
              marginTop: "6px",
            }}
          >
            Community knowledge base for AI workflows
          </span>
        </div>

        {/* Auth Card Container */}
        <div
          className="w-full"
          style={{
            width: "420px",
            maxWidth: "92vw",
            background: "rgba(52, 52, 66, 0.65)",
            backdropFilter: "blur(40px) saturate(160%)",
            WebkitBackdropFilter: "blur(40px) saturate(160%)",
            border: "0.5px solid rgba(255, 255, 255, 0.14)",
            borderRadius: "16px",
            boxShadow: "0 24px 64px rgba(0, 0, 0, 0.40)",
            padding: "28px",
            opacity: mounted ? 1 : 0,
            transform: mounted ? "scale(1)" : "scale(0.96)",
            transition: "opacity 240ms ease-out, transform 240ms ease-out",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

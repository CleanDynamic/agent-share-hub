import { useNavigate } from "react-router-dom";
import { Target } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";

export default function UploadBountyPlaceholder() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
      <SeoHead title="Bounty — NeoScale AI" description="Bounty (coming soon)." path="/upload/bounty" noIndex />
      <Target size={40} color="#F59E0B" style={{ margin: "0 auto 16px" }} />
      <h1 style={{ fontFamily: "Inter, sans-serif", fontSize: 22, fontWeight: 600, color: "rgba(255,255,255,0.92)", marginBottom: 8 }}>
        Bounty
      </h1>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>Coming soon</p>
      <button
        onClick={() => navigate("/upload")}
        style={{
          fontSize: 13, fontWeight: 500, padding: "8px 20px", borderRadius: 100,
          border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.70)",
          background: "transparent", cursor: "pointer",
        }}
      >
        ← Back
      </button>
    </div>
  );
}

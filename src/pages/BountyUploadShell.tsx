import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";

/**
 * /upload/bounty route shell (Phase 5.1).
 *
 * Reads ?id= from the URL. If absent, creates a fresh draft
 * content_item with post_type='bounty' and redirects to
 * /upload/bounty?id={newId}. The real editor lands in 5.3 —
 * for now we render a placeholder.
 */
export default function BountyUpload() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const contentItemId = params.get("id");
  const creatingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Bootstrap: if no ?id, create a draft row and redirect.
  useEffect(() => {
    if (authLoading) return;
    if (contentItemId) return;
    if (creatingRef.current) return;
    creatingRef.current = true;

    (async () => {
      if (!user) {
        navigate("/login?redirect=/upload/bounty", { replace: true });
        return;
      }

      const { data, error: insertError } = await supabase
        .from("content_items")
        .insert({
          creator_id: user.id,
          title: "",
          content_type: "Prompt File",
          difficulty: "Beginner",
          status: "draft",
          post_type: "bounty",
          draft_saved_at: new Date().toISOString(),
          draft_name: "Untitled bounty",
        } as any)
        .select("id")
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Could not create bounty draft");
        creatingRef.current = false;
        return;
      }

      navigate(`/upload/bounty?id=${data.id}`, { replace: true });
    })();
  }, [authLoading, user, contentItemId, navigate]);

  return (
    <div
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "60px 24px",
        textAlign: "center",
      }}
    >
      <SeoHead
        title="Bounty — NeoScale AI"
        description="Create a bounty."
        path="/upload/bounty"
        noIndex
      />
      <Target
        size={40}
        color="#F59E0B"
        style={{ margin: "0 auto 16px" }}
      />
      <h1
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 22,
          fontWeight: 600,
          color: "rgba(255,255,255,0.92)",
          marginBottom: 8,
        }}
      >
        Bounty editor coming in 5.3
      </h1>
      <p
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.55)",
          marginBottom: 8,
        }}
      >
        {contentItemId
          ? `Draft ready · id ${contentItemId.slice(0, 8)}…`
          : error
          ? `Error: ${error}`
          : "Preparing your bounty draft…"}
      </p>
      <button
        onClick={() => navigate("/upload")}
        style={{
          marginTop: 16,
          fontSize: 13,
          fontWeight: 500,
          padding: "8px 20px",
          borderRadius: 100,
          border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.70)",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>
    </div>
  );
}

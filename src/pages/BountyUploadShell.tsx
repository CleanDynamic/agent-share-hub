import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Upload from "./Upload";

/**
 * /upload/bounty — mounts the shared editor in 'bounty' mode.
 *
 * Bootstrap: if no ?id is present, create a fresh draft
 * content_item with post_type='bounty' and redirect to
 * /upload/bounty?id={newId} so the editor loads it as a draft.
 */
export default function BountyUploadShell() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const contentItemId = params.get("id") || params.get("draft");
  const creatingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

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

  if (!contentItemId) {
    return (
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "60px 24px",
          textAlign: "center",
          color: "rgba(255,255,255,0.55)",
          fontSize: 13,
        }}
      >
        {error ? `Error: ${error}` : "Preparing your bounty draft…"}
      </div>
    );
  }

  return <Upload mode="bounty" />;
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { assertLegacyBountyCreateEnabled } from "@/lib/bounty-legacy/flags";
import Upload from "./Upload";

/**
 * /upload/bounty — mounts the shared editor in 'bounty' mode.
 *
 * TWO HALVES, AND NS-P54 FREEZES ONLY ONE OF THEM.
 *
 * With ?id: unchanged. The shared editor mounts in bounty mode against that
 * draft and still saves and publishes through src/pages/Upload.tsx, which this
 * prompt does not touch. A creator with a bounty draft in progress — reached
 * from src/pages/Drafts.tsx, which still routes them here on purpose — can
 * finish it. That is the same promise NS-P25 made to the blueprint editor.
 *
 * Without ?id: FROZEN. This branch used to MINT a bounty: it inserted a fresh
 * `content_items` row with post_type='bounty' and redirected to itself with the
 * new id. That is legacy bounty creation, reached by nothing but a typed URL
 * since NS-P54 repointed the picker, and it is gated by
 * assertLegacyBountyCreateEnabled() before the insert rather than removed. The
 * insert below is left whole and unreachable; deleting it is NS-P55's.
 */
export default function BountyUploadShell() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [params] = useSearchParams();
  const contentItemId = params.get("id") || params.get("draft");
  const creatingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [retired, setRetired] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (contentItemId) return;
    if (creatingRef.current) return;
    creatingRef.current = true;

    (async () => {
      // The gate, first: before the login redirect, so a signed-out visitor is
      // not sent to log in for a form that will refuse them at the other end.
      // The thrown BOUNTY_RETIRED message is the machine-readable one; the
      // panel below says the same thing in the words this page needs, and the
      // notice above it carries the sentence about where bounties live now.
      try {
        assertLegacyBountyCreateEnabled();
      } catch {
        setRetired(true);
        return;
      }

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
        {retired ? (
          <div data-visual-slot="legacy-bounty-retired" data-testid="legacy-bounty-retired">
            <p style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.6 }}>
              This editor no longer starts new bounties. A bounty draft you
              already have open still opens here from your drafts.
            </p>
            <Link
              to="/compose/new"
              style={{
                display: "inline-block",
                marginTop: 14,
                fontSize: 12,
                fontWeight: 500,
                padding: "7px 16px",
                borderRadius: 100,
                border: "1px solid rgba(232,87,26,0.35)",
                background: "rgba(232,87,26,0.10)",
                color: "#E8571A",
                textDecoration: "none",
              }}
            >
              Open the build workspace
            </Link>
          </div>
        ) : error ? (
          `Error: ${error}`
        ) : (
          "Preparing your bounty draft…"
        )}
      </div>
    );
  }

  return <Upload mode="bounty" />;
}

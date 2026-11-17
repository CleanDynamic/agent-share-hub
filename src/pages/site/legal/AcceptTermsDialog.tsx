/* Prompt 9, G19: when a signed-in member's recorded Terms or Privacy policy version is older than the current one, one dialog
   asks them to accept at their next visit. It closes only by accepting or signing out: Escape, a click outside and a swipe do
   nothing. It uses the site's window recipe (RecipeWindow) and the 32-high buttons.

   It is drawn only when both texts are marked reviewed (reviewed.ts): while they are drafts there is nothing to accept. The
   host in App.tsx loads this file only then. Members from before G17, and Google, GitHub and X accounts, have no
   acceptance yet, so they see it once too.

   The record is public.legal_acceptances (migration 20261117120000): a member reads their own rows, and accepts through
   accept_legal_terms(), which writes the row with the server's clock. */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/content/legal/legalConstants";
import { ACCEPT_COPY, ACCEPTANCE_DATA, needsAcceptance, type AcceptanceData } from "./acceptance";
import { PRIVACY_REVIEWED, TERMS_REVIEWED } from "@/content/legal/reviewed";
import { useAuth } from "@/contexts/AuthContext";
import { screenError } from "@/lib/auth/authMessages";
import { WAITING } from "@/lib/copy/copy";
import { t } from "@/lib/theme/tokens";

import { RecipeWindow } from "../compose/saveWindows";

export function AcceptTermsDialog({ reviewed = PRIVACY_REVIEWED && TERMS_REVIEWED, data = ACCEPTANCE_DATA }: { reviewed?: boolean; data?: AcceptanceData }) {
  const { user, signOut } = useAuth();
  const userId = user?.id ?? null;
  const phone = useIsPhone();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = ["legal", "accepted", userId] as const;
  const accepted = useQuery({ queryKey: key, queryFn: () => data.accepted(userId as string), enabled: reviewed && userId !== null });

  const open = reviewed && userId !== null && accepted.status === "success" && needsAcceptance(accepted.data);
  if (!open) return null;

  const accept = async () => {
    setPending(true);
    setError(null);
    try {
      await data.accept(TERMS_VERSION, PRIVACY_VERSION);
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (cause) {
      setError(screenError(cause, ACCEPT_COPY.failed, { source: "legal", context: "accept_legal_terms" }));
    } finally {
      setPending(false);
    }
  };

  const link = { color: t.text, textDecoration: "underline" } as const;
  return (
    <RecipeWindow
      open
      onClose={() => undefined}
      title={ACCEPT_COPY.title}
      note={ACCEPT_COPY.note}
      testId="accept-terms"
      width={420}
      body={
        <p style={{ margin: 0, display: "flex", gap: 16 }}>
          <Link to="/terms" target="_blank" rel="noopener" style={link}>
            {ACCEPT_COPY.terms}
          </Link>
          <Link to="/privacy" target="_blank" rel="noopener" style={link}>
            {ACCEPT_COPY.privacy}
          </Link>
        </p>
      }
      buttons={
        <>
          <Button variant="secondary" size={32} onClick={() => void signOut()} disabled={pending}>
            {ACCEPT_COPY.signOut}
          </Button>
          <Button variant="primary" size={32} data-variant="primary" onClick={() => void accept()} disabled={pending}>
            {pending ? WAITING.saving : ACCEPT_COPY.accept}
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" style={{ margin: 0, color: t.catBreakage, fontSize: phone ? 14 : 13 }}>
          {error}
        </p>
      ) : null}
    </RecipeWindow>
  );
}

export default AcceptTermsDialog;

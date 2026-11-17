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
import { PRIVACY_REVIEWED, TERMS_REVIEWED } from "@/content/legal/reviewed";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { screenError } from "@/lib/auth/authMessages";
import { WAITING } from "@/lib/copy/copy";
import { SITE_NAME } from "@/lib/site";
import { t } from "@/lib/theme/tokens";

import { RecipeWindow } from "../compose/saveWindows";

export const ACCEPT_COPY = {
  title: "We've updated our terms",
  note: `Read the Terms and the Privacy policy, then accept them to keep using ${SITE_NAME}.`,
  terms: "Terms",
  privacy: "Privacy policy",
  accept: "Accept",
  signOut: "Sign out",
  failed: "Couldn't save your acceptance. Try again.",
} as const;

/** The newest versions this member accepted, or null when they have accepted none. */
export interface Accepted {
  terms: string;
  privacy: string;
}

export interface AcceptanceData {
  accepted: (userId: string) => Promise<Accepted | null>;
  accept: (terms: string, privacy: string) => Promise<void>;
}

type Rows = { terms_version: string; privacy_version: string }[];
type TableRead = (table: string) => {
  select: (columns: string) => {
    eq: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Rows | null; error: unknown }> } };
  };
};
type Rpc = (fn: string, params: Record<string, unknown>) => Promise<{ error: unknown }>;

/** The table and function are newer than the generated types, so they are reached through a narrow cast. */
export const ACCEPTANCE_DATA: AcceptanceData = {
  accepted: async (userId) => {
    const table = supabase.from as unknown as TableRead;
    const { data, error } = await table("legal_acceptances")
      .select("terms_version, privacy_version")
      .eq("user_id", userId)
      .order("accepted_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    return row ? { terms: row.terms_version, privacy: row.privacy_version } : null;
  },
  accept: async (terms, privacy) => {
    const { error } = await (supabase.rpc as unknown as Rpc)("accept_legal_terms", { p_terms_version: terms, p_privacy_version: privacy });
    if (error) throw error;
  },
};

/** True when the member has accepted nothing, or an older Terms or Privacy policy. Versions are ISO dates, so they sort as text. */
export function needsAcceptance(accepted: Accepted | null): boolean {
  return accepted === null || accepted.terms < TERMS_VERSION || accepted.privacy < PRIVACY_VERSION;
}

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

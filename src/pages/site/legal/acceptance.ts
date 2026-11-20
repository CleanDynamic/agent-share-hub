/* Prompt 9, G19: the words, the record and the rule behind AcceptTermsDialog, in their own file so the dialog's file exports
   only components. The record is public.legal_acceptances (migration 20261117120000): a member reads their own rows, and
   accepts through accept_legal_terms(), which writes the row with the server's clock. */

import { PRIVACY_VERSION, TERMS_VERSION } from "@/content/legal/legalConstants";
import { supabase } from "@/integrations/supabase/client";
import { SITE_NAME } from "@/lib/site";

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

export const ACCEPTANCE_DATA: AcceptanceData = {
  accepted: async (userId) => {
    // Generated types lag the legal migration; keep the existing request and narrow its result locally.
    const { data, error } = await (supabase as any)
      .from("legal_acceptances")
      .select("terms_version, privacy_version")
      .eq("user_id", userId)
      .order("accepted_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = data?.[0] as { terms_version: string; privacy_version: string } | undefined;
    return row ? { terms: row.terms_version, privacy: row.privacy_version } : null;
  },
  accept: async (terms, privacy) => {
    const { error } = await (supabase as any).rpc("accept_legal_terms", { p_terms_version: terms, p_privacy_version: privacy });
    if (error) throw error;
  },
};

/** True when the member has accepted nothing, or an older Terms or Privacy policy. Versions are ISO dates, so they sort as text. */
export function needsAcceptance(accepted: Accepted | null): boolean {
  return accepted === null || accepted.terms < TERMS_VERSION || accepted.privacy < PRIVACY_VERSION;
}

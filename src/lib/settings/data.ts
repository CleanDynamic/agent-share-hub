// UX-15 P6: downloading your data and deleting your account, from the browser.
//
// Both call an edge function with the person's own session. The export builds the file under their own token (RLS applies); the delete
// uses the service role inside the function and nowhere else. The pure helpers say what the page shows.

import { supabase } from "@/integrations/supabase/client";

import { SettingsError } from "./useAction";

export const DELETE_STATEMENT =
  "Deleting your account removes your profile, your builds, drafts, topics, replies, comments, likes, follows, saves, collections and messages you sent. Rebuilds other people made from your builds stay, and say the original was removed. Replies in other people's topics are replaced by \"This reply was removed\" so the conversation still makes sense. This can't be undone.";

export const DATA_COPY = {
  accountDeleted: "Your account was deleted.",
  rateLimited: (minutes: number) => `You can download again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
} as const;

/** The username typed into the delete window matches the account's, in any case and ignoring spaces round it. */
export function typingMatches(typed: string, username: string | null | undefined): boolean {
  if (!username) return false;
  const given = typed.trim().toLowerCase();
  return given.length > 0 && given === username.toLowerCase();
}

/** `1.4 MB`, `820 KB`, `312 bytes`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export interface PreparedExport {
  fileName: string;
  /** The file's text, ready to save. */
  text: string;
  bytes: number;
  /** Sources the file could not read; the page says the file is not whole. */
  incomplete: string[];
}

interface HttpErrorLike {
  context?: Response;
}

/** Build the file. A refusal for the hourly limit comes back as the sentence to show. */
export async function prepareExport(): Promise<PreparedExport> {
  const { data, error } = await supabase.functions.invoke("export-my-data", { method: "POST" });
  if (error) {
    const response = (error as HttpErrorLike).context;
    if (response && response.status === 429) {
      const body = (await response.json().catch(() => null)) as { waitSeconds?: number } | null;
      const minutes = Math.max(1, Math.ceil((body?.waitSeconds ?? 3600) / 60));
      throw new SettingsError(DATA_COPY.rateLimited(minutes));
    }
    throw error;
  }
  const result = data as { fileName?: string; file?: { incomplete?: string[] } } | null;
  if (!result?.fileName || !result.file) throw new Error("export-my-data answered with no file");
  const text = JSON.stringify(result.file, null, 2);
  return { fileName: result.fileName, text, bytes: new TextEncoder().encode(text).length, incomplete: result.file.incomplete ?? [] };
}

/** Hand the browser the file. */
export function saveFile(file: PreparedExport): void {
  const url = URL.createObjectURL(new Blob([file.text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Delete the account. The person has typed their username; the server checks it again. */
export async function deleteMyAccount(typed: string): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-my-account", { method: "POST", body: { confirm: typed } });
  if (error) {
    const response = (error as HttpErrorLike).context;
    const body = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
    throw new SettingsError(body?.error ?? "Couldn't delete your account. Try again.");
  }
  // The sign-in is gone with the account; ending the session here only clears this browser.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
}

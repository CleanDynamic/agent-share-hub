import { supabase } from "@/integrations/supabase/client";
import {
  REBLOG_TEXT_MAX,
  ReblogValidationError,
  assertReblogAuthoringEnabled,
} from "./media";
import type { Reblog } from "./types";

const EDIT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Edit a reblog's text inside the five-minute window.
 *
 * FROZEN — NS-P43. Throws ReblogValidationError("REBLOG_RETIRED") while
 * REBLOG_COMPOSE_ENABLED is false. It had no call site anywhere in the app
 * before the freeze: the edit affordance was never built, so nothing in the
 * UI changes here.
 */
export async function updateReblog(args: {
  reblogId: string;
  userId: string;
  text: string;
}): Promise<Reblog> {
  assertReblogAuthoringEnabled();
  const text = (args.text ?? "").trim();
  if (text.length === 0) {
    throw new ReblogValidationError("EMPTY_REBLOG", "Reblog text cannot be empty.");
  }
  if (text.length > REBLOG_TEXT_MAX) {
    throw new ReblogValidationError(
      "TEXT_TOO_LONG",
      `Reblog text must be ≤ ${REBLOG_TEXT_MAX} characters.`
    );
  }

  const { data: row, error: readErr } = await (supabase.from("reblogs") as any)
    .select("reblogger_id, created_at, media_url, media_kind")
    .eq("id", args.reblogId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) throw new Error("Reblog not found");
  if (row.reblogger_id !== args.userId) {
    throw new ReblogValidationError("FORBIDDEN", "Not the reblog author.");
  }

  const age = Date.now() - new Date(row.created_at).getTime();
  if (age > EDIT_WINDOW_MS) {
    throw new ReblogValidationError(
      "EDIT_WINDOW_CLOSED",
      "Reblogs can only be edited within 5 minutes of posting."
    );
  }

  // Disallow text-only deletion when there's no media to fall back on.
  if (!row.media_url && text.length === 0) {
    throw new ReblogValidationError("EMPTY_REBLOG", "Reblog cannot be empty.");
  }

  const { data, error } = await (supabase.from("reblogs") as any)
    .update({ text } as any)
    .eq("id", args.reblogId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Reblog;
}

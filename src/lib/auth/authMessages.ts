/**
 * The one door from a failure to the words on screen (prompt 9, G4; widened from the sign-in dialog's G14 mapper).
 *
 * `screenError(error, fallback)` is what every place that used to show `err.message` calls. No server or library text
 * reaches the screen:
 *   - our own errors pass through, from an explicit list: SettingsError (Settings), ShownError (thrown where our code
 *     words a refusal: the build graph's refusals, the profile and Customise checks), and PostError where its words are ours
 *     (signed out, a policy refusal with our words, or a raised exception in SQL_SENTENCES);
 *   - a raised exception (P0001) from our SQL is read through SQL_SENTENCES, every message our database raises that a
 *     person can meet, each mapped to our sentence;
 *   - an auth service refusal is read by its code (refusalOf below) into AUTH_ERRORS;
 *   - a dropped connection is OFFLINE_ERROR;
 *   - everything else is the caller's own fallback, itself one of our sentences, or "Couldn't do that. Try again.", and is
 *     reported through reportError, which keeps the error's name and code and the context, never its message.
 */
import { AUTH_ERRORS, OFFLINE_ERROR, UNKNOWN_ERROR, signInSentence } from "@/lib/copy/copy";
import { reportError, type ReportContext } from "@/lib/errors/report";
import { MediaUploadError } from "@/lib/media/uploadMedia";
import { PostError } from "@/lib/openbuilds/types";
import { SettingsError } from "@/lib/settings/useAction";

export type AuthRefusal = "captcha" | "credentials" | "rate-limit" | "weak-password" | "same-password" | "invalid-email" | "unknown";

interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

export function refusalOf(error: AuthErrorLike | null | undefined): AuthRefusal {
  if (!error) return "unknown";
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "captcha_failed" || message.includes("captcha")) return "captcha";
  // G12: an unconfirmed email is refused in the same words as a wrong password, so sign-in never says an address exists.
  if (code === "invalid_credentials" || code === "email_not_confirmed") return "credentials";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error.status === 429) return "rate-limit";
  if (code === "weak_password") return "weak-password";
  if (code === "same_password") return "same-password";
  if (code === "email_address_invalid" || code === "validation_failed") return "invalid-email";
  if (code) return "unknown";
  // No code: the few messages the client library is known to send without one.
  if (message.includes("invalid login credentials") || message.includes("email not confirmed")) return "credentials";
  if (message.includes("rate limit")) return "rate-limit";
  if (message.includes("different from the old password")) return "same-password";
  return "unknown";
}

export const AUTH_MESSAGES: Record<AuthRefusal, string> = AUTH_ERRORS;

export function messageFor(refusal: AuthRefusal): string {
  return AUTH_MESSAGES[refusal];
}

/** An error whose message is our own sentence, meant for the person. Thrown where our code words a refusal. */
export class ShownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShownError";
  }
}

/**
 * Every message our SQL raises (P0001) that a person can meet, and what the screen says for it. A message not listed here
 * is read as an unknown failure. The list was taken from supabase/migrations (prompt 9's report has the full set, with
 * the ones left out: migration guards, legacy features, and checks no screen can reach).
 */
export const SQL_SENTENCES: readonly (readonly [string | RegExp, string])[] = [
  ["Give the build a title before you publish it.", "Couldn't publish this build. Give it a title first."],
  ["That topic or reply is gone.", "Couldn't find that topic or reply. It may have been removed."],
  ["The author and place of a topic or reply cannot change.", "Couldn't change that. A topic's author and space stay as they are."],
  ["Only the author can edit a topic or reply.", "Couldn't edit that. Only its author can."],
  ["Only the topic's author or a moderator can pin or hide it.", "Couldn't do that. Only the topic's author or a moderator can pin or hide it."],
  ["A topic or reply needs words or something attached.", "Couldn't post that. Add words or attach something."],
  ["Sign in to start a topic or reply.", signInSentence("post")],
  ["That step is not in that build.", "Couldn't attach that step. It isn't in that build."],
  ["A reply can attach only your own work.", "Couldn't attach that. A reply can attach only your own work."],
  ["That work is not published, so it can't be attached.", "Couldn't attach that. It isn't published."],
  ["This build's maker doesn't allow it to start topics.", "Couldn't start a topic. This build's maker doesn't allow it."],
  [/^\S.* are not switched on here\.$/, "Couldn't do that. It isn't switched on in this space."],
  [
    "A topic or reply is hidden by its space's moderators. Dismiss the report here.",
    "Couldn't hide that for the site. Its space's moderators have hidden it, so dismiss the report here.",
  ],
  ["Only the site's moderators can hide or unhide this for the site.", "Couldn't do that. Only the site's moderators can."],
  ["A profile holds 3 pins. Unpin one first.", "Couldn't pin that. A profile holds 3 pins, so unpin one first."],
  ["You can only pin something you made.", "Couldn't pin that. You can pin only what you made."],
  ["Sign in to change your profile.", signInSentence("profile")],
  ["Sign in to change your settings.", signInSentence("continue")],
  ["Sign in to download your data.", signInSentence("continue")],
  [/^You have opened \d+ imports today, which is the limit\./, "Couldn't start the import. You've reached today's limit, which resets at midnight UTC."],
  [/^You have \d+ imports still open\./, "Couldn't start the import. Finish or abandon an open import first."],
];

/** The shared uploader's refusals, by code (src/lib/media/uploadMedia.ts). UPLOAD_FAILED carries storage's own text: not ours. */
function uploadWords(error: MediaUploadError): string | null {
  if (error.code === "MEDIA_TYPE_UNSUPPORTED") return "Couldn't upload that. Choose a JPG, PNG, WEBP, GIF, MP4, WEBM or MOV file.";
  if (error.code === "MEDIA_TOO_LARGE") return /video/i.test(error.message) ? "Couldn't upload that. Choose a video under 100 MB." : "Couldn't upload that. Choose an image under 10 MB.";
  if (error.code === "NOT_AUTHENTICATED") return signInSentence("continue");
  return null;
}

/** Our sentence for a raised exception's message, or null when it is not one a person meets. */
export function sqlSentence(message: string): string | null {
  for (const [said, sentence] of SQL_SENTENCES) {
    if (typeof said === "string" ? said === message : said.test(message)) return sentence;
  }
  return null;
}

const MAX_DEPTH = 5;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Our words for one link of a cause chain, or null when the link is not ours. */
function ownWords(link: unknown): string | null {
  if (link instanceof SettingsError || link instanceof ShownError) return link.message;
  if (link instanceof MediaUploadError) return uploadWords(link);
  if (link instanceof PostError) {
    if (link.code === "P0001") return sqlSentence(link.message);
    if (link.status === 401) return signInSentence("post");
    // A policy refusal carries the caller's words; a failure with no words of its own reads "<operation> failed".
    if (link.code === "42501" && !/ failed\b/.test(link.message)) return link.message;
    return null;
  }
  const object = asObject(link);
  if (object && object.code === "P0001" && typeof object.message === "string") return sqlSentence(object.message);
  return null;
}

function isAuthError(link: unknown): boolean {
  const object = asObject(link);
  if (!object) return false;
  if (object.__isAuthError === true) return true;
  return typeof object.name === "string" && /^Auth\w*Error$/.test(object.name);
}

function isOffline(link: unknown): boolean {
  const object = asObject(link);
  if (!object) return false;
  const name = typeof object.name === "string" ? object.name : "";
  const message = typeof object.message === "string" ? object.message : "";
  return (name === "TypeError" && /failed to fetch|networkerror|load failed|network request failed/i.test(message)) || name === "FetchError";
}

/**
 * The words the screen shows for a failure. `fallback` is the caller's own sentence for what it was doing ("Couldn't join
 * that space. Try again."); it is used for anything that is not ours. `report` is where an unknown failure is reported
 * from; a caller that already reports the failure itself passes false, so it is told once.
 */
export function screenError(error: unknown, fallback: string = UNKNOWN_ERROR, report: ReportContext | false = { source: "screen-error" }): string {
  let link: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH && link; depth += 1) {
    const words = ownWords(link);
    if (words) return words;
    if (isAuthError(link)) {
      const refusal = refusalOf(link as AuthErrorLike);
      if (refusal !== "unknown") return AUTH_MESSAGES[refusal];
    }
    if (isOffline(link)) return OFFLINE_ERROR;
    link = asObject(link)?.cause;
  }
  if (report) reportError(error, report);
  return fallback;
}

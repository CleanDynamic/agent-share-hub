// SV-07 P7: Claude Code opens a continued session with its own summary of the one before ("This session is being continued from
// a previous conversation that ran out of context…"). The connector stores it as an ordinary user turn, so it arrives as a
// prompt. The build reads it as a Summary tile: called "Summary of an earlier chat", counted and named as no prompt. Nothing is
// dropped: Convert makes it a prompt (`payload.as_prompt`). Pure.

/** The turn Claude Code opens a continued session with, its summary of the one before. By its opening words alone, so a title cut short from it is known too. */
export const isSessionSummary = (text: string): boolean => /^\s*This session is being continued from a previous\b/.test(text);

export const SUMMARY_COPY = {
  kind: "Summary",
  title: "Summary of an earlier chat",
} as const;

/** A prompt row's payload is a Summary tile: its text is the summary turn, and its maker has not made it a prompt. */
export function isSummaryPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const { text, as_prompt: asPrompt } = payload as { text?: unknown; as_prompt?: unknown };
  return asPrompt !== true && typeof text === "string" && isSessionSummary(text);
}

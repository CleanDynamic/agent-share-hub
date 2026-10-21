// CA-13 P5: a trace link (`payload.trace_url`): https only. LangSmith links are named; any other host shows its domain.

/** The link as stored, or null when it is not an https link. */
export function traceUrlOf(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const said = raw.trim();
  if (!said || said.length > 2000) return null;
  try {
    const url = new URL(said);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Why a link cannot be saved, or null. */
export const traceRefusal = (value: string): string | null => (value.trim() === "" || traceUrlOf(value) ? null : "A trace link starts with https://.");

/** "LangSmith" for a LangChain host, else the domain without "www.". */
export function traceLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    return /(^|\.)langchain\.com$/i.test(host) ? "LangSmith" : host;
  } catch {
    return "Trace";
  }
}

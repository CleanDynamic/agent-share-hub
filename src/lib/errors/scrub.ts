// G22: the last word on what leaves the browser for Sentry.
//
// report.ts already sends no error message, request, user or extra, and drops every breadcrumb. This is the net under
// that: every event is copied and walked before it is sent, and anything that looks like a password, a token, a
// captcha token or an email address is taken out, wherever it sits (tags, exception values, request, breadcrumbs,
// contexts). The event that came in is not changed.

const SENSITIVE_KEY = /password|passwd|secret|token|captcha|authorization|cookie|api[-_]?key|email|credential/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /\b(Bearer)\s+[\w.~+/=-]+/gi;
/** `name=value` in a query, a hash or a form body, for the names that carry secrets. */
const SECRET_PARAM = /([?&#;]|^)((?:access_|refresh_|provider_)?token(?:_hash)?|code|captcha_?token|password|apikey|api_key)=([^&#\s"']*)/gi;
/** `"name": "value"` in a JSON string, for the names that carry secrets. */
const SECRET_JSON = /("[\w-]*(?:password|passwd|secret|token|captcha|apikey|api_key|email)[\w-]*"\s*:\s*)"(?:[^"\\]|\\.)*"/gi;
const MAX_DEPTH = 20;

function scrubString(value: string): string {
  return value
    .replace(SECRET_JSON, '$1"[redacted]"')
    .replace(SECRET_PARAM, "$1$2=[redacted]")
    .replace(JWT, "[token]")
    .replace(BEARER, "$1 [token]")
    .replace(EMAIL, "[email]");
}

function scrubValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[cycle]";
  if (depth > MAX_DEPTH) return "[redacted]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : scrubValue(inner, depth + 1, seen);
  }
  return out;
}

/** A copy of `event` with every password, token, captcha token and email address taken out. */
export function scrubEvent<T>(event: T): T {
  return scrubValue(event, 0, new WeakSet()) as T;
}

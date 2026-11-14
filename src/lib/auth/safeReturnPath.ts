/**
 * G15: the only way a return address after sign-in is read.
 *
 * A return address may only be a path on this site. It must start with exactly one "/", and may not contain "//", any
 * backslash (browsers read "\" as "/", so "/\example.com" leaves the site), a control character (browsers drop tabs and
 * newlines, which turns "/\t/example.com" into "//example.com"), or a leading scheme. Anything else, including a value
 * that is not a string, is "/".
 */
const MAX_LENGTH = 2048;
// C0 controls, DEL and C1 controls.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (value.length === 0 || value.length > MAX_LENGTH) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.includes("//") || value.includes("\\")) return "/";
  if (CONTROL.test(value) || SCHEME.test(value)) return "/";
  return value;
}

/** The return address an address carries in `redirect` (or its `returnTo` alias), through the gate; null when it has none. */
export function returnPathFrom(params: URLSearchParams): string | null {
  const value = params.get("redirect") ?? params.get("returnTo");
  return value === null ? null : safeReturnPath(value);
}

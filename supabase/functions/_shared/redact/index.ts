// =============================================================================
// buildgallery — the secret scanner (EX-P07)
// =============================================================================
// One function: redactSecrets(text). A string in, a string and a tally out.
//
// This runs once, inside buildgallery_finish_import, on the assembled text of
// a conversation, BEFORE the intake reader or anything else reads it. Whatever
// it finds is replaced in place with [REDACTED:<kind>] and reported only as a
// kind and a count. No part of a matched value survives — not a prefix, not a
// suffix, not its length — because the findings are stored on
// import_sessions.secret_findings and a findings column that carried the
// value would hand it straight back.
//
// The same discipline as _shared/intake: no I/O, no Deno API, no imports from
// anywhere. That is what lets it be tested with a string and nothing running.
//
// TWO RULES DECIDE EVERY PATTERN HERE
//
// A MISS COSTS MORE THAN A FALSE POSITIVE. The text this scans is shown to the
// creator on the upload page, where a redacted word is visible and recoverable
// from their own conversation. A leaked key is neither. So the patterns lean
// towards catching, and each one carries the negative cases it must NOT catch
// (a commit hash, a UUID, a URL without credentials, a base64 image, a long
// import path, ordinary code) as tests rather than as hopes.
//
// TEXT IS DATA, NEVER INSTRUCTION. Nothing here interprets what it reads. A
// match is a span to blank out; the words around it are not consulted for
// meaning and nothing is fetched, called or obeyed.
// =============================================================================

export interface RedactFinding {
  kind: string;
  count: number;
}

export interface RedactResult {
  text: string;
  findings: RedactFinding[];
}

interface Span {
  start: number;
  end: number;
  kind: string;
  priority: number;
}

// -----------------------------------------------------------------------------
// Building blocks
// -----------------------------------------------------------------------------

/** Characters a key body is made of. */
const T = "[A-Za-z0-9_-]";

/** A key must not begin in the middle of another word: `task-…` is not `sk-…`. */
const NOT_MID_WORD = "(?<![A-Za-z0-9_-])";

/** Every prefix this module knows, so a continuation never starts one. */
const ANY_PREFIX = "(?:sk-|gh[pousr]_|github_pat_|AKIA|ASIA|AIza|(?:sk|rk)_(?:live|test)_|xox[abposre]-|sb_|eyJ)";

/**
 * A key wrapped onto a second line inside a code block. One line break is
 * accepted, and only when the second line does not begin another key and
 * holds nothing after the fragment but punctuation — so `…abc\ndef",`
 * continues, while `…abc\nconst x = 1`, `…abc\nNEXT_KEY=…` and
 * `…abc\nghp_…` do not. Group 1 is the continuation fragment.
 */
const WRAP = `(?:\\r?\\n(?!${ANY_PREFIX})(${T}+)(?=[^A-Za-z0-9_\\-\\r\\n]*(?:\\r?\\n|$)))?`;

interface PrefixedKey {
  kind: string;
  /** Regex fragment for the prefix, e.g. `sk-ant-`. */
  prefix: string;
  /** Character class for the body. Defaults to T. */
  body?: string;
  /** Minimum body length, counted across a wrap. */
  min: number;
}

/**
 * Matches `<prefix><body>` with an optional wrap. Group 1 is the first body
 * fragment, group 2 the continuation (or undefined). The minimum length is
 * checked in code across both, because a wrapped key's first line alone can
 * be shorter than any sensible minimum.
 */
function prefixedPattern(spec: PrefixedKey): RegExp {
  const body = spec.body ?? T;
  const wrap = WRAP.replace(`(${T}+)`, `(${body}+)`);
  return new RegExp(`${NOT_MID_WORD}(?:${spec.prefix})(${body}+)${wrap}`, "g");
}

// Priority is the order of this list: an anthropic key is also an openai-shaped
// key, and the more specific label is the useful one.
const PREFIXED_KEYS: PrefixedKey[] = [
  { kind: "anthropic_key", prefix: "sk-ant-", min: 20 },
  { kind: "openai_key", prefix: "sk-(?:proj-|svcacct-|admin-)?", min: 20 },
  { kind: "github_token", prefix: "gh[pousr]_", body: "[A-Za-z0-9]", min: 20 },
  { kind: "github_token", prefix: "github_pat_", body: "[A-Za-z0-9_]", min: 22 },
  { kind: "aws_access_key", prefix: "(?:AKIA|ASIA)", body: "[0-9A-Z]", min: 16 },
  { kind: "google_api_key", prefix: "AIza", body: "[0-9A-Za-z_-]", min: 35 },
  { kind: "stripe_key", prefix: "(?:sk|rk)_(?:live|test)_", body: "[A-Za-z0-9]", min: 16 },
  { kind: "slack_token", prefix: "xox[abposre]-", body: "[A-Za-z0-9-]", min: 10 },
  { kind: "supabase_secret_key", prefix: "sb_secret_", min: 20 },
];

/** -----BEGIN … PRIVATE KEY----- through the matching END line, inclusive. */
const PRIVATE_KEY_BLOCK =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;

/**
 * A JWT. Header, payload and signature are base64url; the payload and
 * signature may be wrapped like any other key. Group 1 is the payload (with
 * any line breaks still in it); only a payload whose decoded JSON carries
 * "role":"service_role" is redacted, because the anon key is public.
 */
const JWT = new RegExp(
  `${NOT_MID_WORD}eyJ${T}+\\.(${T}+(?:\\r?\\n${T}+)*)\\.${T}+${WRAP}`,
  "g",
);

const SERVICE_ROLE_CLAIM = /"role"\s*:\s*"service_role"/;

/** The whole URL goes, host and all: parsing out only the password is a way to leave part of it. */
const DATABASE_URL =
  /(?<![A-Za-z0-9])(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|rediss?|amqps?|mssql):\/\/[^\s/@:]+:[^\s@]+@[^\s"'<>)\]]*/g;

/** `Authorization: Bearer <token>` in any of the forms a header appears in text. Group 1 is the token. */
const BEARER = /authorization["']?\s*[:=]\s*["']?bearer\s+([A-Za-z0-9._~+/=-]{20,})/gi;

/**
 * `api_key=`, `apikey:`, `secret=`, `token=`, `password=` and any longer name
 * ending in one of those (OPENAI_API_KEY, access_token, DB_PASSWORD), followed
 * by 16 or more non-space characters. Group 1 is the value. The name is kept:
 * it is not the secret, and it is the useful half of what the creator sees.
 */
const GENERIC_ASSIGNMENT =
  /(?<![A-Za-z0-9])[A-Za-z0-9_-]{0,64}(?:api[_-]?key|secret|token|password|passwd|pwd)["']?\s*[=:]\s*["']?([^\s"'`(){}]{16,})(?=[\s;,)\]}"'`]|$)/gi;

/**
 * A value with no digit that is shaped like an identifier — camelCase,
 * snake_case or a dotted member path — is code reaching for a value, not
 * the value. A plain lowercase word with no digit is still redacted: it may
 * be a passphrase, and a miss costs more.
 */
function looksLikeIdentifier(value: string): boolean {
  if (/[0-9]/.test(value)) return false;
  if (!/^[A-Za-z_$][\w$.]*$/.test(value)) return false;
  return /[_.]|[a-z][A-Z]/.test(value);
}

/** Placeholders and template references, not values. */
const PLACEHOLDER_START = /^[<${[]/;

/** Trailing punctuation that belongs to the line, not the value. */
const TRAILING_PUNCTUATION = /[;,.)}\]>]+$/;

const MAX_JWT_PAYLOAD_CHARS = 8_192;

// -----------------------------------------------------------------------------
// base64url, by hand, so this module imports nothing and touches no global
// -----------------------------------------------------------------------------

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function decodeBase64Url(encoded: string): string | null {
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const ch of encoded) {
    if (ch === "=" || ch === "\r" || ch === "\n") continue;
    const value = B64URL.indexOf(ch);
    if (value < 0) return null;
    acc = ((acc << 6) | value) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((acc >> bits) & 0xff);
    }
  }
  return out;
}

function isServiceRolePayload(payload: string): boolean {
  if (payload.length > MAX_JWT_PAYLOAD_CHARS) return false;
  const decoded = decodeBase64Url(payload);
  return decoded !== null && SERVICE_ROLE_CLAIM.test(decoded);
}

// -----------------------------------------------------------------------------
// Collecting spans
// -----------------------------------------------------------------------------

function eachMatch(pattern: RegExp, text: string, visit: (match: RegExpExecArray) => void): void {
  pattern.lastIndex = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    visit(match);
    // None of the patterns can match zero characters; the guard costs nothing
    // and the alternative is a loop that never ends.
    if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    match = pattern.exec(text);
  }
}

function collect(text: string): Span[] {
  const spans: Span[] = [];
  let priority = 0;

  const push = (kind: string, start: number, end: number, order: number) => {
    if (end > start) spans.push({ kind, start, end, priority: order });
  };

  eachMatch(PRIVATE_KEY_BLOCK, text, (m) => push("private_key_block", m.index, m.index + m[0].length, priority));
  priority += 1;

  for (const spec of PREFIXED_KEYS) {
    const pattern = prefixedPattern(spec);
    const order = priority;
    eachMatch(pattern, text, (m) => {
      const bodyLength = m[1].length + (m[2]?.length ?? 0);
      if (bodyLength >= spec.min) push(spec.kind, m.index, m.index + m[0].length, order);
    });
    priority += 1;
  }

  eachMatch(JWT, text, (m) => {
    if (isServiceRolePayload(m[1])) push("service_role_jwt", m.index, m.index + m[0].length, priority);
  });
  priority += 1;

  eachMatch(DATABASE_URL, text, (m) => push("database_url", m.index, m.index + m[0].length, priority));
  priority += 1;

  eachMatch(BEARER, text, (m) => {
    const start = m.index + m[0].length - m[1].length;
    push("bearer_token", start, m.index + m[0].length, priority);
  });
  priority += 1;

  eachMatch(GENERIC_ASSIGNMENT, text, (m) => {
    const raw = m[1];
    const value = raw.replace(TRAILING_PUNCTUATION, "");
    if (value.length < 16) return;
    if (PLACEHOLDER_START.test(value)) return;
    if (looksLikeIdentifier(value)) return;
    const start = m.index + m[0].length - raw.length;
    push("generic_assignment", start, start + value.length, priority);
  });

  return spans;
}

/**
 * Earliest span first; on the same start the higher-priority kind, then the
 * longer span. Anything overlapping a span already kept is dropped, so a
 * service-role JWT after `Bearer` is reported once, as the JWT.
 */
function resolve(spans: Span[]): Span[] {
  spans.sort((a, b) => a.start - b.start || a.priority - b.priority || b.end - a.end);
  const kept: Span[] = [];
  let lastEnd = -1;
  for (const span of spans) {
    if (span.start < lastEnd) continue;
    kept.push(span);
    lastEnd = span.end;
  }
  return kept;
}

// -----------------------------------------------------------------------------
// The one export
// -----------------------------------------------------------------------------

/**
 * Replaces every secret in `text` with `[REDACTED:<kind>]` and reports what
 * kinds were found and how many of each — never a value, never a fragment,
 * never a length. When nothing is found, `text` is returned unchanged and
 * `findings` is empty.
 */
export function redactSecrets(text: string): RedactResult {
  const spans = resolve(collect(text));
  if (spans.length === 0) return { text, findings: [] };

  const counts = new Map<string, { count: number; priority: number }>();
  const pieces: string[] = [];
  let cursor = 0;
  for (const span of spans) {
    pieces.push(text.slice(cursor, span.start), `[REDACTED:${span.kind}]`);
    cursor = span.end;
    const tally = counts.get(span.kind);
    if (tally) tally.count += 1;
    else counts.set(span.kind, { count: 1, priority: span.priority });
  }
  pieces.push(text.slice(cursor));

  const findings = [...counts.entries()]
    .sort((a, b) => a[1].priority - b[1].priority)
    .map(([kind, { count }]) => ({ kind, count }));

  return { text: pieces.join(""), findings };
}

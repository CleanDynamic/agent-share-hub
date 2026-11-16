// mfa-recovery (Part A, G5): the rules, with no Deno and no network, so vitest and Deno test the same code.
//
// Codes: ten per set, ten characters each from a 32-character alphabet with no 0, 1, I or O (50 bits each), shown as
// XXXXX-XXXXX. Stored only as SHA-256(salt || code) with a random 16-byte salt per row. A submitted code is hashed with
// every candidate's salt and compared in constant time against every candidate, so the time taken says nothing about
// which code, or how much of one, was right.

export const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CODES_PER_SET = 10;
export const CODE_CHARS = 10;
/** G4 and G5: a code entered in the last ten minutes. */
export const FRESH_SECONDS = 600;
/** Redeem attempts per member per window, on top of the code view's five (G7). */
export const REDEEM_LIMIT = 10;
export const REDEEM_WINDOW_SECONDS = 900;

export interface Claims {
  session_id?: string;
  aal?: string;
  amr?: { method?: string; timestamp?: number }[];
}

export interface Candidate {
  id: number;
  salt: string;
  code_hash: string;
}

export interface RecoveryDeps {
  /** From the verified token, never from the body. */
  userId: string;
  claims: Claims;
  now: () => number;
  random: (bytes: number) => Uint8Array;
  sha256Hex: (text: string) => Promise<string>;
  replace: (userId: string, salts: string[], hashes: string[]) => Promise<void>;
  candidates: (userId: string) => Promise<Candidate[]>;
  spend: (userId: string, codeId: number, sessionId: string) => Promise<boolean>;
  left: (userId: string) => Promise<number>;
  recoveredAt: (sessionId: string, userId: string) => Promise<string | null>;
  verifiedFactorIds: (userId: string) => Promise<string[]>;
  deleteFactor: (userId: string, factorId: string) => Promise<void>;
  /** One attempt counted in the bucket; false once over the limit. */
  hit: (bucket: string, limit: number, windowSeconds: number) => Promise<boolean>;
}

export class RecoveryRefused extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** The claims of a token the caller has ALREADY verified. Only read; never the check of who is calling. */
export function claimsOf(token: string): Claims {
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as Claims;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** True when this session's token says an authenticator code was checked in the last ten minutes. */
export function hasFreshCode(claims: Claims, nowSeconds: number): boolean {
  if (claims.aal !== "aal2" || !Array.isArray(claims.amr)) return false;
  return claims.amr.some((entry) => entry?.method === "totp" && typeof entry.timestamp === "number" && nowSeconds - entry.timestamp <= FRESH_SECONDS);
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** Upper case, without the spaces and dash a person may type. Null when it cannot be a code. */
export function normaliseCode(text: string): string | null {
  const plain = text.toUpperCase().replace(/[\s-]+/g, "");
  if (plain.length !== CODE_CHARS) return null;
  for (const ch of plain) if (!ALPHABET.includes(ch)) return null;
  return plain;
}

/** A new set of codes, as shown: XXXXX-XXXXX. */
export function generateCodes(random: RecoveryDeps["random"]): string[] {
  const codes = new Set<string>();
  while (codes.size < CODES_PER_SET) {
    const bytes = random(CODE_CHARS);
    // 256 is a multiple of 32, so masking to five bits is uniform.
    const plain = Array.from(bytes, (b) => ALPHABET[b & 31]).join("");
    codes.add(`${plain.slice(0, 5)}-${plain.slice(5)}`);
  }
  return [...codes];
}

/** Equal-length strings compared without stopping at the first difference. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Make and store a new set; the old set is void. Needs a code entered in the last ten minutes. */
export async function createCodes(deps: RecoveryDeps): Promise<string[]> {
  if (!hasFreshCode(deps.claims, Math.floor(deps.now() / 1000))) {
    throw new RecoveryRefused("Enter a code from your authenticator first.", 403);
  }
  const codes = generateCodes(deps.random);
  const salts = codes.map(() => toHex(deps.random(16)));
  const hashes = await Promise.all(codes.map((code, i) => deps.sha256Hex(salts[i] + normaliseCode(code))));
  await deps.replace(deps.userId, salts, hashes);
  return codes;
}

/** Spend one code on this session. The session then counts as verified for the database (G3). */
export async function redeemCode(deps: RecoveryDeps, text: string): Promise<void> {
  const sessionId = deps.claims.session_id;
  if (!sessionId) throw new RecoveryRefused("Sign in again, then try once more.", 401);
  const bucket = `mfa-recovery:${await deps.sha256Hex(deps.userId)}`;
  if (!(await deps.hit(bucket, REDEEM_LIMIT, REDEEM_WINDOW_SECONDS))) {
    throw new RecoveryRefused("Too many tries. Wait a few minutes, then try again.", 429);
  }
  const code = normaliseCode(text);
  if (!code) throw new RecoveryRefused("That isn't a backup code.", 400);
  const candidates = await deps.candidates(deps.userId);
  let match: number | null = null;
  for (const candidate of candidates) {
    const hash = await deps.sha256Hex(candidate.salt + code);
    // Every candidate is hashed and compared; the match is noted, never returned early.
    if (constantTimeEqual(hash, candidate.code_hash) && match === null) match = candidate.id;
  }
  if (match === null || !(await deps.spend(deps.userId, match, sessionId))) {
    throw new RecoveryRefused("That backup code didn't work.", 401);
  }
}

export async function codesLeft(deps: RecoveryDeps): Promise<number> {
  return deps.left(deps.userId);
}

/**
 * Remove one of the member's authenticators: with a code entered in the last ten minutes, or from a session verified
 * with a backup code in the last ten minutes (the authenticator is lost, so Supabase's own unenroll cannot be used).
 */
export async function removeFactor(deps: RecoveryDeps, factorId: string): Promise<void> {
  const nowSeconds = Math.floor(deps.now() / 1000);
  let allowed = hasFreshCode(deps.claims, nowSeconds);
  if (!allowed && deps.claims.session_id) {
    const at = await deps.recoveredAt(deps.claims.session_id, deps.userId);
    allowed = at !== null && nowSeconds - Math.floor(new Date(at).getTime() / 1000) <= FRESH_SECONDS;
  }
  if (!allowed) throw new RecoveryRefused("Enter a code from your authenticator, or a backup code, first.", 403);
  if (!(await deps.verifiedFactorIds(deps.userId)).includes(factorId)) throw new RecoveryRefused("That authenticator has already gone.", 404);
  await deps.deleteFactor(deps.userId, factorId);
}

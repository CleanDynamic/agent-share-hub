// G10: a durable per-IP limit for the functions anyone can call.
//
// Calls are counted per caller address in fixed windows by the database function
// edge_rate_limit_hit (migration 20261114120000_auth_hardening.sql), which only
// the service role may call. The key is the function's name and a SHA-256 hash of
// the address, so no address is stored or logged.
//
// If the store cannot answer, the call goes through and the failure is logged:
// a database fault must not stop people paying or reading. That is a choice, and
// docs/security/auth-settings.md says so.
//
// Pure TypeScript apart from cors.ts, so Vitest can load it. The store that talks
// to the database is rateLimitStore.ts (Deno only).

import { fail } from "./cors.ts";

export interface RateRule {
  /** Calls allowed per window, per address. */
  limit: number;
  windowSeconds: number;
}

export interface RateStore {
  /** Count one call; true while within the limit. */
  hit: (bucket: string, limit: number, windowSeconds: number) => Promise<boolean>;
}

const MAX_IP_LENGTH = 64;

/**
 * The caller's address: Cloudflare's header first, then x-real-ip, then the first
 * x-forwarded-for entry (which a caller can write, so it is the last resort).
 */
export function clientIp(req: Request): string {
  const raw =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0];
  const ip = raw.trim().slice(0, MAX_IP_LENGTH);
  return ip || "unknown";
}

export async function bucketFor(fn: string, ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${fn}:${hex}`;
}

/** Null when the call may go on; otherwise the 429 to answer with. */
export async function limitByIp(req: Request, fn: string, rule: RateRule, store: RateStore): Promise<Response | null> {
  try {
    const allowed = await store.hit(await bucketFor(fn, clientIp(req)), rule.limit, rule.windowSeconds);
    if (allowed) return null;
  } catch (err) {
    console.error(`${fn}: the rate limit could not be checked:`, (err as Error)?.message ?? "unknown error");
    return null;
  }
  const res = fail(req, 429, "Too many requests. Try again later.");
  res.headers.set("Retry-After", String(rule.windowSeconds));
  return res;
}

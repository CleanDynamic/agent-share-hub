// G29: the five conditions, faked in the browser. Nothing reaches the live Supabase project: every request to its host is
// answered (or aborted, or held) here, every other outside host is aborted, and the realtime socket is mocked.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page, Route } from "@playwright/test";

export type Condition = "aborted" | "server-error" | "never" | "refused" | "empty";
export const CONDITIONS: readonly Condition[] = ["aborted", "server-error", "never", "refused", "empty"];

const HERE = path.dirname(fileURLToPath(import.meta.url));

function supabaseUrl(): string {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
  const env = path.resolve(HERE, "../../.env");
  if (fs.existsSync(env)) {
    for (const line of fs.readFileSync(env, "utf8").split("\n")) {
      const m = line.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("VITE_SUPABASE_URL is not set and .env does not define it.");
}

const SUPABASE_HOST = new URL(supabaseUrl()).hostname;
const PROJECT_REF = SUPABASE_HOST.split(".")[0];

/** The member every signed-in page type runs as. */
export const MEMBER = {
  id: "00000000-0000-4000-8000-00000000beef",
  email: "member@example.test",
};

function fakeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.signature`;
}

const USER = {
  id: MEMBER.id,
  aud: "authenticated",
  role: "authenticated",
  email: MEMBER.email,
  email_confirmed_at: new Date(0).toISOString(),
  phone: "",
  confirmed_at: new Date(0).toISOString(),
  last_sign_in_at: new Date(0).toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
  is_anonymous: false,
};

function session() {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  return {
    access_token: fakeJwt({ sub: MEMBER.id, exp, role: "authenticated", aud: "authenticated", session_id: "00000000-0000-4000-8000-0000000000s1" }),
    token_type: "bearer",
    expires_in: 60 * 60 * 24,
    expires_at: exp,
    refresh_token: "pagestate-refresh-token",
    user: USER,
  };
}

/** A signed-in session in storage, with a future expiry, before the app's first script runs. */
export async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key as string, value as string);
      } catch {
        /* a storage-less context is a harness problem */
      }
    },
    [`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session())] as const,
  );
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*",
  "access-control-expose-headers": "content-range, x-total-count",
};

const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: "application/json", headers: { ...CORS, ...headers }, body: body === undefined ? "" : JSON.stringify(body) }).catch(() => undefined);

/** RPCs whose answer is a scalar or an object, answered with the empty value of that shape. */
const SCALAR_RPCS: Record<string, unknown> = {
  is_admin: false,
  is_blocked_between: false,
  get_quest_state: null,
  collection_saved_by_count: 0,
};

function answerEmpty(route: Route): Promise<unknown> {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  const p = url.pathname;

  if (p.startsWith("/auth/v1/")) {
    if (p.endsWith("/user")) return json(route, 200, USER);
    if (p.endsWith("/user/oauth/grants")) return json(route, 200, []);
    if (p.endsWith("/token")) return json(route, 200, session());
    if (p.endsWith("/logout")) return json(route, 204, undefined);
    return json(route, 200, {});
  }
  if (p.startsWith("/functions/v1/")) {
    if (p.endsWith("/my-sessions")) return json(route, 200, { sessions: [] });
    return json(route, 200, {});
  }
  if (p.startsWith("/storage/v1/")) return json(route, 200, []);
  if (p.startsWith("/rest/v1/rpc/")) {
    const name = p.slice("/rest/v1/rpc/".length);
    return json(route, 200, name in SCALAR_RPCS ? SCALAR_RPCS[name] : [], { "content-range": "*/0" });
  }
  if (p.startsWith("/rest/v1/")) {
    if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...CORS, "content-range": "*/0" }, body: "" }).catch(() => undefined);
    const single = (request.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    if (method === "GET" && single) {
      return json(route, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows", hint: null });
    }
    if (method === "GET") return json(route, 200, [], { "content-range": "*/0" });
    // A write: answered as if it went through, with nothing.
    return json(route, single ? 200 : 201, single ? {} : []);
  }
  return json(route, 200, {});
}

function answerRefused(route: Route): Promise<unknown> {
  const p = new URL(route.request().url()).pathname;
  if (p.endsWith("/auth/v1/token")) {
    return json(route, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" });
  }
  if (p.startsWith("/auth/v1/")) {
    return json(route, 401, { code: 401, error_code: "bad_jwt", msg: "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired" });
  }
  if (p.startsWith("/functions/v1/")) return json(route, 401, { code: 401, message: "Invalid JWT" });
  return json(route, 401, { code: "PGRST301", message: "JWT expired", details: null, hint: null });
}

/** Install `condition` on the page. Every request to the Supabase host is decided here; other outside hosts are aborted. */
export async function installCondition(page: Page, condition: Condition): Promise<void> {
  await page.route(
    (url) => url.hostname !== "127.0.0.1" && url.hostname !== "localhost",
    async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== SUPABASE_HOST) return route.abort("blockedbyclient").catch(() => undefined);
      if (route.request().method() === "OPTIONS" && condition !== "never" && condition !== "aborted") {
        return route.fulfill({ status: 204, headers: CORS }).catch(() => undefined);
      }
      switch (condition) {
        case "aborted":
          return route.abort("failed").catch(() => undefined);
        case "server-error":
          return json(route, 500, { code: "XX000", message: "internal server error", details: null, hint: null });
        case "never":
          return; // left pending for the life of the page
        case "refused":
          return answerRefused(route);
        case "empty":
          return answerEmpty(route);
      }
    },
  );

  await page.routeWebSocket(/\/realtime\/v1\//, (ws) => {
    if (condition === "aborted" || condition === "server-error" || condition === "refused") {
      ws.close();
      return;
    }
    if (condition === "never") return; // connected to nothing; no reply ever comes
    ws.onMessage((raw) => {
      let frame: unknown[];
      try {
        frame = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!Array.isArray(frame)) return;
      const [joinRef, ref, topic, event, payload] = frame as [unknown, unknown, string, string, { config?: { postgres_changes?: Record<string, unknown>[] } }];
      const response =
        event === "phx_join"
          ? { postgres_changes: (payload?.config?.postgres_changes ?? []).map((binding, at) => ({ ...binding, id: at + 1 })) }
          : {};
      ws.send(JSON.stringify([joinRef ?? null, ref, topic, "phx_reply", { status: "ok", response }]));
    });
  });
}

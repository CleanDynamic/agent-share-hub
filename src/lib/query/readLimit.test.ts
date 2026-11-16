// G1, G2: the read limit, on its own.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { READ_TIMEOUT_MS, ReadTimeoutError, createSiteFetch, isRead, isReadTimeout } from "./readLimit";

const BASE = "https://project.supabase.co";

/** A fetch that never answers, but stops when its signal does, as the browser's does. */
function neverFetch(calls: { signal?: AbortSignal | null }[] = []): typeof fetch {
  return ((_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ signal: init?.signal });
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new DOMException("aborted", "AbortError")));
    });
  }) as typeof fetch;
}

describe("READ_TIMEOUT_MS", () => {
  it("is 10 seconds", () => {
    expect(READ_TIMEOUT_MS).toBe(10_000);
  });
});

describe("createSiteFetch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rejects a read that never answers at the limit, with ReadTimeoutError", async () => {
    const siteFetch = createSiteFetch(() => neverFetch());
    const settled = vi.fn();
    const read = siteFetch(`${BASE}/rest/v1/builds?select=id`, { method: "GET" }).then(settled, (error) => {
      settled(error);
      return error;
    });
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const error = await read;
    expect(error).toBeInstanceOf(ReadTimeoutError);
    expect(isReadTimeout(error)).toBe(true);
    expect((error as Error).name).not.toBe("AbortError");
  });

  it("aborts the request it gave up on", async () => {
    const calls: { signal?: AbortSignal | null }[] = [];
    const read = createSiteFetch(() => neverFetch(calls))(`${BASE}/rest/v1/builds`, { method: "GET" }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    await read;
    expect(calls[0].signal?.aborted).toBe(true);
  });

  it("times the body too: a response whose body never ends is a failed read", async () => {
    const stalled = new ReadableStream({ start() {} });
    const base = (() => Promise.resolve(new Response(stalled, { status: 200 }))) as unknown as typeof fetch;
    const read = createSiteFetch(() => base)(`${BASE}/rest/v1/builds`, { method: "GET" }).catch((error) => error);
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS);
    expect(isReadTimeout(await read)).toBe(true);
  });

  it("hands on an answer that came in time, body and status whole", async () => {
    const base = (() => Promise.resolve(new Response('[{"id":1}]', { status: 206, headers: { "content-range": "0-0/9" } }))) as unknown as typeof fetch;
    const response = await createSiteFetch(() => base)(`${BASE}/rest/v1/builds`, { method: "GET" });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("0-0/9");
    expect(await response.json()).toEqual([{ id: 1 }]);
  });

  it("a cancel by the caller is the caller's AbortError, not a timeout", async () => {
    const caller = new AbortController();
    const read = createSiteFetch(() => neverFetch())(`${BASE}/rest/v1/builds`, { method: "GET", signal: caller.signal }).catch((error) => error);
    caller.abort(new DOMException("The page went", "AbortError"));
    const error = await read;
    expect((error as DOMException).name).toBe("AbortError");
    expect(isReadTimeout(error)).toBe(false);
  });

  it("does not cut a write (G2)", async () => {
    const settled = vi.fn();
    void createSiteFetch(() => neverFetch())(`${BASE}/rest/v1/builds`, { method: "PATCH", body: "{}" }).then(settled, settled);
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS * 6);
    expect(settled).not.toHaveBeenCalled();
  });
});

describe("isRead", () => {
  const cases: [string, string, unknown, boolean][] = [
    ["/rest/v1/builds?select=id", "GET", undefined, true],
    ["/rest/v1/builds?select=id", "HEAD", undefined, true],
    ["/rest/v1/builds", "POST", "{}", false],
    ["/rest/v1/builds?id=eq.1", "PATCH", "{}", false],
    ["/rest/v1/builds?id=eq.1", "DELETE", undefined, false],
    ["/rest/v1/rpc/gallery_facets", "POST", "{}", true],
    ["/rest/v1/rpc/create_post", "POST", "{}", false],
    ["/rest/v1/rpc/not_listed_anywhere", "POST", "{}", false],
    ["/functions/v1/my-sessions", "POST", JSON.stringify({ action: "list" }), true],
    ["/functions/v1/my-sessions", "POST", JSON.stringify({ action: "revoke", sessionId: "x" }), false],
    ["/functions/v1/parse-transcript", "POST", "{}", false],
    ["/storage/v1/object/sign/build-media", "POST", "{}", true],
    ["/storage/v1/object/list/build-media", "POST", "{}", true],
    ["/storage/v1/object/build-media/a.png", "POST", "binary", false],
    ["/storage/v1/object/build-media/a.png", "GET", undefined, false],
    ["/auth/v1/user", "GET", undefined, true],
    ["/auth/v1/token?grant_type=refresh_token", "POST", "{}", false],
    ["/auth/v1/logout?scope=local", "POST", undefined, false],
  ];
  it.each(cases)("%s %s is a read: %s", (path, method, body, read) => {
    expect(isRead(`${BASE}${path}`, method, body)).toBe(read);
  });
});

describe("isReadTimeout", () => {
  it("reads the PostgREST form, the cause chain and an Edge Function error's context", () => {
    expect(isReadTimeout({ message: "ReadTimeoutError: no answer after 10000 ms", code: "" })).toBe(true);
    expect(isReadTimeout(Object.assign(new Error("listBuilds failed"), { cause: { message: "ReadTimeoutError: no answer" } }))).toBe(true);
    expect(isReadTimeout({ name: "FunctionsFetchError", context: new ReadTimeoutError(10) })).toBe(true);
    expect(isReadTimeout(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(isReadTimeout(new TypeError("Failed to fetch"))).toBe(false);
    expect(isReadTimeout({ code: "57014", message: "canceling statement due to statement timeout" })).toBe(false);
  });
});

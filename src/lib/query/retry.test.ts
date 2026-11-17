// D3: the query client's retry rule, and a timeout told apart from a cancel.
// A read cut by the time limit fails at once (no retry) and is reported once; any other failure is retried once; a
// refusal is not retried; a read the page cancelled ends silently, with nothing reported.
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { QUERY_DEFAULTS, retryRead } from "./client";
import { ReadTimeoutError } from "./readLimit";

function client() {
  const onError = vi.fn();
  const queryClient = new QueryClient({ queryCache: new QueryCache({ onError }), defaultOptions: { queries: { ...QUERY_DEFAULTS, retryDelay: 0 } } });
  return { queryClient, onError };
}

/** PostgREST's form of a read the limit cut: the error survives as its name and message. */
const timedOut = () => ({ message: "ReadTimeoutError: no answer after 10000 ms", details: "", hint: "", code: "" });

describe("retryRead", () => {
  it("does not retry a timeout, retries anything else once, never retries a refusal", () => {
    expect(retryRead(0, new ReadTimeoutError(10_000))).toBe(false);
    expect(retryRead(0, Object.assign(new Error("listBuilds failed"), { cause: timedOut() }))).toBe(false);
    expect(retryRead(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(retryRead(1, new TypeError("Failed to fetch"))).toBe(false);
    expect(retryRead(0, { code: "42501", message: "permission denied" })).toBe(false);
    expect(retryRead(0, { status: 500, message: "server error" })).toBe(true);
  });

  it("is the query client's default", () => {
    expect(QUERY_DEFAULTS.retry).toBe(retryRead);
  });
});

describe("a query that times out, fails, or is cancelled", () => {
  it("a timeout: failed after one attempt, reported once", async () => {
    const { queryClient, onError } = client();
    const queryFn = vi.fn(async () => {
      throw Object.assign(new Error("listBuilds failed"), { cause: timedOut() });
    });
    await queryClient.prefetchQuery({ queryKey: ["timeout"], queryFn, retry: QUERY_DEFAULTS.retry });
    const state = queryClient.getQueryState(["timeout"]);
    expect(state?.status).toBe("error");
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("an ordinary failure: tried twice, then failed, reported once", async () => {
    const { queryClient, onError } = client();
    const queryFn = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await queryClient.prefetchQuery({ queryKey: ["failure"], queryFn, retry: QUERY_DEFAULTS.retry });
    expect(queryClient.getQueryState(["failure"])?.status).toBe("error");
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("a cancel: no failed state, nothing reported", async () => {
    const { queryClient, onError } = client();
    const queryFn = vi.fn(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("The page went", "AbortError")))),
    );
    const fetching = queryClient.fetchQuery({ queryKey: ["cancel"], queryFn, retry: QUERY_DEFAULTS.retry }).catch(() => undefined);
    await Promise.resolve();
    await queryClient.cancelQueries({ queryKey: ["cancel"] });
    await fetching;
    expect(queryClient.getQueryState(["cancel"])?.status).not.toBe("error");
    expect(onError).not.toHaveBeenCalled();
  });
});

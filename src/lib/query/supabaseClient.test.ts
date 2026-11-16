// G1, and the one retry (D3): the app's own Supabase client, created in src/integrations/supabase/client.ts.
//
// 1. A failed GET is attempted ONCE by the client. postgrest-js retries a GET or HEAD that gets no answer three times
//    by itself (1 s, 2 s, 4 s), and supabase-js passes no option through to stop it; client.ts switches it off so the
//    query client's one retry is the only one. If a supabase-js update exposes the option, this test says so.
// 2. A read that never answers comes back as an ordinary failed request at READ_TIMEOUT_MS, recognisably a timeout.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { READ_TIMEOUT_MS, isReadTimeout } from "./readLimit";

// NOTHING REACHES THE NETWORK. The global fetch is replaced before the client module is imported (the client may keep
// the fetch it finds when it is created), and each test says what it answers.
let answer: typeof fetch = () => Promise.reject(new TypeError("no answer set"));
const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) => answer(input, init));
vi.stubGlobal("fetch", fetchSpy);

let supabase: (typeof import("@/integrations/supabase/client"))["supabase"];

describe("the Supabase client", () => {
  // The auth client starts up on real timers (it reads storage under a lock); the reads are then timed on fake ones.
  beforeAll(async () => {
    ({ supabase } = await import("@/integrations/supabase/client"));
    await supabase.auth.getSession();
  });
  beforeEach(() => {
    fetchSpy.mockClear();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => vi.useRealTimers());

  it("attempts a failed GET once", async () => {
    answer = () => Promise.reject(new TypeError("Failed to fetch"));
    // A builder sends nothing until it is awaited: `.then` starts it.
    const read = supabase.from("builds").select("id").then((result) => result);
    await vi.advanceTimersByTimeAsync(30_000);
    const { error, status } = await read;
    expect(error).not.toBeNull();
    expect(status).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("turns a read that never answers into a failed request at the limit", async () => {
    answer = (_input, init) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    let done = false;
    const read = supabase
      .from("builds")
      .select("id")
      .then((result) => {
        done = true;
        return result;
      });
    await vi.advanceTimersByTimeAsync(READ_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const { error, data, status } = await read;
    expect(data).toBeNull();
    expect(status).toBe(0);
    expect(isReadTimeout(error)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

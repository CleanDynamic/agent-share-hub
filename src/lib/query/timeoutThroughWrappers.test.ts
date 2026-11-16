// D3: a read the time limit cut stays recognisable after the data layer wraps it, so the query client does not retry
// it (a second 10-second wait). One test per wrapper that sits on a read path.
import { describe, expect, it, vi } from "vitest";

import { ReadTimeoutError, isReadTimeout } from "./readLimit";

/** What postgrest-js returns for a read the limit cut: status 0, the thrown error kept as "<name>: <message>". */
const postgrestTimeout = () => ({
  error: { message: "ReadTimeoutError: no answer after 10000 ms", details: "", hint: "", code: "" },
  status: 0,
});

const { invoke, from } = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke }, from } }));

describe("a timeout passes through", () => {
  it("socialError (lib/social)", async () => {
    const { socialError } = await import("@/lib/social/types");
    const error = socialError("listCollections", postgrestTimeout());
    expect(error.kind).toBe("failed");
    expect(isReadTimeout(error)).toBe(true);
  });

  it("postLayerError (lib/openbuilds)", async () => {
    const { postLayerError } = await import("@/lib/openbuilds/types");
    expect(isReadTimeout(postLayerError("getSpace", postgrestTimeout()))).toBe(true);
  });

  it("SettingsError, from the devices list (lib/settings)", async () => {
    // functions-js: a fetch that threw becomes a FunctionsFetchError whose context is the thrown error.
    invoke.mockResolvedValueOnce({ data: null, error: { name: "FunctionsFetchError", message: "Failed to send a request to the Edge Function", context: new ReadTimeoutError(10_000) } });
    const { listMySessions } = await import("@/lib/settings/account");
    const { SettingsError } = await import("@/lib/settings/useAction");
    const error = await listMySessions().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SettingsError);
    expect(isReadTimeout(error)).toBe(true);
  });

  it("getMakerName (lib/profile)", async () => {
    const chain = { select: () => chain, eq: () => chain, limit: () => chain, maybeSingle: async () => ({ data: null, ...postgrestTimeout() }) };
    from.mockReturnValueOnce(chain);
    const { getMakerName } = await import("@/lib/profile/makerName");
    const error = await getMakerName("someone").catch((caught: unknown) => caught);
    expect(isReadTimeout(error)).toBe(true);
  });

  it("buildLayerError and every wrapper that writes the message after its own words", async () => {
    const { buildLayerError } = await import("@/lib/build/types");
    expect(isReadTimeout(buildLayerError("getBuild", postgrestTimeout().error))).toBe(true);
    // listHandles, findRunByHandle: "<operation> failed: <message>", no cause.
    expect(isReadTimeout(new Error("listHandles failed: ReadTimeoutError: no answer after 10000 ms"))).toBe(true);
  });

  it("progressFailure (lib/progress)", async () => {
    const { progressFailure } = await import("@/lib/progress/errors");
    expect(isReadTimeout(progressFailure("getMyWeekEvents", "u1", postgrestTimeout()))).toBe(true);
  });

  it("isFollowingMaker's failure (lib/profile/follow)", async () => {
    const chain = { select: () => chain, eq: () => chain, limit: async () => ({ data: null, ...postgrestTimeout() }) };
    from.mockReturnValueOnce(chain);
    const { isFollowingMaker } = await import("@/lib/profile/follow");
    expect(isReadTimeout(await isFollowingMaker("u1", "u2").catch((caught: unknown) => caught))).toBe(true);
  });

  it("auth-js's wrapper, which keeps only the message (AuthRetryableFetchError)", () => {
    const thrown = new ReadTimeoutError(10_000);
    // auth-js: `new AuthRetryableFetchError(_getErrorMessage(error), 0)`, the thrown error's message and nothing else.
    expect(isReadTimeout({ name: "AuthRetryableFetchError", message: thrown.message, status: 0 })).toBe(true);
  });

  it("and nothing else is taken for one", async () => {
    const { socialError } = await import("@/lib/social/types");
    expect(isReadTimeout(socialError("listCollections", { error: { code: "57014", message: "canceling statement" }, status: 500 }))).toBe(false);
    expect(isReadTimeout(new Error("a sentence about timeouts"))).toBe(false);
  });
});

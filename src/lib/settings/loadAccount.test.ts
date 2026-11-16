// G1: Settings' Account section reads the member in one auth request, so a read the time limit cut fails the section at
// the limit. Two parallel auth calls wait on auth-js's lock one after the other, and auth-js answers a failure instead of
// throwing it, so Promise.all waited for the second: the section failed at about 15 s.
import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), getUserIdentities: vi.fn(), getSession: vi.fn(async () => ({ data: { session: { access_token: "token" } }, error: null })) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

import { loadAccount } from "./account";

describe("loadAccount", () => {
  it("fails as soon as the one auth read fails, without waiting on another", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", message: "ReadTimeoutError: no answer after 10000 ms", status: 0 } });
    auth.getUserIdentities.mockReturnValue(new Promise(() => undefined));
    const settled = await Promise.race([loadAccount().then(() => "resolved", () => "rejected"), new Promise((resolve) => setTimeout(() => resolve("waiting"), 50))]);
    expect(settled).toBe("rejected");
  });

  it("takes the sign-in methods from the member it read", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { email: "ada@example.com", identities: [{ id: "i1", identity_id: "i1", provider: "github", identity_data: {} }] } }, error: null });
    auth.getUserIdentities.mockReturnValue(new Promise(() => undefined));
    const account = await loadAccount();
    expect(account.email).toBe("ada@example.com");
    expect(account.methods.length).toBe(1);
    expect(auth.getUserIdentities).not.toHaveBeenCalled();
    // With the session's token, so the read does not hold auth-js's lock while it is out.
    expect(auth.getUser).toHaveBeenCalledWith("token");
  });
});

// Mobile 28 D: asking the database to count a view. Signed in only, once a page load per build, never for a crawler, never
// a thrown error on the page, and nothing written to browser storage.

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn(async () => ({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...(args as [])) } }));

import { forgetAskedViews, recordBuildView } from "./buildViews";

beforeEach(() => {
  rpc.mockClear();
  forgetAskedViews();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("recordBuildView", () => {
  it("asks once a page load for a build, signed in", async () => {
    await recordBuildView("b1", { signedIn: true });
    await recordBuildView("b1", { signedIn: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("record_build_view", { p_build: "b1" });
  });

  it("asks nothing when signed out, and keeps nothing in the browser either way", async () => {
    await recordBuildView("b1", { signedIn: false });
    expect(rpc).not.toHaveBeenCalled();
    await recordBuildView("b2", { signedIn: true });
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("asks nothing for a crawler", async () => {
    const agent = vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (compatible; Googlebot/2.1)");
    await recordBuildView("b1", { signedIn: true });
    expect(rpc).not.toHaveBeenCalled();
    agent.mockRestore();
  });

  it("never throws when the database refuses or the request fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    rpc.mockImplementationOnce(async () => ({ error: { code: "42883" } }));
    await expect(recordBuildView("b1", { signedIn: true })).resolves.toBeUndefined();
    rpc.mockImplementationOnce(async () => {
      throw new TypeError("offline");
    });
    await expect(recordBuildView("b2", { signedIn: true })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

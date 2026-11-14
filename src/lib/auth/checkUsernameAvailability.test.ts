// G13: the username check fails closed. A query error is "couldn't check", never "available".

import { beforeEach, describe, expect, it, vi } from "vitest";

// A plain function, not a spy: a spy that returns a rejected promise reports its own copy of the rejection.
let answer: () => Promise<unknown> = async () => ({ data: null, error: null });
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => answer() }) }) }) },
}));

import { checkUsernameAvailability } from "./checkUsernameAvailability";

beforeEach(() => {
  answer = async () => ({ data: null, error: null });
});

describe("checkUsernameAvailability", () => {
  it("is available when no profile has the name", async () => {
    await expect(checkUsernameAvailability("ada_l")).resolves.toEqual({ available: true });
  });

  it("is taken, with a suggestion, when a profile has it", async () => {
    answer = async () => ({ data: { id: "u-1" }, error: null });
    const result = await checkUsernameAvailability("ada_l");
    expect(result.available).toBe(false);
    expect(result.suggestion).toMatch(/^ada_l\d{3}$/);
    expect(result.checkFailed).toBeUndefined();
  });

  it("G13: fails closed on a query error: not available, and says it could not check", async () => {
    answer = async () => ({ data: null, error: { message: "timeout" } });
    await expect(checkUsernameAvailability("ada_l")).resolves.toEqual({ available: false, checkFailed: true });
  });

  it("G13: fails closed when the query throws", async () => {
    answer = async () => {
      throw new Error("network down");
    };
    await expect(checkUsernameAvailability("ada_l")).resolves.toEqual({ available: false, checkFailed: true });
  });
});

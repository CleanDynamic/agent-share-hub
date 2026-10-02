import { beforeEach, describe, expect, it, vi } from "vitest";

const rows: { data: unknown; error: unknown } = { data: [], error: null };
const limit = vi.fn(async () => rows);
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ limit }) }) }) },
}));

import { isSiteFrameKnown, isSiteFrameOn, loadSiteFrameFlag, resetSiteFrameFlag } from "./flags";

describe("site_frame flag", () => {
  beforeEach(() => {
    resetSiteFrameFlag();
    window.history.replaceState({}, "", "/");
    limit.mockClear();
    rows.data = [];
    rows.error = null;
  });

  it("is off before the row has loaded", () => {
    expect(isSiteFrameOn()).toBe(false);
  });

  it("is off when the row is missing", async () => {
    expect(await loadSiteFrameFlag()).toBe(false);
    expect(isSiteFrameOn()).toBe(false);
  });

  it("is on when the row is enabled, and reads the table once", async () => {
    rows.data = [{ key: "site_frame", enabled: true }];
    expect(await loadSiteFrameFlag()).toBe(true);
    expect(await loadSiteFrameFlag()).toBe(true);
    expect(isSiteFrameOn()).toBe(true);
    expect(limit).toHaveBeenCalledTimes(1);
  });

  it("is off when the read fails", async () => {
    rows.error = { message: "denied" };
    expect(await loadSiteFrameFlag()).toBe(false);
  });

  it("?frame=site and ?frame=flat override it for the session in development", () => {
    window.history.replaceState({}, "", "/?frame=site");
    expect(isSiteFrameOn()).toBe(true);
    window.history.replaceState({}, "", "/other");
    expect(isSiteFrameOn()).toBe(true);
    window.history.replaceState({}, "", "/?frame=flat");
    expect(isSiteFrameOn()).toBe(false);
  });

  it("is not known until the row has been read, and is known after a read that found nothing or failed", async () => {
    expect(isSiteFrameKnown()).toBe(false);
    await loadSiteFrameFlag();
    expect(isSiteFrameKnown()).toBe(true);

    resetSiteFrameFlag();
    rows.error = { message: "denied" };
    expect(isSiteFrameKnown()).toBe(false);
    await loadSiteFrameFlag();
    expect(isSiteFrameKnown()).toBe(true);
  });

  it("is known at once when a dev override decides it, with no read", () => {
    window.history.replaceState({}, "", "/?frame=site");
    expect(isSiteFrameKnown()).toBe(true);
    expect(limit).not.toHaveBeenCalled();
  });
});

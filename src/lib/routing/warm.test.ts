import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const load = vi.fn(async () => ({ default: () => null }));
const prefetch = vi.fn(async () => undefined);

vi.mock("./routeTable", async (original) => {
  const real = await original<typeof import("./routeTable")>();
  return { ...real, matchRoute: (path: string) => (path === "/drafts" ? { entry: { key: "drafts", signedIn: true, load, prefetch }, params: {} } : null) };
});

import { FRESH_MS, resetWarm, warmPath } from "./warm";

const client = new QueryClient();

beforeEach(() => {
  resetWarm();
  load.mockClear();
  prefetch.mockClear();
});

describe("warmPath", () => {
  it("starts the page's chunk and its reads once, however many times the link is touched while they are fresh", () => {
    warmPath("/drafts", client, "u1", 1_000);
    warmPath("/drafts", client, "u1", 2_000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith({}, client, { userId: "u1" });
  });

  it("starts them again once they are no longer fresh", () => {
    warmPath("/drafts", client, "u1", 1_000);
    warmPath("/drafts", client, "u1", 1_000 + FRESH_MS + 1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("opens the chunk but starts no reads for a reader who is not signed in, on a page that needs one", () => {
    warmPath("/drafts", client, null, 1_000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(prefetch).not.toHaveBeenCalled();
  });

  it("does nothing for an address that is not a page of the table", () => {
    expect(warmPath("/about", client, "u1")).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});

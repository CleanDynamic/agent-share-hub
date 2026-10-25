import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: "u1" } as { id: string } | null, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
const warmPath = vi.fn();
vi.mock("./warm", () => ({ warmPath: (...args: unknown[]) => warmPath(...args) }));
vi.mock("./idleLoad", () => ({ startIdleLoad: () => () => undefined }));
const clearKeptCache = vi.fn(async () => undefined);
const setKeptCacheUser = vi.fn();
vi.mock("@/lib/query/persist", () => ({ clearKeptCache: () => clearKeptCache(), setKeptCacheUser: (id: unknown) => setKeptCacheUser(id) }));

import { RouteWarmup } from "./RouteWarmup";

const client = new QueryClient();
const mount = () =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/drafts"]}>
        <RouteWarmup />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  warmPath.mockClear();
  clearKeptCache.mockClear();
  setKeptCacheUser.mockClear();
  Object.assign(auth, { user: { id: "u1" }, loading: false });
});

describe("RouteWarmup", () => {
  it("starts the page the address names, for the reader the session names", () => {
    mount();
    expect(warmPath).toHaveBeenCalledWith("/drafts", client, "u1");
    expect(setKeptCacheUser).toHaveBeenCalledWith("u1");
  });

  it("starts only the code, with nobody named, until the session is known", () => {
    Object.assign(auth, { user: null, loading: true });
    mount();
    expect(warmPath).toHaveBeenCalledWith("/drafts", client, null);
    expect(setKeptCacheUser).not.toHaveBeenCalled();
  });

  it("forgets what was kept when the reader signs out", () => {
    const view = mount();
    expect(clearKeptCache).not.toHaveBeenCalled();
    Object.assign(auth, { user: null });
    view.rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/drafts"]}>
          <RouteWarmup />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(clearKeptCache).toHaveBeenCalledTimes(1);
  });
});

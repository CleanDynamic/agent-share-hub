// UX-09 Q3: /openbuilds/requests while a request is open, /openbuilds once none is; a request's own page is never redirected.

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const read = vi.hoisted(() => ({ result: { data: [] as { id: string }[] | null, error: null as unknown } }));
const calls = vi.hoisted(() => ({ eq: [] as unknown[][], limit: [] as unknown[] }));

vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: () => chain,
    eq: (...args: unknown[]) => (calls.eq.push(args), chain),
    limit: (n: unknown) => (calls.limit.push(n), Promise.resolve(read.result)),
  };
  return { supabase: { from: () => chain } };
});
vi.mock("@/lib/routing/RoutePlaceholder", () => ({ RoutePlaceholder: () => null }));

import { OlderRequestsRoute } from "./OlderRequestsRoute";
import { hasOpenRequests } from "@/lib/bounty/openRequests";

const at = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/openbuilds" element={<p>OpenBuilds</p>} />
          <Route path="/openbuilds/requests" element={<OlderRequestsRoute><p>Older requests page</p></OlderRequestsRoute>} />
          <Route path="/openbuilds/:bountyId/solve" element={<p>A request</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  read.result = { data: [], error: null };
  calls.eq = [];
  calls.limit = [];
});

describe("hasOpenRequests", () => {
  it("reads at most one open request", async () => {
    read.result = { data: [{ id: "b1" }], error: null };
    await expect(hasOpenRequests()).resolves.toBe(true);
    expect(calls.eq).toEqual([["status", "open"]]);
    expect(calls.limit).toEqual([1]);
  });

  it("is false when none is open, and throws when the read fails", async () => {
    await expect(hasOpenRequests()).resolves.toBe(false);
    read.result = { data: null, error: { message: "boom" } };
    await expect(hasOpenRequests()).rejects.toThrow(/hasOpenRequests/);
  });
});

describe("OlderRequestsRoute", () => {
  it("keeps the requests page while a request is open", async () => {
    read.result = { data: [{ id: "b1" }], error: null };
    at("/openbuilds/requests");
    expect(screen.getByText("Older requests page")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText("Older requests page")).toBeInTheDocument();
  });

  it("sends the reader to /openbuilds once none is open", async () => {
    at("/openbuilds/requests");
    expect(await screen.findByText("OpenBuilds")).toBeInTheDocument();
    expect(screen.queryByText("Older requests page")).toBeNull();
  });

  it("keeps the page when the check fails", async () => {
    read.result = { data: null, error: { message: "boom" } };
    at("/openbuilds/requests");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByText("Older requests page")).toBeInTheDocument();
  });

  it("never redirects a request's own page", async () => {
    at("/openbuilds/b1/solve");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByText("A request")).toBeInTheDocument();
  });
});

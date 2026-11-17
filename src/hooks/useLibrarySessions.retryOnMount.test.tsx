// G20: the editor does not read the session library again on mount when the route has just seen that read fail: under a
// network that never answers, that second read held Sources' skeleton for another ten seconds. Try again still reads it.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const listLibrarySessions = vi.fn(async () => ({ sessions: [], hasMore: false }));
vi.mock("@/lib/build/sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/sessions")>()),
  listLibrarySessions: (...args: unknown[]) => (listLibrarySessions as (...a: unknown[]) => unknown)(...args),
}));

import { librarySessionsKey, useLibrarySessions } from "./useLibrarySessions";

function Reader({ retryOnMount }: { retryOnMount?: boolean }) {
  useLibrarySessions({ active: false, withUnfinished: false, retryOnMount });
  return null;
}

async function failedOnce(): Promise<QueryClient> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await client.prefetchInfiniteQuery({ queryKey: librarySessionsKey, queryFn: () => Promise.reject(new Error("no answer")), initialPageParam: 0 });
  return client;
}

describe("useLibrarySessions after a failed read", () => {
  it("with retryOnMount false, mounting does not read it again", async () => {
    const client = await failedOnce();
    listLibrarySessions.mockClear();
    render(
      <QueryClientProvider client={client}>
        <Reader retryOnMount={false} />
      </QueryClientProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(listLibrarySessions).not.toHaveBeenCalled();
  });

  it("by default it still reads again on mount, as Drafts and Home expect", async () => {
    const client = await failedOnce();
    listLibrarySessions.mockClear();
    render(
      <QueryClientProvider client={client}>
        <Reader />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(listLibrarySessions).toHaveBeenCalled());
  });
});

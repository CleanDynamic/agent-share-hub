// SV-03 P3: opening a draft. The composer's code and its data start together, the rebuild check is light, and the page's
// first-screen reads start in one go.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const order: string[] = [];
let resolveParent: (value: { id: string; parent_build_id: string | null } | null) => void = () => {};
const getBuildParent = vi.fn(() => {
  order.push("parent read started");
  return new Promise((resolve) => {
    resolveParent = resolve as typeof resolveParent;
  });
});
const getBuild = vi.fn(async () => null);

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));
vi.mock("@/lib/build/builds", () => ({
  getBuild: (...args: unknown[]) => getBuild(...(args as [])),
  getBuildParent: (...args: unknown[]) => (getBuildParent as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("@/components/shell/SiteFrame", () => ({ SiteFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("./composerOpen", () => ({ startComposerReads: vi.fn() }));
vi.mock("./SandboxPage", () => {
  order.push("composer chunk imported");
  return { default: () => <p>the composer</p> };
});
vi.mock("./ComposePage", () => ({ default: () => <p>the old composer</p> }));

import { ComposeRoute } from "./ComposeRoute";
import { startComposerReads } from "./composerOpen";

beforeEach(() => {
  order.length = 0;
  getBuildParent.mockClear();
  vi.mocked(startComposerReads).mockClear();
});
afterEach(cleanup);

function open(path = "/compose/b1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Routes>
          <Route path="/compose" element={<ComposeRoute legacy={<p>the legacy screen</p>} />}>
            <Route path=":buildId" element={null} />
            <Route path="new" element={null} />
          </Route>
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("ComposeRoute · opening a draft", () => {
  it("starts the composer's code and its data as soon as the route matches, before the rebuild check has answered", async () => {
    open();
    await waitFor(() => expect(order).toContain("composer chunk imported"));
    expect(getBuildParent).toHaveBeenCalledWith("b1");
    expect(startComposerReads).toHaveBeenCalledTimes(1);
    expect(vi.mocked(startComposerReads).mock.calls[0][1]).toBe("b1");
    // The check is still out: nothing waited for it.
    expect(screen.queryByText("the composer")).toBeNull();
  });

  it("opens the composer once the check says it is not a rebuild", async () => {
    open();
    await waitFor(() => expect(getBuildParent).toHaveBeenCalled());
    resolveParent({ id: "b1", parent_build_id: null });
    expect(await screen.findByText("the composer")).toBeInTheDocument();
  });

  it("opens the legacy screen for a rebuild, which the light check can tell", async () => {
    open();
    await waitFor(() => expect(getBuildParent).toHaveBeenCalled());
    resolveParent({ id: "b1", parent_build_id: "b0" });
    expect(await screen.findByText("the legacy screen")).toBeInTheDocument();
  });

  it("reads no draft's data for a new build: nothing exists yet", async () => {
    open("/compose/new");
    expect(await screen.findByText("the composer")).toBeInTheDocument();
    expect(getBuildParent).not.toHaveBeenCalled();
    expect(startComposerReads).not.toHaveBeenCalled();
  });
});

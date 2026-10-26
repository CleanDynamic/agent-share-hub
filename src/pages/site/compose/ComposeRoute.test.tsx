// SV-03 P3: opening a draft. The composer's code and its data start together, the rebuild check is light, and the page's
// first-screen reads start in one go.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
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

const auth = { isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/lib/build/builds", () => ({
  getBuild: (...args: unknown[]) => getBuild(...(args as [])),
  getBuildParent: (...args: unknown[]) => (getBuildParent as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("./ComposeSkeleton", () => ({ ComposeSkeleton: () => <p>the composer skeleton</p> }));
vi.mock("./composerOpen", () => ({ startComposerReads: vi.fn(), startLibraryRead: vi.fn() }));
vi.mock("@/hooks/useNodeType", () => ({ fetchNodeTypes: vi.fn(async () => []) }));
const mounts = { count: 0 };
vi.mock("./SandboxPage", async () => {
  order.push("composer chunk imported");
  const { useEffect } = await import("react");
  const { useNavigate } = await import("react-router-dom");
  function Composer() {
    const navigate = useNavigate();
    useEffect(() => {
      mounts.count += 1;
    }, []);
    return (
      <p>
        the composer
        <button type="button" onClick={() => navigate("/compose/b2", { replace: true })}>
          make the draft
        </button>
      </p>
    );
  }
  return { default: Composer };
});
vi.mock("./ComposePage", () => ({ default: () => <p>the old composer</p> }));

import { FrameChromeContext } from "@/components/shell/frameChrome";

import { librarySessionsKey } from "@/hooks/useLibrarySessions";

import { ComposeRoute, LIBRARY_SESSIONS_KEY } from "./ComposeRoute";
import { startComposerReads } from "./composerOpen";

const chrome = vi.fn();
let client: QueryClient;

beforeEach(() => {
  auth.loading = false;
  chrome.mockClear();
  order.length = 0;
  getBuildParent.mockClear();
  vi.mocked(startComposerReads).mockClear();
});
afterEach(cleanup);

/** The route as App.tsx mounts it: inside the frame's one boundary (FrameOutlet), whose placeholder is the skeleton. */
function open(path = "/compose/b1", { library = true }: { library?: boolean } = {}) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The session library Sources lists, as startLibraryRead leaves it (mocked here).
  if (library) client.setQueryData(LIBRARY_SESSIONS_KEY, { pages: [], pageParams: [] });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <FrameChromeContext.Provider value={chrome}>
          <Routes>
            <Route
              element={
                <Suspense fallback={<p>the composer skeleton</p>}>
                  <Outlet />
                </Suspense>
              }
            >
              <Route path="/compose" element={<ComposeRoute legacy={<p>the legacy screen</p>} />}>
                <Route path=":buildId" element={null} />
                <Route path="new" element={null} />
              </Route>
            </Route>
          </Routes>
        </FrameChromeContext.Provider>
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

  it("keeps the skeleton in the page's place until the record has arrived, then mounts the page", async () => {
    let resolveRecord: (value: unknown) => void = () => {};
    getBuild.mockImplementationOnce(() => new Promise((resolve) => (resolveRecord = resolve)) as never);
    open();
    await waitFor(() => expect(getBuildParent).toHaveBeenCalled());
    resolveParent({ id: "b1", parent_build_id: null });
    await waitFor(() => expect(getBuild).toHaveBeenCalled());
    expect(screen.queryByText("the composer")).toBeNull();
    resolveRecord({ build: { id: "b1" }, nodeTypes: [] });
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

describe("ComposeRoute · SV-04 P4, the one frame", () => {
  it("never blanks the window: the skeleton stands while the session is unknown and while the rebuild check runs", async () => {
    auth.loading = true;
    const first = open();
    expect(screen.getByText("the composer skeleton")).toBeInTheDocument();
    first.unmount();
    auth.loading = false;
    open();
    await waitFor(() => expect(getBuildParent).toHaveBeenCalled());
    expect(screen.getByText("the composer skeleton")).toBeInTheDocument();
    expect(document.querySelector('[style*="position: fixed"]')).toBeNull();
  });

  it("hides the frame's chrome for the legacy workspace, and only for it", async () => {
    open();
    await waitFor(() => expect(getBuildParent).toHaveBeenCalled());
    expect(chrome).not.toHaveBeenCalledWith(true);
    resolveParent({ id: "b1", parent_build_id: "b0" });
    expect(await screen.findByText("the legacy screen")).toBeInTheDocument();
    expect(chrome).toHaveBeenLastCalledWith(true);
  });

  it("keeps the page mounted when /compose/new becomes /compose/{id}", async () => {
    mounts.count = 0;
    open("/compose/new");
    expect(await screen.findByText("the composer")).toBeInTheDocument();
    const node = screen.getByText("the composer");
    fireEvent.click(screen.getByRole("button", { name: "make the draft" }));
    await waitFor(() => expect(getBuildParent).not.toHaveBeenCalled());
    expect(screen.getByText("the composer")).toBe(node);
    expect(mounts.count).toBe(1);
  });

  it("holds the skeleton until Sources' session library is in, so the page is never drawn with blocks in one corner", async () => {
    open("/compose/new", { library: false });
    expect(screen.getByText("the composer skeleton")).toBeInTheDocument();
    await act(async () => {
      client.setQueryData(LIBRARY_SESSIONS_KEY, { pages: [], pageParams: [] });
    });
    expect(await screen.findByText("the composer")).toBeInTheDocument();
  });

  it("watches the session library on the key useLibrarySessions reads", () => {
    expect(LIBRARY_SESSIONS_KEY).toEqual(librarySessionsKey);
  });
});

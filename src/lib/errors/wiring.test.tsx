// CA-29 Part 7. Every place that catches an error tells reportError, once, with
// where it happened.

import { MutationCache, QueryCache, QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reportError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/errors/report", () => ({ reportError }));

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteBoundary } from "@/components/routing/RouteBoundary";
import { PanelBoundary, PanelFailed } from "@/pages/site/compose/PanelBoundary";
import { installGlobalErrorReporting } from "@/lib/errors/globalHandlers";
import { reportingCaches } from "@/lib/errors/queryReporting";

function Bomb(): never {
  throw new Error("secret text the page was drawing");
}

beforeEach(() => {
  reportError.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CA-29 P7: boundaries", () => {
  it("a render error in a route reaches reportError with the route", () => {
    render(
      <MemoryRouter initialEntries={["/builds"]}>
        <RouteBoundary>
          <Bomb />
        </RouteBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("route-error")).toBeTruthy();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(reportError.mock.calls[0][1]).toEqual({ source: "boundary", boundary: "route", route: "/builds" });
  });

  it("a render error that reaches the app boundary reaches reportError with the path", () => {
    window.history.pushState({}, "", "/library");
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][1]).toEqual({ source: "boundary", boundary: "app", route: "/library" });
  });

  it("a render error in a panel reaches reportError with the panel and the route", () => {
    window.history.pushState({}, "", "/compose/new");
    render(
      <PanelBoundary panel="Post">
        <Bomb />
      </PanelBoundary>,
    );
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][1]).toEqual({ source: "boundary", boundary: "Post", route: "/compose/new" });
  });

  it("a panel whose query failed reports that query's error once, however often it redraws", () => {
    const error = new Error("boom");
    const { rerender } = render(<PanelFailed panel="Sources" error={error} onRetry={() => undefined} />);
    rerender(<PanelFailed panel="Sources" error={error} onRetry={() => undefined} />);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][0]).toBe(error);
    expect(reportError.mock.calls[0][1]).toMatchObject({ source: "boundary", boundary: "Sources" });
  });
});

describe("CA-29 P7: queries and mutations", () => {
  const client = () => new QueryClient({ ...reportingCaches(), defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  function Probe({ fail }: { fail: boolean }) {
    const query = useQuery({
      queryKey: ["builds", "listBuilds", "user-id-and-text"],
      queryFn: async () => {
        if (fail) throw new Error("boom");
        return 1;
      },
    });
    return <p>{query.isError ? "failed" : "ok"}</p>;
  }

  it("a failed query reaches reportError once, with only the first two key segments", async () => {
    const queryClient = client();
    const view = render(
      <QueryClientProvider client={queryClient}>
        <Probe fail />
        <Probe fail />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(view.getAllByText("failed").length).toBe(2));
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0][1]).toEqual({ source: "query", key: "builds/listBuilds", route: window.location.pathname });
  });

  it("a query that works reports nothing", async () => {
    render(
      <QueryClientProvider client={client()}>
        <Probe fail={false} />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("ok")).toBeTruthy());
    expect(reportError).not.toHaveBeenCalled();
  });

  it("a failed mutation reaches reportError once", async () => {
    function Save() {
      const mutation = useMutation({ mutationKey: ["builds", "saveBuild"], mutationFn: async () => { throw new Error("boom"); } });
      return <button onClick={() => mutation.mutate()}>save</button>;
    }
    render(
      <QueryClientProvider client={client()}>
        <Save />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("save"));
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1));
    expect(reportError.mock.calls[0][1]).toEqual({ source: "mutation", key: "builds/saveBuild", route: window.location.pathname });
  });

  it("the caches are a QueryCache and a MutationCache", () => {
    const caches = reportingCaches();
    expect(caches.queryCache).toBeInstanceOf(QueryCache);
    expect(caches.mutationCache).toBeInstanceOf(MutationCache);
  });
});

describe("CA-29 P7: the window", () => {
  // The dispatched errors are made up; the test runner must not count them as its own.
  const swallow = (event: Event) => event.preventDefault();
  beforeEach(() => window.addEventListener("error", swallow));
  afterEach(() => window.removeEventListener("error", swallow));

  it("reports an uncaught error and an unhandled rejection, and stops when told to", () => {
    const stop = installGlobalErrorReporting(window);
    const error = new TypeError("x");
    window.dispatchEvent(new ErrorEvent("error", { error, message: "x" }));
    const rejection = new Event("unhandledrejection") as Event & { reason: unknown };
    rejection.reason = new RangeError("y");
    window.dispatchEvent(rejection);
    expect(reportError).toHaveBeenCalledTimes(2);
    expect(reportError.mock.calls[0]).toEqual([error, { source: "window.error", route: window.location.pathname }]);
    expect(reportError.mock.calls[1][1]).toEqual({ source: "unhandledrejection", route: window.location.pathname });

    stop();
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("z") }));
    expect(reportError).toHaveBeenCalledTimes(2);
  });

  it("ignores the browser's own noise and errors from outside the bundle", () => {
    const stop = installGlobalErrorReporting(window);
    window.dispatchEvent(new ErrorEvent("error", { message: "ResizeObserver loop completed with undelivered notifications." }));
    window.dispatchEvent(new ErrorEvent("error", { message: "Script error.", filename: "chrome-extension://abc/content.js", error: new Error("ext") }));
    expect(reportError).not.toHaveBeenCalled();
    stop();
  });
});

// SV-01 Part 7. Errors are reported: kept in memory, printed in development,
// and sent to Sentry only when a DSN is set, and then without their words.

import { QueryCache, QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteBoundary } from "@/components/routing/RouteBoundary";
import { PanelBoundary } from "@/pages/site/compose/PanelBoundary";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { clearRecentErrors, recentErrors, reportError, sanitise } from "./report";
import { connectErrorReporting } from "./wire";

function Boom(): never {
  throw new Error("secret prompt: the maker's own words");
}

describe("SV-01 P7: reportError", () => {
  beforeEach(() => {
    clearRecentErrors();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps the last 50, newest last, without the error's words", () => {
    for (let i = 0; i < 60; i += 1) reportError(new Error(`words ${i}`), { source: "test", route: "/x" });
    const kept = recentErrors();
    expect(kept).toHaveLength(50);
    expect(JSON.stringify(kept)).not.toContain("words");
    expect(kept[49]).toMatchObject({ name: "Error", source: "test", route: "/x" });
  });

  it("keeps the code a database error carries, and nothing it says", () => {
    reportError({ code: "42501", message: "permission denied for table builds, row: my secret" }, { source: "query" });
    expect(recentErrors()[0]).toMatchObject({ code: "42501" });
    expect(JSON.stringify(recentErrors())).not.toContain("secret");
  });

  it("sanitise drops everything but identifiers", () => {
    expect(sanitise({ source: "s", route: "/r", buildId: "b", nodeType: "prompt", payload: "x", text: "y" } as never)).toEqual({ source: "s", route: "/r", buildId: "b", nodeType: "prompt" });
  });
});

describe("SV-01 P7: wiring", () => {
  beforeEach(() => {
    clearRecentErrors();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("a render error in a route reaches reportError with the route", () => {
    render(
      <MemoryRouter initialEntries={["/b/abc"]}>
        <RouteBoundary>
          <Boom />
        </RouteBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("route-error")).toBeInTheDocument();
    expect(recentErrors()).toHaveLength(1);
    expect(recentErrors()[0]).toMatchObject({ source: "route-boundary", route: "/b/abc" });
  });

  it("a render error in a panel and in the app reaches it too", () => {
    render(
      <ErrorBoundary>
        <PanelBoundary panel="Map">
          <Boom />
        </PanelBoundary>
      </ErrorBoundary>,
    );
    expect(recentErrors().map((e) => e.source)).toEqual(["panel-boundary"]);
    expect(recentErrors()[0].context).toBe("Map");
  });

  it("a failed query reaches it once", async () => {
    const client = new QueryClient({ queryCache: new QueryCache({ onError: connectErrorReporting().queryError }), defaultOptions: { queries: { retry: false } } });
    await client.fetchQuery({ queryKey: ["drafts", "list"], queryFn: () => Promise.reject(new Error("nope")) }).catch(() => {});
    expect(recentErrors()).toHaveLength(1);
    expect(recentErrors()[0]).toMatchObject({ source: "query", context: "drafts" });
  });

  it("window error and unhandledrejection reach it", () => {
    const stop = connectErrorReporting().listen(window);
    window.dispatchEvent(new ErrorEvent("error", { error: new TypeError("x"), message: "x" }));
    const rejection = new Event("unhandledrejection") as Event & { reason: unknown };
    rejection.reason = new RangeError("y");
    window.dispatchEvent(rejection);
    stop();
    expect(recentErrors().map((e) => [e.source, e.name])).toEqual([["window", "TypeError"], ["unhandledrejection", "RangeError"]]);
  });

  it("with no DSN, Sentry is never imported", async () => {
    const sentry = vi.fn();
    vi.doMock("@sentry/react", () => {
      sentry();
      return { init: vi.fn(), captureException: vi.fn() };
    });
    reportError(new Error("x"), { source: "test" });
    await new Promise((r) => setTimeout(r, 20));
    expect(sentry).not.toHaveBeenCalled();
  });
});

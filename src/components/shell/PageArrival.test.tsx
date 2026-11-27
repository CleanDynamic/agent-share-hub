// 29c: a phone's loading state has a ceiling. One fake clock.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PageArrival, SKELETON_CEILING_MS } from "./PageArrival";

function setPhone(on: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: on && query.includes("max-width: 767px"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function view(loading: boolean, onRetry?: () => void) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <PageArrival loading={loading} placeholder={<div>bones</div>} region="Builds" onRetry={onRetry}>
        {loading ? <div>bones</div> : <div>content</div>}
      </PageArrival>
    </QueryClientProvider>
  );
}

describe("PageArrival ceiling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    setPhone(false);
  });

  it("draws the failed state after 8 seconds of loading on a phone, and content replaces it when data lands", () => {
    setPhone(true);
    const { rerender } = render(view(true));
    act(() => void vi.advanceTimersByTime(SKELETON_CEILING_MS - 1));
    expect(screen.queryByText("That didn't load.")).toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByText("That didn't load.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    rerender(view(false));
    expect(screen.queryByText("That didn't load.")).toBeNull();
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("does not start while the data is cached, and does not apply off a phone", () => {
    setPhone(true);
    render(view(false));
    act(() => void vi.advanceTimersByTime(SKELETON_CEILING_MS * 2));
    expect(screen.queryByText("That didn't load.")).toBeNull();
  });

  it("leaves the desktop's loading state alone", () => {
    setPhone(false);
    render(view(true));
    act(() => void vi.advanceTimersByTime(SKELETON_CEILING_MS * 2));
    expect(screen.queryByText("That didn't load.")).toBeNull();
  });
});

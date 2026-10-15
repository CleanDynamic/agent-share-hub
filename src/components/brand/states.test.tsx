// UI-P37 — the three state primitives: skeleton, empty state, error state.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values);
// roles, text and behaviour on the rendered tree.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingRegion, Skeleton } from "./Skeleton";

const markup = (node: React.ReactElement) => renderToStaticMarkup(node);

const originalMatchMedia = window.matchMedia;

/** Answer every media query with `matches` for the queries named, and false for the rest. */
function stubMedia(matching: readonly string[]) {
  window.matchMedia = ((query: string) => ({
    matches: matching.some((fragment) => query.includes(fragment)),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  __resetMotionMediaCache();
}

beforeEach(() => {
  stubMedia([]);
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  __resetMotionMediaCache();
  vi.restoreAllMocks();
});

describe("Skeleton", () => {

  it("is a full row wide when no width is given, and takes another radius for an orb", () => {
    const html = markup(<Skeleton height={72} radius="50%" />);
    expect(html).toContain("width:100%");
    expect(html).toContain("border-radius:50%");
  });

  it("carries no raw colour and no blur", () => {
    const html = markup(<Skeleton height={10} />);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toMatch(/rgba?\(|backdrop-filter|blur/);
  });
});

describe("LoadingRegion", () => {
  it("is busy, and says what it is loading in words only assistive technology reads", () => {
    render(
      <LoadingRegion what="the visitors’ book" data-testid="region">
        <Skeleton height={10} />
      </LoadingRegion>,
    );
    const region = screen.getByTestId("region");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Loading the visitors’ book");
    expect(region).not.toHaveAttribute("role");
  });

  it("announces itself politely only when it is a whole page", () => {
    render(
      <LoadingRegion what="the build" announce data-testid="page">
        <Skeleton height={10} />
      </LoadingRegion>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading the build");
  });
});

describe("EmptyState", () => {

  it("draws no illustration and no icon", () => {
    const html = markup(<EmptyState line="No solutions yet." action={{ label: "Enter the gallery", onClick: () => {} }} />);
    expect(html).not.toMatch(/<svg|<img|<canvas/);
  });

  it("has no button at all without an action", () => {
    render(<EmptyState line="No solutions yet." />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("makes the action 44 tall on a phone, the touch floor", () => {
    stubMedia(["max-width: 767px"]);
    render(<EmptyState line="Nothing hung yet." action={{ label: "Enter the gallery", onClick: () => {} }} />);
    expect(screen.getByRole("button", { name: "Enter the gallery" }).style.height).toBe("44px");
  });
});

describe("ErrorState", () => {

  it("takes a truer sentence where a panel has one", () => {
    render(<ErrorState line="You don't have access to this." panel="The wall" onRetry={() => {}} />);
    expect(screen.getByText("You don't have access to this.")).toBeInTheDocument();
    expect(screen.queryByText("That didn't load.")).toBeNull();
  });

  it("never shows the exception: not its message, not its stack", () => {
    const failure = new Error("PGRST116: JSON object requested, multiple (or no) rows returned");
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorState panel="The build" onRetry={() => {}} error={failure} />);
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("PGRST116");
    expect(text).not.toContain("JSON object");
    expect(text).not.toMatch(/Error\b/);
    expect(text).not.toMatch(/\bat \S+:\d+/);
  });

  it("logs the real error to the console once, however often the panel re-renders", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("boom");
    const { rerender } = render(<ErrorState panel="The build" onRetry={() => {}} error={failure} />);
    rerender(<ErrorState panel="The build" onRetry={() => {}} error={failure} />);
    rerender(<ErrorState panel="The build" onRetry={() => {}} error={failure} />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toContain(failure);
  });

  it("logs a different error when the retry fails differently", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<ErrorState panel="The build" onRetry={() => {}} error={new Error("first")} />);
    rerender(<ErrorState panel="The build" onRetry={() => {}} error={new Error("second")} />);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("logs nothing when it was given nothing to log", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorState panel="The build" onRetry={() => {}} />);
    expect(spy).not.toHaveBeenCalled();
  });

  it("makes the retry 44 tall on a phone, the touch floor", () => {
    stubMedia(["max-width: 767px"]);
    render(<ErrorState panel="The wall" onRetry={() => {}} />);
    expect(screen.getByRole("button", { name: "Try again" }).style.height).toBe("44px");
  });
});

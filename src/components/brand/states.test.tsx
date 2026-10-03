// UI-P37 — the three state primitives: skeleton, empty state, error state.
//
// Styles are asserted through SSR markup (jsdom's cssstyle drops var() values);
// roles, text and behaviour on the rendered tree.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { EmptyState } from "./EmptyState";
import { DEFAULT_ERROR_LINE, ErrorState } from "./ErrorState";
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
  it("is a --recess block of the size it is given, radius 8 unless told otherwise", () => {
    const html = markup(<Skeleton width={84} height={54} />);
    expect(html).toContain("width:84px");
    expect(html).toContain("height:54px");
    expect(html).toContain("border-radius:8px");
    expect(html).toContain("background:var(--recess)");
  });

  it("is a full row wide when no width is given, and takes another radius for an orb", () => {
    const html = markup(<Skeleton height={72} radius="50%" />);
    expect(html).toContain("width:100%");
    expect(html).toContain("border-radius:50%");
  });

  it("pulses in opacity for 1.4s, forever, through the one keyframe in index.css", () => {
    const html = markup(<Skeleton height={10} />);
    expect(html).toMatch(/animation:skeletonPulse 1400ms [^;"]+ infinite/);
  });

  it("is still under prefers-reduced-motion: no animation at all", () => {
    stubMedia(["prefers-reduced-motion"]);
    const html = markup(<Skeleton height={10} />);
    expect(html).not.toContain("animation");
    expect(html).toContain("background:var(--recess)");
  });

  it("is hidden from assistive technology, and says so for the stylesheet's reduced-motion rule too", () => {
    const html = markup(<Skeleton height={10} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("data-bg-animated");
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
  it("is a centred column, 12 apart, padded 28px 20px", () => {
    const html = markup(<EmptyState line="Nothing hung yet." />);
    expect(html).toContain("flex-direction:column");
    expect(html).toContain("align-items:center");
    expect(html).toContain("text-align:center");
    expect(html).toContain("gap:12px");
    expect(html).toContain("padding:28px 20px");
  });

  it("says one sentence in the display face at 20px in --text", () => {
    const html = markup(<EmptyState line="Nothing hung yet." />);
    expect(html.match(/<p /g)).toHaveLength(1);
    expect(html).toContain("font-size:20px");
    expect(html).toContain("font-family:&#x27;Sentient&#x27;");
    expect(html).toContain("color:var(--text)");
    expect(html).toContain("Nothing hung yet.");
  });

  it("draws no illustration and no icon", () => {
    const html = markup(<EmptyState line="No solutions yet." action={{ label: "Enter the gallery", onClick: () => {} }} />);
    expect(html).not.toMatch(/<svg|<img|<canvas/);
  });

  it("has no button at all without an action", () => {
    render(<EmptyState line="No solutions yet." />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers at most one action: a secondary 36/13 button that does what it says", () => {
    const onClick = vi.fn();
    const html = markup(<EmptyState line="Nothing hung yet." action={{ label: "Enter the gallery", onClick }} />);
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain("height:36px");
    expect(html).toContain("font-size:13px");

    render(<EmptyState line="Nothing hung yet." action={{ label: "Enter the gallery", onClick }} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Enter the gallery" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("makes the action 44 tall on a phone, the touch floor", () => {
    stubMedia(["max-width: 767px"]);
    render(<EmptyState line="Nothing hung yet." action={{ label: "Enter the gallery", onClick: () => {} }} />);
    expect(screen.getByRole("button", { name: "Enter the gallery" }).style.height).toBe("44px");
  });
});

describe("ErrorState", () => {
  it("says That didn't load. in Figtree 14px --text, and names the panel in DM Mono 11px --label", () => {
    const html = markup(<ErrorState panel="The visitors’ book" onRetry={() => {}} />);
    expect(DEFAULT_ERROR_LINE).toBe("That didn't load.");
    expect(html).toContain("That didn&#x27;t load.");
    expect(html).toMatch(/<p style="[^"]*font-size:14px[^"]*color:var\(--text\)/);
    expect(html).toMatch(/<span style="[^"]*font-size:11px[^"]*color:var\(--label\)[^"]*">The visitors’ book<\/span>/);
    expect(html).toContain("&#x27;DM Mono&#x27;");
  });

  it("is a column, 10 apart", () => {
    const html = markup(<ErrorState panel="The wall" onRetry={() => {}} />);
    expect(html).toContain("flex-direction:column");
    expect(html).toContain("gap:10px");
  });

  it("has one secondary 34/12 Try again that calls the retry", () => {
    const onRetry = vi.fn();
    const html = markup(<ErrorState panel="The wall" onRetry={onRetry} />);
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain("height:34px");
    expect(html).toContain("font-size:12px");

    render(<ErrorState panel="The wall" onRetry={onRetry} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("takes a truer sentence where a panel has one", () => {
    render(<ErrorState line="You don't have access to this." panel="The wall" onRetry={() => {}} />);
    expect(screen.getByText("You don't have access to this.")).toBeInTheDocument();
    expect(screen.queryByText("That didn't load.")).toBeNull();
  });

  it("is a polite status, so a failure that arrives late is announced, with its panel's name in it", () => {
    render(<ErrorState panel="Streak" onRetry={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Streak");
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

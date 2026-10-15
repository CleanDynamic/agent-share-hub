// UI-P97 — the three state primitives under the refined look.
//
// Loading is a flat `--well` block that never moves; empty is one 13 `--text` line and at most one secondary action;
// error is one sentence and Try again. Styles through SSR markup; the look is chosen by the URL, which a /dev address
// can set.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingRegion, Skeleton } from "./Skeleton";

const at = (look: "refined" | "current", node: React.ReactElement) => (
  <MemoryRouter initialEntries={[`/dev/kit/pages/home?look=${look}`]}>{node}</MemoryRouter>
);
const markup = (look: "refined" | "current", node: React.ReactElement) => renderToStaticMarkup(at(look, node));

describe("Skeleton, refined", () => {
  it("is a flat --well block: no animation and no gradient", () => {
    const html = markup("refined", <Skeleton width={120} height={13} />);
    expect(html).toContain("background:var(--well)");
    expect(html).not.toContain("animation");
    expect(html).not.toContain("gradient");
    expect(html).not.toContain("data-bg-animated");
  });

  it("names the region that holds it", () => {
    render(at("refined", <LoadingRegion what="the builds" announce><Skeleton height={13} /></LoadingRegion>));
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Loading the builds")).toBeTruthy();
  });
});

describe("EmptyState, refined", () => {
  it("is one 13 --text line and one secondary action", () => {
    const onClick = vi.fn();
    const html = markup("refined", <EmptyState line="Nothing hung yet." action={{ label: "Open the gallery", onClick }} />);
    expect(html).toContain("font-size:13px");
    expect(html).toContain("color:var(--text)");
    expect(html).toContain('data-variant="secondary"');
    expect(html.match(/<button/g)).toHaveLength(1);
    render(at("refined", <EmptyState line="Nothing hung yet." action={{ label: "Open the gallery", onClick }} />));
    fireEvent.click(screen.getByRole("button", { name: "Open the gallery" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("draws no button when there is no action", () => {
    expect(markup("refined", <EmptyState line="Nothing in progress." />)).not.toContain("<button");
  });
});

describe("ErrorState, refined", () => {
  it("is one sentence and Try again, the panel naming the region instead of drawing a second line", () => {
    const onRetry = vi.fn();
    render(at("refined", <ErrorState line="This build didn't load." panel="The composer" onRetry={onRetry} />));
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-label")).toBe("The composer");
    expect(region.textContent).toBe("This build didn't load.Try again");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("never prints the error it was given", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(at("refined", <ErrorState panel="Sources" onRetry={() => undefined} error={new Error("PGRST116")} />));
    expect(screen.queryByText(/PGRST116/)).toBeNull();
    spy.mockRestore();
  });
});

// The Bounties board's four states and its choice budget (UI-P37), on the pure view.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { bountiesFixture } from "@/dev/fixtures/bounties";
import { BountiesView } from "./BountiesView";

function show(state: "populated" | "loading" | "empty" | "error", extra = {}) {
  return render(
    <MemoryRouter>
      <BountiesView {...bountiesFixture(state)} fit="board" {...extra} />
    </MemoryRouter>,
  );
}

describe("BountiesView", () => {
  it("has one h1 and a sort switch with three options", () => {
    show("populated");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByTestId("bounty-row")).toHaveLength(6);
  });

  it("loads as named, busy regions with no content sentences", () => {
    show("loading");
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Loading the open asks")).toBeInTheDocument();
    expect(screen.queryAllByTestId("bounty-row")).toHaveLength(0);
  });

  it("says what is empty, with the one way forward", () => {
    show("empty");
    expect(screen.getByText("No open asks right now.")).toBeInTheDocument();
    expect(within(screen.getByTestId("bounties-empty")).getByRole("button", { name: "Enter the gallery" })).toBeInTheDocument();
    expect(screen.getByText("Nobody has solved a bounty yet.")).toBeInTheDocument();
  });

  it("fails per panel, without the exception, and retries", () => {
    const onRetry = vi.fn();
    show("error", { frames: { status: "error", onRetry, error: new Error("boom: secret") } });
    expect(screen.getAllByText("That didn't load.").length).toBeGreaterThan(0);
    expect(screen.queryByText(/secret/)).toBeNull();
    screen.getAllByRole("button", { name: "Try again" })[0].click();
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows a me-too failure in a polite live line", () => {
    show("populated", { meToo: { pressed: false, count: 14, onToggle: vi.fn(), failure: { onRetry: vi.fn() } } });
    expect(screen.getByTestId("bounties-metoo-error")).toBeInTheDocument();
  });
});

// The composer's Your sessions panel: its choice budgets, counted in the rendered
// panel ⟦hicks-law › Enforcing It in the Code⟧.
//
// Every session a connector stored is listed here, beside the build's own, so
// the list must not swamp the panel: at most six rows under "Not in a build
// yet", then one "Show N more" in place. Each listed session has exactly one way
// in, its +, and there is no second route to the same sessions (the "+ Add a
// session" menu it replaced). The panel has no filled button.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMPOSE_SESSIONS } from "@/dev/fixtures/compose";

import { SessionsPanel, type ComposeOtherSession, type SessionsPanelProps } from "./SessionsPanel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

const waiting = (n: number): ComposeOtherSession[] =>
  Array.from({ length: n }, (_, at) => ({
    id: `waiting-${at + 1}`,
    firstPrompt: `Waiting prompt ${at + 1}`,
    meta: "Claude · Yesterday",
    adding: false,
  }));

function panel(over: Partial<SessionsPanelProps> = {}) {
  const props: SessionsPanelProps = {
    phone: false,
    fine: true,
    sticky: false,
    status: "ready",
    onRetry: vi.fn(),
    sessions: COMPOSE_SESSIONS,
    onOpenChange: vi.fn(),
    onRetryPrompts: vi.fn(),
    onAdd: vi.fn(),
    onSetModel: vi.fn(),
    others: waiting(9),
    othersError: false,
    onRetryOthers: vi.fn(),
    canAttach: true,
    onAttach: vi.fn(),
    ...over,
  };
  render(
    <MemoryRouter>
      <SessionsPanel {...props} />
    </MemoryRouter>,
  );
}

describe("Your sessions' choice budgets", () => {
  it.each([false, true])("shows at most six sessions not in a build, then one More (phone: %s)", (phone) => {
    panel({ phone, fine: !phone });
    const group = screen.getByRole("region", { name: "Not in a build yet" });
    expect(within(group).getAllByTestId("waiting-session").length).toBeLessThanOrEqual(6);
    expect(within(group).getAllByRole("button", { name: /^Show \d+ more$/ })).toHaveLength(1);
  });

  it("gives each listed session exactly one control, and no second way to the same sessions", () => {
    panel();
    for (const row of screen.getAllByTestId("waiting-session")) {
      const controls = [...within(row).queryAllByRole("link"), ...within(row).queryAllByRole("button")];
      expect(controls).toHaveLength(1);
    }
    expect(screen.queryByRole("button", { name: /Add a session/ })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("has no filled button", () => {
    panel();
    expect(document.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(0);
  });
});

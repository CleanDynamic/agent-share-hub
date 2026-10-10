// The composer's Your sessions panel: its choice budgets, counted in the rendered
// panel ⟦hicks-law › Enforcing It in the Code⟧.
//
// Every session on the account is listed here, so the list must not swamp the
// panel: at most six sessions, then one "Show N more" in place. There is no
// second route to the same sessions (the "+ Add a session" menu, then the "Not
// in a build yet" rows, which this list replaced). The panel has no filled
// button.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMPOSE_SESSIONS } from "@/dev/fixtures/compose";

import { SessionsPanel, type ComposeSession, type SessionsPanelProps } from "./SessionsPanel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

const library = (n: number): ComposeSession[] =>
  Array.from({ length: n }, (_, at) => ({
    id: `library-${n - at}`,
    number: n - at,
    label: "Claude",
    modelKnown: true,
    date: "Yesterday",
    prompts: [],
    promptsError: false,
  }));

function panel(over: Partial<SessionsPanelProps> = {}) {
  const props: SessionsPanelProps = {
    phone: false,
    fine: true,
    sticky: false,
    status: "ready",
    onRetry: vi.fn(),
    sessions: [...COMPOSE_SESSIONS, ...library(7)],
    onOpenChange: vi.fn(),
    onRetryPrompts: vi.fn(),
    onAdd: vi.fn(),
    onSetModel: vi.fn(),
    ...over,
  };
  render(
    <MemoryRouter>
      <SessionsPanel {...props} />
    </MemoryRouter>,
  );
}

describe("Your sessions' choice budgets", () => {
  it.each([false, true])("shows at most six sessions, then one More (phone: %s)", (phone) => {
    panel({ phone, fine: !phone });
    const listed = screen.getByTestId("compose-sessions");
    expect(within(listed).getAllByTestId("compose-session").length).toBeLessThanOrEqual(6);
    expect(within(listed).getAllByRole("button", { name: /^Show \d+ more$/ })).toHaveLength(1);
  });

  it("gives each session one head to open it, and no second way to the same sessions", () => {
    panel();
    for (const section of screen.getAllByTestId("compose-session")) {
      expect(within(section).getAllByRole("button", { name: /^Session \d/ })).toHaveLength(1);
    }
    expect(screen.queryByTestId("waiting-session")).toBeNull();
    expect(screen.queryByRole("button", { name: /Add a session/ })).toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("has no filled button", () => {
    panel();
    expect(document.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(0);
  });
});

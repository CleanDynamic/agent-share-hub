import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const warmPath = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } } }) } } }));
vi.mock("./warm", () => ({ warmPath: (...args: unknown[]) => warmPath(...args) }));

import { IntentLink } from "./IntentLink";
import { HOVER_DELAY_MS } from "./useIntent";

beforeEach(() => {
  vi.useFakeTimers();
  warmPath.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const link = (extra: Record<string, unknown> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <IntentLink to="/drafts" {...extra}>
          Drafts
        </IntentLink>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("IntentLink", () => {
  it("starts the page after the pointer rests for 60 ms, and not when it only passes", async () => {
    link();
    const a = screen.getByRole("link", { name: "Drafts" });
    fireEvent.pointerEnter(a);
    act(() => vi.advanceTimersByTime(HOVER_DELAY_MS - 1));
    fireEvent.pointerLeave(a);
    act(() => vi.advanceTimersByTime(100));
    expect(warmPath).not.toHaveBeenCalled();

    fireEvent.pointerEnter(a);
    await act(async () => {
      vi.advanceTimersByTime(HOVER_DELAY_MS);
    });
    expect(warmPath).toHaveBeenCalledTimes(1);
    expect(warmPath.mock.calls[0][0]).toBe("/drafts");
  });

  it("starts it at once on focus, touch and press, and still runs the caller's own handler", async () => {
    const onFocus = vi.fn();
    link({ onFocus });
    const a = screen.getByRole("link", { name: "Drafts" });
    fireEvent.focus(a);
    fireEvent.touchStart(a);
    fireEvent.pointerDown(a);
    await act(async () => undefined);
    expect(warmPath).toHaveBeenCalledTimes(3);
    expect(warmPath.mock.calls[0][2]).toBe("u1");
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("is only a link outside a query client", () => {
    render(
      <MemoryRouter>
        <IntentLink to="/drafts">Drafts</IntentLink>
      </MemoryRouter>,
    );
    fireEvent.focus(screen.getByRole("link", { name: "Drafts" }));
    expect(warmPath).not.toHaveBeenCalled();
  });
});

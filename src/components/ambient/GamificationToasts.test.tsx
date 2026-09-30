// RC-P28a — a new reader's first page is the page, not the old welcome.
//
// Every new account's user_progress row starts with welcome_xp_shown_at null,
// and the old one-time WelcomeXpModal opened over any signed-in page on that
// alone: an opaque panel promising streak rewards and perk eligibility, which
// XP-DESIGN.md does not pay or has parked, over the reset note it allows. The
// toast bus no longer mounts it. A stand-in for supabase-js answers the
// realtime channels and records every table read.

import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ reads: [] as string[] }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "reader-new" }, loading: false, isLoggedIn: true }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const channel = { on: () => channel, subscribe: () => channel };
  const chain = (table: string): unknown =>
    new Proxy(function builder() {}, {
      get(_target, prop) {
        if (prop === "then") {
          stand.reads.push(table);
          return (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: { welcome_xp_shown_at: null }, error: null }).then(resolve);
        }
        return () => chain(table);
      },
    });
  return {
    supabase: {
      channel: () => channel,
      removeChannel: () => {},
      from: (table: string) => chain(table),
      rpc: () => Promise.resolve({ data: null, error: null }),
    },
  };
});

import GamificationToasts from "./GamificationToasts";

describe("GamificationToasts for a reader who has never seen the welcome", () => {
  it("opens no welcome over the page, and asks nothing about it", async () => {
    render(
      <MemoryRouter>
        <GamificationToasts />
        <p>the progress page</p>
      </MemoryRouter>,
    );

    await screen.findByText("the progress page");
    // Let every effect and the reads they start settle before asserting absence.
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Get recognized|Start your quest|perk eligibility/)).toBeNull();
    expect(stand.reads).not.toContain("user_progress");
  });
});

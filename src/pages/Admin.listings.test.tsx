// Admin, Service Listings: each listing has an on/off switch (the control it had before Synth 15), on when the listing is
// active. Turning it writes is_active, as the page always did.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({
  updates: [] as Array<{ table: string; values: unknown; id: unknown }>,
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string, op: { update?: unknown; id?: unknown } = {}): unknown =>
    new Proxy(function builder() {}, {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown) => resolve({ data: stand.tables[table] ?? [], error: null, count: 0 });
        }
        if (prop === "update") return (values: unknown) => chain(table, { ...op, update: values });
        if (prop === "eq") {
          return (_column: string, value: unknown) => {
            if (op.update !== undefined) stand.updates.push({ table, values: op.update, id: value });
            return chain(table, { ...op, id: value });
          };
        }
        return () => chain(table, op);
      },
    });
  return { supabase: { from: (table: string) => chain(table), auth: { getUser: async () => ({ data: { user: null } }), signOut: async () => undefined } } };
});

vi.mock("@/components/moderation/ReportsQueue", () => ({ ReportsQueue: () => null }));

import Admin from "./Admin";

const LISTINGS = [
  { id: "l-1", title: "Voice agent set-up", price_gbp: 120, is_active: true, profiles: { username: "maya", display_name: "Maya" } },
  { id: "l-2", title: "Prompt review", price_gbp: 40, is_active: false, profiles: { username: "sam", display_name: "Sam" } },
];

beforeEach(() => {
  stand.updates = [];
  stand.tables = { service_listings: LISTINGS };
});

function renderAdmin() {
  return render(
    <HelmetProvider context={{}}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <Admin />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

async function openListings() {
  renderAdmin();
  fireEvent.click(screen.getByRole("tab", { name: "Service Listings" }));
  await screen.findAllByRole("switch");
}

describe("Admin, Service Listings", () => {
  it("shows a switch for each listing, on for an active one and off for the other, and no Activate or Deactivate button", async () => {
    await openListings();

    const switches = screen.getAllByRole("switch");
    expect(switches.map((control) => control.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    expect(screen.queryByRole("button", { name: /^(Activate|Deactivate)$/ })).toBeNull();
  });

  it("deactivates an active listing when its switch is turned off, and activates an inactive one when it is turned on", async () => {
    await openListings();
    const [active, inactive] = screen.getAllByRole("switch");

    fireEvent.click(active);
    await waitFor(() => expect(stand.updates).toContainEqual({ table: "service_listings", values: { is_active: false }, id: "l-1" }));

    fireEvent.click(inactive);
    await waitFor(() => expect(stand.updates).toContainEqual({ table: "service_listings", values: { is_active: true }, id: "l-2" }));
  });
});

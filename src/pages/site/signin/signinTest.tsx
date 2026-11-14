/* UI-P36 — what the sign-in pages' tests share: a router at an address, with the
   providers the pages read, a probe that says where the router is, and a way to
   say which viewport the page is drawn in.

   TEST-ONLY. Nothing in the application imports this file. */

import type { ReactElement } from "react";
import { HelmetProvider } from "react-helmet-async";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { SignInDialog } from "./SignInDialog";
import { viewOf, type SignInView } from "./signinUrl";

import { ThemeProvider } from "@/contexts/ThemeContext";

/** Say which viewport `window.matchMedia` answers for: a phone is anything under 768px. */
export function setViewport(viewport: "desktop" | "phone"): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: viewport === "phone" && query.includes("max-width: 767px"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

function Probe() {
  const { pathname, search, state } = useLocation();
  return (
    <p data-testid="where" data-state={JSON.stringify(state ?? null)}>
      {pathname + search}
    </p>
  );
}

export interface WhereIs {
  /** The path and query the router is at now. */
  at: () => string;
  /** The router state the last navigation carried. */
  state: () => unknown;
}

/**
 * Render `page` at `url`, on the route `pattern` (its own address by default), so
 * that navigating anywhere else unmounts it. `state` is what the entry arrived
 * with. Returns where the router is.
 */
export function renderAt(page: ReactElement, url: string, pattern: string = url.split("?")[0], state?: unknown): WhereIs {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const [pathname, search = ""] = url.split("?");
  render(
    <HelmetProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <MemoryRouter initialEntries={[{ pathname, search: search ? `?${search}` : "", state }]}>
            <Probe />
            <Routes>
              <Route path={pattern} element={page} />
              <Route path="*" element={null} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );
  const probe = () => screen.getByTestId("where");
  return {
    at: () => probe().textContent ?? "",
    state: () => JSON.parse(probe().getAttribute("data-state") ?? "null"),
  };
}

/** The dialog as the host draws it: whichever view the address names, or nothing. */
function DialogFromAddress() {
  const { search } = useLocation();
  const view = viewOf(search);
  return view ? <SignInDialog view={view} /> : null;
}

/**
 * Render the sign-in dialog over Home on `view`, with `query` (the destination, an emailed link's parameters) in the
 * address beside it. Navigating to any other page unmounts it. Returns where the router is.
 */
export function renderDialog(view: SignInView, query = "", state?: unknown): WhereIs {
  const search = new URLSearchParams(query);
  search.set("signin", view);
  return renderAt(<DialogFromAddress />, `/?${search.toString()}`, "/", state);
}

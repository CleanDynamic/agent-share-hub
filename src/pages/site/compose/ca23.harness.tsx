/* CA-23: the composer mounted for real (SandboxPage behind supabase-js, only the network faked by CA-08's fakeSupabase),
   and the browser's connection and tabs driven by hand. */

import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, startAuditBackend, type Fault, type Row } from "@/lib/build/__audit__/fakeSupabase";

import { SandboxPage } from "./SandboxPage";

export const DRAFT = "0d0d0d0d-0000-4000-8000-000000000001";

export function stubWidth(px: number) {
  const matchMedia = (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  };
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: matchMedia });
}

export function mountComposer(path = `/compose/${DRAFT}`, options: { faults?: Fault[]; seed?: (rows: Record<string, Row[]>) => void; extra?: React.ReactNode } = {}) {
  startAuditBackend({ schema: REPO_SCHEMA, faults: options.faults ?? [], seed: options.seed });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <HelmetProvider>
          <AuthProvider>
            <ConnectorDialogProvider>
              <Routes>
                <Route path="/compose/new" element={<SandboxPage />} />
                <Route path="/compose/:buildId" element={<SandboxPage />} />
                <Route path="/" element={<p>home</p>} />
                <Route path="/elsewhere" element={<p data-testid="elsewhere">elsewhere</p>} />
              </Routes>
              {options.extra}
            </ConnectorDialogProvider>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...view, client };
}

/** The browser's connection, by hand: the property and the event. */
export function setBrowserOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  act(() => void window.dispatchEvent(new Event(online ? "online" : "offline")));
}

export const statusText = (): string => {
  const copy = screen.getByTestId("sandbox-status").cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[data-testid="reason"]').forEach((node) => node.remove());
  return copy.textContent ?? "";
};

export async function ready() {
  await screen.findByTestId("sandbox-status", undefined, { timeout: 10_000 });
  await waitFor(() => expect(screen.queryByTestId("sandbox-skeleton")).toBeNull(), { timeout: 10_000 });
}

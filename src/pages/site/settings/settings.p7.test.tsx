// UX-15 P7: Connected apps. The list comes from the auth server's own grants; Revoke asks once; with no OAuth server the section is one
// sentence; an empty list says so. Nothing is listed that the auth server did not return.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const oauth = vi.hoisted(() => ({ listGrants: vi.fn(), revokeGrant: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { oauth }, rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
const toasts = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: Object.assign(toasts, { error: toasts }) }));

import { APPS_COPY, appsOf, listApps, listingIsUnavailable, revokeApp, type ConnectedApp } from "@/lib/settings/apps";

import { AppsView } from "./AppsView";
import { AppsSection } from "./containers";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const grant = (id: string, name: string, at: string, scopes = ["openid", "mcp:read"]) => ({ client: { id, name, uri: `https://${id}.example`, logo_uri: "" }, scopes, granted_at: at });

describe("the list", () => {
  it("is the auth server's grants, newest first, by their registered names", () => {
    const apps = appsOf([grant("a", "Older app", "2026-10-01T10:00:00Z"), grant("b", "<b>Newer</b> app", "2026-11-02T10:00:00Z")]);
    expect(apps.map((a) => a.name)).toEqual(["<b>Newer</b> app", "Older app"]);
    expect(apps[0]).toMatchObject({ clientId: "b", scopes: ["openid", "mcp:read"], uri: "https://b.example" });
  });

  it("draws a registered name as text, never as markup", () => {
    const apps = appsOf([grant("b", "<img src=x onerror=alert(1)> app", "2026-11-02T10:00:00Z")]);
    render(<MemoryRouter><AppsView apps={apps} onRevoke={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("<img src=x onerror=alert(1)> app")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows what each can access and when it was authorised", () => {
    render(<MemoryRouter><AppsView apps={appsOf([grant("a", "Claude", "2026-11-02T10:00:00Z", ["mcp:read"])])} onRevoke={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("Can access: mcp:read")).toBeTruthy();
    expect(screen.getByText("Authorised 2 Nov 2026")).toBeTruthy();
  });

  it("says so when no app has access", () => {
    render(<MemoryRouter><AppsView apps={[]} onRevoke={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("No apps can access your account.")).toBeTruthy();
  });

  it("is one sentence when the auth server cannot list, and invents no list", () => {
    render(<MemoryRouter><AppsView apps={null} onRevoke={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("Apps you've allowed to access your account will appear here.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });
});

describe("Revoke", () => {
  const app: ConnectedApp = { clientId: "a", name: "Claude", uri: null, scopes: ["mcp:read"], grantedAt: "2026-11-02T10:00:00Z" };

  it("asks once, in words that name the app, and does nothing until confirmed", async () => {
    const onRevoke = vi.fn(async () => undefined);
    render(<MemoryRouter><AppsView apps={[app]} onRevoke={onRevoke} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude" }));
    const ask = screen.getByRole("group", { name: "Confirm" });
    expect(within(ask).getByText("Claude will lose access to your account.")).toBeTruthy();
    expect(onRevoke).not.toHaveBeenCalled();
    fireEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    expect(onRevoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm" })).getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith(app));
  });

  it("shows a refusal and keeps the question open", async () => {
    const onRevoke = vi.fn(async () => { throw new Error("no"); });
    render(<MemoryRouter><AppsView apps={[app]} onRevoke={onRevoke} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Revoke Claude" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm" })).getByRole("button", { name: "Revoke" }));
    expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Confirm" })).toBeTruthy();
  });

  it("calls the auth server's revokeGrant with the client id", async () => {
    oauth.revokeGrant.mockResolvedValueOnce({ data: {}, error: null });
    await revokeApp("client-1");
    expect(oauth.revokeGrant).toHaveBeenCalledWith({ clientId: "client-1" });
    oauth.revokeGrant.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    await expect(revokeApp("client-1")).rejects.toBeTruthy();
  });
});

describe("what the auth server says", () => {
  it("reads a switched-off OAuth server as unavailable, and a network failure as an error", async () => {
    expect(listingIsUnavailable({ code: "oauth_server_disabled" })).toBe(true);
    expect(listingIsUnavailable({ status: 404 })).toBe(true);
    expect(listingIsUnavailable({ status: 500, message: "boom" })).toBe(false);
    oauth.listGrants.mockResolvedValueOnce({ data: null, error: { status: 404, message: "not found" } });
    expect(await listApps()).toEqual({ state: "unavailable" });
    oauth.listGrants.mockResolvedValueOnce({ data: null, error: { status: 500, message: "boom" } });
    await expect(listApps()).rejects.toBeTruthy();
  });
});

describe("the container", () => {
  const mount = () =>
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AppsSection />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it("lists the grants, and after Revoke reads them again", async () => {
    oauth.listGrants.mockResolvedValueOnce({ data: [grant("a", "Claude", "2026-11-02T10:00:00Z")], error: null }).mockResolvedValueOnce({ data: [], error: null });
    oauth.revokeGrant.mockResolvedValue({ data: {}, error: null });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Revoke Claude" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Confirm" })).getByRole("button", { name: "Revoke" }));
    expect(await screen.findByText(APPS_COPY.empty)).toBeTruthy();
    expect(oauth.revokeGrant).toHaveBeenCalledWith({ clientId: "a" });
  });

  it("shows the one sentence when the auth server cannot list", async () => {
    oauth.listGrants.mockResolvedValue({ data: null, error: { status: 404, message: "no" } });
    mount();
    expect(await screen.findByText(APPS_COPY.unavailable)).toBeTruthy();
  });
});

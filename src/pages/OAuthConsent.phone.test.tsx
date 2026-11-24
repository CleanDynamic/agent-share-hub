// Mobile prompt 27 Part D: authorise an application on a phone: a 44 close, the beaver at 96, the app's name, "Acting as @handle",
// the scopes on a Panel module, and Deny and Allow side by side in a sticky footer. The words and the answers are the page's own.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const phone = vi.hoisted(() => ({ on: true }));
vi.mock("@/components/shell/useMinWidth", async (original) => ({
  ...(await original<typeof import("@/components/shell/useMinWidth")>()),
  useIsPhone: () => phone.on,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", email: "ada@example.com" }, profile: { username: "ada" }, isLoggedIn: true, loading: false }),
}));
const approve = vi.fn();
const deny = vi.fn();
vi.mock("@/lib/auth/oauthConsent", () => ({
  readAuthorizationRequest: vi.fn(async () => ({
    kind: "request",
    request: { applicationName: "Claude", applicationUri: null, scopes: ["openid", "profile"], redirectUri: "https://claude.ai/cb" },
  })),
  approveAuthorizationRequest: (...args: unknown[]) => approve(...args),
  denyAuthorizationRequest: (...args: unknown[]) => deny(...args),
}));

import OAuthConsent from "./OAuthConsent";

function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/oauth/consent?authorization_id=a1"]}>
        <OAuthConsent />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  phone.on = true;
  approve.mockReset().mockResolvedValue("https://claude.ai/cb?code=1");
  deny.mockReset().mockResolvedValue("https://claude.ai/cb?error=denied");
});

describe("authorise an application on a phone", () => {
  it("has a 44 close at the top left, the app's name, Acting as @handle and the scopes as rows", async () => {
    mount();
    expect(await screen.findByTestId("consent-application")).toHaveTextContent("Claude");
    const close = screen.getByRole("button", { name: "Close" });
    expect(close.style.width).toBe("44px");
    expect(close.style.height).toBe("44px");
    expect(screen.getByText("Acting as @ada")).toBeTruthy();
    const scopes = screen.getByRole("region", { name: "Scopes requested" });
    expect(within(scopes).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["openid", "profile"]);
    expect(screen.getByRole("heading", { level: 1, name: "Authorize an application" }).className).toBe("sr-only");
  });

  it("puts Deny and Allow side by side in a sticky footer, and each answers as it did", async () => {
    mount();
    await screen.findByTestId("consent-application");
    const footer = screen.getByTestId("consent-footer");
    expect(footer.style.position).toBe("sticky");
    const buttons = within(footer).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Deny", "Allow"]);
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(approve).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://claude.ai/cb?code=1"));
    expect(deny).not.toHaveBeenCalled();
  });
});

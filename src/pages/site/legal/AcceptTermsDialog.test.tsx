// Prompt 9, G19: the dialog that asks a member to accept changed terms. Both states of the reviewed flags are tested.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: { id: "member-1" } as { id: string } | null, signOut: vi.fn(async () => undefined) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { PRIVACY_VERSION, TERMS_VERSION } from "@/content/legal/legalConstants";

import { needsAcceptance, type AcceptanceData } from "./acceptance";
import { AcceptTermsDialog } from "./AcceptTermsDialog";

function setup(reviewed: boolean, accepted: Awaited<ReturnType<AcceptanceData["accepted"]>>, accept: AcceptanceData["accept"] = vi.fn(async () => undefined)) {
  const data: AcceptanceData = { accepted: vi.fn(async () => accepted), accept };
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AcceptTermsDialog reviewed={reviewed} data={data} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return data;
}

describe("needsAcceptance", () => {
  it("asks a member with no acceptance, or an older Terms or Privacy policy, and not one who accepted the current ones", () => {
    expect(needsAcceptance(null)).toBe(true);
    expect(needsAcceptance({ terms: "2026-01-01", privacy: PRIVACY_VERSION })).toBe(true);
    expect(needsAcceptance({ terms: TERMS_VERSION, privacy: "2026-01-01" })).toBe(true);
    expect(needsAcceptance({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION })).toBe(false);
  });
});

describe("AcceptTermsDialog", () => {
  beforeEach(() => {
    auth.user = { id: "member-1" };
    auth.signOut.mockClear();
  });

  it("while the texts are drafts (reviewed false), shows nothing and reads nothing", async () => {
    const data = setup(false, null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("accept-terms")).toBeNull();
    expect(data.accepted).not.toHaveBeenCalled();
  });

  it("once reviewed, shows nothing to a member who accepted the current versions", async () => {
    const data = setup(true, { terms: TERMS_VERSION, privacy: PRIVACY_VERSION });
    await waitFor(() => expect(data.accepted).toHaveBeenCalledWith("member-1"));
    expect(screen.queryByTestId("accept-terms")).toBeNull();
  });

  it("once reviewed, shows nothing to a reader who is not signed in", async () => {
    auth.user = null;
    const data = setup(true, null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId("accept-terms")).toBeNull();
    expect(data.accepted).not.toHaveBeenCalled();
  });

  it("once reviewed, asks a member with an older acceptance, with links to both texts", async () => {
    setup(true, { terms: "2026-01-01", privacy: "2026-01-01" });
    expect(await screen.findByTestId("accept-terms")).toBeTruthy();
    expect(screen.getByText("We've updated our terms")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Privacy policy" }).getAttribute("href")).toBe("/privacy");
  });

  it("cannot be dismissed: Escape leaves it open", async () => {
    setup(true, null);
    const dialog = await screen.findByTestId("accept-terms");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByTestId("accept-terms")).toBeTruthy();
  });

  it("Accept records the current versions, and the dialog goes once the record says so", async () => {
    let accepted: { terms: string; privacy: string } | null = null;
    const accept = vi.fn(async () => {
      accepted = { terms: TERMS_VERSION, privacy: PRIVACY_VERSION };
    });
    const data: AcceptanceData = { accepted: vi.fn(async () => accepted), accept };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AcceptTermsDialog reviewed data={data} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(accept).toHaveBeenCalledWith(TERMS_VERSION, PRIVACY_VERSION));
    await waitFor(() => expect(screen.queryByTestId("accept-terms")).toBeNull());
  });

  it("says so in our words when accepting fails, and stays open", async () => {
    setup(true, null, vi.fn(async () => {
      throw new Error("permission denied for function accept_legal_terms");
    }));
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    expect(await screen.findByText("Couldn't save your acceptance. Try again.")).toBeTruthy();
    expect(screen.queryByText(/permission denied/)).toBeNull();
    expect(screen.getByTestId("accept-terms")).toBeTruthy();
  });

  it("Sign out signs out", async () => {
    setup(true, null);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(auth.signOut).toHaveBeenCalled();
  });
});

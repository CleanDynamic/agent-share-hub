// Prompt 9, G16: closing the sign-in dialog removes the address kept for Check your inbox.

import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PENDING_VERIFICATION_KEY } from "@/lib/auth/pendingVerification";

vi.mock("./SignInDialog", () => ({ default: () => <div data-testid="dialog" /> }));
vi.mock("./HalftoneLayer", () => ({ default: () => null }));

import { SignInDialogHost } from "./SignInDialogHost";

let go: (to: string) => void = () => undefined;
function Driver() {
  const navigate = useNavigate();
  go = (to) => navigate(to);
  return null;
}

describe("SignInDialogHost", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps the address while the dialog moves between views, and removes it when the dialog closes", async () => {
    render(
      <MemoryRouter initialEntries={["/?signin=signup"]}>
        <Driver />
        <SignInDialogHost />
      </MemoryRouter>,
    );
    sessionStorage.setItem(PENDING_VERIFICATION_KEY, "ada@example.com");
    await act(async () => go("/?signin=verify"));
    expect(sessionStorage.getItem(PENDING_VERIFICATION_KEY)).toBe("ada@example.com");
    await act(async () => go("/"));
    expect(sessionStorage.getItem(PENDING_VERIFICATION_KEY)).toBeNull();
  });
});

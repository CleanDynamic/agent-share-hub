// Part A, G2 and G6: with no dialog showing, a session that still owes a code opens Enter your code over the page; a
// member with no authenticator never owes one, and nothing opens.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pendingCodeFactor = vi.fn();
vi.mock("@/lib/auth/codeStep", () => ({ pendingCodeFactor: () => pendingCodeFactor() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) } },
}));
// The dialog's own chunk is not under test here.
vi.mock("./SignInDialog", () => ({ default: () => null }));
vi.mock("./HalftoneLayer", () => ({ default: () => null }));

import { SignInDialogHost } from "./SignInDialogHost";

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

function at(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Where />
      <Routes>
        <Route path="*" element={<SignInDialogHost />} />
      </Routes>
    </MemoryRouter>,
  );
  return () => screen.getByTestId("where").textContent;
}

beforeEach(() => pendingCodeFactor.mockReset());
afterEach(cleanup);

describe("the host and the code step", () => {
  it("opens Enter your code over the page when the session owes a code", async () => {
    pendingCodeFactor.mockResolvedValue("f1");
    const where = at("/builds?sort=new");
    await waitFor(() => expect(where()).toBe("/builds?sort=new&signin=code"));
  });

  it("G6: opens nothing for a member with no authenticator", async () => {
    pendingCodeFactor.mockResolvedValue(null);
    const where = at("/builds");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    expect(where()).toBe("/builds");
  });

  it("leaves a dialog that is already showing alone", async () => {
    pendingCodeFactor.mockResolvedValue("f1");
    const where = at("/builds?signin=login");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(pendingCodeFactor).not.toHaveBeenCalled();
    expect(where()).toBe("/builds?signin=login");
  });
});

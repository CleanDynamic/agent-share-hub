import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { isLoggedIn: true, isCreator: false, loading: false, profileLoading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import { ProtectedRoute } from "./ProtectedRoute";

function at(requireCreator = false) {
  return render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route path="/private" element={<ProtectedRoute requireCreator={requireCreator}><p>the page</p></ProtectedRoute>} />
        <Route path="/login" element={<p>sign in</p>} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => Object.assign(auth, { isLoggedIn: true, isCreator: false, loading: false, profileLoading: false }));

describe("ProtectedRoute", () => {
  it("renders the page once the session is known, with the profile still pending", () => {
    Object.assign(auth, { profileLoading: true });
    at();
    expect(screen.getByText("the page")).toBeTruthy();
  });

  it("waits for the session alone, and shows no page and no redirect meanwhile", () => {
    Object.assign(auth, { loading: true, isLoggedIn: false });
    at();
    expect(screen.queryByText("the page")).toBeNull();
    expect(screen.queryByText("sign in")).toBeNull();
  });

  it("sends a signed-out reader to sign in", () => {
    Object.assign(auth, { isLoggedIn: false });
    at();
    expect(screen.getByText("sign in")).toBeTruthy();
  });

  it("a creator-only route also waits for the profile, and does not send a creator away early", () => {
    Object.assign(auth, { profileLoading: true });
    at(true);
    expect(screen.queryByText("the page")).toBeNull();
    expect(screen.queryByText("home")).toBeNull();
  });

  it("a creator-only route sends a reader who is not a creator home once the profile has arrived", () => {
    at(true);
    expect(screen.getByText("home")).toBeTruthy();
  });
});

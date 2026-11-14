import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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

/** The sign-in page as the guard reaches it: shows the address it was sent to. */
function SignIn() {
  const { pathname, search } = useLocation();
  return <p data-testid="signin-at">{`${pathname}${search}`}</p>;
}

function atAddress(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/private/*" element={<ProtectedRoute><p>the page</p></ProtectedRoute>} />
        <Route path="/login" element={<SignIn />} />
      </Routes>
    </MemoryRouter>,
  );
}

const redirectOf = () => new URLSearchParams(screen.getByTestId("signin-at").textContent!.split("?")[1]).get("redirect");

describe("ProtectedRoute", () => {
  it("G17: carries the path, the query and the hash to sign in", () => {
    Object.assign(auth, { isLoggedIn: false });
    atAddress("/private/library?view=saved#top");
    expect(redirectOf()).toBe("/private/library?view=saved#top");
  });

  it("G16: sends / as the return when the path would leave the site", () => {
    Object.assign(auth, { isLoggedIn: false });
    atAddress("/private//example.com");
    expect(redirectOf()).toBe("/");
  });

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

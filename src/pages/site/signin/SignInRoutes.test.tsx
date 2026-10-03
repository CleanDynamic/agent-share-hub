// UI-P41: LinkFrameRoute now always renders the site page, regardless of
// whether there's an email link or not. The token will only be spent by the
// site page since it's the only one that mounts.

import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LinkFrameRoute } from "./SignInRoutes";

const legacy = vi.fn(() => <p>legacy page</p>);
const site = vi.fn(() => <p>site page</p>);

function at(url: string, pattern: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={pattern} element={<LinkFrameRoute site={<Page render={site} />} legacy={<Page render={legacy} />} />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** A page that counts how many times it is mounted, as a stand-in for one that spends a token on mount. */
function Page({ render: draw }: { render: () => ReactElement }) {
  return draw();
}

beforeEach(() => {
  legacy.mockClear();
  site.mockClear();
});

describe("LinkFrameRoute", () => {
  it("always renders the site page, with or without a token in the path", () => {
    at("/reset-password/abc", "/reset-password/:token");
    expect(screen.getByText("site page")).toBeTruthy();
    expect(legacy).not.toHaveBeenCalled();
    expect(site).toHaveBeenCalledTimes(1);
  });

  it("renders the site page with query token_hash", () => {
    at("/reset-password?token_hash=h", "/reset-password");
    expect(screen.getByText("site page")).toBeTruthy();
    expect(legacy).not.toHaveBeenCalled();
    expect(site).toHaveBeenCalledTimes(1);
  });

  it("renders the site page with PKCE code", () => {
    at("/verify-email?code=c", "/verify-email");
    expect(screen.getByText("site page")).toBeTruthy();
    expect(site).toHaveBeenCalledTimes(1);
  });

  it("renders the site page without a link", () => {
    at("/verify-email", "/verify-email");
    expect(screen.getByText("site page")).toBeTruthy();
    expect(site).toHaveBeenCalledTimes(1);
  });
});

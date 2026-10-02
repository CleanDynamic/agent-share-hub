// UI-P36 — the routes the entrance's pages sit on: an emailed link is held until
// the flag is known, so a single-use token is spent by exactly one of the two
// pages, and an address with no link behaves as every other route does.

import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ on: false, known: false }));
vi.mock("@/lib/shell/flags", () => ({ useSiteFrameFlag: () => flag.on, useSiteFrameKnown: () => flag.known }));

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
  flag.on = false;
  flag.known = false;
  legacy.mockClear();
  site.mockClear();
});

describe("LinkFrameRoute", () => {
  it.each([
    ["a token in the path", "/reset-password/abc", "/reset-password/:token"],
    ["token_hash in the query", "/reset-password?token_hash=h", "/reset-password"],
    ["a PKCE code", "/verify-email?code=c", "/verify-email"],
    ["an error the link came back with", "/verify-email?error=access_denied", "/verify-email"],
  ])("holds %s until the flag is known: neither page mounts", (_name, url, pattern) => {
    const { container } = at(url, pattern);
    expect(container.textContent).toBe("");
    expect(legacy).not.toHaveBeenCalled();
    expect(site).not.toHaveBeenCalled();
  });

  it("mounts the site page, once, when the flag turns out to be on", () => {
    flag.known = true;
    flag.on = true;
    at("/reset-password/abc", "/reset-password/:token");
    expect(screen.getByText("site page")).toBeTruthy();
    expect(legacy).not.toHaveBeenCalled();
    expect(site).toHaveBeenCalledTimes(1);
  });

  it("mounts the legacy page, once, when it turns out to be off", () => {
    flag.known = true;
    flag.on = false;
    at("/reset-password/abc", "/reset-password/:token");
    expect(screen.getByText("legacy page")).toBeTruthy();
    expect(site).not.toHaveBeenCalled();
    expect(legacy).toHaveBeenCalledTimes(1);
  });

  it("does not hold an address with no link: the pending card and the request form show at once", () => {
    flag.known = false;
    at("/verify-email", "/verify-email");
    expect(screen.getByText("legacy page")).toBeTruthy();
    expect(site).not.toHaveBeenCalled();
  });

  it("does not hold an address that only carries a redirect", () => {
    flag.known = false;
    at("/reset-password?redirect=%2Fgallery", "/reset-password");
    expect(screen.getByText("legacy page")).toBeTruthy();
  });
});

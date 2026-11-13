// The surface ladder in the account menu: the open menu is a window (its own tone, one step above a card), and a
// hovered item changes its fill, never by a ring. jsdom stores nothing for a `var()` colour, so the paint is read
// from static markup, with Radix's portal drawn in place.

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@radix-ui/react-dropdown-menu", async (importOriginal) => {
  const real = await importOriginal<typeof import("@radix-ui/react-dropdown-menu")>();
  return { ...real, Portal: ({ children }: { children: ReactNode }) => <>{children}</> };
});

import { AccountMenu } from "./AccountMenu";

const viewer = { id: "u1", name: "Ada Lovelace", handle: "ada", avatarUrl: null };

const menuStyle = () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <AccountMenu viewer={viewer} onSignOut={vi.fn()} avatarSize={26} defaultOpen />
    </MemoryRouter>,
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.querySelector('[role="menu"]')?.getAttribute("style") ?? "";
};

describe("the account menu on the surface ladder", () => {
  it("is filled and edged as a window, not as a card", () => {
    const style = menuStyle();
    expect(style).toContain("background:var(--window)");
    expect(style).toContain("border:1px solid var(--window-border)");
  });
});

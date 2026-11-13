// SV-26 P2: the account menu and the frame's bottom sheets load apart from the first page. The menu opens at once when
// it arrives after a press (defaultOpen), and a lazy sheet draws nothing until it first opens.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AccountMenu } from "./AccountMenu";
import { LazyBottomSheet } from "./LazyBottomSheet";

const viewer = { id: "u1", name: "Ada Lovelace", handle: "ada", avatarUrl: null };

describe("the account menu, loaded apart", () => {
  it("draws the account button, closed", () => {
    render(
      <MemoryRouter>
        <AccountMenu viewer={viewer} onSignOut={vi.fn()} avatarSize={26} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Account" })).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens at once when it arrives after a press", () => {
    render(
      <MemoryRouter>
        <AccountMenu viewer={viewer} onSignOut={vi.fn()} avatarSize={26} defaultOpen />
      </MemoryRouter>,
    );
    const menu = screen.getByRole("menu");
    expect([...menu.querySelectorAll("a, button")].map((el) => el.textContent)).toEqual(["Profile", "Library", "Drafts", "Settings", "Sign out"]);
    // The control-heights pass: a menu item is 32 high with 12 either side.
    for (const item of menu.querySelectorAll<HTMLElement>("a, button")) expect([item.style.height, item.style.padding], item.textContent ?? "").toEqual(["32px", "0px 12px"]);
  });
});

describe("the lazy bottom sheet", () => {
  it("draws nothing until it opens, then the sheet", async () => {
    const { rerender } = render(<LazyBottomSheet open={false} onOpenChange={vi.fn()} title="Search" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<LazyBottomSheet open onOpenChange={vi.fn()} title="Search" />);
    expect(await screen.findByRole("dialog", { name: "Search" })).toBeTruthy();
  });
});

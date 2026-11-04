// UX-06 Part 5: the Wall. Its columns (three, two below 1101, one below 761, 24 apart), a published card and an in-progress one, and
// the way in: the line and the view's one primary, which the box replaces while it is open.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { PostWall } from "./PostWall";
import type { WallCard } from "./postModel";

const author = { id: "kit", name: "Kit Ward", handle: "kit", avatarUrl: null };
const cards: WallCard[] = [
  { kind: "published", replyId: "r1", title: "Kit's screener", author, line: "Claude Code · Rebuilt from @maya", plaque: { reproduction_count: 2, last_confirmed_at: "2026-11-01T00:00:00Z", last_confirmed_model: null, published_at: "2026-10-01T00:00:00Z" }, pinned: true, to: "/b2/kits", rebuildTo: "/rebuild/kits" },
  { kind: "in-progress", replyId: "r2", title: "Ana's screener", author: { ...author, id: "ana", handle: "ana" }, line: "In progress · 2 sessions", updated: "updated 20m ago", pinned: false },
];

function at(width: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = Number(/min-width:\s*(\d+)/.exec(query)?.[1] ?? 0);
    return { matches: width >= min, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
}

const draw = (extra: Partial<Parameters<typeof PostWall>[0]> = {}) =>
  render(
    <MemoryRouter>
      <PostWall cards={cards} onReply={vi.fn()} onReplyWithBuild={vi.fn()} {...extra} />
    </MemoryRouter>,
  );

describe("the Wall", () => {
  it.each([
    [1440, 3],
    [1100, 2],
    [761, 2],
    [760, 1],
    [390, 1],
  ])("at %i wide draws %i columns, 24 apart", (width, columns) => {
    at(width);
    draw();
    const list = screen.getByRole("list", { name: "Builds in replies" });
    expect(list).toHaveStyle({ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "24px" });
  });

  it("draws a published build in the module box with its credit, reproductions, Pinned and three controls", () => {
    at(1440);
    draw();
    const [kit] = screen.getAllByTestId("wall-card");
    expect(kit).toHaveAttribute("data-kind", "published");
    expect(within(kit).getByRole("heading", { name: "Kit's screener" })).toBeInTheDocument();
    expect(within(kit).getByText("@kit")).toBeInTheDocument();
    expect(within(kit).getByText("Claude Code · Rebuilt from @maya")).toBeInTheDocument();
    expect(within(kit).getByText("Pinned")).toBeInTheDocument();
    expect(within(kit).getByRole("link", { name: "Open" })).toHaveAttribute("href", "/b2/kits");
    expect(within(kit).getByRole("link", { name: "Rebuild" })).toHaveAttribute("href", "/rebuild/kits");
    expect(within(kit).getByRole("button", { name: "Reply" })).toBeInTheDocument();
    // No picture area.
    expect(kit.querySelector("img")).toBeNull();
  });

  it("draws a build attached from a draft as a dashed box, in progress", () => {
    at(1440);
    draw();
    const ana = screen.getAllByTestId("wall-card")[1];
    expect(ana).toHaveAttribute("data-kind", "in-progress");
    expect(ana).toHaveAttribute("data-ui", "dashed-slot");
    expect(within(ana).getByText("In progress · 2 sessions")).toBeInTheDocument();
    expect(within(ana).getByText("updated 20m ago")).toBeInTheDocument();
    expect(within(ana).queryByRole("link", { name: "Open" })).toBeNull();
  });

  it("offers the way in with the view's one primary, and the box takes its place once open", () => {
    at(1440);
    const onReplyWithBuild = vi.fn();
    const { unmount } = draw({ onReplyWithBuild });
    expect(screen.getByText("Built something for this? Reply with a build.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reply with a build" }));
    expect(onReplyWithBuild).toHaveBeenCalled();
    expect(document.querySelectorAll('[data-visual-slot="btn-primary"]')).toHaveLength(1);
    unmount();
    draw({ box: <div data-testid="reply-box" /> });
    expect(screen.queryByRole("button", { name: "Reply with a build" })).toBeNull();
    expect(screen.getByTestId("reply-box")).toBeInTheDocument();
  });
});

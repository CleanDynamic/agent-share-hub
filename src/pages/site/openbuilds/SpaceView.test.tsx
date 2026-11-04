// UX-05 Part 3: a space's page, by role. A non-member is offered Join; a member Post here; only moderators get Settings.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PostCardData } from "@/components/post/postCardModel";

import { atWidth } from "./OpenBuildsFeedView.test";
import { SpaceView, type SpaceViewProps } from "./SpaceView";

const card = (id: string, extra: Partial<PostCardData> = {}): PostCardData => ({
  id,
  to: `/openbuilds/topics/${id}`,
  author: { id: "u1", name: "Sam Ellis", handle: "sam", avatarUrl: null },
  age: "2h",
  spaces: [],
  reward: null,
  heading: `Heading ${id}`,
  text: "",
  attachments: [],
  stillOpen: false,
  tags: [],
  closes: null,
  replies: null,
  pinned: false,
  hidden: null,
  engagementBuild: null,
  ...extra,
});

const moderation = () => ({ onPin: vi.fn(), onUnpin: vi.fn(), onHide: vi.fn(), onUnhide: vi.fn() });

const props = (extra: Partial<SpaceViewProps> = {}): SpaceViewProps => ({
  name: "Evals",
  description: "Scoring work, together.",
  meta: "Made by @sam · moderated by @sam, @ola · 412 members · anyone can post",
  orderLine: "Newest first · set by @sam",
  rules: "Be kind.\nShow the build.",
  role: "none",
  tab: "posts",
  onTab: vi.fn(),
  onJoin: vi.fn(),
  onPost: vi.fn(),
  onSettings: vi.fn(),
  posts: { status: "ready", onRetry: vi.fn(), items: [{ card: card("p1") }] },
  ...extra,
});

const draw = (extra: Partial<SpaceViewProps> = {}) =>
  render(
    <MemoryRouter>
      <SpaceView {...props(extra)} />
    </MemoryRouter>,
  );

afterEach(() => vi.unstubAllGlobals());

describe("SpaceView", () => {
  it("heads the page with the space's name, its description and the made-by line", () => {
    atWidth(1440);
    draw();
    expect(screen.getByRole("heading", { level: 1, name: "Evals" })).toBeInTheDocument();
    expect(screen.getByText("Scoring work, together.")).toBeInTheDocument();
    expect(screen.getByText("Made by @sam · moderated by @sam, @ola · 412 members · anyone can post")).toBeInTheDocument();
  });

  it("offers a non-member Join as the one primary, and no Settings", () => {
    atWidth(1440);
    const view = props();
    render(
      <MemoryRouter>
        <SpaceView {...view} />
      </MemoryRouter>,
    );
    const primary = document.querySelectorAll('[data-visual-slot="btn-primary"]');
    expect(primary).toHaveLength(1);
    expect(primary[0]).toHaveTextContent("Join");
    fireEvent.click(primary[0] as HTMLElement);
    expect(view.onJoin).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Moderate this post" })).toBeNull();
  });

  it("offers a member Post here, and still no Settings or moderation", () => {
    atWidth(1440);
    const view = props({ role: "member" });
    render(
      <MemoryRouter>
        <SpaceView {...view} />
      </MemoryRouter>,
    );
    const primary = document.querySelectorAll('[data-visual-slot="btn-primary"]');
    expect(primary[0]).toHaveTextContent("Post here");
    fireEvent.click(primary[0] as HTMLElement);
    expect(view.onPost).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Moderate this post" })).toBeNull();
  });

  it("gives a moderator Settings beside Post here, and a ··· menu with Pin and Hide on each card", () => {
    atWidth(1440);
    const mod = moderation();
    const view = props({ role: "moderator", posts: { status: "ready", onRetry: vi.fn(), items: [{ card: card("p1"), moderation: mod }] } });
    render(
      <MemoryRouter>
        <SpaceView {...view} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(view.onSettings).toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Moderate this post" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Pin" }));
    expect(mod.onPin).toHaveBeenCalled();
  });

  it("asks for a reason in one field before hiding", () => {
    atWidth(1440);
    const mod = moderation();
    const view = props({ role: "moderator", posts: { status: "ready", onRetry: vi.fn(), items: [{ card: card("p1"), moderation: mod }] } });
    render(
      <MemoryRouter>
        <SpaceView {...view} />
      </MemoryRouter>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Moderate this post" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Hide" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Reason for hiding" }), { target: { value: "Off topic" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(mod.onHide).toHaveBeenCalledWith("Off topic");
  });

  it("shows a moderator a hidden post greyed, with who hid it, and Unhide", () => {
    atWidth(1440);
    const mod = moderation();
    const hidden = card("p2", { hidden: { by: "@ola", reason: null } });
    draw({ role: "moderator", posts: { status: "ready", onRetry: vi.fn(), items: [{ card: hidden, moderation: mod }] } });
    expect(screen.getByText("Hidden by @ola · only moderators see this")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
    expect(mod.onUnhide).toHaveBeenCalled();
  });

  it("says the order and who set it, and marks a pinned post", () => {
    atWidth(1440);
    draw({ posts: { status: "ready", onRetry: vi.fn(), items: [{ card: card("p1", { pinned: true }) }] } });
    expect(screen.getByText("Newest first · set by @sam")).toBeInTheDocument();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
  });

  it("shows the rules with their line breaks", () => {
    atWidth(1440);
    draw({ tab: "rules" });
    const rules = screen.getByRole("tabpanel", { name: "Rules" });
    expect(rules.textContent).toBe("Be kind.\nShow the build.");
    expect(getComputedStyle(rules).whiteSpace).toBe("pre-wrap");
    expect(within(screen.getByRole("tablist")).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Posts", "Rules"]);
  });

  it("says so when a space has no posts, with the action for the reader's role", () => {
    atWidth(1440);
    const { unmount } = draw({ posts: { status: "ready", onRetry: vi.fn(), items: [] } });
    expect(screen.getByText("No posts here yet.")).toBeInTheDocument();
    unmount();
    const view = props({ role: "member", posts: { status: "ready", onRetry: vi.fn(), items: [] } });
    render(
      <MemoryRouter>
        <SpaceView {...view} />
      </MemoryRouter>,
    );
    fireEvent.click(within(screen.getByText("No posts here yet.").parentElement as HTMLElement).getByRole("button", { name: "Post here" }));
    expect(view.onPost).toHaveBeenCalled();
  });
});

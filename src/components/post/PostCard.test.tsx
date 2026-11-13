// UX-05 Part 1: the post card. Each attachment kind renders; one heading link per card; the replies strip is absent at zero.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { PostCard } from "./PostCard";
import { PostControl } from "./postControls";
import { splitBody, topicHref, type PostCardData } from "./postCardModel";

const base: PostCardData = {
  id: "p1",
  to: "/openbuilds/topics/p1",
  author: { id: "u1", name: "Sam Ellis", handle: "sam", avatarUrl: null },
  age: "2h",
  spaces: [
    { slug: "claude-code", name: "Claude Code" },
    { slug: "hiring-tools", name: "Hiring tools" },
  ],
  reward: "£40",
  heading: "Can anyone make the scorer faster?",
  text: "It takes four seconds a CV.",
  attachments: [],
  stillOpen: false,
  tags: [],
  closes: null,
  replies: null,
  pinned: false,
  hidden: null,
  engagementBuild: null,
};

const draw = (card: Partial<PostCardData> = {}, clamp = true) =>
  render(
    <MemoryRouter>
      <PostCard card={{ ...base, ...card }} clamp={clamp} />
    </MemoryRouter>,
  );

describe("PostCard", () => {
  it("draws the head: name, handle, age, the spaces as links, and the reward", () => {
    draw();
    const article = screen.getByRole("article");
    expect(within(article).getByText("Sam Ellis")).toBeInTheDocument();
    expect(article.textContent).toContain("@sam · 2h · in");
    expect(within(article).getByRole("link", { name: "Claude Code" })).toHaveAttribute("href", "/openbuilds/spaces/claude-code");
    expect(within(article).getByRole("link", { name: "Hiring tools" })).toHaveAttribute("href", "/openbuilds/spaces/hiring-tools");
    expect(within(article).getByText("£40")).toBeInTheDocument();
  });

  it("has one heading link to the post, and the replies strip as the only other link to it", () => {
    draw({ replies: { count: 6, people: [{ id: "u2", name: "Kit", avatarUrl: null }], detail: "3 builds · latest from @kit 20m ago", to: "/openbuilds/topics/p1" } });
    const toPost = screen.getAllByRole("link").filter((link) => link.getAttribute("href") === "/openbuilds/topics/p1");
    expect(toPost).toHaveLength(2);
    expect(screen.getAllByTestId("post-card-heading-link")).toHaveLength(1);
    // The control-heights pass: the heading link is a 24 line box.
    const heading = screen.getByTestId("post-card-heading-link");
    expect([heading.style.display, heading.style.lineHeight]).toEqual(["inline-block", "24px"]);
    const strip = screen.getByTestId("post-card-replies-strip");
    expect(strip.textContent).toContain("6 replies");
    expect(strip.textContent).toContain("3 builds · latest from @kit 20m ago");
  });

  it("has no replies strip at zero replies", () => {
    draw();
    expect(screen.queryByTestId("post-card-replies-strip")).toBeNull();
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href") === "/openbuilds/topics/p1")).toHaveLength(1);
  });

  it("draws a build with its harness, step count, and the still open step as a dashed slot", () => {
    draw({
      attachments: [
        {
          kind: "build",
          key: "b",
          title: "Resume screener",
          harness: "Claude Code",
          steps: 6,
          plaque: null,
          to: null,
          tiles: [
            { id: "s3", number: "Step 3", kind: "Code", title: "Rubric", open: false },
            { id: "s4", number: "Step 4", kind: "Prompt", title: "Scorer", open: true },
          ],
        },
      ],
    });
    expect(screen.getByText("Resume screener")).toBeInTheDocument();
    expect(screen.getByText("Claude Code · 6 steps")).toBeInTheDocument();
    const open = document.querySelector('[data-ui="dashed-slot"]') as HTMLElement;
    expect(open.textContent).toContain("Step 4 · Prompt");
    expect(open.textContent).toContain("Still open");
  });

  it("draws a step, a session and a part", () => {
    draw({
      attachments: [
        { kind: "step", key: "a", head: "Step 4 · Prompt", text: "Score each CV from 1 to 5." },
        { kind: "line", key: "b", text: "Session 3 · Claude Code · 6 prompts" },
        { kind: "line", key: "c", text: "Part B · 3 sessions" },
      ],
    });
    expect(screen.getByText("Step 4 · Prompt")).toBeInTheDocument();
    expect(screen.getByText("Score each CV from 1 to 5.")).toBeInTheDocument();
    expect(screen.getByText("Session 3 · Claude Code · 6 prompts")).toBeInTheDocument();
    expect(screen.getByText("Part B · 3 sessions")).toBeInTheDocument();
  });

  it("draws pictures as a build's posts do: the post media grid, and a file with a Download control", () => {
    draw({
      attachments: [
        { kind: "picture", key: "i", path: "entries/u1/a.png", mediaKind: "image", src: "https://example.test/a.png" },
        { kind: "picture", key: "j", path: "entries/u1/b.png", mediaKind: "image", src: "https://example.test/b.png" },
        { kind: "file", key: "f", name: "scores.csv", href: "https://example.test/scores.csv" },
      ],
    });
    const grid = screen.getByRole("group", { name: "2 pictures" });
    expect(grid).toHaveAttribute("data-post-media-grid", "");
    expect(document.querySelectorAll("[data-post-media-grid]")).toHaveLength(1);
    expect(screen.getByText("scores.csv")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute("href", "https://example.test/scores.csv");
  });

  it("sets the heading at the feed card's title size, 13/500, and the author at 15/600", () => {
    draw();
    const heading = screen.getByRole("heading", { name: base.heading });
    expect(heading.style.fontSize).toBe("13px");
    expect(heading.style.fontWeight).toBe("500");
    expect(screen.getByText("Sam Ellis").style.fontSize).toBe("15px");
    expect(screen.getByText("Sam Ellis").style.fontWeight).toBe("600");
  });

  it("draws the properties: Still open, tags, and the closing date", () => {
    draw({ stillOpen: true, tags: ["scoring", "cv"], closes: "Closes 20 Nov" });
    expect(screen.getByText("Still open")).toBeInTheDocument();
    expect(screen.getByText("#scoring #cv")).toBeInTheDocument();
    expect(screen.getByText("Closes 20 Nov")).toBeInTheDocument();
  });

  it("shows Pinned at the right, and a moderator's greyed card for a hidden post", () => {
    const { unmount } = draw({ pinned: true });
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    unmount();
    draw({ hidden: { by: "@ola", reason: null } });
    expect(screen.getByText("Hidden by @ola · only moderators see this")).toBeInTheDocument();
  });

  it("uses no em dash in any copy it draws", () => {
    draw({ stillOpen: true, tags: ["a"], closes: "Closes 20 Nov", pinned: true, replies: { count: 1, people: [], detail: "latest from @kit 2m ago", to: "/x" } });
    expect(document.body.textContent).not.toContain(String.fromCharCode(8212));
  });
});

describe("splitBody", () => {
  it("takes the first line as the heading and the rest as the text", () => {
    expect(splitBody("Heading\nMore words\nand more")).toEqual({ heading: "Heading", text: "More words\nand more" });
  });
  it("cuts a long first line at a space under 140 characters and carries the rest on", () => {
    const long = `${"word ".repeat(40)}end`;
    const { heading, text } = splitBody(long);
    expect(heading.length).toBeLessThanOrEqual(140);
    expect(`${heading} ${text}`.replace(/\s+/g, " ")).toBe(long);
  });
});

describe("PostControl", () => {
  it("keeps the handlers a menu or popover trigger puts on it (Radix opens on pointer down), and adds its own", () => {
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    render(
      <PostControl onPointerDown={onPointerDown} onClick={onClick}>
        Open
      </PostControl>,
    );
    const button = screen.getByRole("button", { name: "Open" });
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("topicHref", () => {
  it("is /openbuilds/topics/<id>, with the reply in view for a reply, and the Wall when the space sets it", () => {
    expect(topicHref("r1")).toBe("/openbuilds/topics/r1");
    expect(topicHref("r1", { replyId: "x9" })).toBe("/openbuilds/topics/r1?reply=x9");
    expect(topicHref("r1", { view: "wall" })).toBe("/openbuilds/topics/r1?view=wall");
    expect(topicHref("r1", { view: "thread" })).toBe("/openbuilds/topics/r1");
  });
});

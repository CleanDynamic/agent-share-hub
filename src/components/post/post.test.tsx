// PT-03 — the post renderer.
//
// What is worth pinning: the wire format is untrusted, so unknown nodes and bad
// links must not reach the page; the row's widths are arithmetic; capTall caps
// by shape and undoes itself; the counters and the reset are the thread's
// contract with the Gallery.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GalleryMedia } from "@/lib/build";
import { splitThread, type Post, type PostBlock, type ThreadDoc } from "@/lib/build/thread";

import { PostBody } from "./PostBody";
import { PostThread, type PostThreadMode } from "./PostThread";

/* ── fixtures ─────────────────────────────────────────────────────────────── */

const row = (id: string, kind: "image" | "video" = "image", width = 1000, height = 1000): GalleryMedia => ({
  id,
  node_id: null,
  bucket: "build-media",
  path: `p/${id}`,
  kind,
  width,
  height,
  poster_path: null,
  duration: null,
  post_position: null,
  post_text: null,
});

const MEDIA = new Map<string, GalleryMedia>(["a", "b", "c", "v"].map((id) => [id, row(id, id === "v" ? "video" : "image")]));
const NO_SRC = new Map<string, string>();

const pic = (mediaId: string, w: number | null, h: number | null, over: Record<string, unknown> = {}) =>
  ({ type: "postMedia", attrs: { mediaId, width: 100, w, h, alt: "", caption: "", ...over } }) as PostBlock;

const para = (...content: unknown[]) => ({ type: "paragraph", content }) as PostBlock;
const word = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });

const body = (blocks: PostBlock[], extra: Partial<Parameters<typeof PostBody>[0]> = {}) =>
  render(<PostBody post={{ content: blocks }} mediaById={MEDIA} srcByPath={NO_SRC} {...extra} />);

/* ── PostBody ─────────────────────────────────────────────────────────────── */

describe("PostBody", () => {
  it("skips node types it does not know, and renders the rest", () => {
    const { container } = body([
      { type: "iframe", attrs: { src: "https://evil.example" } } as unknown as PostBlock,
      para(word("kept")),
      { type: "script", content: [word("alert(1)")] } as unknown as PostBlock,
    ]);
    expect(container.querySelector("iframe, script")).toBeNull();
    expect(screen.getByText("kept")).toBeInTheDocument();
    expect(screen.queryByText("alert(1)")).toBeNull();
  });

  it("draws an unknown mark's text without the mark", () => {
    body([para(word("plain", [{ type: "highlight" }]))]);
    expect(screen.getByText("plain").tagName).toBe("P");
  });

  it("renders a javascript: link as text and an http link as a safe anchor", () => {
    body([
      para(word("bad", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]), word(" "), word("good", [{ type: "link", attrs: { href: "https://example.com/x" } }])),
    ]);
    expect(screen.queryByRole("link", { name: "bad" })).toBeNull();
    expect(screen.getByText(/bad/)).toBeInTheDocument();
    const good = screen.getByRole("link", { name: "good" });
    expect(good).toHaveAttribute("href", "https://example.com/x");
    expect(good).toHaveAttribute("target", "_blank");
    expect(good).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
  });

  it("allows mailto and refuses a relative or data: href", () => {
    body([
      para(
        word("mail", [{ type: "link", attrs: { href: "mailto:a@b.co" } }]),
        word("rel", [{ type: "link", attrs: { href: "/x" } }]),
        word("data", [{ type: "link", attrs: { href: "data:text/html,hi" } }]),
      ),
    ]);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "mail" })).toHaveAttribute("href", "mailto:a@b.co");
  });

  it("renders bold, italic and underline as strong, em and u", () => {
    body([para(word("b", [{ type: "bold" }]), word("i", [{ type: "italic" }]), word("u", [{ type: "underline" }]))]);
    expect(screen.getByText("b").tagName).toBe("STRONG");
    expect(screen.getByText("i").tagName).toBe("EM");
    expect(screen.getByText("u").tagName).toBe("U");
  });

  it("draws a heading as a p, so the page keeps its one h1, unless asked", () => {
    const heading = { type: "heading", attrs: { level: 1 }, content: [word("Title")] } as PostBlock;
    const small = { type: "heading", attrs: { level: 2 }, content: [word("Sub")] } as PostBlock;
    const first = body([heading, small]);
    expect(first.container.querySelector("h1, h2, h3")).toBeNull();
    expect(screen.getByText("Title").tagName).toBe("P");
    first.unmount();

    const second = body([heading, small], { realHeadings: true });
    expect(second.container.querySelector("h1")).toBeNull();
    expect(screen.getByText("Title").tagName).toBe("H2");
    expect(screen.getByText("Sub").tagName).toBe("H3");
  });

  it("sets the title at 20px, and at 17px 600 on a phone (29g: post text is 17; never larger than the page title)", () => {
    const heading = { type: "heading", attrs: { level: 1 }, content: [word("T")] } as PostBlock;
    const wide = body([heading]);
    expect(screen.getByText("T")).toHaveStyle({ fontSize: "20px", fontWeight: "500" });
    wide.unmount();
    body([heading], { phone: true });
    expect(screen.getByText("T")).toHaveStyle({ fontSize: "17px", fontWeight: "600" });
  });

  it("draws lists with their markers and a code block that scrolls", () => {
    const { container } = body([
      { type: "bulletList", content: [{ type: "listItem", content: [para(word("one"))] }, { type: "listItem", content: [para(word("two"))] }] } as PostBlock,
      { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [para(word("three"))] }] } as PostBlock,
      { type: "codeBlock", content: [word("const a = 1;")] } as PostBlock,
    ]);
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelector("ol")).toHaveAttribute("start", "3");
    const pre = container.querySelector("pre");
    expect(pre).toHaveStyle({ overflowX: "auto", whiteSpace: "pre" });
    expect(pre).toHaveTextContent("const a = 1;");
  });
});

/* ── PostMedia ────────────────────────────────────────────────────────────── */

// CA-07: PostMedia and PostMediaRow are gone; a post's pictures are one grid (media/PostMediaGrid.test.tsx).

/* ── PostThread ───────────────────────────────────────────────────────────── */

const doc = (count: number): ThreadDoc => ({
  type: "doc",
  content: Array.from({ length: count }, (_, index) => [
    ...(index ? [{ type: "postBreak" } as const] : []),
    { type: "paragraph", content: [{ type: "text", text: `Post ${index + 1} words` }] } as PostBlock,
  ]).flat(),
});

function Harness({ count = 4, start = "closed", resetKey }: { count?: number; start?: PostThreadMode; resetKey?: string }) {
  const [mode, setMode] = useState<PostThreadMode>(start);
  const posts: Post[] = splitThread(doc(count));
  return (
    <PostThread
      posts={posts}
      mediaById={MEDIA}
      srcByPath={NO_SRC}
      mode={mode}
      onOpen={() => setMode("open")}
      onClose={() => setMode("closed")}
      resetKey={resetKey}
    />
  );
}

describe("PostThread", () => {
  it("closed: post 1, and a toggle that counts the rest", () => {
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: "Show more · 3 more posts" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", document.querySelector("[data-post-region]")!.id);
    expect(document.querySelector("[data-post-region]")).toHaveAttribute("data-post-region", "closed");
    expect(document.querySelector("[data-post-region]")).toHaveAttribute("inert");
  });

  it("has no toggle when there is one post", () => {
    render(<Harness count={1} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says 1 more post, not 1 more posts", () => {
    render(<Harness count={2} />);
    expect(screen.getByRole("button", { name: "Show more · 1 more post" })).toBeInTheDocument();
  });

  it("opens, closes and opens again, with no counters on the later posts", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Post 2 words")).toBeInTheDocument();
    expect(screen.queryByText("2 / 4")).toBeNull();
    expect(document.querySelector("[data-post-region]")).not.toHaveAttribute("inert");
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByRole("button", { name: /Show more/ })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();
  });

  it("moves focus to the first revealed post on opening and back to the toggle on closing", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    const second = document.querySelector("[data-post='2']") as HTMLElement;
    expect(second).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(second);
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Show more/ }));
  });

  it("spaces the posts 16px apart, and draws the connector's nodes only with a connector", () => {
    const { rerender } = render(<Harness start="open" />);
    expect((document.querySelector("[data-post='3']") as HTMLElement).style.paddingTop).toBe("16px");
    expect(document.querySelector("[data-thread-node]")).toBeNull();
    rerender(
      <PostThread posts={splitThread(doc(3))} mediaById={MEDIA} srcByPath={NO_SRC} mode="open" connector={{ x: -32, top: 16 }} />,
    );
    expect(document.querySelectorAll("[data-thread-node]")).toHaveLength(2);
  });

  it("shows one dot skeleton while the rest loads, and the failed line with Try again", () => {
    const retry = vi.fn();
    const { rerender } = render(<PostThread posts={splitThread(doc(3))} mediaById={MEDIA} srcByPath={NO_SRC} mode="open" rest="loading" />);
    expect(document.querySelectorAll('[data-ui="loading"]')).toHaveLength(1);
    expect(screen.queryByText("Post 2 words")).toBeNull();
    rerender(<PostThread posts={splitThread(doc(3))} mediaById={MEDIA} srcByPath={NO_SRC} mode="open" rest="failed" onRetry={retry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("page: post 1 and the toggle; the toggle opens the rest and closes them again", () => {
    render(<Harness start="page" />);
    const region = () => document.querySelector("[data-post-region]") as HTMLElement;
    expect(region().getAttribute("data-post-region")).toBe("closed");
    expect(screen.getByRole("button", { name: "1 of 4 posts · Show more" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    expect(region().getAttribute("data-post-region")).toBe("open");
    expect(screen.getByText("Post 4 words")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(region().getAttribute("data-post-region")).toBe("closed");
  });

  it("page: the footer sits in the row with the toggle, and a single post has no toggle", () => {
    render(<Harness start="page" />);
    const foot = document.querySelector("[data-post-foot]") as HTMLElement;
    expect(foot.querySelector("[data-post-toggle]")).not.toBeNull();
  });

  it("does not let the toggle's click reach a link around the thread", () => {
    let reached = false;
    render(
      <a href="/b" onClick={() => (reached = true)}>
        <Harness />
      </a>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    expect(reached).toBe(false);
  });

  it("closes an open thread when resetKey changes, and not on mount", () => {
    const { rerender } = render(<Harness start="open" resetKey="one" />);
    expect(screen.getByText("Show less")).toBeInTheDocument();
    rerender(<Harness start="open" resetKey="one" />);
    expect(screen.getByText("Show less")).toBeInTheDocument();
    rerender(<Harness start="open" resetKey="two" />);
    expect(screen.getByRole("button", { name: /Show more/ })).toBeInTheDocument();
  });
});

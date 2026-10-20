// PT-03 — the post renderer.
//
// What is worth pinning: the wire format is untrusted, so unknown nodes and bad
// links must not reach the page; the row's widths are arithmetic; capTall caps
// by shape and undoes itself; the counters and the reset are the thread's
// contract with the Gallery.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

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

  it("sets the title at 28px, and 24px on a phone", () => {
    const heading = { type: "heading", attrs: { level: 1 }, content: [word("T")] } as PostBlock;
    const wide = body([heading]);
    expect(screen.getByText("T")).toHaveStyle({ fontSize: "28px", fontWeight: "500" });
    wide.unmount();
    body([heading], { phone: true });
    expect(screen.getByText("T")).toHaveStyle({ fontSize: "24px" });
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
    expect(screen.getByText("Show more")).toBeInTheDocument();
    expect(screen.getByText("3 more posts")).toBeInTheDocument();
    expect(screen.queryByText("2 / 4")).toBeNull();
    expect(document.querySelector("[data-post-region]")).toHaveAttribute("data-post-region", "closed");
    expect(document.querySelector("[data-post-region]")).toHaveAttribute("inert");
  });

  it("has no toggle when there is one post", () => {
    render(<Harness count={1} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says 1 more post, not 1 more posts", () => {
    render(<Harness count={2} />);
    expect(screen.getByText("1 more post")).toBeInTheDocument();
  });

  it("opens, shows the counters on the later posts, and closes again", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(screen.queryByText("1 / 4")).toBeNull();
    expect(document.querySelector("[data-post-region]")).not.toHaveAttribute("inert");
    fireEvent.click(screen.getByRole("button", { name: /Show less/ }));
    expect(screen.getByText("Show more")).toBeInTheDocument();
  });

  it("page: every post and its counter, no toggle", () => {
    render(<Harness start="page" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByText("Post 4 words")).toBeInTheDocument();
    expect(document.querySelector("[data-post-region]")).toBeNull();
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
    expect(screen.getByText("Show more")).toBeInTheDocument();
  });

  it("puts the counter in Geist Mono 11px", () => {
    render(<Harness start="open" />);
    const counter = within(document.body).getByText("2 / 4");
    expect(counter).toHaveStyle({ fontSize: "11px", color: "var(--label)" });
  });
});

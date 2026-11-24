// PT-04 — the Gallery feed's post: the maker on top, no box, the thread opening in place.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}));

const getThreadMedia = vi.fn();
vi.mock("@/lib/build/thread", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/thread")>()),
  getThreadMedia: (id: string) => getThreadMedia(id),
}));
vi.mock("./cardMedia", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./cardMedia")>()),
  signCardMedia: async () => new Map([["b1/m3.png", "https://signed.example/m3.png"]]),
}));

import type { GalleryBuild, GalleryMedia, ThreadDoc } from "@/lib/build";
import { GalleryCard } from "./GalleryCard";
import { feedMedia, type MediaSrcMap } from "./cardMedia";

const NO_MEDIA: MediaSrcMap = new Map();

const media = (id: string, over: Partial<GalleryMedia> = {}): GalleryMedia => ({
  id,
  node_id: null,
  bucket: "build-media",
  path: `b1/${id}.png`,
  kind: "image",
  width: 1600,
  height: 1000,
  poster_path: null,
  duration: null,
  post_position: null,
  post_text: null,
  ...over,
});

const pic = (mediaId: string) => ({ type: "postMedia", attrs: { mediaId, width: 100, w: 1600, h: 1000, alt: `alt ${mediaId}`, caption: "" } });
const words = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

const DOC = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "A thread title" }] },
    pic("m1"),
    { type: "postBreak" },
    words("Second post words"),
    pic("m3"),
    { type: "postBreak" },
    words("Third post words"),
  ],
} as unknown as ThreadDoc;

function build(over: Partial<GalleryBuild> = {}): GalleryBuild {
  return {
    id: "b1",
    creator_id: "c1",
    slug: "a-build",
    title: "Crumb homepage",
    outcome: "A homepage.",
    shape: "app",
    status: "published",
    made_for: [],
    made_with: ["ChatGPT", "Claude"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 80,
    reproduction_count: 3,
    last_confirmed_at: new Date().toISOString(),
    last_confirmed_model: "sonnet-5-5",
    published_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    rebuild_count: 2,
    nodes: [],
    media: [media("m1", { post_position: 0 }), media("m2")],
    post_doc: DOC,
    ...over,
  } as GalleryBuild;
}

function renderRow(subject: GalleryBuild, extra: Partial<Parameters<typeof GalleryCard>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <GalleryCard
          build={subject}
          srcByPath={NO_MEDIA}
          layout="row"
          makerHandle="maria"
          makerName="Maria Silva"
          makerAvatar={null}
          modelsUsed={[]}
          {...extra}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getThreadMedia.mockReset();
  getThreadMedia.mockResolvedValue([media("m1", { post_position: 0 }), media("m3", { post_position: 1 })]);
});

describe("the item has no box", () => {
  it("draws no background, border, shadow or radius, and no lamp", () => {
    const { container } = renderRow(build());
    const item = container.querySelector("[data-feed-post]") as HTMLElement;
    for (const property of ["background", "backgroundColor", "border", "borderWidth", "boxShadow", "borderRadius"] as const) {
      expect(item.style[property], property).toBe("");
    }
    expect(container.querySelector('[data-ui="picture-lamp"]')).toBeNull();
    expect(item).toHaveStyle({ padding: "4px 0px" });
  });

  it("is two columns 12px apart: a 40px author column and the content", () => {
    const { container } = renderRow(build());
    const item = container.querySelector("[data-feed-post]") as HTMLElement;
    expect(item).toHaveStyle({ columnGap: "12px" });
    expect(item.style.gridTemplateColumns).toMatch(/^40px minmax\(0(px)?, 1fr\)$/);
  });
});

describe("the author row", () => {
  it("shows the name, the handle and the short age, and no tool marks", () => {
    const { container } = renderRow(build());
    const row = container.querySelector("[data-feed-author-row]") as HTMLElement;
    expect(within(row).getByTestId("feed-author-name")).toHaveTextContent("Maria Silva");
    expect(row).toHaveTextContent("@maria · 2d");
    expect(row).toHaveStyle({ minHeight: "24px", gap: "6px" });
    // Synth 07: no tool marks beside the name.
    expect(within(row).queryByRole("img")).toBeNull();
  });

  it("links the name and the avatar to the profile", () => {
    const { container } = renderRow(build());
    expect(screen.getByTestId("feed-author-name")).toHaveAttribute("href", "/profile/maria");
    expect(container.querySelector("[data-feed-author-column] a")).toHaveAttribute("href", "/profile/maria");
  });

  it("falls back to the handle for a name, and to plain text when there is no handle", () => {
    renderRow(build(), { makerName: null, makerHandle: null });
    const name = screen.getByTestId("feed-author-name");
    expect(name).toHaveTextContent("Maker");
    expect(name.tagName).toBe("SPAN");
  });
});

describe("the thread", () => {
  it("is closed to post 1, with Show more and the count of the rest", () => {
    renderRow(build());
    const toggle = screen.getByRole("button", { name: "Show more · 2 more posts" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", document.querySelector("[data-post-region]")!.id);
    expect(toggle).toHaveStyle({ fontSize: "13px", fontWeight: "500", minHeight: "32px" });
    expect(document.querySelector("[data-thread-line]")).toBeNull();
  });

  it("says 1 more post for a thread of two", () => {
    renderRow(build({ post_doc: { type: "doc", content: [words("One"), { type: "postBreak" }, words("Two")] } as unknown as ThreadDoc }));
    expect(screen.getByRole("button", { name: "Show more · 1 more post" })).toBeInTheDocument();
  });

  it("opens at once, shows one dot skeleton while the rest is fetched, then the posts without an avatar or author row", async () => {
    let release: (rows: GalleryMedia[]) => void = () => {};
    getThreadMedia.mockReturnValue(new Promise<GalleryMedia[]>((resolve) => (release = resolve)));
    renderRow(build());

    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    const toggle = await screen.findByRole("button", { name: "Show less" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelectorAll('[data-ui="loading"]')).toHaveLength(1);
    expect(screen.queryByText("Second post words")).toBeNull();

    release([media("m1", { post_position: 0 }), media("m3", { post_position: 1 })]);
    await waitFor(() => expect(screen.getByText("Second post words")).toBeInTheDocument());
    expect(document.querySelector('[data-ui="loading"]')).toBeNull();
    expect(screen.getByText("Third post words")).toBeInTheDocument();
    expect(screen.queryByText("2 / 3")).toBeNull();

    // One author row and one avatar for the build, whatever the number of posts.
    expect(document.querySelectorAll("[data-feed-author-row]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-feed-author-column] img, [data-feed-author-column] [data-ui='avatar']").length).toBeLessThanOrEqual(1);
    // The build line and the actions are drawn once, under the last post.
    expect(document.querySelectorAll("[data-feed-build-line]")).toHaveLength(1);

    // The connector: a 2px line from 4px under the avatar, and a 10px node on each following post's first line.
    const lines = document.querySelectorAll("[data-thread-line]");
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toHaveStyle({ top: "16px", width: "2px", borderRadius: "1px", left: "-33px" });
    const nodes = document.querySelectorAll("[data-thread-node]");
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toHaveStyle({ width: "10px", height: "10px", borderRadius: "3px" });

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByRole("button", { name: /Show more/ })).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector("[data-thread-line]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument());
    expect(getThreadMedia).toHaveBeenCalledTimes(1);
    expect(getThreadMedia).toHaveBeenCalledWith("b1");
  });

  it("moves focus to the first revealed post when it opens, and back to Show more when it closes", async () => {
    renderRow(build());
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    await waitFor(() => expect(screen.getByText("Second post words")).toBeInTheDocument());
    const second = document.querySelector("[data-post='2']") as HTMLElement;
    expect(second).toHaveAttribute("tabindex", "-1");
    await waitFor(() => expect(document.activeElement).toBe(second));
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: /Show more/ })));
  });

  it("shows the failed line with Try again where the posts will appear, and tries again", async () => {
    getThreadMedia.mockRejectedValueOnce(new Error("offline"));
    renderRow(build());
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    const failed = await waitFor(() => {
      const node = document.querySelector("[data-post-failed]");
      expect(node).not.toBeNull();
      return node as HTMLElement;
    });
    expect(failed).toHaveTextContent("Couldn't load posts.");
    fireEvent.click(within(failed).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("Second post words")).toBeInTheDocument());
    expect(getThreadMedia).toHaveBeenCalledTimes(2);
  });

  it("shows Show more alone when only the text is cut, and opens only the text", () => {
    const heightOf = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-post-clamped") ? 400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute("data-post-clamped") ? 120 : 0;
    });
    renderRow(build({ post_doc: { type: "doc", content: [words("A very long post")] } as unknown as ThreadDoc }));
    const toggle = screen.getByRole("button", { name: "Show more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", document.querySelector("[data-post='1']")!.id);
    expect(document.querySelector("[data-post-clamped]")).toHaveStyle({ overflow: "hidden" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(document.querySelector("[data-post-clamped]")).toBeNull();
    expect(document.querySelector("[data-thread-line]")).toBeNull();
    expect(getThreadMedia).not.toHaveBeenCalled();
    heightOf.mockRestore();
    vi.restoreAllMocks();
  });

  it("has no toggle for a one-post thread", () => {
    renderRow(build({ post_doc: { type: "doc", content: [words("Only post")] } as unknown as ThreadDoc }));
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
    expect(screen.getByText("Only post")).toBeInTheDocument();
  });
});

describe("a build with no thread", () => {
  it("shows its title as the Title line and its cover, so the item is not empty", () => {
    const cover = media("m9", { post_position: null, width: 1200, height: 800 });
    renderRow(build({ post_doc: null, media: [cover], cover_media_id: "m9" }), { srcByPath: new Map([["b1/m9.png", "https://signed.example/m9.png"]]) });
    const post = document.querySelector("[data-feed-post-body]") as HTMLElement;
    // UX-03 P1: the title's words are the link to the build, inside the Title line.
    expect(within(post).getByText("Crumb homepage").closest("p")).toHaveStyle({ fontSize: "20px" });
    expect(within(post).getByRole("link", { name: "Crumb homepage" })).toHaveAttribute("href", expect.stringMatching(/^\/b2\//));
    expect(within(post).getByRole("img")).toHaveAttribute("src", "https://signed.example/m9.png");
    expect(screen.queryByRole("button", { name: /Show more/ })).toBeNull();
  });

  it("draws the cover fallback when there is no cover media at all", () => {
    renderRow(build({ post_doc: null, media: [] }));
    const post = document.querySelector("[data-feed-post-body]") as HTMLElement;
    expect(within(post).getByText("Crumb homepage")).toBeInTheDocument();
    expect(post.querySelector('[data-ui="cover-fallback"]')).not.toBeNull();
  });

  it("never draws anything at 2 / 1", () => {
    const { container } = renderRow(build({ post_doc: null, media: [] }));
    expect(container.innerHTML).not.toMatch(/aspect-ratio:\s*2\s*\/\s*1\b/);
  });
});

describe("the build line and the actions", () => {
  it("links the title to the build and has no made-with words", () => {
    renderRow(build());
    expect(screen.getByTestId("feed-build-title")).toHaveAttribute("href", "/b2/a-build");
    expect(screen.getByTestId("feed-build-title")).toHaveStyle({ fontSize: "13px", fontWeight: "500" });
    expect(screen.queryByText(/made with/i)).toBeNull();
    expect(screen.queryByTestId("rebuild-count")).toBeNull();
  });

  it("draws the action row with Rebuild, capped at 425px and spread, only when handed engagement", () => {
    const { unmount } = renderRow(build());
    expect(screen.queryByTestId("engagement-row")).toBeNull();
    unmount();

    renderRow(build(), { engagement: { counts: { likes: 3, comments: 1 }, liked: false, saved: false } });
    const row = screen.getByTestId("engagement-row");
    expect(row).toHaveStyle({ maxWidth: "425px", justifyContent: "space-between" });
    expect(row.querySelector('[data-engagement-action="rebuild"]')).not.toBeNull();
  });
});

describe("feedMedia", () => {
  it("signs post 1's pictures at the thread's width, and nothing else of the thread", () => {
    const rows = feedMedia(build());
    expect(rows.map((row) => [row.id, row.slotWidth])).toEqual([["m1", 1200]]);
  });

  it("signs a build with no thread from its cover", () => {
    const rows = feedMedia(build({ post_doc: null, media: [media("m9")], cover_media_id: "m9" }));
    expect(rows.map((row) => row.id)).toEqual(["m9"]);
  });
});

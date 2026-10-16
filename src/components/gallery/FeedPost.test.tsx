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
    expect(item).toHaveStyle({ padding: "20px 0px 16px" });
  });

  it("is two columns 12px apart: a 40px author column and the content", () => {
    const { container } = renderRow(build());
    const item = container.querySelector("[data-feed-post]") as HTMLElement;
    expect(item).toHaveStyle({ columnGap: "12px" });
    expect(item.style.gridTemplateColumns).toMatch(/^40px minmax\(0(px)?, 1fr\)$/);
  });
});

describe("the author row", () => {
  it("shows the name, the handle and the short age, the tools as marks after them", () => {
    const { container } = renderRow(build());
    const row = container.querySelector("[data-feed-author-row]") as HTMLElement;
    expect(within(row).getByTestId("feed-author-name")).toHaveTextContent("Maria Silva");
    expect(row).toHaveTextContent("@maria · 2d");
    expect(row).toHaveStyle({ minHeight: "24px", gap: "6px" });
    expect(within(row).getByRole("img", { name: "Made with ChatGPT and Claude" })).toBeInTheDocument();
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
    expect(screen.getByText("Show more")).toBeInTheDocument();
    expect(screen.getByText("2 more posts")).toBeInTheDocument();
    expect(document.querySelector("[data-feed-thread-line]")).toBeNull();
  });

  it("fetches the rest once, reads Loading… meanwhile, opens, and draws the line", async () => {
    let release: (rows: GalleryMedia[]) => void = () => {};
    getThreadMedia.mockReturnValue(new Promise<GalleryMedia[]>((resolve) => (release = resolve)));
    renderRow(build());

    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    const loading = await screen.findByRole("button", { name: "Loading…" });
    expect(loading).toBeDisabled();

    release([media("m1", { post_position: 0 }), media("m3", { post_position: 1 })]);
    await waitFor(() => expect(screen.getByRole("button", { name: /Show less/ })).toBeInTheDocument());
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(document.querySelector("[data-feed-thread-line]")).toHaveStyle({ top: "46px", width: "2px", borderRadius: "1px" });

    fireEvent.click(screen.getByRole("button", { name: /Show less/ }));
    expect(screen.getByRole("button", { name: /Show more/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Show less/ })).toBeInTheDocument());
    expect(getThreadMedia).toHaveBeenCalledTimes(1);
    expect(getThreadMedia).toHaveBeenCalledWith("b1");
  });

  it("opens even when the rest cannot be fetched, and tries again next time", async () => {
    getThreadMedia.mockRejectedValueOnce(new Error("offline"));
    renderRow(build());
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Show less/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Show less/ }));
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    await waitFor(() => expect(getThreadMedia).toHaveBeenCalledTimes(2));
  });

  it("has no toggle for a one-post thread", () => {
    renderRow(build({ post_doc: { type: "doc", content: [words("Only post")] } as unknown as ThreadDoc }));
    expect(screen.queryByText("Show more")).toBeNull();
    expect(screen.getByText("Only post")).toBeInTheDocument();
  });
});

describe("a build with no thread", () => {
  it("shows its title as the Title line and its cover, so the item is not empty", () => {
    const cover = media("m9", { post_position: null, width: 1200, height: 800 });
    renderRow(build({ post_doc: null, media: [cover], cover_media_id: "m9" }), { srcByPath: new Map([["b1/m9.png", "https://signed.example/m9.png"]]) });
    const post = document.querySelector("[data-feed-post-body]") as HTMLElement;
    expect(within(post).getByText("Crumb homepage")).toHaveStyle({ fontSize: "28px" });
    expect(within(post).getByRole("img")).toHaveAttribute("src", "https://signed.example/m9.png");
    expect(screen.queryByText("Show more")).toBeNull();
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

  it("follows the plaque with the open ask", () => {
    renderRow(build({ bounties: [{ id: "x", reward_gbp: 120, status: "open" }] as GalleryBuild["bounties"] }));
    expect(screen.getByTestId("feed-open-ask")).toHaveTextContent("1 part unsolved");
  });

  it("draws the action row with Rebuild, capped at 520px and spread, only when handed engagement", () => {
    const { unmount } = renderRow(build());
    expect(screen.queryByTestId("engagement-row")).toBeNull();
    unmount();

    renderRow(build(), { engagement: { counts: { likes: 3, comments: 1 }, liked: false, saved: false } });
    const row = screen.getByTestId("engagement-row");
    expect(row).toHaveStyle({ maxWidth: "520px", justifyContent: "space-between" });
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

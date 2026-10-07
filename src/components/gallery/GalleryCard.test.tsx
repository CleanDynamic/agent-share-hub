// UI-P14 — the build card, on real-shaped data.
//
// The pure card's own geometry is `brand/buildCard.test.tsx`; this is the
// adapter: a `GalleryBuild` in, the reference card out, with the order fixed,
// the cover resolved the way every surface resolves it, the chips read off the
// nodes the card carries, and the data the design wants but the card is not
// handed left out rather than invented.

import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { GalleryBuild } from "@/lib/build";
import { GalleryCard, GalleryCardSkeleton } from "./GalleryCard";
import type { MediaSrcMap } from "./cardMedia";

const NO_MEDIA: MediaSrcMap = new Map();
const SIGNED: MediaSrcMap = new Map([["b1/hero.png", "https://signed.example/hero.png"]]);
const DAY = 86_400_000;

function node(over: Record<string, unknown>) {
  return { id: "n1", type: "prompt", title: null, payload: {}, position: 0, is_gap: false, ...over };
}

function build(over: Partial<GalleryBuild> = {}): GalleryBuild {
  return {
    id: "b1",
    creator_id: "c1",
    slug: "a-build",
    title: "Invoice triage agent",
    outcome: "Triages invoices.",
    shape: "agent",
    status: "published",
    made_for: ["finance ops"],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    completeness: 80,
    reproduction_count: 41,
    last_confirmed_at: new Date(Date.now() - 3 * DAY).toISOString(),
    last_confirmed_model: "sonnet-4.5",
    published_at: "2026-08-01T00:00:00Z",
    nodes: [],
    media: [],
    ...over,
  } as GalleryBuild;
}

const heroRow = {
  id: "m1",
  node_id: "hero-node",
  bucket: "build-media",
  path: "b1/hero.png",
  kind: "image",
  width: 1200,
  height: 800,
};

const renderCard = (subject: GalleryBuild, srcByPath: MediaSrcMap = NO_MEDIA, layout?: "feed" | "grid") =>
  render(
    <MemoryRouter>
      <GalleryCard build={subject} srcByPath={srcByPath} layout={layout} />
    </MemoryRouter>,
  );

const parts = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-card-part]")].map((el) => el.getAttribute("data-card-part"));

describe("the card", () => {
  it("is one link to the build, named by its title", () => {
    renderCard(build({ nodes: [node({ type: "prompt" })] as GalleryBuild["nodes"] }));
    const link = screen.getByRole("link", { name: "Invoice triage agent" });
    expect(link).toHaveAttribute("href", "/b2/a-build");
    expect(link).toHaveAttribute("data-visual-slot", "gallery-card");
    // One link, and the lamp is not part of it.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("puts the lamp above the card, and the lamp follows the data", () => {
    const fresh = renderCard(build());
    expect(fresh.container.querySelector('[data-ui="picture-lamp"]')).toHaveAttribute("data-variant", "on");
    expect(
      fresh.container.querySelector('[data-ui="build-card"]')!.firstElementChild,
    ).toHaveAttribute("data-ui", "picture-lamp");
    fresh.unmount();

    const stale = renderCard(build({ last_confirmed_at: new Date(Date.now() - 400 * DAY).toISOString() }));
    expect(stale.container.querySelector('[data-ui="picture-lamp"]')).toHaveAttribute("data-variant", "dim");
    stale.unmount();

    const never = renderCard(build({ reproduction_count: 0, last_confirmed_at: null }));
    expect(never.container.querySelector('[data-ui="picture-lamp"]')).toHaveAttribute("data-variant", "off");
  });

  it("renders title, then plaque, then chips — and the credit between them on a rebuild", () => {
    const plain = renderCard(build({ nodes: [node({ type: "prompt" })] as GalleryBuild["nodes"] }));
    expect(parts(plain.container)).toEqual(["title", "plaque", "chips"]);
    plain.unmount();

    const rebuilt = renderCard(
      build({
        nodes: [node({ type: "prompt" })] as GalleryBuild["nodes"],
        source_title_at_fork: "Inbox sorter",
        source_handle_at_fork: "kofi",
      }),
    );
    expect(parts(rebuilt.container)).toEqual(["title", "credit", "plaque", "chips"]);
    expect(rebuilt.container.querySelector("[data-card-part='credit']")).toHaveTextContent(
      "Rebuilt from Inbox sorter by @kofi",
    );
    expect(rebuilt.container.querySelector("[data-card-part='credit'] i")).not.toBeNull();
  });

  it("puts the open ask last and dashes the border, and only then", () => {
    const open = renderCard(
      build({ nodes: [node({ type: "prompt" })] as GalleryBuild["nodes"], bounties: [{ id: "bo1", reward_gbp: 150, status: "open" }] }),
    );
    expect(parts(open.container)).toEqual(["title", "plaque", "chips", "reward"]);
    expect(open.container.querySelector("[data-card-part='reward']")).toHaveTextContent("1 part unsolved · £150");
    const edge = open.container.querySelector('[data-visual-slot="gallery-card"]') as HTMLElement;
    expect(edge.style.borderStyle).toBe("dashed");
    expect(edge.style.borderWidth).toBe("1.5px");
    open.unmount();

    const plain = renderCard(build());
    expect((plain.container.querySelector('[data-visual-slot="gallery-card"]') as HTMLElement).style.borderStyle).toBe("solid");
    expect(plain.container.querySelector("[data-card-part='reward']")).toBeNull();
  });

  it("is a reading surface: it blurs nothing", () => {
    const { container } = renderCard(build());
    expect(container.innerHTML).not.toMatch(/backdrop/i);
  });
});

describe("the cover", () => {
  it("is the build's own picture, signed, with object-fit cover and an alt that describes it", () => {
    const { container } = renderCard(
      build({
        hero_node_id: "hero-node",
        media: [heroRow],
        nodes: [node({ id: "hero-node", type: "screenshot", payload: { caption: "The queue, sorted" } })],
      } as Partial<GalleryBuild>),
      SIGNED,
    );
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "https://signed.example/hero.png");
    expect(img).toHaveAttribute("alt", "The queue, sorted");
    expect(img.style.objectFit).toBe("cover");
    expect(container.querySelector('[data-ui="cover-fallback"]')).toBeNull();
  });

  it("is the sky, seeded with the build id, when there is no picture or it is not signed yet", () => {
    const none = renderCard(build());
    expect(none.container.querySelector('[data-ui="cover-fallback"]')).not.toBeNull();
    const sky = none.container.querySelector('[data-ui="cover-fallback"]')!.getAttribute("data-sky");
    none.unmount();

    const unsigned = renderCard(build({ hero_node_id: "hero-node", media: [heroRow] } as Partial<GalleryBuild>), NO_MEDIA);
    expect(unsigned.container.querySelector("img")).toBeNull();
    expect(unsigned.container.querySelector('[data-ui="cover-fallback"]')!.getAttribute("data-sky")).toBe(sky);
  });

  it("carries the shape tag over its top-left, in the build's own shape", () => {
    const { container } = renderCard(build({ shape: "workflow" }));
    expect(within(container).getByText("workflow").closest('[data-ui="shape-tag"]')).not.toBeNull();
  });
});

describe("the part chips", () => {
  it("are the categories of the nodes the card carries, in reading order, never breakage", () => {
    const { container } = renderCard(
      build({
        nodes: [
          node({ id: "a", type: "result" }),
          node({ id: "b", type: "prompt" }),
          node({ id: "c", type: "dataset" }),
          node({ id: "d", type: "result", is_gap: true }),
        ] as GalleryBuild["nodes"],
      }),
    );
    const chips = [...container.querySelectorAll("[data-card-part='chips'] [data-ui='category-chip']")].map((c) => c.textContent);
    expect(chips).toEqual(["instruction", "data", "evidence"]);
    expect(container.querySelector('[data-category="breakage"]')).toBeNull();
  });

  it("are absent for a build with no nodes in the card's window, and the roles are not chips", () => {
    const { container } = renderCard(build({ made_for: ["founders"] }));
    expect(container.querySelector("[data-card-part='chips']")).toBeNull();
    expect(container).not.toHaveTextContent("founders");
  });
});

describe("what the card is not handed", () => {
  it("shows no 'by {maker}' and no Δ line, because it carries neither", () => {
    const { container } = renderCard(build());
    expect(container.querySelector("[data-card-part='credit']")).toBeNull();
    expect(container.querySelector('[data-testid="card-delta"]')).toBeNull();
  });
});

describe("the feed layout", () => {
  it("keeps the thread for a build that carries a post, inside the same one card", () => {
    const post = (position: number, text: string) => ({ ...heroRow, id: `m${position}`, post_position: position, post_text: text });
    const { container } = renderCard(
      build({ media: [post(0, "First, the inbox."), post(1, "Then the labels.")] } as Partial<GalleryBuild>),
      new Map([["b1/hero.png", "https://signed.example/hero.png"]]),
      "feed",
    );
    const card = container.querySelector('[data-visual-slot="gallery-card"]')!;
    expect(card.querySelector('[data-thread-layout="feed"]')).not.toBeNull();
    expect(container).toHaveTextContent("First, the inbox.");
    expect(card.querySelector('[data-ui="shape-tag"]')).toBeNull();
  });

  it("draws the cover for a feed build with no post", () => {
    const { container } = renderCard(build(), NO_MEDIA, "feed");
    expect(container.querySelector("[data-thread-layout]")).toBeNull();
    expect(container.querySelector('[data-ui="cover-fallback"]')).not.toBeNull();
    expect(container.querySelector('[data-card-layout="feed"]')).not.toBeNull();
  });
});

describe("the skeleton", () => {
  it("reserves the card's real proportions in both layouts", () => {
    const { container } = render(
      <>
        <GalleryCardSkeleton />
        <GalleryCardSkeleton layout="feed" />
      </>,
    );
    const [grid, feed] = [
      container.querySelector('[data-card-layout="grid"]') as HTMLElement,
      container.querySelector('[data-card-layout="feed"]') as HTMLElement,
    ];
    // Grid reserves the cover the loaded grid card uses.
    expect(grid.querySelector("[data-bg-animated]")).toHaveStyle({ height: "92px" });
    // Feed reserves a RATIO, which is what the loaded feed card does for a row
    // whose dimensions it does not know yet — so the swap moves nothing.
    const media = feed.querySelector("[data-bg-animated]") as HTMLElement;
    expect(media.style.aspectRatio).toBe("1.5");
    expect(media.style.height).toBe("");
  });

  it("draws the lamp's spacer, the cover, a title line, a plaque line, a chip row and the engagement row", () => {
    const { container } = render(<GalleryCardSkeleton />);
    // Cover, title, plaque, two chips, the engagement row (RC-P16).
    expect(container.querySelectorAll("[data-bg-animated]")).toHaveLength(6);
    expect(container.querySelector('[data-visual-slot="gallery-card-skeleton"]')).not.toBeNull();
  });

  it("is hidden from a screen reader, which has nothing to read in it", () => {
    const { container } = render(<GalleryCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden");
  });
});

describe("UI-P49 — the row layout", () => {
  const renderRow = (subject: GalleryBuild, extra: Partial<Parameters<typeof GalleryCard>[0]> = {}) =>
    render(
      <MemoryRouter>
        <GalleryCard build={subject} srcByPath={NO_MEDIA} layout="row" makerHandle="maria" modelsUsed={["claude-sonnet-5-5", "claude-opus-5-5", "claude-sonnet-5-5"]} {...extra} />
      </MemoryRouter>,
    );

  it("keeps the order: cover, title, description, credit, plaque, chips, open ask", () => {
    const { container } = renderRow(
      build({ nodes: [node({ type: "prompt" })] as never, bounties: [{ id: "x", reward_gbp: 25, status: "open" }] }),
    );
    const parts = [...container.querySelectorAll("[data-card-part]")].map((el) => el.getAttribute("data-card-part"));
    expect(parts).toEqual(["cover", "title", "description", "credit", "plaque", "chips", "reward"]);
  });

  it("credits the maker with a link to the profile and names the models once each", () => {
    renderRow(build());
    expect(screen.getByRole("link", { name: "@maria" })).toHaveAttribute("href", "/profile/maria");
    expect(screen.getByTestId("row-credit")).toHaveTextContent("by @maria · made with Sonnet 5.5 + Opus 5.5");
    expect(screen.getByRole("link", { name: "Invoice triage agent" })).toHaveAttribute("href", "/b2/a-build");
    expect(screen.getByText("Triages invoices.")).toBeInTheDocument();
  });

  it("lets the plaque and the lamp speak for the record it is handed", () => {
    const { container } = renderRow(build(), {
      plaqueBuild: { reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null, published_at: "2026-08-01T00:00:00Z" },
    });
    expect(screen.getByText("not yet reproduced")).toBeInTheDocument();
    expect(container.querySelector('[data-ui="picture-lamp"]')).toHaveAttribute("data-variant", "off");
  });

  it("keeps the rebuild credit on a rebuild", () => {
    renderRow(build({ source_title_at_fork: "Standup summariser", source_handle_at_fork: "kofi" }));
    expect(screen.getByTestId("rebuild-credit-line")).toHaveTextContent("Rebuilt from Standup summariser by @kofi");
  });
});

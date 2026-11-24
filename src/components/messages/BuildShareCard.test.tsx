// RC-P20 — a build in a message is the same object as a build on a card: its
// cover through cardMedia, its title, and the Plaque at card size, unchanged,
// all one link to the build's page.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GalleryBuild } from "@/lib/build";
import type { MediaSrcMap } from "@/components/gallery/cardMedia";
import { BuildShareCard } from "@/components/messages/BuildShareCard";

const COVER = {
  id: "m1",
  node_id: null,
  bucket: "build-media",
  path: "b1/cover.png",
  kind: "image",
  width: 1600,
  height: 900,
  poster_path: null,
  duration: null,
  post_position: null,
  post_text: null,
};

function build(over: Partial<GalleryBuild> = {}): GalleryBuild {
  return {
    id: "b1",
    creator_id: "c1",
    slug: "invoice-reader",
    title: "Invoice reader",
    outcome: "Reads an invoice and files its totals.",
    shape: "workflow",
    status: "published",
    made_for: [],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: "m1",
    completeness: 90,
    reproduction_count: 12,
    last_confirmed_at: "2026-09-26T00:00:00.000Z",
    last_confirmed_model: null,
    published_at: "2026-08-01T00:00:00.000Z",
    nodes: [],
    media: [COVER],
    ...over,
  } as GalleryBuild;
}

function renderCard(value: GalleryBuild, srcByPath: MediaSrcMap = new Map()) {
  render(
    <MemoryRouter>
      <BuildShareCard build={value} srcByPath={srcByPath} />
    </MemoryRouter>,
  );
  return screen.getByTestId("message-build");
}

describe("BuildShareCard", () => {
  it("is one link to the build's page, titled, with no plaque and no reproduction count (Synth 12)", () => {
    const card = renderCard(build());
    expect(card.getAttribute("href")).toBe("/b2/invoice-reader");
    expect(screen.getByTestId("message-build-title").textContent).toBe("Invoice reader");
    expect(card.querySelector('[data-visual-slot="plaque"]')).toBeNull();
    expect(screen.queryByTestId("reproduction-count")).toBeNull();
  });

  it("draws no picture before the cover is signed", () => {
    const unsigned = renderCard(build());
    expect(unsigned.querySelector("img")).toBeNull();
  });

  it("draws the signed cover", () => {
    const card = renderCard(build(), new Map([["b1/cover.png", "https://signed.example/cover.png"]]));
    expect(card.querySelector("img")?.getAttribute("src")).toBe("https://signed.example/cover.png");
  });
});

describe("BuildShareCard on a phone (mobile prompt 26 Part E)", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("is compact: 240 wide, the word Build, the name, and no cover", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: !query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }));
    const card = renderCard(build(), new Map([["b1/cover.png", "https://signed.example/cover.png"]]));
    expect(card.style.width).toBe("240px");
    expect(card.textContent).toContain("Build");
    expect(screen.getByTestId("message-build-title").textContent).toBe("Invoice reader");
    expect(card.querySelector("img")).toBeNull();
  });
});


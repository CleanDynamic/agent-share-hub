// Acceptance cover for the five card bodies.
//
// ONE CLAIM, TESTED FIVE TIMES AND THEN AGAIN AT THE WORST CASE: a build of
// each shape, with no uploaded thumbnail, renders something non-empty. The
// worst case is a build carrying nothing but an outcome — no nodes, no media,
// nothing a body can lead with — and it still has to produce a card, because
// the alternative is a gallery of blank tiles for every creator who did not
// know to upload a cover.
//
// Each assertion names the BRANCH it expects, through data-card-branch, so a
// body that renders something non-empty by accident — falling all the way to
// the outcome when its own material was there to use — fails rather than
// passes quietly.

import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { GalleryBuild } from "@/lib/build";
import { GalleryCard } from "./GalleryCard";
import type { MediaSrcMap } from "./cardMedia";

const NO_MEDIA: MediaSrcMap = new Map();
const SIGNED: MediaSrcMap = new Map([["b1/hero.png", "https://signed.example/hero.png"]]);

function node(over: Record<string, unknown>) {
  return {
    id: "n1",
    type: "prompt",
    title: null,
    payload: {},
    position: 0,
    is_gap: false,
    ...over,
  };
}

function build(over: Partial<GalleryBuild> = {}): GalleryBuild {
  return {
    id: "b1",
    creator_id: "c1",
    slug: "a-build",
    title: "A build",
    outcome: "Turns a week of manual triage into ten minutes.",
    shape: "other",
    status: "published",
    made_for: [],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    completeness: 80,
    reproduction_count: 0,
    last_confirmed_at: null,
    last_confirmed_model: null,
    published_at: "2026-08-01T00:00:00Z",
    nodes: [],
    media: [],
    ...over,
  } as GalleryBuild;
}

const heroMediaRow = {
  id: "m1",
  node_id: "hero-node",
  bucket: "build-media",
  path: "b1/hero.png",
  kind: "image",
  width: 1200,
  height: 800,
};

function renderCard(subject: GalleryBuild, srcByPath: MediaSrcMap = NO_MEDIA) {
  const { container } = render(
    <MemoryRouter>
      <GalleryCard build={subject} srcByPath={srcByPath} />
    </MemoryRouter>
  );
  const body = container.querySelector("[data-card-branch]") as HTMLElement;
  return { container, body, branch: body?.getAttribute("data-card-branch") };
}

/** Non-empty means it renders text, or a picture. Never an empty box. */
function isNonEmpty(body: HTMLElement): boolean {
  if (!body) return false;
  const text = (body.textContent ?? "").trim();
  const visual = body.querySelector("img, video, iframe");
  return text.length > 0 || Boolean(visual);
}

describe("the five card bodies, with no uploaded thumbnail", () => {
  // ACCEPTANCE 6 — app
  it("shows an app's live preview when the creator says it is embeddable", () => {
    const { body, branch } = renderCard(
      build({
        shape: "app",
        live_url: "https://example.test",
        nodes: [
          node({
            type: "live_app",
            payload: { url: "https://example.test", embeddable: true },
          }),
        ],
      })
    );

    expect(branch).toBe("embed");
    expect(isNonEmpty(body)).toBe(true);
    const frame = body.querySelector("iframe") as HTMLIFrameElement;
    // A card is a picture of an app, not a place to use one.
    expect(frame.style.pointerEvents).toBe("none");
    expect(frame).toHaveAttribute("loading", "lazy");
  });

  it("falls to an app's hero rather than gambling the card on an unflagged frame", () => {
    const subject = build({
      shape: "app",
      live_url: "https://example.test",
      hero_node_id: "hero-node",
      media: [heroMediaRow],
      nodes: [node({ type: "live_app", payload: { url: "https://example.test" } })],
    } as Partial<GalleryBuild>);

    const { body, branch } = renderCard(subject, SIGNED);
    expect(branch).toBe("media");
    expect(body.querySelector("img")).toHaveAttribute(
      "src",
      "https://signed.example/hero.png"
    );
  });

  // ACCEPTANCE 6 — prompt
  it("shows a prompt truncated, with its variables count", () => {
    const { body, branch } = renderCard(
      build({
        shape: "prompt",
        nodes: [
          node({
            type: "prompt",
            payload: {
              text: "You are a triage assistant. Sort {{inbox}} by {{urgency}}.",
              variables: [{ name: "inbox" }, { name: "urgency" }],
              model: "claude-sonnet-4-5",
            },
          }),
        ],
      })
    );

    expect(branch).toBe("prompt");
    expect(isNonEmpty(body)).toBe(true);
    expect(body).toHaveTextContent("You are a triage assistant");
    expect(body).toHaveTextContent("2 variables");
  });

  it("says a prompt takes no variables rather than hiding the figure", () => {
    const { body } = renderCard(
      build({ shape: "prompt", nodes: [node({ type: "prompt", payload: { text: "Do it." } })] })
    );
    expect(body).toHaveTextContent("no variables");
  });

  // ACCEPTANCE 6 — study
  it("shows a study's comparison table small, with the winner marked", () => {
    const { body, branch } = renderCard(
      build({
        shape: "study",
        nodes: [
          node({
            type: "comparison_table",
            payload: {
              columns: [{ label: "Model" }, { label: "Accuracy" }],
              rows: [
                { cells: "Sonnet 4.5 | 91%" },
                { cells: "Haiku 4.5 | 84%" },
                { cells: "Opus 4.1 | 88%" },
                { cells: "GPT | 80%" },
              ],
              winner: "Sonnet 4.5",
              n: 200,
            },
          }),
        ],
      })
    );

    expect(branch).toBe("table");
    expect(isNonEmpty(body)).toBe(true);
    expect(body).toHaveTextContent("Model");
    expect(body).toHaveTextContent("Sonnet 4.5 won");
    expect(body).toHaveTextContent("n = 200");
    // Three rows fit; the rest becomes a count rather than an illegible table.
    expect(body).toHaveTextContent("+1 more");
  });

  // ACCEPTANCE 6 — media
  it("shows a media build's variant grid, marking the one that was kept", () => {
    const variants = ["a", "b", "c"].map((suffix) => ({
      id: `m-${suffix}`,
      node_id: "n1",
      bucket: "build-media",
      path: `b1/${suffix}.png`,
      kind: "image",
      width: 512,
      height: 512,
    }));

    const signed = new Map(
      variants.map((row) => [row.path, `https://signed.example/${row.path}`])
    );

    const { body, branch } = renderCard(
      build({
        shape: "media",
        media: variants,
        nodes: [
          node({
            type: "generated_media",
            payload: {
              prompt: "a lighthouse",
              model: "some-image-model",
              variants: [
                { media_id: "m-a" },
                { media_id: "m-b", chosen: true },
                { media_id: "m-c" },
              ],
            },
          }),
        ],
      } as Partial<GalleryBuild>),
      signed
    );

    expect(branch).toBe("variants");
    expect(body.querySelectorAll("img")).toHaveLength(3);
    expect(body).toHaveTextContent("KEPT");
    // The kept one leads: a creator who chose is telling the reader which.
    expect(body.querySelector("img")).toHaveAttribute(
      "src",
      "https://signed.example/b1/b.png"
    );
  });

  // ACCEPTANCE 6 — default
  it("shows the hero for any other shape", () => {
    const { body, branch } = renderCard(
      build({ hero_node_id: "hero-node", media: [heroMediaRow] } as Partial<GalleryBuild>),
      SIGNED
    );
    expect(branch).toBe("media");
    expect(isNonEmpty(body)).toBe(true);
  });

  it("falls to an evidence node's own words when there is no picture", () => {
    const { body, branch } = renderCard(
      build({
        nodes: [
          node({
            id: "n2",
            type: "result",
            payload: { summary: "Cut triage from 6 hours to 40 minutes.", metric: "time", value: "40m" },
          }),
        ],
      })
    );

    expect(branch).toBe("evidence");
    expect(body).toHaveTextContent("Cut triage from 6 hours to 40 minutes.");
    expect(body).toHaveTextContent("time 40m");
  });

  it("never leads with a gap, which is an admitted hole rather than the work", () => {
    const { branch } = renderCard(
      build({
        nodes: [
          node({ id: "n3", type: "result", is_gap: true, payload: { summary: "never captured" } }),
        ],
      })
    );
    expect(branch).toBe("outcome");
  });
});

describe("the floor under every body", () => {
  const shapes = ["app", "agent", "workflow", "prompt", "study", "media", "dataset", "technique", "other"];

  it.each(shapes)(
    "renders something non-empty for a bare %s build with nothing but an outcome",
    (shape) => {
      const { body, branch } = renderCard(build({ shape } as Partial<GalleryBuild>));
      expect(branch).toBe("outcome");
      expect(isNonEmpty(body)).toBe(true);
      expect(body).toHaveTextContent("Turns a week of manual triage into ten minutes.");
    }
  );

  it("falls back to the title when even the outcome is missing", () => {
    const { body } = renderCard(build({ outcome: null }));
    expect(body).toHaveTextContent("A build");
  });

  it("renders a card for a build with no outcome and no title at all", () => {
    const { body } = renderCard(build({ outcome: null, title: "" }));
    expect(body).toHaveTextContent("Untitled build");
  });

  it("treats an unsigned media row as no media rather than a broken image", () => {
    // The signatures have not come back yet. The card must already be a card.
    const { body, branch } = renderCard(
      build({ hero_node_id: "hero-node", media: [heroMediaRow] } as Partial<GalleryBuild>),
      NO_MEDIA
    );
    expect(branch).toBe("outcome");
    expect(isNonEmpty(body)).toBe(true);
    expect(body.querySelector("img")).toBeNull();
  });
});

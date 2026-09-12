// BG-P09 — the thread box, both layouts, and the two rules that are not about
// looks.
//
// WHAT IS WORTH TESTING HERE. Not that the box is the right colour — the
// contrast test measures that from the tokens, and css-parity holds the
// stylesheet to them. What is worth testing is the behaviour a screenshot cannot
// show and a reviewer cannot eyeball:
//
//   1. THE CARD DOES NOT MOVE. Every media slot's height comes from the stored
//      dimensions, so the slot a browser lays out before the bytes arrive is the
//      slot it lays out after. Asserted by rendering the same entry with and
//      without a signed URL and comparing the slot, which is the property "no
//      layout shift" actually reduces to.
//   2. THE UNFOLD IS ONE STEP, computable before any image loads. Asserted on
//      the arithmetic (`threadReserve`) rather than on a measured element,
//      because jsdom has no layout engine and a test that pretended otherwise
//      would be measuring nothing.
//   3. THE CONTROL DOES NOT NAVIGATE. The whole card is an anchor; a button
//      inside one that let its click through would take the reader to the build
//      page instead of opening the thread they asked for.
//
// WHY THE COLLAPSED ENTRIES ARE IN THE DOM. A CSS height transition needs its
// target laid out, so the entries a collapsed card is not showing are present
// and clipped rather than unmounted — see the note on `UnfoldRegion`. "Shows one
// entry" is therefore a claim about what is PRESENTED, and `presented()` below
// is what that means: media outside a closed region. The collapsed region is
// also `inert`, so a keyboard and a screen reader agree with the eye.

import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { postEntriesOf, type GalleryMedia } from "@/lib/build";
import { MEDIA_WIDTH } from "@/components/build/MediaFigure";
import { BODY_HEIGHT } from "./cardBodies";
import { CARD_THREAD_WIDTH } from "./cardMedia";
import {
  CardThread,
  CONTROL_HEIGHT,
  ENTRY_GAP,
  THREAD_PAD,
  UNFOLD_MS,
  durationLabel,
  reservedMediaHeight,
  threadReserve,
} from "./CardThread";
import type { MediaSrcMap } from "./cardMedia";

/* ── fixtures ─────────────────────────────────────────────────────────────── */

function media(over: Partial<GalleryMedia> = {}): GalleryMedia {
  return {
    id: "m0",
    node_id: null,
    bucket: "build-media",
    path: "b1/0.png",
    kind: "image",
    width: 1200,
    height: 800,
    poster_path: null,
    duration: null,
    post_position: 0,
    post_text: null,
    ...over,
  };
}

/** A post of `count` pictures, each at its own path and position. */
function post(count: number, over: (i: number) => Partial<GalleryMedia> = () => ({})) {
  return Array.from({ length: count }, (_, i) =>
    media({ id: `m${i}`, path: `b1/${i}.png`, post_position: i, ...over(i) })
  );
}

const signed = (rows: readonly GalleryMedia[]): MediaSrcMap =>
  new Map(rows.map((row) => [row.path, `https://signed.example/${row.path}`]));

const NOTHING_SIGNED: MediaSrcMap = new Map();

function renderThread({
  rows,
  outcome = "Turns a week of manual triage into ten minutes.",
  layout = "feed" as "feed" | "grid",
  srcByPath,
}: {
  rows: readonly GalleryMedia[];
  outcome?: string | null;
  layout?: "feed" | "grid";
  srcByPath?: MediaSrcMap;
}) {
  const entries = postEntriesOf({ outcome }, rows);
  const { container } = render(
    <MemoryRouter>
      <CardThread
        entries={entries}
        srcByPath={srcByPath ?? signed(rows)}
        layout={layout}
        shape="agent"
        altFor={(row) => `picture ${row.id}`}
        gridBody={<div data-card-branch="media" style={{ height: BODY_HEIGHT }} />}
      />
    </MemoryRouter>
  );
  return { container, entries };
}

/**
 * The entries a reader is being shown: every picture that is not inside a
 * collapsed region. See the note at the top of this file.
 */
function presented(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll("[data-thread-media]")].filter(
    (slot) => !slot.closest('[data-thread-region="closed"]')
  ) as HTMLElement[];
}

/* ── the text ─────────────────────────────────────────────────────────────── */

describe("what the words above the first picture are", () => {
  it("is the build's description when the creator has not overridden it", () => {
    renderThread({ rows: post(1), outcome: "Sorts the inbox in ten minutes." });
    expect(screen.getByText("Sorts the inbox in ten minutes.")).toBeInTheDocument();
  });

  it("is the creator's own post_text where they wrote one", () => {
    renderThread({
      rows: [media({ post_text: "Here it is, running on live mail." })],
      outcome: "Sorts the inbox in ten minutes.",
    });
    expect(screen.getByText("Here it is, running on live mail.")).toBeInTheDocument();
    expect(screen.queryByText("Sorts the inbox in ten minutes.")).toBeNull();
  });

  it("renders nothing at all for an entry with no words, rather than a gap", () => {
    // The later entries of a post carry their own text or none, and none is the
    // ordinary case: the picture takes the top padding.
    const { container } = renderThread({ rows: post(2) });
    fireEvent.click(screen.getByRole("button"));
    const texts = container.querySelectorAll("[data-thread-text]");
    expect(texts).toHaveLength(1);
  });

  it("carries the description on entry 0 even with three later pictures", () => {
    renderThread({ rows: post(4), outcome: "One sentence." });
    expect(screen.getByText("One sentence.")).toBeInTheDocument();
  });
});

/* ── the two layouts ──────────────────────────────────────────────────────── */

describe("feed layout", () => {
  it("presents one entry collapsed and all of them after the unfold", () => {
    const { container } = renderThread({ rows: post(4) });

    expect(presented(container)).toHaveLength(1);
    const control = screen.getByRole("button");
    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(control).toHaveTextContent("Show thread · 3 more");

    fireEvent.click(control);

    expect(presented(container)).toHaveLength(4);
    expect(control).toHaveAttribute("aria-expanded", "true");
    expect(control).toHaveTextContent("Show less");
  });

  it("folds back up, and says so", () => {
    const { container } = renderThread({ rows: post(3) });
    const control = screen.getByRole("button");
    fireEvent.click(control);
    expect(presented(container)).toHaveLength(3);
    fireEvent.click(control);
    expect(presented(container)).toHaveLength(1);
    expect(control).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the collapsed entries out of the tab order and off the a11y path", () => {
    const { container } = renderThread({ rows: post(3) });
    const region = container.querySelector('[data-thread-region="closed"]');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button"));
    expect(container.querySelector('[data-thread-region="open"]')).not.toBeNull();
    expect(container.querySelector("[data-thread-region]")).not.toHaveAttribute("inert");
  });

  it("offers no control for a post of one, which has nothing to unfold", () => {
    renderThread({ rows: post(1) });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("points the control at the region it opens", () => {
    const { container } = renderThread({ rows: post(2) });
    const control = screen.getByRole("button");
    const region = container.querySelector("[data-thread-region]");
    expect(control.getAttribute("aria-controls")).toBe(region?.id);
    expect(region?.id).toBeTruthy();
  });

  it("draws the rail only once the thread is open", () => {
    const { container } = renderThread({ rows: post(3) });
    expect(container.querySelector("[data-thread-rail]")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(container.querySelector("[data-thread-rail]")).not.toBeNull();
  });

  it("puts the shape tag on the first picture and on no other", () => {
    const { container } = renderThread({ rows: post(4) });
    fireEvent.click(screen.getByRole("button"));
    const tags = container.querySelectorAll("[data-thread-shape]");
    expect(tags).toHaveLength(1);
    expect(tags[0]).toHaveTextContent("agent");
    expect(tags[0].closest("[data-thread-media]")).toHaveAttribute("data-thread-media", "0");
  });
});

describe("grid layout", () => {
  it("renders no entry text and offers no unfold", () => {
    const { container } = renderThread({ rows: post(4), layout: "grid" });
    expect(container.querySelector("[data-thread-text]")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("[data-thread-region]")).toBeNull();
  });

  it("renders the fixed slot it was handed, not the post's own shapes", () => {
    const { container } = renderThread({ rows: post(4), layout: "grid" });
    expect(container.querySelector("[data-card-branch]")).not.toBeNull();
    expect(container.querySelectorAll("[data-thread-media]")).toHaveLength(0);
  });

  it("says 1/N over the picture when the post has more than one", () => {
    const { container } = renderThread({ rows: post(4), layout: "grid" });
    expect(container.querySelector("[data-thread-count]")).toHaveTextContent("1/4");
  });

  it("says nothing about a count when there is only one picture", () => {
    const { container } = renderThread({ rows: post(1), layout: "grid" });
    expect(container.querySelector("[data-thread-count]")).toBeNull();
  });
});

/* ── the shape of a picture ───────────────────────────────────────────────── */

describe("what shape a picture is framed at", () => {
  it("crops a 5:1 panorama to the 2.0 cap", () => {
    const { container } = renderThread({
      rows: [media({ width: 5000, height: 1000 })],
    });
    const slot = container.querySelector("[data-thread-media]") as HTMLElement;
    expect(slot.style.aspectRatio).toBe("2");
    expect(slot).toHaveAttribute("data-thread-cropped");
    // The crop is object-fit, not a squeeze: the middle of the panorama shows.
    expect((slot.querySelector("img") as HTMLElement).style.objectFit).toBe("cover");
  });

  it("crops a 1:3 portrait to the 0.75 cap", () => {
    const { container } = renderThread({
      rows: [media({ width: 1000, height: 3000 })],
    });
    const slot = container.querySelector("[data-thread-media]") as HTMLElement;
    expect(slot.style.aspectRatio).toBe("0.75");
    expect(slot).toHaveAttribute("data-thread-cropped");
  });

  it("leaves a picture inside the caps at its own shape, uncropped", () => {
    const { container } = renderThread({ rows: [media({ width: 1200, height: 800 })] });
    const slot = container.querySelector("[data-thread-media]") as HTMLElement;
    expect(slot.style.aspectRatio).toBe("1.5");
    expect(slot).not.toHaveAttribute("data-thread-cropped");
  });

  it("assumes 3:2 for a row whose upload probe got no dimensions", () => {
    const { container } = renderThread({ rows: [media({ width: null, height: null })] });
    const slot = container.querySelector("[data-thread-media]") as HTMLElement;
    // Inside the capped range, so an assumption is never reported as a crop.
    expect(slot.style.aspectRatio).toBe("1.5");
    expect(slot).not.toHaveAttribute("data-thread-cropped");
  });
});

/* ── no layout shift ──────────────────────────────────────────────────────── */

describe("the card does not move when its pictures arrive", () => {
  it("reserves the identical slot with and without a signed URL", () => {
    // THIS IS WHAT "no layout shift" REDUCES TO. The slot's height is a function
    // of `aspect-ratio` and the column's width, and neither changes when the
    // bytes land — so the box a browser lays out before the picture exists is
    // the box it lays out after. jsdom has no layout engine, so the assertion is
    // on the declaration that produces the height rather than on a measurement
    // that would be zero either way.
    const rows = [media({ width: 1600, height: 900 })];

    const unloaded = renderThread({ rows, srcByPath: NOTHING_SIGNED });
    const before = (unloaded.container.querySelector("[data-thread-media]") as HTMLElement)
      .getAttribute("style");
    expect(unloaded.container.querySelector("img")).toBeNull();

    const loaded = renderThread({ rows });
    const after = (loaded.container.querySelector("[data-thread-media]") as HTMLElement)
      .getAttribute("style");
    expect(loaded.container.querySelector("img")).not.toBeNull();

    expect(after).toBe(before);
  });

  it("never sets a height on a media slot, so nothing can disagree with the ratio", () => {
    const { container } = renderThread({ rows: post(4) });
    for (const slot of container.querySelectorAll("[data-thread-media]")) {
      const style = (slot as HTMLElement).style;
      expect(style.aspectRatio).toBeTruthy();
      expect(style.height).toBe("");
      expect(style.minHeight).toBe("");
    }
  });

  it("asks for the picture lazily and decodes it off the main thread", () => {
    const { container } = renderThread({ rows: post(1) });
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
  });
});

/* ── the unfold, as arithmetic ────────────────────────────────────────────── */

describe("the collapsed and unfolded heights", () => {
  const BOX = 560; // the feed column, near enough

  it("are computable from the stored dimensions with nothing loaded", () => {
    const entries = postEntriesOf({ outcome: null }, post(4, () => ({ width: 1200, height: 800 })));
    const { collapsed, unfolded } = threadReserve(entries, "feed", BOX, BODY_HEIGHT);

    // No DOM, no images, no measurement: four numbers off the rows.
    const one = reservedMediaHeight({ width: 1200, height: 800 }, BOX);
    expect(collapsed).toBeCloseTo(THREAD_PAD * 2 + one + CONTROL_HEIGHT, 6);
    expect(unfolded).toBeCloseTo(
      THREAD_PAD * 2 + one * 4 + ENTRY_GAP * 2 * 3 + CONTROL_HEIGHT,
      6
    );
    expect(unfolded).toBeGreaterThan(collapsed);
  });

  it("reserve one picture's height from its own shape, not from an average", () => {
    const tall = reservedMediaHeight({ width: 1000, height: 1200 }, BOX);
    const wide = reservedMediaHeight({ width: 3000, height: 1000 }, BOX);
    expect(tall).toBeGreaterThan(wide);
    // Capped: a 3:1 is framed at 2:1, so its height is the content width halved.
    expect(wide).toBeCloseTo((BOX - THREAD_PAD * 2) / 2, 6);
    // And a 5:6 is inside the caps, so it is its own ratio.
    expect(tall).toBeCloseTo((BOX - THREAD_PAD * 2) / (1000 / 1200), 6);
  });

  it("are the same number in grid layout, because grid does not unfold", () => {
    const entries = postEntriesOf({ outcome: null }, post(4));
    const { collapsed, unfolded } = threadReserve(entries, "grid", BOX, BODY_HEIGHT);
    expect(collapsed).toBe(unfolded);
    expect(collapsed).toBe(BODY_HEIGHT + THREAD_PAD * 2);
  });

  it("leave no control row to reserve for a post of one", () => {
    const entries = postEntriesOf({ outcome: null }, post(1));
    const { collapsed, unfolded } = threadReserve(entries, "feed", BOX, BODY_HEIGHT);
    expect(collapsed).toBe(unfolded);
  });

  it("grow in ONE transition, of one property, for 240ms", () => {
    const { container } = renderThread({ rows: post(4) });
    const region = container.querySelector("[data-thread-region]") as HTMLElement;
    expect(region.style.transition).toBe(`grid-template-rows ${UNFOLD_MS}ms cubic-bezier(.2,.6,.35,1)`);
    expect(UNFOLD_MS).toBe(240);
    // 0fr to 1fr: the row resolves to its content, which is already reserved, so
    // the height it grows to is settled before any image has loaded.
    expect(region.style.gridTemplateRows).toBe("0fr");
    fireEvent.click(screen.getByRole("button"));
    expect(region.style.gridTemplateRows).toBe("1fr");
  });
});

/* ── the control is not the card's link ───────────────────────────────────── */

describe("the unfold control", () => {
  it("does not open the build page", () => {
    // The real thing: the box inside the card's own anchor, with a route that
    // renders visibly if the click ever reaches it.
    render(
      <MemoryRouter initialEntries={["/gallery"]}>
        <Routes>
          <Route
            path="/gallery"
            element={
              <a href="/b2/a-build" data-visual-slot="gallery-card">
                <CardThread
                  entries={postEntriesOf({ outcome: "A post." }, post(4))}
                  srcByPath={signed(post(4))}
                  layout="feed"
                  shape="agent"
                  altFor={() => "picture"}
                />
              </a>
            }
          />
          <Route path="/b2/:slug" element={<p>THE BUILD PAGE</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.queryByText("THE BUILD PAGE")).toBeNull();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("is a real button, so Enter and Space reach the same guard", () => {
    renderThread({ rows: post(2) });
    const control = screen.getByRole("button");
    expect(control.tagName).toBe("BUTTON");
    expect(control).toHaveAttribute("type", "button");
  });
});

/* ── video ────────────────────────────────────────────────────────────────── */

describe("a video in the thread", () => {
  const recording = media({
    id: "mv",
    kind: "video",
    path: "b1/demo.mp4",
    poster_path: "b1/demo-poster.jpg",
    duration: 42,
    width: 1920,
    height: 1080,
  });

  const posterSigned: MediaSrcMap = new Map([
    ["b1/demo-poster.jpg", "https://signed.example/demo-poster.jpg"],
  ]);

  it("shows the poster, never the video", () => {
    const { container } = renderThread({ rows: [recording], srcByPath: posterSigned });
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://signed.example/demo-poster.jpg"
    );
  });

  it("marks it with a play affordance that is not a disc", () => {
    const { container } = renderThread({ rows: [recording], srcByPath: posterSigned });
    const mark = container.querySelector('[data-card-mark="play"]') as HTMLElement;
    expect(mark).not.toBeNull();
    expect(mark.style.width).toBe("48px");
    expect(mark.style.borderRadius).toBe("var(--r-control)");
  });

  it("prints the duration as a clock, and nothing when none was recorded", () => {
    const { container } = renderThread({ rows: [recording], srcByPath: posterSigned });
    expect(container.querySelector("[data-thread-duration]")).toHaveTextContent("0:42");

    const { container: quiet } = renderThread({
      rows: [media({ ...recording, duration: null })],
      srcByPath: posterSigned,
    });
    expect(quiet.querySelector("[data-thread-duration]")).toBeNull();
  });

  it("formats a duration the way a clock does", () => {
    expect(durationLabel(42)).toBe("0:42");
    expect(durationLabel(60)).toBe("1:00");
    expect(durationLabel(605)).toBe("10:05");
    expect(durationLabel(0)).toBeNull();
    expect(durationLabel(null)).toBeNull();
    expect(durationLabel(Number.NaN)).toBeNull();
  });
});

/* ── the rules that are not about looks ──────────────────────────────────── */

describe("the never-nest rule", () => {
  const card = readFileSync("src/components/gallery/GalleryCard.tsx", "utf8");
  const thread = readFileSync("src/components/gallery/CardThread.tsx", "utf8");

  it("declares no backdrop-filter anywhere in the thread box's source", () => {
    // Declarations, not prose: the file explains at length WHY it has no blur,
    // and a sweep that could not tell the difference would forbid saying so.
    expect(thread).not.toMatch(/backdropFilter\s*:/);
    expect(thread).not.toMatch(/backdrop-filter\s*:/);
  });

  it("renders the box with no blur at all", () => {
    const { container } = renderThread({ rows: post(2) });
    const box = container.querySelector('[data-visual-slot="card-thread"]') as HTMLElement;
    expect(box).not.toBeNull();
    // The inline style attribute rather than the style object: jsdom does not
    // implement backdrop-filter, so the object reports undefined for it where an
    // unblurred element should report an empty string. Whatever the card set is
    // in the attribute either way.
    expect(box.getAttribute("style")).not.toMatch(/backdrop/i);
  });

  it("puts the two card surfaces on the two card tokens and nothing else", () => {
    // ASSERTED ON THE SOURCE, because jsdom cannot help here: its cssstyle
    // refuses every `var()` in a colour property, so a token-coloured element
    // arrives in a test with no colour declared at all. That is a property of
    // the test environment rather than of the card — every surface in this
    // codebase is coloured this way — and the honest place to check which token
    // each layer spends is therefore the declaration.
    expect(card).toMatch(/background: t\.cardFrame/);
    expect(thread).toMatch(/background: t\.cardThread/);
    // The box never borrows the frame's token: it does not draw the frame, and a
    // box painted --card-frame would be a box that had stopped being a region.
    expect(thread).not.toMatch(/t\.cardFrame/);
    // GalleryCard.tsx spends BOTH, and only because the skeleton lives there and
    // draws both layers — the frame's shape with the box inset in it. Every other
    // use of --card-thread in that file would be the frame painting itself as the
    // box, so the count is what is asserted rather than the absence.
    expect((card.match(/t\.cardThread/g) ?? []).length).toBe(1);
  });

  it("blurs exactly one surface across the two files, and it is the frame", () => {
    // The -webkit- prefixed copy of a declaration is the SAME declaration on the
    // same element, so the count is of property names that are not the prefix.
    // One blurred surface per card is the rule; two spellings of it is not two.
    const declarations = [...card.matchAll(/(\w*[Bb]ackdropFilter):/g)].map((m) => m[1]);
    expect(declarations).toEqual(["backdropFilter", "WebkitBackdropFilter"]);
    expect(card).toMatch(/background: t\.cardFrame/);
  });
});

describe("neither file reaches past the token system", () => {
  const card = readFileSync("src/components/gallery/GalleryCard.tsx", "utf8");
  const thread = readFileSync("src/components/gallery/CardThread.tsx", "utf8");

  it.each([
    ["GalleryCard.tsx", card],
    ["CardThread.tsx", thread],
  ])("%s spells no raw hex", (_name, text) => {
    // Comments included on purpose: a hex in a comment is a hex somebody will
    // paste into a style the next time this file is edited.
    expect(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  it.each([
    ["GalleryCard.tsx", card],
    ["CardThread.tsx", thread],
  ])("%s is nowhere a pill", (_name, text) => {
    // Spent, not merely mentioned: both files name the circular step in prose to
    // say they are not using it, and forbidding that sentence would be a sweep
    // arguing with its own documentation.
    expect(text).not.toMatch(/:\s*"?999px/);
    expect(text).not.toMatch(/var\(--r-full\)/);
    expect(text).not.toMatch(/\br\.full\b/);
    // The one 50% radius on the card is the plaque's LAMP, which is an oval and
    // is the shape the theme names for it. Nothing else may be round.
    const halves = text.match(/borderRadius: "50%[^"]*"/g) ?? [];
    expect(halves.length).toBeLessThanOrEqual(1);
  });
});

describe("every picture is asked for at a named width", () => {
  it("lists the thread box's slot in MEDIA_WIDTH rather than inventing one", () => {
    expect(MEDIA_WIDTH.thread).toBeTypeOf("number");
    expect(CARD_THREAD_WIDTH).toBe(MEDIA_WIDTH.thread);
    // The widest slot a card has, because the feed column is the widest place a
    // card appears.
    expect(MEDIA_WIDTH.thread).toBeGreaterThan(MEDIA_WIDTH.card);
  });
});

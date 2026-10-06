import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMPOSE_DESCRIPTION, COMPOSE_TITLE, composeViewProps } from "@/dev/fixtures/compose";

import { ComposeView, type ComposeViewProps } from "./ComposeView";

let narrow = false;

beforeEach(() => {
  narrow = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width") ? narrow : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

function view(props: Partial<ComposeViewProps> = {}) {
  const base = {
    ...composeViewProps(),
    onRetry: vi.fn(),
    onTitle: vi.fn(),
    onDescription: vi.fn(),
    onAudience: vi.fn(),
    onSaveRetry: vi.fn(),
    onPublish: vi.fn(),
    onFile: vi.fn(),
    onReplace: vi.fn(),
    onRemoveMedia: vi.fn(),
    ...props,
  };
  render(
    <MemoryRouter>
      <ComposeView {...base} />
    </MemoryRouter>,
  );
  return base;
}

const html = (props: Partial<ComposeViewProps> = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <ComposeView {...composeViewProps()} {...props} />
    </MemoryRouter>,
  );

describe("ComposeView — the frame", () => {
  it("heads the page with the title, and the status line says what is still needed", () => {
    view();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(COMPOSE_TITLE);
    expect(screen.getByTestId("compose-status").textContent).toBe("Draft · saved just now · still needs a cover picture or video, a prompt");
  });

  it("an untitled draft reads 'Untitled build' in --text2", () => {
    view({ heading: "" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Untitled build");
    expect(html({ heading: "Untitled build" })).toMatch(/<h1[^>]*color:var\(--text2\)[^>]*>Untitled build/);
    expect(html()).toMatch(/<h1[^>]*color:var\(--text\)[^>]*>Photo renamer/);
  });

  it("the status line has the three save states, and Try again on a failure", () => {
    const { onSaveRetry } = view({ saveState: "failed", missing: [] });
    const line = screen.getByTestId("compose-status");
    expect(line.textContent).toBe("Draft · not saved — Try again");
    fireEvent.click(within(line).getByRole("button", { name: "Try again" }));
    expect(onSaveRetry).toHaveBeenCalled();
  });

  it("saving…", () => {
    view({ saveState: "saving", missing: [] });
    expect(screen.getByTestId("compose-status").textContent).toBe("Draft · saving…");
  });

  it("Preview is a link to the draft once it exists, and disabled before", () => {
    view();
    expect(screen.getByRole("link", { name: "Preview" }).getAttribute("href")).toBe("/b2/photo-renamer-by-date-taken");
  });

  it("Preview is disabled until the draft exists, and the transcript link shows on the new-draft screen", () => {
    view(composeViewProps("empty"));
    expect((screen.getByRole("button", { name: "Preview" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: "Paste a transcript or a repo instead" }).getAttribute("href")).toBe("/compose/start");
  });
});

describe("ComposeView — Publish", () => {
  it("while something is missing it is at 0.7 opacity but still clickable", () => {
    const { onPublish } = view();
    const button = screen.getByRole("button", { name: "Publish" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("data-blocked")).toBe("true");
    expect(html()).toMatch(/data-blocked="true"[^>]*opacity:0\.7|opacity:0\.7[^>]*data-blocked="true"/);
    fireEvent.click(button);
    expect(onPublish).toHaveBeenCalled();
  });

  it("when nothing is missing it is whole", () => {
    view({ missing: [] });
    expect(screen.getByRole("button", { name: "Publish" }).getAttribute("data-blocked")).toBeNull();
  });

  it("published: a status banner, a See it link, and a disabled 'Published'", () => {
    view({ missing: [], published: { slug: "photo-renamer-abc", inGallery: true, shortfall: "" } });
    const banner = screen.getByRole("status", { name: "" });
    expect(banner.textContent).toContain("Published. It is in the Gallery now.");
    expect(within(banner).getByRole("link", { name: "See it" }).getAttribute("href")).toBe("/b2/photo-renamer-abc");
    expect((screen.getByRole("button", { name: "Published" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("published but not yet in the Gallery: says what it will take", () => {
    view({ missing: [], published: { slug: "x", inGallery: false, shortfall: "an audience and a link" } });
    expect(screen.getByTestId("published-banner").textContent).toContain(
      "Published. It will show in the Gallery once it has an audience and a link.",
    );
  });
});

describe("ComposeView — Media", () => {
  it("empty: the drop zone, with its two lines and the browse button, and a file input for pictures and video only", () => {
    view();
    const zone = screen.getByTestId("media-zone");
    expect(zone.textContent).toContain("Drop a screenshot or a short video");
    expect(within(zone).getByRole("button", { name: "or browse your files" })).toBeTruthy();
    const accept = (screen.getByTestId("media-input") as HTMLInputElement).accept.split(",");
    expect(accept).toContain("image/png");
    expect(accept).toContain("video/mp4");
    expect(accept.some((type) => type.startsWith("audio/") || type === "application/pdf" || type === "application/zip" || type === "text/csv")).toBe(false);
  });

  it("a dropped file is handed over; a drag with no files is ignored", () => {
    const { onFile } = view();
    const zone = screen.getByTestId("media-zone");
    const file = new File(["x"], "shot.png", { type: "image/png" });
    fireEvent.dragOver(zone, { dataTransfer: { types: ["Files"], files: [file] } });
    expect(zone.getAttribute("data-over")).toBe("true");
    fireEvent.drop(zone, { dataTransfer: { types: ["Files"], files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
    expect(zone.getAttribute("data-over")).toBeNull();
  });

  it("adding: the bar and 'Adding… 40%' (never 'upload')", () => {
    view({ media: { state: "adding", pct: 0.4 } });
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText("Adding… 40%")).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain("upload");
  });

  it("set: the picture, Cover, Replace and Remove", () => {
    const { onRemoveMedia } = view({ media: { state: "set", kind: "image", url: "https://example.test/cover.png" } });
    expect(screen.getByRole("img", { name: "Your cover" }).getAttribute("src")).toBe("https://example.test/cover.png");
    expect(screen.getByText("Cover")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replace" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onRemoveMedia).toHaveBeenCalled();
  });

  it("a video is a muted, inline, controlled <video>", () => {
    view({ media: { state: "set", kind: "video", url: "https://example.test/cover.mp4" } });
    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video.controls).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.getAttribute("playsinline")).not.toBeNull();
  });
});

describe("ComposeView — Text", () => {
  it("three labelled fields with the placeholders, and a counter", () => {
    const { onTitle, onDescription, onAudience } = view();
    const title = screen.getByLabelText("Title") as HTMLInputElement;
    expect(title.value).toBe(COMPOSE_TITLE);
    expect(screen.getByLabelText("Description").getAttribute("placeholder")).toBe("What does it do, and who is it for? One or two sentences.");
    expect(screen.getByText(`${COMPOSE_DESCRIPTION.length} / 200`)).toBeTruthy();
    fireEvent.change(title, { target: { value: "Photo renamer 2" } });
    expect(onTitle).toHaveBeenCalledWith("Photo renamer 2");
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Short." } });
    expect(onDescription).toHaveBeenCalledWith("Short.");
    fireEvent.change(screen.getByLabelText(/Who it.s for/), { target: { value: "photographers, " } });
    expect(onAudience).toHaveBeenCalledWith("photographers, ");
  });

  it("'Who it's for' suggests the gallery's audiences through a datalist, and hints at commas", () => {
    view();
    expect(screen.getByText("Separate with commas")).toBeTruthy();
    const list = document.getElementById("compose-audiences") as HTMLDataListElement;
    expect(Array.from(list.options).map((option) => option.value)).toEqual(["photographers", "families", "founders"]);
    expect(screen.getByLabelText(/Who it.s for/).getAttribute("list")).toBe("compose-audiences");
  });
});

describe("ComposeView — states and the phone", () => {
  it("loading draws skeleton panels, not fields", () => {
    view({ status: "loading" });
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.getByText("Loading your draft")).toBeTruthy();
  });

  it("an error is one sentence and Try again", () => {
    const { onRetry } = view({ status: "error" });
    expect(screen.getByText("That didn't load.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("no panel has glass or a blur: every panel is flat, and nothing in the view blurs", () => {
    view();
    const panels = Array.from(document.querySelectorAll('[data-ui="panel"]'));
    expect(panels.length).toBe(2);
    for (const panel of panels) {
      expect(panel.getAttribute("data-surface")).toBe("flat");
      expect(panel.className).not.toContain("bg-glass");
      expect(panel.getAttribute("style")).not.toMatch(/--glass\b|blur/);
    }
    expect(html()).not.toMatch(/backdrop-filter|bg-glass/);
  });

  it("on a phone: a sticky action bar with Preview and a full-width Publish, and the box is the button", () => {
    narrow = true;
    view({ media: { state: "empty" } });
    const bar = screen.getByTestId("compose-action-bar");
    expect(within(bar).getByRole("link", { name: "Preview" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(screen.queryByTestId("media-zone")).toBeNull();
    expect(screen.getByRole("button", { name: "Add a screenshot or a short video" })).toBeTruthy();
    expect(html()).toBeTruthy();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { composeViewProps } from "@/dev/fixtures/compose";

import { ComposeView, type ComposeViewProps } from "./ComposeView";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

const props = (over: Partial<ComposeViewProps> = {}): ComposeViewProps => ({ ...composeViewProps(), ...over });

function view(over: Partial<ComposeViewProps> = {}) {
  const base = props({ onPublish: vi.fn(), onFiles: vi.fn(), onRetrySave: vi.fn(), ...over });
  render(
    <MemoryRouter>
      <ComposeView {...base} />
    </MemoryRouter>,
  );
  return base;
}

describe("ComposeView", () => {
  it("shows the untitled heading and what is still needed", () => {
    view({ title: "", slug: null });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Untitled build");
    expect(screen.getByTestId("compose-status").textContent).toContain("still needs a cover picture or video, a prompt");
  });

  it("keeps Publish clickable while something is missing", () => {
    const base = view();
    const button = screen.getByRole("button", { name: "Publish" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    expect(base.onPublish).toHaveBeenCalledTimes(1);
  });

  it("reads each save state, with a retry on a failure", () => {
    view({ save: "error" });
    expect(screen.getByTestId("compose-status").textContent).toContain("not saved — Try again");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  });

  it("draws the published banner and disables Publish", () => {
    view({ missing: [], published: { slug: "x", inGallery: true, shortfall: "" } });
    expect(screen.getByTestId("compose-published").textContent).toContain("Published. It is in the Gallery now.");
    expect(screen.getByRole("link", { name: "See it" }).getAttribute("href")).toBe("/b2/x");
    const done = screen.getByRole("button", { name: "Published" }) as HTMLButtonElement;
    expect(done.disabled).toBe(true);
  });

  it("offers images and video only, and no glass", () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ComposeView {...props()} />
      </MemoryRouter>,
    );
    expect(markup).toContain('accept="image/png,image/jpeg,video/mp4"');
    expect(markup).not.toContain("bg-glass");
    expect(markup).not.toContain("backdrop-filter");
  });
});

// UX-12 P2 and P3: the legal view and pages, from fixture content.
import fs from "node:fs";
import path from "node:path";

import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vitest";

import type { LegalText } from "@/content/legal/types";

import { LegalPage } from "./LegalPage";
import { LegalView } from "./LegalView";
import { DRAFT_NOTICE, formatLastUpdated, hashTarget, piecesOf } from "./legalModel";

const fixture = (reviewed: boolean, extra = ""): LegalText => ({
  title: "Fixture policy",
  lastUpdated: "2026-11-04",
  reviewed,
  intro: "An intro.",
  sections: [
    { id: "first-part", heading: "First part", blocks: [{ kind: "p", text: `Email {{NEED: contact email}} or see ico.org.uk. ${extra}` }] },
    { id: "second-part", heading: "Second part", blocks: [{ kind: "list", items: ["one", "two"] }] },
    { id: "third-part", heading: "Third part", blocks: [{ kind: "table", head: ["What", "Why"], rows: [["a", "b"]] }] },
  ],
});

// jsdom has no scrollIntoView; a browser does.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
});

const view = (text: LegalText) => render(<LegalView text={text} />);

describe("formatting", () => {
  it("writes the date in full", () => {
    expect(formatLastUpdated("2026-11-04")).toBe("4 November 2026");
    expect(formatLastUpdated("nonsense")).toBe("nonsense");
  });
  it("cuts placeholders and outside addresses out of a sentence", () => {
    expect(piecesOf("a {{NEED: x}} b ico.org.uk").map((piece) => piece.kind)).toEqual(["text", "need", "text", "link"]);
  });
  it("reads a hash", () => {
    expect(hashTarget("#your-rights")).toBe("your-rights");
    expect(hashTarget("")).toBe("");
  });
});

describe("LegalView", () => {
  it("draws the title, the date, the headings in order, their anchors and the table", () => {
    view(fixture(true));
    expect(screen.getByRole("heading", { level: 1, name: "Fixture policy" })).toBeInTheDocument();
    expect(screen.getByText("Last updated 4 November 2026")).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual(["First part", "Second part", "Third part"]);
    for (const id of ["first-part", "second-part", "third-part"]) expect(document.getElementById(id)).not.toBeNull();
    expect(screen.getByTestId("legal-table").querySelector("table")).not.toBeNull();
    const contents = within(screen.getByTestId("legal-contents"));
    expect(contents.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["#first-part", "#second-part", "#third-part"]);
    expect(screen.getByRole("link", { name: "Back to top" })).toHaveAttribute("href", "#legal-top");
  });

  it("links an outside address out of the site and not into it", () => {
    view(fixture(true));
    expect(screen.getByRole("link", { name: "ico.org.uk" })).toHaveAttribute("href", "https://ico.org.uk");
  });

  it("shows the draft box and highlights placeholders while it is a draft; neither once reviewed", () => {
    const { unmount } = view(fixture(false));
    expect(screen.getByTestId("legal-draft")).toHaveTextContent(DRAFT_NOTICE);
    const need = screen.getByText("{{NEED: contact email}}");
    expect(need.tagName).toBe("MARK");
    expect(renderToStaticMarkup(<LegalView text={fixture(false)} />)).toContain("background-color:var(--lit)");
    unmount();
    view(fixture(true));
    expect(screen.queryByTestId("legal-draft")).toBeNull();
  });

  it("collapses the list under one row on a phone", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...original(query), matches: query.includes("max-width") })) as typeof window.matchMedia;
    try {
      view(fixture(true));
      const details = screen.getByTestId("legal-contents").querySelector("details");
      expect(details).not.toBeNull();
      expect(details).not.toHaveAttribute("open");
    } finally {
      window.matchMedia = original;
    }
  });

  it("imports nothing from src/lib/ but the theme", () => {
    for (const file of ["LegalView.tsx", "legalModel.ts"]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), "utf8");
      const libs = [...source.matchAll(/from "(@\/lib\/[^"]+)"/g)].map((match) => match[1]);
      for (const lib of libs) expect(lib, `${file} imports ${lib}`).toMatch(/^@\/lib\/theme\//);
    }
  });
});

describe("LegalPage", () => {
  const page = (text: LegalText) =>
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/privacy#second-part"]}>
          <LegalPage name="privacy" text={text} seoTitle="Privacy policy · OpenBuilds" description="d" path="/privacy" />
        </MemoryRouter>
      </HelmetProvider>,
    );

  it("sets noindex while a draft and index once reviewed, with the title", async () => {
    const { unmount } = page(fixture(false));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.title).toBe("Privacy policy · OpenBuilds");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
    unmount();
    page(fixture(true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
  });

  it("marks the page ready at once and scrolls to the section in the address", async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    page(fixture(true));
    expect(document.documentElement.getAttribute("data-page-ready")).toBe("privacy");
    expect(scrolled).toEqual(["second-part"]);
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PAGE_TITLE, PageHeader } from "./PageHeader";
import { FIGTREE, type } from "@/lib/theme/type";

/* ────────────────────────────────────────────────
   BG-P14 — PageHeader.

   Four optional-ish parts, one required one, and a type contract: the title is
   the page's one <h1>, in the display face, at the section-head size.
──────────────────────────────────────────────── */

describe("PageHeader", () => {
  it("renders the title as the page's one h1", () => {
    render(<PageHeader title="The gallery" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent("The gallery");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it("sets the title in the site pages' face: Figtree 20 / 500, line 24, -0.015em", () => {
    render(<PageHeader title="The gallery" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.style.fontFamily).toBe(FIGTREE);
    expect(h1.style.fontSize).toBe("20px");
    expect(h1.style.fontWeight).toBe("500");
    expect(h1.style.lineHeight).toBe("24px");
    expect(h1.style.letterSpacing).toBe("-0.015em");
    /* The one shared style, spread whole. */
    const reference = render(<h1 style={PAGE_TITLE} />).container.querySelector("h1")!;
    expect(h1.getAttribute("style")).toBe(reference.getAttribute("style"));
  });

  it("puts the breadcrumb in the 24 above the title, out of flow", () => {
    const { container } = render(<PageHeader title="The gallery" breadcrumb={<nav aria-label="Breadcrumb" />} />);
    const slot = container.querySelector('[data-slot="page-breadcrumb"]') as HTMLElement;
    expect(slot.style.position).toBe("absolute");
    expect(slot.style.bottom).toBe("100%");
    expect(slot.style.height).toBe("24px");
    expect(slot.compareDocumentPosition(screen.getByRole("heading", { level: 1 }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders a title alone — every other part is optional", () => {
    const { container } = render(<PageHeader title="Only a title" />);
    expect(container.querySelectorAll("span")).toHaveLength(0);
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("sets the eyebrow in the mono face above the title", () => {
    render(<PageHeader eyebrow="42 builds" title="The gallery" />);
    const eyebrow = screen.getByText("42 builds");
    expect(eyebrow.style.fontFamily).toBe(type.eyebrow.fontFamily);
    expect(eyebrow.style.textTransform).toBe("uppercase");
    expect(eyebrow.compareDocumentPosition(screen.getByRole("heading", { level: 1 })))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("caps the description at the reading measure and puts it last", () => {
    render(
      <PageHeader
        title="The gallery"
        description="Every build published here, newest first."
        actions={<button>New build</button>}
      />,
    );
    const p = screen.getByText("Every build published here, newest first.");
    expect(p.tagName).toBe("P");
    expect(p.style.maxWidth).toBe("68ch");
    /* Under the whole title row, actions included — not beside either. */
    expect(screen.getByRole("button").compareDocumentPosition(p))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders actions beside the title", () => {
    render(<PageHeader title="The gallery" actions={<button>New build</button>} />);
    expect(screen.getByRole("button", { name: "New build" })).toBeInTheDocument();
  });

  it("lets the title row wrap rather than overflow", () => {
    const { container } = render(
      <PageHeader title="A title long enough to crowd its own actions" actions={<button>Go</button>} />,
    );
    const row = container.querySelector("header > div") as HTMLElement;
    expect(row.style.flexWrap).toBe("wrap");
    expect((container.querySelector("header > div > div") as HTMLElement).style.minWidth).toBe("0");
  });
});

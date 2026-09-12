import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";
import { BODONI, DM_MONO, sectionHead } from "@/lib/theme/type";
import { t } from "@/lib/theme/tokens";

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

  it("sets the title in the display face, at the whole sectionHead role", () => {
    render(<PageHeader title="The gallery" />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.style.fontFamily).toBe(BODONI);

    /* The role SPREAD, not picked apart — a heading that arrived with the
       size but not the weight is how a scale stops being one. Compared
       against a reference element rather than property by property, so a
       field added to the role is covered without editing this test.

       `fontSize` is absent from both sides: jsdom's CSS parser drops a
       `clamp()`, and the role's size is a clamp. It is held by the type
       scale's own test and measured for real in the browser sweep. */
    const reference = render(<h1 style={{ ...sectionHead, color: t.text, margin: 0 }} />)
      .container.querySelector("h1")!;
    expect(h1.getAttribute("style")).toBe(reference.getAttribute("style"));
  });

  it("renders a title alone — every other part is optional", () => {
    const { container } = render(<PageHeader title="Only a title" />);
    expect(container.querySelectorAll("span")).toHaveLength(0);
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("sets the eyebrow in the mono face above the title", () => {
    render(<PageHeader eyebrow="42 builds" title="The gallery" />);
    const eyebrow = screen.getByText("42 builds");
    expect(eyebrow.style.fontFamily).toBe(DM_MONO);
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

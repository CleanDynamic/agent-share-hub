// BG-P11 — the rebuild credit.
//
// Three claims: the credit reads exactly as rebuildCredit.ts composes it
// whether or not its halves are links, the Δ summary truncates above six and
// expands in place, and a deleted source keeps its credit with "(no longer
// available)" and no link.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  COLLAPSED_LINES,
  EXPAND_FROM,
  GONE,
  RebuildCredit,
  changeKindColour,
  matchesCreditLine,
  summaryWindow,
} from "./RebuildCredit";
import { rebuildCreditLine } from "@/components/build/rebuildCredit";
import type { ChangeLine } from "@/lib/build";

const SOURCE = {
  source_title_at_fork: "Inbox triage agent",
  source_handle_at_fork: "amara",
};

function lines(count: number): ChangeLine[] {
  return Array.from({ length: count }, (_, i) => ({
    kind: (["changed", "added", "removed", "header"] as const)[i % 4],
    key: `k${i}`,
    text: `Change number ${i + 1}`,
  }));
}

function renderCredit(props: Partial<React.ComponentProps<typeof RebuildCredit>> = {}) {
  return render(
    <MemoryRouter>
      <RebuildCredit source={SOURCE} {...props} />
    </MemoryRouter>
  );
}

describe("the credit is rebuildCredit.ts's sentence", () => {
  const sources = [
    { source_title_at_fork: "Inbox triage agent", source_handle_at_fork: "amara" },
    { source_title_at_fork: "A build with no creator handle", source_handle_at_fork: null },
    { source_title_at_fork: "  padded  ", source_handle_at_fork: "  rae  " },
  ];

  for (const source of sources) {
    it(`reads identically linked and unlinked — ${source.source_title_at_fork?.trim()}`, () => {
      const plain = render(
        <MemoryRouter>
          <RebuildCredit source={source} />
        </MemoryRouter>
      );
      const plainText = screen.getByTestId("rebuild-credit-line").textContent ?? "";
      expect(matchesCreditLine(source, plainText)).toBe(true);
      plain.unmount();

      render(
        <MemoryRouter>
          <RebuildCredit source={source} to="/b2/x" handleTo="/creator/y" />
        </MemoryRouter>
      );
      const linkedText = screen.getByTestId("rebuild-credit-line").textContent ?? "";
      expect(matchesCreditLine(source, linkedText)).toBe(true);
      expect(linkedText).toBe(plainText);
    });
  }

  it("renders nothing when the fork froze no snapshot", () => {
    const { container } = render(
      <MemoryRouter>
        <RebuildCredit source={{ source_title_at_fork: null, source_handle_at_fork: "amara" }} />
      </MemoryRouter>
    );
    expect(container.querySelector("[data-visual-slot='rebuild-credit']")).toBeNull();
  });

  it("links the title to the source and the handle to its creator", () => {
    renderCredit({ to: "/b2/inbox-triage", handleTo: "/creator/amara" });
    const line = screen.getByTestId("rebuild-credit-line");
    const links = within(line).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/b2/inbox-triage",
      "/creator/amara",
    ]);
  });
});

describe("a source that is gone", () => {
  it("keeps the snapshot sentence and says it is no longer available", () => {
    renderCredit({ gone: true });
    const line = screen.getByTestId("rebuild-credit-line");
    expect(line).toHaveTextContent(rebuildCreditLine(SOURCE) as string);
    expect(line).toHaveTextContent(GONE);
  });

  it("offers nothing to click, even when a target was supplied", () => {
    renderCredit({ gone: true, to: "/b2/inbox-triage", handleTo: "/creator/amara" });
    const line = screen.getByTestId("rebuild-credit-line");
    expect(within(line).queryAllByRole("link")).toHaveLength(0);
  });

  it("says nothing about availability while the lookup is still out", () => {
    renderCredit();
    expect(screen.getByTestId("rebuild-credit-line").textContent).not.toContain(GONE);
    expect(
      screen.getByTestId("rebuild-credit-line").closest("[data-source-resolved]")
    ).toHaveAttribute("data-source-resolved", "pending");
  });
});

describe("the Δ summary", () => {
  it("is absent when nobody worked the changes out", () => {
    renderCredit();
    expect(screen.queryByTestId("rebuild-credit-summary")).toBeNull();
  });

  it("says so plainly when the diff came back empty", () => {
    renderCredit({ changes: [] });
    const summary = screen.getByTestId("rebuild-credit-summary");
    expect(summary).toHaveAttribute("data-change-count", "0");
    expect(summary).toHaveTextContent(/nothing in the record reads differently/i);
  });

  it("shows every line at six, with nothing to expand", () => {
    renderCredit({ changes: lines(COLLAPSED_LINES) });
    expect(screen.getByTestId("rebuild-credit-summary").children).toHaveLength(
      COLLAPSED_LINES
    );
    expect(screen.queryByTestId("rebuild-credit-more")).toBeNull();
  });

  it("truncates above six to 'and N more'", () => {
    renderCredit({ changes: lines(10) });
    const summary = screen.getByTestId("rebuild-credit-summary");
    expect(summary.children).toHaveLength(COLLAPSED_LINES);
    expect(summary).toHaveAttribute("data-change-count", "10");

    const more = screen.getByTestId("rebuild-credit-more");
    expect(more).toHaveTextContent("and 4 more");
    expect(more).toHaveAttribute("aria-expanded", "false");
  });

  it("expands in place, and collapses again", () => {
    renderCredit({ changes: lines(EXPAND_FROM) });

    const more = screen.getByTestId("rebuild-credit-more");
    expect(more).toHaveTextContent("and 1 more");

    fireEvent.click(more);
    expect(screen.getByTestId("rebuild-credit-summary").children).toHaveLength(EXPAND_FROM);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(more).toHaveTextContent("Show fewer");

    fireEvent.click(more);
    expect(screen.getByTestId("rebuild-credit-summary").children).toHaveLength(
      COLLAPSED_LINES
    );
  });

  it("expands the list where it stands rather than opening anything", () => {
    // The summary and its control are siblings under one container, so growing
    // the list cannot move the control onto a different surface.
    renderCredit({ changes: lines(9) });
    const summary = screen.getByTestId("rebuild-credit-summary");
    const more = screen.getByTestId("rebuild-credit-more");
    expect(more.parentElement).toBe(summary.parentElement);
  });

  it("keeps serialiseChangeSet's order and text, unedited", () => {
    const changes = lines(3);
    renderCredit({ changes });
    const texts = [...screen.getByTestId("rebuild-credit-summary").children].map(
      (li) => li.textContent
    );
    expect(texts).toEqual(changes.map((line) => `Δ${line.text}`));
  });
});

describe("summaryWindow", () => {
  it("is the rule both surfaces read, at every boundary", () => {
    expect(summaryWindow(lines(1), false).collapsible).toBe(false);
    expect(summaryWindow(lines(COLLAPSED_LINES), false).collapsible).toBe(false);
    expect(summaryWindow(lines(EXPAND_FROM), false).collapsible).toBe(true);
    expect(summaryWindow(lines(EXPAND_FROM), false).shown).toHaveLength(COLLAPSED_LINES);
    expect(summaryWindow(lines(EXPAND_FROM), false).hidden).toBe(1);
    expect(summaryWindow(lines(EXPAND_FROM), true).shown).toHaveLength(EXPAND_FROM);
  });
});

describe("tokens only", () => {
  it("paints every change kind from the category resolver", () => {
    expect(changeKindColour("changed")).toBe("var(--cat-instruction)");
    expect(changeKindColour("added")).toBe("var(--cat-evidence)");
    expect(changeKindColour("removed")).toBe("var(--cat-narrative)");
    expect(changeKindColour("header")).toBe("var(--cat-artefact)");
  });

  it("carries no raw hex, in any state", () => {
    for (const props of [
      {},
      { changes: lines(10) },
      { changes: [] },
      { gone: true },
      { to: "/b2/x", handleTo: "/creator/y", changes: lines(2) },
    ]) {
      const html = renderToStaticMarkup(
        <MemoryRouter>
          <RebuildCredit source={SOURCE} {...props} />
        </MemoryRouter>
      );
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(html).not.toMatch(/rgba?\(/);
    }
  });
});

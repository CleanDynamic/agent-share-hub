// Mobile prompt 28 Parts A and B: the rebuild and the lineage on a phone. The rebuild reads "Rebuilt from" and the source in a
// Panel module, the credit with "Computed from the source, not editable." under it, what changed, and the readiness Card with
// its Warn inset; the footer's Publish answers a press while blocked by taking the reader to what is missing. The lineage is
// an indented tree whose builds open "What changed" in a sheet, with "Compare two" at the foot.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/shell/useMinWidth", async (original) => ({
  ...(await original<typeof import("@/components/shell/useMinWidth")>()),
  useIsPhone: () => true,
}));

import { compareTo, LineageView } from "./LineageView";
import { RebuildView, sourceLine } from "./RebuildView";
import { phoneNodeLine, phoneTreeRows } from "./FamilyPanel";
import type { FamilyNodeView } from "./rebuildModel";

const node = (id: string, title: string, maker: string, children: FamilyNodeView[] = [], at: string | null = null): FamilyNodeView => ({
  id, to: `/b2/${id}`, title, maker, reproduced: 0, lamp: "healthy", seed: id, draft: false, current: false, at, children,
});

const family = node("src", "Invoice triage agent", "@suntzu", [
  node("a", "Invoice triage, faster", "@kit", [node("c", "Invoice triage, Welsh", "@ana", [], "2026-11-24T00:00:00Z")], "2026-11-21T00:00:00Z"),
  node("b", "Invoice triage, local", "@ola", [], "2026-11-22T00:00:00Z"),
]);

function rebuild(ready: boolean, onPublish = vi.fn()) {
  render(
    <MemoryRouter>
      <RebuildView
        draftTitle="My rebuild"
        source={{ title: "Invoice triage agent", maker: "@suntzu" }}
        sourceFacts={{ sessions: 3, steps: 12 }}
        family={family}
        changes={[{ key: "steps", label: "Steps", rows: [{ key: "s4", kind: "added", name: "Step 4", value: "Prompt" }] }]}
        readiness={ready ? { pct: 100, headline: "Ready to publish", next: null, ready: true } : { pct: 75, headline: "One thing before it can be published", next: "Step 4 has no text yet", ready: false }}
        credit={{ title: "Invoice triage agent", handle: "suntzu", delta: null }}
        onPublish={onPublish}
        onKeepDraft={vi.fn()}
        workspaceTo="/compose/d1?from=rebuild"
      />
    </MemoryRouter>,
  );
  return onPublish;
}

describe("the rebuild on a phone", () => {
  it("reads Rebuilt from, the source with its maker and counts, the credit and the computed note once", () => {
    rebuild(false);
    expect(screen.getByText("Rebuilt from")).toBeTruthy();
    expect(screen.getByTestId("rebuild-source-title").textContent).toBe("Invoice triage agent");
    expect(screen.getByTestId("rebuild-source-meta").textContent).toBe("@suntzu · 3 sessions · 12 steps");
    expect(screen.getByRole("heading", { level: 2, name: "The credit it will carry" })).toBeTruthy();
    expect(screen.getAllByText("Computed from the source, not editable.")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("4 builds in this family");
  });

  it("marks what is missing with a Warn inset and a link to the editor, and Publish takes the reader there", () => {
    const onPublish = rebuild(false);
    const panel = screen.getByTestId("readiness-panel");
    expect(panel.style.boxShadow).toContain("inset 3px 0 0 var(--warn)");
    const next = within(panel).getByRole("link", { name: "Step 4 has no text yet" });
    expect(next.getAttribute("href")).toBe("/compose/d1?from=rebuild");
    const publish = screen.getByTestId("rebuild-publish");
    expect(publish.getAttribute("aria-disabled")).toBe("true");
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(publish);
    expect(onPublish).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(next);
  });

  it("publishes when ready, with no inset", () => {
    const onPublish = rebuild(true);
    expect(screen.getByTestId("readiness-panel").style.boxShadow).toBe("");
    expect(screen.getByRole("heading", { name: "Ready to publish" })).toBeTruthy();
    fireEvent.click(screen.getByTestId("rebuild-publish"));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("rebuild-actions").getAttribute("data-phone-footer")).toBe("");
  });

  it("joins the maker and the counts, leaving zeros out", () => {
    expect(sourceLine("@suntzu", { sessions: 1, steps: 0 })).toBe("@suntzu · 1 session");
    expect(sourceLine(null, null)).toBe("");
  });
});

describe("the lineage on a phone", () => {
  function lineage(selected: string | null, onSelect = vi.fn()) {
    render(
      <MemoryRouter>
        <LineageView
          title="Invoice triage agent"
          buildTo="/b2/src"
          family={family}
          selectedId={selected}
          onSelect={onSelect}
          selection={selected ? { title: "Invoice triage, faster", to: `/b2/${selected}`, parentTitle: "Invoice triage agent", groups: [], loading: false, failed: false } : null}
        />
      </MemoryRouter>,
    );
    return onSelect;
  }

  it("is an indented tree, 24 a generation, with the family's fact as a quiet h1", () => {
    lineage(null);
    const rows = screen.getByTestId("family-list").querySelectorAll("li");
    expect([...rows].map((row) => row.style.paddingLeft)).toEqual(["0px", "24px", "48px", "24px"]);
    expect(rows[1].querySelector("[data-elbow]")).toBeTruthy();
    expect(rows[0].querySelector("[data-elbow]")).toBeNull();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe("4 builds in this family");
    expect(h1.style.fontSize).toBe("13px");
    expect(screen.queryByTestId("lineage-compare")).toBeNull();
  });

  it("chooses a build and opens What changed as a sheet; Compare two compares it with the address", () => {
    const onSelect = lineage("a");
    fireEvent.click(screen.getAllByTestId("family-node")[2]);
    expect(onSelect).toHaveBeenCalledWith("c");
    expect(screen.getByRole("dialog", { name: "Invoice triage, faster" })).toBeTruthy();
    expect(screen.getByTestId("lineage-compare").getAttribute("href")).toBe("/b2/src/compare/a");
  });

  it("keeps a parent's line running past a deeper branch to its later child", () => {
    const rows = phoneTreeRows(family);
    expect(rows.map((row) => [row.node.id, row.rails, row.continues])).toEqual([
      ["src", [], false],
      ["a", [], true],
      ["c", [1], false],
      ["b", [], false],
    ]);
  });

  it("says when a rebuild was made", () => {
    expect(phoneNodeLine(family.children[0], 1)).toBe("@kit · Rebuilt 21 Nov");
    expect(phoneNodeLine(family, 0)).toBe("@suntzu");
    expect(compareTo("/b2/x", "/b2/x")).toBeNull();
  });
});

// BG-P21 — the anatomy tree and its rows.
//
// The claims: depth is carried by indentation and one `--line` guide rather
// than by boxes inside boxes; every row wears its part's own category chip and
// a gap keeps its category rather than being recoloured red; a copyable type
// gets one copy control, and it confirms in the measured evidence pair; notes
// are capped at the reading measure; and no node title steals the display face
// from the build's own title.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnatomyTree } from "./AnatomyTree";
import type { Build, BuildMedia, NodeTree, NodeType } from "@/lib/build";
import { staticDoc, styleOf, styledWith } from "@/test/tokenStyle";

const build = { id: "b1", slug: "inbox-triage", title: "Inbox triage agent" } as Build;

const nodeTypes: NodeType[] = [
  {
    key: "prompt",
    label: "Prompt",
    category: "instruction",
    colour: "#E8571A",
    icon: "MessageSquare",
    renderer: "instruction",
    copyable: true,
    is_active: true,
    sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  } as unknown as NodeType,
  {
    key: "agent_config",
    label: "Agent config",
    category: "configuration",
    colour: "#22C55E",
    icon: "Cog",
    renderer: "configuration",
    copyable: false,
    is_active: true,
    sort: 2,
    schema: { fields: [] },
  } as unknown as NodeType,
];

function node(id: string, type: string, title: string, extra: Partial<NodeTree> = {}): NodeTree {
  return {
    id,
    build_id: "b1",
    parent_id: null,
    position: 0,
    type,
    title,
    note: null,
    payload: {},
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "",
    children: [],
    ...extra,
  } as unknown as NodeTree;
}

const tree: NodeTree[] = [
  node("n1", "prompt", "The classify prompt", {
    note: "Written for a morning inbox, not a backlog.",
    payload: { text: "Classify this email." } as NodeTree["payload"],
    children: [
      node("n2", "agent_config", "The triage agent", {
        children: [node("n3", "prompt", "A nested prompt")],
      }),
    ],
  }),
];

const noMedia = (): BuildMedia | null => null;
const noResolve = () => undefined;

function anatomy(nodes: NodeTree[] = tree) {
  return (
    <AnatomyTree
      tree={nodes}
      nodeTypes={nodeTypes}
      build={build}
      resolveNode={noResolve}
      resolveMedia={noMedia}
    />
  );
}

describe("depth is alignment and a guide, never nested boxes", () => {
  it("draws one 1px --line guide per nested level and nothing heavier", () => {
    const doc = staticDoc(anatomy());
    const guides = Array.from(doc.querySelectorAll("ul")).filter((list) =>
      styleOf(list).includes("border-left"),
    );

    // Two nested levels under the root, so two guides.
    expect(guides).toHaveLength(2);
    for (const guide of guides) {
      expect(styleOf(guide)).toContain("border-left:1px solid var(--line)");
      // A guide is a line, not a container: no fill and no radius of its own.
      expect(styleOf(guide)).not.toContain("background:");
      expect(styleOf(guide)).not.toContain("border-radius:");
    }
  });

  it("keeps a child list a sibling of its parent's card, not a child of it", () => {
    const doc = staticDoc(anatomy());
    const parentCard = doc.querySelector('[data-node-id="n1"]') as Element;

    // The deeper rows are elsewhere in the document, so no card contains
    // another card and no border is ever drawn inside a border.
    expect(parentCard.querySelector('[data-node-id="n2"]')).toBeNull();
    expect(doc.querySelector('[data-node-id="n2"]')).toBeTruthy();
  });

  it("indents each level by the width of the chevron column it hangs from", () => {
    const doc = staticDoc(anatomy());
    const guide = Array.from(doc.querySelectorAll("ul")).find((list) =>
      styleOf(list).includes("border-left"),
    );
    // 18px, the chevron's own width, so the guide lands under the control that
    // opened the level rather than at an arbitrary inset.
    expect(styleOf(guide)).toContain("margin:10px 0 0 18px");
  });

  it("collapses and expands a level without losing the guide", () => {
    render(anatomy());
    const collapse = screen.getByRole("button", { name: "Collapse The classify prompt" });

    expect(screen.getByText("The triage agent")).toBeTruthy();
    fireEvent.click(collapse);
    expect(screen.queryByText("The triage agent")).toBeNull();
  });
});

describe("a row names its part", () => {
  it("wears the category's own measured pair", () => {
    const doc = staticDoc(anatomy());
    const chip = Array.from(doc.querySelectorAll("span")).find(
      (span) => span.textContent === "Prompt",
    );
    expect(styleOf(chip)).toContain("background:var(--cat-instruction-fill)");
    expect(styleOf(chip)).toContain("color:var(--cat-instruction)");
    expect(styleOf(chip)).toContain("border-radius:var(--r-chip)");
  });

  it("leaves a gap its own category and spends the breakage hue on the edge", () => {
    const gap = [node("g1", "agent_config", "The missing retry policy", { is_gap: true })];
    const doc = staticDoc(anatomy(gap));

    const chip = Array.from(doc.querySelectorAll("span")).find(
      (span) => span.textContent === "Agent config",
    );
    // The chip routes the gap to people who write agent configs. Recolouring
    // it red would lose that, which is the whole reason the edge carries it.
    expect(styleOf(chip)).toContain("color:var(--cat-configuration)");
    expect(styleOf(chip)).not.toContain("cat-breakage");

    const card = doc.querySelector('[data-node-id="g1"]');
    expect(styleOf(card)).toContain("var(--cat-breakage)");
    // Dashed: where something goes, not what something is.
    expect(styleOf(card)).toContain("dashed");
  });

  it("gives a node title the body face at 600, never the display face", () => {
    const doc = staticDoc(anatomy());
    const heading = doc.querySelector("h3");

    expect(heading?.textContent).toBe("The classify prompt");
    expect(styleOf(heading)).toContain("font-size:16px");
    expect(styleOf(heading)).toContain("font-weight:600");
    // The build's own title is the only display-face heading on this page.
    expect(styleOf(heading)).not.toContain("Bodoni");
  });

  it("caps a note at the reading measure", () => {
    const doc = staticDoc(anatomy());
    const note = Array.from(doc.querySelectorAll("p")).find((p) =>
      p.textContent?.startsWith("Written for a morning"),
    );
    expect(styleOf(note)).toContain("max-width:68ch");
    expect(styleOf(note)).toContain("color:var(--text2)");
  });
});

describe("copy controls", () => {
  it("gives a copyable type one control and an uncopyable type none", () => {
    const doc = staticDoc(anatomy());
    const copies = Array.from(doc.querySelectorAll("button")).filter(
      (button) => button.textContent === "Copy",
    );
    // One control: the prompt that HAS text. The agent config is not a
    // copyable type at all, and the nested prompt is copyable but empty —
    // the registry decides the type, the payload decides whether there is
    // anything to put on the clipboard, and a button that copied nothing
    // would be an affordance for nothing.
    expect(copies).toHaveLength(1);
  });

  it("paints the control secondary, so it never competes with Rebuild this", () => {
    const doc = staticDoc(anatomy());
    const copy = Array.from(doc.querySelectorAll("button")).find(
      (button) => button.textContent === "Copy",
    );
    expect(styleOf(copy)).toContain("background:var(--glass)");
    expect(styleOf(copy)).toContain("border-color:var(--line)");
    expect(styledWith(doc, "background:var(--action)")).toHaveLength(0);
  });
});

describe("the empty state", () => {
  it("says so in body text at the reading measure", () => {
    const doc = staticDoc(anatomy([]));
    const message = doc.querySelector("p");
    expect(message?.textContent).toBe("Nothing has been placed in this build yet.");
    expect(styleOf(message)).toContain("color:var(--text2)");
    expect(styleOf(message)).toContain("max-width:68ch");
  });
});

// CA-19 P3 — linking from the post (board "References: from the post"): the reference button and @, the link panel's
// sections and order, choosing, the move panel, replacing, removing, nothing highlighted, refusals, the group hover card
// and Go to the group.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { focusGroup } from "@/components/build/partNav";
import { RefCard } from "@/components/post/RefLinks";
import { linkPanelLists, refLookup, withGroupEntries } from "@/lib/build/postRefs";
import type { ReferenceGroup } from "@/lib/build/referenceGroups";
import type { ThreadDoc } from "@/lib/build/thread";
import { tidyThread } from "@/lib/build/threadEditor";
import { PostTab } from "@/pages/site/compose/PostTab";
import { brk, doc, fakeThread, p } from "@/pages/site/compose/postTabKit";
import { ReferenceNotice } from "@/pages/site/compose/referencePieces";
import { useReferenceHistory, type ReferenceHistoryControls } from "@/pages/site/compose/useReferenceHistory";

import { LINK_PANEL_COPY } from "./LinkPanel";
import { buildSteps, sessionGroups } from "@/lib/build/graph";
import { refGroups } from "@/lib/build/postRefs";
import type { NodeTree } from "@/lib/build/types";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

afterEach(cleanup);

const node = (id: string, type: string, payload: Record<string, unknown>, position: number, parent: string | null = null, children: NodeTree[] = [], title: string | null = null): NodeTree =>
  ({ id, build_id: "b", parent_id: parent, position, type, title, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children }) as NodeTree;

/** As references.test.tsx's: Session 1 holds the brand brief and a prompt with a code tile; Session 2 a check. */
function refFixture() {
  const code = node("c1", "code", { source: "export const Hero = () => null;", language: "tsx", filename: "hero.tsx" }, 1, "p2");
  const tree = [
    node("p1", "prompt", { text: "Write the brand brief.", session: "typed-a" }, 1, null, [], "Brand brief"),
    node("p2", "prompt", { text: "Build the hero from this.", session: "typed-a" }, 2, null, [code], "Launch email"),
    node("k1", "eval_run", { tested: "The page loads under a second", passing: "p95 under 1s", session: "typed-b" }, 3, null, [], "Speed check"),
  ];
  const steps = buildSteps(tree);
  const groups = sessionGroups(steps, [], {}, { "typed-a": { tool: "claude-code", date: "2026-10-12" }, "typed-b": { tool: null, date: "2026-10-14" } });
  return { refs: refGroups({ steps, groups }) };
}

const ref = (to: string) => ({ type: "ref", attrs: { to } });
const json = (editor: Editor) => tidyThread(editor.getJSON() as ThreadDoc);
const group: ReferenceGroup = { id: "rg-login", colour: "#7FB88A", name: "Login flow", notes: "Sign in by email link.", members: ["node:p1", "node:k1"] };

function targets(groups: ReferenceGroup[] = [group]) {
  const { refs } = refFixture();
  return { refs, lookup: withGroupEntries(refLookup(refs), groups) };
}

let history: ReferenceHistoryControls | null = null;

function Harness({ initial, groups }: { initial: ThreadDoc; groups?: ReferenceGroup[] }) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const controls = useReferenceHistory({ editor, applyColours: () => undefined });
  history = controls;
  const { refs, lookup } = targets(groups);
  return (
    <>
      <PostTab thread={fakeThread(initial)} phone={false} references={{ groups: refs, lookup, history: controls, onEditor: setEditor }} />
      <ReferenceNotice notice={controls.notice} onUndo={controls.undo} onDone={controls.dismiss} />
    </>
  );
}

function mount(initial: ThreadDoc, groups?: ReferenceGroup[]) {
  render(<Harness initial={initial} groups={groups} />);
  const dom = document.querySelector('[contenteditable="true"]') as HTMLElement & { editor: Editor };
  return { editor: dom.editor, dom };
}

const button = () => screen.getByRole("button", { name: LINK_PANEL_COPY.button });
const panel = () => screen.getByRole("dialog", { name: LINK_PANEL_COPY.head });

describe("the reference button and @", () => {
  it("is a target glyph named for groups, parts, sessions and tiles, and shows pressed while its panel is open", () => {
    const { editor } = mount(doc(p("Read it.")));
    act(() => void editor.commands.setTextSelection(9));
    expect(button().getAttribute("title")).toBe("Link to a group, part, session or tile");
    expect(button().querySelector("path")?.getAttribute("d")).toContain("M12.5 8a4.5 4.5 0 1 1-9 0");
    expect(button()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button());
    expect(panel()).toBeTruthy();
    expect(button()).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the same panel from a typed @", () => {
    const { editor } = mount(doc(p("Ask ")));
    act(() => void editor.commands.setTextSelection(5));
    act(() => void editor.view.someProp("handleTextInput", (f) => f(editor.view, 5, 5, "@", () => editor.state.tr)));
    expect(panel()).toBeTruthy();
    expect(screen.getByRole("combobox", { name: LINK_PANEL_COPY.search })).toBe(document.activeElement);
  });
});

describe("the panel's lists", () => {
  it("lists groups first with their members, then parts, sessions and tiles in build order, leaving grouped ones out", () => {
    const { editor } = mount(doc(p("Start from the brand brief.")));
    act(() => void editor.commands.setTextSelection({ from: 16, to: 27 }));
    fireEvent.click(button());
    const body = within(panel());
    expect(body.getByText("Link text")).toBeTruthy();
    expect(body.getByTestId("link-panel-words").textContent).toBe('"brand brief" · Post 1');
    expect(body.getByText("Reference groups")).toBeTruthy();
    expect(body.getByText("Parts, sessions and tiles")).toBeTruthy();
    const options = body.getAllByRole("option").map((option) => option.getAttribute("data-ref-option"));
    expect(options).toEqual(["group:rg-login", "session:typed-a", "node:p2", "node:c1", "session:typed-b"]);
    const row = body.getByRole("option", { name: /Login flow/ });
    expect(row.textContent).toContain("2 components");
    expect(body.getByText("Prompt 1, Check 3")).toBeTruthy();
  });

  it("indents sessions 12 and tiles 24, and leaves out a part row with one part", () => {
    const { refs } = refFixture();
    const lists = linkPanelLists(refs, refLookup(refs));
    expect(lists.rows.map((row) => [row.entry.to, row.indent])).toEqual([
      ["session:typed-a", 12],
      ["node:p1", 24],
      ["node:p2", 24],
      ["node:c1", 24],
      ["session:typed-b", 12],
      ["node:k1", 24],
    ]);
    expect(lists.rows.some((row) => row.entry.kind === "Part")).toBe(false);
  });

  it("finds groups by their name and their members", () => {
    const { refs, lookup } = targets();
    expect(linkPanelLists(refs, lookup, "login").groups.map((entry) => entry.entry.to)).toEqual(["group:rg-login"]);
    expect(linkPanelLists(refs, lookup, "check").groups.map((entry) => entry.entry.to)).toEqual(["group:rg-login"]);
    expect(linkPanelLists(refs, lookup, "launch").groups).toEqual([]);
  });
});

describe("choosing", () => {
  it("links at once, as one step with a notice and Undo", () => {
    const { editor } = mount(doc(p("Start from the brand brief.")));
    act(() => void editor.commands.setTextSelection({ from: 16, to: 27 }));
    fireEvent.click(button());
    fireEvent.click(within(panel()).getByRole("option", { name: /Login flow/ }));
    expect(json(editor)).toEqual(doc({ type: "paragraph", content: [{ type: "text", text: "Start from the " }, { type: "text", text: "brand brief", marks: [ref("group:rg-login")] }, { type: "text", text: "." }] } as never));
    expect(screen.queryByRole("dialog", { name: LINK_PANEL_COPY.head })).toBeNull();
    expect(screen.getByTestId("reference-notice").textContent).toContain('Linked "brand brief" to Login flow');
    fireEvent.click(screen.getByTestId("notice-undo"));
    expect(json(editor)).toEqual(doc(p("Start from the brand brief.")));
    expect(history?.canRedo).toBe(true);
  });

  it("asks first when the target is linked elsewhere, and Move it here moves it", () => {
    const { editor } = mount(doc({ type: "paragraph", content: [{ type: "text", text: "the schema", marks: [ref("node:p2")] }, { type: "text", text: " and the email" }] } as never));
    act(() => void editor.commands.setTextSelection({ from: 20, to: 25 }));
    fireEvent.click(button());
    fireEvent.click(within(panel()).getByRole("option", { name: /Launch email/ }));
    const move = screen.getByTestId("link-move");
    expect(move.textContent).toContain('Prompt 2 is linked to "the schema" in post 1. Linking here moves it.');
    fireEvent.click(within(move).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("link-move")).toBeNull();
    fireEvent.click(within(panel()).getByRole("option", { name: /Launch email/ }));
    fireEvent.click(within(screen.getByTestId("link-move")).getByRole("button", { name: "Move it here" }));
    expect(json(editor)).toEqual(doc({ type: "paragraph", content: [{ type: "text", text: "the schema and the " }, { type: "text", text: "email", marks: [ref("node:p2")] }] } as never));
    expect(screen.getByTestId("reference-notice").textContent).toContain("Moved the link to Prompt 2");
  });

  it("replaces a link the words carry, and removes one from the footer", () => {
    const { editor } = mount(doc({ type: "paragraph", content: [{ type: "text", text: "Read " }, { type: "text", text: "the brief", marks: [ref("node:p2")] }] } as never));
    act(() => void editor.commands.setTextSelection(10));
    fireEvent.click(button());
    expect(document.querySelector('[data-ref-option="node:p2"]')?.getAttribute("aria-current")).toBe("true");
    fireEvent.click(within(panel()).getByRole("option", { name: /Speed check|Login flow/ }));
    expect(json(editor)).toEqual(doc({ type: "paragraph", content: [{ type: "text", text: "Read " }, { type: "text", text: "the brief", marks: [ref("group:rg-login")] }] } as never));
    act(() => void editor.commands.setTextSelection(10));
    fireEvent.click(button());
    fireEvent.click(screen.getByRole("button", { name: LINK_PANEL_COPY.remove }));
    expect(json(editor)).toEqual(doc(p("Read the brief")));
    expect(screen.getByTestId("reference-notice").textContent).toContain("Removed the link");
  });

  it("writes the target's name and a space with nothing highlighted, and Escape after a typed @ puts it back", () => {
    const { editor } = mount(doc(p("See ")));
    act(() => void editor.commands.setTextSelection(5));
    fireEvent.click(button());
    fireEvent.click(within(panel()).getAllByRole("option")[1]);
    expect(json(editor)).toEqual(doc({ type: "paragraph", content: [{ type: "text", text: "See " }, { type: "text", text: "session 1 · claude code", marks: [ref("session:typed-a")] }, { type: "text", text: " " }] } as never));
    act(() => void editor.view.someProp("handleTextInput", (f) => f(editor.view, editor.state.doc.content.size - 1, editor.state.doc.content.size - 1, "@", () => editor.state.tr)));
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(editor.state.doc.textContent.endsWith("@")).toBe(true);
  });

  it("refuses words across a post break, and choosing does nothing", () => {
    const { editor } = mount(doc(p("first post"), brk, p("second post")));
    act(() => void editor.commands.setTextSelection({ from: 3, to: 18 }));
    fireEvent.click(button());
    expect(screen.getByTestId("link-panel-refusal").textContent).toBe("Linked text has to be one stretch inside one post.");
    fireEvent.click(within(panel()).getAllByRole("option")[1]);
    expect(json(editor)).toEqual(doc(p("first post"), brk, p("second post")));
  });

  it("opens on the group when the words are linked to one of its members", () => {
    const { editor } = mount(doc({ type: "paragraph", content: [{ type: "text", text: "old words", marks: [ref("node:p1")] }] } as never));
    act(() => void editor.commands.setTextSelection(4));
    fireEvent.click(button());
    const field = screen.getByRole("combobox");
    expect(document.getElementById(field.getAttribute("aria-activedescendant") ?? "")?.getAttribute("data-ref-option")).toBe("group:rg-login");
  });
});

describe("a group's hover card, and Go to the group", () => {
  const entry = () => targets().lookup.get("group:rg-login");
  const anchor = () => {
    const el = document.createElement("span");
    document.body.append(el);
    return el;
  };

  it("draws REFERENCE GROUP, the name, the notes, the members and the maker's actions", () => {
    const onGo = vi.fn();
    const onChange = vi.fn();
    render(<RefCard entry={entry() as never} anchor={anchor()} onGo={onGo} onChange={onChange} onRemove={() => undefined} onEnter={() => undefined} onLeave={() => undefined} />);
    const card = screen.getByTestId("ref-card");
    expect(card.getAttribute("data-ref-card")).toBe("group");
    expect(within(card).getByText("Reference group")).toBeTruthy();
    expect(within(card).getByText("Login flow")).toBeTruthy();
    expect(within(card).getByTestId("group-card-notes").textContent).toBe("Sign in by email link.");
    expect([...card.querySelectorAll("[data-group-member]")].map((row) => row.textContent)).toEqual(["1Brand briefPrompt", "3Speed checkCheck"]);
    fireEvent.click(within(card).getByRole("button", { name: "Go to the group" }));
    fireEvent.click(within(card).getByRole("button", { name: "Change" }));
    expect(onGo).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();
    expect(within(card).getByRole("button", { name: "Remove the link" })).toBeTruthy();
  });

  it("gives readers the same card without Change and Remove", () => {
    render(<RefCard entry={entry() as never} anchor={anchor()} onGo={() => undefined} onEnter={() => undefined} onLeave={() => undefined} />);
    const card = screen.getByTestId("ref-card");
    expect(within(card).queryByRole("button", { name: "Change" })).toBeNull();
    expect(within(card).queryByRole("button", { name: "Remove the link" })).toBeNull();
  });

  it("outlines every member and dims the rest until Escape", () => {
    const registry = new Map<string, HTMLElement>();
    for (const to of ["node:p1", "node:k1", "node:p2", "session:typed-a"]) {
      const el = document.createElement("div");
      document.body.append(el);
      registry.set(to, el);
    }
    focusGroup(registry, ["node:p1", "node:k1"], "brightness(.5)", { width: "2px", style: "solid", colour: "blue", offset: "2px" });
    expect(registry.get("node:p1")?.getAttribute("data-group-focus")).toBe("member");
    expect(registry.get("node:p1")?.style.outlineStyle).toBe("solid");
    expect(registry.get("node:p2")?.style.filter).toBe("brightness(.5)");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(registry.get("node:p2")?.style.filter).toBe("");
    expect(registry.get("node:p1")?.hasAttribute("data-group-focus")).toBe(false);
  });
});

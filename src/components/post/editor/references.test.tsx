// CA-06 P2 — highlight, then @: the picker's groups, search and keys, and what a choice does to the post. CA-19 P3 drew the
// picker again as the link panel, with the same keys; these hold it to them.

import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSteps, sessionGroups } from "@/lib/build/graph";
import { filterRefGroups, refGroups, refMatches } from "@/lib/build/postRefs";
import type { ThreadDoc } from "@/lib/build/thread";
import { tidyThread } from "@/lib/build/threadEditor";
import type { NodeTree } from "@/lib/build/types";
import { doc, mountPostTab, p } from "@/pages/site/compose/postTabKit";

import { LINK_PANEL_COPY as REFERENCE_COPY } from "./LinkPanel";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

afterEach(cleanup);

const node = (id: string, type: string, payload: Record<string, unknown>, position: number, parent: string | null = null, children: NodeTree[] = [], title: string | null = null): NodeTree =>
  ({ id, build_id: "b", parent_id: parent, position, type, title, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children }) as NodeTree;

/** Session 1 (Claude Code): the brand brief, then a prompt holding a code tile. Session 2: a check. */
export function refTree(): NodeTree[] {
  const code = node("c1", "code", { source: "export const Hero = () => null;", language: "tsx", filename: "hero.tsx" }, 1, "p2");
  return [
    node("p1", "prompt", { text: "Write the brand brief.\nKeep it to a page.\nName the voice.\nOne more line.", session: "typed-a" }, 1, null, [], "Brand brief"),
    node("p2", "prompt", { text: "Build the hero from this.", session: "typed-a" }, 2, null, [code], "Launch email"),
    node("k1", "eval_run", { tested: "The page loads under a second", passing: "p95 under 1s" }, 3, null, [], "Speed check"),
  ].map((entry, at) => (at === 2 ? { ...entry, payload: { ...(entry.payload as object), session: "typed-b" } } : entry)) as NodeTree[];
}

export function refFixture() {
  const steps = buildSteps(refTree());
  const groups = sessionGroups(steps, [], {}, { "typed-a": { tool: "claude-code", date: "2026-10-12" }, "typed-b": { tool: null, date: "2026-10-14" } });
  return { steps, groups, refs: refGroups({ steps, groups }) };
}

const json = (editor: Editor) => tidyThread(editor.getJSON() as ThreadDoc);
const ref = (to: string) => ({ type: "ref", attrs: { to } });

function mount(start: ThreadDoc) {
  const { refs } = refFixture();
  return mountPostTab(start, {}, { references: { groups: refs } });
}

const options = () => screen.getAllByRole("option").map((option) => option.textContent);

describe("the picker's list", () => {
  it("groups the build by session: the session's own row, then its tiles, nested ones under their parent", () => {
    const { refs } = refFixture();
    expect(refs.map((group) => group.label)).toEqual(["Session 1 · Claude Code", "Session 2"]);
    expect(refs[0].entries.map((entry) => [entry.number, entry.title, entry.kind, entry.depth])).toEqual([
      ["S1", "The whole session", "Session", 0],
      ["1", "Brand brief", "Prompt", 0],
      ["2", "Launch email", "Prompt", 0],
      ["2", "hero.tsx", "Code", 1],
    ]);
    expect(refs[1].entries.map((entry) => [entry.to, entry.kind])).toEqual([
      ["session:typed-b", "Session"],
      ["node:k1", "Check"],
    ]);
    expect(refs[0].entries[0].name).toBe("session 1 · claude code");
    expect(refs[0].entries[1].name).toBe("brand brief");
  });

  it("matches the start of words in the title, the kind or the number", () => {
    const entry = { title: "Brand brief", kind: "Prompt", number: "1" };
    expect(refMatches(entry, "bri")).toBe(true);
    expect(refMatches(entry, "brand b")).toBe(true);
    expect(refMatches(entry, "prom")).toBe(true);
    expect(refMatches(entry, "1")).toBe(true);
    expect(refMatches(entry, "rand")).toBe(false);
    expect(refMatches({ title: "The whole session", kind: "Session", number: "S2" }, "s2")).toBe(true);
    const { refs } = refFixture();
    expect(filterRefGroups(refs, "check").flatMap((group) => group.entries.map((one) => one.to))).toEqual(["node:k1"]);
  });

  it("opens from @, moves with the arrow keys, chooses with Enter, and says when nothing matches", () => {
    const { editor } = mount(doc(p("Read it.")));
    act(() => {
      editor.commands.setTextSelection(9);
    });
    fireEvent.click(screen.getByRole("button", { name: REFERENCE_COPY.button }));
    const field = screen.getByRole("combobox", { name: REFERENCE_COPY.search });
    expect(document.activeElement).toBe(field);
    expect(options()).toEqual(["S1The whole sessionSession", "1Brand briefPrompt", "2Launch emailPrompt", "2hero.tsxCode", "S2The whole sessionSession", "3Speed checkCheck"]);
    expect(field.getAttribute("aria-activedescendant")).toMatch(/-0$/);
    fireEvent.keyDown(field, { key: "ArrowDown" });
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(field.getAttribute("aria-activedescendant")).toMatch(/-2$/);
    fireEvent.keyDown(field, { key: "ArrowUp" });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(json(editor)).toEqual(doc({ type: "paragraph", content: [{ type: "text", text: "Read it." }, { type: "text", text: "brand brief", marks: [ref("node:p1")] }, { type: "text", text: " " }] } as never));
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("filters as it is typed, and says when nothing has that name", () => {
    mount(doc(p("")));
    fireEvent.click(screen.getByRole("button", { name: REFERENCE_COPY.button }));
    const field = screen.getByRole("combobox");
    fireEvent.change(field, { target: { value: "launch" } });
    expect(options()).toEqual(["2Launch emailPrompt"]);
    fireEvent.change(field, { target: { value: "zebra" } });
    expect(screen.getByText(REFERENCE_COPY.none)).toBeTruthy();
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("what a choice does", () => {
  it("links exactly the highlighted words, which do not change", () => {
    const { editor } = mount(doc(p("Start from the brand brief, then build.")));
    act(() => {
      editor.commands.setTextSelection({ from: 16, to: 27 });
    });
    fireEvent.click(screen.getByRole("button", { name: REFERENCE_COPY.button }));
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Brand brief"));
    expect(json(editor)).toEqual(
      doc({ type: "paragraph", content: [{ type: "text", text: "Start from the " }, { type: "text", text: "brand brief", marks: [ref("node:p1")] }, { type: "text", text: ", then build." }] } as never),
    );
  });

  it("with nothing highlighted, puts the part's name in as linked words and a space", () => {
    const { editor } = mount(doc(p("See ")));
    act(() => {
      editor.commands.setTextSelection(5);
    });
    fireEvent.click(screen.getByRole("button", { name: REFERENCE_COPY.button }));
    fireEvent.click(within(screen.getByRole("listbox")).getAllByText("The whole session")[0]);
    expect(json(editor)).toEqual(doc({ type: "paragraph", content: [{ type: "text", text: "See " }, { type: "text", text: "session 1 · claude code", marks: [ref("session:typed-a")] }, { type: "text", text: " " }] } as never));
  });

  it("opens on a typed @ in place of the @, and Escape puts the @ back", async () => {
    const { editor, dom } = mount(doc(p("Ask ")));
    act(() => {
      editor.commands.setTextSelection(5);
    });
    let handled = false;
    act(() => {
      handled = Boolean(editor.view.someProp("handleTextInput", (f) => f(editor.view, 5, 5, "@", () => editor.state.tr)));
    });
    expect(handled).toBe(true);
    expect(json(editor)).toEqual(doc(p("Ask ")));
    const field = screen.getByRole("combobox");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(json(editor)).toEqual(doc(p("Ask @")));
    await waitFor(() => expect(document.activeElement).toBe(dom));
  });

  it("leaves an @ inside a word as an @", () => {
    const { editor } = mount(doc(p("me")));
    let handled = true;
    act(() => {
      handled = Boolean(editor.view.someProp("handleTextInput", (f) => f(editor.view, 3, 3, "@", () => editor.state.tr)));
    });
    expect(handled).toBe(false);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("opens a link's highlight with its part chosen; another changes it, and Remove the link keeps the words", () => {
    const { editor } = mount(doc({ type: "paragraph", content: [{ type: "text", text: "Read " }, { type: "text", text: "the brief", marks: [ref("node:p1")] }] } as never));
    act(() => {
      editor.commands.setTextSelection({ from: 6, to: 15 });
    });
    fireEvent.click(screen.getByRole("button", { name: REFERENCE_COPY.button }));
    const chosen = document.querySelector('[data-ref-option="node:p1"]') as HTMLElement;
    expect(chosen.getAttribute("aria-current")).toBe("true");
    const field = screen.getByRole("combobox");
    expect(field.getAttribute("aria-activedescendant")).toBe(chosen.id);
    fireEvent.click(within(screen.getByRole("listbox")).getByText("Speed check"));
    expect(json(editor)).toEqual(doc({ type: "paragraph", content: [{ type: "text", text: "Read " }, { type: "text", text: "the brief", marks: [ref("node:k1")] }] } as never));

    act(() => {
      editor.commands.setTextSelection(10);
    });
    fireEvent.click(screen.getByRole("button", { name: REFERENCE_COPY.button }));
    // CA-19 P3: Remove the link is in the panel's footer.
    fireEvent.click(screen.getByRole("button", { name: REFERENCE_COPY.remove }));
    expect(json(editor)).toEqual(doc(p("Read the brief")));
  });
});

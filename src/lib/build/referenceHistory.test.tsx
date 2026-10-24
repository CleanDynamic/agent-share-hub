// CA-19 P2: one undo history for every colour and link action.

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import type { Editor as ReactEditor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { postExtensions } from "@/components/post/editor/extensions";
import { createPictureHost } from "@/components/post/editor/pictures";
import { ReferenceNotice, UndoRedo } from "@/pages/site/compose/referencePieces";
import { useHistoryKeys, useReferenceHistory } from "@/pages/site/compose/useReferenceHistory";

import { insertLinked, linkRanges, linkWords, removeExtraLinks, unlinkTarget } from "./linkRules";
import { addToGroup, clearAll, colourModelOf, deleteGroup, mergeGroups, setSingleColour, type ColourWrites } from "./referenceGroups";
import { EMPTY_HISTORY, HISTORY_LIMIT, mapHistory, NOTICE_COPY, NOTICE_MS, record, takeRedo, takeUndo, afterUndo, canRedo, canUndo } from "./referenceHistory";

const editors: Editor[] = [];
afterEach(() => {
  cleanup();
  while (editors.length) editors.pop()?.destroy();
  vi.useRealTimers();
});

const ref = (to: string) => ({ type: "ref", attrs: { to } });
const text = (value: string, to?: string) => ({ type: "text", text: value, ...(to ? { marks: [ref(to)] } : null) });
const p = (...content: object[]) => ({ type: "paragraph", content });

function editorOf(...content: object[]): Editor {
  const editor = new Editor({
    extensions: postExtensions(false, { slashKey: { current: null }, openLink: { current: null }, pictures: createPictureHost() }),
    content: { type: "doc", content },
  });
  editors.push(editor);
  return editor;
}

const links = (editor: Editor) => linkRanges(editor.state.doc).map((range) => [range.text, range.to]);
const find = (editor: Editor, words: string) => 1 + editor.state.doc.textContent.indexOf(words);

function mount(editor: Editor | null, applied: ColourWrites[] = []) {
  return renderHook(() => useReferenceHistory({ editor: editor as unknown as ReactEditor, applyColours: (writes) => applied.push(writes) }));
}

describe("the history itself", () => {
  it("keeps at most 50 steps, newest last, and a new step clears redo", () => {
    let history = EMPTY_HISTORY;
    for (let n = 0; n < HISTORY_LIMIT + 5; n += 1) history = record(history, { sentence: `step ${n}` });
    expect(history.done).toHaveLength(50);
    expect(history.done[0].sentence).toBe("step 5");
    const taken = takeUndo(history);
    history = afterUndo(taken?.history ?? history, { sentence: "inverse" });
    expect(canRedo(history)).toBe(true);
    expect(takeRedo(history)?.step.sentence).toBe("inverse");
    expect(canRedo(record(history, { sentence: "new" }))).toBe(false);
    expect(canUndo(EMPTY_HISTORY)).toBe(false);
  });

  it("moves the steps' positions as the post is edited", () => {
    const history = record(EMPTY_HISTORY, { sentence: "x", refs: [{ kind: "runs", from: 10, to: 14, before: [], after: [{ from: 10, to: 14, target: "node:a" }] }] });
    const moved = mapHistory(history, (pos) => (pos >= 5 ? pos + 3 : pos));
    expect(moved.done[0].refs).toEqual([{ kind: "runs", from: 13, to: 17, before: [], after: [{ from: 13, to: 17, target: "node:a" }] }]);
  });

  it("says each step in the board's words", () => {
    expect(NOTICE_COPY.linked("the data model", "Data model")).toBe('Linked "the data model" to Data model');
    expect(NOTICE_COPY.moved("Session 3")).toBe("Moved the link to Session 3");
    expect(NOTICE_COPY.removed).toBe("Removed the link");
    expect(NOTICE_COPY.added("Code 4", "Login flow")).toBe("Added Code 4 to Login flow");
    expect(NOTICE_COPY.removedFrom("Code 4", "Login flow")).toBe("Removed Code 4 from Login flow");
    expect(NOTICE_COPY.deleted("Login flow")).toBe("Deleted Login flow");
    expect(NOTICE_COPY.merged("No name", "Login flow")).toBe("Merged No name into Login flow");
    expect(NOTICE_COPY.cleared(4, 5)).toBe("Cleared 4 links and 5 colours");
    expect(NOTICE_COPY.cleared(1, 1)).toBe("Cleared 1 link and 1 colour");
    expect(NOTICE_COPY.pointsAt("Login flow")).toBe("The link now points at Login flow");
  });
});

describe("undo and redo of every kind of step", () => {
  it("links, then undoes and redoes it", () => {
    const editor = editorOf(p(text("We drew the data model first.")));
    const { result } = mount(editor);
    act(() => {
      result.current.step(NOTICE_COPY.linked("the data model", "Data model"), {
        edit: (tr) => {
          const from = find(editor, "the data model");
          return linkWords(tr, from, from + 14, "node:dm").ok ? undefined : false;
        },
      });
    });
    expect(links(editor)).toEqual([["the data model", "node:dm"]]);
    expect(result.current.notice?.sentence).toBe('Linked "the data model" to Data model');
    act(() => result.current.undo());
    expect(links(editor)).toEqual([]);
    act(() => result.current.redo());
    expect(links(editor)).toEqual([["the data model", "node:dm"]]);
  });

  it("moves a link and replaces one, and puts both back", () => {
    const editor = editorOf(p(text("the schema", "node:dm"), text(" and the page", "node:lp")));
    const { result } = mount(editor);
    act(() => {
      result.current.step(NOTICE_COPY.moved("Data model"), {
        edit: (tr) => {
          const from = find(editor, "the page");
          linkWords(tr, from, from + 8, "node:dm");
        },
      });
    });
    // The words were part of the page's link, so that whole link goes and the data model's moves here.
    expect(links(editor)).toEqual([["the page", "node:dm"]]);
    act(() => result.current.undo());
    expect(links(editor)).toEqual([["the schema", "node:dm"], [" and the page", "node:lp"]]);
    act(() => result.current.redo());
    expect(links(editor)).toEqual([["the page", "node:dm"]]);
  });

  it("unlinks, and undoes it", () => {
    const editor = editorOf(p(text("alpha", "node:a")));
    const { result } = mount(editor);
    act(() => void result.current.step(NOTICE_COPY.removed, { edit: (tr) => void unlinkTarget(tr, "node:a") }));
    expect(links(editor)).toEqual([]);
    act(() => result.current.undo());
    expect(links(editor)).toEqual([["alpha", "node:a"]]);
  });

  it("writes a name in with nothing highlighted, and takes it out again", () => {
    const editor = editorOf(p(text("See ")));
    const { result } = mount(editor);
    act(() => {
      result.current.step(NOTICE_COPY.linked("data model", "Data model"), {
        edit: (tr) => {
          const done = insertLinked(tr, 5, "data model", "node:dm");
          return { inserted: { at: done.from, size: done.to - done.from + 1 } };
        },
      });
    });
    expect(editor.state.doc.textContent).toBe("See data model ");
    act(() => result.current.undo());
    expect(editor.state.doc.textContent).toBe("See ");
    act(() => result.current.redo());
    expect(editor.state.doc.textContent).toBe("See data model ");
    expect(links(editor)).toEqual([["data model", "node:dm"]]);
  });

  it("removes extra links in one step, and undoes it", () => {
    const editor = editorOf(p(text("one", "node:p1"), text(" and "), text("two", "node:p1")));
    const { result } = mount(editor);
    act(() => void result.current.step(NOTICE_COPY.removedExtra(1), { edit: (tr) => void removeExtraLinks(tr) }));
    expect(links(editor)).toEqual([["one", "node:p1"]]);
    act(() => result.current.undo());
    expect(links(editor)).toEqual([["one", "node:p1"], ["two", "node:p1"]]);
  });

  it("sets a colour and puts it back through the writers", () => {
    const applied: ColourWrites[] = [];
    const { result } = mount(null, applied);
    const model = colourModelOf({}, [{ id: "dm", colour: "#7FA7D9" }]);
    act(() => void result.current.step(NOTICE_COPY.coloured("Data model", "#7FB88A"), { move: setSingleColour(model, "node:dm", "#7FB88A") }));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(applied).toEqual([{ singles: { "node:dm": "#7FB88A" } }, { singles: { "node:dm": "#7FA7D9" } }, { singles: { "node:dm": "#7FB88A" } }]);
  });

  it("adds to a group, moving the member's link to the group, and undoes both", () => {
    const applied: ColourWrites[] = [];
    const editor = editorOf(p(text("the check", "node:k5")));
    const { result } = mount(editor, applied);
    const model = colourModelOf({ reference_groups: [{ id: "rg-login", colour: "#7FB88A", name: "Login flow", members: ["session:s2", "node:c4"] }] }, [{ id: "k5", colour: "#D98C8C" }]);
    act(() => void result.current.step(NOTICE_COPY.added("Check 5", "Login flow"), { move: addToGroup(model, "rg-login", "node:k5", "member") }));
    expect(links(editor)).toEqual([["the check", "group:rg-login"]]);
    expect(applied[0].groups?.[0].members).toEqual(["session:s2", "node:c4", "node:k5"]);
    act(() => result.current.undo());
    expect(links(editor)).toEqual([["the check", "node:k5"]]);
    expect(applied[1]).toEqual({ singles: { "node:k5": "#D98C8C" }, groups: [{ id: "rg-login", colour: "#7FB88A", name: "Login flow", members: ["session:s2", "node:c4"] }] });
  });

  it("deletes, merges and clears, and undoes each", () => {
    const editor = editorOf(p(text("one", "group:rg-a"), text(" "), text("two", "group:rg-b"), text(" "), text("three", "node:x")));
    const { result } = mount(editor);
    const model = colourModelOf({ reference_groups: [{ id: "rg-a", colour: "#7FB88A", members: ["node:1", "node:2"] }, { id: "rg-b", colour: "#B79AD6", members: ["node:3", "node:4"] }] }, [{ id: "x", colour: "#7FA7D9" }]);
    const all = () => links(editor);
    const start = all();
    act(() => void result.current.step(NOTICE_COPY.deleted("No name"), { move: deleteGroup(model, "rg-a") }));
    expect(all()).toEqual([["two", "group:rg-b"], ["three", "node:x"]]);
    act(() => result.current.undo());
    expect(all()).toEqual(start);
    act(() => void result.current.step(NOTICE_COPY.merged("No name", "No name"), { move: mergeGroups(model, "rg-b", "rg-a") }));
    expect(all()).toEqual([["one", "group:rg-a"], ["three", "node:x"]]);
    act(() => result.current.undo());
    expect(all()).toEqual(start);
    act(() => void result.current.step(NOTICE_COPY.cleared(3, 3), { move: clearAll(model, ["node:x"]) }));
    expect(all()).toEqual([]);
    act(() => result.current.undo());
    expect(all()).toEqual(start);
  });

  it("follows the post's typing between a step and its undo", () => {
    const editor = editorOf(p(text("We drew the data model first.")));
    const { result } = mount(editor);
    act(() => {
      result.current.step("x", {
        edit: (tr) => {
          const from = find(editor, "the data model");
          linkWords(tr, from, from + 14, "node:dm");
        },
      });
    });
    act(() => void editor.commands.insertContentAt(1, "Once, "));
    act(() => result.current.undo());
    expect(links(editor)).toEqual([]);
    act(() => result.current.redo());
    expect(links(editor)).toEqual([["the data model", "node:dm"]]);
    expect(editor.state.doc.textContent).toBe("Once, We drew the data model first.");
  });

  it("keeps the editor's own undo for typing only", () => {
    const editor = editorOf(p(text("Hello")));
    const { result } = mount(editor);
    act(() => void editor.commands.insertContentAt(6, " there"));
    act(() => void result.current.step("x", { edit: (tr) => void linkWords(tr, 1, 6, "node:a") }));
    act(() => void editor.commands.undo());
    // Ctrl Z in the post took the typing back, and the link stays.
    expect(editor.state.doc.textContent).toBe("Hello");
    expect(links(editor)).toEqual([["Hello", "node:a"]]);
  });
});

describe("the notice, the buttons and the keys", () => {
  it("shows the sentence with Undo for six seconds", () => {
    vi.useFakeTimers();
    const onUndo = vi.fn();
    const onDone = vi.fn();
    render(<ReferenceNotice notice={{ sentence: "Deleted Login flow", n: 1 }} onUndo={onUndo} onDone={onDone} />);
    expect(screen.getByTestId("reference-notice")).toHaveTextContent("Deleted Login flow");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(NOTICE_MS - 1));
    expect(onDone).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalled();
  });

  it("hands its own n to onDone, so a timer that fires late takes down only its own notice", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { rerender } = render(<ReferenceNotice notice={{ sentence: "Added Session 2", n: 1 }} onUndo={() => undefined} onDone={onDone} />);
    rerender(<ReferenceNotice notice={{ sentence: "Split Session 2 at tile 12", n: 2 }} onUndo={() => undefined} onDone={onDone} />);
    act(() => void vi.advanceTimersByTime(NOTICE_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(2);
  });

  it("greys Undo and Redo when there is nothing to do", () => {
    render(<UndoRedo canUndo={false} canRedo onUndo={() => undefined} onRedo={() => undefined} />);
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
  });

  it("hears Ctrl or Cmd Z, and Shift for redo, only while a window is open", () => {
    const undo = vi.fn();
    const redo = vi.fn();
    const { rerender } = renderHook(({ active }) => useHistoryKeys(active, { undo, redo }), { initialProps: { active: false } });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(undo).not.toHaveBeenCalled();
    rerender({ active: true });
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    fireEvent.keyDown(window, { key: "Z", ctrlKey: true, shiftKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(redo).toHaveBeenCalledTimes(1);
  });
});

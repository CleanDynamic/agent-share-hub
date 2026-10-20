// CA-07 P2 — the editor keeps each post's pictures in one grid at its end.

import { act, cleanup } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ThreadBlock, ThreadDoc, ThreadPostMedia } from "@/lib/build/thread";
import { brk, doc, mountPostTab as mount, p } from "@/pages/site/compose/postTabKit";

import { removePicture, postSpans } from "./pictures";

afterEach(cleanup);

const pic = (mediaId: string): ThreadPostMedia => ({ type: "postMedia", attrs: { mediaId, width: 100, w: 800, h: 600, alt: "", crop: null, aspect: null, zoom: null, warn: [], caption: "" } });
const grid = (...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaGrid", attrs: { step: null }, content: pictures });
const json = (editor: Editor) => editor.getJSON() as ThreadDoc;
const types = (editor: Editor) => json(editor).content.map((block) => block.type);

describe("the grid in the editor", () => {
  it("opens an old post's pictures as one grid, last", () => {
    const { editor } = mount(doc(p("one"), pic("a") as unknown as ThreadBlock, p("two")));
    expect(types(editor)).toEqual(["paragraph", "paragraph", "postMediaGrid"]);
  });

  it("moves words typed after the grid before it", () => {
    const { editor } = mount(doc(p("one"), grid(pic("a")), brk, p("two")));
    const afterGrid = postSpans(editor.state.doc)[0].to;
    act(() => {
      editor.commands.insertContentAt(afterGrid, { type: "paragraph", content: [{ type: "text", text: "late" }] });
    });
    expect(types(editor)).toEqual(["paragraph", "paragraph", "postMediaGrid", "postBreak", "paragraph"]);
    expect(editor.state.doc.child(1).textContent).toBe("late");
  });

  it("moves words pasted after the grid before it, at the end of the thread too", () => {
    const { editor } = mount(doc(p("one"), grid(pic("a"))));
    act(() => {
      editor.commands.insertContentAt(editor.state.doc.content.size, "<p>pasted</p><p>twice</p>");
    });
    expect(types(editor)).toEqual(["paragraph", "paragraph", "paragraph", "postMediaGrid"]);
    // No empty line is kept after the pictures.
    expect(editor.state.doc.lastChild?.type.name).toBe("postMediaGrid");
  });

  it("makes two grids in a post one", () => {
    const { editor } = mount(doc(p("one"), grid(pic("a"))));
    act(() => {
      editor.commands.insertContentAt(0, [grid(pic("b"))]);
    });
    expect(types(editor)).toEqual(["paragraph", "postMediaGrid"]);
    expect((json(editor).content[1] as { content: ThreadPostMedia[] }).content.map((child) => child.attrs.mediaId)).toEqual(["b", "a"]);
  });

  it("takes the grid away with its last picture, and Undo brings it back", () => {
    const { editor } = mount(doc(p("one"), grid(pic("a"))));
    const at = postSpans(editor.state.doc)[0].grid?.pos as number;
    act(() => removePicture(editor, at, 0));
    expect(types(editor)).toEqual(["paragraph"]);
    act(() => {
      editor.commands.undo();
    });
    expect(types(editor)).toEqual(["paragraph", "postMediaGrid"]);
  });
});

describe("New post on the last line of a post with pictures", () => {
  it("keeps the pictures in their post and starts the next one after them", async () => {
    const { fireEvent } = await import("@testing-library/react");
    const { editor, dom } = mount(doc(p("one"), p(""), grid(pic("a"))));
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.child(0).nodeSize + 1);
      editor.commands.insertContent("/new post");
    });
    fireEvent.keyDown(dom, { key: "Enter" });
    expect(types(editor)).toEqual(["paragraph", "postMediaGrid", "postBreak", "paragraph"]);
    expect(editor.state.selection.$from.index(0)).toBe(3);
    expect(editor.getText()).not.toContain("/");
  });
});

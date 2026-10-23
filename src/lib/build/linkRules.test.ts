// CA-19 P1: the rules linked text keeps, on the composer's own editor.

import { Editor } from "@tiptap/core";
import { Slice } from "@tiptap/pm/model";
import { afterEach, describe, expect, it } from "vitest";

import { postExtensions } from "@/components/post/editor/extensions";
import { createPictureHost } from "@/components/post/editor/pictures";

import {
  applyLinkInstructions,
  extraLinks,
  findWords,
  insertLinked,
  LINK_RULES_COPY,
  linkOf,
  linkRanges,
  linkWords,
  rangeRefusal,
  refRuns,
  removeExtraLinks,
  setRuns,
  stripRefMarks,
  targetsLinkedMoreThanOnce,
  threadLinks,
  trimRange,
  unlinkAt,
  unlinkTarget,
} from "./linkRules";
import { addToGroup, colourModelOf, mergeGroups, saveGroup } from "./referenceGroups";

const editors: Editor[] = [];
afterEach(() => {
  while (editors.length) editors.pop()?.destroy();
});

const ref = (to: string) => ({ type: "ref", attrs: { to } });
const text = (value: string, to?: string) => ({ type: "text", text: value, ...(to ? { marks: [ref(to)] } : null) });
const p = (...content: object[]) => ({ type: "paragraph", content });
const brk = { type: "postBreak" };

function editorOf(...content: object[]): Editor {
  const editor = new Editor({
    extensions: postExtensions(false, { slashKey: { current: null }, openLink: { current: null }, pictures: createPictureHost() }),
    content: { type: "doc", content },
  });
  editors.push(editor);
  return editor;
}

/** The position of the first character of `words` in the document. */
function at(editor: Editor, words: string): number {
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (!node.isTextblock) return true;
    const index = editor.state.doc.textBetween(pos + 1, pos + node.nodeSize - 1, "\n", "\n").indexOf(words);
    if (index >= 0) found = pos + 1 + index;
    return false;
  });
  if (found < 0) throw new Error(`no "${words}"`);
  return found;
}

const links = (editor: Editor) => linkRanges(editor.state.doc).map((range) => [range.text, range.to, range.post]);

function link(editor: Editor, words: string, to: string, pad = 0) {
  const from = at(editor, words) - pad;
  const result = linkWords(editor.state.tr, from, from + words.length + pad * 2, to);
  if (result.ok) editor.view.dispatch(result.tr);
  return result;
}

describe("one to one", () => {
  it("gives each target one range, and reads it", () => {
    const editor = editorOf(p(text("We drew "), text("the data model", "node:a"), text(" first.")));
    expect(links(editor)).toEqual([["the data model", "node:a", 1]]);
    expect(linkOf(editor.state.doc, "node:a")?.text).toBe("the data model");
    expect(linkOf(editor.state.doc, "node:b")).toBeNull();
  });

  it("moves a target's link: the old range becomes plain words", () => {
    const editor = editorOf(p(text("the schema", "node:a"), text(" and the data model")));
    const result = link(editor, "the data model", "node:a");
    expect(result.ok && result.moved?.text).toBe("the schema");
    expect(links(editor)).toEqual([["the data model", "node:a", 1]]);
  });

  it("replaces the link words already carry", () => {
    const editor = editorOf(p(text("the data model", "node:a")));
    const result = link(editor, "data", "node:b");
    expect(result.ok && result.replaced).toBe("node:a");
    // The whole old link is gone, so it is never left in two pieces.
    expect(links(editor)).toEqual([["data", "node:b", 1]]);
  });

  it("writes the target's name, then a space, with nothing highlighted", () => {
    const editor = editorOf(p(text("See ")));
    const end = at(editor, "See ") + 4;
    editor.view.dispatch(insertLinked(editor.state.tr, end, "data model", "node:a").tr);
    expect(links(editor)).toEqual([["data model", "node:a", 1]]);
    expect(editor.state.doc.textContent).toBe("See data model ");
  });

  it("never overlaps: the mark excludes itself", () => {
    const editor = editorOf(p(text("one two three")));
    link(editor, "one two", "node:a");
    link(editor, "two three", "node:b");
    expect(links(editor)).toEqual([["two three", "node:b", 1]]);
  });

  it("takes a link off, by target or where the words are", () => {
    const editor = editorOf(p(text("alpha", "node:a"), text(" "), text("beta", "node:b")));
    const tr = editor.state.tr;
    unlinkTarget(tr, "node:a");
    unlinkAt(tr, at(editor, "beta") + 1);
    editor.view.dispatch(tr);
    expect(links(editor)).toEqual([]);
  });
});

describe("one stretch inside one post", () => {
  it("refuses a range across a post break", () => {
    const editor = editorOf(p(text("first post")), brk, p(text("second post")));
    const result = linkWords(editor.state.tr, at(editor, "post"), at(editor, "second") + 3, "node:a");
    expect(result).toEqual({ ok: false, refusal: LINK_RULES_COPY.oneStretch });
    expect(LINK_RULES_COPY.oneStretch).toBe("Linked text has to be one stretch inside one post.");
  });

  it("refuses a range that would be split across two blocks", () => {
    const editor = editorOf(p(text("one")), p(text("two")));
    expect(rangeRefusal(editor.state.doc, at(editor, "one"), at(editor, "two") + 2)).toBe(LINK_RULES_COPY.oneStretch);
  });

  it("trims spaces at either end", () => {
    const editor = editorOf(p(text("say  the words  now")));
    const from = at(editor, " the words ") - 1;
    expect(trimRange(editor.state.doc, from, from + 13)).toEqual({ from: from + 2, to: from + 11 });
    link(editor, "the words", "node:a", 2);
    expect(links(editor)).toEqual([["the words", "node:a", 1]]);
  });

  it("keeps the first part when a post break is typed inside a link, and makes the rest plain", () => {
    const editor = editorOf(p(text("Signing in by email link", "group:rg-1")));
    editor.commands.setTextSelection(at(editor, " by"));
    editor.commands.splitBlock();
    expect(links(editor)).toEqual([["Signing in", "group:rg-1", 1]]);
  });

  it("can't link pictures", () => {
    const editor = editorOf(p(text("words")), { type: "postMediaGrid", attrs: { step: null }, content: [{ type: "postMedia", attrs: { mediaId: "m1" } }] });
    expect(rangeRefusal(editor.state.doc, 1, editor.state.doc.content.size)).toBe(LINK_RULES_COPY.pictures);
  });
});

describe("pasting", () => {
  it("takes the links off a pasted slice", () => {
    const editor = editorOf(p(text("the data model", "node:a")));
    const slice = editor.state.doc.slice(1, 15);
    expect(slice.content.firstChild?.marks.map((mark) => mark.type.name)).toEqual(["ref"]);
    const plain = stripRefMarks(slice);
    expect(plain).toBeInstanceOf(Slice);
    plain.content.descendants((node) => {
      expect(node.marks).toEqual([]);
    });
  });

  it("arrives as plain words in the editor", () => {
    const editor = editorOf(p(text("the data model", "node:a"), text(" again: ")));
    const slice = editor.state.doc.slice(1, 15);
    const end = editor.state.doc.content.size - 1;
    editor.view.dispatch(editor.state.tr.replaceRange(end, end, editor.view.someProp("transformPasted", (transform) => transform(slice, editor.view, false)) ?? slice));
    expect(links(editor)).toEqual([["the data model", "node:a", 1]]);
    expect(editor.state.doc.textContent).toBe("the data model again: the data model");
  });
});

describe("old posts", () => {
  const old = () => editorOf(p(text("Prompt one", "node:p1"), text(" and again "), text("the first prompt", "node:p1")), brk, p(text("once more", "node:p1")));

  it("keeps every range as it is, counting the first as the target's link", () => {
    const editor = old();
    expect(links(editor)).toEqual([
      ["Prompt one", "node:p1", 1],
      ["the first prompt", "node:p1", 1],
      ["once more", "node:p1", 2],
    ]);
    expect(linkOf(editor.state.doc, "node:p1")?.text).toBe("Prompt one");
    expect(extraLinks(editor.state.doc).map((range) => range.text)).toEqual(["the first prompt", "once more"]);
  });

  it("leaves the extra links alone through an edit nearby", () => {
    const editor = old();
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, " typed");
    expect(extraLinks(editor.state.doc)).toHaveLength(2);
  });

  it("removes the extra links in one step", () => {
    const editor = old();
    const tr = editor.state.tr;
    expect(removeExtraLinks(tr)).toBe(2);
    editor.view.dispatch(tr);
    expect(links(editor)).toEqual([["Prompt one", "node:p1", 1]]);
  });

  it("counts the stored threads that have them, without changing them", () => {
    const stored = old().getJSON();
    const before = JSON.stringify(stored);
    expect(targetsLinkedMoreThanOnce(stored)).toBe(1);
    expect(threadLinks(stored).map((entry) => [entry.text, entry.post])).toEqual([
      ["Prompt one", 1],
      ["the first prompt", 1],
      ["once more", 2],
    ]);
    expect(JSON.stringify(stored)).toBe(before);
  });
});

describe("a grouped component's link", () => {
  const making = (groups: object[]) => ({ reference_groups: groups });
  const group = { id: "rg-login", colour: "#7FB88A", name: "Login flow", members: ["session:s2", "node:c4"] };

  it("moves to the group when the group has none", () => {
    const editor = editorOf(p(text("the check", "node:k5")));
    const move = addToGroup(colourModelOf(making([group]), []), "rg-login", "node:k5", "member");
    const tr = editor.state.tr;
    applyLinkInstructions(tr, move?.links);
    editor.view.dispatch(tr);
    expect(links(editor)).toEqual([["the check", "group:rg-login", 1]]);
  });

  it("keeps the group's when both have one, and the member's becomes plain words", () => {
    const editor = editorOf(p(text("signing in", "group:rg-login"), text(" "), text("the check", "node:k5")));
    const move = addToGroup(colourModelOf(making([group]), []), "rg-login", "node:k5", "group");
    const tr = editor.state.tr;
    applyLinkInstructions(tr, move?.links);
    editor.view.dispatch(tr);
    expect(links(editor)).toEqual([["signing in", "group:rg-login", 1]]);
  });

  it("follows a new group's chosen member", () => {
    const editor = editorOf(p(text("schema", "node:a"), text(" "), text("page", "node:b")));
    const move = saveGroup(colourModelOf({}, [{ id: "a", colour: "#7FA7D9" }]), { id: "rg-new", colour: "#7FA7D9", members: ["node:a", "node:b"] }, "node:b");
    const tr = editor.state.tr;
    applyLinkInstructions(tr, move?.links);
    editor.view.dispatch(tr);
    expect(links(editor)).toEqual([["page", "group:rg-new", 1]]);
  });

  it("merges with and without two links", () => {
    const into = { id: "rg-into", colour: "#7FB88A", members: ["node:a", "node:b"] };
    const from = { id: "rg-from", colour: "#B79AD6", members: ["node:c", "node:d"] };
    const model = colourModelOf(making([into, from]), []);
    const both = editorOf(p(text("one", "group:rg-into"), text(" "), text("two", "group:rg-from")));
    let tr = both.state.tr;
    applyLinkInstructions(tr, mergeGroups(model, "rg-from", "rg-into", "from")?.links);
    both.view.dispatch(tr);
    expect(links(both)).toEqual([["two", "group:rg-into", 1]]);

    const onlyFrom = editorOf(p(text("two", "group:rg-from")));
    tr = onlyFrom.state.tr;
    applyLinkInstructions(tr, mergeGroups(model, "rg-from", "rg-into", "from")?.links);
    onlyFrom.view.dispatch(tr);
    expect(links(onlyFrom)).toEqual([["two", "group:rg-into", 1]]);
  });
});

describe("the undo history's runs, and finding words", () => {
  it("reads a region's links and puts them back", () => {
    const editor = editorOf(p(text("alpha", "node:a"), text(" beta")));
    const before = refRuns(editor.state.doc, 0, editor.state.doc.content.size);
    link(editor, "beta", "node:b");
    const tr = editor.state.tr;
    setRuns(tr, 0, editor.state.doc.content.size, before);
    editor.view.dispatch(tr);
    expect(links(editor)).toEqual([["alpha", "node:a", 1]]);
  });

  it("finds a phrase with its post and a little either side", () => {
    const editor = editorOf(p(text("We wrote the data model first.")), brk, p(text("Then the Data Model changed.")));
    const found = findWords(editor.state.doc, "data model");
    expect(found.map((entry) => [entry.match, entry.post])).toEqual([
      ["data model", 1],
      ["Data Model", 2],
    ]);
    expect(found[0].before).toBe("We wrote the ");
    expect(findWords(editor.state.doc, "  ")).toEqual([]);
  });
});

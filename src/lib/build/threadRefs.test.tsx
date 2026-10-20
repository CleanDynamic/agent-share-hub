// CA-06 P1 — the reference mark: its stored shape, the checker, and the editor's round trip.

import { act, cleanup } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { brk, doc, mountPostTab, p } from "@/pages/site/compose/postTabKit";

import { checkThread, parseRefTo, refTo, THREAD_MARK_TYPES, threadRefs, type ThreadDoc } from "./thread";
import { tidyThread } from "./threadEditor";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

afterEach(cleanup);

const ref = (to: string) => ({ type: "ref", attrs: { to } });
const json = (editor: Editor) => tidyThread(editor.getJSON() as ThreadDoc);

describe("the stored shape", () => {
  it("is ref, with a `to` of node:<id> or session:<key>", () => {
    expect(THREAD_MARK_TYPES.has("ref")).toBe(true);
    expect(refTo({ kind: "node", id: "3f1c9a52-1111-4a5b-9c0d-0123456789ab" })).toBe("node:3f1c9a52-1111-4a5b-9c0d-0123456789ab");
    expect(parseRefTo("session:typed-3f1c9a52-1111-4a5b-9c0d-0123456789ab")).toEqual({ kind: "session", id: "typed-3f1c9a52-1111-4a5b-9c0d-0123456789ab" });
    expect(parseRefTo("session:8d2e0000-aaaa-4bbb-8ccc-000000000002")).toEqual({ kind: "session", id: "8d2e0000-aaaa-4bbb-8ccc-000000000002" });
  });

  it("reads any other shape as nothing", () => {
    for (const bad of ["", "node:", "nodes:abc", "https://example.com", "node:a b", "session:typed-legacy-1", "node:<script>", 42, null, `node:${"a".repeat(81)}`]) {
      expect(parseRefTo(bad)).toBeNull();
    }
  });

  it("lists the thread's references, each once", () => {
    const thread = doc(p("brand brief", [ref("node:n1")]), brk, p("again", [ref("node:n1")]), p("session two", [ref("session:typed-a1")]));
    expect(threadRefs(thread)).toEqual(["node:n1", "session:typed-a1"]);
  });
});

describe("the checker", () => {
  it("takes a good `to`", () => {
    expect(checkThread(doc(p("brand brief", [ref("node:n1")]), p("session 2", [ref("session:typed-a1")])))).toEqual([]);
  });

  it("refuses any other `to` with a plain sentence that names the post", () => {
    const problems = checkThread(doc(p("first"), brk, p("bad", [ref("https://example.com")])));
    expect(problems).toEqual([{ code: "bad_ref", post: 1, message: "A link in post 2 points at something that isn't in this build." }]);
  });

  it("takes a `to` whose part is no longer in the build: the post draws it as plain words", () => {
    // Nothing here knows the build, so a gone part is a good shape like any other.
    expect(checkThread(doc(p("an old tile", [ref("node:deleted-tile")])))).toEqual([]);
  });

  it("refuses words that are both a web link and a reference", () => {
    const problems = checkThread(doc(p("both", [ref("node:n1"), { type: "link", attrs: { href: "https://example.com" } }])));
    expect(problems.map((problem) => problem.code)).toEqual(["bad_ref"]);
  });
});

describe("in the editor", () => {
  it("comes back out as it went in", () => {
    const start = doc(p("Read the "), p("brand brief", [ref("node:n1")]), p("then session 2", [ref("session:typed-a1")]));
    const { editor } = mountPostTab(start);
    expect(json(editor)).toEqual(start);
    const span = document.querySelector('[data-ref="node:n1"]') as HTMLElement;
    expect(span.tagName).toBe("SPAN");
    expect(span.getAttribute("role")).toBe("link");
    expect(span.getAttribute("tabindex")).toBe("0");
  });

  it("does not grow when typing at its edge", () => {
    const { editor } = mountPostTab(doc(p("brand brief", [ref("node:n1")])));
    act(() => {
      editor.chain().setTextSelection(12).insertContent(" next").run();
    });
    expect(json(editor)).toEqual(doc({ type: "paragraph", content: [{ type: "text", text: "brand brief", marks: [ref("node:n1")] }, { type: "text", text: " next" }] } as never));
  });

  it("cannot hold a web link, and a web link cannot hold it", () => {
    const { editor } = mountPostTab(doc(p("brand brief", [ref("node:n1")])));
    act(() => {
      editor.chain().setTextSelection({ from: 1, to: 12 }).setLink({ href: "https://example.com" }).run();
    });
    expect(JSON.stringify(json(editor))).not.toContain('"link"');
    cleanup();

    const linked = mountPostTab(doc(p("web words", [{ type: "link", attrs: { href: "https://example.com" } }]))).editor;
    act(() => {
      linked.chain().setTextSelection({ from: 1, to: 10 }).setMark("ref", { to: "node:n1" }).run();
    });
    const out = JSON.stringify(json(linked));
    expect(out).toContain('"ref"');
    expect(out).not.toContain('"link"');
    expect(checkThread(json(linked))).toEqual([]);
  });
});

// PT-05 — shared by the Post tab's suites: small documents, a fake thread, and a mounted tab.

import { render } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import type { ComponentProps } from "react";
import { vi } from "vitest";

import type { ThreadBlock, ThreadDoc } from "@/lib/build/thread";

import { PostTab } from "./PostTab";
import type { ComposeThread } from "./useComposeThread";

// jsdom lays nothing out; ProseMirror asks a Range for its rectangles when it scrolls a selection into view.
const NO_RECTS = Object.assign([] as unknown[], { item: () => null });
const NO_BOX = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
if (typeof Range !== "undefined") {
  Range.prototype.getClientRects ??= () => NO_RECTS as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => NO_BOX as DOMRect;
}
if (typeof Element !== "undefined") Element.prototype.getClientRects ??= () => NO_RECTS as unknown as DOMRectList;

export const p = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]): ThreadBlock =>
  ({ type: "paragraph", content: text ? [{ type: "text", text, ...(marks ? { marks } : null) }] : [] }) as ThreadBlock;
export const brk: ThreadBlock = { type: "postBreak" };
export const doc = (...content: ThreadBlock[]): ThreadDoc => ({ type: "doc", content });

export function fakeThread(initial: ThreadDoc, over: Partial<ComposeThread> = {}): ComposeThread {
  return {
    buildId: undefined,
    ensureBuild: async () => "00000000-0000-4000-8000-000000000001",
    status: "ready",
    version: 1,
    readDoc: () => initial,
    onDoc: vi.fn(),
    posts: 1,
    save: "idle",
    hold: null,
    flush: async () => undefined,
    retry: () => undefined,
    retryLoad: () => undefined,
    ...over,
  };
}

export function mountPostTab(initial: ThreadDoc, { phone = false, ...over }: Partial<ComposeThread> & { phone?: boolean } = {}, extra: Partial<ComponentProps<typeof PostTab>> = {}) {
  const thread = fakeThread(initial, over);
  const view = render(<PostTab thread={thread} phone={phone} {...extra} />);
  const dom = document.querySelector('[contenteditable="true"]') as (HTMLElement & { editor: Editor }) | null;
  if (!dom) throw new Error("no editor");
  return { thread, editor: dom.editor, dom, view };
}

/** The ProseMirror position at the start of the top-level block at `index`. */
export function startOf(editor: Editor, index: number): number {
  let pos = 0;
  editor.state.doc.forEach((_, offset, at) => {
    if (at === index) pos = offset + 1;
  });
  return pos;
}


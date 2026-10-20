// CA-06 P0 — the one-prompt build's post in the composer, saved before CA-06 so the end can be compared with it.
//
// CA-04 P7's snapshots hold the List, Details and the build page. The post above Build was not in them, and CA-06
// changes its toolbar (P2 adds @), so its markup is kept here: the toolbar and the editor, as a one-prompt build's
// short post draws them. CA-06 P2 updates the toolbar file, and only for the @ button.

import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { doc, mountPostTab, p } from "@/pages/site/compose/postTabKit";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

afterEach(cleanup);

const tidy = (markup: string) =>
  markup
    .replace(/(id|for|aria-labelledby|aria-controls|aria-describedby)="[^"]*:[^"]*"/g, '$1="(id)"')
    .replace(/_R_[A-Za-z0-9]+_/g, "(id)")
    .replace(/></g, ">\n<");

describe("the one-prompt build's post", () => {
  it("draws the toolbar as before, but for @", async () => {
    mountPostTab(doc(p("Paste this into Claude and it writes the landing page.")));
    const toolbar = document.querySelector('[data-testid="post-toolbar"]') as HTMLElement;
    await expect(tidy(toolbar.outerHTML)).toMatchFileSnapshot("__snapshots__/one-prompt.post-toolbar.html");
  });

  it("draws the editor as before", async () => {
    const { dom } = mountPostTab(doc(p("Paste this into Claude and it writes the landing page.")));
    await expect(tidy(dom.outerHTML)).toMatchFileSnapshot("__snapshots__/one-prompt.post-editor.html");
  });
});

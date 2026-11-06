// UX-10 P2: a post's Edit dialog draws exactly what it drew before profiles used it. The snapshot was taken on main before the
// change (UX-10 Part 2) and is held here unchanged.

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/build/media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/build/media")>()),
  signedMediaUrl: vi.fn(async (ref: { path: string }) => `https://signed.test/${ref.path}`),
}));

import type { ThreadBlock, ThreadPostMedia } from "@/lib/build/thread";
import { doc, mountPostTab as mount, p } from "@/pages/site/compose/postTabKit";

afterEach(() => cleanup());

const pic = (mediaId: string): ThreadPostMedia =>
  ({ type: "postMedia", attrs: { mediaId, width: 100, w: 1600, h: 900, alt: "", crop: null, aspect: null, zoom: null, warn: [], caption: "" } }) as ThreadPostMedia;
const grid = (...pictures: ThreadPostMedia[]): ThreadBlock => ({ type: "postMediaGrid", attrs: { step: null }, content: pictures });

/** The dialog's markup with React's generated ids made stable. */
const markup = (node: Element) => {
  const ids = new Map<string, string>();
  return node.outerHTML.replace(/«[^»]*»|:r[0-9a-z]+:/g, (id) => {
    if (!ids.has(id)) ids.set(id, `id${ids.size}`);
    return ids.get(id) as string;
  });
};

it("a post's Edit dialog is the same, tab by tab", async () => {
  mount(doc(p("words"), grid(pic("a"), pic("b"))));
  await waitFor(() => expect(document.querySelector("[data-grid-view] [data-edit-pill]")).toBeTruthy());
  fireEvent.click(document.querySelector<HTMLElement>("[data-grid-view] [data-edit-pill]") as HTMLElement);
  const dialog = await screen.findByTestId("edit-media-dialog");
  expect(markup(dialog)).toMatchSnapshot("crop");
  fireEvent.click(within(dialog).getByRole("tab", { name: "ALT" }));
  expect(markup(dialog)).toMatchSnapshot("alt");
  fireEvent.click(within(dialog).getByRole("tab", { name: "Content warning" }));
  expect(markup(dialog)).toMatchSnapshot("warn");
});

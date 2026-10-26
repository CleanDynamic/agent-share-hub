// CA-22 P2 - removing a file in Sources: its row lifts out in place, then the rows below slide up.

import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxSourcesProps } from "@/dev/fixtures/sandbox";
import { LIFT } from "@/lib/build/buildMotion";
import { MotionChannel, MotionChannelContext, type MotionKind } from "./listMotion";

import { __resetMotionMediaCache } from "@/lib/theme/motion";

import { SourcesPanel } from "./SourcesPanel";
import { passes, stubAnimations, type Played } from "./motionStub";

/* SV-06: the page's channel, given to the List as the composer's page gives it; a step labels its change on it. */
const channel = new MotionChannel();
const announce = (kind: MotionKind, sentence?: string) => channel.expect({ kind, keys: [], sentence });
const resetIntent = () => channel.reset();

let played: Played[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  resetIntent();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  __resetMotionMediaCache();
  ({ played } = stubAnimations());
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (Element.prototype as { animate?: unknown }).animate;
  resetIntent();
});

const rows = () => document.querySelectorAll("[data-file-id]");

function mount(files: ReturnType<typeof sandboxSourcesProps>["files"], onRemoveFile?: (id: string) => void) {
  const props = { ...sandboxSourcesProps("bakery"), onRemoveFile };
  const view = (list: typeof files) => (
    <MemoryRouter>
      <MotionChannelContext.Provider value={channel}>
        <SourcesPanel {...props} files={list} />
      </MotionChannelContext.Provider>
    </MemoryRouter>
  );
  const first = render(view(files));
  return { again: (list: typeof files) => first.rerender(view(list)) };
}

describe("a file removed in Sources", () => {
  it("lifts its row out in place (fades, rises 8) and lets it go after 200", async () => {
    const files = sandboxSourcesProps("bakery").files;
    expect(files.length).toBeGreaterThan(0);
    const { again } = mount(files, vi.fn());
    const before = rows().length;
    announce("remove", "Removed menu.pdf");
    again(files.slice(1));
    expect(rows()).toHaveLength(before);
    const lift = played.find((entry) => entry.keyframes.some((frame) => frame.transform === "translateY(-8px)"));
    expect(lift?.element).toBe(document.querySelector(`[data-file-id="${files[0].id}"]`));
    expect(lift?.options.duration).toBe(LIFT);
    await passes(LIFT);
    expect(rows()).toHaveLength(before - 1);
  });

  it("without an announced change the row just goes", () => {
    const files = sandboxSourcesProps("bakery").files;
    const { again } = mount(files);
    const before = rows().length;
    again(files.slice(1));
    expect(rows()).toHaveLength(before - 1);
    expect(played).toHaveLength(0);
  });
});

// UX-01 P6: card images keep their addresses between visits. Each signature is a query, so a second mount of the same
// pictures asks for nothing and gets the same address; a different width is a different picture and is signed.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const signedMediaUrl = vi.hoisted(() => vi.fn());
vi.mock("@/lib/build", async (original) => ({ ...(await original<typeof import("@/lib/build")>()), signedMediaUrl }));

import { signCardMedia, useSignedMedia, type CardMedia } from "./cardMedia";

afterEach(() => {
  cleanup();
  signedMediaUrl.mockReset();
});

const row = (id: string, slotWidth = 640): CardMedia =>
  ({ id, bucket: "build-media", path: `u/${id}.png`, kind: "image", poster_path: null, slotWidth }) as unknown as CardMedia;

let counter = 0;
const sign = () => signedMediaUrl.mockImplementation(async (ref: { path: string }, options: { width: number }) => `https://s/${ref.path}?w=${options.width}&token=${++counter}`);

function harness() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe("UX-01 P6: useSignedMedia", () => {
  it("mount, unmount, mount: no second signing request, and the src is the same", async () => {
    sign();
    const { wrapper } = harness();
    const rows = [row("a"), row("b")];
    const first = renderHook(() => useSignedMedia(rows), { wrapper });
    await waitFor(() => expect(first.result.current.size).toBe(2));
    const before = new Map(first.result.current);
    expect(signedMediaUrl).toHaveBeenCalledTimes(2);
    first.unmount();

    const second = renderHook(() => useSignedMedia([row("a"), row("b")]), { wrapper });
    // The addresses are there on the first render: nothing waits, nothing is asked.
    expect(second.result.current.get("u/a.png")).toBe(before.get("u/a.png"));
    expect(second.result.current.get("u/b.png")).toBe(before.get("u/b.png"));
    expect(signedMediaUrl).toHaveBeenCalledTimes(2);
  });

  it("signs one request per image, and a changed width is a new picture", async () => {
    sign();
    const { wrapper } = harness();
    const hook = renderHook(({ rows }: { rows: CardMedia[] }) => useSignedMedia(rows), { wrapper, initialProps: { rows: [row("a", 640)] } });
    await waitFor(() => expect(hook.result.current.size).toBe(1));
    hook.rerender({ rows: [row("a", 1200)] });
    await waitFor(() => expect(signedMediaUrl).toHaveBeenCalledTimes(2));
  });

  it("a row storage will not sign is one missing picture, not a blank page", async () => {
    signedMediaUrl.mockImplementation(async (ref: { path: string }) => {
      if (ref.path.includes("bad")) throw new Error("no");
      return `https://s/${ref.path}`;
    });
    const { wrapper } = harness();
    const hook = renderHook(() => useSignedMedia([row("good"), row("bad")]), { wrapper });
    await waitFor(() => expect(hook.result.current.get("u/good.png")).toBe("https://s/u/good.png"));
    expect(hook.result.current.has("u/bad.png")).toBe(false);
  });

  it("signCardMedia shares the cache: a picture signed by the hook is not signed again", async () => {
    sign();
    const { client, wrapper } = harness();
    const hook = renderHook(() => useSignedMedia([row("a")]), { wrapper });
    await waitFor(() => expect(hook.result.current.size).toBe(1));
    const map = await signCardMedia([row("a")], client);
    expect(map.get("u/a.png")).toBe(hook.result.current.get("u/a.png"));
    expect(signedMediaUrl).toHaveBeenCalledTimes(1);
  });
});

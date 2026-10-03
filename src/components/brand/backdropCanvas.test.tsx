// UI-P13b — the backdrop canvas: one canvas for the document, the ripple input
// rules, the buffer size, and the static fallback when the GPU says no.
//
// jsdom has no WebGL, so the context here is a stub that answers every call; it
// counts what the module asks of it. This file is its own module instance, so
// the stub is installed before anything attaches.

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { attachBackdrop, bufferSize, isRippleKey, parseColor, viewportUv } from "./backdropCanvas";
import { PageBackdrop } from "./PageBackdrop";

function stubGl() {
  const calls: Record<string, number> = {};
  const gl = new Proxy(
    { COMPILE_STATUS: 1, LINK_STATUS: 2, VERTEX_SHADER: 3, FRAGMENT_SHADER: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8 },
    {
      get(target, key: string) {
        if (key in target) return target[key as keyof typeof target];
        return (..._args: unknown[]) => {
          calls[key] = (calls[key] ?? 0) + 1;
          if (key === "getShaderParameter" || key === "getProgramParameter") return true;
          if (key === "isContextLost") return false;
          if (key === "getAttribLocation") return 0;
          if (key === "getExtension") return null;
          return {};
        };
      },
    },
  );
  return { gl, calls };
}

describe("the backdrop canvas", () => {
  let stub: ReturnType<typeof stubGl>;
  let contexts = 0;

  beforeEach(() => {
    stub = stubGl();
    contexts = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement, type: string) {
      if (type !== "webgl") return null;
      contexts++;
      return stub.gl as unknown as WebGLRenderingContext;
    } as typeof HTMLCanvasElement.prototype.getContext);
  });
  afterEach(() => vi.restoreAllMocks());

  it("is one canvas, compiled once, that moves between frames as they mount and unmount", () => {
    const first = render(<PageBackdrop />);
    const canvas = first.container.querySelector('canvas[data-ui="backdrop-canvas"]');
    expect(canvas).not.toBeNull();
    expect(stub.calls.compileShader).toBe(2);

    // A second frame mounts (the rebuild page's own SiteFrame) before the first goes.
    const second = render(<PageBackdrop tone="signin" />);
    expect(second.container.querySelector('canvas[data-ui="backdrop-canvas"]')).toBe(canvas);
    first.unmount();
    expect(document.querySelectorAll('canvas[data-ui="backdrop-canvas"]')).toHaveLength(1);

    // Every frame gone, then a new one: still the same canvas, context and program.
    second.unmount();
    expect(document.querySelectorAll('canvas[data-ui="backdrop-canvas"]')).toHaveLength(0);
    const third = render(<PageBackdrop />);
    expect(third.container.querySelector('canvas[data-ui="backdrop-canvas"]')).toBe(canvas);
    expect(stub.calls.compileShader).toBe(2);
    expect(contexts).toBe(1);
    third.unmount();
  });

  it("sits over the static room, inside it, as its last child", () => {
    const { container } = render(<PageBackdrop />);
    const room = container.querySelector('[data-ui="page-backdrop"]')!;
    expect(room.lastElementChild?.firstElementChild?.getAttribute("data-ui")).toBe("backdrop-canvas");
    expect(room.querySelector('svg[data-ui="arc"]')).not.toBeNull();
  });
});

describe("the canvas when the shader does not compile", () => {
  it("leaves the static room and throws nothing", async () => {
    vi.resetModules();
    const { gl } = stubGl();
    const refusing = new Proxy(gl, {
      get: (target, key: string) => (key === "getShaderParameter" ? () => false : Reflect.get(target, key)),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(refusing as unknown as WebGLRenderingContext);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fresh = await import("./backdropCanvas");
    const host = document.createElement("div");
    expect(() => fresh.attachBackdrop(host)()).not.toThrow();
    expect(host.querySelector("canvas")).toBeNull();
    vi.restoreAllMocks();
  });
});

describe("attachBackdrop without WebGL", () => {
  it("does nothing and returns a release that does nothing", async () => {
    vi.resetModules();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const fresh = await import("./backdropCanvas");
    const host = document.createElement("div");
    const release = fresh.attachBackdrop(host);
    expect(host.childElementCount).toBe(0);
    expect(release).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("ripple input", () => {
  const key = (k: string, target: EventTarget | null, repeat = false) => ({ key: k, target, repeat });

  it("takes Enter and Space on a control", () => {
    const button = document.createElement("button");
    const link = document.createElement("a");
    const checkbox = Object.assign(document.createElement("input"), { type: "checkbox" });
    document.body.append(button, link, checkbox);
    expect(isRippleKey(key("Enter", button))).toBe(true);
    expect(isRippleKey(key(" ", button))).toBe(true);
    expect(isRippleKey(key("Enter", link))).toBe(true);
    expect(isRippleKey(key(" ", checkbox))).toBe(true);
    button.remove();
    link.remove();
    checkbox.remove();
  });

  it("ignores typing, held keys, other keys and an unfocused page", () => {
    const search = Object.assign(document.createElement("input"), { type: "search" });
    const area = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const button = document.createElement("button");
    expect(isRippleKey(key(" ", search))).toBe(false);
    expect(isRippleKey(key("Enter", search))).toBe(false);
    expect(isRippleKey(key(" ", area))).toBe(false);
    expect(isRippleKey(key(" ", editable))).toBe(false);
    expect(isRippleKey(key("Enter", button, true))).toBe(false);
    expect(isRippleKey(key("a", button))).toBe(false);
    expect(isRippleKey(key(" ", document.body))).toBe(false);
  });

  it("places an origin in viewport uv, y up, whatever the device pixel ratio", () => {
    expect(viewportUv(720, 450, 1440, 900)).toEqual([0.5, 0.5]);
    expect(viewportUv(1440, 0, 1440, 900)).toEqual([1, 1]);
    expect(viewportUv(0, 900, 1440, 900)).toEqual([0, 0]);
    expect(viewportUv(-20, 2000, 1440, 900)).toEqual([0, 0]);
  });
});

describe("bufferSize", () => {
  it("is min(dpr, 1.5) × 0.85 of the viewport, in whole pixels", () => {
    expect(bufferSize(1440, 900, 1)).toEqual([1224, 765]);
    expect(bufferSize(1440, 900, 2)).toEqual([1836, 1148]);
    expect(bufferSize(390, 844, 3)).toEqual([497, 1076]);
  });

  it("drops a further × 0.72 above 2.2 megapixels", () => {
    expect(bufferSize(2560, 1440, 1)).toEqual([1567, 881]);
  });
});

describe("parseColor", () => {
  it("reads the token forms the theme uses", () => {
    expect(parseColor("#FFFFFF")).toEqual([1, 1, 1]);
    expect(parseColor(" #000 ")).toEqual([0, 0, 0]);
    expect(parseColor("rgb(255, 0, 51)")).toEqual([1, 0, 0.2]);
    expect(parseColor("var(--x)")).toBeNull();
  });
});

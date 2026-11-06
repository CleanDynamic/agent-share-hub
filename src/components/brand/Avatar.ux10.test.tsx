// UX-10 P3: Avatar shows a profile picture's stored crop on every surface, once, from the URL; with none, it is centred as before.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Avatar } from "./Avatar";

afterEach(() => cleanup());

describe("Avatar and a crop", () => {
  it("draws the crop: the picture placed so the circle shows the cropped square", () => {
    const { container } = render(<Avatar size={96} userId="u" name="Maya Ali" src="https://cdn.test/me.jpg#crop=0.25,0,0.5,1" />);
    const box = container.querySelector('[data-ui="avatar"]') as HTMLElement;
    expect(box.hasAttribute("data-cropped")).toBe(true);
    const img = box.querySelector("img") as HTMLImageElement;
    // The crop is half the width: the picture is drawn twice the circle's width, a quarter of it off to the left.
    expect(img.style.width).toBe("200%");
    expect(img.style.left).toBe("-50%");
    expect(img.style.top).toBe("0%");
    expect(img.getAttribute("width")).toBe("96");
  });

  it("with no crop, fills the circle centred, as before", () => {
    const { container } = render(<Avatar size={40} userId="u" name="Maya Ali" src="https://cdn.test/me.jpg" />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("data-ui")).toBe("avatar");
    expect(img.style.objectFit).toBe("cover");
    expect(img.alt).toBe("Maya Ali");
  });

  it("takes the picture's ALT, or none where the name sits beside it", () => {
    const { container } = render(<Avatar size={40} userId="u" name="Maya Ali" src="https://cdn.test/me.jpg" alt="" />);
    expect((container.querySelector("img") as HTMLImageElement).alt).toBe("");
  });
});

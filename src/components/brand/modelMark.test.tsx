// UI-P83 — the model mark is the logo alone: no tile, no background, no border; colour files as images, mono files
// as a mask over currentColor, and nothing at all when there is no logo.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModelChip } from "./ModelChip";
import { ModelMark } from "./ModelMark";
import { ModelTag } from "./ModelTag";

describe("ModelMark", () => {
  it("draws a colour mark as an unaltered, hidden image", () => {
    const { container } = render(<ModelMark model="claude-sonnet-5-5" size={20} />);
    const img = container.querySelector("img")!;
    expect(img.dataset.mark).toBe("claude-color");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("aria-hidden")).toBe("true");
    expect(img.getAttribute("width")).toBe("20");
    expect(img.getAttribute("height")).toBe("20");
    expect(img.draggable).toBe(false);
  });

  it("draws a mono mark as a mask over currentColor", () => {
    const { container } = render(<ModelMark tool="ChatGPT" size={16} />);
    const el = container.querySelector("[data-mark]") as HTMLElement;
    expect(el.dataset.mark).toBe("openai");
    expect(el.getAttribute("aria-hidden")).toBe("true");
    // jsdom drops the mask properties from `style`, so read the attribute React wrote.
    const css = el.getAttribute("style") ?? "";
    expect(css).toMatch(/background-color:\s*currentcolor/i);
    expect(css).toMatch(/mask-size:\s*contain/i);
    expect(css).toMatch(/mask-image:\s*url\(/i);
  });

  it("draws Gmail as the mail glyph", () => {
    const { container } = render(<ModelMark tool="Gmail" size={18} />);
    expect(container.querySelector("[data-mark='mail'] svg")).not.toBeNull();
  });

  it("renders nothing without a logo", () => {
    const { container } = render(<ModelMark tool="Notepad" size={16} />);
    expect(container.innerHTML).toBe("");
  });

  it("has no tile: no padding, border, radius, shadow or filled background", () => {
    for (const props of [{ lab: "Google" }, { lab: "xAI" }]) {
      const { container } = render(<ModelMark {...props} size={28} />);
      const el = container.firstElementChild as HTMLElement;
      expect(el.style.padding).toBe("");
      expect(el.style.border).toBe("");
      expect(el.style.borderRadius).toBe("");
      expect(el.style.boxShadow).toBe("");
      expect(el.style.flexShrink).toBe("0");
      expect(el.style.display).toBe("inline-block");
      expect(el.style.verticalAlign).toBe("middle");
    }
  });
});

describe("ModelTag and ModelChip", () => {
  it("sizes the tag's mark at 14 in a 22px tag", () => {
    const { container } = render(<ModelTag model="Opus 5.5">Opus 5.5</ModelTag>);
    const tag = container.firstElementChild as HTMLElement;
    expect(tag.style.height).toBe("22px");
    expect(tag.style.padding).toBe("0px 8px 0px 6px");
    expect(tag.querySelector("[data-mark]")!.getAttribute("width")).toBe("14");
  });

  it("sizes the chip's mark at 20 in a 32px button and presses with aria-pressed", () => {
    const { container } = render(<ModelChip tool="Cursor" pressed>Cursor</ModelChip>);
    const btn = container.querySelector("button")!;
    expect(btn.style.height).toBe("32px");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect((btn.querySelector("[data-mark]") as HTMLElement).style.width).toBe("20px");
    expect(btn.textContent).toBe("Cursor");
  });
});

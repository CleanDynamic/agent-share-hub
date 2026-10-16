import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MadeWithMarks, listNames, marksOf } from "./MadeWithMarks";

const keys = (madeWith: string[], models: string[] = []) => marksOf(madeWith, models).map((mark) => mark.key);

describe("marksOf", () => {
  it("reads tool labels in order, one mark each", () => {
    expect(keys(["ChatGPT", "Claude", "Gemini", "Claude Code"])).toEqual(["openai", "claude-color", "gemini-color", "claudecode-color"]);
  });

  it("never draws the same mark twice: tools, models and models_used that share a logo are one", () => {
    expect(keys(["Claude", "Claude Opus 5.5", "claude-sonnet-5-5"], ["claude-sonnet-5-5", "Sonnet 5.5"])).toEqual(["claude-color"]);
  });

  it("reads tool labels first, then model names, then models_used for anything not yet covered", () => {
    expect(keys(["Opus 5.5", "ChatGPT"], ["gemini-4-argon"])).toEqual(["openai", "claude-color", "gemini-color"]);
  });

  it("skips a name with no mark", () => {
    expect(keys(["Some Tool I Wrote", "Cursor"], ["not-a-model"])).toEqual(["cursor"]);
  });

  it("names a mark found by a model by its product, and a tool by its own label", () => {
    expect(marksOf(["Sonnet 5.5"], []).map((mark) => mark.name)).toEqual(["Claude"]);
    expect(marksOf(["Claude Code"], []).map((mark) => mark.name)).toEqual(["Claude Code"]);
  });
});

describe("listNames", () => {
  it("joins with commas and a last and", () => {
    expect(listNames(["A"])).toBe("A");
    expect(listNames(["A", "B"])).toBe("A and B");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("MadeWithMarks", () => {
  const four = ["ChatGPT", "Claude", "Gemini", "Claude Code"];

  it("is one image named from the plain names, with the same words as its title", () => {
    render(<MadeWithMarks madeWith={["ChatGPT", "Claude", "Gemini"]} />);
    const group = screen.getByRole("img", { name: "Made with ChatGPT, Claude and Gemini" });
    expect(group).toHaveAttribute("title", "Made with ChatGPT, Claude and Gemini");
    expect(group.querySelectorAll("[data-mark]")).toHaveLength(3);
  });

  it("draws marks at 16, 4 apart, with nothing behind them", () => {
    render(<MadeWithMarks madeWith={["Claude", "Gemini"]} />);
    const group = screen.getByRole("img");
    expect(group).toHaveStyle({ gap: "4px" });
    const mark = group.querySelector("[data-mark]") as HTMLElement;
    expect(mark.style.width || mark.getAttribute("width")).toMatch(/^16(px)?$/);
    for (const el of [group, mark]) {
      expect(el.style.border).toBe("");
      expect(el.style.borderRadius).toBe("");
      expect(el.style.background).toBe("");
    }
  });

  it("caps at four on desktop and counts the rest, but names all of them", () => {
    render(<MadeWithMarks madeWith={[...four, "Cursor", "Grok"]} />);
    const group = screen.getByRole("img", { name: "Made with ChatGPT, Claude, Gemini, Claude Code, Cursor and Grok" });
    expect(group.querySelectorAll("[data-mark]")).toHaveLength(4);
    expect(group).toHaveTextContent("+2");
  });

  it("caps at three on a phone", () => {
    render(<MadeWithMarks madeWith={four} phone />);
    const group = screen.getByRole("img");
    expect(group.querySelectorAll("[data-mark]")).toHaveLength(3);
    expect(group).toHaveTextContent("+1");
  });

  it("draws nothing when no name has a mark", () => {
    const { container } = render(<MadeWithMarks madeWith={["Something"]} modelsUsed={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

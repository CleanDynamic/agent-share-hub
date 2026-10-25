// SV-01 Part 2. A prompt is a maker's own words, drawn for every reader. It is
// text: markup in it is shown, never run.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/CommentsSection", () => ({ CommentsSection: () => null }));

import { PromptViewer, VARIABLE_MARK } from "@/components/ContentBlockViewer";

/** The style attribute of a variable's <mark> before SV-01, taken from the old string. */
const ORIGINAL_MARK_STYLE =
  "background:color-mix(insrgb,var(--evidence)20%,transparent);color:var(--evidence);border-radius:3px;padding:1px4px";

const cssOf = (style: Record<string, string | number>) =>
  Object.entries(style)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`)
    .join(";")
    .replace(/\s+/g, "");

const block = (text: string, variables: { name: string; description: string }[] = []) =>
  ({
    id: "b1", position: 0, block_type: "prompt", text_content: text, formatting: null, formatting_type: null,
    sub_blocks: null, use_instructions: null, file_url: null, file_name: null, file_size_bytes: null,
    image_url: null, image_description: null, is_preview: false, external_file_url: null, github_url: null,
    prompt_role: null, prompt_model: null, prompt_variables: variables,
  }) as never;

/** The drawn prompt: the box that holds the text, and the highlighted variables inside it. */
function drawn(container: HTMLElement) {
  const box = container.querySelector("div[style*='pre-wrap']") as HTMLElement;
  return {
    text: box.textContent,
    // jsdom's CSS parser drops color-mix() and var() when React sets them, so the
    // style is held to the old attribute through VARIABLE_MARK (next test).
    marks: [...box.querySelectorAll("mark")].map((mark) => ({ text: mark.textContent })),
    elements: [...box.querySelectorAll("*")].map((el) => el.tagName.toLowerCase()),
  };
}

describe("SV-01 P2: prompt text is text", () => {
  const writeText = vi.fn();
  beforeEach(() => {
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows markup as characters and makes no img or script", () => {
    const hostile = '<img src=x onerror=alert(1)> and <script>alert(2)</script> and <b>bold</b>';
    const { container } = render(<PromptViewer block={block(hostile)} />);
    const shown = drawn(container);
    expect(shown.text).toBe(hostile);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(shown.elements).toEqual([]);
  });

  it("shows markup inside a variable's filled value as characters too", () => {
    const { container } = render(
      <PromptViewer block={block("Hello {{name}}", [{ name: "name", description: "who" }])} />,
    );
    fireEvent.change(screen.getByPlaceholderText("who"), { target: { value: "<img src=x onerror=alert(1)>" } });
    expect(drawn(container).text).toBe("Hello <img src=x onerror=alert(1)>");
    expect(container.querySelector("img")).toBeNull();
  });

  it("draws a prompt with variables exactly as before", () => {
    const { container } = render(
      <PromptViewer
        block={block("Write to {{name}} about {{topic}}.\nThen thank {{name}}.", [
          { name: "name", description: "who" },
          { name: "topic", description: "what" },
        ])}
      />,
    );
    expect(drawn(container)).toMatchInlineSnapshot(`
      {
        "elements": [
          "mark",
          "mark",
          "mark",
        ],
        "marks": [
          {
            "text": "{{name}}",
          },
          {
            "text": "{{topic}}",
          },
          {
            "text": "{{name}}",
          },
        ],
        "text": "Write to {{name}} about {{topic}}.
      Then thank {{name}}.",
      }
    `);
  });

  it("gives a variable the style it had", () => {
    expect(cssOf(VARIABLE_MARK as Record<string, string | number>)).toBe(ORIGINAL_MARK_STYLE);
  });

  it("copies the filled text unchanged", () => {
    render(
      <PromptViewer block={block("Hi {{name}} <b>x</b>", [{ name: "name", description: "who" }])} />,
    );
    fireEvent.change(screen.getByPlaceholderText("who"), { target: { value: "Maya" } });
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith("Hi Maya <b>x</b>");
  });
});

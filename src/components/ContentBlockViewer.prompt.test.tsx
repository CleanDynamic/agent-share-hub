// CA-29 Part 2. A prompt is a maker's own words. It is drawn as text: a prompt
// that holds markup shows the characters, and no element is made from them.

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

import { PromptViewer } from "@/components/ContentBlockViewer";

const block = (text: string, variables: { name: string; description: string }[] = []) =>
  ({
    id: "b1",
    position: 0,
    block_type: "prompt",
    text_content: text,
    formatting: null,
    formatting_type: null,
    sub_blocks: null,
    use_instructions: null,
    file_url: null,
    file_name: null,
    file_size_bytes: null,
    image_url: null,
    image_description: null,
    is_preview: false,
    external_file_url: null,
    github_url: null,
    prompt_variables: variables,
  }) as never;

/** The drawn prompt: the one element that holds the maker's text. */
const drawn = (container: HTMLElement): HTMLElement =>
  container.querySelector<HTMLElement>('[style*="Courier New"][style*="pre-wrap"]') as HTMLElement;

/** Each highlighted variable in the drawn prompt, by the text it holds. */
const highlighted = (container: HTMLElement) =>
  [...drawn(container).querySelectorAll<HTMLElement>("mark, span")].map((node) => node.textContent);

/**
 * The highlights as the server renderer writes them, which keeps the style exactly as given
 * (jsdom drops a colour-mix value, so the style cannot be read back from its DOM).
 */
const highlightStyles = (markup: string) =>
  [...markup.matchAll(/<(mark|span) style="([^"]*color-mix[^"]*)">([^<]*)<\/\1>/g)].map((match) => ({ style: match[2], text: match[3] }));

describe("CA-29 P2: prompt text is text", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  });

  it("draws markup in a prompt as characters and makes no element from it", () => {
    const hostile = 'Hello <img src=x onerror=alert(1)> and <script>alert(2)</script> {{name}}';
    const { container } = render(<PromptViewer block={block(hostile)} />);
    const prompt = drawn(container);

    expect(prompt.textContent).toBe(hostile);
    expect(prompt.querySelector("img")).toBeNull();
    expect(prompt.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });

  it("draws markup a reader types into a variable as characters too", () => {
    const { container } = render(<PromptViewer block={block("Write about {{topic}}.", [{ name: "topic", description: "" }])} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "<img src=x onerror=alert(1)>" } });

    expect(drawn(container).textContent).toBe("Write about <img src=x onerror=alert(1)>.");
    expect(container.querySelector("img")).toBeNull();
  });

  it("draws a prompt with variables and no markup as it did before the change", () => {
    const text = "Write about {{topic}} for {{audience}}.\nKeep it {{tone}}.";
    const variables = [{ name: "topic", description: "" }];
    const { container } = render(<PromptViewer block={block(text, variables)} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "cats" } });

    expect({ text: drawn(container).textContent, highlighted: highlighted(container) }).toMatchInlineSnapshot(`
      {
        "highlighted": [
          "{{audience}}",
          "{{tone}}",
        ],
        "text": "Write about cats for {{audience}}.
      Keep it {{tone}}.",
      }
    `);
    expect(highlightStyles(renderToStaticMarkup(<PromptViewer block={block(text, variables)} />))).toMatchInlineSnapshot(`
      [
        {
          "style": "background:color-mix(in srgb, var(--evidence) 20%, transparent);color:var(--evidence);border-radius:3px;padding:1px 4px",
          "text": "{{topic}}",
        },
        {
          "style": "background:color-mix(in srgb, var(--evidence) 20%, transparent);color:var(--evidence);border-radius:3px;padding:1px 4px",
          "text": "{{audience}}",
        },
        {
          "style": "background:color-mix(in srgb, var(--evidence) 20%, transparent);color:var(--evidence);border-radius:3px;padding:1px 4px",
          "text": "{{tone}}",
        },
      ]
    `);
  });

  it("copies the filled text unchanged", () => {
    render(<PromptViewer block={block('Say {{word}} to <b>them</b> & "leave"', [{ name: "word", description: "" }])} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Say hi to <b>them</b> & "leave"');
  });
});

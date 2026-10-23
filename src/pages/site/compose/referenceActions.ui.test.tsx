// CA-19 P4: the picker's actions on a whole composer (the "References" dev page, which runs the composer's own history and
// actions on memory): Done as one step, Make a group from "Also used by", Find words, Select words in the post, and a
// member's group state.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import ReferencesDemo from "@/pages/dev/ReferencesDemo";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined })) as never;
});
afterEach(cleanup);

function mount() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={["/dev/kit/pages/sandbox?build=references"]}>
          <ReferencesDemo fit="content" viewport="desktop" />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const colourButton = (name: RegExp) => screen.getAllByRole("button", { name })[0];
const notice = () => screen.getByTestId("reference-notice").textContent ?? "";

describe("the picker's actions", () => {
  it("colours a component as one step, and Undo puts it back", async () => {
    mount();
    fireEvent.click(colourButton(/^Colour for Manual step 2: #7FA7D9/));
    fireEvent.click(screen.getByRole("button", { name: "#C9A86B" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(colourButton(/^Colour for Manual step 2:/).getAttribute("aria-label")).toBe("Colour for Manual step 2: #C9A86B"));
    expect(notice()).toContain("Coloured Manual step 2 #C9A86B");
    fireEvent.click(screen.getByTestId("notice-undo"));
    await waitFor(() => expect(colourButton(/^Colour for Manual step 2:/).getAttribute("aria-label")).toBe("Colour for Manual step 2: #7FA7D9"));
  });

  it("makes a group of the two that share a colour, from the Also used by line", async () => {
    mount();
    fireEvent.click(colourButton(/^Colour for Manual step 6/));
    expect(screen.getByTestId("also-used-by").textContent).toContain("Also used by Manual step 2");
    fireEvent.click(within(screen.getByTestId("also-used-by")).getByRole("button", { name: "Make a group" }));
    expect(notice()).toContain("Made a group of Manual step 6 and Manual step 2");
    // The picker now shows the component in its group.
    await waitFor(() => expect(screen.getByTestId("colour-picker").getAttribute("data-state")).toBe("group"));
    expect(screen.getByTestId("picker-in-group").textContent).toBe("No name · 2 components");
  });

  it("links words found in the post to the component", async () => {
    mount();
    fireEvent.click(colourButton(/^Colour for Manual step 6/));
    const panel = screen.getByTestId("picker-linked");
    expect(panel.textContent).toContain("0 of 1");
    fireEvent.change(within(panel).getByRole("textbox", { name: "Find words in the post" }), { target: { value: "screens" } });
    fireEvent.click(within(panel).getByRole("button", { name: /screens/ }));
    expect(notice()).toContain('Linked "screens" to Manual step 6');
    await waitFor(() => expect(screen.getByTestId("picker-linked").textContent).toContain("1 of 1"));
  });

  it("asks for words in the post with a bar, which Cancel ends", () => {
    mount();
    fireEvent.click(colourButton(/^Colour for Manual step 6/));
    fireEvent.click(screen.getByRole("button", { name: "Select words in the post instead" }));
    expect(screen.queryByTestId("colour-picker")).toBeNull();
    expect(screen.getByTestId("select-words-bar").textContent).toContain("Select words to link to Manual step 6");
    fireEvent.click(within(screen.getByTestId("select-words-bar")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("select-words-bar")).toBeNull();
  });

  it("opens a member in its group state, and Remove from group is one step", async () => {
    mount();
    fireEvent.click(colourButton(/^Colour for Code 4/));
    expect(screen.getByTestId("picker-in-group").textContent).toBe("Login flow · 3 components");
    act(() => void fireEvent.click(screen.getByRole("button", { name: "Remove from group" })));
    expect(notice()).toContain("Removed Code 4 from Login flow");
    // Uncoloured, its colour button waits for the pointer, as every uncoloured tile's does.
    await waitFor(() => expect(screen.queryAllByRole("button", { name: /^Colour for Code 4: #/ })).toHaveLength(0));
  });
});

// Tier-3 acceptance for /import.
//
// THE CLAIM WORTH TESTING is not that the page renders — it is that the button
// labelled "Copy the Extractor" puts the EXACT bytes of the served document on
// the clipboard. A page that copies a truncated, re-encoded or stale version of
// the Extractor fails silently: the person pastes it into their chat, the
// chatbot follows a damaged instruction, and what comes back does not parse.
// Nothing on screen would say so. So the assertion compares the clipboard
// against the fetched body character for character.
//
// The Compiler is asserted through the fold rather than around it, because the
// fold is what defers its fetch — opening it is the thing that makes the
// document available to copy at all.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImportPage from "./ImportPage";

const EXTRACTOR_BODY = "# NeoScale Build File — Extractor v1\n\nRules — these are strict\n";
const COMPILER_BODY = "# NeoScale Build File — Compiler v1\n\nEach source file becomes one PHASE.\n";

let written: string[] = [];

function serve(url: string): string | null {
  if (url.endsWith("/buildfile/NEOSCALE_EXTRACTOR.md")) return EXTRACTOR_BODY;
  if (url.endsWith("/buildfile/NEOSCALE_COMPILER.md")) return COMPILER_BODY;
  return null;
}

beforeEach(() => {
  written = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const body = serve(String(input));
      return Promise.resolve({
        ok: body !== null,
        status: body === null ? 404 : 200,
        text: () => Promise.resolve(body ?? ""),
      } as Response);
    })
  );

  // jsdom has no clipboard. Record what the page asks it to write.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (value: string) => {
        written.push(value);
        return Promise.resolve();
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/import"]}>
        <ImportPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe("/import", () => {
  it("leads with the promise and the three steps", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Post a build without writing it up." })
    ).toBeInTheDocument();

    for (const step of ["Copy the Extractor", "Save what it gives you", "Drop it here"]) {
      expect(screen.getByRole("heading", { level: 2, name: step })).toBeInTheDocument();
    }
  });

  it("copies the extractor document exactly as served", async () => {
    renderPage();

    // The document is prefetched on mount; the click must not depend on it.
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId("copy-extractor"));

    await waitFor(() => expect(written).toEqual([EXTRACTOR_BODY]));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("offers the extractor as a downloadable .md", () => {
    renderPage();

    const link = screen.getByTestId("download-extractor");
    expect(link).toHaveAttribute("href", "/buildfile/NEOSCALE_EXTRACTOR.md");
    expect(link).toHaveAttribute("download", "NEOSCALE_EXTRACTOR.md");
  });

  it("shows the drop target as a placeholder, not a live target", () => {
    renderPage();

    const placeholder = screen.getByTestId("import-drop-placeholder");
    expect(placeholder).toHaveTextContent("Drag your Build File anywhere on this page");
    expect(placeholder).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the compiler folded until it is asked for, then copies it exactly", async () => {
    renderPage();

    expect(screen.queryByTestId("copy-compiler")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Built across more than one AI\?/ }));

    expect(
      screen.getByText(
        "Paste the Compiler plus every Build File into one chat; it merges them into one."
      )
    ).toBeInTheDocument();

    fireEvent.click(await screen.findByTestId("copy-compiler"));
    await waitFor(() => expect(written).toEqual([COMPILER_BODY]));
  });
});

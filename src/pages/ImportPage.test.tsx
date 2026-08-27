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
//
// NS-P34 ADDS THE DROP. The claims worth testing there are the three that fail
// silently or expensively: that a valid extractor file reaches a review naming
// what it found, that a key which travelled in the file is SHOWN rather than
// stripped, and that a file this code cannot read is refused in words a person
// can act on. The write itself is stubbed — what happens in Postgres is
// NS-P35's e2e territory, and asserting it here would only test the stub.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldDef, NodeType } from "@/lib/build/types";

// --- what the page reaches for once a file lands ------------------------------
//
// The registry is stubbed to four types rather than fetched: the parse under
// test is "does this file become a proposal", not "does Supabase answer".

function nodeType(key: string, fields: FieldDef[]): NodeType {
  return {
    key,
    label: key,
    category: "instruction",
    colour: "#E8571A",
    icon: "Square",
    renderer: "default",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: { fields },
  } as NodeType;
}

const REGISTRY: NodeType[] = [
  nodeType("prompt", [{ key: "text", label: "Prompt text", type: "text", required: true }]),
  nodeType("code", [{ key: "source", label: "Source", type: "text", required: true }]),
  nodeType("model_params", [{ key: "model", label: "Model", type: "string", required: true }]),
  nodeType("note", [{ key: "body", label: "Note", type: "text", required: true }]),
];

vi.mock("@/lib/build/nodeTypes", () => ({
  getNodeTypes: () => Promise.resolve(REGISTRY),
}));

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

const importBuildFile = vi.fn();
vi.mock("@/lib/build/buildFileImport", () => ({
  importBuildFile: (...args: unknown[]) => importBuildFile(...args),
}));

/** Where a confirmed import sent the creator, and what it carried with them. */
const navigated: Array<{ to: string; state: { intake?: { tone?: string }; justArrived?: number } }> =
  [];
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => (to: string, options?: { state?: unknown }) => {
      navigated.push({ to, state: (options?.state ?? {}) as never });
    },
  };
});

import ImportPage from "./ImportPage";

// --- fixtures -----------------------------------------------------------------

/** Long enough to match the scanner's openai_key pattern. */
const PLANTED_KEY = "sk-abcdefghijklmnopqrstuvwx";

const ENVELOPE = {
  neoscale_build: 1,
  generated_by: "extractor-v1",
  exported_at: "2026-08-27T09:00:00.000Z",
  origin: { tool: "extractor-v1", session_hint: "Claude, 27 Aug" },
  build: {
    title: "Retrieval agent",
    outcome: "Answers questions over a private corpus",
    shape: "agent",
    made_with: ["Claude", "Supabase"],
  },
  nodes: [
    { path: "1", type: "prompt", title: "The system prompt", payload: { text: "Answer from the corpus only" } },
    { path: "1.1", type: "code", title: "The retriever", payload: { source: "const hits = await search(q)" } },
  ],
  events: [
    { ordinal: 1, kind: "prompt", payload: { text: "Asked for a summary" } },
    { ordinal: 2, kind: "milestone", payload: { text: "First good answer" } },
  ],
};

function fileOf(body: string, name = "NEOSCALE_BUILD.json"): File {
  return new File([body], name, { type: "application/json" });
}

function extractorFile({ withSecret = false } = {}): File {
  const envelope = withSecret
    ? {
        ...ENVELOPE,
        nodes: [
          ENVELOPE.nodes[0],
          {
            ...ENVELOPE.nodes[1],
            payload: { source: `const client = new OpenAI({ apiKey: "${PLANTED_KEY}" })` },
          },
        ],
      }
    : ENVELOPE;
  return fileOf(JSON.stringify(envelope, null, 2));
}

/**
 * A file let go of over the page.
 *
 * Dispatched at document.body rather than at the dashed rectangle: the claim is
 * that the WHOLE page is the drop surface, and targeting the rectangle would
 * pass even if that were not true.
 */
async function drop(file: File) {
  fireEvent.drop(document.body, { dataTransfer: { files: [file], types: ["Files"] } });
  // The read and the parse are async; the assertions that follow use findBy*.
  await Promise.resolve();
}

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
  importBuildFile.mockReset();
  navigated.length = 0;
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

  it("shows the drop target as a live target", () => {
    renderPage();

    const target = screen.getByTestId("import-drop");
    expect(target).toHaveTextContent("Drag your Build File anywhere on this page");
    expect(target).not.toHaveAttribute("aria-disabled");
    expect(target).toBeEnabled();
  });

  it("reviews a valid extractor file, naming where it came from and what it holds", async () => {
    renderPage();

    await drop(extractorFile());

    const review = await screen.findByTestId("import-review");
    expect(review).toBeInTheDocument();
    // Two nodes and two events, from the tool the file names.
    expect(screen.getByTestId("import-source-line")).toHaveTextContent(
      "From extractor-v1, 2 parts and 2 steps"
    );
    expect(screen.getByText("Retrieval agent")).toBeInTheDocument();
    expect(screen.getByTestId("import-confirm")).toBeInTheDocument();
  });

  it("shows a key that travelled in the file, and imports it anyway", async () => {
    renderPage();

    await drop(extractorFile({ withSecret: true }));

    const banner = await screen.findByTestId("import-secrets-banner");
    expect(banner).toHaveTextContent("Looks like a key or password travelled in this file");
    // Masked in the banner, but the import is not blocked and nothing is edited.
    expect(banner).not.toHaveTextContent(PLANTED_KEY);
    expect(screen.getByTestId("import-confirm")).toBeEnabled();
  });

  it("refuses a version it cannot read, in words rather than a code", async () => {
    renderPage();

    await drop(fileOf(JSON.stringify({ ...ENVELOPE, neoscale_build: 2 })));

    const refusal = await screen.findByTestId("import-error");
    expect(refusal).toHaveTextContent(
      "This file says it's version 2 — this site reads version 1"
    );
    expect(screen.getByTestId("import-error-extractor")).toBeInTheDocument();
  });

  it("refuses something that is not a Build File at all", async () => {
    renderPage();

    await drop(fileOf("just some notes I made in a text file"));

    expect(await screen.findByTestId("import-error")).toHaveTextContent(
      "This doesn't look like a Build File — is it the file the AI gave you?"
    );
  });

  it("writes nothing until the creator confirms, then hands over the build", async () => {
    importBuildFile.mockResolvedValue({
      buildId: "build-1",
      counts: { events: 2, nodes: 2, titleApplied: true, outcomeApplied: true, alreadyMaterialised: false },
      placement: { placed: 2, leftInTray: 0 },
    });

    renderPage();
    await drop(extractorFile());
    await screen.findByTestId("import-review");

    // Nothing has been written by merely looking at the proposal.
    expect(importBuildFile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("import-confirm"));

    await waitFor(() => expect(importBuildFile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(navigated).toHaveLength(1));
    expect(navigated[0].to).toBe("/compose/build-1");
    expect(navigated[0].state.justArrived).toBe(2);
    expect(navigated[0].state.intake.tone).toBe("settled");
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

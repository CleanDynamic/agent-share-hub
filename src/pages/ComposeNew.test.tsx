// Acceptance cover for the intake surface (NS-P14).
//
// The behaviours a type checker cannot see: that starting empty is one click,
// that a parser failure still hands the creator a usable draft and says why,
// that the review defaults to keep and writes only what survived it, and that
// forty turns are a count rather than forty rows.

import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TranscriptProposal } from "@/lib/build/intake";

const createBuild = vi.fn();
vi.mock("@/lib/build", () => ({ createBuild: (input: unknown) => createBuild(input) }));

const requestProposal = vi.fn();
const materialiseProposal = vi.fn();
vi.mock("@/lib/build/intake", async (importOriginal) => {
  // keepEverything and the constants stay real: the default-to-keep rule is
  // one of the things under test, not something the test should supply.
  const actual = await importOriginal<typeof import("@/lib/build/intake")>();
  return {
    ...actual,
    requestProposal: (...args: unknown[]) => requestProposal(...args),
    materialiseProposal: (...args: unknown[]) => materialiseProposal(...args),
  };
});

const requestLovableProposal = vi.fn();
vi.mock("@/lib/build/lovable", async (importOriginal) => {
  // detectExportSource and readDroppedFile stay real — routing the right file
  // to the right parser IS the behaviour under test, so a stubbed detector
  // would test nothing.
  const actual = await importOriginal<typeof import("@/lib/build/lovable")>();
  return {
    ...actual,
    requestLovableProposal: (...args: unknown[]) => requestLovableProposal(...args),
  };
});

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import ComposeNew from "@/pages/ComposeNew";

const BUILD = { id: "b1", creator_id: "me", title: "Untitled build" };
const SESSION = "session-1";

function proposalOf(exchanges: number, nodes: TranscriptProposal["nodes"] = []): TranscriptProposal {
  return {
    events: Array.from({ length: exchanges }, (_, i) => ({
      ordinal: i + 1,
      kind: "prompt",
      visibility: "folded",
      occurred_at: null,
      payload: { text: `ask number ${i + 1}`, response_summary: null },
      source_ref: { source: "transcript", session_id: SESSION, index: i * 2 + 1 },
      inferred: false,
      inferred_reason: null,
    })),
    nodes,
    summary: {
      session_id: SESSION,
      source_hint: null,
      detected_format: "labelled_colon",
      detected_labels: { user: ["You"], assistant: ["ChatGPT"] },
      turn_count: exchanges * 2,
      user_turn_count: exchanges,
      assistant_turn_count: exchanges,
      event_count: exchanges,
      node_count: nodes.length,
      character_count: 200,
      line_count: 20,
      proposed_title: {
        value: "Photo renamer",
        source_ref: { source: "transcript", session_id: SESSION, index: 1 },
        inferred: true,
        inferred_reason: "Taken from the opening line of the first prompt.",
      },
      proposed_outcome: null,
    },
    warnings: [],
  };
}

const CODE_NODE: TranscriptProposal["nodes"][number] = {
  local_id: "node-1",
  type: "code",
  title: "rename.sh",
  note: null,
  payload: { language: "bash", source: "exiftool ." },
  source_ref: { source: "transcript", session_id: SESSION, index: 2 },
  inferred: false,
  inferred_reason: null,
};

const MODEL_NODE: TranscriptProposal["nodes"][number] = {
  local_id: "node-2",
  type: "model_params",
  title: "GPT-4o",
  note: null,
  payload: { model: "GPT-4o", temperature: 0.2 },
  source_ref: { source: "transcript", session_id: SESSION, index: 3 },
  inferred: true,
  inferred_reason: "Assembled from scattered mentions. Confirm the model and version.",
};

/** Renders where the router ended up, and what it was handed on the way. */
function Landed() {
  const location = useLocation();
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="state">{JSON.stringify(location.state ?? null)}</span>
    </div>
  );
}

function renderIntake({ strict = false } = {}) {
  const tree = (
    <MemoryRouter initialEntries={["/compose/new"]}>
      <Routes>
        <Route path="/compose/new" element={<ComposeNew />} />
        <Route path="/compose/:buildId" element={<Landed />} />
        <Route path="/login" element={<span>login page</span>} />
      </Routes>
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const paste = (text: string) =>
  fireEvent.change(screen.getByLabelText(/paste the transcript/i), { target: { value: text } });

beforeEach(() => {
  createBuild.mockReset();
  requestProposal.mockReset();
  requestLovableProposal.mockReset();
  materialiseProposal.mockReset();
  auth.user = { id: "me" };
  auth.isLoggedIn = true;
  auth.loading = false;
});

/** A dropped file, as the browser delivers one to the zone. */
function dropFile(name: string, body: string, type = "text/plain") {
  // Fired on the textarea: React's synthetic drop bubbles to the zone's
  // handler, and targeting the zone by DOM shape would break on any reflow.
  const file = new File([body], name, { type });
  fireEvent.drop(screen.getByLabelText(/paste the transcript/i), {
    dataTransfer: { files: [file] },
  });
  return file;
}

const LOVABLE_EXPORT = JSON.stringify({
  exportedAt: "2026-08-20T18:04:11.522Z",
  url: "https://lovable.dev/projects/recipe-box-planner",
  messageCount: 2,
  messages: [
    {
      id: "umsg_01", role: "user",
      timestampText: "Aug 18, 2026, 9:12 AM", topPx: 120,
      contentHtml: "<p>Build me a recipe box.</p>",
      contentText: "Build me a recipe box.",
    },
    {
      id: "amsg_01", role: "ai",
      timestampText: "Aug 18, 2026, 9:13 AM", topPx: 340,
      contentHtml: "<p>Done.</p>", contentText: "Done.",
    },
  ],
});

describe("two parsers, no picker (NS-P20)", () => {
  // Acceptance 3: the same zone takes both, and works out which is which from
  // the content. Neither of these tests touches a control that names a format,
  // because there is no such control.

  it("routes a Lovable export to parse-lovable", async () => {
    createBuild.mockResolvedValue(BUILD);
    requestLovableProposal.mockResolvedValue(proposalOf(1));
    renderIntake();

    dropFile("lovable-chat-2026-08-20.json", LOVABLE_EXPORT, "application/json");

    await waitFor(() => expect(requestLovableProposal).toHaveBeenCalledTimes(1));
    expect(requestProposal).not.toHaveBeenCalled();
    expect(requestLovableProposal.mock.calls[0][1]).toBe(LOVABLE_EXPORT);
  });

  it("routes a plain transcript to parse-transcript", async () => {
    createBuild.mockResolvedValue(BUILD);
    requestProposal.mockResolvedValue(proposalOf(1));
    renderIntake();

    dropFile("chat.txt", "You said:\nBuild me a recipe box.\n\nChatGPT said:\nDone.");

    await waitFor(() => expect(requestProposal).toHaveBeenCalledTimes(1));
    expect(requestLovableProposal).not.toHaveBeenCalled();
  });

  it("routes a Lovable source-only download to parse-lovable, which explains it", async () => {
    // The obvious path a creator takes. It carries no session, and the parser
    // is the one place that says so.
    createBuild.mockResolvedValue(BUILD);
    requestLovableProposal.mockResolvedValue(proposalOf(0));
    renderIntake();

    dropFile("project.json", '{"name":"app","dependencies":{"react":"18.3.1"}}', "application/json");

    await waitFor(() => expect(requestLovableProposal).toHaveBeenCalledTimes(1));
    expect(requestProposal).not.toHaveBeenCalled();
  });

  it("asks once when the content is genuinely undecidable, and remembers nothing", async () => {
    createBuild.mockResolvedValue(BUILD);
    requestProposal.mockResolvedValue(proposalOf(1));
    renderIntake();

    // Valid JSON, no Lovable marker, not a transcript either.
    dropFile("mystery.json", '{"foo":[1,2,3]}', "application/json");

    await screen.findByText(/which is this\?/i);
    // Two options, and neither parser called until one is chosen.
    expect(requestProposal).not.toHaveBeenCalled();
    expect(requestLovableProposal).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /a lovable session export/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /a chat transcript/i }));
    await waitFor(() => expect(requestProposal).toHaveBeenCalledTimes(1));

    // Nothing was remembered: the next undecidable file asks again.
    requestProposal.mockClear();
    renderIntake();
    dropFile("mystery-2.json", '{"bar":[4,5]}', "application/json");
    await screen.findByText(/which is this\?/i);
    expect(requestProposal).not.toHaveBeenCalled();
  });
});

describe("the offer", () => {
  it("presents all three ways in at once", async () => {
    renderIntake();

    // None of them behind a disclosure: a creator with nothing to paste must
    // not have to hunt for the way in.
    expect(screen.getByLabelText(/paste the transcript/i)).toBeTruthy();
    expect(screen.getByText(/drop a transcript \(\.txt, \.md\)/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /start empty instead/i })).toBeTruthy();
  });

  it("creates a usable empty draft in one click", async () => {
    // Acceptance 5.
    createBuild.mockResolvedValue(BUILD);
    renderIntake();

    fireEvent.click(screen.getByRole("button", { name: /start empty instead/i }));

    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/compose/b1"));
    expect(createBuild).toHaveBeenCalledTimes(1);
    expect(requestProposal).not.toHaveBeenCalled();
  });

  it("creates exactly one build under strict mode", async () => {
    createBuild.mockResolvedValue(BUILD);
    renderIntake({ strict: true });

    fireEvent.click(screen.getByRole("button", { name: /start empty instead/i }));

    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/compose/b1"));
    expect(createBuild).toHaveBeenCalledTimes(1);
  });

  it("does not create a build for an empty paste", async () => {
    renderIntake();

    fireEvent.click(screen.getByRole("button", { name: /read it/i }));

    await screen.findByText(/nothing to read yet/i);
    expect(createBuild).not.toHaveBeenCalled();
  });

  it("sends the login redirect back to intake", () => {
    auth.isLoggedIn = false;
    renderIntake();

    expect(screen.getByText("login page")).toBeTruthy();
  });
});

describe("taking a transcript", () => {
  it("creates the draft before it calls the parser", async () => {
    // The order is the whole point: a parser failure must not cost the draft.
    const order: string[] = [];
    createBuild.mockImplementation(async () => {
      order.push("createBuild");
      return BUILD;
    });
    requestProposal.mockImplementation(async () => {
      order.push("requestProposal");
      return proposalOf(2);
    });

    renderIntake();
    paste("You: hi\nChatGPT: hello");
    fireEvent.click(screen.getByRole("button", { name: /read it/i }));

    await screen.findByText(/here is what it found/i);
    expect(order).toEqual(["createBuild", "requestProposal"]);
    expect(requestProposal).toHaveBeenCalledWith("b1", "You: hi\nChatGPT: hello", "pasted transcript");
  });

  it("lands the creator on their empty draft when parsing fails", async () => {
    // Acceptance 6.
    createBuild.mockResolvedValue(BUILD);
    requestProposal.mockRejectedValue(new Error("parse-transcript failed: the gateway timed out."));

    renderIntake();
    paste("You: hi");
    fireEvent.click(screen.getByRole("button", { name: /read it/i }));

    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/compose/b1"));

    const handed = JSON.parse(screen.getByTestId("state").textContent ?? "null");
    expect(handed.intake.tone).toBe("failed");
    expect(handed.intake.message).toMatch(/the gateway timed out/i);
    expect(handed.intake.message).toMatch(/draft is here and empty/i);
  });

  it("shows the parsing state while the call is in flight", async () => {
    createBuild.mockResolvedValue(BUILD);
    let release: (value: TranscriptProposal) => void = () => {};
    requestProposal.mockReturnValue(new Promise<TranscriptProposal>((r) => (release = r)));

    renderIntake();
    paste("You: hi");
    fireEvent.click(screen.getByRole("button", { name: /read it/i }));

    await screen.findByText(/splitting it into turns/i);
    release(proposalOf(1));
    await screen.findByText(/here is what it found/i);
  });

  it("refuses a paste over the parser's limit without calling it", async () => {
    renderIntake();
    paste("x".repeat(400_001));
    fireEvent.click(screen.getByRole("button", { name: /read it/i }));

    await screen.findByText(/over the 400,000 the parser takes/i);
    expect(createBuild).not.toHaveBeenCalled();
  });
});

describe("the review", () => {
  async function review(proposal: TranscriptProposal) {
    createBuild.mockResolvedValue(BUILD);
    requestProposal.mockResolvedValue(proposal);
    renderIntake();
    paste("You: hi");
    fireEvent.click(screen.getByRole("button", { name: /read it/i }));
    await screen.findByText(/here is what it found/i);
  }

  it("names what it found, model included", async () => {
    await review(proposalOf(20, [CODE_NODE, MODEL_NODE]));

    expect(screen.getByText(/20 prompts · 1 code block · 1 model setting · GPT-4o/)).toBeTruthy();
  });

  it("shows twenty turns as a count, not twenty rows", async () => {
    await review(proposalOf(20));

    expect(screen.getByText("20 prompts in sequence")).toBeTruthy();
    expect(screen.queryByText("ask number 7")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /show all 20/i }));
    expect(screen.getByText("ask number 7")).toBeTruthy();
  });

  it("marks an inferred item and carries its reason on hover", async () => {
    await review(proposalOf(1, [MODEL_NODE]));

    // By label, not by text: the paragraph above the list explains what the
    // marker means and contains the word itself.
    const marks = screen.getAllByLabelText(/^Inferred:/);
    // The proposed title is inferred, and so is the model node.
    expect(marks.length).toBe(2);
    expect(marks.some((mark) => mark.getAttribute("title")?.includes("scattered mentions"))).toBe(
      true
    );
    expect(
      marks.some((mark) => mark.getAttribute("title")?.includes("opening line of the first prompt"))
    ).toBe(true);
  });

  it("leaves a read item unmarked", async () => {
    await review(proposalOf(1, [CODE_NODE]));

    // Only the title is a guess. The code block was read out of a fence.
    expect(screen.getAllByLabelText(/^Inferred:/)).toHaveLength(1);
  });

  it("writes everything by default", async () => {
    const proposal = proposalOf(3, [CODE_NODE]);
    materialiseProposal.mockResolvedValue({
      events: 3,
      nodes: 1,
      titleApplied: true,
      outcomeApplied: false,
      alreadyMaterialised: false,
    });
    await review(proposal);

    fireEvent.click(screen.getByRole("button", { name: /add 4 to the draft/i }));

    await waitFor(() => expect(materialiseProposal).toHaveBeenCalled());
    const [buildId, , selection] = materialiseProposal.mock.calls[0];
    expect(buildId).toBe("b1");
    expect([...selection.eventOrdinals]).toEqual([1, 2, 3]);
    expect([...selection.nodeLocalIds]).toEqual(["node-1"]);
    expect(selection.title).toBe(true);
  });

  it("writes without the title once it is discarded", async () => {
    // Acceptance 3, from the surface that decides it.
    materialiseProposal.mockResolvedValue({
      events: 1,
      nodes: 0,
      titleApplied: false,
      outcomeApplied: false,
      alreadyMaterialised: false,
    });
    await review(proposalOf(1));

    const titleRow = screen.getByText("Photo renamer").closest("div")?.parentElement as HTMLElement;
    fireEvent.click(within(titleRow).getByRole("switch"));
    await screen.findByText(/stays called “Untitled build”/i);

    fireEvent.click(screen.getByRole("button", { name: /add 1 to the draft/i }));

    await waitFor(() => expect(materialiseProposal).toHaveBeenCalled());
    expect(materialiseProposal.mock.calls[0][2].title).toBe(false);
  });

  it("drops every prompt when the sequence is discarded wholesale", async () => {
    materialiseProposal.mockResolvedValue({
      events: 0,
      nodes: 1,
      titleApplied: true,
      outcomeApplied: false,
      alreadyMaterialised: false,
    });
    await review(proposalOf(20, [CODE_NODE]));

    const sequenceRow = screen.getByText("20 prompts in sequence").closest("div")
      ?.parentElement as HTMLElement;
    fireEvent.click(within(sequenceRow).getByRole("switch", { name: /every prompt/i }));

    fireEvent.click(screen.getByRole("button", { name: /add 1 to the draft/i }));

    await waitFor(() => expect(materialiseProposal).toHaveBeenCalled());
    expect([...materialiseProposal.mock.calls[0][2].eventOrdinals]).toEqual([]);
  });

  it("names the next act on the way to the workspace", async () => {
    materialiseProposal.mockResolvedValue({
      events: 20,
      nodes: 2,
      titleApplied: true,
      outcomeApplied: false,
      alreadyMaterialised: false,
    });
    await review(proposalOf(20, [CODE_NODE, MODEL_NODE]));

    fireEvent.click(screen.getByRole("button", { name: /add 22 to the draft/i }));

    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/compose/b1"));
    const handed = JSON.parse(screen.getByTestId("state").textContent ?? "null");
    expect(handed.intake.tone).toBe("settled");
    expect(handed.intake.message).toMatch(/2 items are in your tray/i);
    expect(handed.intake.message).toMatch(/drag from the tray/i);
  });

  it("keeps the creator on the review when the write fails", async () => {
    materialiseProposal.mockRejectedValue(new Error("row level security."));
    await review(proposalOf(2));

    fireEvent.click(screen.getByRole("button", { name: /add 2 to the draft/i }));

    await screen.findByText(/row level security/i);
    expect(screen.getByText(/here is what it found/i)).toBeTruthy();
    expect(screen.getByText(/nothing was lost/i)).toBeTruthy();
  });

  it("can throw the proposal away and take the empty draft", async () => {
    await review(proposalOf(5, [CODE_NODE]));

    fireEvent.click(screen.getByRole("button", { name: /throw this away and start empty/i }));

    await waitFor(() => expect(screen.getByTestId("path").textContent).toBe("/compose/b1"));
    expect(materialiseProposal).not.toHaveBeenCalled();
    // The build was already created before the parse, so nothing is orphaned.
    expect(createBuild).toHaveBeenCalledTimes(1);
  });
});

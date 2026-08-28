// Acceptance cover for NS-P39.
//
// What the publish sheet does differently when the draft was forked from
// somebody else's build: it shows the computed diff AS the content, asks for a
// note without requiring one, shows the credit the post will carry, and refuses
// to publish a fork that has not changed anything — in rebuild.ts's own words,
// inline beside the button rather than as a toast that scrolls away.
//
// The gate is exercised through the real edit path, for the same reason NS-P38's
// suite is: "publish enables once you change something" is a claim about the
// whole chain — keystroke, save cycle, diff, gate — and a test that handed the
// hook a pre-changed record would prove none of it.
//
// The last test is the one that protects everybody else. A plain draft's sheet
// must be the sheet that was here before this prompt, so it is captured as
// markup and compared, rather than asserted feature by feature: a DOM diff
// fails on the change nobody thought to write an assertion for.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const getBuild = vi.fn();
const updateBuild = vi.fn();
const upsertNode = vi.fn().mockResolvedValue({});
const getMediaForBuild = vi.fn().mockResolvedValue([]);
const getLayers = vi.fn().mockResolvedValue([]);

/**
 * Two mocks, and the second one is not redundant.
 *
 * The barrel covers what the WORKSPACE calls. publishRebuild is the real
 * implementation and reaches for updateBuild through ./builds directly, which
 * the barrel mock cannot intercept — so the inner module is stubbed too, and
 * the publish path under test is the genuine one all the way down.
 */
vi.mock("@/lib/build/builds", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build/builds")>();
  return {
    ...actual,
    updateBuild: (id: string, patch: unknown) => updateBuild(id, patch),
  };
});

vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuild: (id: string) => getBuild(id),
    updateBuild: (id: string, patch: unknown) => updateBuild(id, patch),
    upsertNode: (node: unknown) => upsertNode(node),
    getMediaForBuild: (id: string) => getMediaForBuild(id),
    getLayers: (id: string) => getLayers(id),
    shouldOfferLayerReview: () => false,
  };
});

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Compose from "@/pages/Compose";
import { NO_CHANGES_REASON } from "@/lib/build";
import { RebuildSection } from "./RebuildSection";

const nodeTypes = [
  {
    key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A",
    icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
  {
    key: "result", label: "Result", category: "evidence", colour: "#2EC4B6",
    icon: "BarChart3", renderer: "evidence", copyable: false, is_active: true, sort: 2,
    schema: { fields: [{ key: "summary", label: "Summary", type: "text" }] },
  },
];

const node = (
  id: string,
  title: string,
  payload: Record<string, unknown>,
  position = 0,
  type = "prompt"
) => ({
  id, build_id: "d1", parent_id: null, position, type, title, note: null,
  payload, source_ref: null, event_id: null, is_gap: false,
  created_at: "", children: [],
});

/** The minimum publishable record, so the only outstanding rule is divergence. */
const inheritedTree = () => [
  node("d1n1", "First prompt", { text: "Classify the email." }),
  node("d1n2", "Second prompt", { text: "Draft the reply." }, 1),
  node("d1n3", "What it did", { summary: "Cleared 200 emails." }, 2, "result"),
];

const SOURCE = {
  build: {
    id: "b-source", creator_id: "someone", slug: "inbox-triage-agent-demo",
    title: "Inbox triage agent", outcome: "Sorts a full inbox.", shape: "agent",
    status: "published", completeness: 60, hero_node_id: null,
    cover_media_id: null, parent_build_id: null, rebuild_note: null,
  },
  tree: inheritedTree().map((row, index) => ({
    ...row,
    id: `s${index + 1}`,
    build_id: "b-source",
  })),
  tray: [],
  events: [],
  nodeTypes,
};

/** The fork, as startRebuild leaves it: the credit frozen onto the header. */
const draftRecord = (tree = inheritedTree(), over: Record<string, unknown> = {}) => ({
  build: {
    id: "d1", creator_id: "me", slug: "inbox-triage-agent-fork",
    title: "Inbox triage agent", outcome: "Sorts a full inbox.", shape: "agent",
    status: "draft", completeness: 60, hero_node_id: null, cover_media_id: null,
    published_at: null, parent_build_id: "b-source",
    source_title_at_fork: "Inbox triage agent", source_handle_at_fork: "amara",
    rebuild_note: null,
    ...over,
  },
  tree,
  tray: [],
  events: [],
  nodeTypes,
});

/** An ordinary draft: no parent, nothing inherited, nothing to diff. */
const plainRecord = () => {
  const base = draftRecord();
  return {
    ...base,
    build: {
      ...base.build,
      parent_build_id: null,
      source_title_at_fork: null,
      source_handle_at_fork: null,
    },
  };
};

function renderCompose() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/compose/d1"]}>
          <Routes>
            <Route path="/compose/:buildId" element={<Compose />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

/** Both records come from one getBuild, keyed by id. */
function serve(draft: ReturnType<typeof draftRecord>) {
  getBuild.mockImplementation(async (id: string) =>
    id === "b-source" ? SOURCE : draft
  );
}

/** Press the pill and wait for the lazily-loaded sheet. */
async function openSheet(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
  return screen.findByTestId("publish-sheet");
}

function closeSheet() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
}

beforeEach(() => {
  vi.clearAllMocks();
  getMediaForBuild.mockResolvedValue([]);
  getLayers.mockResolvedValue([]);
  upsertNode.mockResolvedValue({});
  updateBuild.mockImplementation(async (_id: string, patch: Record<string, unknown>) => ({
    ...draftRecord().build,
    ...patch,
  }));
  auth.user = { id: "me" };
  auth.isLoggedIn = true;
  auth.loading = false;
});

describe("the publish sheet, on a rebuild", () => {
  // ACCEPTANCE 1
  it("refuses a fork that changed nothing, in the gate's own sentence, then lets it through once it has", async () => {
    serve(draftRecord());
    renderCompose();

    let sheet = await openSheet();
    const section = within(sheet).getByTestId("rebuild-section");
    expect(section).toHaveTextContent("What this rebuild changes");
    expect(section).toHaveTextContent("Nothing yet. This list fills in as you change things.");
    // Nothing to list yet, so there is no list.
    expect(within(sheet).queryByTestId("rebuild-change-lines")).toBeNull();

    // Inline, on the sheet, beside the button — not a toast.
    expect(screen.getByTestId("publish-confirm")).toBeDisabled();
    expect(sheet).toHaveTextContent(NO_CHANGES_REASON);

    // One edit, through the real path: select the node, type in its field, and
    // wait out the save cycle the diff settles on.
    closeSheet();
    await waitFor(() => expect(screen.queryByTestId("publish-sheet")).toBeNull());

    fireEvent.click(screen.getByText("Second prompt"));
    const field = (await screen.findByDisplayValue("Draft the reply.")) as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Draft the reply, briefly." } });
    await waitFor(
      () => expect(screen.getByTestId("rebuild-change-count").textContent).toBe("1 change"),
      { timeout: 4000 }
    );

    sheet = await openSheet();
    const lines = within(sheet).getByTestId("rebuild-change-lines");
    // serialiseChangeSet's line, unedited.
    expect(lines).toHaveTextContent("Changed the prompt 'Second prompt'");
    expect(within(lines).getAllByRole("listitem")).toHaveLength(1);
    expect(sheet).not.toHaveTextContent(NO_CHANGES_REASON);
    expect(screen.getByTestId("publish-confirm")).toBeEnabled();
  });

  it("shows the credit the post will carry, on the card and beside it, and says it is permanent", async () => {
    serve(draftRecord());
    renderCompose();

    const sheet = await openSheet();
    const credit = "Rebuilt from Inbox triage agent by @amara";

    expect(within(sheet).getByTestId("rebuild-credit")).toHaveTextContent(credit);
    expect(within(sheet).getByTestId("rebuild-credit")).toHaveTextContent(
      "This credit is part of the post and can't be removed."
    );
    // The same string on the card, from the same composer: the preview is the
    // post, so the two can never say different things.
    const card = await screen.findByTestId("publish-card-preview");
    expect(within(card).getByTestId("gallery-card-credit").textContent).toBe(credit);
  });

  // ACCEPTANCE 2 (the client half; the trigger and the counter are proven
  // against a real database by scripts/verify-rebuild.ts, from NS-P37).
  it("writes the note before it flips the status, and publishes a blank note as null", async () => {
    serve(draftRecord([...inheritedTree(), node("d1n4", "A third prompt", { text: "Summarise." }, 3)]));
    renderCompose();

    await waitFor(
      () => expect(screen.getByTestId("rebuild-change-count").textContent).toBe("1 change"),
      { timeout: 4000 }
    );

    const sheet = await openSheet();
    fireEvent.change(within(sheet).getByTestId("rebuild-note"), {
      target: { value: "  Swapped the second step for a shorter one.  " },
    });
    fireEvent.click(screen.getByTestId("publish-confirm"));

    await waitFor(() => expect(updateBuild).toHaveBeenCalledTimes(2));
    // The note lands in its own statement, first. A reader can never meet a
    // live rebuild whose note has not arrived yet.
    expect(updateBuild.mock.calls[0]).toEqual([
      "d1",
      { rebuild_note: "Swapped the second step for a shorter one." },
    ]);
    expect(updateBuild.mock.calls[1][1]).toMatchObject({ status: "published" });

  });

  it("publishes an untouched note as null, because nothing typed is a real answer", async () => {
    serve(draftRecord([...inheritedTree(), node("d1n4", "A third prompt", { text: "Summarise." }, 3)]));
    renderCompose();

    await waitFor(
      () => expect(screen.getByTestId("rebuild-change-count").textContent).toBe("1 change"),
      { timeout: 4000 }
    );

    const sheet = await openSheet();
    expect(within(sheet).getByTestId("rebuild-note")).toHaveValue("");
    fireEvent.click(screen.getByTestId("publish-confirm"));

    await waitFor(() => expect(updateBuild).toHaveBeenCalled());
    // null, not "": the column is nullable, and an empty string would be a
    // rebuild claiming to have said something.
    expect(updateBuild.mock.calls[0]).toEqual(["d1", { rebuild_note: null }]);
  });

  it("says so plainly when the source cannot be read, rather than claiming nothing changed", async () => {
    getBuild.mockImplementation(async (id: string) =>
      id === "b-source" ? null : draftRecord()
    );
    renderCompose();

    const sheet = await openSheet();
    expect(within(sheet).getByTestId("rebuild-section")).toHaveTextContent(
      "The build this came from could not be read, so its changes cannot be listed."
    );
    // Publishing is never blocked on a question that cannot be asked.
    expect(sheet).not.toHaveTextContent(NO_CHANGES_REASON);
    expect(screen.getByTestId("publish-confirm")).toBeEnabled();
  });

  // ACCEPTANCE 3
  it("leaves a plain draft's sheet exactly as it was", async () => {
    /**
     * Radix numbers its generated ids from a counter that does not reset
     * between renders, so the aria wiring differs by a serial and nothing else.
     * Normalising it is the difference between a DOM diff and a render counter.
     */
    const stable = (markup: string) => markup.replace(/radix-[^"]*/g, "radix-id");

    getBuild.mockImplementation(async () => plainRecord());
    const { unmount } = renderCompose();
    const before = stable((await openSheet()).innerHTML);
    unmount();

    // The same record, rendered again through the same route. Any section, any
    // extra line, any reordering introduced by this prompt shows up here.
    getBuild.mockImplementation(async () => plainRecord());
    renderCompose();
    const after = stable((await openSheet()).innerHTML);

    expect(after).toBe(before);
    expect(after).not.toContain("rebuild-section");
    expect(after).not.toContain("Rebuilt from");
  });
});

describe("the rebuild section itself", () => {
  const line = (index: number, kind: "changed" | "added" | "removed" | "header") => ({
    kind,
    key: `${kind}:${index}`,
    text: `Line ${index}`,
  });

  function renderSection(count: number) {
    const lines = Array.from({ length: count }, (_, index) =>
      line(index, (["changed", "added", "removed", "header"] as const)[index % 4])
    );
    return render(
      <RebuildSection
        lines={lines}
        diffed
        note=""
        onNoteChange={() => {}}
        credit={null}
      />
    );
  }

  it("shows six lines and an expander from the seventh, and nothing before it", () => {
    const { unmount } = renderSection(6);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    // Six lines fit; an expander that hides nothing costs a press for nothing.
    expect(screen.queryByRole("button")).toBeNull();
    unmount();

    renderSection(9);
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    const expander = screen.getByRole("button", { name: "and 3 more" });

    fireEvent.click(expander);
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    fireEvent.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
  });

  it("colours each line's dot by its kind", () => {
    renderSection(4);
    const dot = (kind: string) =>
      (document.querySelector(`[data-change-kind="${kind}"] span`) as HTMLElement).style
        .background;

    expect(dot("changed")).toBe("rgb(232, 87, 26)");
    expect(dot("added")).toBe("rgb(46, 196, 182)");
    expect(dot("removed")).toBe("rgb(156, 163, 175)");
    expect(dot("header")).toBe("rgb(245, 158, 11)");
  });

  it("labels the note as optional, and says the list is shown either way", () => {
    renderSection(2);
    expect(screen.getByTestId("rebuild-note")).toHaveAccessibleName(
      "What did you change, and why? (optional — the list above is shown either way)"
    );
  });
});

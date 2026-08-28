// Acceptance cover for NS-P38's compose side.
//
// What the workspace does differently when the draft it holds was forked from
// somebody else's build: it says whose, it marks what the creator has touched
// against what they inherited, and it keeps a running count of the difference.
//
// The debounce is tested through the real edit path — select a node, type in
// its field — because "within one save cycle" is the behaviour, and a test that
// handed the hook a pre-changed record would prove the diff and not the cadence.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const getBuild = vi.fn();
const updateBuild = vi.fn();
const upsertNode = vi.fn().mockResolvedValue({});
const getMediaForBuild = vi.fn().mockResolvedValue([]);

/** The write paths are stubbed; changeSet, matchNodes and serialiseChangeSet
 *  are the real ones — the diff is the thing under test. */
vi.mock("@/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/build")>();
  return {
    ...actual,
    getBuild: (id: string) => getBuild(id),
    updateBuild: (id: string, patch: unknown) => updateBuild(id, patch),
    upsertNode: (node: unknown) => upsertNode(node),
    getMediaForBuild: (id: string) => getMediaForBuild(id),
  };
});

const auth = { user: { id: "me" }, isLoggedIn: true, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));

import Compose from "@/pages/Compose";

const nodeTypes = [
  {
    key: "prompt",
    label: "Prompt",
    category: "instruction",
    colour: "#E8571A",
    icon: "MessageSquare",
    renderer: "prompt",
    copyable: true,
    is_active: true,
    sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
];

const node = (id: string, title: string, text: string, position = 0) => ({
  id,
  build_id: "d1",
  parent_id: null,
  position,
  type: "prompt",
  title,
  note: null,
  payload: { text },
  source_ref: null,
  event_id: null,
  is_gap: false,
  created_at: "",
  children: [],
});

const SOURCE = {
  build: {
    id: "b-source",
    creator_id: "someone",
    slug: "inbox-triage-agent-demo",
    title: "Inbox triage agent",
    outcome: "Sorts a full inbox.",
    shape: "agent",
    status: "published",
    completeness: 40,
    hero_node_id: null,
    cover_media_id: null,
    parent_build_id: null,
  },
  tree: [
    { ...node("s1", "First prompt", "Classify the email."), build_id: "b-source" },
    { ...node("s2", "Second prompt", "Draft the reply.", 1), build_id: "b-source" },
  ],
  tray: [],
  events: [],
  nodeTypes,
};

/** The fork, as startRebuild leaves it: same title, same outcome, the nodes
 *  copied with fresh ids, and the credit frozen onto the header. */
const draftRecord = (tree = [node("d1n1", "First prompt", "Classify the email."), node("d1n2", "Second prompt", "Draft the reply.", 1)]) => ({
  build: {
    id: "d1",
    creator_id: "me",
    slug: "inbox-triage-agent-fork",
    title: "Inbox triage agent",
    outcome: "Sorts a full inbox.",
    shape: "agent",
    status: "draft",
    completeness: 40,
    hero_node_id: null,
    cover_media_id: null,
    parent_build_id: "b-source",
    source_title_at_fork: "Inbox triage agent",
    source_handle_at_fork: "amara",
  },
  tree,
  tray: [],
  events: [],
  nodeTypes,
});

/** An ordinary draft: no parent, nothing inherited, nothing to diff. */
const plainRecord = () => {
  const record = draftRecord();
  return {
    ...record,
    build: {
      ...record.build,
      parent_build_id: null,
      source_title_at_fork: null,
      source_handle_at_fork: null,
    },
  };
};

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/compose/:buildId" element={<Compose />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

/** The tree row for a node, which carries both the accent and the treatment. */
function row(container: HTMLElement, id: string): HTMLElement {
  return container.querySelector(`[data-node-id="${id}"]`) as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  getMediaForBuild.mockResolvedValue([]);
  upsertNode.mockResolvedValue({});
  updateBuild.mockImplementation(async (id: string, patch: Record<string, unknown>) => ({
    ...draftRecord().build,
    ...patch,
  }));
  auth.user = { id: "me" };
  auth.isLoggedIn = true;
  auth.loading = false;
});

/** Both records come from one getBuild, keyed by id: the workspace asks for the
 *  draft, the diff asks for its parent. */
function serve(draft: ReturnType<typeof draftRecord>) {
  getBuild.mockImplementation(async (id: string) =>
    id === "b-source" ? SOURCE : draft
  );
}

describe("compose, on a rebuild", () => {
  it("credits the source, marks every node inherited, and counts nothing yet", async () => {
    serve(draftRecord());
    const { container } = renderAt("/compose/d1?from=rebuild");

    const strip = await screen.findByTestId("rebuild-origin-strip");
    expect(strip.textContent).toBe("Rebuilding from Inbox triage agent by @amara");
    // The name is frozen onto the draft and renders at once; the link is the
    // one live part and arrives with the source.
    await waitFor(() =>
      expect(within(strip).getByRole("link").getAttribute("href")).toBe(
        "/b2/inbox-triage-agent-demo"
      )
    );

    await waitFor(() =>
      expect(row(container, "d1n1").getAttribute("data-rebuild")).toBe("inherited")
    );
    expect(row(container, "d1n2").getAttribute("data-rebuild")).toBe("inherited");
    // Quiet grey on what the creator arrived with. The first row is the one
    // ?from=rebuild selected, and the selected accent still wins over it.
    expect(row(container, "d1n2").style.borderLeft).toBe("2px solid rgba(255,255,255,0.18)");
    expect(screen.queryAllByTestId("rebuild-node-pill")).toHaveLength(0);

    expect(screen.getByTestId("rebuild-change-count").textContent).toBe("no changes yet");
  });

  it("opens on the first inherited node rather than on an empty tray", async () => {
    serve(draftRecord());
    const { container } = renderAt("/compose/d1?from=rebuild");

    await waitFor(() =>
      expect(row(container, "d1n1").parentElement?.getAttribute("aria-selected")).toBe("true")
    );
    // The inspector is open on it, so the first thing in reach is the work.
    expect(await screen.findByDisplayValue("Classify the email.")).toBeTruthy();
    expect(screen.queryByTestId("tray-arrival")).toBeNull();
  });

  it("flips a node to changed within one save cycle, and counts it", async () => {
    serve(draftRecord());
    const { container } = renderAt("/compose/d1?from=rebuild");

    await waitFor(() =>
      expect(row(container, "d1n2").getAttribute("data-rebuild")).toBe("inherited")
    );

    fireEvent.click(screen.getByText("Second prompt"));
    const field = (await screen.findByDisplayValue("Draft the reply.")) as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Draft the reply, briefly." } });

    // Nothing on the keystroke: the diff settles on the save cycle, not on the
    // key. It arrives without a second edit, which is what makes it debounced
    // rather than merely late.
    await waitFor(
      () => expect(row(container, "d1n2").getAttribute("data-rebuild")).toBe("changed"),
      { timeout: 4000 }
    );
    expect(within(row(container, "d1n2")).getByTestId("rebuild-node-pill").textContent).toBe(
      "changed"
    );
    expect(screen.getByTestId("rebuild-change-count").textContent).toBe("1 change");

    // Selection still outranks the diff: the row being edited is the row the
    // creator needs to find, and the pill carries the other fact meanwhile.
    expect(row(container, "d1n2").style.borderLeft).toBe("2px solid #E8571A");

    fireEvent.click(screen.getByText("First prompt"));
    expect(row(container, "d1n2").style.borderLeft).toBe("2px solid rgba(232,87,26,0.75)");
    // Untouched material stays quiet.
    expect(row(container, "d1n1").getAttribute("data-rebuild")).toBe("inherited");
  });

  it("marks a node with no counterpart new, and counts it", async () => {
    // The draft after a node was added: the two inherited ones still pair, and
    // the third has nothing on the source side to pair with.
    serve(
      draftRecord([
        node("d1n1", "First prompt", "Classify the email."),
        node("d1n2", "Second prompt", "Draft the reply.", 1),
        node("d1n3", "A third prompt", "Summarise the thread.", 2),
      ])
    );
    const { container } = renderAt("/compose/d1?from=rebuild");

    await waitFor(() =>
      expect(row(container, "d1n3").getAttribute("data-rebuild")).toBe("added")
    );
    expect(within(row(container, "d1n3")).getByTestId("rebuild-node-pill").textContent).toBe(
      "new"
    );
    expect(row(container, "d1n3").style.borderLeft).toBe("2px solid #2EC4B6");
    expect(row(container, "d1n2").getAttribute("data-rebuild")).toBe("inherited");

    expect(screen.getByTestId("rebuild-change-count").textContent).toBe("1 change");
  });

  it("counts an inherited node the creator deleted, which has no row left", async () => {
    serve(draftRecord([node("d1n1", "First prompt", "Classify the email.")]));
    const { container } = renderAt("/compose/d1?from=rebuild");

    await waitFor(() =>
      expect(screen.getByTestId("rebuild-change-count").textContent).toBe("1 change")
    );
    // The deletion shows in the count and nowhere else: what was removed has no
    // row in the draft to carry a mark.
    expect(row(container, "d1n1").getAttribute("data-rebuild")).toBe("inherited");
    expect(screen.queryAllByTestId("rebuild-node-pill")).toHaveLength(0);
  });

  it("names a source that no longer resolves, without a link to it", async () => {
    getBuild.mockImplementation(async (id: string) =>
      id === "b-source" ? null : draftRecord()
    );
    const { container } = renderAt("/compose/d1?from=rebuild");

    const strip = await screen.findByTestId("rebuild-origin-strip");
    expect(strip.textContent).toBe("Rebuilding from Inbox triage agent by @amara");
    expect(within(strip).queryByRole("link")).toBeNull();

    // No diff is possible, so the tree claims nothing about what was inherited
    // and the bar shows no count rather than a zero it cannot stand behind.
    await screen.findByText("First prompt");
    expect(row(container, "d1n1").getAttribute("data-rebuild")).toBeNull();
    expect(screen.queryByTestId("rebuild-change-count")).toBeNull();
  });
});

describe("compose, on an ordinary draft", () => {
  it("shows no credit line, no count and no treatment", async () => {
    serve(plainRecord());
    const { container } = renderAt("/compose/d1");

    await screen.findByText("First prompt");
    expect(screen.queryByTestId("rebuild-origin-strip")).toBeNull();
    expect(screen.queryByTestId("rebuild-change-count")).toBeNull();
    expect(screen.queryAllByTestId("rebuild-node-pill")).toHaveLength(0);
    expect(row(container, "d1n1").getAttribute("data-rebuild")).toBeNull();
    expect(row(container, "d1n1").style.borderLeft).toBe("2px solid transparent");
    // The parent is never asked for, so an ordinary draft costs no extra read.
    expect(getBuild).not.toHaveBeenCalledWith("b-source");
  });
});

// CA-05 P10 — a trained model: Result Details asks what it is, what it is based on and trained on; the build page says it.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("@/lib/build/nodes", () => ({ upsertNode: (...a: unknown[]) => upsertNode(...a), getNodeTree: vi.fn(), reorderNodes: vi.fn(), deleteNode: vi.fn() }));

import { buildSteps, nestRefusal, NEST_COPY, setNodeFields, trainedModelLine, trainedModelOf } from "@/lib/build/graph";
import { readerResults, readerSteps, stepsMarkdown } from "@/lib/build/readerSteps";
import type { BuildNode, NodeTree } from "@/lib/build/types";
import { StepsList } from "@/pages/site/build/BuildSteps";
import type { BuildStepsView } from "@/pages/site/build/buildModel";
import { modelLabel } from "@/lib/models/registry";

import { DetailsPanel, type DetailsPanelProps } from "./DetailsPanel";
import { resolveView } from "./detailsView";

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (id: string, type: string, payload: Record<string, unknown>, position: number, children: NodeTree[] = [], parent: string | null = null): NodeTree =>
  ({ id, build_id: "b", parent_id: parent, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children }) as NodeTree;

const file = node("f1", "document", { title: "ratings.csv", media_id: "m1", rows: 1200 }, 1, [], "r1");
const trainedPayload = { summary: "Bakery greeter v2", kind: "trained-model", base_model: "muse-spark-open", method: "Rated answers, ranked by me" };
const tree = (payload: Record<string, unknown> = trainedPayload, children: NodeTree[] = [file]): NodeTree[] => [
  node("p1", "prompt", { text: "Rate these." }, 1),
  node("r1", "result", payload, 2, children),
];
const MEDIA = new Map([["m1", { id: "m1", bytes: 4200, bucket: "b", path: "p/ratings.csv", kind: "file" } as never]]);

describe("what a trained model reads as", () => {
  it("is null for a result that says nothing of it", () => {
    expect(trainedModelOf(tree({ summary: "Site" }, [])[1])).toBeNull();
  });
  it("is read from the result and the file sent with it", () => {
    expect(trainedModelOf(tree()[1])).toEqual({ baseModel: "muse-spark-open", method: "Rated answers, ranked by me", trainedOn: { id: "f1", name: "ratings.csv", rows: 1200 } });
  });
  it("says it in one line, the parts that exist", () => {
    expect(trainedModelLine(trainedModelOf(tree()[1])!, modelLabel)).toBe("A trained model, based on Muse Spark Open, trained on 1,200 rows of ratings.csv");
    expect(trainedModelLine({ baseModel: "", method: "", trainedOn: null })).toBe("A trained model");
    expect(trainedModelLine({ baseModel: "x", method: "", trainedOn: { id: "f", name: "ratings.csv", rows: null } })).toBe("A trained model, based on x, trained on ratings.csv");
  });
});

describe("what a result takes", () => {
  const row = (payload: Record<string, unknown>): BuildNode => ({ ...tree(payload, [])[1], children: undefined }) as unknown as BuildNode;
  it("saves the kind, the base model and the method, and refuses what does not fit", async () => {
    await setNodeFields(row({ summary: "x" }), { kind: "trained-model", base_model: "gpt-oss-120b", method: "Rated answers" });
    expect(upsertNode.mock.calls[0][0].payload).toMatchObject({ kind: "trained-model", base_model: "gpt-oss-120b", method: "Rated answers" });
    await expect(setNodeFields(row({ summary: "x" }), { kind: "app" })).rejects.toThrow(/kind of result/);
    await expect(setNodeFields(row({ summary: "x" }), { method: "x".repeat(201) })).rejects.toThrow(/200/);
    await expect(setNodeFields(row({ summary: "x" }), { base_model: "x".repeat(81) })).rejects.toThrow(/80/);
    await expect(setNodeFields(row({ summary: "x" }), { method: "one\ntwo" })).rejects.toThrow(/one line/);
  });
  it("takes the kind off with a blank, keeping the rest", async () => {
    await setNodeFields(row(trainedPayload), { kind: null });
    const saved = upsertNode.mock.calls[0][0].payload;
    expect(saved.kind).toBeUndefined();
    expect(saved.base_model).toBe("muse-spark-open");
  });
  it("holds the file it was trained on, and nothing else", () => {
    const plain = tree({ summary: "Site" }, []);
    expect(nestRefusal([...plain, node("f2", "document", { title: "x.csv" }, 3)], "f2", "r1")).toBe(NEST_COPY.result);
    const trained = [...tree(trainedPayload, []), node("f2", "document", { title: "x.csv" }, 3)];
    expect(nestRefusal(trained, "f2", "r1")).toBeNull();
    expect(nestRefusal([...trained, node("p3", "prompt", { text: "x" }, 4)], "p3", "r1")).toBe(NEST_COPY.result);
  });
});

describe("Result Details", () => {
  function details(payload: Record<string, unknown>, children: NodeTree[] = [file]) {
    const t = tree(payload, children);
    const view = resolveView({ selectedId: "r1", steps: buildSteps(t), groups: [], tree: t, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined });
    const props: DetailsPanelProps = { phone: false, view, onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn(), onTrainedOn: vi.fn() };
    render(<DetailsPanel {...props} />);
    return props;
  }

  it("asks Output type with four choices, Link first, and shows nothing more for the first three", () => {
    details({ summary: "Site", url: "https://x.test" }, []);
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("aria-label") ?? (radio.closest("label")?.textContent ?? ""))).toEqual(["Link", "Image or video", "File", "Model"]);
    expect((screen.getByRole("radio", { name: "Link" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByText("Based on")).toBeNull();
    expect(screen.queryByText("Trained on")).toBeNull();
  });

  it("saves the choice of Model as its kind", () => {
    const props = details({ summary: "Site" }, []);
    fireEvent.click(screen.getByRole("radio", { name: "Model" }));
    expect(props.onFields).toHaveBeenCalledWith("r1", { kind: "trained-model" });
  });

  it("takes the kind off when another choice is made", () => {
    const props = details(trainedPayload);
    fireEvent.click(screen.getByRole("radio", { name: "Link" }));
    expect(props.onFields).toHaveBeenLastCalledWith("r1", { kind: null });
  });

  it("asks Based on and Trained on, and How it was trained in the Optional section, closed (CA-15 P11)", () => {
    const props = details(trainedPayload);
    expect(screen.getByText("Based on")).toBeTruthy();
    expect(screen.getByTestId("trained-on").textContent).toContain("ratings.csv · 1,200 rows");
    expect(screen.getByRole("button", { name: "Replace the file" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "How it was trained" })).toBeNull();
    fireEvent.click(screen.getAllByTestId("optional-field").find((el) => el.textContent?.includes("How it was trained"))?.querySelector("button") as HTMLButtonElement);
    const how = screen.getByRole("textbox", { name: "How it was trained" });
    fireEvent.change(how, { target: { value: "Pairs ranked by a panel" } });
    fireEvent.keyDown(how, { key: "Enter" });
    expect(props.onFields).toHaveBeenCalledWith("r1", { method: "Pairs ranked by a panel" });
    fireEvent.click(screen.getByRole("button", { name: "Remove the file" }));
    expect(props.onRemoveInside).toHaveBeenCalledWith("f1");
  });

  it("sends the file chosen for Trained on", () => {
    const props = details(trainedPayload, []);
    const input = screen.getByTestId("details-trained-on");
    const chosen = new File(["a,b\n1,2\n"], "ratings.csv", { type: "text/csv" });
    fireEvent.change(input, { target: { files: [chosen] } });
    expect(props.onTrainedOn).toHaveBeenCalledWith("r1", chosen);
    expect(screen.getByRole("button", { name: "Add the file" })).toBeTruthy();
  });
});

describe("the build page", () => {
  const render_ = (t: NodeTree[]) => {
    const view = { steps: readerSteps(t, null), results: readerResults(t, MEDIA), need: [], counts: "", map: { groups: [], files: [], tools: [], results: [] }, mapAvailable: false, onCopy: vi.fn(), resolveMedia: () => undefined, otherBody: () => null, focus: null } as unknown as BuildStepsView;
    render(
      <MemoryRouter>
        <StepsList view={view} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );
  };

  it("shows the result as a trained model with the file's Download", () => {
    render_(tree());
    expect(screen.getByTestId("trained-model-line").textContent).toBe("A trained model, based on Muse Spark Open, trained on 1,200 rows of ratings.csv");
    expect(screen.getByText("Rated answers, ranked by me")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Download ratings.csv/ })).toBeTruthy();
  });

  it("shows a plain result as it was", () => {
    render_(tree({ summary: "Site", url: "https://x.test" }, []));
    expect(screen.queryByTestId("trained-model-line")).toBeNull();
  });

  it("puts the line in Copy for AI", () => {
    const t = tree();
    expect(stepsMarkdown({ title: "T" }, readerSteps(t, null), readerResults(t, MEDIA))).toContain("A trained model, based on Muse Spark Open, trained on 1,200 rows of ratings.csv. Rated answers, ranked by me.");
  });
});

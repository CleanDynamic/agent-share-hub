import type { BlueprintResultCardData } from "./BlueprintResultCard";
import type { DiscoverBlock, BlockParent, BlockAuthor } from "./BlockResultCard";
import type { DiscoverStage, StageParent, StageAuthor } from "./StageResultCard";

export const MOCK_BLUEPRINTS: BlueprintResultCardData[] = [
  {
    id: "bp-1",
    title: "RAG Pipeline with Claude Sonnet",
    description:
      "Production-ready retrieval augmented generation pipeline using Claude Sonnet, pgvector, and structured chunking.",
    contentType: "Blueprint",
    difficulty: "Intermediate",
    authorName: "Ada Lovelace",
    authorHandle: "ada",
    tools: ["Claude", "pgvector", "Supabase", "TypeScript"],
    rating: 4.7,
    ratingCount: 32,
    viewCount: 1240,
    downloadCount: 87,
  },
  {
    id: "bp-2",
    title: "Evaluation Suite for Prompt Regression",
    description:
      "Automated eval harness for catching prompt regressions across model upgrades, with diff reports.",
    contentType: "Blueprint",
    difficulty: "Advanced",
    authorName: "Grace Hopper",
    authorHandle: "grace",
    tools: ["GPT-5", "Vitest", "Node"],
    rating: 4.9,
    ratingCount: 18,
    viewCount: 612,
    downloadCount: 41,
  },
  {
    id: "bp-3",
    title: "Multi-agent Research Workflow",
    description:
      "Orchestrate planner, retriever, and writer agents to produce well-cited research briefs.",
    contentType: "Blueprint",
    difficulty: "Intermediate",
    authorName: "Alan Turing",
    authorHandle: "alan",
    tools: ["Gemini", "LangGraph"],
    rating: 4.4,
    ratingCount: 11,
    viewCount: 304,
    downloadCount: 19,
  },
];

const stageParent = (i: number): StageParent => ({
  blueprintId: `bp-${i}`,
  blueprintTitle: MOCK_BLUEPRINTS[i - 1]?.title || "Sample Blueprint",
  slug: `bp-${i}`,
});

const stageAuthor = (i: number): StageAuthor => ({
  name: MOCK_BLUEPRINTS[i - 1]?.authorName || "Anon",
  handle: MOCK_BLUEPRINTS[i - 1]?.authorHandle || "anon",
});

export const MOCK_STAGES: Array<{
  stage: DiscoverStage;
  parent: StageParent;
  author: StageAuthor;
}> = [
  {
    stage: {
      id: "st-1",
      name: "Retrieval",
      blocks: [
        { id: "b1", type: "prompt", x: 0, y: 0, width: 120, height: 60 },
        { id: "b2", type: "code", x: 160, y: 20, width: 120, height: 60 },
        { id: "b3", type: "result", x: 320, y: 0, width: 120, height: 60 },
        { id: "b4", type: "model", x: 160, y: 120, width: 120, height: 60 },
      ],
      connections: [
        { from: "b1", to: "b2" },
        { from: "b2", to: "b3" },
        { from: "b4", to: "b2" },
      ],
    },
    parent: stageParent(1),
    author: stageAuthor(1),
  },
  {
    stage: {
      id: "st-2",
      name: "Evaluation",
      blocks: [
        { id: "b1", type: "prompt", x: 0, y: 0, width: 100, height: 50 },
        { id: "b2", type: "agent", x: 140, y: 0, width: 100, height: 50 },
        { id: "b3", type: "result", x: 280, y: 0, width: 100, height: 50 },
        { id: "b4", type: "code", x: 140, y: 100, width: 100, height: 50 },
      ],
      connections: [
        { from: "b1", to: "b2" },
        { from: "b2", to: "b3" },
        { from: "b4", to: "b2" },
      ],
    },
    parent: stageParent(2),
    author: stageAuthor(2),
  },
  {
    stage: {
      id: "st-3",
      name: "Planning",
      blocks: [
        { id: "b1", type: "agent", x: 0, y: 0, width: 100, height: 50 },
        { id: "b2", type: "tool", x: 140, y: 0, width: 100, height: 50 },
        { id: "b3", type: "workflow", x: 280, y: 0, width: 100, height: 50 },
      ],
      connections: [
        { from: "b1", to: "b2" },
        { from: "b2", to: "b3" },
      ],
    },
    parent: stageParent(3),
    author: stageAuthor(3),
  },
];

const blockParent = (i: number, stageName: string): BlockParent => ({
  blueprintId: `bp-${i}`,
  blueprintTitle: MOCK_BLUEPRINTS[i - 1]?.title || "Sample Blueprint",
  stageName,
  slug: `bp-${i}`,
});

const blockAuthor = (i: number): BlockAuthor => ({
  name: MOCK_BLUEPRINTS[i - 1]?.authorName || "Anon",
  handle: MOCK_BLUEPRINTS[i - 1]?.authorHandle || "anon",
});

export const MOCK_BLOCKS: Array<{
  block: DiscoverBlock;
  parent: BlockParent;
  author: BlockAuthor;
  referenceCount?: number;
}> = [
  {
    block: {
      id: "blk-1",
      type: "prompt",
      name: "Citation extractor",
      content:
        "You are an expert citation extractor. Given a passage,\nreturn a JSON list of {quote, source} pairs.\nIgnore any non-attributable claims.",
    },
    parent: blockParent(1, "Retrieval"),
    author: blockAuthor(1),
    referenceCount: 12,
  },
  {
    block: {
      id: "blk-2",
      type: "code",
      name: "Chunk by sentence",
      content:
        "function chunk(text: string) {\n  return text.split(/(?<=[.!?])\\s+/);\n}",
    },
    parent: blockParent(2, "Evaluation"),
    author: blockAuthor(2),
    referenceCount: 4,
  },
  {
    block: {
      id: "blk-3",
      type: "model",
      name: "Sonnet config",
      properties: { modelName: "claude-sonnet-4.5", tools: ["search", "fetch"] },
    },
    parent: blockParent(3, "Planning"),
    author: blockAuthor(3),
  },
];

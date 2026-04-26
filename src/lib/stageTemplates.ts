/**
 * stageTemplates
 *
 * Pre-built stage templates that drop a set of blocks + connections into a
 * stage in one click. Each template uses block names (`from_name`/`to_name`)
 * to declare connections — these are resolved to the freshly minted block IDs
 * at insertion time.
 *
 * Positions are stored in pixels and snapped to a 20px grid.
 */

import type {
  BlockType,
  ConnectionPort,
  ConnectionType,
} from '@/types/document';

export type TemplateCategory =
  | 'Prompt Engineering'
  | 'Agent Setup'
  | 'Comparison'
  | 'RAG'
  | 'Evaluation'
  | 'Reasoning'
  | 'User Flow';

export interface TemplateBlock {
  type: BlockType;
  /** Stable name within the template — used to wire connections. */
  name: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  properties?: Record<string, unknown>;
}

export interface TemplateConnection {
  from_name: string;
  to_name: string;
  from_port: ConnectionPort;
  to_port: ConnectionPort;
  connection_type: ConnectionType;
  carries_data: boolean;
  label?: string;
}

export interface StageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  /** Optional emoji or short SVG markup for the picker preview. */
  preview?: string;
  blocks: TemplateBlock[];
  connections: TemplateConnection[];
}

const GRID = 20;
const snap = (n: number) => Math.round(n / GRID) * GRID;

function block(b: TemplateBlock): TemplateBlock {
  return {
    ...b,
    position_x: snap(b.position_x),
    position_y: snap(b.position_y),
    width: snap(b.width),
    height: snap(b.height),
  };
}

export const STAGE_TEMPLATES: StageTemplate[] = [
  // ─────────────────────────────────────────────────────────
  {
    id: 'prompt-engineering-pattern',
    name: 'Prompt Engineering Pattern',
    category: 'Prompt Engineering',
    description: 'System prompt → user prompt → result. The classic three-block setup.',
    preview: '✍️',
    blocks: [
      block({
        type: 'text',
        name: 'System prompt',
        position_x: 40, position_y: 40, width: 240, height: 120,
        properties: { richText: null, placeholder: 'You are a helpful assistant…' },
      }),
      block({
        type: 'prompt',
        name: 'User prompt',
        position_x: 320, position_y: 40, width: 280, height: 200,
        properties: { model: 'openai/gpt-5', temperature: 0.7, maxTokens: 1024, userPrompt: '' },
      }),
      block({
        type: 'result',
        name: 'Result',
        position_x: 640, position_y: 40, width: 240, height: 200,
        properties: {},
      }),
    ],
    connections: [
      { from_name: 'System prompt', to_name: 'User prompt', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'User prompt', to_name: 'Result', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'agent-setup',
    name: 'Agent Setup',
    category: 'Agent Setup',
    description: 'Agent block with tools, system prompt, and a sample task.',
    preview: '🤖',
    blocks: [
      block({
        type: 'text', name: 'System prompt',
        position_x: 40, position_y: 40, width: 240, height: 120,
        properties: { placeholder: 'Define agent behaviour…' },
      }),
      block({
        type: 'tool', name: 'Tools',
        position_x: 40, position_y: 200, width: 240, height: 140,
        properties: { tools: [] },
      }),
      block({
        type: 'agent', name: 'Agent',
        position_x: 320, position_y: 80, width: 280, height: 220,
        properties: { model: 'openai/gpt-5', goal: '' },
      }),
      block({
        type: 'prompt', name: 'Sample task',
        position_x: 640, position_y: 80, width: 240, height: 160,
        properties: { userPrompt: 'Try a sample request…' },
      }),
    ],
    connections: [
      { from_name: 'System prompt', to_name: 'Agent', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Tools', to_name: 'Agent', from_port: 'right', to_port: 'left', connection_type: 'depends_on', carries_data: false },
      { from_name: 'Sample task', to_name: 'Agent', from_port: 'left', to_port: 'right', connection_type: 'feeds_into', carries_data: true },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'compare-models',
    name: 'Compare Models',
    category: 'Comparison',
    description: 'One prompt fan-out into two models, results joined by a compare block.',
    preview: '⚖️',
    blocks: [
      block({
        type: 'prompt', name: 'Shared prompt',
        position_x: 40, position_y: 140, width: 260, height: 200,
        properties: { userPrompt: '' },
      }),
      block({
        type: 'prompt', name: 'Model A',
        position_x: 360, position_y: 40, width: 240, height: 160,
        properties: { model: 'openai/gpt-5' },
      }),
      block({
        type: 'prompt', name: 'Model B',
        position_x: 360, position_y: 280, width: 240, height: 160,
        properties: { model: 'google/gemini-2.5-pro' },
      }),
      block({
        type: 'compare', name: 'Compare',
        position_x: 660, position_y: 140, width: 260, height: 200,
        properties: {},
      }),
    ],
    connections: [
      { from_name: 'Shared prompt', to_name: 'Model A', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Shared prompt', to_name: 'Model B', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Model A', to_name: 'Compare', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Model B', to_name: 'Compare', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'rag-pipeline',
    name: 'RAG Pipeline',
    category: 'RAG',
    description: 'Query → retriever → context → generator → answer.',
    preview: '📚',
    blocks: [
      block({ type: 'prompt', name: 'Query',
        position_x: 40, position_y: 40, width: 220, height: 140,
        properties: { userPrompt: '' } }),
      block({ type: 'tool', name: 'Retriever',
        position_x: 300, position_y: 40, width: 220, height: 140,
        properties: { tool: 'vector-search' } }),
      block({ type: 'text', name: 'Context',
        position_x: 560, position_y: 40, width: 220, height: 140 }),
      block({ type: 'prompt', name: 'Generator',
        position_x: 300, position_y: 220, width: 480, height: 180,
        properties: { model: 'openai/gpt-5', systemPrompt: 'Answer using the provided context.' } }),
      block({ type: 'result', name: 'Answer',
        position_x: 820, position_y: 220, width: 200, height: 180 }),
    ],
    connections: [
      { from_name: 'Query', to_name: 'Retriever', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Retriever', to_name: 'Context', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Context', to_name: 'Generator', from_port: 'bottom', to_port: 'top', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Query', to_name: 'Generator', from_port: 'bottom', to_port: 'top', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Generator', to_name: 'Answer', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'fine-tuning-workflow',
    name: 'Fine-Tuning Workflow',
    category: 'Agent Setup',
    description: 'Dataset → training code → fine-tuned model → eval prompt.',
    preview: '🛠️',
    blocks: [
      block({ type: 'resource', name: 'Dataset',
        position_x: 40, position_y: 40, width: 220, height: 140,
        properties: { kind: 'jsonl' } }),
      block({ type: 'code', name: 'Training script',
        position_x: 300, position_y: 40, width: 320, height: 220,
        properties: { language: 'python', code: '# fine-tune a model\n' } }),
      block({ type: 'model', name: 'Fine-tuned model',
        position_x: 660, position_y: 60, width: 240, height: 160,
        properties: {} }),
      block({ type: 'prompt', name: 'Eval prompt',
        position_x: 660, position_y: 260, width: 240, height: 160,
        properties: { userPrompt: 'Evaluate the fine-tuned model on a sample.' } }),
    ],
    connections: [
      { from_name: 'Dataset', to_name: 'Training script', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Training script', to_name: 'Fine-tuned model', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Fine-tuned model', to_name: 'Eval prompt', from_port: 'bottom', to_port: 'top', connection_type: 'feeds_into', carries_data: true },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'evaluation-suite',
    name: 'Evaluation Suite',
    category: 'Evaluation',
    description: 'Test cases → prompt under test → grader → results.',
    preview: '🧪',
    blocks: [
      block({ type: 'resource', name: 'Test cases',
        position_x: 40, position_y: 40, width: 220, height: 160,
        properties: { kind: 'csv' } }),
      block({ type: 'prompt', name: 'Prompt under test',
        position_x: 300, position_y: 40, width: 280, height: 200,
        properties: { userPrompt: '' } }),
      block({ type: 'code', name: 'Grader',
        position_x: 620, position_y: 40, width: 280, height: 200,
        properties: { language: 'javascript', code: '// score(output, expected) → number\n' } }),
      block({ type: 'result', name: 'Scores',
        position_x: 940, position_y: 40, width: 200, height: 200 }),
    ],
    connections: [
      { from_name: 'Test cases', to_name: 'Prompt under test', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Prompt under test', to_name: 'Grader', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Grader', to_name: 'Scores', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'chain-of-thought',
    name: 'Chain of Thought',
    category: 'Reasoning',
    description: 'Question → reasoning steps → final answer.',
    preview: '🧠',
    blocks: [
      block({ type: 'prompt', name: 'Question',
        position_x: 40, position_y: 40, width: 240, height: 160,
        properties: { userPrompt: '' } }),
      block({ type: 'prompt', name: 'Reasoning',
        position_x: 320, position_y: 40, width: 280, height: 220,
        properties: { systemPrompt: 'Think step by step.', userPrompt: '{{question}}' } }),
      block({ type: 'result', name: 'Answer',
        position_x: 640, position_y: 40, width: 240, height: 220 }),
    ],
    connections: [
      { from_name: 'Question', to_name: 'Reasoning', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'Reasoning', to_name: 'Answer', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
    ],
  },

  // ─────────────────────────────────────────────────────────
  {
    id: 'user-flow',
    name: 'User Flow',
    category: 'User Flow',
    description: 'User input → app logic → response, with branching.',
    preview: '🧭',
    blocks: [
      block({ type: 'text', name: 'User input',
        position_x: 40, position_y: 140, width: 220, height: 140 }),
      block({ type: 'code', name: 'App logic',
        position_x: 300, position_y: 140, width: 280, height: 180,
        properties: { language: 'javascript' } }),
      block({ type: 'result', name: 'Success path',
        position_x: 620, position_y: 40, width: 240, height: 140 }),
      block({ type: 'result', name: 'Error path',
        position_x: 620, position_y: 240, width: 240, height: 140 }),
    ],
    connections: [
      { from_name: 'User input', to_name: 'App logic', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true },
      { from_name: 'App logic', to_name: 'Success path', from_port: 'right', to_port: 'left', connection_type: 'feeds_into', carries_data: true, label: 'ok' },
      { from_name: 'App logic', to_name: 'Error path', from_port: 'right', to_port: 'left', connection_type: 'contradicts', carries_data: true, label: 'error' },
    ],
  },
];

export function getTemplateById(id: string): StageTemplate | undefined {
  return STAGE_TEMPLATES.find((t) => t.id === id);
}

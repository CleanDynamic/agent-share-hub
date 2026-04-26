/**
 * stageTemplates
 *
 * Pre-defined block layouts that seed a stage with a working pattern. A
 * template defines blocks by NAME (so the connections can refer to them
 * symbolically); when the template is applied to a stage we resolve every
 * `from_name`/`to_name` to a freshly-generated block id.
 *
 * All positions/sizes are pre-snapped to the 20px stage grid via the `snap`
 * helper, so anything you add here will line up with the dot background.
 */

import type {
  Block,
  BlockType,
  Connection,
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
  name?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  properties: Record<string, unknown>;
}

export interface TemplateConnection {
  from_name: string;
  to_name: string;
  from_port: ConnectionPort;
  to_port: ConnectionPort;
  connection_type: ConnectionType;
  carries_data: boolean;
}

export interface StageTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  preview?: string;
  blocks: TemplateBlock[];
  connections: TemplateConnection[];
}

const GRID = 20;
const snap = (v: number) => Math.round(v / GRID) * GRID;

const block = (
  type: BlockType,
  name: string,
  x: number,
  y: number,
  width = 220,
  height = 100,
  properties: Record<string, unknown> = {},
): TemplateBlock => ({
  type,
  name,
  position_x: snap(x),
  position_y: snap(y),
  width: snap(width),
  height: snap(height),
  properties,
});

const conn = (
  from: string,
  to: string,
  fromPort: ConnectionPort = 'right',
  toPort: ConnectionPort = 'left',
  connectionType: ConnectionType = 'feeds_into',
  carriesData = true,
): TemplateConnection => ({
  from_name: from,
  to_name: to,
  from_port: fromPort,
  to_port: toPort,
  connection_type: connectionType,
  carries_data: carriesData,
});

export const STAGE_TEMPLATES: StageTemplate[] = [
  {
    id: 'prompt-engineering-pattern',
    name: 'Prompt Engineering Pattern',
    category: 'Prompt Engineering',
    description:
      'Instruction → Few-shot examples → Output. The starter pattern for any prompt experiment.',
    preview: '✨',
    blocks: [
      block('prompt', 'Instruction', 60, 80),
      block('prompt', 'Few-shot Examples', 340, 80),
      block('result', 'Output', 620, 80),
    ],
    connections: [
      conn('Instruction', 'Few-shot Examples'),
      conn('Few-shot Examples', 'Output'),
    ],
  },
  {
    id: 'agent-setup',
    name: 'Agent Setup',
    category: 'Agent Setup',
    description:
      'Wire an agent to a system prompt and tools, then drive a workflow that produces output.',
    preview: '🤖',
    blocks: [
      block('agent', 'Agent', 60, 80),
      block('prompt', 'System Prompt', 60, 220),
      block('tool', 'Tools', 60, 360),
      block('workflow', 'Workflow', 340, 220),
      block('result', 'Output', 620, 220),
    ],
    connections: [
      conn('Agent', 'Workflow'),
      conn('System Prompt', 'Workflow'),
      conn('Tools', 'Workflow'),
      conn('Workflow', 'Output'),
    ],
  },
  {
    id: 'compare-models',
    name: 'Compare Models',
    category: 'Comparison',
    description:
      'Run the same prompt through multiple models and rank the outputs side by side.',
    preview: '⚖️',
    blocks: [
      block('prompt', 'Prompt', 340, 60),
      block('model', 'Model A', 60, 220),
      block('model', 'Model B', 340, 220),
      block('model', 'Model C', 620, 220),
      block('result', 'Result A', 60, 380),
      block('result', 'Result B', 340, 380),
      block('result', 'Result C', 620, 380),
      block('compare', 'Verdict', 340, 540),
    ],
    connections: [
      conn('Prompt', 'Model A', 'bottom', 'top'),
      conn('Prompt', 'Model B', 'bottom', 'top'),
      conn('Prompt', 'Model C', 'bottom', 'top'),
      conn('Model A', 'Result A', 'bottom', 'top'),
      conn('Model B', 'Result B', 'bottom', 'top'),
      conn('Model C', 'Result C', 'bottom', 'top'),
      conn('Result A', 'Verdict', 'bottom', 'top'),
      conn('Result B', 'Verdict', 'bottom', 'top'),
      conn('Result C', 'Verdict', 'bottom', 'top'),
    ],
  },
  {
    id: 'rag-pipeline',
    name: 'RAG Pipeline',
    category: 'RAG',
    description:
      'Embed a query, retrieve from a vector store, and answer the question with retrieved context.',
    preview: '📚',
    blocks: [
      block('text', 'User Query', 60, 80),
      block('tool', 'Embedder', 320, 80),
      block('tool', 'Vector Store', 580, 80),
      block('text', 'Retrieved Context', 580, 240),
      block('prompt', 'Augmented Prompt', 320, 240),
      block('model', 'LLM', 60, 240),
      block('result', 'Answer', 60, 400),
    ],
    connections: [
      conn('User Query', 'Embedder'),
      conn('Embedder', 'Vector Store'),
      conn('Vector Store', 'Retrieved Context', 'bottom', 'top'),
      conn('Retrieved Context', 'Augmented Prompt', 'left', 'right'),
      conn('Augmented Prompt', 'LLM', 'left', 'right'),
      conn('LLM', 'Answer', 'bottom', 'top'),
    ],
  },
  {
    id: 'fine-tuning-workflow',
    name: 'Fine-Tuning Workflow',
    category: 'Evaluation',
    description:
      'Prepare training data, fine-tune a base model with a script, and evaluate the resulting model.',
    preview: '🎯',
    blocks: [
      block('text', 'Training Data', 60, 80),
      block('model', 'Base Model', 340, 80),
      block('code', 'Training Script', 60, 240),
      block('workflow', 'Fine-tune Run', 340, 240),
      block('model', 'Fine-tuned Model', 620, 240),
      block('prompt', 'Eval Prompts', 340, 400),
      block('result', 'Evaluation', 620, 400),
    ],
    connections: [
      conn('Training Data', 'Fine-tune Run', 'bottom', 'top'),
      conn('Base Model', 'Fine-tune Run', 'bottom', 'top'),
      conn('Training Script', 'Fine-tune Run'),
      conn('Fine-tune Run', 'Fine-tuned Model'),
      conn('Eval Prompts', 'Fine-tuned Model', 'top', 'bottom'),
      conn('Fine-tuned Model', 'Evaluation', 'bottom', 'top'),
    ],
  },
  {
    id: 'evaluation-suite',
    name: 'Evaluation Suite',
    category: 'Evaluation',
    description:
      'Run a test prompt through a model, score the output, and roll up into a summary verdict.',
    preview: '📊',
    blocks: [
      block('prompt', 'Test Prompt', 60, 80),
      block('model', 'Model', 340, 80),
      block('result', 'Output', 620, 80),
      block('code', 'Scorer', 340, 240),
      block('result', 'Score', 620, 240),
      block('compare', 'Summary', 620, 400),
    ],
    connections: [
      conn('Test Prompt', 'Model'),
      conn('Model', 'Output'),
      conn('Output', 'Scorer', 'bottom', 'top'),
      conn('Scorer', 'Score'),
      conn('Score', 'Summary', 'bottom', 'top'),
    ],
  },
  {
    id: 'chain-of-thought',
    name: 'Chain of Thought',
    category: 'Reasoning',
    description:
      'Walk a question through explicit reasoning steps before committing to a final answer.',
    preview: '🧠',
    blocks: [
      block('prompt', 'Question', 60, 240),
      block('prompt', 'Step 1', 340, 80),
      block('prompt', 'Step 2', 340, 240),
      block('prompt', 'Step 3', 340, 400),
      block('result', 'Final Answer', 620, 240),
    ],
    connections: [
      conn('Question', 'Step 1'),
      conn('Question', 'Step 2'),
      conn('Question', 'Step 3'),
      conn('Step 1', 'Final Answer'),
      conn('Step 2', 'Final Answer'),
      conn('Step 3', 'Final Answer'),
    ],
  },
  {
    id: 'user-flow',
    name: 'User Flow',
    category: 'User Flow',
    description:
      'Sketch how a user moves through your product: entry → action → decision → outcomes.',
    preview: '🧭',
    blocks: [
      block('text', 'Entry Point', 60, 80),
      block('text', 'Action', 340, 80),
      block('text', 'Decision', 620, 80),
      block('text', 'Outcome A', 620, 240),
      block('text', 'Outcome B', 340, 240),
    ],
    connections: [
      conn('Entry Point', 'Action'),
      conn('Action', 'Decision'),
      conn('Decision', 'Outcome A', 'bottom', 'top'),
      conn('Decision', 'Outcome B', 'left', 'right'),
    ],
  },
];

export interface DocumentSink {
  addBlock: (b: Block) => void;
  addConnection: (c: Connection) => void;
}

/**
 * Materialise a template into a stage. Block name references in the template's
 * connections are resolved to the real block IDs we just generated; any
 * connection whose endpoints don't resolve is silently skipped (which means a
 * malformed template can't crash the editor).
 */
export function applyTemplateToStage(
  stageId: string,
  template: StageTemplate,
  sink: DocumentSink,
): void {
  const now = new Date().toISOString();
  const idByName = new Map<string, string>();

  template.blocks.forEach((tb, index) => {
    const id = crypto.randomUUID();
    if (tb.name) idByName.set(tb.name, id);
    sink.addBlock({
      id,
      stage_id: stageId,
      type: tb.type,
      position_x: tb.position_x,
      position_y: tb.position_y,
      width: tb.width,
      height: tb.height,
      z_index: index,
      name: tb.name ?? null,
      properties: tb.properties,
      locked: false,
      created_at: now,
      updated_at: now,
    });
  });

  for (const tc of template.connections) {
    const from = idByName.get(tc.from_name);
    const to = idByName.get(tc.to_name);
    if (!from || !to) continue;
    sink.addConnection({
      id: crypto.randomUUID(),
      from_block_id: from,
      to_block_id: to,
      from_port: tc.from_port,
      to_port: tc.to_port,
      connection_type: tc.connection_type,
      label: null,
      carries_data: tc.carries_data,
      created_at: now,
    });
  }
}

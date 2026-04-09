import type { BlockPosition } from './canvas-types';

export interface BlockTemplate {
  id: string;
  label: string;
  description: string;
  category: 'prompt' | 'build' | 'evaluation'
    | 'agent' | 'comparison' | 'tutorial';
  blocks: Array<{
    type: string;
    subheading: string;
    placeholder: string;
    position: BlockPosition; // relative, col 1-12
  }>;
  arrows: Array<{
    fromIndex: number; // index in blocks array
    toIndex: number;
    fromEdge: 'top'|'right'|'bottom'|'left';
    toEdge: 'top'|'right'|'bottom'|'left';
    arrowType: string;
  }>;
}

export const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    id: 'prompt-result',
    label: 'Prompt + Result',
    description:
      'The core unit of AI documentation',
    category: 'prompt',
    blocks: [
      {
        type: 'prompt',
        subheading: 'The Prompt',
        placeholder:
          'Write your prompt here...',
        position: {
          col: 1, row: 1,
          colSpan: 12, rowSpan: 3,
        },
      },
      {
        type: 'result',
        subheading: 'The Output',
        placeholder:
          'Paste the actual model output...',
        position: {
          col: 1, row: 5,
          colSpan: 12, rowSpan: 3,
        },
      },
    ],
    arrows: [
      {
        fromIndex: 0, toIndex: 1,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'produces',
      },
    ],
  },

  {
    id: 'before-after',
    label: 'Before / After',
    description:
      'Two prompts compared side by side',
    category: 'comparison',
    blocks: [
      {
        type: 'prompt',
        subheading: 'Before',
        placeholder: 'The original prompt...',
        position: {
          col: 1, row: 1,
          colSpan: 6, rowSpan: 3,
        },
      },
      {
        type: 'prompt',
        subheading: 'After',
        placeholder:
          'The improved prompt...',
        position: {
          col: 7, row: 1,
          colSpan: 6, rowSpan: 3,
        },
      },
      {
        type: 'comparison',
        subheading: 'What Changed',
        placeholder: 'Explain the improvement...',
        position: {
          col: 1, row: 5,
          colSpan: 12, rowSpan: 2,
        },
      },
    ],
    arrows: [
      {
        fromIndex: 0, toIndex: 2,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'compares',
      },
      {
        fromIndex: 1, toIndex: 2,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'compares',
      },
    ],
  },

  {
    id: 'pipeline-step',
    label: 'Pipeline Step',
    description:
      'Tool setup → code → result sequence',
    category: 'build',
    blocks: [
      {
        type: 'tool_setup',
        subheading: 'Prerequisites',
        placeholder:
          'What needs to be installed...',
        position: {
          col: 1, row: 1,
          colSpan: 12, rowSpan: 2,
        },
      },
      {
        type: 'code',
        subheading: 'The Code',
        placeholder:
          '# Paste your code here\n',
        position: {
          col: 1, row: 4,
          colSpan: 8, rowSpan: 4,
        },
      },
      {
        type: 'result',
        subheading: 'Expected Output',
        placeholder:
          'What the terminal should show...',
        position: {
          col: 9, row: 4,
          colSpan: 4, rowSpan: 4,
        },
      },
    ],
    arrows: [
      {
        fromIndex: 0, toIndex: 1,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'requires',
      },
      {
        fromIndex: 1, toIndex: 2,
        fromEdge: 'right', toEdge: 'left',
        arrowType: 'produces',
      },
    ],
  },

  {
    id: 'agent-stack',
    label: 'Agent Stack',
    description:
      'Agent config driving workflow and tools',
    category: 'agent',
    blocks: [
      {
        type: 'agent_config',
        subheading: 'Agent Configuration',
        placeholder:
          'Model, memory, tools, capabilities...',
        position: {
          col: 1, row: 1,
          colSpan: 12, rowSpan: 4,
        },
      },
      {
        type: 'workflow',
        subheading: 'The Workflow',
        placeholder:
          'How the agent processes...',
        position: {
          col: 1, row: 6,
          colSpan: 6, rowSpan: 3,
        },
      },
      {
        type: 'tool_setup',
        subheading: 'Tools Used',
        placeholder:
          'External tools the agent calls...',
        position: {
          col: 7, row: 6,
          colSpan: 6, rowSpan: 3,
        },
      },
      {
        type: 'result',
        subheading: 'Output',
        placeholder:
          'What the agent produces...',
        position: {
          col: 1, row: 10,
          colSpan: 12, rowSpan: 2,
        },
      },
    ],
    arrows: [
      {
        fromIndex: 0, toIndex: 1,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'produces',
      },
      {
        fromIndex: 0, toIndex: 2,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'requires',
      },
      {
        fromIndex: 1, toIndex: 3,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'produces',
      },
      {
        fromIndex: 2, toIndex: 3,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'produces',
      },
    ],
  },

  {
    id: 'model-eval',
    label: 'Model Evaluation',
    description:
      'Params → prompt → results × 3 → verdict',
    category: 'evaluation',
    blocks: [
      {
        type: 'model_params',
        subheading: 'Model Parameters',
        placeholder:
          'Temperature, top-p, max tokens...',
        position: {
          col: 1, row: 1,
          colSpan: 12, rowSpan: 2,
        },
      },
      {
        type: 'prompt',
        subheading: 'Test Prompt',
        placeholder:
          'The prompt being evaluated...',
        position: {
          col: 1, row: 4,
          colSpan: 12, rowSpan: 2,
        },
      },
      {
        type: 'result',
        subheading: 'Run 1',
        placeholder: 'Output from first run...',
        position: {
          col: 1, row: 7,
          colSpan: 4, rowSpan: 3,
        },
      },
      {
        type: 'result',
        subheading: 'Run 2',
        placeholder: 'Output from second run...',
        position: {
          col: 5, row: 7,
          colSpan: 4, rowSpan: 3,
        },
      },
      {
        type: 'result',
        subheading: 'Run 3',
        placeholder: 'Output from third run...',
        position: {
          col: 9, row: 7,
          colSpan: 4, rowSpan: 3,
        },
      },
      {
        type: 'comparison',
        subheading: 'Evaluation Verdict',
        placeholder:
          'Consistency, quality, notes...',
        position: {
          col: 1, row: 11,
          colSpan: 12, rowSpan: 2,
        },
      },
    ],
    arrows: [
      {
        fromIndex: 0, toIndex: 1,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'references',
      },
      {
        fromIndex: 1, toIndex: 2,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'produces',
      },
      {
        fromIndex: 1, toIndex: 3,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'produces',
      },
      {
        fromIndex: 1, toIndex: 4,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'produces',
      },
      {
        fromIndex: 2, toIndex: 5,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'validates',
      },
      {
        fromIndex: 3, toIndex: 5,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'validates',
      },
      {
        fromIndex: 4, toIndex: 5,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'validates',
      },
    ],
  },

  {
    id: 'tutorial-step',
    label: 'Tutorial Step',
    description:
      'Media instruction paired with a block',
    category: 'tutorial',
    blocks: [
      {
        type: 'tutorial_step',
        subheading: 'Step Walkthrough',
        placeholder:
          'Explain this step visually...',
        position: {
          col: 1, row: 1,
          colSpan: 5, rowSpan: 4,
        },
      },
      {
        type: 'prompt',
        subheading: 'The Block',
        placeholder:
          'The technical content for this step...',
        position: {
          col: 6, row: 1,
          colSpan: 7, rowSpan: 4,
        },
      },
    ],
    arrows: [
      {
        fromIndex: 0, toIndex: 1,
        fromEdge: 'right', toEdge: 'left',
        arrowType: 'explains',
      },
    ],
  },

  {
    id: 'rag-pipeline',
    label: 'RAG Pipeline',
    description:
      'Retrieval → augmentation → generation',
    category: 'build',
    blocks: [
      {
        type: 'tool_setup',
        subheading: 'Vector Database',
        placeholder:
          'Pinecone / Weaviate / pgvector setup...',
        position: {
          col: 1, row: 1,
          colSpan: 4, rowSpan: 3,
        },
      },
      {
        type: 'workflow',
        subheading: 'Retrieval Step',
        placeholder:
          'Query embedding → similarity search...',
        position: {
          col: 5, row: 1,
          colSpan: 4, rowSpan: 3,
        },
      },
      {
        type: 'prompt',
        subheading: 'Augmented Prompt',
        placeholder:
          'System prompt + retrieved context + query...',
        position: {
          col: 9, row: 1,
          colSpan: 4, rowSpan: 3,
        },
      },
      {
        type: 'model_params',
        subheading: 'Generation Config',
        placeholder:
          'Model, temperature, max tokens...',
        position: {
          col: 1, row: 5,
          colSpan: 6, rowSpan: 2,
        },
      },
      {
        type: 'result',
        subheading: 'Grounded Response',
        placeholder:
          'Output with source citations...',
        position: {
          col: 7, row: 5,
          colSpan: 6, rowSpan: 2,
        },
      },
    ],
    arrows: [
      {
        fromIndex: 0, toIndex: 1,
        fromEdge: 'right', toEdge: 'left',
        arrowType: 'produces',
      },
      {
        fromIndex: 1, toIndex: 2,
        fromEdge: 'right', toEdge: 'left',
        arrowType: 'produces',
      },
      {
        fromIndex: 2, toIndex: 4,
        fromEdge: 'bottom', toEdge: 'top',
        arrowType: 'produces',
      },
      {
        fromIndex: 3, toIndex: 4,
        fromEdge: 'right', toEdge: 'left',
        arrowType: 'references',
      },
    ],
  },
];

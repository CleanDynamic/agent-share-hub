import type { BlockPosition } from './canvas-types';

export interface TemplateBlock {
  type: string;
  subheading: string;
  placeholder: string;
  position: BlockPosition; // relative, col 1-12
}

export interface TemplateArrow {
  fromIndex: number; // index in blocks array
  toIndex: number;
  fromEdge: 'top'|'right'|'bottom'|'left';
  toEdge: 'top'|'right'|'bottom'|'left';
  arrowType: string;
}

export interface BlockTemplate {
  id: string;
  label: string;
  description: string;
  category: 'prompt' | 'build' | 'evaluation'
    | 'agent' | 'comparison' | 'tutorial';
  blocks: TemplateBlock[];
  arrows: TemplateArrow[];
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
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'result',
        subheading: 'The Output',
        placeholder:
          'Paste the actual model output...',
        position: {
          col: 1, row: 7,
          colSpan: 3, rowSpan: 5,
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
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'prompt',
        subheading: 'After',
        placeholder:
          'The improved prompt...',
        position: {
          col: 4, row: 1,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'comparison',
        subheading: 'What Changed',
        placeholder: 'Explain the improvement...',
        position: {
          col: 1, row: 7,
          colSpan: 3, rowSpan: 5,
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
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'code',
        subheading: 'The Code',
        placeholder:
          '# Paste your code here\n',
        position: {
          col: 1, row: 7,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'result',
        subheading: 'Expected Output',
        placeholder:
          'What the terminal should show...',
        position: {
          col: 4, row: 7,
          colSpan: 3, rowSpan: 5,
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
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'workflow',
        subheading: 'The Workflow',
        placeholder:
          'How the agent processes...',
        position: {
          col: 1, row: 7,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'tool_setup',
        subheading: 'Tools Used',
        placeholder:
          'External tools the agent calls...',
        position: {
          col: 4, row: 7,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'result',
        subheading: 'Output',
        placeholder:
          'What the agent produces...',
        position: {
          col: 1, row: 13,
          colSpan: 3, rowSpan: 5,
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
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'prompt',
        subheading: 'Test Prompt',
        placeholder:
          'The prompt being evaluated...',
        position: {
          col: 1, row: 7,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'result',
        subheading: 'Run 1',
        placeholder: 'Output from first run...',
        position: {
          col: 1, row: 13,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'result',
        subheading: 'Run 2',
        placeholder: 'Output from second run...',
        position: {
          col: 4, row: 13,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'result',
        subheading: 'Run 3',
        placeholder: 'Output from third run...',
        position: {
          col: 7, row: 13,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'comparison',
        subheading: 'Evaluation Verdict',
        placeholder:
          'Consistency, quality, notes...',
        position: {
          col: 1, row: 19,
          colSpan: 3, rowSpan: 5,
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
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'prompt',
        subheading: 'The Block',
        placeholder:
          'The technical content for this step...',
        position: {
          col: 4, row: 1,
          colSpan: 3, rowSpan: 5,
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
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'workflow',
        subheading: 'Retrieval Step',
        placeholder:
          'Query embedding → similarity search...',
        position: {
          col: 4, row: 1,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'prompt',
        subheading: 'Augmented Prompt',
        placeholder:
          'System prompt + retrieved context + query...',
        position: {
          col: 7, row: 1,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'model_params',
        subheading: 'Generation Config',
        placeholder:
          'Model, temperature, max tokens...',
        position: {
          col: 1, row: 7,
          colSpan: 3, rowSpan: 5,
        },
      },
      {
        type: 'result',
        subheading: 'Grounded Response',
        placeholder:
          'Output with source citations...',
        position: {
          col: 4, row: 7,
          colSpan: 3, rowSpan: 5,
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

// ─── Template scaling ────────────────────────────
// Pack a list of blocks onto the 12-column grid.
// Each block is colSpan:3, rowSpan:5, arranged left-to-right
// with 1-column gaps; wraps to the next row-group (2-row gap)
// when reaching column 12.
function packGrid(
  count: number,
  startRow = 1,
): BlockPosition[] {
  const positions: BlockPosition[] = [];
  const colSpan = 3;
  const rowSpan = 5;
  const colGap = 1;
  const rowGap = 2;
  const cellWidth = colSpan + colGap; // 4
  const cellsPerRow = 3; // cols 1, 5, 9 (within 12 cols)

  for (let i = 0; i < count; i++) {
    const rowIdx = Math.floor(i / cellsPerRow);
    const colIdx = i % cellsPerRow;
    positions.push({
      col: 1 + colIdx * cellWidth,
      row: startRow + rowIdx * (rowSpan + rowGap),
      colSpan,
      rowSpan,
    });
  }
  return positions;
}

/**
 * Generate a scaled-up version of a template.
 * factor = 1 returns the original template unchanged.
 * factor 2–10 replicates the workflow pattern proportionally.
 */
export function scaleTemplate(
  template: BlockTemplate,
  factor: number,
): BlockTemplate {
  const f = Math.max(1, Math.min(10, Math.floor(factor)));
  if (f === 1) return template;

  const blocks: TemplateBlock[] = [];
  const arrows: TemplateArrow[] = [];

  switch (template.id) {
    case 'prompt-result': {
      // 1x: prompt → result
      // Nx: N prompts, each with their own result, all feeding a
      // shared comparison/evaluation block.
      const promptIdxs: number[] = [];
      const resultIdxs: number[] = [];
      for (let i = 0; i < f; i++) {
        promptIdxs.push(blocks.length);
        blocks.push({
          type: 'prompt',
          subheading: `Prompt Variant ${i + 1}`,
          placeholder: 'Write your prompt here...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
      }
      for (let i = 0; i < f; i++) {
        resultIdxs.push(blocks.length);
        blocks.push({
          type: 'result',
          subheading: `Result ${i + 1}`,
          placeholder: 'Paste the actual model output...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
      }
      const evalIdx = blocks.length;
      blocks.push({
        type: 'comparison',
        subheading: f >= 5 ? 'Evaluation' : 'Comparison',
        placeholder: 'Compare results, pick a winner...',
        position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
      });

      for (let i = 0; i < f; i++) {
        arrows.push({
          fromIndex: promptIdxs[i],
          toIndex: resultIdxs[i],
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'produces',
        });
        arrows.push({
          fromIndex: resultIdxs[i],
          toIndex: evalIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'compares',
        });
      }
      break;
    }

    case 'before-after': {
      // Nx: N prompt pairs (before/after) each with their own comparison.
      for (let i = 0; i < f; i++) {
        const beforeIdx = blocks.length;
        blocks.push({
          type: 'prompt',
          subheading: `Before ${i + 1}`,
          placeholder: 'The original prompt...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const afterIdx = blocks.length;
        blocks.push({
          type: 'prompt',
          subheading: `After ${i + 1}`,
          placeholder: 'The improved prompt...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const compareIdx = blocks.length;
        blocks.push({
          type: 'comparison',
          subheading: `What Changed ${i + 1}`,
          placeholder: 'Explain the improvement...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        arrows.push({
          fromIndex: beforeIdx, toIndex: compareIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'compares',
        });
        arrows.push({
          fromIndex: afterIdx, toIndex: compareIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'compares',
        });
      }
      break;
    }

    case 'pipeline-step': {
      // Nx: N tool_setup → code → result chains merging into a final result.
      const finalIdxs: number[] = [];
      for (let i = 0; i < f; i++) {
        const toolIdx = blocks.length;
        blocks.push({
          type: 'tool_setup',
          subheading: `Prerequisites ${i + 1}`,
          placeholder: 'What needs to be installed...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const codeIdx = blocks.length;
        blocks.push({
          type: 'code',
          subheading: `Code ${i + 1}`,
          placeholder: '# Paste your code here\n',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const resultIdx = blocks.length;
        blocks.push({
          type: 'result',
          subheading: `Output ${i + 1}`,
          placeholder: 'What the terminal should show...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        finalIdxs.push(resultIdx);
        arrows.push({
          fromIndex: toolIdx, toIndex: codeIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'requires',
        });
        arrows.push({
          fromIndex: codeIdx, toIndex: resultIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'produces',
        });
      }
      break;
    }

    case 'agent-stack': {
      // Nx: N parallel agent chains (agent → workflow + tool → result),
      // all merging into a final aggregation result.
      const outputIdxs: number[] = [];
      for (let i = 0; i < f; i++) {
        const agentIdx = blocks.length;
        blocks.push({
          type: 'agent_config',
          subheading: `Agent ${i + 1}`,
          placeholder: 'Model, memory, tools, capabilities...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const workflowIdx = blocks.length;
        blocks.push({
          type: 'workflow',
          subheading: `Workflow ${i + 1}`,
          placeholder: 'How the agent processes...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const toolIdx = blocks.length;
        blocks.push({
          type: 'tool_setup',
          subheading: `Tools ${i + 1}`,
          placeholder: 'External tools the agent calls...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const resultIdx = blocks.length;
        blocks.push({
          type: 'result',
          subheading: `Output ${i + 1}`,
          placeholder: 'What the agent produces...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        outputIdxs.push(resultIdx);
        arrows.push({
          fromIndex: agentIdx, toIndex: workflowIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'produces',
        });
        arrows.push({
          fromIndex: agentIdx, toIndex: toolIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'requires',
        });
        arrows.push({
          fromIndex: workflowIdx, toIndex: resultIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'produces',
        });
        arrows.push({
          fromIndex: toolIdx, toIndex: resultIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'produces',
        });
      }
      // Final aggregation result
      const finalIdx = blocks.length;
      blocks.push({
        type: 'result',
        subheading: 'Aggregated Output',
        placeholder: 'Unified output from all agents...',
        position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
      });
      for (const idx of outputIdxs) {
        arrows.push({
          fromIndex: idx, toIndex: finalIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'produces',
        });
      }
      break;
    }

    case 'model-eval': {
      // Nx: N parameter/prompt pairs, each with 3 runs, feeding verdicts
      // that roll up to a final aggregated verdict.
      const verdictIdxs: number[] = [];
      for (let i = 0; i < f; i++) {
        const paramsIdx = blocks.length;
        blocks.push({
          type: 'model_params',
          subheading: `Parameters ${i + 1}`,
          placeholder: 'Temperature, top-p, max tokens...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const promptIdx = blocks.length;
        blocks.push({
          type: 'prompt',
          subheading: `Test Prompt ${i + 1}`,
          placeholder: 'The prompt being evaluated...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const runIdxs: number[] = [];
        for (let r = 0; r < 3; r++) {
          const idx = blocks.length;
          blocks.push({
            type: 'result',
            subheading: `Run ${i + 1}.${r + 1}`,
            placeholder: `Output from run ${r + 1}...`,
            position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
          });
          runIdxs.push(idx);
        }
        const verdictIdx = blocks.length;
        blocks.push({
          type: 'comparison',
          subheading: `Verdict ${i + 1}`,
          placeholder: 'Consistency, quality, notes...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        verdictIdxs.push(verdictIdx);
        arrows.push({
          fromIndex: paramsIdx, toIndex: promptIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'references',
        });
        for (const rIdx of runIdxs) {
          arrows.push({
            fromIndex: promptIdx, toIndex: rIdx,
            fromEdge: 'bottom', toEdge: 'top',
            arrowType: 'produces',
          });
          arrows.push({
            fromIndex: rIdx, toIndex: verdictIdx,
            fromEdge: 'bottom', toEdge: 'top',
            arrowType: 'validates',
          });
        }
      }
      if (f > 1) {
        const finalVerdictIdx = blocks.length;
        blocks.push({
          type: 'comparison',
          subheading: 'Final Verdict',
          placeholder: 'Aggregated evaluation across variants...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        for (const vIdx of verdictIdxs) {
          arrows.push({
            fromIndex: vIdx, toIndex: finalVerdictIdx,
            fromEdge: 'bottom', toEdge: 'top',
            arrowType: 'validates',
          });
        }
      }
      break;
    }

    case 'tutorial-step': {
      // Nx: N sequential tutorial steps, each with their own block.
      let prevPromptIdx: number | null = null;
      for (let i = 0; i < f; i++) {
        const stepIdx = blocks.length;
        blocks.push({
          type: 'tutorial_step',
          subheading: `Step ${i + 1} Walkthrough`,
          placeholder: 'Explain this step visually...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const promptIdx = blocks.length;
        blocks.push({
          type: 'prompt',
          subheading: `Step ${i + 1} Block`,
          placeholder: 'The technical content for this step...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        arrows.push({
          fromIndex: stepIdx, toIndex: promptIdx,
          fromEdge: 'right', toEdge: 'left',
          arrowType: 'explains',
        });
        if (prevPromptIdx !== null) {
          arrows.push({
            fromIndex: prevPromptIdx, toIndex: stepIdx,
            fromEdge: 'bottom', toEdge: 'top',
            arrowType: 'follows',
          });
        }
        prevPromptIdx = promptIdx;
      }
      break;
    }

    case 'rag-pipeline': {
      // Nx: N parallel retrieval pipelines feeding one combined generation
      // step, or multi-stage retrieval for larger factors.
      const groundedIdxs: number[] = [];
      for (let i = 0; i < f; i++) {
        const vectorIdx = blocks.length;
        blocks.push({
          type: 'tool_setup',
          subheading: `Vector DB ${i + 1}`,
          placeholder: 'Pinecone / Weaviate / pgvector setup...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const retrievalIdx = blocks.length;
        blocks.push({
          type: 'workflow',
          subheading: `Retrieval ${i + 1}`,
          placeholder: 'Query embedding → similarity search...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const augmentedIdx = blocks.length;
        blocks.push({
          type: 'prompt',
          subheading: `Augmented Prompt ${i + 1}`,
          placeholder: 'System prompt + retrieved context + query...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const genIdx = blocks.length;
        blocks.push({
          type: 'model_params',
          subheading: `Generation Config ${i + 1}`,
          placeholder: 'Model, temperature, max tokens...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        const resultIdx = blocks.length;
        blocks.push({
          type: 'result',
          subheading: `Grounded Response ${i + 1}`,
          placeholder: 'Output with source citations...',
          position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
        });
        groundedIdxs.push(resultIdx);
        arrows.push({
          fromIndex: vectorIdx, toIndex: retrievalIdx,
          fromEdge: 'right', toEdge: 'left',
          arrowType: 'produces',
        });
        arrows.push({
          fromIndex: retrievalIdx, toIndex: augmentedIdx,
          fromEdge: 'right', toEdge: 'left',
          arrowType: 'produces',
        });
        arrows.push({
          fromIndex: augmentedIdx, toIndex: resultIdx,
          fromEdge: 'bottom', toEdge: 'top',
          arrowType: 'produces',
        });
        arrows.push({
          fromIndex: genIdx, toIndex: resultIdx,
          fromEdge: 'right', toEdge: 'left',
          arrowType: 'references',
        });
      }
      break;
    }

    default: {
      // Generic fallback: replicate blocks and arrows f times, disjoint.
      const base = template.blocks.length;
      for (let i = 0; i < f; i++) {
        for (const b of template.blocks) {
          blocks.push({
            type: b.type,
            subheading: `${b.subheading} ${i + 1}`,
            placeholder: b.placeholder,
            position: { col: 1, row: 1, colSpan: 3, rowSpan: 5 },
          });
        }
        for (const a of template.arrows) {
          arrows.push({
            fromIndex: a.fromIndex + i * base,
            toIndex: a.toIndex + i * base,
            fromEdge: a.fromEdge,
            toEdge: a.toEdge,
            arrowType: a.arrowType,
          });
        }
      }
    }
  }

  // Pack all blocks onto the grid with optimal spacing
  const packed = packGrid(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    blocks[i] = { ...blocks[i], position: packed[i] };
  }
  return {
    ...template,
    id: `${template.id}-x${f}`,
    label: `${template.label} (${f}x)`,
    blocks,
    arrows,
  };
}

import type { CanvasBlock } from '@/lib/canvas-types';

// Import all existing editor components from
// ContentBlockBuilder.tsx — these are already
// built and tested. Import them as named exports.
import {
  PromptBlockEditor,
  CodeBlockEditor,
  TextEditor,
  ImagePicker,
  ResultBlockEditor,
  ComparisonEditor,
  AgentConfigEditor,
  WorkflowEditor,
  ModelParamsEditor,
  ToolSetupEditor,
  ResourceEditor,
  TutorialStepEditor,
} from '@/components/ContentBlockBuilder';

interface BlockInlineEditorProps {
  block: CanvasBlock;
  onChange: (patch: Partial<CanvasBlock>) => void;
}

export function BlockInlineEditor({
  block, onChange,
}: BlockInlineEditorProps) {
  // Adapter: ContentBlockBuilder editors expect
  // (index, patch) signature. We adapt here.
  const update = (_: number, patch: any) =>
    onChange(patch);

  // Subheading input — shown above all editors
  // except section_heading (which IS a heading)
  const showSubheading =
    block.type !== 'section_heading';

  return (
    <div>
      {showSubheading && (
        <input
          value={block.subheading ?? ''}
          onChange={e => onChange({
            subheading: e.target.value || null
          })}
          placeholder="Block title (optional)..."
          style={{
            width: '100%',
            fontFamily:
              "'Playfair Display', Georgia, serif",
            fontSize: 15, fontWeight: 600,
            color: 'rgba(255,255,255,0.88)',
            background: 'transparent',
            border: 'none', outline: 'none',
            borderBottom:
              block.subheading
                ? '1px solid rgba(255,255,255,0.10)'
                : '1px solid transparent',
            padding: '2px 0 8px 0',
            marginBottom:
              block.subheading ? 12 : 4,
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => {
            e.target.style.borderBottomColor =
              'rgba(255,255,255,0.20)';
          }}
          onBlur={e => {
            e.target.style.borderBottomColor =
              block.subheading
                ? 'rgba(255,255,255,0.10)'
                : 'transparent';
          }}
        />
      )}

      {/* Route to correct editor by block type */}
      {block.type === 'text' ||
       block.type === 'long_text' ? (
        <TextEditor
          value={block.textContent}
          formatting={block.formatting}
          subBlocks={block.subBlocks}
          onTextChange={v =>
            onChange({ textContent: v })
          }
          onFormatChange={f =>
            onChange({ formatting: f })
          }
          onSubBlocksChange={s =>
            onChange({ subBlocks: s })
          }
        />
      ) : block.type === 'prompt' ? (
        <PromptBlockEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : block.type === 'code' ? (
        <CodeBlockEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : block.type === 'image' ? (
        <ImagePicker
          imageFile={block.imageFile}
          imagePreview={block.imagePreview}
          imageDescription={block.imageDescription}
          onImageChange={(f, preview) =>
            onChange({
              imageFile: f,
              imagePreview: preview,
            })
          }
          onDescriptionChange={d =>
            onChange({ imageDescription: d })
          }
        />
      ) : block.type === 'result' ? (
        <ResultBlockEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : block.type === 'comparison' ? (
        <ComparisonEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : block.type === 'agent_config' ? (
        <AgentConfigEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : block.type === 'workflow' ? (
        <WorkflowEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : block.type === 'model_params' ? (
        <ModelParamsEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : block.type === 'tool_setup' ? (
        <ToolSetupEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : block.type === 'resource' ? (
        <ResourceEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : block.type === 'tutorial_step' ? (
        <TutorialStepEditor
          block={block as any}
          update={update}
          index={0}
        />
      ) : (
        /* Fallback for unknown types */
        <textarea
          value={block.textContent}
          onChange={e =>
            onChange({ textContent: e.target.value })
          }
          placeholder="Enter content..."
          style={{
            width: '100%', background: 'transparent',
            border: 'none', outline: 'none',
            fontSize: 14,
            color: 'rgba(255,255,255,0.70)',
            lineHeight: 1.65, resize: 'none',
            fontFamily: 'Inter, sans-serif',
            minHeight: 80, boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}

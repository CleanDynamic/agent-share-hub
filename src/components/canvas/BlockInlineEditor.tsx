import type { CanvasBlock } from '@/lib/canvas-types';
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
  emptyBlock,
} from '@/components/ContentBlockBuilder';

interface BlockInlineEditorProps {
  block: CanvasBlock;
  onChange: (patch: Partial<CanvasBlock>) => void;
}

export function BlockInlineEditor({ block, onChange }: BlockInlineEditorProps) {
  const update = (_: number, patch: any) => onChange(patch);
  const defaults = emptyBlock(block.type as any);
  const safeBlock = { ...defaults, ...block } as any;
  const showSubheading = block.type !== 'section_heading';

  return (
    <div style={{ fontSize: 13 }}>
      {showSubheading && (
        <input
          value={block.subheading ?? ''}
          onChange={e => onChange({ subheading: e.target.value || null })}
          placeholder="Block title (optional)..."
          style={{
            width: '100%',
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 16, fontWeight: 600,
            color: 'rgba(255,255,255,0.88)',
            background: 'transparent',
            border: 'none', outline: 'none',
            borderBottom: '1px solid rgba(255,255,255,0.10)',
            padding: '4px 0 10px 0',
            marginBottom: 14,
            boxSizing: 'border-box',
          }}
        />
      )}

      {block.type === 'text' || block.type === 'long_text' ? (
        <TextEditor
          value={safeBlock.textContent}
          formatting={safeBlock.formatting}
          subBlocks={safeBlock.subBlocks}
          onTextChange={v => onChange({ textContent: v })}
          onFormatChange={f => onChange({ formatting: f })}
          onSubBlocksChange={s => onChange({ subBlocks: s })}
        />
      ) : block.type === 'prompt' ? (
        <PromptBlockEditor block={safeBlock} update={update} index={0} />
      ) : block.type === 'code' ? (
        <CodeBlockEditor block={safeBlock} update={update} index={0} />
      ) : block.type === 'image' ? (
        <ImagePicker
          imageFile={safeBlock.imageFile}
          imagePreview={safeBlock.imagePreview}
          imageDescription={safeBlock.imageDescription}
          onImageChange={(f, preview) => onChange({ imageFile: f, imagePreview: preview })}
          onDescriptionChange={d => onChange({ imageDescription: d })}
        />
      ) : block.type === 'result' ? (
        <ResultBlockEditor block={safeBlock} update={update} index={0} />
      ) : block.type === 'comparison' ? (
        <ComparisonEditor block={safeBlock} update={update} index={0} />
      ) : block.type === 'agent_config' ? (
        <AgentConfigEditor block={safeBlock} update={update} index={0} />
      ) : block.type === 'workflow' ? (
        <WorkflowEditor block={safeBlock} update={update} index={0} />
      ) : block.type === 'model_params' ? (
        <ModelParamsEditor block={safeBlock} update={update} index={0} />
      ) : block.type === 'tool_setup' ? (
        <ToolSetupEditor block={safeBlock} update={update} index={0} />
      ) : block.type === 'resource' ? (
        <ResourceEditor block={safeBlock} update={update} index={0} />
      ) : block.type === 'tutorial_step' ? (
        <TutorialStepEditor block={safeBlock} update={update} index={0} />
      ) : (
        <textarea
          value={safeBlock.textContent}
          onChange={e => onChange({ textContent: e.target.value })}
          placeholder="Enter content..."
          style={{
            width: '100%', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6, outline: 'none', fontSize: 14,
            color: 'rgba(255,255,255,0.70)',
            lineHeight: 1.65, resize: 'vertical',
            fontFamily: 'Inter, sans-serif',
            minHeight: 100, padding: 10,
            boxSizing: 'border-box',
          }}
        />
      )}
    </div>
  );
}

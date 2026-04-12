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
import { resolveVideoSources } from './MediaPopup';

interface BlockInlineEditorProps {
  block: CanvasBlock;
  onChange: (patch: Partial<CanvasBlock>) => void;
}

// ── Video block editor ──────────────────────────────
interface VideoEditorProps {
  block: any;
  onChange: (patch: Partial<CanvasBlock>) => void;
}

function VideoEditor({ block, onChange }: VideoEditorProps) {
  const currentUrl: string = block.videoUrl || block.videoPreview || '';
  const resolved = resolveVideoSources(currentUrl);

  const handleFile = (file: File | null) => {
    if (!file) {
      onChange({ videoFile: null, videoPreview: null });
      return;
    }
    const blobUrl = URL.createObjectURL(file);
    onChange({
      videoFile: file,
      videoPreview: blobUrl,
      videoUrl: blobUrl,
      videoFileName: file.name,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label
          style={{
            display: 'block',
            fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 4,
          }}
        >
          Video URL
        </label>
        <input
          type="url"
          value={block.videoUrl ?? ''}
          onChange={e => onChange({ videoUrl: e.target.value })}
          placeholder="YouTube, Vimeo, or direct video URL"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 6, outline: 'none',
            fontSize: 13,
            color: 'rgba(255,255,255,0.85)',
            padding: '8px 10px',
            fontFamily: 'Inter, sans-serif',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 4,
          }}
        >
          Or upload a file
        </label>
        <input
          type="file"
          accept="video/*"
          onChange={e => handleFile(e.target.files?.[0] ?? null)}
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.60)',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        {block.videoFileName && (
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.45)',
            marginTop: 4,
          }}>
            {block.videoFileName}
          </div>
        )}
      </div>

      {/* Thumbnail preview */}
      {resolved.thumbnailUrl && (
        <div style={{
          marginTop: 4,
          borderRadius: 8, overflow: 'hidden',
          background: 'rgba(0,0,0,0.40)',
          maxWidth: 320,
        }}>
          <img
            src={resolved.thumbnailUrl}
            alt="Video thumbnail"
            style={{
              width: '100%',
              display: 'block',
              objectFit: 'cover',
            }}
          />
          <div style={{
            fontSize: 10, color: 'rgba(255,255,255,0.45)',
            padding: '4px 8px',
            fontFamily: 'Inter, sans-serif',
          }}>
            {resolved.kind === 'youtube' ? 'YouTube' : 'Video'} thumbnail
          </div>
        </div>
      )}

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 10, fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.10em',
            color: 'rgba(255,255,255,0.45)',
            marginBottom: 4,
          }}
        >
          Caption (optional)
        </label>
        <input
          type="text"
          value={block.videoDescription ?? ''}
          onChange={e => onChange({ videoDescription: e.target.value })}
          placeholder="Short description…"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 6, outline: 'none',
            fontSize: 13,
            color: 'rgba(255,255,255,0.85)',
            padding: '8px 10px',
            fontFamily: 'Inter, sans-serif',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
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
      ) : block.type === 'video' ? (
        <VideoEditor block={safeBlock} onChange={onChange} />
      ) : block.type === 'sticky_note' ? (
        <textarea
          value={safeBlock.textContent}
          onChange={e => onChange({ textContent: e.target.value })}
          placeholder="Write a note…"
          style={{
            width: '100%',
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.25)',
            borderLeft: '3px solid #FBBF24',
            borderRadius: 6, outline: 'none',
            fontSize: 13, fontStyle: 'italic',
            color: 'rgba(255,255,255,0.80)',
            lineHeight: 1.6, resize: 'vertical',
            fontFamily: 'Inter, sans-serif',
            minHeight: 100, padding: 10,
            boxSizing: 'border-box',
          }}
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

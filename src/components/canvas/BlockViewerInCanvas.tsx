import { useState } from 'react';
import type { CanvasBlock } from '@/lib/canvas-types';

// Import the existing RenderBlockContent
// from ContentBlockViewer — this already handles
// all block type rendering correctly.
import { RenderBlockContent }
  from '@/components/ContentBlockViewer';
import { MediaPopup, resolveVideoSources } from './MediaPopup';

interface BlockViewerInCanvasProps {
  block: CanvasBlock;
  postType: string;
}

const COPYABLE_TYPES = new Set([
  'prompt', 'code', 'text', 'long_text',
  'result', 'agent_config', 'workflow',
  'model_params', 'tool_setup',
]);

const BLOCK_ACCENT: Record<string, string> = {
  prompt: '#E8571A',
  code: '#3B82F6',
  result: '#22C55E',
  agent_config: '#7C3AED',
  workflow: '#2EC4B6',
  tool_setup: '#06B6D4',
  model_params: '#A78BFA',
  comparison: '#EC4899',
};

export function BlockViewerInCanvas({
  block, postType,
}: BlockViewerInCanvasProps) {
  const [copied, setCopied] = useState(false);
  const [copyField, setCopyField] =
    useState<string | null>(null);
  const [mediaPopupOpen, setMediaPopupOpen] = useState(false);

  const isCopyable = COPYABLE_TYPES.has(block.type);
  const accent = BLOCK_ACCENT[block.type];

  // ── Image block thumbnail (click → popup) ────────────
  if (block.type === 'image') {
    const src = block.imageUrl || block.imagePreview || '';
    return (
      <div style={{ position: 'relative', height: '100%' }}>
        {block.subheading && (
          <h3 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 16, fontWeight: 700,
            color: 'rgba(255,255,255,0.90)',
            margin: '0 0 10px 0', lineHeight: 1.3,
          }}>
            {block.subheading}
          </h3>
        )}
        {src ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setMediaPopupOpen(true)}
            style={{
              width: '100%',
              height: block.subheading ? 'calc(100% - 32px)' : '100%',
              minHeight: 120,
              cursor: 'zoom-in',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <img
              src={src}
              alt={block.imageDescription ?? ''}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 8,
                display: 'block',
              }}
            />
          </div>
        ) : (
          <div style={{
            height: '100%', minHeight: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px dashed rgba(255,255,255,0.10)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12, fontStyle: 'italic',
          }}>
            No image
          </div>
        )}
        {mediaPopupOpen && src && (
          <MediaPopup
            open={mediaPopupOpen}
            onClose={() => setMediaPopupOpen(false)}
            kind="image"
            src={src}
            description={block.imageDescription ?? null}
          />
        )}
      </div>
    );
  }

  // ── Video block thumbnail (click → popup) ────────────
  if (block.type === 'video') {
    const videoUrl: string = block.videoUrl || block.videoPreview || '';
    const resolved = resolveVideoSources(videoUrl);
    const thumbSrc = resolved.thumbnailUrl;

    return (
      <div style={{ position: 'relative', height: '100%' }}>
        {block.subheading && (
          <h3 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 16, fontWeight: 700,
            color: 'rgba(255,255,255,0.90)',
            margin: '0 0 10px 0', lineHeight: 1.3,
          }}>
            {block.subheading}
          </h3>
        )}
        {videoUrl ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setMediaPopupOpen(true)}
            style={{
              width: '100%',
              height: block.subheading ? 'calc(100% - 32px)' : '100%',
              minHeight: 120,
              position: 'relative',
              cursor: 'zoom-in',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.55)',
            }}
          >
            {thumbSrc ? (
              <img
                src={thumbSrc}
                alt={block.videoDescription ?? ''}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 8,
                  display: 'block',
                }}
              />
            ) : resolved.kind === 'direct' ? (
              <video
                src={videoUrl}
                muted
                playsInline
                preload="metadata"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: 8,
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.45)',
                fontSize: 11, fontFamily: 'Inter, sans-serif',
              }}>
                Video
              </div>
            )}
            {/* Play button overlay */}
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 56, height: 56,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.65)',
              border: '2px solid rgba(255,255,255,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 0, height: 0,
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderLeft: '16px solid rgba(255,255,255,0.90)',
                marginLeft: 4,
              }} />
            </div>
          </div>
        ) : (
          <div style={{
            height: '100%', minHeight: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px dashed rgba(255,255,255,0.10)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12, fontStyle: 'italic',
          }}>
            No video
          </div>
        )}
        {mediaPopupOpen && videoUrl && (
          <MediaPopup
            open={mediaPopupOpen}
            onClose={() => setMediaPopupOpen(false)}
            kind="video"
            src={resolved.sourceUrl}
            embedUrl={resolved.embedUrl}
            description={block.videoDescription ?? null}
          />
        )}
      </div>
    );
  }

  const getTextToCopy = (): string => {
    switch (block.type) {
      case 'prompt':
        return block.textContent ?? '';
      case 'code':
        return block.textContent ?? '';
      case 'agent_config':
        return block.textContent ?? '';
      case 'model_params':
        return block.textContent ?? '';
      case 'tool_setup':
        return block.textContent ?? '';
      case 'result':
        return (block.resultAfter
          || block.resultBefore
          || block.textContent) ?? '';
      case 'workflow':
        return block.textContent ?? '';
      case 'text':
      case 'long_text':
        return block.textContent ?? '';
      default:
        return block.textContent ?? '';
    }
  };

  const handleCopy = async () => {
    const text = getTextToCopy();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative' }}>

      {/* Subheading */}
      {block.subheading && (
        <h3 style={{
          fontFamily:
            "'Playfair Display', Georgia, serif",
          fontSize: 16, fontWeight: 700,
          color: 'rgba(255,255,255,0.90)',
          margin: '0 0 12px 0', lineHeight: 1.3,
        }}>
          {block.subheading}
        </h3>
      )}

      {/* Copy button — always visible for
          copyable block types */}
      {isCopyable && (
        <button
          onClick={handleCopy}
          style={{
            position: 'absolute',
            top: 0, right: 0,
            fontSize: 10, padding: '3px 10px',
            borderRadius: 5,
            background: copied
              ? 'rgba(34,197,94,0.15)'
              : 'rgba(255,255,255,0.06)',
            border: `1px solid ${copied
              ? 'rgba(34,197,94,0.35)'
              : 'rgba(255,255,255,0.10)'}`,
            color: copied
              ? '#22C55E'
              : 'rgba(255,255,255,0.45)',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            transition: 'all 0.15s',
            zIndex: 2,
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      )}

      {/* Prompt blocks — orange left border box */}
      {block.type === 'prompt' && (
        <div style={{
          background: 'rgba(0,0,0,0.30)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeft: '3px solid rgba(232,87,26,0.55)',
          borderRadius: 8, padding: '12px 14px',
          paddingRight: 52, // space for copy btn
        }}>
          <pre style={{
            fontFamily:
              "'Playfair Display', Georgia, serif",
            fontSize: 14,
            color: 'rgba(255,255,255,0.82)',
            lineHeight: 1.75, whiteSpace: 'pre-wrap',
            wordBreak: 'break-word', margin: 0,
          }}>
            {block.textContent}
          </pre>
        </div>
      )}

      {/* Code blocks — blue left border + monospace */}
      {block.type === 'code' && (
        <div style={{
          background: 'rgba(0,0,0,0.40)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeft: '3px solid rgba(59,130,246,0.55)',
          borderRadius: 8, padding: '12px 14px',
          paddingRight: 52,
        }}>
          {block.codeLanguage && (
            <div style={{
              fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              color: 'rgba(59,130,246,0.70)',
              marginBottom: 8,
            }}>
              {block.codeLanguage}
            </div>
          )}
          <pre style={{
            fontFamily: 'Courier New, monospace',
            fontSize: 13,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.65, whiteSpace: 'pre-wrap',
            wordBreak: 'break-all', margin: 0,
          }}>
            {block.textContent}
          </pre>
        </div>
      )}

      {/* All other types: use existing RenderBlockContent */}
      {block.type !== 'prompt' &&
        block.type !== 'code' &&
        block.type !== 'section_heading' && (
        <div style={{ paddingRight: isCopyable ? 52 : 0 }}>
          <RenderBlockContent
            type={block.type}
            textContent={block.textContent}
            formatting={block.formatting}
            formattingType={block.formattingType}
            subBlocks={block.subBlocks}
            fileUrl={block.fileUrl}
            fileName={block.fileName}
            fileSizeBytes={block.fileSizeBytes}
            imageUrl={block.imageUrl
              || block.imagePreview}
            imageDescription={block.imageDescription}
            contentId={''}
            isBlogContent={postType === 'discussion'}
          />
        </div>
      )}

      {/* Text blocks */}
      {(block.type === 'text' ||
        block.type === 'long_text') && (
        <p style={{
          fontSize: 15, fontWeight: 400,
          color: 'rgba(255,255,255,0.72)',
          lineHeight: 1.75, margin: 0,
          fontFamily: 'Inter, sans-serif',
          paddingRight: 52,
        }}>
          {block.textContent}
        </p>
      )}
    </div>
  );
}

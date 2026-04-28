import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { StageGridExtension } from './StageGridExtension';
import { BlockRefExtension } from '@/components/canvas/tiptap/BlockRefExtension';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';
import { useDocumentStore } from '@/lib/documentStore';
import { parseDeepLinkHash, pulseElement } from '@/lib/deepLink';

const lowlight = createLowlight(common);

interface ArticleViewerProps {
  content: any; // TipTap JSON
  canvasDoc: ReturnType<typeof useCanvasDocument>;
}

export function ArticleViewer({ content, canvasDoc }: ArticleViewerProps) {
  const editor = useEditor({
    editable: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      ImageExtension.configure({ inline: false }),
      CodeBlockLowlight.configure({ lowlight }),
      StageGridExtension,
      BlockRefExtension,
    ],
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
  }, [content]);

  // Store canvasDoc in editor storage for StageGridNode
  useEffect(() => {
    if (editor) {
      const storage = editor.storage as any;
      if (!storage.articleEditor) {
        storage.articleEditor = {};
      }
      storage.articleEditor.canvasDoc = canvasDoc;
    }
  }, [editor, canvasDoc]);

  // ---- Deep-link hash handler -------------------------------------------
  // Supports /content/{id}#stage-{stageId} and /content/{id}#block-{blockId}.
  // Only runs once per (hash, canvasDoc-ready) pair to avoid re-scrolling on
  // every store update. Polls briefly for the target DOM node since the
  // article body / stage grids mount asynchronously after canvasDoc loads.
  const location = useLocation();
  const openStage = useDocumentStore((s) => s.openStage);
  const setSelection = useDocumentStore((s) => s.setSelection);
  const handledHashRef = useRef<string | null>(null);

  useEffect(() => {
    const parsed = parseDeepLinkHash(location.hash);
    if (!parsed) {
      handledHashRef.current = null;
      return;
    }
    if (canvasDoc.loading) return;
    const key = `${location.pathname}${location.hash}`;
    if (handledHashRef.current === key) return;

    // Resolve target stage id (and optional block id).
    let stageId: string | null = null;
    let blockId: string | null = null;
    if (parsed.kind === 'stage') {
      const stageExists = canvasDoc.stages.some((s: any) => s.id === parsed.id);
      if (!stageExists) {
        toast.error('That stage no longer exists');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        handledHashRef.current = key;
        return;
      }
      stageId = parsed.id;
    } else {
      const block = canvasDoc.blocks.find((b: any) => b.id === parsed.id);
      if (!block) {
        toast.error('That block no longer exists');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        handledHashRef.current = key;
        return;
      }
      stageId = (block as any).stage_id ?? null;
      blockId = parsed.id;
    }

    if (stageId) openStage(stageId);

    // Poll for the DOM element since StageGridNode renders asynchronously.
    let attempts = 0;
    const maxAttempts = 30; // ~1.5s @ 50ms
    const tick = () => {
      attempts += 1;
      const stageEl = stageId
        ? (document.querySelector<HTMLElement>(`[data-stage-id="${stageId}"]`))
        : null;
      if (stageEl) {
        stageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Give the scroll a beat to settle, then pulse + drill into block.
        window.setTimeout(() => {
          pulseElement(stageEl, 700);
          if (blockId) {
            // Block DOM mounts only after the stage opens to full mode.
            let blockAttempts = 0;
            const blockTick = () => {
              blockAttempts += 1;
              const blockEl = document.getElementById(`canvas-block-${blockId}`);
              if (blockEl) {
                blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setSelection({ kind: 'block', ids: [blockId] });
                window.setTimeout(() => pulseElement(blockEl, 700), 250);
                return;
              }
              if (blockAttempts < 30) window.setTimeout(blockTick, 50);
            };
            window.setTimeout(blockTick, 200);
          }
        }, 350);
        handledHashRef.current = key;
        return;
      }
      if (attempts < maxAttempts) window.setTimeout(tick, 50);
    };
    window.setTimeout(tick, 50);
  }, [location.pathname, location.hash, canvasDoc.loading, canvasDoc.stages, canvasDoc.blocks, openStage, setSelection]);
    <div style={{ maxWidth: 660, margin: '0 auto', padding: '32px 24px' }}>
      <style>{`
        .tiptap-article-view {
          font-family: 'Inter', sans-serif;
          color: rgba(255,255,255,0.85);
          line-height: 1.75;
          font-size: 14px;
          font-weight: 400;
          outline: none;
        }
        .tiptap-article-view h1 {
          font-family: 'Inter', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: rgba(255,255,255,0.92);
          margin: 32px 0 12px;
          line-height: 1.3;
        }
        .tiptap-article-view h2 {
          font-family: 'Inter', sans-serif;
          font-size: 18px;
          font-weight: 600;
          color: rgba(255,255,255,0.90);
          margin: 32px 0 12px;
          line-height: 1.35;
        }
        .tiptap-article-view h3 {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          margin: 24px 0 8px;
          line-height: 1.4;
        }
        .tiptap-article-view p {
          margin: 0 0 16px;
        }
        .tiptap-article-view blockquote {
          border-left: 2px solid rgba(232,87,26,0.4);
          padding-left: 16px;
          color: rgba(255,255,255,0.60);
          font-style: italic;
          margin: 16px 0;
        }
        .tiptap-article-view pre {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
          margin: 12px 0;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.5;
          color: rgba(255,255,255,0.75);
        }
        .tiptap-article-view code {
          background: rgba(255,255,255,0.06);
          border-radius: 4px;
          padding: 1px 4px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 12px;
          color: rgba(255,255,255,0.70);
        }
        .tiptap-article-view pre code {
          background: none;
          padding: 0;
        }
        .tiptap-article-view img {
          max-width: 100%;
          border-radius: 8px;
          margin: 12px 0;
        }
        .tiptap-article-view hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.08);
          margin: 24px 0;
        }
        .tiptap-article-view [data-stage-grid] {
          margin: 24px 0;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.06);
        }
      `}</style>

      <EditorContent
        editor={editor}
        className="tiptap-article-view"
      />
    </div>
  );
}

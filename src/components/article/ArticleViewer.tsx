import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { StageGridExtension } from './StageGridExtension';
import { BlockRefExtension } from '@/components/canvas/tiptap/BlockRefExtension';
import { useEffect } from 'react';
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';

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

  return (
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

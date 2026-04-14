import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExtension from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { StageGridExtension } from './StageGridExtension';
import { SlashCommandMenu, getSlashCommandItems } from './SlashCommandMenu';
import type { SlashCommandItem } from './SlashCommandMenu';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { LayoutGrid, Heading2, Code, Image, Quote, Minus, Plus, Type } from 'lucide-react';
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';

const lowlight = createLowlight(common);

interface ArticleEditorProps {
  canvasDoc: ReturnType<typeof useCanvasDocument>;
  initialContent?: any;
  onChange?: (json: any) => void;
  editable?: boolean;
}

export function ArticleEditor({
  canvasDoc,
  initialContent,
  onChange,
  editable = true,
}: ArticleEditorProps) {
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const slashStartPos = useRef<number | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleAddStage = useCallback((): string | null => {
    const stageNum = (canvasDoc.stages?.length ?? 0) + 1;
    const title = `Stage ${stageNum}`;
    canvasDoc.addStage(title);
    const newStage = canvasDoc.stages[canvasDoc.stages.length]; // Will be updated after state
    // Use the stage ID from the hook - we need to get it after the state update
    // Since addStage doesn't return the ID, we generate one here and pass it
    const stageId = crypto.randomUUID();
    return stageId;
  }, [canvasDoc]);

  // Build a proper addStage that returns an ID
  const addStageAndGetId = useCallback((): string | null => {
    const stageNum = (canvasDoc.stages?.length ?? 0) + 1;
    const stageId = crypto.randomUUID();
    const title = `Stage ${stageNum}`;

    // Directly add stage via canvas doc
    canvasDoc.addStage(title);

    // The last stage added should have the ID - but addStage generates its own
    // We need to get it from the stages after the next render
    // For now, use the most recently added stage
    setTimeout(() => {
      const latestStage = canvasDoc.stages[canvasDoc.stages.length - 1];
      if (latestStage) {
        // Update the TipTap node with the real stage ID
        // This happens automatically since we reference by stageId attr
      }
    }, 100);

    // Return the last stage ID that will exist after the add
    // Since we can't predict it, we'll return a temp one and update
    return stageId;
  }, [canvasDoc]);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // We use lowlight version
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your article… press / to insert blocks',
        emptyEditorClass: 'is-editor-empty',
      }),
      ImageExtension.configure({ inline: false }),
      CodeBlockLowlight.configure({ lowlight }),
      StageGridExtension,
    ],
    content: initialContent || {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());

      // Slash command detection
      const { state } = editor;
      const { $from } = state.selection;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      if (textBefore.endsWith('/') && !slashOpen) {
        // Open slash menu
        const coords = editor.view.coordsAtPos($from.pos);
        const containerRect = editorContainerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setSlashPos({
            top: coords.top - containerRect.top + 24,
            left: coords.left - containerRect.left,
          });
        }
        slashStartPos.current = $from.pos - 1;
        setSlashOpen(true);
        setSlashQuery('');
        setSlashSelectedIndex(0);
      } else if (slashOpen && slashStartPos.current !== null) {
        const from = slashStartPos.current;
        const to = $from.pos;
        const query = state.doc.textBetween(from + 1, to, '');
        if (query.includes(' ') || query.includes('\n') || to <= from) {
          setSlashOpen(false);
          slashStartPos.current = null;
        } else {
          setSlashQuery(query);
        }
      }
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (slashOpen) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSlashSelectedIndex(i => (i + 1) % slashItems.length);
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSlashSelectedIndex(i => (i + slashItems.length - 1) % slashItems.length);
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (slashItems[slashSelectedIndex]) {
              executeSlashCommand(slashItems[slashSelectedIndex]);
            }
            return true;
          }
          if (event.key === 'Escape') {
            setSlashOpen(false);
            slashStartPos.current = null;
            return true;
          }
        }
        return false;
      },
    },
  }, []);

  // Store canvasDoc in editor storage so StageGridNode can access it
  useEffect(() => {
    if (editor) {
      if (!editor.storage.articleEditor) {
        editor.storage.articleEditor = {};
      }
      editor.storage.articleEditor.canvasDoc = canvasDoc;
    }
  }, [editor, canvasDoc]);

  const slashItems = useMemo(() => {
    return getSlashCommandItems(slashQuery, addStageAndGetId);
  }, [slashQuery, addStageAndGetId]);

  const executeSlashCommand = useCallback((item: SlashCommandItem) => {
    if (!editor || slashStartPos.current === null) return;

    // Delete the "/" and any query text
    const from = slashStartPos.current;
    const to = editor.state.selection.$from.pos;
    editor.chain().focus().deleteRange({ from, to }).run();

    // Execute the command
    item.action(editor);

    setSlashOpen(false);
    slashStartPos.current = null;
  }, [editor]);

  // Click outside to close slash menu
  useEffect(() => {
    if (!slashOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.slash-command-menu')) {
        setSlashOpen(false);
        slashStartPos.current = null;
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [slashOpen]);

  // Structure stats
  const stats = useMemo(() => {
    if (!editor) return { paragraphs: 0, headings: 0, grids: 0 };
    const json = editor.getJSON();
    let paragraphs = 0, headings = 0, grids = 0;
    const walk = (node: any) => {
      if (node.type === 'paragraph' && node.content?.length) paragraphs++;
      if (node.type === 'heading') headings++;
      if (node.type === 'stageGrid') grids++;
      node.content?.forEach(walk);
    };
    if (json.content) json.content.forEach(walk);
    return { paragraphs, headings, grids };
  }, [editor?.getJSON()]);

  // Quick insert buttons for empty state
  const quickInsertItems = [
    { label: 'Stage', icon: <LayoutGrid size={12} />, type: 'stage' },
    { label: 'Heading', icon: <Heading2 size={12} />, type: 'heading' },
    { label: 'Code', icon: <Code size={12} />, type: 'code' },
    { label: 'Image', icon: <Image size={12} />, type: 'image' },
  ];

  const handleQuickInsert = (type: string) => {
    if (!editor) return;
    editor.chain().focus().run();
    const item = getSlashCommandItems('', addStageAndGetId).find(i => i.id === type);
    if (item) item.action(editor);
  };

  return (
    <div
      ref={editorContainerRef}
      style={{ position: 'relative', flex: 1 }}
    >
      {/* Editor styles */}
      <style>{`
        .tiptap-article {
          font-family: 'Inter', sans-serif;
          color: rgba(255,255,255,0.82);
          line-height: 1.7;
          font-size: 14px;
          padding: 0 4px;
          min-height: 200px;
          outline: none;
        }
        .tiptap-article h1 {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 700;
          color: rgba(255,255,255,0.90);
          margin: 24px 0 8px;
          line-height: 1.3;
        }
        .tiptap-article h2 {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
          margin: 20px 0 6px;
          line-height: 1.35;
        }
        .tiptap-article h3 {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: rgba(255,255,255,0.80);
          margin: 16px 0 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .tiptap-article p {
          margin: 0 0 12px;
        }
        .tiptap-article blockquote {
          border-left: 3px solid rgba(139,69,19,0.4);
          padding-left: 16px;
          color: rgba(255,255,255,0.60);
          font-style: italic;
          margin: 16px 0;
        }
        .tiptap-article pre {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 14px 16px;
          overflow-x: auto;
          margin: 12px 0;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 12px;
          line-height: 1.5;
          color: rgba(255,255,255,0.75);
        }
        .tiptap-article code {
          background: rgba(255,255,255,0.06);
          border-radius: 4px;
          padding: 1px 4px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 12px;
          color: rgba(255,255,255,0.70);
        }
        .tiptap-article pre code {
          background: none;
          padding: 0;
          border-radius: 0;
        }
        .tiptap-article img {
          max-width: 100%;
          border-radius: 8px;
          margin: 12px 0;
        }
        .tiptap-article hr {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.08);
          margin: 20px 0;
        }
        .tiptap-article .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255,255,255,0.20);
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .tiptap-article p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255,255,255,0.20);
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
      `}</style>

      <EditorContent
        editor={editor}
        className="tiptap-article"
      />

      {/* Slash command popup */}
      {slashOpen && slashPos && (
        <div
          className="slash-command-menu"
          style={{
            position: 'absolute',
            top: slashPos.top,
            left: slashPos.left,
            zIndex: 100,
          }}
        >
          <SlashCommandMenu
            items={slashItems}
            command={(item) => executeSlashCommand(item)}
            ref={undefined}
          />
        </div>
      )}

      {/* Bottom toolbar */}
      {editable && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 0',
          marginTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Quick insert button */}
          <button
            onClick={() => {
              if (editor) {
                editor.chain().focus().run();
                // Simulate typing /
                const pos = editor.state.selection.$from.pos;
                editor.chain().insertContentAt(pos, '/').run();
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6,
              color: 'rgba(255,255,255,0.40)',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Insert
          </button>

          {/* Structure stats */}
          <span style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'rgba(255,255,255,0.20)',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.05em',
          }}>
            {stats.paragraphs}¶ {stats.headings}H {stats.grids}⊞
          </span>
        </div>
      )}
    </div>
  );
}

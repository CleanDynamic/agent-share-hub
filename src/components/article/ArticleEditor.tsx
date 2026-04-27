import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExtension from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { common, createLowlight } from 'lowlight';
import { StageGridExtension } from './StageGridExtension';
import { BlockRefExtension } from '@/components/canvas/tiptap/BlockRefExtension';
import { TopToolbar } from './TopToolbar';
import { TableContextMenu } from './TableContextMenu';
import { StatusBar } from './StatusBar';
import { BubbleToolbar } from './BubbleToolbar';
import { CommentsOverlay } from './comments/CommentsOverlay';
import type { CommentAnchor } from '@/hooks/useDocumentComments';
import { FormattingShortcuts } from './KeyboardShortcutsExtension';
import { SearchHighlight } from './SearchHighlight';
import { FindReplaceBar } from './FindReplaceBar';
import { BlockReferenceExtension } from './tiptap/BlockReferenceExtension';
import { BlockPickerMenu, type BlockPickerItem } from './tiptap/BlockPickerMenu';
import { SlashCommandMenu, getSlashCommandItems } from './SlashCommandMenu';
import type { SlashCommandItem } from './SlashCommandMenu';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import CharacterCount from '@tiptap/extension-character-count';
import { LayoutGrid, Heading2, Code, Image, Quote, Minus, Plus, Type, Save, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';
import { useDocumentStore } from '@/lib/documentStore';
import { usePersistenceStatus } from '@/lib/documentPersistence';

const lowlight = createLowlight(common);

interface ArticleEditorProps {
  canvasDoc: ReturnType<typeof useCanvasDocument>;
  initialContent?: any;
  onChange?: (json: any) => void;
  editable?: boolean;
  onSelectedStageChange?: (stageId: string | null) => void;
  documentTitle?: string;
  onOpenTemplates?: () => void;
  onOpenHistory?: () => void;
  onOpenNotes?: () => void;
  onGrammarCheck?: () => void;
  onClearAll?: () => void;
  onSave?: () => void;
  onPublish?: () => void;
  saving?: boolean;
  publishing?: boolean;
}

export function ArticleEditor({
  canvasDoc,
  initialContent,
  onChange,
  editable = true,
  onSelectedStageChange,
  documentTitle = '',
  onOpenTemplates,
  onOpenHistory,
  onOpenNotes,
  onGrammarCheck,
  onClearAll,
  onSave,
  onPublish,
  saving = false,
  publishing = false,
}: ArticleEditorProps) {
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const [editorFocused, setEditorFocused] = useState(false);
  const [insertHovered, setInsertHovered] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findShowReplace, setFindShowReplace] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [refQuery, setRefQuery] = useState('');
  const [refPos, setRefPos] = useState<{ top: number; left: number } | null>(null);
  const [refSelectedIndex, setRefSelectedIndex] = useState(0);
  const [refItems, setRefItems] = useState<BlockPickerItem[]>([]);
  const refStartPos = useRef<number | null>(null);
  const slashStartPos = useRef<number | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const setDocumentTitle = useDocumentStore((state) => state.setDocumentTitle);
  const focusMode = useDocumentStore((state) => state.focusMode);
  const presence = useDocumentStore((state) => state.presence);
  const documentId = useDocumentStore((state) => state.documentId);
  const selection = useDocumentStore((state) => state.selection);
  const [pendingCommentAnchor, setPendingCommentAnchor] = useState<CommentAnchor | null>(null);
  const [unresolvedComments, setUnresolvedComments] = useState(0);
  const { saveStatus } = usePersistenceStatus();

  const handleAddStage = useCallback((): string | null => {
    const title = '';
    canvasDoc.addStage(title);
    const newStage = canvasDoc.stages[canvasDoc.stages.length]; // Will be updated after state
    const stageId = crypto.randomUUID();
    return stageId;
  }, [canvasDoc]);

  // Build a proper addStage that returns an ID
  const addStageAndGetId = useCallback((): string | null => {
    const stageId = crypto.randomUUID();
    const title = '';

    canvasDoc.addStage(title);

    setTimeout(() => {
      const latestStage = canvasDoc.stages[canvasDoc.stages.length - 1];
      if (latestStage) {
        // Update the TipTap node with the real stage ID
      }
    }, 100);

    return stageId;
  }, [canvasDoc]);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your article… press / to insert blocks',
        emptyEditorClass: 'is-editor-empty',
      }),
      ImageExtension.configure({ inline: false }),
      CodeBlockLowlight.configure({ lowlight }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'tiptap-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
      StageGridExtension,
      BlockRefExtension,
      FormattingShortcuts,
      SearchHighlight,
      BlockReferenceExtension,
    ],
    content: initialContent || {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
    onSelectionUpdate: ({ editor }) => {
      if (!onSelectedStageChange) return;
      const { selection } = editor.state;
      const selectedNode = (selection as any).node;
      if (selectedNode?.type?.name === 'stageGrid') {
        onSelectedStageChange(selectedNode.attrs?.stageId ?? null);
        return;
      }
      const { $from } = selection;
      for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === 'stageGrid') {
          onSelectedStageChange(node.attrs?.stageId ?? null);
          return;
        }
      }
      onSelectedStageChange(null);
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());

      const { state } = editor;
      const { $from } = state.selection;
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      if (textBefore.endsWith('/') && !slashOpen) {
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

      // Block-reference picker triggered by "[["
      if (textBefore.endsWith('[[') && !refOpen) {
        const coords = editor.view.coordsAtPos($from.pos);
        const containerRect = editorContainerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setRefPos({
            top: coords.top - containerRect.top + 24,
            left: coords.left - containerRect.left,
          });
        }
        refStartPos.current = $from.pos - 2;
        setRefOpen(true);
        setRefQuery('');
        setRefSelectedIndex(0);
      } else if (refOpen && refStartPos.current !== null) {
        const from = refStartPos.current;
        const to = $from.pos;
        const query = state.doc.textBetween(from + 2, to, '');
        if (query.includes('\n') || query.includes(']]') || to < from + 2) {
          setRefOpen(false);
          refStartPos.current = null;
        } else {
          setRefQuery(query);
        }
      }
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        if (slashOpen) {
          if (event.key === 'ArrowDown' && slashItems.length > 0) {
            event.preventDefault();
            setSlashSelectedIndex(i => (i + 1) % slashItems.length);
            return true;
          }
          if (event.key === 'ArrowUp' && slashItems.length > 0) {
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
    setDocumentTitle(documentTitle);
  }, [documentTitle, setDocumentTitle]);

  useEffect(() => {
    if (editor) {
      const storage = editor.storage as any;
      if (!storage.articleEditor) {
        storage.articleEditor = {};
      }
      storage.articleEditor.canvasDoc = canvasDoc;
    }
  }, [editor, canvasDoc]);

  // Cmd/Ctrl+F → find; Cmd/Ctrl+Shift+F → find + replace; Esc → close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
        setFindShowReplace(e.shiftKey);
      } else if (e.key === 'Escape' && findOpen) {
        setFindOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [findOpen]);

  // Build a comment anchor from the current selection state
  const buildCommentAnchor = useCallback((): CommentAnchor | null => {
    // 1. Prose selection (non-empty TipTap selection)
    if (editor) {
      const { from, to, empty } = editor.state.selection;
      if (!empty && from !== to) {
        return { type: 'prose', data: { from, to } };
      }
    }
    // 2. Selected stage / block / arrow from the document store
    if (selection?.kind === 'block' && selection.ids[0]) {
      return { type: 'block', data: { id: selection.ids[0] } };
    }
    if (selection?.kind === 'stage' && selection.ids[0]) {
      return { type: 'stage', data: { id: selection.ids[0] } };
    }
    if (selection?.kind === 'arrow' && selection.ids[0]) {
      return { type: 'arrow', data: { id: selection.ids[0] } };
    }
    // 3. Fallback: caret position in prose
    if (editor) {
      const { from } = editor.state.selection;
      return { type: 'prose', data: { from, to: from } };
    }
    return null;
  }, [editor, selection]);

  const triggerAddComment = useCallback(() => {
    const anchor = buildCommentAnchor();
    if (!anchor) {
      toast('Select some text or a block to comment on');
      return;
    }
    if (!documentId) {
      toast('Save the document first to add comments');
      return;
    }
    setPendingCommentAnchor(anchor);
  }, [buildCommentAnchor, documentId]);

  // Cmd/Ctrl+Shift+M → add comment
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        triggerAddComment();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [triggerAddComment]);


  const slashItems = useMemo(() => {
    return getSlashCommandItems(slashQuery);
  }, [slashQuery]);

  const metrics = useMemo(() => {
    const storage = editor?.storage as any;
    const characterCount = storage?.characterCount?.characters?.() ?? 0;
    const wordCount = storage?.characterCount?.words?.() ?? 0;
    const readingMinutes = Math.max(1, Math.ceil(wordCount / 220));

    return { characterCount, wordCount, readingMinutes };
  }, [editor?.state, editor]);

  const collaboratorCount = useMemo(() => Object.keys(presence ?? {}).length, [presence]);

  const executeSlashCommand = useCallback((item: SlashCommandItem) => {
    if (!editor || slashStartPos.current === null) return;

    const from = slashStartPos.current;
    const to = editor.state.selection.$from.pos;
    editor.chain().focus().deleteRange({ from, to }).run();

    if (item.phaseLabel || !item.action) {
      toast(item.phaseLabel ?? 'Coming in Phase X');
      setSlashOpen(false);
      slashStartPos.current = null;
      return;
    }

    item.action(editor);

    setSlashOpen(false);
    slashStartPos.current = null;
  }, [editor]);

  const handleSlashSelect = useCallback((itemId: string) => {
    const item = slashItems.find((entry) => entry.id === itemId);
    if (!item) return;
    executeSlashCommand(item);
  }, [executeSlashCommand, slashItems]);

  const insertBlockReference = useCallback((item: BlockPickerItem) => {
    if (!editor || refStartPos.current === null) return;
    const from = refStartPos.current;
    const to = editor.state.selection.$from.pos;
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent({
        type: 'blockReference',
        attrs: {
          blockId: item.blockId,
          blockName: item.blockName,
          blockType: item.blockType,
          stageId: item.stageId,
        },
      })
      .insertContent(' ')
      .run();
    setRefOpen(false);
    refStartPos.current = null;
  }, [editor]);

  // Block-reference picker keyboard navigation
  useEffect(() => {
    if (!refOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setRefSelectedIndex((i) =>
          refItems.length === 0 ? 0 : (i + 1) % refItems.length,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setRefSelectedIndex((i) =>
          refItems.length === 0
            ? 0
            : (i + refItems.length - 1) % refItems.length,
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = refItems[refSelectedIndex];
        if (item) insertBlockReference(item);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setRefOpen(false);
        refStartPos.current = null;
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [refOpen, refItems, refSelectedIndex, insertBlockReference]);

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
    const itemMap: Record<string, string> = {
      stage: 'stage-grid',
      heading: 'heading-2',
      code: 'code-block',
      image: 'image',
    };
    const item = getSlashCommandItems('').find(i => i.id === (itemMap[type] ?? type));
    if (!item) return;
    if (item.phaseLabel || !item.action) {
      toast(item.phaseLabel ?? 'Coming in Phase X');
      return;
    }
    item.action(editor);
  };

  // Track editor focus via focusin/focusout on the container
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;
    const onFocusIn = () => setEditorFocused(true);
    const onFocusOut = (e: FocusEvent) => {
      if (!container.contains(e.relatedTarget as Node)) {
        setEditorFocused(false);
      }
    };
    container.addEventListener('focusin', onFocusIn);
    container.addEventListener('focusout', onFocusOut);
    return () => {
      container.removeEventListener('focusin', onFocusIn);
      container.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <div
      ref={editorContainerRef}
      style={{ position: 'relative', flex: 1 }}
    >
      {/* Editor styles */}
      <style>{`
        .tiptap-article {
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          min-height: 300px;
          background: ${focusMode === 'focus' ? 'hsl(var(--foreground) / 0.015)' : 'transparent'};
          border: ${focusMode === 'focus' ? `0.5px solid ${editorFocused ? 'hsl(var(--foreground) / 0.08)' : 'hsl(var(--foreground) / 0.05)'}` : '0.5px solid transparent'};
          border-radius: 8px;
          transition: border-color 200ms ease, background 200ms ease;
        }
        .tiptap-article .ProseMirror {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          line-height: 1.5;
          color: hsl(var(--foreground) / 0.92);
          padding: 48px 24px 32px;
          min-height: 300px;
          outline: none;
          caret-color: hsl(18 79% 54%);
        }
        .tiptap-article .ProseMirror-focused {
          caret-color: hsl(18 79% 54%);
        }
        .tiptap-article .ProseMirror::selection,
        .tiptap-article .ProseMirror *::selection {
          background: hsl(18 79% 54% / 0.2);
        }
        .tiptap-article h1 {
          font-family: 'Inter', sans-serif;
          font-size: 28px;
          font-weight: 700;
          color: hsl(var(--foreground) / 0.95);
          margin: 40px 0 12px;
          line-height: 1.3;
        }
        .tiptap-article h2 {
          font-family: 'Inter', sans-serif;
          font-size: 22px;
          font-weight: 600;
          color: hsl(var(--foreground) / 0.92);
          margin: 32px 0 10px;
          line-height: 1.35;
        }
        .tiptap-article h3 {
          font-family: 'Inter', sans-serif;
          font-size: 18px;
          font-weight: 600;
          color: hsl(var(--foreground) / 0.9);
          margin: 24px 0 8px;
          line-height: 1.4;
        }
        .tiptap-article p {
          margin: 0 0 18px;
        }
        .tiptap-article blockquote {
          border-left: 2px solid hsl(18 79% 54% / 0.4);
          padding-left: 20px;
          color: hsl(var(--foreground) / 0.65);
          font-style: italic;
          margin: 18px 0;
        }
        .tiptap-article pre {
          background: hsl(var(--foreground) / 0.03);
          border: 0.5px solid hsl(var(--foreground) / 0.08);
          border-radius: 8px;
          padding: 14px 16px;
          overflow-x: auto;
          margin: 12px 0;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          line-height: 1.5;
          color: hsl(var(--foreground) / 0.78);
        }
        .tiptap-article code {
          background: hsl(var(--foreground) / 0.06);
          border-radius: 3px;
          padding: 1px 5px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 13px;
          color: hsl(var(--foreground) / 0.85);
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
        .tiptap-article [data-stage-grid] {
          margin: 16px 0;
          border-radius: 8px;
        }
        .tiptap-article hr {
          border: none;
          border-top: 0.5px solid hsl(var(--foreground) / 0.08);
          margin: 20px 0;
        }
        .tiptap-article .ProseMirror p.is-editor-empty:first-child::before,
        .tiptap-article .ProseMirror .is-editor-empty:first-child::before {
          content: 'Tell your story...';
          float: left;
          color: hsl(var(--foreground) / 0.2);
          pointer-events: none;
          height: 0;
          font-style: italic;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          font-weight: 400;
        }
        .tiptap-article .ProseMirror-gapcursor:after {
          border-top-color: hsl(18 79% 54%);
          animation: articleCaretBlink 1.2s step-end infinite;
        }
        .tiptap-article table.tiptap-table {
          border-collapse: collapse;
          margin: 16px 0;
          width: 100%;
          table-layout: fixed;
          overflow: hidden;
        }
        .tiptap-article table.tiptap-table td,
        .tiptap-article table.tiptap-table th {
          border: 1px solid hsl(var(--foreground) / 0.15);
          padding: 6px 8px;
          vertical-align: top;
          position: relative;
          min-width: 60px;
        }
        .tiptap-article table.tiptap-table th {
          background: hsl(var(--foreground) / 0.06);
          font-weight: 600;
          text-align: left;
        }
        .tiptap-article table.tiptap-table .selectedCell:after {
          content: '';
          position: absolute;
          inset: 0;
          background: hsl(var(--primary, 18 79% 54%) / 0.15);
          pointer-events: none;
        }
        .tiptap-article .column-resize-handle {
          position: absolute;
          right: -2px;
          top: 0;
          bottom: 0;
          width: 4px;
          background: hsl(var(--primary, 18 79% 54%) / 0.5);
          cursor: col-resize;
        }
        .tiptap-article .sh-match {
          background: rgba(232, 87, 26, 0.25);
          border-radius: 2px;
        }
        .tiptap-article .sh-match-active {
          background: rgba(232, 87, 26, 0.5);
        }
        .tiptap-article p.caption {
          font-size: 13px;
          color: hsl(var(--foreground) / 0.55);
          font-style: italic;
          text-align: center;
          margin: 4px 0 16px;
        }
        .tiptap-article blockquote[data-callout="true"] {
          background: hsl(var(--secondary) / 0.08);
          border-left: 3px solid hsl(var(--secondary));
          padding: 12px 16px;
          border-radius: 6px;
          margin: 16px 0;
          font-style: normal;
          color: hsl(var(--foreground) / 0.85);
        }
        .tiptap-article ul,
        .tiptap-article ol {
          padding-left: 1.5rem;
          margin: 12px 0 18px;
          color: hsl(var(--foreground) / 0.85);
        }
        .tiptap-article ul {
          list-style: disc;
        }
        .tiptap-article ol {
          list-style: decimal;
        }
        .tiptap-article ul ul {
          list-style: circle;
        }
        .tiptap-article ul ul ul {
          list-style: square;
        }
        .tiptap-article li {
          margin: 4px 0;
          padding-left: 4px;
        }
        .tiptap-article li > p {
          margin: 0 0 4px;
        }
        .tiptap-article ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .tiptap-article ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 4px 0;
        }
        .tiptap-article ul[data-type="taskList"] li > label {
          flex-shrink: 0;
          margin-top: 4px;
          user-select: none;
        }
        .tiptap-article ul[data-type="taskList"] li > div {
          flex: 1;
        }
        .tiptap-article ul[data-type="taskList"] li[data-checked="true"] > div {
          color: hsl(var(--foreground) / 0.45);
          text-decoration: line-through;
        }
        .tiptap-article .video-embed {
          position: relative;
          width: 100%;
          padding-bottom: 56.25%;
          margin: 16px 0;
          border-radius: 8px;
          overflow: hidden;
          background: hsl(var(--foreground) / 0.05);
        }
        .tiptap-article .video-embed iframe,
        .tiptap-article .video-embed video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
      `}</style>

      <TopToolbar editor={editor} onInsertBlock={() => handleQuickInsert('stage')} />

      <FindReplaceBar
        editor={editor}
        open={findOpen}
        showReplace={findShowReplace}
        onClose={() => setFindOpen(false)}
        onToggleReplace={setFindShowReplace}
      />

      <TableContextMenu editor={editor}>
        <EditorContent
          editor={editor}
          className="tiptap-article"
          style={{
            width: '100%',
            maxWidth: 720,
            margin: '0 auto',
          }}
        />
      </TableContextMenu>

      {/* Bubble toolbar over text selection */}
      <BubbleToolbar
        editor={editor}
        containerRef={editorContainerRef}
        onAddComment={triggerAddComment}
      />

      {/* Comments overlay (markers + thread cards) */}
      <CommentsOverlay
        documentId={documentId}
        editor={editor}
        containerRef={editorContainerRef}
        pendingAnchor={pendingCommentAnchor}
        onPendingHandled={() => setPendingCommentAnchor(null)}
        onUnresolvedCountChange={setUnresolvedComments}
      />

      {/* Slash command popup */}
      <SlashCommandMenu
        isOpen={slashOpen && Boolean(slashPos)}
        query={slashQuery}
        position={{ x: slashPos?.left ?? 0, y: slashPos?.top ?? 0 }}
        items={slashItems}
        selectedIndex={slashSelectedIndex}
        onSelectedIndexChange={setSlashSelectedIndex}
        onSelect={handleSlashSelect}
        onClose={() => {
          setSlashOpen(false);
          slashStartPos.current = null;
        }}
      />

      <BlockPickerMenu
        isOpen={refOpen && Boolean(refPos)}
        query={refQuery}
        position={refPos ? { x: refPos.left, y: refPos.top } : null}
        selectedIndex={refSelectedIndex}
        onSelectedIndexChange={setRefSelectedIndex}
        onSelect={insertBlockReference}
        onClose={() => {
          setRefOpen(false);
          refStartPos.current = null;
        }}
        onItemsChange={setRefItems}
      />

      {editable ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0 6px',
            }}
          >
            <button
              type="button"
              onClick={() => handleQuickInsert('stage')}
              title="Insert Stage Grid"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 30,
                padding: '0 12px',
                borderRadius: 6,
                border: '0.5px solid hsl(18 79% 54% / 0.35)',
                background: 'hsl(18 79% 54% / 0.10)',
                color: 'hsl(var(--foreground) / 0.92)',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={13} strokeWidth={1.8} />
              Insert Grid
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 30,
                padding: '0 12px',
                borderRadius: 6,
                border: '0.5px solid hsl(var(--foreground) / 0.1)',
                background: 'transparent',
                color: 'hsl(var(--foreground) / 0.62)',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Save size={13} strokeWidth={1.8} />
              Save
            </button>

            <button
              type="button"
              onClick={onPublish}
              disabled={publishing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 30,
                padding: '0 14px',
                borderRadius: 6,
                border: '0.5px solid hsl(var(--secondary) / 0.35)',
                background: 'hsl(var(--secondary) / 0.14)',
                color: 'hsl(var(--foreground) / 0.96)',
                boxShadow: '0 8px 24px hsl(var(--secondary) / 0.12)',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: 600,
                cursor: publishing ? 'not-allowed' : 'pointer',
                opacity: publishing ? 0.65 : 1,
              }}
            >
              <Send size={13} strokeWidth={1.8} />
              Publish
            </button>
          </div>
          <div style={{ width: '100%', minWidth: 0 }}>
            <StatusBar
              documentTitle={documentTitle}
              wordCount={metrics.wordCount}
              characterCount={metrics.characterCount}
              readingMinutes={metrics.readingMinutes}
              saveStatus={saveStatus}
              zoom={100}
              focusMode={focusMode}
              collaborators={collaboratorCount}
              unresolvedComments={unresolvedComments}
              onCommentsClick={triggerAddComment}
              onZoomChange={() => {}}
              onMoreTemplates={onOpenTemplates}
              onMoreGrammarCheck={onGrammarCheck}
              onMoreHistory={onOpenHistory}
              onMoreNotes={onOpenNotes}
              onMoreClearAll={onClearAll}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

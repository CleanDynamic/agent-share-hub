import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  List,
  ListOrdered,
  CheckSquare,
  ChevronRight,
  Minus,
  MessageSquare,
  Quote,
  LayoutGrid,
  Link2,
  Eye,
  Image,
  Video,
  Music,
  Code2,
  File,
  Table,
  Braces,
  Sigma,
  Superscript,
  Columns3,
  Sparkles,
  PenLine,
  FileText,
  ArrowRight,
  Bot,
  Columns2,
  Heading,
  Cpu,
  StickyNote,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDocumentStore } from '@/lib/documentStore';
import type { Block } from '@/types/document';

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  shortcut?: string;
  category: string;
  action?: (editor: Editor) => void;
  phaseLabel?: string;
}

/**
 * Insert a canvas block into the most recently created stage. Used by the
 * slash menu's CANVAS category for quick insertion without opening the Add
 * Block modal. If no stage exists yet, the user is told to insert one first.
 */
function insertCanvasBlock(type: Block['type']) {
  const store = useDocumentStore.getState();
  const stages = Object.values(store.stages);
  if (stages.length === 0) {
    toast.error('Insert a stage grid first');
    return;
  }
  const latest = stages.sort(
    (a, b) => (b.order_in_document ?? 0) - (a.order_in_document ?? 0),
  )[0];

  // Find a free row by stacking below existing blocks in the same stage.
  const stageBlocks = Object.values(store.blocks).filter(
    (b) => b.stage_id === latest.id,
  );
  const maxBottom = stageBlocks.reduce(
    (acc, b) => Math.max(acc, b.position_y + b.height),
    0,
  );

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `block-${Date.now()}`;
  const now = new Date().toISOString();
  const block: Block = {
    id,
    stage_id: latest.id,
    type,
    position_x: 40,
    position_y: maxBottom > 0 ? maxBottom + 20 : 40,
    width: 240,
    height: 200,
    z_index: 0,
    name: null,
    properties: {},
    locked: false,
    created_at: now,
    updated_at: now,
  };
  store.addBlock(block);
  store.setSelection({ kind: 'block', ids: [id] });
}

const MENU_ITEMS: SlashCommandItem[] = [
  { id: 'heading-1', label: 'Heading 1', description: 'Large section heading', icon: Heading1, shortcut: '⌘⌥1', category: 'BASIC', action: (editor) => editor.chain().focus().setHeading({ level: 1 }).run() },
  { id: 'heading-2', label: 'Heading 2', description: 'Medium section heading', icon: Heading2, shortcut: '⌘⌥2', category: 'BASIC', action: (editor) => editor.chain().focus().setHeading({ level: 2 }).run() },
  { id: 'heading-3', label: 'Heading 3', description: 'Small section heading', icon: Heading3, shortcut: '⌘⌥3', category: 'BASIC', action: (editor) => editor.chain().focus().setHeading({ level: 3 }).run() },
  { id: 'body', label: 'Body', description: 'Plain text paragraph', icon: Type, shortcut: '⌘⌥0', category: 'BASIC', action: (editor) => editor.chain().focus().setParagraph().run() },
  { id: 'bulleted-list', label: 'Bulleted list', description: 'Simple unordered list', icon: List, shortcut: '⌘⇧8', category: 'BASIC', action: (editor) => editor.chain().focus().toggleBulletList().run() },
  { id: 'numbered-list', label: 'Numbered list', description: 'Numbered ordered list', icon: ListOrdered, shortcut: '⌘⇧7', category: 'BASIC', action: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { id: 'checklist', label: 'Checklist', description: 'Track tasks with checkboxes', icon: CheckSquare, shortcut: '⌘⇧9', category: 'BASIC', phaseLabel: 'Coming in Phase X' },
  { id: 'toggle', label: 'Toggle', description: 'Collapsible content section', icon: ChevronRight, category: 'BASIC', phaseLabel: 'Coming in Phase X' },
  { id: 'divider', label: 'Divider', description: 'Visual section separator', icon: Minus, shortcut: '---', category: 'BASIC', action: (editor) => editor.chain().focus().setHorizontalRule().run() },
  { id: 'callout', label: 'Callout', description: 'Highlighted information block', icon: MessageSquare, category: 'BASIC', phaseLabel: 'Coming in Phase X' },
  { id: 'quote', label: 'Quote', description: 'Quoted text block', icon: Quote, shortcut: '⌘⇧.', category: 'BASIC', action: (editor) => editor.chain().focus().setBlockquote().run() },
  { id: 'stage-grid', label: 'Stage grid', description: 'Arrange blocks visually', icon: LayoutGrid, category: 'CANVAS', action: (editor) => {
      const stageId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `stage-${Date.now()}`;
      const storage = editor.storage as any;
      const canvasDoc = storage?.articleEditor?.canvasDoc;
      const stageNum = (canvasDoc?.stages?.length ?? 0) + 1;
      const stageTitle = `Stage ${stageNum}`;
      try { canvasDoc?.addStage?.(stageTitle); } catch (e) { /* noop */ }
      editor.chain().focus().insertContent({
        type: 'stageGrid',
        attrs: { stageId, stageTitle, gridSpacing: 20, height: 360, openTemplatesOnMount: true },
      }).run();
    } },
  { id: 'block-reference', label: 'Block reference', description: 'Link to another block', icon: Link2, category: 'CANVAS', phaseLabel: 'Coming in Phase X' },
  { id: 'inline-block-preview', label: 'Inline block preview', description: 'Preview block inline', icon: Eye, category: 'CANVAS', phaseLabel: 'Coming in Phase X' },
  { id: 'agent-block', label: 'Agent block', description: 'Add an AI agent into the latest stage', icon: Bot, category: 'CANVAS', action: () => insertCanvasBlock('agent') },
  { id: 'compare-block', label: 'Compare block', description: 'Side-by-side comparison of two options', icon: Columns2, category: 'CANVAS', action: () => insertCanvasBlock('compare') },
  { id: 'heading-block', label: 'Heading block', description: 'Add a heading block to the latest stage', icon: Heading, category: 'CANVAS', action: () => insertCanvasBlock('heading') },
  { id: 'model-block', label: 'Model block', description: 'Configure an LLM provider and model', icon: Cpu, category: 'CANVAS', action: () => insertCanvasBlock('model') },
  { id: 'note-block', label: 'Note block', description: 'Add a sticky note to the latest stage', icon: StickyNote, category: 'CANVAS', action: () => insertCanvasBlock('note') },
  { id: 'result-block', label: 'Result block', description: 'Show output from a connected source block', icon: CheckCircle2, category: 'CANVAS', action: () => insertCanvasBlock('result') },
  { id: 'resource-block', label: 'Resource block', description: 'Embed a web link with preview and notes', icon: Globe, category: 'CANVAS', action: () => insertCanvasBlock('resource') },
  { id: 'image', label: 'Image', description: 'Upload or embed an image', icon: Image, category: 'MEDIA', action: (editor) => {
      const url = window.prompt('Image URL:');
      if (url) editor.chain().focus().setImage({ src: url }).run();
    } },
  { id: 'video', label: 'Video', description: 'Embed video content', icon: Video, category: 'MEDIA', phaseLabel: 'Coming in Phase X' },
  { id: 'audio', label: 'Audio', description: 'Embed audio content', icon: Music, category: 'MEDIA', phaseLabel: 'Coming in Phase X' },
  { id: 'embed', label: 'Embed', description: 'Embed external content', icon: Code2, category: 'MEDIA', phaseLabel: 'Coming in Phase X' },
  { id: 'file', label: 'File', description: 'Upload a file attachment', icon: File, category: 'MEDIA', phaseLabel: 'Coming in Phase X' },
  { id: 'table', label: 'Table', description: 'Insert a table', icon: Table, category: 'ADVANCED', phaseLabel: 'Coming in Phase X' },
  { id: 'code-block', label: 'Code block', description: 'Syntax-highlighted code', icon: Braces, shortcut: '```', category: 'ADVANCED', action: (editor) => editor.chain().focus().setCodeBlock().run() },
  { id: 'math-equation', label: 'Math equation', description: 'LaTeX math expression', icon: Sigma, category: 'ADVANCED', phaseLabel: 'Coming in Phase X' },
  { id: 'footnote', label: 'Footnote', description: 'Add a footnote reference', icon: Superscript, category: 'ADVANCED', phaseLabel: 'Coming in Phase X' },
  { id: 'columns', label: 'Columns', description: 'Multi-column layout', icon: Columns3, category: 'ADVANCED', phaseLabel: 'Coming in Phase X' },
  { id: 'generate-ai', label: 'Generate with AI', description: 'Create content with AI', icon: Sparkles, shortcut: '⌘J', category: 'AI', phaseLabel: 'Coming in Phase X' },
  { id: 'rewrite-selection', label: 'Rewrite selection', description: 'Improve selected text', icon: PenLine, category: 'AI', phaseLabel: 'Coming in Phase X' },
  { id: 'summarize', label: 'Summarize', description: 'Condense content', icon: FileText, category: 'AI', phaseLabel: 'Coming in Phase X' },
  { id: 'continue-writing', label: 'Continue writing', description: 'Extend your content', icon: ArrowRight, category: 'AI', phaseLabel: 'Coming in Phase X' },
];

const CATEGORY_ORDER = ['BASIC', 'CANVAS', 'MEDIA', 'ADVANCED', 'AI'];

export function getSlashCommandItems(query: string): SlashCommandItem[] {
  const lowerQuery = query.trim().toLowerCase();

  if (!lowerQuery) return MENU_ITEMS;

  return MENU_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery),
  );
}

interface SlashCommandMenuProps {
  isOpen: boolean;
  query: string;
  position: { x: number; y: number };
  items: SlashCommandItem[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onSelect: (itemId: string) => void;
  onClose: () => void;
}

export function SlashCommandMenu({
  isOpen,
  query,
  position,
  items,
  selectedIndex,
  onSelectedIndexChange,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const groupedItems = useMemo(
    () =>
      items.reduce<Record<string, SlashCommandItem[]>>((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
      }, {}),
    [items],
  );

  const sortedCategories = useMemo(
    () => CATEGORY_ORDER.filter((category) => groupedItems[category]?.length),
    [groupedItems],
  );

  useEffect(() => {
    itemRefs.current = [];
  }, [items]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    const itemEl = itemRefs.current[selectedIndex];
    if (itemEl) itemEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let itemIndex = 0;

  return (
    <div
      ref={menuRef}
      className="slash-command-menu"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: 320,
        maxHeight: 400,
        background: 'hsl(240 20% 8% / 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid hsl(var(--foreground) / 0.08)',
        borderRadius: 12,
        boxShadow: '0 12px 32px hsl(240 10% 2% / 0.6)',
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
        zIndex: 100,
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid hsl(var(--foreground) / 0.06)',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Filter..."
          readOnly
          value={query}
          style={{
            width: '100%',
            height: 36,
            padding: '0 10px',
            background: 'hsl(var(--foreground) / 0.03)',
            border: 'none',
            borderRadius: 6,
            outline: 'none',
            color: 'hsl(var(--foreground) / 0.9)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
          }}
        />
      </div>

      <div
        style={{
          maxHeight: 348,
          overflowY: 'auto',
          padding: '6px 0',
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              padding: '20px 10px',
              textAlign: 'center',
              color: 'hsl(var(--foreground) / 0.45)',
              fontSize: 13,
            }}
          >
            No results found
          </div>
        ) : (
          sortedCategories.map((category) => (
            <div key={category} style={{ marginBottom: 8 }}>
              <div
                style={{
                  padding: '8px 16px 4px',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  color: 'hsl(var(--foreground) / 0.3)',
                  textTransform: 'uppercase',
                }}
              >
                {category}
              </div>

              {groupedItems[category].map((item) => {
                const currentIndex = itemIndex++;
                const isSelected = currentIndex === selectedIndex;
                const Icon = item.icon;

                return (
                  <div
                    key={item.id}
                    ref={(el) => {
                      itemRefs.current[currentIndex] = el;
                    }}
                    onClick={() => onSelect(item.id)}
                    onMouseEnter={() => onSelectedIndexChange(currentIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      height: 36,
                      padding: '6px 10px',
                      margin: '0 6px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isSelected ? 'hsl(var(--secondary) / 0.1)' : 'transparent',
                      borderLeft: isSelected ? '2px solid hsl(var(--secondary))' : '2px solid transparent',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseOver={(event) => {
                      if (!isSelected) event.currentTarget.style.background = 'hsl(var(--foreground) / 0.06)';
                    }}
                    onMouseOut={(event) => {
                      if (!isSelected) event.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} style={{ color: 'hsl(var(--foreground) / 0.6)' }} />
                    </div>

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        marginLeft: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'hsl(var(--foreground) / 0.9)',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 400,
                          color: 'hsl(var(--foreground) / 0.45)',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.description}
                      </div>
                    </div>

                    {item.shortcut ? (
                      <div
                        style={{
                          marginLeft: 8,
                          padding: '1px 6px',
                          background: 'hsl(var(--foreground) / 0.04)',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 500,
                          color: 'hsl(var(--foreground) / 0.45)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {item.shortcut}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback, useRef } from 'react';
import { Bold, Italic, Underline, Strikethrough, Link, Code, Highlighter } from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface BubbleToolbarProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement>;
}

interface ToolbarButton {
  key: string;
  icon: React.ReactNode;
  label: string;
  isActive: () => boolean;
  action: () => void;
}

export function BubbleToolbar({ editor, containerRef }: BubbleToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!editor || !containerRef.current) return;

    const { state } = editor;
    const { from, to, empty } = state.selection;

    if (empty || from === to) {
      setVisible(false);
      return;
    }

    // Check if selection is text (not a node selection like stageGrid)
    const selectedNode = (state.selection as any).node;
    if (selectedNode) {
      setVisible(false);
      return;
    }

    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    const containerRect = containerRef.current.getBoundingClientRect();

    const centerX = (start.left + end.left) / 2 - containerRect.left;
    const top = start.top - containerRect.top - 44;

    setPos({ top, left: centerX });
    setVisible(true);
  }, [editor, containerRef]);

  useEffect(() => {
    if (!editor) return;

    editor.on('selectionUpdate', updatePosition);
    editor.on('blur', () => setVisible(false));

    return () => {
      editor.off('selectionUpdate', updatePosition);
      editor.off('blur', () => setVisible(false));
    };
  }, [editor, updatePosition]);

  if (!editor || !visible) return null;

  const buttons: ToolbarButton[] = [
    {
      key: 'bold',
      icon: <Bold size={16} />,
      label: 'Bold',
      isActive: () => editor.isActive('bold'),
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      icon: <Italic size={16} />,
      label: 'Italic',
      isActive: () => editor.isActive('italic'),
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'underline',
      icon: <Underline size={16} />,
      label: 'Underline',
      isActive: () => editor.isActive('underline'),
      action: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: 'strike',
      icon: <Strikethrough size={16} />,
      label: 'Strikethrough',
      isActive: () => editor.isActive('strike'),
      action: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      key: 'link',
      icon: <Link size={16} />,
      label: 'Link',
      isActive: () => editor.isActive('link'),
      action: () => {
        const previousUrl = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('Enter URL', previousUrl ?? 'https://');
        if (url === null) return;
        if (url.trim() === '') {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
          editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
        }
      },
    },
    {
      key: 'code',
      icon: <Code size={16} />,
      label: 'Code',
      isActive: () => editor.isActive('code'),
      action: () => editor.chain().focus().toggleCode().run(),
    },
    {
      key: 'highlight',
      icon: <Highlighter size={16} />,
      label: 'Highlight',
      isActive: () => editor.isActive('highlight'),
      action: () => editor.chain().focus().toggleHighlight().run(),
    },
  ];

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'rgba(16,16,24,0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 8,
        padding: '4px 8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        fontFamily: 'Inter, sans-serif',
        fontSize: 13,
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {buttons.map((btn) => {
        const active = btn.isActive();
        const hovered = hoveredBtn === btn.key;
        return (
          <button
            key={btn.key}
            title={btn.label}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent editor blur
              btn.action();
            }}
            onMouseEnter={() => setHoveredBtn(btn.key)}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              background: active
                ? 'rgba(255,255,255,0.08)'
                : hovered
                  ? 'rgba(255,255,255,0.05)'
                  : 'transparent',
              color: active
                ? 'rgba(255,255,255,0.90)'
                : 'rgba(255,255,255,0.70)',
              cursor: 'pointer',
              transition: 'all 100ms',
              padding: 0,
            }}
          >
            {btn.icon}
          </button>
        );
      })}
    </div>
  );
}

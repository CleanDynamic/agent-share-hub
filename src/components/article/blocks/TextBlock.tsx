import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';

import { useDocumentStore } from '@/lib/documentStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const TYPE_COLOR = 'rgba(255,255,255,0.60)';

interface TextBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

interface MiniEditorProps {
  value: unknown; // TipTap JSON
  onChange: (json: unknown) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function MiniTextEditor({
  value,
  onChange,
  placeholder = 'Type text...',
  autoFocus = false,
}: MiniEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Placeholder.configure({ placeholder }),
    ],
    content: value || undefined,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class:
          'prose prose-invert prose-sm max-w-none focus:outline-none text-white/85 leading-relaxed text-[12.5px] [&_p]:my-1 [&_p]:min-h-[1em]',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON());
    },
  });

  // Sync external value changes (e.g. from realtime/store updates) without
  // clobbering the user's caret while they are typing.
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    const next = value as object | null | undefined;
    if (!next) return;
    try {
      if (JSON.stringify(current) !== JSON.stringify(next) && !editor.isFocused) {
        editor.commands.setContent(next as never, { emitUpdate: false });
      }
    } catch {
      /* ignore */
    }
  }, [editor, value]);

  React.useEffect(() => () => editor?.destroy(), [editor]);

  return <EditorContent editor={editor} />;
}

export function TextBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as TextBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const setSelection = useDocumentStore((s) => s.setSelection);
  const expandedSelection = useDocumentStore(
    (s) => s.selection.kind === 'block' && s.selection.ids[0] === blockId,
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  const props = (block?.properties ?? {}) as Record<string, unknown>;
  const name = block?.name ?? '';
  const richText = props.richText;

  const patchProps = React.useCallback(
    (patch: Record<string, unknown>) => {
      if (!block) return;
      updateBlock(blockId, {
        properties: { ...(block.properties ?? {}), ...patch },
      });
    },
    [block, blockId, updateBlock],
  );

  const onRichTextChange = React.useCallback(
    (json: unknown) => patchProps({ richText: json }),
    [patchProps],
  );
  const onNameChange = (v: string) => updateBlock(blockId, { name: v });

  const selectThis = React.useCallback(() => {
    setSelection({ kind: 'block', ids: [blockId] });
  }, [blockId, setSelection]);

  const portOpacity = hovered || selected ? 1 : 0;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={selectThis}
        className="group relative rounded-lg p-2.5 bg-[rgba(20,20,28,0.85)] backdrop-blur-md transition-all"
        style={{
          width: 260,
          minHeight: 80,
          border: selected
            ? '1px solid rgba(255,255,255,0.45)'
            : expandedSelection
              ? '1px dashed rgba(255,255,255,0.30)'
              : '1px solid rgba(255,255,255,0.08)',
          boxShadow: selected ? '0 0 0 2px rgba(255,255,255,0.12)' : 'none',
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />
        <Handle
          type="target"
          position={Position.Left}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />

        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: TYPE_COLOR }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Text
          </span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
            className="flex-1 min-w-0 bg-transparent text-[10px] font-medium text-white/70 placeholder:text-white/30 outline-none nodrag"
          />
          <button
            type="button"
            className="p-0.5 text-white/40 hover:text-white/80 nodrag"
            title="More"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={12} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectThis();
              setDrawerOpen(true);
            }}
            className="nodrag p-0.5 text-white/40 hover:text-white/80"
            title="Expand"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>

        {/* Body — mini TipTap editor (auto-grows) */}
        <div
          className="nodrag rounded-md px-2 py-1.5"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MiniTextEditor
            value={richText}
            onChange={onRichTextChange}
            placeholder="Type text..."
          />
        </div>
      </div>

      {/* Expanded drawer — same editor, more breathing room */}
      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (open) selectThis();
        }}
      >
        <SheetContent
          side="right"
          className="w-[480px] sm:max-w-[480px] bg-[rgba(15,15,20,0.98)] border-white/10 text-white overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-white/90 text-base">
              Text block
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Block name"
              className="w-full px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/30 outline-none focus:border-white/[0.12] transition-colors"
            />

            <div
              className="rounded-md p-3"
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.06)',
                minHeight: 240,
              }}
            >
              <MiniTextEditor
                value={richText}
                onChange={onRichTextChange}
                placeholder="Type text..."
                autoFocus
              />
            </div>

            <p className="text-[11px] text-white/40">
              Tip: Cmd/Ctrl + B for bold, I for italic, U for underline. Paste
              a URL onto selected text to link it.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default TextBlockNode;

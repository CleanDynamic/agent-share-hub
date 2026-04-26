import * as React from 'react';
import type { Editor } from '@tiptap/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Undo2,
  Redo2,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  Code,
  Type,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronsUpDown,
  Outdent,
  Indent,
  List,
  ListOrdered,
  CheckSquare,
  ChevronRight,
  Link,
  Image,
  Video,
  Table,
  LayoutGrid,
  FileSymlink,
  Minus,
  SpellCheck,
  MessageSquare,
  FileText,
  GitBranch,
  ZoomIn,
  Focus,
  PanelLeft,
  PanelRight,
} from 'lucide-react';

const styles = {
  toolbar: {
    background: 'hsl(240 20% 8% / 0.8)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid hsl(var(--foreground) / 0.06)',
  },
  divider: {
    background: 'hsl(var(--foreground) / 0.06)',
  },
  iconButton: {
    color: 'hsl(var(--foreground) / 0.7)',
  },
  iconButtonHover: {
    color: 'hsl(var(--foreground) / 0.95)',
    background: 'hsl(var(--foreground) / 0.06)',
  },
  iconButtonActive: {
    color: 'hsl(var(--secondary))',
    background: 'hsl(var(--secondary) / 0.12)',
  },
  dropdown: {
    background: 'hsl(240 20% 8% / 0.95)',
    border: '1px solid hsl(var(--foreground) / 0.08)',
    boxShadow: '0 8px 24px hsl(240 10% 2% / 0.5)',
    borderRadius: '8px',
  },
  dropdownItem: {
    color: 'hsl(var(--foreground) / 0.7)',
  },
  dropdownItemHover: {
    color: 'hsl(var(--foreground) / 0.95)',
    background: 'hsl(var(--foreground) / 0.06)',
  },
} as const;

interface ToolbarButtonProps {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

interface ToolbarDropdownProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange?: (value: string) => void;
  shortcut?: string;
  width?: number;
}

interface ColorSwatchProps {
  color: string;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  isActive = false,
  onClick,
  disabled = false,
}: ToolbarButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const buttonStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'all 0.15s ease',
    border: 'none',
    padding: 0,
    background: 'transparent',
    ...(isActive
      ? styles.iconButtonActive
      : isHovered
        ? styles.iconButtonHover
        : styles.iconButton),
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          style={buttonStyle}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Icon size={14} strokeWidth={1.8} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        style={{
          background: 'hsl(240 20% 8% / 0.98)',
          border: '1px solid hsl(var(--foreground) / 0.08)',
          color: 'hsl(var(--foreground) / 0.92)',
          borderRadius: 8,
          padding: '6px 8px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
          {shortcut ? (
            <span style={{ fontSize: 10, color: 'hsl(var(--foreground) / 0.45)' }}>{shortcut}</span>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function DropdownItem({
  label,
  isSelected,
  onClick,
}: {
  label: string;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        height: 28,
        borderRadius: 6,
        border: 'none',
        background: isHovered ? styles.dropdownItemHover.background : 'transparent',
        color: isSelected ? 'hsl(var(--foreground) / 0.95)' : styles.dropdownItem.color,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontFamily: 'Inter, sans-serif',
        fontSize: 12,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {label}
    </button>
  );
}

function ToolbarDropdown({
  label,
  value,
  options,
  onChange,
  shortcut,
  width,
}: ToolbarDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buttonStyle: React.CSSProperties = {
    height: 28,
    minWidth: width,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: 13,
    fontWeight: 400,
    fontFamily: 'Inter, sans-serif',
    border: 'none',
    background: 'transparent',
    ...(isHovered ? styles.iconButtonHover : styles.iconButton),
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => setIsOpen((open) => !open)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <span>{value}</span>
            <ChevronDown size={13} strokeWidth={1.8} />
          </button>

          {isOpen ? (
            <div
              style={{
                ...styles.dropdown,
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 20,
                minWidth: Math.max(width ?? 120, 120),
                padding: 6,
              }}
            >
              {options.map((option) => (
                <DropdownItem
                  key={option.value}
                  label={option.label}
                  isSelected={option.value === value}
                  onClick={() => {
                    onChange?.(option.value);
                    setIsOpen(false);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        style={{
          background: 'hsl(240 20% 8% / 0.98)',
          border: '1px solid hsl(var(--foreground) / 0.08)',
          color: 'hsl(var(--foreground) / 0.92)',
          borderRadius: 8,
          padding: '6px 8px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
          {shortcut ? (
            <span style={{ fontSize: 10, color: 'hsl(var(--foreground) / 0.45)' }}>{shortcut}</span>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ColorSwatch({ color, label, shortcut, onClick }: ColorSwatchProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 'none',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: isHovered ? 'hsl(var(--foreground) / 0.06)' : 'transparent',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: color,
              boxShadow: 'inset 0 0 0 1px hsl(var(--foreground) / 0.15)',
            }}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        style={{
          background: 'hsl(240 20% 8% / 0.98)',
          border: '1px solid hsl(var(--foreground) / 0.08)',
          color: 'hsl(var(--foreground) / 0.92)',
          borderRadius: 8,
          padding: '6px 8px',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
          {shortcut ? (
            <span style={{ fontSize: 10, color: 'hsl(var(--foreground) / 0.45)' }}>{shortcut}</span>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        borderRadius: 999,
        flexShrink: 0,
        ...styles.divider,
      }}
    />
  );
}

const blockStyleOptions = [
  { label: 'Heading 1', value: 'heading1' },
  { label: 'Heading 2', value: 'heading2' },
  { label: 'Heading 3', value: 'heading3' },
  { label: 'Body', value: 'body' },
  { label: 'Caption', value: 'caption' },
  { label: 'Quote', value: 'quote' },
  { label: 'Code', value: 'code' },
  { label: 'Callout', value: 'callout' },
];

const lineHeightOptions = [
  { label: '1.0', value: '1.0' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2.0' },
];

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

export interface TopToolbarProps {
  editor: Editor | null;
  onInsertBlock?: () => void;
}

export function TopToolbar({ editor, onInsertBlock }: TopToolbarProps) {
  // Force re-render on selection / transaction so isActive() reflects state
  const [, forceTick] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    if (!editor) return;
    const handler = () => forceTick();
    editor.on('selectionUpdate', handler);
    editor.on('transaction', handler);
    editor.on('focus', handler);
    editor.on('blur', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('transaction', handler);
      editor.off('focus', handler);
      editor.off('blur', handler);
    };
  }, [editor]);

  const isActive = (name: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(name, attrs as never) ?? false;

  const blockStyle: string = React.useMemo(() => {
    if (!editor) return 'body';
    if (editor.isActive('heading', { level: 1 })) return 'heading1';
    if (editor.isActive('heading', { level: 2 })) return 'heading2';
    if (editor.isActive('heading', { level: 3 })) return 'heading3';
    if (editor.isActive('blockquote')) return 'quote';
    if (editor.isActive('codeBlock')) return 'code';
    return 'body';
  }, [editor, editor?.state.selection]);

  const lineHeight: string = '1.5';
  const alignment: 'left' | 'center' | 'right' | 'justify' = 'left';

  const getBlockStyleLabel = (value: string) => {
    const option = blockStyleOptions.find((opt) => opt.value === value);
    return option ? option.label : 'Body';
  };

  const soon = (label: string) => () => {
    import('sonner').then(({ toast }) => toast(`${label} — coming soon`));
  };

  const run = (fn: (chain: ReturnType<NonNullable<typeof editor>['chain']>) => void) => () => {
    if (!editor) return;
    fn(editor.chain().focus());
  };

  const setBlockStyle = (value: string) => {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (value) {
      case 'heading1':
        chain.setHeading({ level: 1 }).run();
        break;
      case 'heading2':
        chain.setHeading({ level: 2 }).run();
        break;
      case 'heading3':
        chain.setHeading({ level: 3 }).run();
        break;
      case 'quote':
        chain.setParagraph().run();
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'code':
        chain.toggleCodeBlock().run();
        break;
      case 'caption':
      case 'callout':
        soon(value === 'caption' ? 'Caption' : 'Callout')();
        break;
      case 'body':
      default:
        chain.setParagraph().run();
        break;
    }
  };

  const handleLink = () => {
    if (!editor) return;
    // Link mark not in StarterKit by default
    if (!editor.schema.marks.link) {
      soon('Links')();
      return;
    }
    const previous = editor.getAttributes('link').href as string | undefined;
    const input = window.prompt('Enter URL', previous ?? 'https://');
    if (input === null) return;
    if (input.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: input.trim() }).run();
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div
        style={{
          ...styles.toolbar,
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '8px 10px',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          scrollbarWidth: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 'max-content',
            height: 28,
          }}
        >
          <ToolbarGroup>
            <ToolbarButton
              icon={Undo2}
              label="Undo"
              shortcut="⌘Z"
              onClick={run((c) => c.undo().run())}
              disabled={!editor?.can().undo()}
            />
            <ToolbarButton
              icon={Redo2}
              label="Redo"
              shortcut="⇧⌘Z"
              onClick={run((c) => c.redo().run())}
              disabled={!editor?.can().redo()}
            />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ToolbarDropdown
              label="Block style"
              shortcut="⌘⌥0"
              value={getBlockStyleLabel(blockStyle)}
              options={blockStyleOptions}
              onChange={setBlockStyle}
              width={110}
            />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ToolbarButton icon={Bold} label="Bold" shortcut="⌘B" isActive={isActive('bold')} onClick={run((c) => c.toggleBold().run())} />
            <ToolbarButton icon={Italic} label="Italic" shortcut="⌘I" isActive={isActive('italic')} onClick={run((c) => c.toggleItalic().run())} />
            <ToolbarButton icon={Underline} label="Underline" shortcut="⌘U" onClick={soon('Underline')} />
            <ToolbarButton icon={Strikethrough} label="Strikethrough" shortcut="⇧⌘X" isActive={isActive('strike')} onClick={run((c) => c.toggleStrike().run())} />
            <ToolbarButton icon={Subscript} label="Subscript" onClick={soon('Subscript')} />
            <ToolbarButton icon={Superscript} label="Superscript" onClick={soon('Superscript')} />
            <ToolbarButton icon={Code} label="Inline code" shortcut="⌘E" isActive={isActive('code')} onClick={run((c) => c.toggleCode().run())} />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ColorSwatch color="hsl(var(--foreground) / 0.9)" label="Text color" onClick={soon('Text color')} />
            <ColorSwatch color="hsl(45 93% 63% / 0.3)" label="Highlight color" onClick={soon('Highlight color')} />
            <ToolbarButton icon={Type} label="Text tools" onClick={soon('Text tools')} />
            <ToolbarButton icon={Highlighter} label="Highlight" onClick={soon('Highlight')} />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ToolbarButton icon={AlignLeft} label="Align left" isActive={alignment === 'left'} onClick={soon('Alignment')} />
            <ToolbarButton icon={AlignCenter} label="Align center" onClick={soon('Alignment')} />
            <ToolbarButton icon={AlignRight} label="Align right" onClick={soon('Alignment')} />
            <ToolbarButton icon={AlignJustify} label="Justify" onClick={soon('Alignment')} />
            <ToolbarDropdown
              label="Line height"
              value={lineHeight}
              options={lineHeightOptions}
              onChange={() => soon('Line height')()}
              width={64}
            />
            <ToolbarButton
              icon={Outdent}
              label="Outdent"
              onClick={run((c) => c.liftListItem('listItem').run())}
              disabled={!editor?.can().liftListItem('listItem')}
            />
            <ToolbarButton
              icon={Indent}
              label="Indent"
              onClick={run((c) => c.sinkListItem('listItem').run())}
              disabled={!editor?.can().sinkListItem('listItem')}
            />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ToolbarButton icon={List} label="Bulleted list" isActive={isActive('bulletList')} onClick={run((c) => c.toggleBulletList().run())} />
            <ToolbarButton icon={ListOrdered} label="Numbered list" isActive={isActive('orderedList')} onClick={run((c) => c.toggleOrderedList().run())} />
            <ToolbarButton icon={CheckSquare} label="Checklist" onClick={soon('Checklist')} />
            <ToolbarButton icon={ChevronRight} label="Toggle list" onClick={soon('Toggle list')} />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ToolbarButton icon={FileText} label="Add block" onClick={onInsertBlock ?? soon('Insert')} />
            <ToolbarButton icon={Link} label="Insert link" shortcut="⌘K" onClick={handleLink} />
            <ToolbarButton icon={Image} label="Insert image" onClick={soon('Image')} />
            <ToolbarButton icon={Video} label="Insert video" onClick={soon('Video')} />
            <ToolbarButton icon={Table} label="Insert table" onClick={soon('Table')} />
            <ToolbarButton icon={LayoutGrid} label="Insert stage grid" onClick={onInsertBlock ?? soon('Stage grid')} />
            <ToolbarButton icon={FileSymlink} label="Insert block reference" onClick={soon('Block reference')} />
            <ToolbarButton icon={Minus} label="Insert divider" onClick={run((c) => c.setHorizontalRule().run())} />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ToolbarButton icon={SpellCheck} label="Spell check" onClick={soon('Spell check')} />
            <ToolbarButton icon={MessageSquare} label="Comment" onClick={soon('Comments')} />
            <ToolbarButton icon={FileText} label="Word count" onClick={soon('Word count')} />
            <ToolbarButton icon={GitBranch} label="Track changes" onClick={soon('Track changes')} />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ToolbarButton icon={ZoomIn} label="Zoom" onClick={soon('Zoom')} />
            <ToolbarButton icon={Focus} label="Focus mode" onClick={soon('Focus mode')} />
            <ToolbarButton icon={PanelLeft} label="Outline panel" onClick={soon('Outline')} />
            <ToolbarButton icon={PanelRight} label="Inspector panel" onClick={soon('Inspector')} />
            <ToolbarButton icon={ChevronsUpDown} label="Toolbar options" onClick={soon('Toolbar options')} />
          </ToolbarGroup>
        </div>
      </div>
    </TooltipProvider>
  );
}
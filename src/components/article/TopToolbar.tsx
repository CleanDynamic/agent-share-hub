import * as React from 'react';
import type { Editor } from '@tiptap/react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LinkPopover } from './LinkPopover';
import { TablePickerPopover } from './TablePickerPopover';
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
  // ChevronRight removed (toggle-list button removed)
  Link,
  Image,
  Video,
  AtSign,
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
    background: 'var(--recess)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderBottom: '1px solid var(--line)',
  },
  divider: {
    background: 'var(--recess)',
  },
  iconButton: {
    color: 'var(--text2)',
  },
  iconButtonHover: {
    color: 'var(--text)',
    background: 'var(--recess)',
  },
  iconButtonActive: {
    color: 'var(--evidence)',
    background: 'color-mix(in srgb, var(--evidence) 6%, transparent)',
  },
  dropdown: {
    background: 'var(--cat-data)',
    border: '1px solid var(--line)',
    boxShadow: '0 8px 24px var(--line)',
    borderRadius: '8px',
  },
  dropdownItem: {
    color: 'var(--text2)',
  },
  dropdownItemHover: {
    color: 'var(--text)',
    background: 'var(--recess)',
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
    borderRadius: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'all 120ms ease-out',
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
          background: 'var(--cat-data)',
          border: '1px solid var(--line)',
          color: 'var(--text)',
          borderRadius: 8,
          padding: '6px 8px',
          fontFamily: 'Figtree, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
          {shortcut ? (
            <span style={{ fontSize: 10, color: 'var(--text2)' }}>{shortcut}</span>
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
        borderRadius: 5,
        border: 'none',
        background: isHovered ? styles.dropdownItemHover.background : 'transparent',
        color: isSelected ? 'var(--text)' : styles.dropdownItem.color,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontFamily: 'Figtree, sans-serif',
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
    borderRadius: 5,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    transition: 'all 120ms ease-out',
    fontSize: 13,
    fontWeight: 400,
    fontFamily: 'Figtree, sans-serif',
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
          background: 'var(--cat-data)',
          border: '1px solid var(--line)',
          color: 'var(--text)',
          borderRadius: 8,
          padding: '6px 8px',
          fontFamily: 'Figtree, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
          {shortcut ? (
            <span style={{ fontSize: 10, color: 'var(--text2)' }}>{shortcut}</span>
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
            borderRadius: 5,
            border: 'none',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: isHovered ? 'var(--recess)' : 'transparent',
            transition: 'all 120ms ease-out',
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
              boxShadow: 'inset 0 0 0 1px var(--text2)',
            }}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          color: 'var(--text)',
          borderRadius: 8,
          padding: '6px 8px',
          fontFamily: 'Figtree, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
          {shortcut ? (
            <span style={{ fontSize: 10, color: 'var(--text2)' }}>{shortcut}</span>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

type PaletteEntry = { name: string; value: string | null };

const TEXT_PALETTE: PaletteEntry[] = [
  { name: 'Default', value: null },
  { name: 'Gray', value: 'var(--text2)' },
  { name: 'Brown', value: '#8B5E3C' },
  { name: 'Orange', value: 'var(--action)' },
  { name: 'Yellow', value: 'var(--lit)' },
  { name: 'Green', value: '#2BB673' },
  { name: 'Teal', value: 'var(--evidence)' },
  { name: 'Blue', value: 'var(--cat-data)' },
  { name: 'Purple', value: 'var(--cat-agents)' },
  { name: 'Pink', value: 'var(--cat-media)' },
  { name: 'Red', value: 'var(--cat-breakage)' },
];

const HIGHLIGHT_PALETTE: PaletteEntry[] = [
  { name: 'Default', value: null },
  { name: 'Gray', value: 'color-mix(in srgb, var(--text2) 33%, transparent)' },
  { name: 'Brown', value: 'color-mix(in srgb, var(--cat-artefact) 33%, transparent)' },
  { name: 'Orange', value: 'color-mix(in srgb, var(--action) 33%, transparent)' },
  { name: 'Yellow', value: 'color-mix(in srgb, var(--lit) 33%, transparent)' },
  { name: 'Green', value: 'color-mix(in srgb, var(--cat-configuration) 33%, transparent)' },
  { name: 'Teal', value: 'color-mix(in srgb, var(--evidence) 33%, transparent)' },
  { name: 'Blue', value: 'color-mix(in srgb, var(--cat-data) 33%, transparent)' },
  { name: 'Purple', value: 'color-mix(in srgb, var(--cat-agents) 33%, transparent)' },
  { name: 'Pink', value: 'color-mix(in srgb, var(--cat-media) 33%, transparent)' },
  { name: 'Red', value: 'color-mix(in srgb, var(--cat-breakage) 33%, transparent)' },
];

interface ColorPickerPopoverProps {
  mode: 'text' | 'highlight';
  triggerColor: string;
  triggerLabel: string;
  onApply: (color: string | null) => void;
}

function ColorPickerPopover({ mode, triggerColor, triggerLabel, onApply }: ColorPickerPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [hex, setHex] = React.useState('');
  const palette = mode === 'text' ? TEXT_PALETTE : HIGHLIGHT_PALETTE;
  const header = mode === 'text' ? 'Text color' : 'Highlight color';

  const applyHex = () => {
    const v = hex.trim();
    if (!v) return;
    const normalized = v.startsWith('#') ? v : `#${v}`;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized)) {
      onApply(normalized);
      setOpen(false);
      setHex('');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          title={triggerLabel}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: 28,
            height: 28,
            borderRadius: 5,
            border: 'none',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            background: hovered ? 'var(--recess)' : 'transparent',
            transition: 'all 120ms ease-out',
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: triggerColor,
              boxShadow: 'inset 0 0 0 1px var(--text2)',
            }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-3 w-auto"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          boxShadow: '0 8px 24px var(--text)',
          fontFamily: 'Figtree, sans-serif',
          color: 'var(--text)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text2)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
          }}
        >
          {header}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 24px)',
            gap: 2,
            marginBottom: 8,
          }}
        >
          {palette.map((entry) => {
            const isDefault = entry.value === null;
            const swatchBg = isDefault
              ? 'transparent'
              : entry.value!;
            return (
              <button
                key={entry.name}
                type="button"
                title={entry.name}
                onClick={() => {
                  onApply(entry.value);
                  setOpen(false);
                }}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  padding: 0,
                  cursor: 'pointer',
                  background: swatchBg,
                  border: isDefault
                    ? '1px dashed var(--line)'
                    : '1px solid var(--text2)',
                  position: 'relative',
                }}
              >
                {isDefault ? (
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      color: 'var(--text2)',
                    }}
                  >
                    A
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            onApply(null);
            setOpen(false);
          }}
          style={{
            width: '100%',
            height: 26,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--text2)',
            fontSize: 11,
            fontFamily: 'Figtree, sans-serif',
            cursor: 'pointer',
            marginBottom: 6,
            textAlign: 'left',
            padding: '0 6px',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--recess)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          Remove color
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyHex();
              }
            }}
            placeholder="#RRGGBB"
            style={{
              flex: 1,
              height: 26,
              borderRadius: 6,
              border: '1px solid var(--line)',
              background: 'var(--recess)',
              color: 'var(--text)',
              padding: '0 8px',
              fontSize: 11,
              fontFamily: 'Figtree, sans-serif',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={applyHex}
            style={{
              height: 26,
              padding: '0 10px',
              borderRadius: 6,
              border: '1px solid var(--line)',
              background: 'var(--recess)',
              color: 'var(--text)',
              fontSize: 11,
              fontFamily: 'Figtree, sans-serif',
              cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 16,
        margin: '0 8px',
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
  /** 'blueprint' (default), 'blog', or 'bounty' — affects which buttons render. */
  mode?: 'blueprint' | 'blog' | 'bounty' | 'solve';
  /** Blog mode: open the @-Reference picker modal. */
  onOpenReference?: () => void;
}

export function TopToolbar({ editor, onInsertBlock, mode = 'blueprint', onOpenReference }: TopToolbarProps) {
  const isBlog = mode === 'blog';
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
        editor.chain().focus().setParagraph().run();
        editor.chain().focus().toggleBlockquote().run();
        // clear callout flag so it's a plain quote
        editor.chain().focus().updateAttributes('blockquote', { 'data-callout': null } as never).run();
        break;
      case 'code':
        chain.toggleCodeBlock().run();
        break;
      case 'caption':
        editor.chain().focus().setParagraph().run();
        editor.chain().focus().updateAttributes('paragraph', { class: 'caption' } as never).run();
        break;
      case 'callout':
        editor.chain().focus().setParagraph().run();
        editor.chain().focus().setBlockquote().run();
        editor.chain().focus().updateAttributes('blockquote', { 'data-callout': 'true' } as never).run();
        break;
      case 'body':
      default:
        chain.setParagraph().run();
        break;
    }
  };

  const [linkOpen, setLinkOpen] = React.useState(false);
  const handleLink = () => {
    if (!editor) return;
    if (!editor.schema.marks.link) {
      soon('Links')();
      return;
    }
    setLinkOpen(true);
  };

  // Image insertion popover state
  const [imageOpen, setImageOpen] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState('');
  const [imageAlt, setImageAlt] = React.useState('');
  const insertImage = () => {
    if (!editor) return;
    const src = imageUrl.trim();
    if (!src) return;
    editor.chain().focus().setImage({ src, alt: imageAlt.trim() || undefined }).run();
    setImageUrl('');
    setImageAlt('');
    setImageOpen(false);
  };

  // Video insertion popover state
  const [videoOpen, setVideoOpen] = React.useState(false);
  const [videoUrl, setVideoUrl] = React.useState('');
  const insertVideo = () => {
    if (!editor) return;
    const url = videoUrl.trim();
    if (!url) return;

    let html = '';
    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
    if (ytMatch) {
      html = `<div class="video-embed"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    } else {
      // Vimeo
      const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (vimeoMatch) {
        html = `<div class="video-embed"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
      } else if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
        // Direct video file
        html = `<div class="video-embed"><video controls src="${url}"></video></div>`;
      } else {
        // Fallback: treat as iframe-able URL
        html = `<div class="video-embed"><iframe src="${url}" allowfullscreen></iframe></div>`;
      }
    }

    editor.chain().focus().insertContent(html).run();
    setVideoUrl('');
    setVideoOpen(false);
  };

  const insertBlockReference = () => {
    if (!editor) return;
    editor.chain().focus().insertContent('@').run();
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div
        style={{
          ...styles.toolbar,
          width: '100%',
          boxSizing: 'border-box',
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
            <ToolbarButton icon={Bold} label="Bold" shortcut="⌘B" isActive={isActive('bold')} onClick={run((c) => c.toggleBold().run())} />
            <ToolbarButton icon={Italic} label="Italic" shortcut="⌘I" isActive={isActive('italic')} onClick={run((c) => c.toggleItalic().run())} />
            <ToolbarButton icon={Underline} label="Underline" shortcut="⌘U" isActive={isActive('underline')} onClick={run((c) => c.toggleUnderline().run())} />
            <ToolbarButton icon={Code} label="Inline code" shortcut="⌘E" isActive={isActive('code')} onClick={run((c) => c.toggleCode().run())} />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ColorPickerPopover
              mode="text"
              triggerLabel="Text color"
              triggerColor={
                (editor?.getAttributes('textStyle')?.color as string) ||
                'var(--text)'
              }
              onApply={(color) => {
                if (!editor) return;
                if (color === null) editor.chain().focus().unsetColor().run();
                else editor.chain().focus().setColor(color).run();
              }}
            />
            <ColorPickerPopover
              mode="highlight"
              triggerLabel="Highlight color"
              triggerColor={
                (editor?.getAttributes('highlight')?.color as string) ||
                'var(--cat-artefact)'
              }
              onApply={(color) => {
                if (!editor) return;
                if (color === null) editor.chain().focus().unsetHighlight().run();
                else editor.chain().focus().setHighlight({ color }).run();
              }}
            />
            <ToolbarButton icon={Highlighter} label="Highlight" isActive={isActive('highlight')} onClick={run((c) => c.toggleHighlight().run())} />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ToolbarButton
              icon={AlignLeft}
              label="Align left"
              isActive={
                (editor?.isActive({ textAlign: 'left' } as never) ?? false) ||
                (!!editor &&
                  !editor.isActive({ textAlign: 'center' } as never) &&
                  !editor.isActive({ textAlign: 'right' } as never) &&
                  !editor.isActive({ textAlign: 'justify' } as never))
              }
              onClick={run((c) => c.setTextAlign('left').run())}
            />
            <ToolbarButton icon={AlignCenter} label="Align center" isActive={editor?.isActive({ textAlign: 'center' } as never) ?? false} onClick={run((c) => c.setTextAlign('center').run())} />
            <ToolbarButton icon={AlignRight} label="Align right" isActive={editor?.isActive({ textAlign: 'right' } as never) ?? false} onClick={run((c) => c.setTextAlign('right').run())} />
            <ToolbarButton icon={AlignJustify} label="Justify" isActive={editor?.isActive({ textAlign: 'justify' } as never) ?? false} onClick={run((c) => c.setTextAlign('justify').run())} />
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
            <ToolbarButton icon={CheckSquare} label="Checklist" isActive={isActive('taskList')} onClick={run((c) => (c as any).toggleTaskList().run())} />
          </ToolbarGroup>

          <Divider />

          <ToolbarGroup>
            <ToolbarButton icon={Link} label="Insert link" shortcut="⌘K" onClick={handleLink} />
            <Popover open={imageOpen} onOpenChange={setImageOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Insert image"
                  aria-label="Insert image"
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: 'none', background: 'transparent',
                    color: 'var(--text2)', padding: 0,
                  }}
                >
                  <Image size={14} strokeWidth={1.8} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="p-3 w-72"
                style={{
                  /* A popover is a RAISED surface, so it takes an opaque
                     ground and the theme's raised elevation. --line is a
                     hairline token and was never a surface. */
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r-panel)',
                  boxShadow: 'var(--elev-raised)',
                  fontFamily: 'Figtree, sans-serif',
                  color: 'var(--text)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Insert image
                </div>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertImage(); } }}
                  placeholder="Image URL"
                  autoFocus
                  style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--recess)', color: 'var(--text)', padding: '0 8px', fontSize: 12, marginBottom: 6, outline: 'none', boxSizing: 'border-box' }}
                />
                <input
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertImage(); } }}
                  placeholder="Alt text (optional)"
                  style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--recess)', color: 'var(--text)', padding: '0 8px', fontSize: 12, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={insertImage}
                  style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--recess)', color: 'var(--text)', fontSize: 12, fontFamily: 'Figtree, sans-serif', cursor: 'pointer' }}
                >
                  Insert
                </button>
              </PopoverContent>
            </Popover>
            <Popover open={videoOpen} onOpenChange={setVideoOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Insert video"
                  aria-label="Insert video"
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: 'none', background: 'transparent',
                    color: 'var(--text2)', padding: 0,
                  }}
                >
                  <Video size={14} strokeWidth={1.8} />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="p-3 w-72"
                style={{
                  background: 'var(--cat-data)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  fontFamily: 'Figtree, sans-serif',
                  color: 'var(--text)',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Insert video
                </div>
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); insertVideo(); } }}
                  placeholder="YouTube, Vimeo, or .mp4 URL"
                  autoFocus
                  style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--recess)', color: 'var(--text)', padding: '0 8px', fontSize: 12, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={insertVideo}
                  style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--recess)', color: 'var(--text)', fontSize: 12, fontFamily: 'Figtree, sans-serif', cursor: 'pointer' }}
                >
                  Insert
                </button>
              </PopoverContent>
            </Popover>
            {isBlog ? (
              <ToolbarButton icon={AtSign} label="@ Reference" onClick={() => onOpenReference?.()} />
            ) : (
              <ToolbarButton icon={FileSymlink} label="Insert block reference" onClick={insertBlockReference} />
            )}
            <ToolbarButton icon={Minus} label="Insert divider" onClick={run((c) => c.setHorizontalRule().run())} />
          </ToolbarGroup>

        </div>
      </div>
      <LinkPopover editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />
    </TooltipProvider>
  );
}
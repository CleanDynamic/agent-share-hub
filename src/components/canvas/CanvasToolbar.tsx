import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Save, Send, Loader2, Plus, ChevronUp,
  Undo2, Redo2, MoreHorizontal, Minus,
  LayoutTemplate, SpellCheck, Clock, StickyNote, Trash2,
  Type, MessageSquare, Code, BarChart3, ImageIcon,
  Bot, Workflow, GitCompare, Wrench, Cpu,
  BookOpen, Heading, Link, NotebookPen, Video,
} from 'lucide-react';
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';
import type { BlockPosition } from '@/lib/canvas-types';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { colourAlpha } from "@/lib/theme/tokens";
import { feedback } from '@/lib/theme/motion';

const BLOCK_TYPE_ICONS: Record<string, any> = {
  text: Type,
  prompt: MessageSquare,
  code: Code,
  result: BarChart3,
  image: ImageIcon,
  agent_config: Bot,
  workflow: Workflow,
  comparison: GitCompare,
  tool_setup: Wrench,
  model_params: Cpu,
  tutorial_step: BookOpen,
  section_heading: Heading,
  resource: Link,
  sticky_note: StickyNote,
  video: Video,
};

const QUICK_BLOCK_TYPES = [
  { type: 'text', label: 'Text', accent: 'var(--recess)', desc: 'Plain text or notes' },
  { type: 'prompt', label: 'Prompt', accent: 'var(--action)', desc: 'AI prompt' },
  { type: 'code', label: 'Code', accent: 'var(--cat-data)', desc: 'Code snippet' },
  { type: 'result', label: 'Result', accent: 'var(--cat-configuration)', desc: 'Output' },
  { type: 'image', label: 'Image', accent: 'var(--cat-media)', desc: 'Visual' },
  { type: 'agent_config', label: 'Agent', accent: 'var(--cat-agents)', desc: 'AI agent config' },
  { type: 'workflow', label: 'Workflow', accent: 'var(--evidence)', desc: 'Multi-step process' },
  { type: 'comparison', label: 'Compare', accent: 'var(--cat-media)', desc: 'Side-by-side' },
  { type: 'tool_setup', label: 'Tool', accent: 'var(--cat-data)', desc: 'Tool setup' },
  { type: 'model_params', label: 'Model', accent: 'var(--cat-agents)', desc: 'Model config' },
  { type: 'tutorial_step', label: 'Tutorial', accent: 'var(--action)', desc: 'Step-by-step' },
  { type: 'section_heading', label: 'Heading', accent: 'var(--recess)', desc: 'Section divider' },
  { type: 'resource', label: 'Resource', accent: 'var(--cat-data)', desc: 'Link / reference' },
  { type: 'sticky_note', label: 'Note', accent: 'var(--lit)', desc: 'Sticky note comment' },
  { type: 'video', label: 'Video', accent: 'var(--cat-media)', desc: 'Video embed' },
];

interface CanvasToolbarProps {
  doc: ReturnType<typeof useCanvasDocument>;
  onSave?: () => void;
  onPublish?: () => void;
  saving?: boolean;
  submitting?: boolean;
  onTemplates?: () => void;
  onHistory?: () => void;
  onAnnotations?: () => void;
  onGrammarCheck?: () => void;
  annotationCount?: number;
  onBack?: () => void;
  blockCount?: number;
  onInsertBlock?: (type: string, position: Partial<BlockPosition>) => string | null | void;
  onUndo?: () => void;
  onRedo?: () => void;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onClearAll?: () => void;
}

export function CanvasToolbar(props: CanvasToolbarProps) {
  const {
    doc, onSave, onPublish, saving, submitting,
    onTemplates, onHistory, onAnnotations, onGrammarCheck,
    annotationCount = 0, onBack,
    onInsertBlock, onUndo, onRedo,
    zoom = 1, onZoomIn, onZoomOut,
    onClearAll,
  } = props;

  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [hoveredType, setHoveredType] = useState<string | null>(null);
  const [blockSearch, setBlockSearch] = useState('');
  const [clearConfirm, setClearConfirm] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
    }
  }, [onSave]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset search when modal closes
  useEffect(() => {
    if (!addBlockOpen) setBlockSearch('');
  }, [addBlockOpen]);

  // Reset clear confirm when popover closes
  useEffect(() => {
    if (clearConfirm) {
      const t = setTimeout(() => setClearConfirm(false), 5000);
      return () => clearTimeout(t);
    }
  }, [clearConfirm]);

  const filteredBlocks = QUICK_BLOCK_TYPES.filter(bt =>
    bt.label.toLowerCase().includes(blockSearch.toLowerCase()) ||
    bt.desc.toLowerCase().includes(blockSearch.toLowerCase())
  );

  // G-1: Neutral button base
  const navBtn = (id: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28,
    background: hoveredBtn === id ? 'var(--recess)' : 'transparent',
    border: 'none',
    borderRadius: 6,
    color: 'var(--text2)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  const disabledNav: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28,
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    color: 'var(--text2)',
    opacity: 0.3,
    cursor: 'not-allowed',
  };

  return (
    <>
      {/* G-2: Add Block modal */}
      {addBlockOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 98 }}
            onClick={() => setAddBlockOpen(false)}
          />
          <div style={{
            position: 'fixed',
            bottom: 60,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: 12,
            width: 420,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 101,
            boxShadow: 'var(--elev-overlay)',
          }}>
            {/* Search input */}
            <input
              value={blockSearch}
              onChange={e => setBlockSearch(e.target.value)}
              placeholder="Search blocks..."
              autoFocus
              style={{
                width: '100%',
                fontSize: 13,
                fontWeight: 400,
                fontFamily: 'Figtree, sans-serif',
                padding: '10px 14px',
                background: 'var(--recess)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box' as const,
              }}
            />

            {/* Block grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 4,
            }}>
              {filteredBlocks.map(bt => {
                const isHovered = hoveredType === bt.type;
                const IconComp = BLOCK_TYPE_ICONS[bt.type] || Type;
                const accentColor = bt.accent;
                return (
                  <button
                    key={bt.type}
                    type="button"
                    onMouseEnter={() => setHoveredType(bt.type)}
                    onMouseLeave={() => setHoveredType(null)}
                    onClick={() => {
                      const isHeading = bt.type === 'section_heading';
                      const isSticky = bt.type === 'sticky_note';
                      const colSpan = isSticky ? 2 : 3;
                      const rowSpan = isSticky ? 3 : isHeading ? 2 : 5;
                      const result = onInsertBlock?.(bt.type, { colSpan, rowSpan });
                      if (result !== null) {
                        setAddBlockOpen(false);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      cursor: 'pointer',
                      background: isHovered ? 'var(--recess)' : 'var(--recess)',
                      border: isHovered
                        ? `1px solid ${colourAlpha(accentColor, 0.149)}`
                        : '1px solid var(--line)',
                      color: 'var(--text2)',
                      fontWeight: 500,
                      fontFamily: 'Figtree, sans-serif',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                  >
                    <IconComp
                      size={20}
                      style={{
                        color: accentColor,
                        opacity: 0.7,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    />
                    <div>
                      <div style={{ opacity: 0.9 }}>{bt.label}</div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 400,
                        color: 'var(--text2)',
                        marginTop: 2,
                      }}>{bt.desc}</div>
                    </div>
                  </button>
                );
              })}
              {filteredBlocks.length === 0 && (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: 16,
                  fontSize: 12,
                  color: 'var(--text2)',
                  fontFamily: 'Figtree, sans-serif',
                }}>
                  No blocks match "{blockSearch}"
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* G-1: Toolbar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        gap: 3,
        alignItems: 'center',
        zIndex: 100,
        background: 'var(--recess)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--line)',
        borderRadius: 0,
        padding: '6px 16px',
      }}>
        {/* Group 1: Navigation */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            title="Back"
            onMouseEnter={() => setHoveredBtn('back')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={navBtn('back')}
          >
            <ArrowLeft size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onUndo}
          disabled={!onUndo}
          title="Undo (Ctrl+Z)"
          onMouseEnter={() => setHoveredBtn('undo')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={onUndo ? navBtn('undo') : disabledNav}
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!onRedo}
          title="Redo (Ctrl+Shift+Z)"
          onMouseEnter={() => setHoveredBtn('redo')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={onRedo ? navBtn('redo') : disabledNav}
        >
          <Redo2 size={14} />
        </button>

        <Divider />

        {/* Group 2: Content */}
        <button
          type="button"
          onClick={() => setAddBlockOpen(o => !o)}
          title="Add a block"
          onMouseEnter={() => setHoveredBtn('addblock')}
          onMouseLeave={() => setHoveredBtn(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 14px',
            background: hoveredBtn === 'addblock' ? 'var(--recess)' : 'var(--recess)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            color: 'var(--text2)',
            fontSize: 12, fontWeight: 500,
            fontFamily: 'Figtree, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={13} /> Block
          <ChevronUp size={10} style={{
            transform: addBlockOpen ? 'rotate(180deg)' : 'none',
            transition: feedback("transform"),
            opacity: 0.5,
          }} />
        </button>

        <Divider />

        {/* Group 3: View (Zoom) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <button
            type="button"
            onClick={onZoomOut}
            title="Zoom out"
            onMouseEnter={() => setHoveredBtn('zout')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={navBtn('zout')}
          >
            <Minus size={12} />
          </button>
          <span style={{
            fontSize: 10, color: 'var(--text2)',
            fontWeight: 600, minWidth: 32, textAlign: 'center',
            fontFamily: 'Figtree, sans-serif',
          }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={onZoomIn}
            title="Zoom in"
            onMouseEnter={() => setHoveredBtn('zin')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={navBtn('zin')}
          >
            <Plus size={12} />
          </button>
        </div>

        <Divider />

        {/* Group 4: Utilities (overflow menu) */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="More options"
              onMouseEnter={() => setHoveredBtn('more')}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                ...navBtn('more'),
                position: 'relative',
              }}
            >
              <MoreHorizontal size={14} />
              {annotationCount > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--cat-breakage)',
                }} />
              )}
            </button>
          </PopoverTrigger>
          {/* G-3: Refined overflow menu */}
          <PopoverContent
            side="top"
            sideOffset={8}
            className="w-auto p-0"
            style={{
              background: 'var(--bg)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: 6,
              minWidth: 180,
              boxShadow: 'var(--elev-raised)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Group 1: Content */}
              {onTemplates && (
                <button
                  type="button"
                  onClick={onTemplates}
                  onMouseEnter={() => setHoveredMenu('templates')}
                  onMouseLeave={() => setHoveredMenu(null)}
                  style={menuItem(hoveredMenu === 'templates')}
                >
                  <LayoutTemplate size={14} style={{ opacity: 0.5 }} />
                  Templates
                </button>
              )}
              <button
                type="button"
                onClick={onHistory}
                onMouseEnter={() => setHoveredMenu('history')}
                onMouseLeave={() => setHoveredMenu(null)}
                style={menuItem(hoveredMenu === 'history')}
              >
                <Clock size={14} style={{ opacity: 0.5 }} />
                History
              </button>

              {/* Divider */}
              <div style={{
                height: 1,
                background: 'var(--recess)',
                margin: '4px 0',
              }} />

              {/* Group 2: Tools */}
              {onGrammarCheck && (
                <button
                  type="button"
                  onClick={onGrammarCheck}
                  onMouseEnter={() => setHoveredMenu('grammar')}
                  onMouseLeave={() => setHoveredMenu(null)}
                  style={menuItem(hoveredMenu === 'grammar')}
                >
                  <SpellCheck size={14} style={{ opacity: 0.5 }} />
                  Grammar Check
                </button>
              )}
              {onAnnotations && (
                <button
                  type="button"
                  onClick={onAnnotations}
                  onMouseEnter={() => setHoveredMenu('notes')}
                  onMouseLeave={() => setHoveredMenu(null)}
                  style={menuItem(hoveredMenu === 'notes')}
                >
                  <StickyNote size={14} style={{ opacity: 0.5 }} />
                  Notes{annotationCount > 0 ? ` (${annotationCount})` : ''}
                </button>
              )}

              {/* Divider */}
              {onClearAll && (
                <>
                  <div style={{
                    height: 1,
                    background: 'var(--recess)',
                    margin: '4px 0',
                  }} />

                  {/* Group 3: Danger */}
                  {clearConfirm ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 12px',
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 500,
                        color: 'color-mix(in srgb, var(--cat-breakage) 80%, transparent)',
                        fontFamily: 'Figtree, sans-serif',
                        flex: 1,
                      }}>
                        Are you sure?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onClearAll();
                          setClearConfirm(false);
                        }}
                        style={{
                          padding: '3px 10px', fontSize: 11, fontWeight: 600,
                          background: 'color-mix(in srgb, var(--cat-breakage) 15%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--cat-breakage) 30%, transparent)',
                          borderRadius: 6,
                          color: 'color-mix(in srgb, var(--cat-breakage) 90%, transparent)',
                          cursor: 'pointer',
                          fontFamily: 'Figtree, sans-serif',
                        }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setClearConfirm(false)}
                        style={{
                          padding: '3px 10px', fontSize: 11, fontWeight: 500,
                          background: 'var(--recess)',
                          border: '1px solid var(--line)',
                          borderRadius: 6,
                          color: 'var(--text2)',
                          cursor: 'pointer',
                          fontFamily: 'Figtree, sans-serif',
                        }}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClearConfirm(true)}
                      onMouseEnter={() => setHoveredMenu('clear')}
                      onMouseLeave={() => setHoveredMenu(null)}
                      style={{
                        ...menuItem(hoveredMenu === 'clear'),
                        color: 'color-mix(in srgb, var(--cat-breakage) 80%, transparent)',
                      }}
                    >
                      <Trash2 size={14} style={{ opacity: 0.7 }} />
                      Clear All
                    </button>
                  )}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Divider />

        {/* Group 5: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          {/* Save — ghost */}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            title="Save draft (Ctrl+S)"
            onMouseEnter={() => setHoveredBtn('save')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px',
              background: hoveredBtn === 'save' ? 'var(--recess)' : 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 6,
              color: 'var(--text2)',
              fontSize: 12, fontWeight: 500,
              fontFamily: 'Figtree, sans-serif',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>

          {/* Publish — ONLY orange element */}
          <button
            type="button"
            onClick={onPublish}
            disabled={submitting}
            title="Publish"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 18px',
              background: submitting
                ? 'color-mix(in srgb, var(--action) 40%, transparent)'
                : 'var(--action)',
              border: 'none',
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: 12, fontWeight: 600,
              fontFamily: 'Figtree, sans-serif',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Publish
          </button>
        </div>
      </div>
    </>
  );
}

function menuItem(hovered: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'Figtree, sans-serif',
    color: 'var(--text2)',
    background: hovered ? 'var(--recess)' : 'none',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: feedback("background-color"),
    whiteSpace: 'nowrap' as const,
  };
}

function Divider() {
  return (
    <div style={{
      width: 1, height: 20,
      background: 'var(--recess)',
      margin: '0 4px',
      flexShrink: 0,
    }} />
  );
}

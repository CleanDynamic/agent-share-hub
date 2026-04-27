import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import { eventBus } from '@/lib/eventBus';
import type { Block, Connection } from '@/types/document';
import {
  STAGE_TEMPLATES,
  type StageTemplate,
  type TemplateCategory,
} from '@/lib/stageTemplates';

const CATEGORIES: (TemplateCategory | 'All')[] = [
  'All',
  'Prompt Engineering',
  'Agent Setup',
  'Comparison',
  'RAG',
  'Evaluation',
  'Reasoning',
  'User Flow',
];

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string;
  /** When true, shows an "Empty stage" card as the first option. */
  showEmptyOption?: boolean;
  /** Called after a template (or empty) is applied. */
  onApplied?: (templateId: string | null) => void;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function applyTemplateToStage(
  template: StageTemplate,
  stageId: string,
  store: {
    addBlock: (b: Block) => void;
    addConnection: (c: Connection) => void;
  },
) {
  const now = new Date().toISOString();
  const nameToId = new Map<string, string>();

  for (const tb of template.blocks) {
    const id = uuid();
    nameToId.set(tb.name, id);
    const block: Block = {
      id,
      stage_id: stageId,
      type: tb.type,
      position_x: tb.position_x,
      position_y: tb.position_y,
      width: tb.width,
      height: tb.height,
      z_index: 0,
      name: tb.name,
      properties: tb.properties ?? {},
      locked: false,
      created_at: now,
      updated_at: now,
    };
    store.addBlock(block);
  }

  for (const tc of template.connections) {
    const from = nameToId.get(tc.from_name);
    const to = nameToId.get(tc.to_name);
    if (!from || !to) continue;
    const conn: Connection = {
      id: uuid(),
      from_block_id: from,
      to_block_id: to,
      from_port: tc.from_port,
      to_port: tc.to_port,
      connection_type: tc.connection_type,
      label: tc.label ?? null,
      carries_data: tc.carries_data,
      created_at: now,
    };
    store.addConnection(conn);
  }
}

function MiniPreview({ template }: { template: StageTemplate }) {
  // Compute a normalised view of the blocks within a 200x100 box.
  const { vbX, vbY, vbW, vbH } = useMemo(() => {
    const xs = template.blocks.map((b) => b.position_x);
    const ys = template.blocks.map((b) => b.position_y);
    const xe = template.blocks.map((b) => b.position_x + b.width);
    const ye = template.blocks.map((b) => b.position_y + b.height);
    const minX = Math.min(...xs) - 20;
    const minY = Math.min(...ys) - 20;
    const maxX = Math.max(...xe) + 20;
    const maxY = Math.max(...ye) + 20;
    return { vbX: minX, vbY: minY, vbW: maxX - minX, vbH: maxY - minY };
  }, [template]);

  const idMap = new Map(template.blocks.map((b) => [b.name, b]));
  const colorFor: Record<string, string> = {
    text: 'rgba(255,255,255,0.5)',
    prompt: '#8B5CF6',
    code: '#22C55E',
    result: '#F59E0B',
    agent: '#3B82F6',
    tool: '#EC4899',
    model: '#06B6D4',
    compare: '#A855F7',
    resource: '#10B981',
  };

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
    >
      {template.connections.map((c, i) => {
        const a = idMap.get(c.from_name);
        const b = idMap.get(c.to_name);
        if (!a || !b) return null;
        const ax = a.position_x + a.width / 2;
        const ay = a.position_y + a.height / 2;
        const bx = b.position_x + b.width / 2;
        const by = b.position_y + b.height / 2;
        return (
          <line
            key={i}
            x1={ax} y1={ay} x2={bx} y2={by}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={2}
          />
        );
      })}
      {template.blocks.map((b) => (
        <rect
          key={b.name}
          x={b.position_x}
          y={b.position_y}
          width={b.width}
          height={b.height}
          rx={8}
          fill="rgba(20,20,28,0.85)"
          stroke={colorFor[b.type] ?? 'rgba(255,255,255,0.4)'}
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}

export function TemplatePicker({
  open,
  onOpenChange,
  stageId,
  showEmptyOption = false,
  onApplied,
}: TemplatePickerProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All');
  const addBlock = useDocumentStore((s) => s.addBlock);
  const addConnection = useDocumentStore((s) => s.addConnection);

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return STAGE_TEMPLATES;
    return STAGE_TEMPLATES.filter((t) => t.category === activeCategory);
  }, [activeCategory]);

  const handlePick = (template: StageTemplate | null) => {
    if (template) {
      applyTemplateToStage(template, stageId, { addBlock, addConnection });
      // Templates always insert 2+ blocks → ask the canvas to fit-view
      // them. Defer one tick so React Flow has registered the new nodes.
      setTimeout(() => {
        eventBus.emit('canvas:fit-needed', { stageId });
      }, 50);
    }
    onApplied?.(template?.id ?? null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-0 overflow-hidden"
        style={{
          background: 'hsl(240 20% 8% / 0.96)',
          backdropFilter: 'blur(20px)',
          border: '1px solid hsl(var(--foreground) / 0.08)',
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="text-base font-semibold">Stage templates</DialogTitle>
          <DialogDescription className="text-xs text-foreground/55">
            Drop a pre-wired set of blocks into this stage. You can edit everything afterwards.
          </DialogDescription>
        </DialogHeader>

        {/* Category tabs */}
        <div className="px-6 pb-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-2.5 py-1 text-[11px] rounded-full border transition-colors',
                activeCategory === cat
                  ? 'bg-foreground/10 border-foreground/20 text-foreground/90'
                  : 'border-foreground/10 text-foreground/55 hover:text-foreground/85 hover:border-foreground/20',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {showEmptyOption && (activeCategory === 'All') && (
              <button
                type="button"
                onClick={() => handlePick(null)}
                className="text-left rounded-lg border border-dashed border-foreground/15 hover:border-foreground/30 transition-colors p-3 flex flex-col gap-2 min-h-[180px]"
                style={{ background: 'rgba(20,20,28,0.4)' }}
              >
                <div className="h-20 rounded-md flex items-center justify-center text-foreground/40 text-2xl">
                  ＋
                </div>
                <div className="text-[13px] font-medium text-foreground/85">Empty stage</div>
                <div className="text-[11px] text-foreground/50">Start from a blank canvas.</div>
              </button>
            )}

            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handlePick(t)}
                className="text-left rounded-lg border border-foreground/10 hover:border-foreground/25 transition-colors p-3 flex flex-col gap-2 min-h-[180px]"
                style={{ background: 'rgba(20,20,28,0.55)' }}
              >
                <div
                  className="h-20 rounded-md overflow-hidden flex items-center justify-center"
                  style={{ background: 'rgba(10,10,14,0.6)' }}
                >
                  <MiniPreview template={t} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] font-medium text-foreground/90 truncate">{t.name}</div>
                  <span className="text-[10px] text-foreground/45 shrink-0">{t.preview}</span>
                </div>
                <div className="text-[10.5px] uppercase tracking-wider text-foreground/40">
                  {t.category}
                </div>
                <div className="text-[11px] text-foreground/55 line-clamp-2">{t.description}</div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

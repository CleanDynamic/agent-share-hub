import * as React from 'react';
import { create } from 'zustand';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  STAGE_TEMPLATES,
  type StageTemplate,
  type TemplateBlock,
  type TemplateConnection,
} from '@/lib/stageTemplates';

const BLOCK_TYPE_COLOR: Record<string, string> = {
  text: '#3B82F6',
  prompt: '#8B5CF6',
  code: '#10B981',
  result: '#F59E0B',
  model: '#EC4899',
  agent: '#06B6D4',
  tool: '#84CC16',
  workflow: '#F97316',
  compare: '#EAB308',
  heading: '#A78BFA',
  image: '#22D3EE',
  video: '#22D3EE',
  tutorial: '#FB7185',
  resource: '#FBBF24',
  note: '#9CA3AF',
  quote: '#9CA3AF',
};

type Port = 'top' | 'right' | 'bottom' | 'left';

function portXY(b: TemplateBlock, port: Port): [number, number] {
  const cx = b.position_x + b.width / 2;
  const cy = b.position_y + b.height / 2;
  switch (port) {
    case 'top':
      return [cx, b.position_y];
    case 'bottom':
      return [cx, b.position_y + b.height];
    case 'left':
      return [b.position_x, cy];
    case 'right':
      return [b.position_x + b.width, cy];
  }
}

function MiniPreview({
  blocks,
  connections,
}: {
  blocks: TemplateBlock[];
  connections: TemplateConnection[];
}) {
  if (!blocks.length) {
    return (
      <div
        style={{
          width: '100%',
          height: 80,
          background: 'rgba(255,255,255,0.02)',
          border: '0.5px dashed rgba(255,255,255,0.10)',
          borderRadius: 6,
        }}
      />
    );
  }
  const padding = 30;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of blocks) {
    minX = Math.min(minX, b.position_x);
    minY = Math.min(minY, b.position_y);
    maxX = Math.max(maxX, b.position_x + b.width);
    maxY = Math.max(maxY, b.position_y + b.height);
  }
  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = maxX - minX + padding * 2;
  const vbH = maxY - minY + padding * 2;

  const blocksByName = new Map<string, TemplateBlock>();
  for (const b of blocks) if (b.name) blocksByName.set(b.name, b);

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height={90}
      style={{ display: 'block' }}
    >
      <defs>
        <marker
          id="tpl-preview-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.55)" />
        </marker>
      </defs>
      {connections.map((c, i) => {
        const fb = blocksByName.get(c.from_name);
        const tb = blocksByName.get(c.to_name);
        if (!fb || !tb) return null;
        const [x1, y1] = portXY(fb, c.from_port);
        const [x2, y2] = portXY(tb, c.to_port);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={4}
            markerEnd="url(#tpl-preview-arrow)"
          />
        );
      })}
      {blocks.map((b, i) => {
        const color = BLOCK_TYPE_COLOR[b.type] ?? '#9CA3AF';
        return (
          <rect
            key={i}
            x={b.position_x}
            y={b.position_y}
            width={b.width}
            height={b.height}
            rx={12}
            fill={`${color}33`}
            stroke={color}
            strokeWidth={4}
          />
        );
      })}
    </svg>
  );
}

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showEmpty?: boolean;
  onSelectTemplate: (template: StageTemplate) => void;
  onSelectEmpty?: () => void;
}

export function TemplatePicker({
  open,
  onOpenChange,
  showEmpty,
  onSelectTemplate,
  onSelectEmpty,
}: TemplatePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        style={{
          background: 'rgba(20, 20, 28, 0.95)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.85)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'rgba(255,255,255,0.95)' }}>Stage templates</DialogTitle>
          <DialogDescription style={{ color: 'rgba(255,255,255,0.5)' }}>
            Pick a starting layout. Blocks and arrows are pre-snapped to the 20px grid.
          </DialogDescription>
        </DialogHeader>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
            maxHeight: 480,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {showEmpty ? (
            <TemplateCard
              title="Empty stage"
              category="Blank"
              description="Start from a blank canvas with no preset blocks."
              preview={<EmptyPreview />}
              icon={<Sparkles size={14} />}
              onClick={() => {
                onSelectEmpty?.();
                onOpenChange(false);
              }}
              dashed
            />
          ) : null}
          {STAGE_TEMPLATES.map((tmpl) => (
            <TemplateCard
              key={tmpl.id}
              title={tmpl.name}
              category={tmpl.category}
              description={tmpl.description}
              icon={tmpl.preview ? <span style={{ fontSize: 14 }}>{tmpl.preview}</span> : null}
              preview={<MiniPreview blocks={tmpl.blocks} connections={tmpl.connections} />}
              onClick={() => {
                onSelectTemplate(tmpl);
                onOpenChange(false);
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyPreview() {
  return (
    <div
      style={{
        height: 90,
        background: 'rgba(255,255,255,0.02)',
        border: '0.5px dashed rgba(255,255,255,0.10)',
        borderRadius: 6,
      }}
    />
  );
}

function TemplateCard({
  title,
  category,
  description,
  preview,
  icon,
  onClick,
  dashed,
}: {
  title: string;
  category: string;
  description: string;
  preview: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  dashed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: dashed
          ? '0.5px dashed rgba(255,255,255,0.16)'
          : '0.5px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: 14,
        textAlign: 'left',
        cursor: 'pointer',
        color: 'rgba(255,255,255,0.85)',
        fontFamily: 'Inter, sans-serif',
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(232,87,26,0.55)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = dashed
          ? 'rgba(255,255,255,0.16)'
          : 'rgba(255,255,255,0.08)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 4,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {icon}
          {title}
        </div>
        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            background: 'rgba(232,87,26,0.14)',
            color: '#E8571A',
            whiteSpace: 'nowrap',
          }}
        >
          {category}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.4,
          marginBottom: 10,
          minHeight: 32,
        }}
      >
        {description}
      </div>
      <div
        style={{
          background: 'rgba(0,0,0,0.25)',
          border: '0.5px solid rgba(255,255,255,0.06)',
          borderRadius: 6,
          padding: 6,
        }}
      >
        {preview}
      </div>
    </button>
  );
}

/**
 * Imperative controller for the template picker. Renders <TemplatePickerHost />
 * once at the editor root, then anyone (slash command actions, footer buttons)
 * can call `useTemplatePickerStore.getState().open(...)` from non-React code.
 */
interface TemplatePickerStore {
  isOpen: boolean;
  showEmpty: boolean;
  onSelectTemplate: ((template: StageTemplate) => void) | null;
  onSelectEmpty: (() => void) | null;
  open: (opts: {
    showEmpty?: boolean;
    onSelectTemplate: (template: StageTemplate) => void;
    onSelectEmpty?: () => void;
  }) => void;
  close: () => void;
}

export const useTemplatePickerStore = create<TemplatePickerStore>((set) => ({
  isOpen: false,
  showEmpty: false,
  onSelectTemplate: null,
  onSelectEmpty: null,
  open: (opts) =>
    set({
      isOpen: true,
      showEmpty: !!opts.showEmpty,
      onSelectTemplate: opts.onSelectTemplate,
      onSelectEmpty: opts.onSelectEmpty ?? null,
    }),
  close: () =>
    set({
      isOpen: false,
      showEmpty: false,
      onSelectTemplate: null,
      onSelectEmpty: null,
    }),
}));

export function TemplatePickerHost() {
  const isOpen = useTemplatePickerStore((s) => s.isOpen);
  const showEmpty = useTemplatePickerStore((s) => s.showEmpty);
  const onSelectTemplate = useTemplatePickerStore((s) => s.onSelectTemplate);
  const onSelectEmpty = useTemplatePickerStore((s) => s.onSelectEmpty);
  const close = useTemplatePickerStore((s) => s.close);

  return (
    <TemplatePicker
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      showEmpty={showEmpty}
      onSelectTemplate={(tmpl) => {
        onSelectTemplate?.(tmpl);
      }}
      onSelectEmpty={onSelectEmpty ? () => onSelectEmpty() : undefined}
    />
  );
}

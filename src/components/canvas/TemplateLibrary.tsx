import { useState } from 'react';
import {
  BLOCK_TEMPLATES,
  BlockTemplate,
  scaleTemplate,
} from '@/lib/canvas-templates';
import type { CanvasBlock, BlockArrow }
  from '@/lib/canvas-types';
import { ARROW_TYPE_META } from '@/lib/canvas-types';
import { getNextRow } from '@/lib/canvas-utils';

const SCALE_OPTIONS = [1, 2, 3, 5, 10] as const;
type ScaleValue = (typeof SCALE_OPTIONS)[number];

interface TemplateLibraryProps {
  open: boolean;
  onClose: () => void;
  currentBlocks: CanvasBlock[];
  onApply: (
    blocks: Omit<CanvasBlock, 'id'>[],
    arrows: Omit<BlockArrow, 'id'>[]
  ) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  prompt: 'Prompts',
  build: 'Builds',
  evaluation: 'Evaluation',
  agent: 'Agents',
  comparison: 'Comparisons',
  tutorial: 'Tutorial',
};

export function TemplateLibrary({
  open, onClose, currentBlocks, onApply,
}: TemplateLibraryProps) {
  const [activeCategory, setActiveCategory] =
    useState<string>('all');
  const [hoveredTemplate, setHoveredTemplate] =
    useState<string | null>(null);
  const [templateScales, setTemplateScales] =
    useState<Record<string, ScaleValue>>({});

  if (!open) return null;

  const categories = [
    'all',
    ...Object.keys(CATEGORY_LABELS),
  ];

  const filtered = activeCategory === 'all'
    ? BLOCK_TEMPLATES
    : BLOCK_TEMPLATES.filter(
        t => t.category === activeCategory
      );

  const getScale = (id: string): ScaleValue =>
    templateScales[id] ?? 1;

  const setScale = (id: string, scale: ScaleValue) =>
    setTemplateScales(prev => ({ ...prev, [id]: scale }));

  const applyTemplate = (
    template: BlockTemplate
  ) => {
    const scale = getScale(template.id);
    const scaled = scale === 1
      ? template
      : scaleTemplate(template, scale);

    const startRow = getNextRow(currentBlocks);
    const blockIds: string[] = scaled.blocks.map(
      () => crypto.randomUUID()
    );

    const newBlocks = scaled.blocks.map(
      (bt, i) => ({
        id: blockIds[i],
        type: bt.type,
        textContent: '',
        subheading: bt.subheading,
        position: {
          ...bt.position,
          row: bt.position.row + startRow - 1,
        },
        stageId: null,
        stageIndex: null,
        isLocked: false,
        lockType: 'none' as const,
        mobileOrder: null,
        creatorAnnotation: null,
      })
    );

    const newArrows = scaled.arrows.map(a => {
      const meta = ARROW_TYPE_META[
        a.arrowType as keyof typeof ARROW_TYPE_META
      ];
      return {
        fromBlockId: blockIds[a.fromIndex],
        toBlockId: blockIds[a.toIndex],
        fromEdge: a.fromEdge,
        toEdge: a.toEdge,
        label: meta?.label ?? a.arrowType,
        arrowType: a.arrowType as any,
        color: meta?.color ?? '#E8571A',
      };
    });

    onApply(newBlocks, newArrows);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.60)',
          zIndex: 200,
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        right: 0, top: 0, bottom: 0,
        width: 360,
        background: 'rgba(10,10,16,0.99)',
        borderLeft:
          '1px solid rgba(255,255,255,0.10)',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 14px 20px',
          borderBottom:
            '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: 'rgba(255,255,255,0.88)',
              fontFamily:
                "'Playfair Display', Georgia, serif",
            }}>
              Templates
            </div>
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.30)',
              marginTop: 2,
            }}>
              Drop pre-built block arrangements
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.40)',
            cursor: 'pointer', fontSize: 18,
          }}>×</button>
        </div>

        {/* Category filter */}
        <div style={{
          display: 'flex', gap: 0,
          borderBottom:
            '1px solid rgba(255,255,255,0.06)',
          overflowX: 'auto',
          padding: '0 20px',
        }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '10px 12px',
                background: 'none',
                border: 'none',
                borderBottom:
                  activeCategory === cat
                    ? '2px solid #E8571A'
                    : '2px solid transparent',
                color: activeCategory === cat
                  ? '#fff'
                  : 'rgba(255,255,255,0.35)',
                fontSize: 12, cursor: 'pointer',
                fontWeight: activeCategory === cat
                  ? 600 : 400,
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {cat === 'all' ? 'All'
                : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Template list */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column', gap: 8,
        }}>
          {filtered.map(template => {
            const scale = getScale(template.id);
            const preview = scale === 1
              ? template
              : scaleTemplate(template, scale);
            return (
              <div
                key={template.id}
                onMouseEnter={() =>
                  setHoveredTemplate(template.id)}
                onMouseLeave={() =>
                  setHoveredTemplate(null)}
                style={{
                  border: hoveredTemplate === template.id
                    ? '1px solid rgba(232,87,26,0.35)'
                    : '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                  padding: '14px',
                  background:
                    hoveredTemplate === template.id
                      ? 'rgba(232,87,26,0.06)'
                      : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: 'rgba(255,255,255,0.88)',
                  marginBottom: 4,
                  fontFamily:
                    "'Playfair Display', Georgia, serif",
                }}>
                  {template.label}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.40)',
                  lineHeight: 1.55, marginBottom: 10,
                }}>
                  {template.description}
                </div>

                {/* Scale selector */}
                <div style={{
                  display: 'flex', gap: 4,
                  marginBottom: 10,
                }}>
                  {SCALE_OPTIONS.map(s => {
                    const active = scale === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setScale(template.id, s);
                        }}
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 5,
                          cursor: 'pointer',
                          background: active
                            ? 'rgba(232,87,26,0.15)'
                            : 'rgba(255,255,255,0.03)',
                          border: active
                            ? '1px solid rgba(232,87,26,0.4)'
                            : '1px solid rgba(255,255,255,0.08)',
                          color: active
                            ? '#E8571A'
                            : 'rgba(255,255,255,0.45)',
                          transition: 'all 0.12s',
                        }}
                      >
                        {s}x
                      </button>
                    );
                  })}
                </div>

                {/* Block type preview */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap',
                  gap: 4, marginBottom: 10,
                }}>
                  {preview.blocks
                    .slice(0, 8)
                    .map((bt, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 9, padding: '2px 7px',
                        borderRadius: 4,
                        background:
                          'rgba(255,255,255,0.04)',
                        border:
                          '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.40)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {bt.type.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {preview.blocks.length > 8 && (
                    <span style={{
                      fontSize: 9, padding: '2px 7px',
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.04)',
                      border:
                        '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.40)',
                      fontWeight: 600,
                    }}>
                      +{preview.blocks.length - 8} more
                    </span>
                  )}
                  {preview.arrows.length > 0 && (
                    <span style={{
                      fontSize: 9, padding: '2px 7px',
                      borderRadius: 4,
                      background:
                        'rgba(232,87,26,0.08)',
                      border:
                        '1px solid rgba(232,87,26,0.20)',
                      color: '#E8571A',
                      fontWeight: 600,
                    }}>
                      {preview.arrows.length} arrows
                    </span>
                  )}
                </div>

                {/* Apply button */}
                <button
                  type="button"
                  onClick={() => applyTemplate(template)}
                  style={{
                    width: '100%',
                    padding: '7px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: 'rgba(232,87,26,0.85)',
                    border: '1px solid rgba(232,87,26,0.5)',
                    color: '#fff',
                    transition: 'all 0.12s',
                  }}
                >
                  Apply{scale > 1 ? ` (${scale}x)` : ''}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

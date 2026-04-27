import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, ChevronDown, Check, Plus, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';

interface WorkflowStep {
  id: string;
  title: string;
  body?: string;
  completed?: boolean;
}

interface WorkflowBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const TYPE_COLOR = '#14B8A6';

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

function newStepId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function WorkflowBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as WorkflowBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const setSelection = useDocumentStore((s) => s.setSelection);

  const [hovered, setHovered] = React.useState(false);
  const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(new Set());
  const [editingTitleId, setEditingTitleId] = React.useState<string | null>(null);

  if (!block) return null;

  const props = (block.properties ?? {}) as {
    steps?: WorkflowStep[];
    currentStepId?: string;
  };

  const steps: WorkflowStep[] = props.steps ?? [];
  const currentStepId = props.currentStepId;

  const patchProps = (patch: Record<string, unknown>) => {
    updateBlock(blockId, {
      properties: { ...(block.properties ?? {}), ...patch },
    });
  };

  const setSteps = (next: WorkflowStep[]) => patchProps({ steps: next });

  const selectThis = () => setSelection({ kind: 'block', ids: [blockId] });

  const toggleExpand = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const updateStep = (stepId: string, patch: Partial<WorkflowStep>) => {
    setSteps(steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
  };

  const addStep = () => {
    const id = newStepId();
    setSteps([...steps, { id, title: `Step ${steps.length + 1}` }]);
    setExpandedSteps((prev) => new Set(prev).add(id));
    setEditingTitleId(id);
  };

  const completedCount = steps.filter((s) => s.completed).length;

  const portOpacity = hovered || selected ? 1 : 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={selectThis}
      className="group relative rounded-lg p-2.5 bg-[rgba(20,20,28,0.85)] backdrop-blur-md transition-all"
      style={{
        width: 300,
        border: selected
          ? `1px solid ${TYPE_COLOR}99`
          : '1px solid rgba(255,255,255,0.08)',
        boxShadow: selected ? `0 0 0 2px ${TYPE_COLOR}26` : 'none',
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
          Workflow
        </span>
        <div className="flex-1" />
        <span className="text-[10px] text-white/40 nodrag">
          {completedCount}/{steps.length} complete
        </span>
        <button
          type="button"
          className="p-0.5 text-white/40 hover:text-white/80 nodrag"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={12} />
        </button>
      </div>

      {/* Steps */}
      <div className="space-y-1.5">
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.id);
          const isCurrent = step.id === currentStepId;

          return (
            <div
              key={step.id}
              className={cn(
                'rounded-md border transition-colors nodrag',
                isCurrent
                  ? 'border-white/15 bg-white/[0.04]'
                  : 'border-white/[0.06] bg-white/[0.02]',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Step header */}
              <div
                className="flex items-center gap-2 p-2 cursor-pointer"
                onClick={() => {
                  toggleExpand(step.id);
                  patchProps({ currentStepId: step.id });
                }}
              >
                {/* Step number / check */}
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0',
                    step.completed
                      ? 'text-white'
                      : 'bg-white/[0.06] text-white/60',
                  )}
                  style={
                    step.completed
                      ? { background: TYPE_COLOR }
                      : undefined
                  }
                >
                  {step.completed ? <Check size={11} strokeWidth={3} /> : index + 1}
                </div>

                {/* Title */}
                {editingTitleId === step.id ? (
                  <input
                    autoFocus
                    value={step.title}
                    onChange={(e) =>
                      updateStep(step.id, { title: e.target.value })
                    }
                    onBlur={() => setEditingTitleId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        setEditingTitleId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-transparent outline-none text-[12px] text-white/85 border-b border-white/15"
                  />
                ) : (
                  <span
                    className="flex-1 min-w-0 text-[12px] text-white/85 truncate"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingTitleId(step.id);
                    }}
                  >
                    {step.title || `Step ${index + 1}`}
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStep(step.id);
                  }}
                  className="p-0.5 text-white/30 hover:text-white/70 transition-colors"
                  title="Remove step"
                >
                  <X size={11} />
                </button>

                <ChevronDown
                  size={12}
                  className={cn(
                    'text-white/40 transition-transform',
                    isExpanded && 'rotate-180',
                  )}
                />
              </div>

              {/* Step body */}
              {isExpanded && (
                <div className="px-2 pb-2 pt-0 space-y-2 border-t border-white/[0.06]">
                  <textarea
                    value={step.body ?? ''}
                    onChange={(e) =>
                      updateStep(step.id, { body: e.target.value })
                    }
                    placeholder="Describe this step..."
                    className={cn(
                      'w-full min-h-[48px] p-2 mt-2 rounded-md resize-none',
                      'bg-white/[0.02] border border-white/[0.04]',
                      'text-[11px] text-white/70 placeholder:text-white/25',
                      'outline-none focus:border-white/[0.10] transition-colors',
                    )}
                  />

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!step.completed}
                      onChange={(e) =>
                        updateStep(step.id, { completed: e.target.checked })
                      }
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                        step.completed
                          ? 'border-transparent text-white'
                          : 'border-white/20 bg-transparent',
                      )}
                      style={
                        step.completed
                          ? { background: TYPE_COLOR }
                          : undefined
                      }
                    >
                      {step.completed && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span className="text-[11px] text-white/60">Mark complete</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add / empty state */}
      {steps.length === 0 ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addStep();
          }}
          className="nodrag w-full py-3 mt-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.02] text-[11px] text-white/40 hover:text-white/70 transition-colors"
        >
          <Plus size={12} />
          Add first step
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addStep();
          }}
          className="nodrag mt-2 flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-medium text-white/50 hover:text-white/85 hover:bg-white/[0.04] transition-colors"
        >
          <Plus size={11} />
          Add step
        </button>
      )}
    </div>
  );
}

import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, ArrowUpRight, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import { isNameUnique } from '@/lib/variables';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { colourAlpha } from "@/lib/theme/tokens";

interface ToolBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const TYPE_COLOR = 'var(--action)';

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: 'var(--evidence)',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

export function ToolBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as ToolBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const allBlocks = useDocumentStore((s) => s.blocks);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const setSelection = useDocumentStore((s) => s.setSelection);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'params' | 'return'>('params');
  const [hovered, setHovered] = React.useState(false);

  if (!block) return null;

  const props = (block.properties ?? {}) as {
    description?: string;
    parameters?: string;
    returnSchema?: string;
    implementationRef?: string;
  };

  const name = block.name ?? '';
  const description = props.description ?? '';
  const parameters = props.parameters ?? '{}';
  const returnSchema = props.returnSchema ?? '{}';
  const implementationRef = props.implementationRef ?? '';

  const paramCount = React.useMemo(() => {
    try {
      const parsed = JSON.parse(parameters);
      if (parsed?.properties && typeof parsed.properties === 'object') {
        return Object.keys(parsed.properties).length;
      }
      return 0;
    } catch {
      return 0;
    }
  }, [parameters]);

  const patchProps = (patch: Record<string, unknown>) => {
    updateBlock(blockId, {
      properties: { ...(block.properties ?? {}), ...patch },
    });
  };

  const onNameChange = (v: string) => {
    if (!isNameUnique(v, blockId, allBlocks)) {
      toast.error(`Name "${v.trim()}" is already used by another block.`);
      return;
    }
    updateBlock(blockId, { name: v });
  };
  const selectThis = () => setSelection({ kind: 'block', ids: [blockId] });

  const portOpacity = hovered || selected ? 1 : 0;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={selectThis}
        className="group relative rounded-lg p-2.5 bg-[var(--recess)] backdrop-blur-md transition-feedback"
        style={{
          width: 260,
          border: selected
            ? `1px solid ${colourAlpha(TYPE_COLOR, 0.6)}`
            : '1px solid var(--line)',
          boxShadow: selected ? `0 0 0 2px ${colourAlpha(TYPE_COLOR, 0.149)}` : 'none',
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
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tool
          </span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
            className="flex-1 min-w-0 bg-transparent text-[10px] font-medium text-foreground placeholder:text-muted-foreground outline-none nodrag"
          />
          <button
            type="button"
            className="p-0.5 text-muted-foreground hover:text-muted-foreground nodrag"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* Compact info */}
        <div
          className="flex items-center gap-2 px-2 py-2 mb-2 rounded-md"
          style={{
            background: 'var(--recess)',
            border: '1px solid var(--line)',
          }}
        >
          <Wrench size={12} style={{ color: TYPE_COLOR }} />
          <span className="text-[11px] text-muted-foreground truncate flex-1">
            {description || 'No description'}
          </span>
        </div>

        <div className="text-[10px] text-muted-foreground mb-2 truncate">
          {paramCount} parameter{paramCount !== 1 ? 's' : ''}
          {implementationRef ? ` · ${implementationRef}` : ''}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectThis();
              setDrawerOpen(true);
            }}
            className="nodrag p-1 text-muted-foreground hover:text-muted-foreground rounded transition-colors"
            title="Expand"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* Expanded drawer */}
      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (open) selectThis();
        }}
      >
        <SheetContent
          side="right"
          className="w-[560px] sm:max-w-[560px] bg-[var(--recess)] border-border text-foreground overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-foreground text-base">Tool block</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Tool name"
              className="w-full px-3 py-2 rounded-md bg-foreground/[0.03] border border-border/[0.06] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-border/[0.12] transition-colors"
            />

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => patchProps({ description: e.target.value })}
                placeholder="What does this tool do?"
                className={cn(
                  'w-full h-20 p-3 rounded-md resize-none',
                  'bg-foreground/[0.03] border border-border/[0.06]',
                  'text-xs text-foreground placeholder:text-muted-foreground',
                  'outline-none focus:border-border/[0.12] transition-colors',
                )}
              />
            </div>

            {/* Schema tabs */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('params')}
                  className={cn(
                    'px-2 py-1 text-[11px] font-medium rounded transition-colors',
                    activeTab === 'params'
                      ? 'bg-foreground/[0.08] text-foreground'
                      : 'text-muted-foreground hover:text-muted-foreground',
                  )}
                >
                  Parameters
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('return')}
                  className={cn(
                    'px-2 py-1 text-[11px] font-medium rounded transition-colors',
                    activeTab === 'return'
                      ? 'bg-foreground/[0.08] text-foreground'
                      : 'text-muted-foreground hover:text-muted-foreground',
                  )}
                >
                  Return Schema
                </button>
              </div>

              <textarea
                value={activeTab === 'params' ? parameters : returnSchema}
                onChange={(e) =>
                  activeTab === 'params'
                    ? patchProps({ parameters: e.target.value })
                    : patchProps({ returnSchema: e.target.value })
                }
                placeholder={`{\n  "type": "object",\n  "properties": {\n    ...\n  }\n}`}
                className={cn(
                  'w-full h-48 p-3 rounded-md resize-none font-mono',
                  'bg-foreground/[0.03] border border-border/[0.06]',
                  'text-[11px] text-foreground placeholder:text-muted-foreground',
                  'outline-none focus:border-border/[0.12] transition-colors',
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                Implementation reference
              </label>
              <input
                type="text"
                value={implementationRef}
                onChange={(e) => patchProps({ implementationRef: e.target.value })}
                placeholder="e.g., /api/tools/my-tool or function:myTool"
                className={cn(
                  'w-full px-3 py-2 rounded-md font-mono',
                  'bg-foreground/[0.03] border border-border/[0.06]',
                  'text-xs text-foreground placeholder:text-muted-foreground',
                  'outline-none focus:border-border/[0.12] transition-colors',
                )}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

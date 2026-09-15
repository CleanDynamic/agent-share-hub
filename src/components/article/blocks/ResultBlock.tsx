import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  MoreHorizontal,
  ArrowUpRight,
  Copy,
  Download,
  Check,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import { isNameUnique } from '@/lib/variables';
import { useEvent } from '@/lib/eventBus';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { colourAlpha } from "@/lib/theme/tokens";
import { feedback } from '@/lib/theme/motion';

type BlockStatus = 'idle' | 'running' | 'success' | 'error';
type TabType = 'markdown' | 'json' | 'raw';

interface ResultBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const TYPE_COLOR = 'var(--cat-agents)';

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: 'var(--evidence)',
  border: '2px solid white',
  opacity: 0,
  transition: feedback("opacity"),
};

function StatusDot({ status }: { status: BlockStatus }) {
  if (status === 'running')
    return <span className="inline-block w-2 h-2 rounded-full bg-[var(--action)] animate-pulse" />;
  if (status === 'success')
    return (
      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 text-foreground">
        <Check size={8} strokeWidth={3} />
      </span>
    );
  if (status === 'error')
    return <span className="inline-block w-2 h-2 rounded-full bg-[var(--cat-breakage)]" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-muted" />;
}

// JSON Tree Viewer
function JsonTreeNode({
  data,
  keyName,
  isLast = true,
  depth = 0,
}: {
  data: unknown;
  keyName?: string;
  isLast?: boolean;
  depth?: number;
}) {
  const [isOpen, setIsOpen] = React.useState(depth < 2);

  const renderKey = () =>
    keyName ? (
      <>
        <span className="text-[var(--cat-data)]">{`"${keyName}"`}</span>
        <span className="text-muted-foreground">: </span>
      </>
    ) : null;

  if (data === null) {
    return (
      <div className="flex items-start gap-1 text-[11px] font-mono">
        {renderKey()}
        <span className="text-muted-foreground">null</span>
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  if (typeof data === 'boolean') {
    return (
      <div className="flex items-start gap-1 text-[11px] font-mono">
        {renderKey()}
        <span className="text-[var(--cat-media)]">{data.toString()}</span>
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  if (typeof data === 'number') {
    return (
      <div className="flex items-start gap-1 text-[11px] font-mono">
        {renderKey()}
        <span className="text-[var(--lit)]">{data}</span>
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  if (typeof data === 'string') {
    return (
      <div className="flex items-start gap-1 text-[11px] font-mono">
        {renderKey()}
        <span className="text-[var(--cat-configuration)]">{`"${data}"`}</span>
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div className="flex items-start gap-1 text-[11px] font-mono">
          {renderKey()}
          <span className="text-muted-foreground">[]</span>
          {!isLast && <span className="text-muted-foreground">,</span>}
        </div>
      );
    }
    return (
      <div className="text-[11px] font-mono">
        <button
          type="button"
          className="flex items-start gap-1 hover:bg-foreground/[0.04] rounded px-0.5"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          {isOpen ? (
            <ChevronDown size={10} className="mt-0.5 text-muted-foreground" />
          ) : (
            <ChevronRight size={10} className="mt-0.5 text-muted-foreground" />
          )}
          {renderKey()}
          <span className="text-muted-foreground">[</span>
          {!isOpen && (
            <>
              <span className="text-muted-foreground ml-1">{data.length} items</span>
              <span className="text-muted-foreground ml-1">]</span>
              {!isLast && <span className="text-muted-foreground">,</span>}
            </>
          )}
        </button>
        {isOpen && (
          <>
            <div className="ml-3 border-l border-border pl-2">
              {data.map((item, index) => (
                <JsonTreeNode
                  key={index}
                  data={item}
                  isLast={index === data.length - 1}
                  depth={depth + 1}
                />
              ))}
            </div>
            <div className="text-muted-foreground">
              ]{!isLast && <span className="text-muted-foreground">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <div className="flex items-start gap-1 text-[11px] font-mono">
          {renderKey()}
          <span className="text-muted-foreground">{'{}'}</span>
          {!isLast && <span className="text-muted-foreground">,</span>}
        </div>
      );
    }
    return (
      <div className="text-[11px] font-mono">
        <button
          type="button"
          className="flex items-start gap-1 hover:bg-foreground/[0.04] rounded px-0.5"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          {isOpen ? (
            <ChevronDown size={10} className="mt-0.5 text-muted-foreground" />
          ) : (
            <ChevronRight size={10} className="mt-0.5 text-muted-foreground" />
          )}
          {renderKey()}
          <span className="text-muted-foreground">{'{'}</span>
          {!isOpen && (
            <>
              <span className="text-muted-foreground ml-1">{entries.length} keys</span>
              <span className="text-muted-foreground ml-1">{'}'}</span>
              {!isLast && <span className="text-muted-foreground">,</span>}
            </>
          )}
        </button>
        {isOpen && (
          <>
            <div className="ml-3 border-l border-border pl-2">
              {entries.map(([key, value], index) => (
                <JsonTreeNode
                  key={key}
                  data={value}
                  keyName={key}
                  isLast={index === entries.length - 1}
                  depth={depth + 1}
                />
              ))}
            </div>
            <div className="text-muted-foreground">
              {'}'}
              {!isLast && <span className="text-muted-foreground">,</span>}
            </div>
          </>
        )}
      </div>
    );
  }

  return null;
}

export function ResultBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as ResultBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const allBlocks = useDocumentStore((s) => s.blocks);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const setSelection = useDocumentStore((s) => s.setSelection);

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabType>('markdown');
  const [copied, setCopied] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  if (!block) return null;

  const props = (block.properties ?? {}) as {
    status?: BlockStatus;
    markdownContent?: string;
    jsonContent?: object | null;
    rawContent?: string;
    sourceName?: string;
    sourceType?: 'prompt' | 'code' | 'agent';
    connected?: boolean;
  };

  const name = block.name ?? '';
  const status: BlockStatus = props.status ?? 'idle';
  const markdownContent = props.markdownContent ?? '';
  const jsonContent = props.jsonContent ?? null;
  const rawContent = props.rawContent ?? '';
  const sourceName = props.sourceName ?? '';
  const sourceType = props.sourceType ?? 'prompt';
  const connected = props.connected ?? false;

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

  /**
   * Live dataflow: when a connected upstream block emits new output, update
   * this Result block's display immediately. Sets `connected = true` and
   * updates the markdown/raw content based on the payload shape.
   */
  useEvent('arrow:data-flow', (payload) => {
    if (payload.targetId !== blockId) return;
    const sourceBlock = useDocumentStore.getState().blocks[payload.sourceId];
    const sourceBlockType = sourceBlock?.type ?? 'prompt';
    const allowedSourceTypes = ['prompt', 'code', 'agent'] as const;
    const nextSourceType = (allowedSourceTypes as readonly string[]).includes(
      sourceBlockType,
    )
      ? (sourceBlockType as 'prompt' | 'code' | 'agent')
      : 'prompt';
    const text =
      typeof payload.data === 'string'
        ? payload.data
        : payload.data == null
          ? ''
          : JSON.stringify(payload.data, null, 2);
    let nextJson: object | null = null;
    if (typeof payload.data === 'object' && payload.data !== null) {
      nextJson = payload.data as object;
    }
    patchProps({
      connected: true,
      sourceName: sourceBlock?.name ?? sourceName,
      sourceType: nextSourceType,
      markdownContent: text,
      rawContent: text,
      jsonContent: nextJson,
      status: 'success',
    });
  });

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    let contentToCopy = '';
    if (activeTab === 'markdown') contentToCopy = markdownContent;
    else if (activeTab === 'json')
      contentToCopy = jsonContent ? JSON.stringify(jsonContent, null, 2) : '';
    else contentToCopy = rawContent;
    if (!contentToCopy) {
      toast.error('Nothing to copy');
      return;
    }
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ext = activeTab === 'json' ? 'json' : activeTab === 'markdown' ? 'md' : 'txt';
    const content =
      activeTab === 'markdown'
        ? markdownContent
        : activeTab === 'json'
          ? JSON.stringify(jsonContent ?? {}, null, 2)
          : rawContent;
    if (!content) {
      toast.error('Nothing to export');
      return;
    }
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'result'}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const portOpacity = hovered || selected ? 1 : 0;

  const TabButton = ({ tab, label }: { tab: TabType; label: string }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setActiveTab(tab);
      }}
      className={cn(
        'nodrag font-medium transition-colors text-[10px] px-1.5 py-0.5 rounded',
        activeTab === tab
          ? 'text-foreground bg-foreground/[0.08]'
          : 'text-muted-foreground hover:text-muted-foreground',
      )}
    >
      {label}
    </button>
  );

  const renderContent = () => {
    if (!connected) {
      return (
        <div className="flex flex-col items-center justify-center py-4 gap-1.5">
          <div className="w-8 h-8 rounded-full bg-foreground/[0.04] flex items-center justify-center">
            <ArrowUpRight size={14} className="text-muted-foreground" />
          </div>
          <p className="text-[11px] text-muted-foreground">No output yet</p>
          <p className="text-[10px] text-muted-foreground">Connect a source block</p>
        </div>
      );
    }

    if (activeTab === 'markdown') {
      return markdownContent ? (
        <div className="text-[11px] text-foreground whitespace-pre-wrap leading-relaxed max-h-[120px] overflow-hidden">
          {markdownContent.length > 200
            ? markdownContent.slice(0, 200) + '…'
            : markdownContent}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic">Waiting for output…</p>
      );
    }

    if (activeTab === 'json') {
      return jsonContent ? (
        <div className="max-h-[140px] overflow-auto">
          <JsonTreeNode data={jsonContent} />
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground italic">No JSON data</p>
      );
    }

    return (
      <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-[120px] overflow-auto">
        {rawContent || (
          <span className="text-muted-foreground italic">No raw output</span>
        )}
      </pre>
    );
  };

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={selectThis}
        className="group relative rounded-lg p-2.5 bg-[var(--recess)] backdrop-blur-md transition-feedback"
        style={{
          width: 280,
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
            Result
          </span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
            className="flex-1 min-w-0 bg-transparent text-[10px] font-medium text-foreground placeholder:text-muted-foreground outline-none nodrag"
          />
          <StatusDot status={status} />
          <button
            type="button"
            className="p-0.5 text-muted-foreground hover:text-muted-foreground nodrag"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-2 nodrag" onClick={(e) => e.stopPropagation()}>
          <TabButton tab="markdown" label="MD" />
          <TabButton tab="json" label="JSON" />
          <TabButton tab="raw" label="RAW" />
        </div>

        {/* Body */}
        <div
          className="rounded-md mb-2 nodrag p-2"
          style={{
            background: 'var(--recess)',
            border: '1px solid var(--line)',
            minHeight: 80,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9.5px] text-muted-foreground truncate flex-1">
            {connected && sourceName
              ? `Source: ${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)} '${sourceName}'`
              : 'No source connected'}
          </span>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="nodrag p-1 text-muted-foreground hover:text-muted-foreground rounded transition-colors"
              title="Copy"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="nodrag p-1 text-muted-foreground hover:text-muted-foreground rounded transition-colors"
              title="Export"
            >
              <Download size={11} />
            </button>
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
              <ArrowUpRight size={11} />
            </button>
          </div>
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
            <SheetTitle className="text-foreground text-base">Result block</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Block name"
              className="w-full px-3 py-2 rounded-md bg-foreground/[0.03] border border-border/[0.06] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-border/[0.12] transition-colors"
            />

            <div className="flex items-center gap-1">
              <TabButton tab="markdown" label="Markdown" />
              <TabButton tab="json" label="JSON" />
              <TabButton tab="raw" label="Raw" />
            </div>

            <div
              className="rounded-md p-3 max-h-[400px] overflow-auto"
              style={{
                background: 'var(--recess)',
                border: '1px solid var(--line)',
                minHeight: 200,
              }}
            >
              {activeTab === 'markdown' && (
                <textarea
                  value={markdownContent}
                  onChange={(e) => patchProps({ markdownContent: e.target.value })}
                  placeholder="Markdown output…"
                  className="w-full min-h-[180px] bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground resize-none"
                />
              )}
              {activeTab === 'json' && (
                <textarea
                  value={jsonContent ? JSON.stringify(jsonContent, null, 2) : ''}
                  onChange={(e) => {
                    try {
                      patchProps({ jsonContent: JSON.parse(e.target.value) });
                    } catch {
                      // ignore parse errors during typing
                    }
                  }}
                  placeholder='{"key": "value"}'
                  className="w-full min-h-[180px] bg-transparent outline-none text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none"
                />
              )}
              {activeTab === 'raw' && (
                <textarea
                  value={rawContent}
                  onChange={(e) => patchProps({ rawContent: e.target.value })}
                  placeholder="Raw output…"
                  className="w-full min-h-[180px] bg-transparent outline-none text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                value={sourceName}
                onChange={(e) => patchProps({ sourceName: e.target.value })}
                placeholder="Source name"
                className="px-3 py-2 rounded-md bg-foreground/[0.03] border border-border/[0.06] text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border/[0.12]"
              />
              <select
                value={sourceType}
                onChange={(e) =>
                  patchProps({
                    sourceType: e.target.value as 'prompt' | 'code' | 'agent',
                  })
                }
                className="px-3 py-2 rounded-md bg-foreground/[0.03] border border-border/[0.06] text-xs text-foreground outline-none focus:border-border/[0.12]"
              >
                <option value="prompt" className="bg-[var(--recess)]">Prompt</option>
                <option value="code" className="bg-[var(--recess)]">Code</option>
                <option value="agent" className="bg-[var(--recess)]">Agent</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={connected}
                onChange={(e) => patchProps({ connected: e.target.checked })}
              />
              Connected to source
            </label>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

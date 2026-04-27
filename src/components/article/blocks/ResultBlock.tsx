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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type BlockStatus = 'idle' | 'running' | 'success' | 'error';
type TabType = 'markdown' | 'json' | 'raw';

interface ResultBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const TYPE_COLOR = '#A855F7';

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

function StatusDot({ status }: { status: BlockStatus }) {
  if (status === 'running')
    return <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />;
  if (status === 'success')
    return (
      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 text-white">
        <Check size={8} strokeWidth={3} />
      </span>
    );
  if (status === 'error')
    return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-white/25" />;
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
        <span className="text-[#93C5FD]">{`"${keyName}"`}</span>
        <span className="text-white/40">: </span>
      </>
    ) : null;

  if (data === null) {
    return (
      <div className="flex items-start gap-1 text-[11px] font-mono">
        {renderKey()}
        <span className="text-white/40">null</span>
        {!isLast && <span className="text-white/40">,</span>}
      </div>
    );
  }

  if (typeof data === 'boolean') {
    return (
      <div className="flex items-start gap-1 text-[11px] font-mono">
        {renderKey()}
        <span className="text-[#F472B6]">{data.toString()}</span>
        {!isLast && <span className="text-white/40">,</span>}
      </div>
    );
  }

  if (typeof data === 'number') {
    return (
      <div className="flex items-start gap-1 text-[11px] font-mono">
        {renderKey()}
        <span className="text-[#FCD34D]">{data}</span>
        {!isLast && <span className="text-white/40">,</span>}
      </div>
    );
  }

  if (typeof data === 'string') {
    return (
      <div className="flex items-start gap-1 text-[11px] font-mono">
        {renderKey()}
        <span className="text-[#86EFAC]">{`"${data}"`}</span>
        {!isLast && <span className="text-white/40">,</span>}
      </div>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div className="flex items-start gap-1 text-[11px] font-mono">
          {renderKey()}
          <span className="text-white/60">[]</span>
          {!isLast && <span className="text-white/40">,</span>}
        </div>
      );
    }
    return (
      <div className="text-[11px] font-mono">
        <button
          type="button"
          className="flex items-start gap-1 hover:bg-white/[0.04] rounded px-0.5"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          {isOpen ? (
            <ChevronDown size={10} className="mt-0.5 text-white/50" />
          ) : (
            <ChevronRight size={10} className="mt-0.5 text-white/50" />
          )}
          {renderKey()}
          <span className="text-white/60">[</span>
          {!isOpen && (
            <>
              <span className="text-white/40 ml-1">{data.length} items</span>
              <span className="text-white/60 ml-1">]</span>
              {!isLast && <span className="text-white/40">,</span>}
            </>
          )}
        </button>
        {isOpen && (
          <>
            <div className="ml-3 border-l border-white/10 pl-2">
              {data.map((item, index) => (
                <JsonTreeNode
                  key={index}
                  data={item}
                  isLast={index === data.length - 1}
                  depth={depth + 1}
                />
              ))}
            </div>
            <div className="text-white/60">
              ]{!isLast && <span className="text-white/40">,</span>}
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
          <span className="text-white/60">{'{}'}</span>
          {!isLast && <span className="text-white/40">,</span>}
        </div>
      );
    }
    return (
      <div className="text-[11px] font-mono">
        <button
          type="button"
          className="flex items-start gap-1 hover:bg-white/[0.04] rounded px-0.5"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          {isOpen ? (
            <ChevronDown size={10} className="mt-0.5 text-white/50" />
          ) : (
            <ChevronRight size={10} className="mt-0.5 text-white/50" />
          )}
          {renderKey()}
          <span className="text-white/60">{'{'}</span>
          {!isOpen && (
            <>
              <span className="text-white/40 ml-1">{entries.length} keys</span>
              <span className="text-white/60 ml-1">{'}'}</span>
              {!isLast && <span className="text-white/40">,</span>}
            </>
          )}
        </button>
        {isOpen && (
          <>
            <div className="ml-3 border-l border-white/10 pl-2">
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
            <div className="text-white/60">
              {'}'}
              {!isLast && <span className="text-white/40">,</span>}
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
          ? 'text-white bg-white/[0.08]'
          : 'text-white/40 hover:text-white/60',
      )}
    >
      {label}
    </button>
  );

  const renderContent = () => {
    if (!connected) {
      return (
        <div className="flex flex-col items-center justify-center py-4 gap-1.5">
          <div className="w-8 h-8 rounded-full bg-white/[0.04] flex items-center justify-center">
            <ArrowUpRight size={14} className="text-white/30" />
          </div>
          <p className="text-[11px] text-white/50">No output yet</p>
          <p className="text-[10px] text-white/30">Connect a source block</p>
        </div>
      );
    }

    if (activeTab === 'markdown') {
      return markdownContent ? (
        <div className="text-[11px] text-white/75 whitespace-pre-wrap leading-relaxed max-h-[120px] overflow-hidden">
          {markdownContent.length > 200
            ? markdownContent.slice(0, 200) + '…'
            : markdownContent}
        </div>
      ) : (
        <p className="text-[10px] text-white/30 italic">Waiting for output…</p>
      );
    }

    if (activeTab === 'json') {
      return jsonContent ? (
        <div className="max-h-[140px] overflow-auto">
          <JsonTreeNode data={jsonContent} />
        </div>
      ) : (
        <p className="text-[10px] text-white/30 italic">No JSON data</p>
      );
    }

    return (
      <pre className="text-[10px] font-mono text-white/70 whitespace-pre-wrap break-all max-h-[120px] overflow-auto">
        {rawContent || (
          <span className="text-white/30 italic">No raw output</span>
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
        className="group relative rounded-lg p-2.5 bg-[rgba(20,20,28,0.85)] backdrop-blur-md transition-all"
        style={{
          width: 280,
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
            Result
          </span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
            className="flex-1 min-w-0 bg-transparent text-[10px] font-medium text-white/70 placeholder:text-white/30 outline-none nodrag"
          />
          <StatusDot status={status} />
          <button
            type="button"
            className="p-0.5 text-white/40 hover:text-white/80 nodrag"
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
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.05)',
            minHeight: 80,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {renderContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9.5px] text-white/40 truncate flex-1">
            {connected && sourceName
              ? `Source: ${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)} '${sourceName}'`
              : 'No source connected'}
          </span>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="nodrag p-1 text-white/45 hover:text-white/85 rounded transition-colors"
              title="Copy"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="nodrag p-1 text-white/45 hover:text-white/85 rounded transition-colors"
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
              className="nodrag p-1 text-white/45 hover:text-white/85 rounded transition-colors"
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
          className="w-[560px] sm:max-w-[560px] bg-[rgba(15,15,20,0.98)] border-white/10 text-white overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-white/90 text-base">Result block</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Block name"
              className="w-full px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder:text-white/30 outline-none focus:border-white/[0.12] transition-colors"
            />

            <div className="flex items-center gap-1">
              <TabButton tab="markdown" label="Markdown" />
              <TabButton tab="json" label="JSON" />
              <TabButton tab="raw" label="Raw" />
            </div>

            <div
              className="rounded-md p-3 max-h-[400px] overflow-auto"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.06)',
                minHeight: 200,
              }}
            >
              {activeTab === 'markdown' && (
                <textarea
                  value={markdownContent}
                  onChange={(e) => patchProps({ markdownContent: e.target.value })}
                  placeholder="Markdown output…"
                  className="w-full min-h-[180px] bg-transparent outline-none text-sm text-white/80 placeholder:text-white/30 resize-none"
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
                  className="w-full min-h-[180px] bg-transparent outline-none text-xs font-mono text-white/80 placeholder:text-white/30 resize-none"
                />
              )}
              {activeTab === 'raw' && (
                <textarea
                  value={rawContent}
                  onChange={(e) => patchProps({ rawContent: e.target.value })}
                  placeholder="Raw output…"
                  className="w-full min-h-[180px] bg-transparent outline-none text-xs font-mono text-white/80 placeholder:text-white/30 resize-none"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                value={sourceName}
                onChange={(e) => patchProps({ sourceName: e.target.value })}
                placeholder="Source name"
                className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-white/80 placeholder:text-white/30 outline-none focus:border-white/[0.12]"
              />
              <select
                value={sourceType}
                onChange={(e) =>
                  patchProps({
                    sourceType: e.target.value as 'prompt' | 'code' | 'agent',
                  })
                }
                className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-white/80 outline-none focus:border-white/[0.12]"
              >
                <option value="prompt" className="bg-[#16161e]">Prompt</option>
                <option value="code" className="bg-[#16161e]">Code</option>
                <option value="agent" className="bg-[#16161e]">Agent</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-white/70">
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

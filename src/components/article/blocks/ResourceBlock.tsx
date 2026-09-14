import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MoreHorizontal, Link2, ExternalLink, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';

interface ResourceBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const TYPE_COLOR = 'var(--cat-data)';

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: 'var(--evidence)',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

export function ResourceBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as ResourceBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const updateBlock = useDocumentStore((s) => s.updateBlock);

  const [hovered, setHovered] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  if (!block) return null;

  const props = (block.properties ?? {}) as {
    url?: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    favicon?: string;
    annotation?: string;
  };

  const url = props.url ?? '';
  const title = props.title ?? '';
  const description = props.description ?? '';
  const thumbnail = props.thumbnail ?? '';
  const favicon = props.favicon ?? '';
  const annotation = props.annotation ?? '';

  const hasMeta = Boolean(title || description || thumbnail);

  const patchProps = (patch: Record<string, unknown>) => {
    updateBlock(blockId, {
      properties: { ...(block.properties ?? {}), ...patch },
    });
  };

  // Best-effort metadata fetch using a public CORS-friendly endpoint.
  // Falls back to deriving favicon + title from URL hostname.
  const handleFetch = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const u = new URL(url);
      const host = u.hostname;
      const fallbackFavicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;

      // Try a free metadata service. If it fails, we still set hostname-based fallbacks.
      try {
        const res = await fetch(
          `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
        );
        if (res.ok) {
          const json = await res.json();
          const d = json?.data ?? {};
          patchProps({
            title: d.title ?? host,
            description: d.description ?? '',
            thumbnail: d.image?.url ?? '',
            favicon: d.logo?.url ?? fallbackFavicon,
          });
          return;
        }
      } catch {
        // ignore — fall through to fallback
      }

      patchProps({
        title: title || host,
        favicon: favicon || fallbackFavicon,
      });
    } catch {
      // invalid URL — leave fields untouched
    } finally {
      setLoading(false);
    }
  };

  const portOpacity = hovered || selected ? 1 : 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative rounded-lg p-2.5 bg-[rgba(20,20,28,0.85)] backdrop-blur-md transition-all"
      style={{
        width: 280,
        border: selected
          ? `1px solid ${TYPE_COLOR}99`
          : '1px solid var(--line)',
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
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Resource
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="p-0.5 text-muted-foreground hover:text-muted-foreground nodrag"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={12} />
        </button>
      </div>

      {/* URL Input */}
      <div
        className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-foreground/[0.03] border border-border/[0.06] nodrag"
        onClick={(e) => e.stopPropagation()}
      >
        <Link2 size={11} className="text-muted-foreground flex-shrink-0" />
        <input
          value={url}
          onChange={(e) => patchProps({ url: e.target.value })}
          placeholder="Paste URL..."
          className="flex-1 min-w-0 bg-transparent outline-none text-xs text-muted-foreground placeholder:text-muted-foreground"
          onBlur={() => url && handleFetch()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && url) {
              e.preventDefault();
              handleFetch();
            }
          }}
        />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-muted-foreground transition-colors flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Open in new tab"
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* OG Preview */}
      <div
        className="rounded-md overflow-hidden mb-2 nodrag"
        style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid var(--line)',
          minHeight: 80,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 size={14} className="text-muted-foreground animate-spin" />
          </div>
        ) : hasMeta ? (
          <>
            {thumbnail && (
              <div className="w-full h-24 overflow-hidden bg-black/30">
                <img
                  src={thumbnail}
                  alt={title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex gap-1.5 p-2">
              {favicon && (
                <img
                  src={favicon}
                  alt=""
                  className="w-3.5 h-3.5 rounded-sm flex-shrink-0 mt-0.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                {title && (
                  <div className="text-[11px] font-medium text-muted-foreground line-clamp-2 leading-tight">
                    {title}
                  </div>
                )}
                {description && (
                  <div className="text-[10px] text-muted-foreground line-clamp-2 leading-tight mt-0.5">
                    {description}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-20">
            <p className="text-[10px] text-muted-foreground">
              Enter a URL to fetch preview
            </p>
          </div>
        )}
      </div>

      {/* Annotation Field */}
      <textarea
        value={annotation}
        onChange={(e) => patchProps({ annotation: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        placeholder="Add notes..."
        className={cn(
          'nodrag w-full h-12 p-2 rounded-md resize-none',
          'bg-foreground/[0.02] border border-border/[0.04]',
          'text-[11px] text-muted-foreground placeholder:text-muted-foreground',
          'outline-none focus:border-border/[0.08] transition-colors',
        )}
      />
    </div>
  );
}

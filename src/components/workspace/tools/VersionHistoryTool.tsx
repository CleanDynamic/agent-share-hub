import { useMemo, useState } from 'react';
import { Clock3, Eye, Undo2 } from 'lucide-react';

type VersionScope = 'block' | 'document';

interface VersionEntry {
  id: string;
  author: string;
  timestamp: string;
  summary: string;
  group: string;
}

interface VersionHistoryToolProps {
  scope?: VersionScope;
  versions?: VersionEntry[];
  activeVersionId?: string | null;
  previewingId?: string | null;
  onScopeChange?: (scope: VersionScope) => void;
  onVersionClick?: (id: string) => void;
  onPreview?: (id: string) => void;
  onRestore?: (id: string) => void;
  onClosePreview?: () => void;
}

const DEFAULT_VERSIONS: VersionEntry[] = [
  {
    id: 'version-1',
    author: 'Maya Chen',
    timestamp: '12m ago',
    summary: 'Changed prompt text · 3 lines',
    group: 'Today',
  },
  {
    id: 'version-2',
    author: 'Ravi Patel',
    timestamp: '1h ago',
    summary: 'Updated stage framing · 1 note',
    group: 'Today',
  },
  {
    id: 'version-3',
    author: 'Noah Kim',
    timestamp: 'Yesterday',
    summary: 'Refined results summary · 2 lines',
    group: 'Yesterday',
  },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'hsl(var(--foreground) / 0.08)',
        color: 'hsl(var(--foreground) / 0.72)',
        fontSize: 8,
        fontWeight: 600,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export function VersionHistoryTool({
  scope,
  versions = DEFAULT_VERSIONS,
  activeVersionId,
  previewingId,
  onScopeChange,
  onVersionClick,
  onPreview,
  onRestore,
  onClosePreview,
}: VersionHistoryToolProps) {
  const [internalScope, setInternalScope] = useState<VersionScope>(scope ?? 'document');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeScope = scope ?? internalScope;
  const selectedVersionId = activeVersionId ?? versions[0]?.id ?? null;
  const activePreviewId = previewingId ?? null;

  const groupedVersions = useMemo(() => {
    const groups = new Map<string, VersionEntry[]>();
    versions.forEach((version) => {
      const items = groups.get(version.group) ?? [];
      items.push(version);
      groups.set(version.group, items);
    });
    return Array.from(groups.entries());
  }, [versions]);

  const handleScopeChange = (nextScope: VersionScope) => {
    if (!scope) setInternalScope(nextScope);
    onScopeChange?.(nextScope);
  };

  const previewLabel = activePreviewId
    ? versions.find((version) => version.id === activePreviewId)?.timestamp ?? 'selected version'
    : null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'transparent',
      }}
    >
      <div
        style={{
          height: 36,
          minHeight: 36,
          borderBottom: '0.5px solid hsl(var(--foreground) / 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '0 10px',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'hsl(var(--foreground) / 0.85)',
          }}
        >
          Versions
        </span>

        <div
          style={{
            height: 24,
            display: 'flex',
            alignItems: 'center',
            padding: 2,
            borderRadius: 999,
            backgroundColor: 'hsl(var(--foreground) / 0.04)',
            border: '0.5px solid hsl(var(--foreground) / 0.08)',
          }}
        >
          {([
            ['block', 'This block'],
            ['document', 'This document'],
          ] as const).map(([value, label]) => {
            const active = activeScope === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => handleScopeChange(value)}
                style={{
                  height: 20,
                  border: 'none',
                  borderRadius: 999,
                  padding: '0 8px',
                  backgroundColor: active ? 'hsl(var(--foreground) / 0.08)' : 'transparent',
                  color: active ? 'hsl(var(--foreground) / 0.92)' : 'hsl(var(--foreground) / 0.45)',
                  fontSize: 10,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '0 8px 8px',
        }}
      >
        {versions.length === 0 ? (
          <div
            style={{
              height: '100%',
              minHeight: 220,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '0 20px',
              textAlign: 'center',
            }}
          >
            <Clock3 size={64} style={{ color: 'hsl(var(--foreground) / 0.25)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'hsl(var(--foreground) / 0.6)' }}>
                No changes yet
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.4)', lineHeight: 1.45 }}>
                Your edits will be saved automatically as versions.
              </div>
            </div>
          </div>
        ) : (
          groupedVersions.map(([group, items], groupIndex) => (
            <div key={group} style={{ marginTop: groupIndex === 0 ? 0 : 10 }}>
              <div
                style={{
                  margin: groupIndex === 0 ? '8px 2px 6px' : '0 2px 6px',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'hsl(var(--foreground) / 0.3)',
                }}
              >
                {group}
              </div>

              {items.map((version) => {
                const active = selectedVersionId === version.id;
                const showActions = hoveredId === version.id;

                return (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => onVersionClick?.(version.id)}
                    onMouseEnter={() => setHoveredId(version.id)}
                    onMouseLeave={() => setHoveredId((current) => (current === version.id ? null : current))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: 'none',
                      borderLeft: active
                        ? '2px solid hsl(var(--secondary))'
                        : '2px solid transparent',
                      backgroundColor: active
                        ? 'hsl(var(--secondary) / 0.06)'
                        : 'transparent',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <Avatar name={version.author} />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: 'hsl(var(--foreground) / 0.9)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {version.author}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 400,
                            color: 'hsl(var(--foreground) / 0.35)',
                            flexShrink: 0,
                          }}
                        >
                          {version.timestamp}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 400,
                          color: 'hsl(var(--foreground) / 0.55)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {version.summary}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: showActions ? 1 : 0,
                        transition: 'opacity 120ms ease',
                      }}
                    >
                      <button
                        type="button"
                        aria-label="Preview version"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPreview?.(version.id);
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          border: 'none',
                          borderRadius: 4,
                          backgroundColor: 'transparent',
                          color: 'hsl(var(--foreground) / 0.45)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label="Restore version"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRestore?.(version.id);
                        }}
                        style={{
                          width: 20,
                          height: 20,
                          border: 'none',
                          borderRadius: 4,
                          backgroundColor: 'transparent',
                          color: 'hsl(var(--foreground) / 0.45)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Undo2 size={14} />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {activePreviewId ? (
        <div
          style={{
            height: 48,
            minHeight: 48,
            borderTop: '0.5px solid hsl(var(--foreground) / 0.08)',
            backgroundColor: 'hsl(38 92% 50% / 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '0 10px',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 500, color: 'hsl(38 92% 50%)' }}>
            Viewing version from {previewLabel}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => onRestore?.(activePreviewId)}
              style={{
                height: 28,
                border: 'none',
                borderRadius: 6,
                padding: '0 10px',
                backgroundColor: 'hsl(var(--secondary))',
                color: 'hsl(var(--secondary-foreground))',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Restore
            </button>
            <button
              type="button"
              onClick={onClosePreview}
              style={{
                height: 28,
                border: 'none',
                borderRadius: 6,
                padding: '0 8px',
                backgroundColor: 'transparent',
                color: 'hsl(var(--foreground) / 0.55)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

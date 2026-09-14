/**
 * ArrowInspector — sidebar panel shown when a connection (arrow) is
 * selected on the canvas. Lets the user retype the connection
 * (`connection_type`), toggle whether it carries data, edit its label, and
 * pick a custom colour for `custom`-type connections.
 */

import * as React from 'react';
import { useDocumentStore } from '@/lib/documentStore';
import type { ConnectionType } from '@/types/document';
import { cn } from '@/lib/utils';

interface ArrowInspectorProps {
  connectionId: string;
}

const TYPES: Array<{
  value: ConnectionType;
  label: string;
  swatch: string;
  description: string;
}> = [
  {
    value: 'feeds_into',
    label: 'Feeds into',
    swatch: 'var(--evidence)',
    description: 'Default — carries data downstream.',
  },
  {
    value: 'alternative_to',
    label: 'Alternative to',
    swatch: 'var(--recess)',
    description: 'Sibling option, no data flow.',
  },
  {
    value: 'depends_on',
    label: 'Depends on',
    swatch: 'var(--action)',
    description: 'Requires upstream block to run first.',
  },
  {
    value: 'contradicts',
    label: 'Contradicts',
    swatch: 'var(--cat-breakage)',
    description: 'Marks an opposing block.',
  },
  {
    value: 'references',
    label: 'References',
    swatch: 'var(--recess)',
    description: 'Lightweight pointer.',
  },
  {
    value: 'custom',
    label: 'Custom',
    swatch: 'var(--text)',
    description: 'Use your own colour.',
  },
];

export function ArrowInspector({ connectionId }: ArrowInspectorProps) {
  const conn = useDocumentStore((s) => s.connections[connectionId]);
  const updateConnection = useDocumentStore((s) => s.updateConnection);
  const removeConnection = useDocumentStore((s) => s.removeConnection);
  const clearSelection = useDocumentStore((s) => s.clearSelection);

  if (!conn) {
    return (
      <div className="p-4 text-[11px] text-muted-foreground">
        Arrow no longer exists.
      </div>
    );
  }

  const customColor =
    (conn as unknown as { custom_color?: string }).custom_color ?? 'var(--text)';

  return (
    <div className="p-4 space-y-5 text-muted-foreground">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Arrow
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Configure how blocks relate.
        </p>
      </div>

      {/* Type picker */}
      <div>
        <label className="block text-[11px] font-medium text-muted-foreground mb-2">
          Type
        </label>
        <div className="space-y-1">
          {TYPES.map((t) => {
            const active = conn.connection_type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() =>
                  updateConnection(connectionId, {
                    connection_type: t.value,
                    // Sensible default: only `feeds_into` carries data unless
                    // the user explicitly opts in.
                    carries_data:
                      t.value === 'feeds_into' ? true : conn.carries_data,
                  })
                }
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors',
                  active
                    ? 'bg-foreground/[0.08] border border-border/[0.15]'
                    : 'border border-transparent hover:bg-foreground/[0.04]',
                )}
              >
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: t.swatch }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-muted-foreground">
                    {t.label}
                  </span>
                  <span className="block text-[10.5px] text-muted-foreground truncate">
                    {t.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom colour */}
      {conn.connection_type === 'custom' && (
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
            Custom colour
          </label>
          <input
            type="color"
            value={customColor}
            onChange={(e) =>
              updateConnection(connectionId, {
                // Stored as a non-schema field; DataFlowEdge reads it via cast.
                custom_color: e.target.value,
              } as never)
            }
            className="h-8 w-full rounded-md bg-foreground/[0.03] border border-border/[0.08] cursor-pointer"
          />
        </div>
      )}

      {/* Label */}
      <div>
        <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
          Label
        </label>
        <input
          value={conn.label ?? ''}
          onChange={(e) =>
            updateConnection(connectionId, {
              label: e.target.value || null,
            })
          }
          placeholder="Optional label"
          className="w-full px-3 py-2 rounded-md bg-foreground/[0.03] border border-border/[0.06] text-xs text-muted-foreground placeholder:text-muted-foreground outline-none focus:border-border/[0.12] transition-colors"
        />
      </div>

      {/* Carries data toggle */}
      <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-foreground/[0.03] border border-border/[0.06] cursor-pointer">
        <span>
          <span className="block text-xs font-medium text-muted-foreground">
            Carries data
          </span>
          <span className="block text-[10.5px] text-muted-foreground">
            Source output flows to target on run.
          </span>
        </span>
        <input
          type="checkbox"
          checked={conn.carries_data}
          onChange={(e) =>
            updateConnection(connectionId, { carries_data: e.target.checked })
          }
          className="h-4 w-4 cursor-pointer accent-[var(--action)]"
        />
      </label>

      {/* Delete */}
      <button
        type="button"
        onClick={() => {
          removeConnection(connectionId);
          clearSelection();
        }}
        className="w-full px-3 py-2 rounded-md text-xs font-medium text-[var(--cat-breakage)] hover:text-[var(--cat-breakage)] bg-[var(--cat-breakage)]/[0.08] hover:bg-[var(--cat-breakage)]/[0.14] border border-[var(--cat-breakage)]/[0.18] transition-colors"
      >
        Delete arrow
      </button>
    </div>
  );
}

export default ArrowInspector;

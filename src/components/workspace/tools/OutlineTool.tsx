import { useMemo } from 'react';

import { useDocumentStore } from '@/lib/documentStore';

type OutlineEntry = {
  id: string;
  kind: 'heading' | 'stage' | 'block';
  level: number;
  label: string;
  color?: string;
  blockCount?: number;
  isActive?: boolean;
};

interface OutlineToolProps {
  entries?: OutlineEntry[];
  onEntryClick?: (id: string) => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function countWordsInTipTap(node: unknown): number {
  if (!isObject(node)) return 0;
  let count = 0;
  if (node.type === 'text' && typeof node.text === 'string') {
    const trimmed = node.text.trim();
    if (trimmed) count += trimmed.split(/\s+/).length;
  }
  if (Array.isArray(node.content)) {
    node.content.forEach((child) => {
      count += countWordsInTipTap(child);
    });
  }
  return count;
}

function extractText(node: unknown): string {
  if (!isObject(node)) return '';
  if (node.type === 'text' && typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(extractText).join('');
}

function fallbackBlockLabel(type: string): string {
  return `Untitled ${type}`;
}

function buildEntries(
  articleBody: unknown,
  stages: ReturnType<typeof useDocumentStore.getState>['stages'],
  blocks: ReturnType<typeof useDocumentStore.getState>['blocks'],
  activeId: string | null,
): OutlineEntry[] {
  const output: OutlineEntry[] = [];

  if (isObject(articleBody) && Array.isArray(articleBody.content)) {
    articleBody.content.forEach((node, index) => {
      if (!isObject(node) || node.type !== 'heading') return;
      const level = typeof node.attrs === 'object' && node.attrs && typeof (node.attrs as Record<string, unknown>).level === 'number'
        ? Number((node.attrs as Record<string, unknown>).level)
        : 1;
      const label = extractText(node).trim() || `Heading ${index + 1}`;
      output.push({
        id: `heading-${index}`,
        kind: 'heading',
        level,
        label,
        isActive: activeId === `heading-${index}`,
      });
    });
  }

  const orderedStages = Object.values(stages).sort((a, b) => a.order_in_document - b.order_in_document);
  orderedStages.forEach((stage, index) => {
    const stageBlocks = Object.values(blocks)
      .filter((block) => block.stage_id === stage.id)
      .sort((a, b) => a.z_index - b.z_index);

    output.push({
      id: stage.id,
      kind: 'stage',
      level: 0,
      label: stage.stage_name?.trim() || `Untitled stage ${index + 1}`,
      blockCount: stageBlocks.length,
      isActive: activeId === stage.id,
    });

    stageBlocks.forEach((block) => {
      const blockColor =
        block.type === 'prompt'
          ? 'hsl(var(--secondary))'
          : block.type === 'code'
            ? 'hsl(142 71% 45%)'
            : block.type === 'result' || block.type === 'agent'
              ? 'hsl(262 83% 58%)'
              : block.type === 'tool' || block.type === 'workflow'
                ? 'hsl(217 91% 60%)'
                : block.type === 'model'
                  ? 'hsl(263 89% 78%)'
                  : block.type === 'compare'
                    ? 'hsl(330 81% 60%)'
                    : block.type === 'tutorial'
                      ? 'hsl(var(--primary))'
                      : block.type === 'resource'
                        ? 'hsl(190 95% 39%)'
                        : block.type === 'note'
                          ? 'hsl(38 92% 50%)'
                          : 'hsl(var(--foreground) / 0.6)';

      output.push({
        id: block.id,
        kind: 'block',
        level: 1,
        label: block.name?.trim() || fallbackBlockLabel(block.type),
        color: blockColor,
        isActive: activeId === block.id,
      });
    });
  });

  return output;
}

export function OutlineTool({
  entries,
  onEntryClick,
  onExpandAll,
  onCollapseAll,
}: OutlineToolProps) {
  const articleBody = useDocumentStore((s) => s.articleBody);
  const stages = useDocumentStore((s) => s.stages);
  const blocks = useDocumentStore((s) => s.blocks);
  const selection = useDocumentStore((s) => s.selection);

  const activeId = selection.ids.length === 1 ? selection.ids[0] : null;

  const derivedEntries = useMemo(
    () => buildEntries(articleBody, stages, blocks, activeId),
    [activeId, articleBody, blocks, stages],
  );

  const resolvedEntries = entries ?? derivedEntries;
  const wordCount = useMemo(() => countWordsInTipTap(articleBody), [articleBody]);
  const minToRead = Math.max(1, Math.ceil(wordCount / 220));
  const stageCount = Object.keys(stages).length;
  const blockCount = Object.keys(blocks).length;

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
          height: 28,
          minHeight: 28,
          display: 'flex',
          alignItems: 'center',
          padding: '6px 12px',
          borderBottom: '0.5px solid hsl(var(--foreground) / 0.08)',
          fontSize: 10,
          fontWeight: 500,
          color: 'hsl(var(--foreground) / 0.4)',
        }}
      >
        {wordCount} words · {minToRead} min read
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '8px 8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {resolvedEntries.map((entry, index) => {
          const isStage = entry.kind === 'stage';
          const isHeading = entry.kind === 'heading';
          const isActive = Boolean(entry.isActive);
          const headingLevel = Math.min(Math.max(entry.level || 1, 1), 3);
          const indent = isHeading ? (headingLevel - 1) * 12 : entry.kind === 'block' ? 16 : 0;

          return (
            <button
              key={`${entry.id}-${index}`}
              type="button"
              onClick={() => onEntryClick?.(entry.id)}
              style={{
                height: 28,
                minHeight: 28,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: isStage ? '4px 8px' : '4px 10px',
                paddingLeft: isStage ? 8 : 10 + indent,
                borderRadius: isStage ? 6 : 4,
                border: isStage
                  ? '0.5px solid hsl(var(--primary) / 0.2)'
                  : 'none',
                borderLeft: isActive
                  ? '2px solid hsl(var(--secondary))'
                  : isStage
                    ? '0.5px solid hsl(var(--primary) / 0.2)'
                    : '2px solid transparent',
                backgroundColor: isStage
                  ? 'hsl(var(--primary) / 0.1)'
                  : 'transparent',
                color: isActive
                  ? 'hsl(var(--foreground) / 0.95)'
                  : 'hsl(var(--foreground) / 0.55)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
              }}
              onMouseEnter={(e) => {
                if (isStage) return;
                e.currentTarget.style.backgroundColor = 'hsl(var(--foreground) / 0.04)';
              }}
              onMouseLeave={(e) => {
                if (isStage) return;
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: isStage ? 6 : 8,
                  flex: 1,
                }}
              >
                {isHeading ? (
                  <span
                    style={{
                      width: 2,
                      height: 2,
                      borderRadius: 999,
                      backgroundColor: 'hsl(var(--foreground) / 0.4)',
                      flexShrink: 0,
                    }}
                  />
                ) : null}

                {entry.kind === 'block' ? (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: entry.color ?? 'hsl(var(--foreground) / 0.6)',
                      flexShrink: 0,
                    }}
                  />
                ) : null}

                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: isStage ? 12 : headingLevel === 1 ? 13 : headingLevel === 2 ? 12 : entry.kind === 'block' ? 10 : 11,
                    fontWeight: isStage ? 600 : headingLevel === 1 ? 600 : headingLevel === 2 ? 500 : entry.kind === 'block' ? 500 : 400,
                    color: isActive
                      ? 'hsl(var(--foreground) / 0.95)'
                      : entry.kind === 'block'
                        ? 'hsl(var(--foreground) / 0.6)'
                        : 'inherit',
                  }}
                >
                  {isStage ? `⊞ Stage ${resolvedEntries.filter((item) => item.kind === 'stage').findIndex((item) => item.id === entry.id) + 1} ${entry.label}` : entry.label}
                </span>
              </div>

              {isStage && typeof entry.blockCount === 'number' ? (
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 10,
                    fontWeight: 400,
                    color: 'hsl(var(--foreground) / 0.35)',
                  }}
                >
                  {entry.blockCount} blocks
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        style={{
          height: 28,
          minHeight: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 10px',
          borderTop: '0.5px solid hsl(var(--foreground) / 0.08)',
        }}
      >
        <span style={{ fontSize: 10, color: 'hsl(var(--foreground) / 0.35)' }}>
          {stageCount} stages · {blockCount} blocks
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={onExpandAll}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: 10,
              color: 'hsl(var(--foreground) / 0.45)',
              cursor: 'pointer',
            }}
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: 10,
              color: 'hsl(var(--foreground) / 0.45)',
              cursor: 'pointer',
            }}
          >
            Collapse all
          </button>
        </div>
      </div>
    </div>
  );
}

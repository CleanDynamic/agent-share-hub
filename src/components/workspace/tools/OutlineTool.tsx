import { useMemo } from 'react';

import { useDocumentStore } from '@/lib/documentStore';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readTitle(body: unknown): string {
  if (!isObject(body)) return 'Untitled document';
  return typeof body.title === 'string' && body.title.trim().length > 0
    ? body.title
    : 'Untitled document';
}

function readParagraphCount(body: unknown): number {
  if (!isObject(body) || !Array.isArray(body.content)) return 0;
  let count = 0;

  const walk = (node: unknown) => {
    if (!isObject(node)) return;
    if (typeof node.type === 'string' && ['paragraph', 'heading', 'bulletList', 'orderedList'].includes(node.type)) {
      count += 1;
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  };

  body.content.forEach(walk);
  return count;
}

export function OutlineTool() {
  const articleBody = useDocumentStore((s) => s.articleBody);
  const stages = useDocumentStore((s) => s.stages);
  const blocks = useDocumentStore((s) => s.blocks);

  const documentTitle = useMemo(() => readTitle(articleBody), [articleBody]);
  const paragraphCount = useMemo(() => readParagraphCount(articleBody), [articleBody]);

  const orderedStages = useMemo(
    () => Object.values(stages).sort((a, b) => a.order_in_document - b.order_in_document),
    [stages],
  );

  const stageRows = useMemo(
    () =>
      orderedStages.map((stage) => {
        const stageBlocks = Object.values(blocks)
          .filter((block) => block.stage_id === stage.id)
          .sort((a, b) => a.z_index - b.z_index);

        return {
          id: stage.id,
          name: stage.stage_name?.trim() || `Untitled stage ${stage.order_in_document + 1}`,
          count: stageBlocks.length,
          blocks: stageBlocks.slice(0, 3).map((block) => block.name?.trim() || block.type),
        };
      }),
    [orderedStages, blocks],
  );

  const unassignedBlocks = useMemo(
    () => Object.values(blocks).filter((block) => !block.stage_id).length,
    [blocks],
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        padding: '0 12px',
        backgroundColor: 'transparent',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'hsl(var(--foreground) / 0.35)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Outline
        </span>

        <div
          style={{
            backgroundColor: 'hsl(var(--foreground) / 0.04)',
            border: '1px solid hsl(var(--foreground) / 0.08)',
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'hsl(var(--foreground) / 0.92)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {documentTitle}
          </span>
          <span style={{ fontSize: 12, color: 'hsl(var(--foreground) / 0.5)' }}>
            {orderedStages.length} stages · {Object.keys(blocks).length} blocks · {paragraphCount} text sections
          </span>
        </div>
      </div>

      <div
        style={{
          height: 1,
          backgroundColor: 'hsl(var(--foreground) / 0.06)',
          margin: '0 0 14px',
          flexShrink: 0,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'hsl(var(--foreground) / 0.35)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Structure
        </span>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <StatCard label="Stages" value={orderedStages.length.toString()} />
          <StatCard label="Blocks" value={Object.keys(blocks).length.toString()} />
          <StatCard label="Text" value={paragraphCount.toString()} />
          <StatCard label="Loose" value={unassignedBlocks.toString()} />
        </div>
      </div>

      <div
        style={{
          height: 1,
          backgroundColor: 'hsl(var(--foreground) / 0.06)',
          margin: '0 0 14px',
          flexShrink: 0,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, flex: 1 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'hsl(var(--foreground) / 0.35)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Navigation
        </span>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 0,
            overflowY: 'auto',
            paddingRight: 2,
          }}
        >
          {stageRows.length > 0 ? (
            stageRows.map((stage, index) => (
              <div
                key={stage.id}
                style={{
                  backgroundColor: 'hsl(var(--foreground) / 0.04)',
                  border: '1px solid hsl(var(--foreground) / 0.06)',
                  borderRadius: 8,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'hsl(var(--foreground) / 0.92)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {index + 1}. {stage.name}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'hsl(var(--foreground) / 0.45)',
                      flexShrink: 0,
                    }}
                  >
                    {stage.count} blocks
                  </span>
                </div>

                {stage.blocks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {stage.blocks.map((blockName) => (
                      <div
                        key={`${stage.id}-${blockName}`}
                        style={{
                          height: 28,
                          borderRadius: 6,
                          padding: '0 10px',
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: 'hsl(var(--foreground) / 0.03)',
                          color: 'hsl(var(--foreground) / 0.6)',
                          fontSize: 11,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {blockName}
                      </div>
                    ))}
                    {stage.count > stage.blocks.length ? (
                      <span style={{ fontSize: 10, color: 'hsl(var(--foreground) / 0.35)' }}>
                        +{stage.count - stage.blocks.length} more
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'hsl(var(--foreground) / 0.4)' }}>
                    No blocks placed yet
                  </span>
                )}
              </div>
            ))
          ) : (
            <div
              style={{
                backgroundColor: 'hsl(var(--foreground) / 0.04)',
                border: '1px solid hsl(var(--foreground) / 0.06)',
                borderRadius: 8,
                padding: 12,
                fontSize: 12,
                color: 'hsl(var(--foreground) / 0.45)',
              }}
            >
              Add stages to build the document outline.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        backgroundColor: 'hsl(var(--foreground) / 0.04)',
        border: '1px solid hsl(var(--foreground) / 0.06)',
        borderRadius: 8,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: 'hsl(var(--foreground) / 0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 600, color: 'hsl(var(--foreground) / 0.92)' }}>
        {value}
      </span>
    </div>
  );
}

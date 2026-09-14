import type { CanvasBlock } from '@/lib/canvas-types';

interface AnnotationsListProps {
  open: boolean;
  onClose: () => void;
  blocks: CanvasBlock[];
  onBlockFocus: (blockId: string) => void;
  onBlockChange: (
    id: string, patch: Partial<CanvasBlock>
  ) => void;
}

export function AnnotationsList({
  open, onClose, blocks,
  onBlockFocus, onBlockChange,
}: AnnotationsListProps) {
  if (!open) return null;

  const annotated = blocks.filter(
    b => b.creatorAnnotation
  );

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0,
        background: 'color-mix(in srgb, var(--porthole) 62%, transparent)', zIndex: 200,
      }} onClick={onClose} />
      <div style={{
        position: 'fixed',
        left: 220, top: 60,
        width: 300, maxHeight: '70vh',
        background: 'var(--bg)',
        border: '1px solid color-mix(in srgb, var(--cat-breakage) 20%, transparent)',
        borderRadius: 12, zIndex: 201,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--elev-overlay)',
      }}>
        <div style={{
          padding: '14px 16px 10px 16px',
          borderBottom:
            '1px solid var(--line)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: 'color-mix(in srgb, var(--cat-breakage) 80%, transparent)',
          }}>
            Your Notes
            {annotated.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 11,
                color: 'var(--text2)',
                fontWeight: 400,
              }}>
                ({annotated.length})
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: 'var(--text2)',
            cursor: 'pointer', fontSize: 16,
          }}>×</button>
        </div>

        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '8px 0',
        }}>
          {annotated.length === 0 ? (
            <div style={{
              padding: '24px 16px',
              fontSize: 12,
              color: 'var(--text2)',
              textAlign: 'center',
            }}>
              No notes yet. Click a block and
              press "Note" to add one.
            </div>
          ) : (
            annotated.map(block => (
              <div
                key={block.id}
                style={{
                  padding: '10px 16px',
                  borderBottom:
                    '1px solid var(--line)',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  onBlockFocus(block.id)
                }
              >
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text2)',
                  letterSpacing: '0.08em',
                  marginBottom: 4,
                  display: 'flex', gap: 6,
                }}>
                  <span>
                    {block.type?.replace(/_/g, ' ')}
                  </span>
                  {block.stageIndex && (
                    <span style={{
                      color: 'var(--action)',
                    }}>
                      {block.stageIndex}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text2)',
                  lineHeight: 1.55,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {block.creatorAnnotation}
                </div>
                <div style={{
                  fontSize: 10, marginTop: 4,
                  color: 'var(--text2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {block.subheading
                    || block.textContent
                      ?.substring(0, 50) || '\u2014'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

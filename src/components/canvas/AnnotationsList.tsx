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
        background: 'rgba(0,0,0,0.40)', zIndex: 200,
      }} onClick={onClose} />
      <div style={{
        position: 'fixed',
        left: 220, top: 60,
        width: 300, maxHeight: '70vh',
        background: 'rgba(10,10,16,0.99)',
        border: '1px solid rgba(245,158,11,0.20)',
        borderRadius: 12, zIndex: 201,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,0.60)',
      }}>
        <div style={{
          padding: '14px 16px 10px 16px',
          borderBottom:
            '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: 'rgba(245,158,11,0.80)',
          }}>
            Your Notes
            {annotated.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 11,
                color: 'rgba(255,255,255,0.30)',
                fontWeight: 400,
              }}>
                ({annotated.length})
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.35)',
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
              color: 'rgba(255,255,255,0.22)',
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
                    '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  onBlockFocus(block.id)
                }
              >
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.30)',
                  letterSpacing: '0.08em',
                  marginBottom: 4,
                  display: 'flex', gap: 6,
                }}>
                  <span>
                    {block.type?.replace(/_/g, ' ')}
                  </span>
                  {block.stageIndex && (
                    <span style={{
                      color: '#8B4513',
                    }}>
                      {block.stageIndex}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.60)',
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
                  color: 'rgba(255,255,255,0.20)',
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

import type { CanvasBlock, CanvasStage } from '@/lib/canvas-types';
import { ContentBlockViewer } from '@/components/ContentBlockViewer';
import { BlockViewerInCanvas } from './BlockViewerInCanvas';
import { type } from "@/lib/theme/type";

interface StageTimelineProps {
  stages: CanvasStage[];
  blocks: CanvasBlock[];
  postType: string;
  showAnnotations?: boolean;
}

export function StageTimeline({ stages, blocks, postType, showAnnotations }: StageTimelineProps) {
  // If no stages, render blocks in reading order
  const hasStages = stages.length > 0;

  if (!hasStages) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
        {blocks.map(block => (
          <div key={block.id} style={{
            background: 'rgba(14,14,20,0.60)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 10,
            padding: 16,
          }}>
            {block.subheading && (
              <div style={{
                color: 'rgba(255,255,255,0.85)',
                marginBottom: 10,
                ...type.cardTitle,
              }}>
                {block.subheading}
              </div>
            )}
            <BlockViewerInCanvas block={block} postType={postType} />
          </div>
        ))}
      </div>
    );
  }

  // Group blocks by stage
  const stageOrder = [...stages].sort((a, b) => a.stageNumber - b.stageNumber);
  const ungrouped = blocks.filter(b => !b.stageId);

  return (
    <div style={{ position: 'relative', padding: '20px 0 20px 32px' }}>
      {/* Vertical timeline line */}
      <div style={{
        position: 'absolute',
        left: 14, top: 0, bottom: 0,
        width: 2,
        background: 'linear-gradient(to bottom, rgba(139,69,19,0.4), rgba(139,69,19,0.08))',
        borderRadius: 1,
      }} />

      {stageOrder.map((stage, idx) => {
        const stageBlocks = blocks
          .filter(b => b.stageId === stage.id)
          .sort((a, b) => {
            if (a.position.row !== b.position.row) return a.position.row - b.position.row;
            return a.position.col - b.position.col;
          });

        return (
          <div key={stage.id} style={{ marginBottom: 32, position: 'relative' }}>
            {/* Timeline node */}
            <div style={{
              position: 'absolute',
              left: -32 + 8, top: 4,
              width: 14, height: 14,
              borderRadius: '50%',
              background: '#8B4513',
              border: '3px solid rgba(6,6,10,1)',
              zIndex: 2,
            }} />

            {/* Stage heading */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: '#8B4513',
                  background: 'rgba(139,69,19,0.12)',
                  border: '1px solid rgba(139,69,19,0.25)',
                  borderRadius: 4,
                  padding: '2px 8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>
                  Stage {stage.stageNumber}
                </span>
                {stage.estimatedMinutes && (
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                    ~{stage.estimatedMinutes} min
                  </span>
                )}
              </div>
              <h3 style={{
                color: 'rgba(255,255,255,0.90)',
                ...type.cardTitle,
                margin: '6px 0 0',
              }}>
                {stage.title}
              </h3>
              {stage.description && (
                <p style={{
                  fontSize: 13, color: 'rgba(255,255,255,0.40)',
                  margin: '4px 0 0', lineHeight: 1.5,
                }}>
                  {stage.description}
                </p>
              )}
            </div>

            {/* Stage blocks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stageBlocks.map(block => (
                <div key={block.id} style={{
                  background: 'rgba(14,14,20,0.60)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: 10,
                  padding: 16,
                  position: 'relative',
                }}>
                  {block.subheading && (
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: 'rgba(255,255,255,0.80)',
                      marginBottom: 8,
                    }}>
                      {block.subheading}
                    </div>
                  )}
                  <BlockViewerInCanvas block={block} postType={postType} />

                  {/* Annotation tooltip */}
                  {showAnnotations && block.creatorAnnotation && (
                    <div title={block.creatorAnnotation} style={{
                      position: 'absolute', top: 8, right: 8,
                      width: 18, height: 18,
                      background: 'rgba(245,158,11,0.20)',
                      border: '1px solid rgba(245,158,11,0.40)',
                      borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, cursor: 'help',
                    }}>
                      ✎
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Ungrouped blocks at the end */}
      {ungrouped.length > 0 && (
        <div style={{ marginBottom: 32, position: 'relative' }}>
          <div style={{
            position: 'absolute',
            left: -32 + 8, top: 4,
            width: 14, height: 14,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.20)',
            border: '3px solid rgba(6,6,10,1)',
            zIndex: 2,
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ungrouped.map(block => (
              <div key={block.id} style={{
                background: 'rgba(14,14,20,0.60)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: 10,
                padding: 16,
              }}>
                {block.subheading && (
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: 'rgba(255,255,255,0.80)',
                    marginBottom: 8,
                  }}>
                    {block.subheading}
                  </div>
                )}
                <BlockViewerInCanvas block={block} postType={postType} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

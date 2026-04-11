import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CanvasStage } from '@/lib/canvas-types';

interface StageTabBarProps {
  stages: CanvasStage[];
  activeStageTab: string | null;
  onSelectStage: (stageId: string | null) => void;
  onAddStage: () => void;
}

export function StageTabBar({
  stages, activeStageTab, onSelectStage, onAddStage,
}: StageTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();

    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);

    const handleScroll = () => updateScrollState();
    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', handleScroll);
    };
  }, [stages.length]);

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const arrowBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10,10,16,0.90)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.40)',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '6px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-200)}
          title="Scroll left"
          style={arrowBtnStyle}
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* Scrollable tab container */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <div
          ref={scrollRef}
          className="scrollbar-hide"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <button
            onClick={() => onSelectStage(null)}
            style={{
              padding: '4px 12px', fontSize: 11, fontWeight: 600,
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: !activeStageTab ? 'rgba(232,87,26,0.15)' : 'rgba(255,255,255,0.04)',
              color: !activeStageTab ? '#E8571A' : 'rgba(255,255,255,0.40)',
              transition: 'all 0.15s',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            All
          </button>
          {stages.map(s => (
            <button
              key={s.id}
              onClick={() => onSelectStage(s.id)}
              style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 600,
                borderRadius: 6, border: 'none', cursor: 'pointer',
                background: activeStageTab === s.id ? 'rgba(232,87,26,0.15)' : 'rgba(255,255,255,0.04)',
                color: activeStageTab === s.id ? '#E8571A' : 'rgba(255,255,255,0.40)',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {s.title}
            </button>
          ))}
          <button
            onClick={onAddStage}
            style={{
              padding: '4px 8px', fontSize: 11, border: 'none', cursor: 'pointer',
              background: 'none', color: 'rgba(255,255,255,0.25)',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            + Stage
          </button>
        </div>

        {/* Left gradient fade */}
        {canScrollLeft && (
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: 32,
            background: 'linear-gradient(to right, rgba(10,10,16,0.95), transparent)',
            pointerEvents: 'none',
          }} />
        )}

        {/* Right gradient fade */}
        {canScrollRight && (
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            width: 32,
            background: 'linear-gradient(to left, rgba(10,10,16,0.95), transparent)',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Right arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(200)}
          title="Scroll right"
          style={arrowBtnStyle}
        >
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

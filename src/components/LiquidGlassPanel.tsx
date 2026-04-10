import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import LiquidGlass from 'liquid-glass-react';

interface LiquidGlassPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  cornerRadius?: number;
  displacementScale?: number;
  blurAmount?: number;
  saturation?: number;
  aberrationIntensity?: number;
  elasticity?: number;
  overLight?: boolean;
  mouseContainer?: React.RefObject<HTMLElement | null> | null;
  cursorEffect?: 'glass' | 'vertical-expand';
}

export default function LiquidGlassPanel({
  children,
  className,
  style,
  cornerRadius = 20,
  displacementScale,
  blurAmount,
  saturation,
  aberrationIntensity,
  elasticity,
  overLight,
  mouseContainer,
  cursorEffect = 'glass',
}: LiquidGlassPanelProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseY(e.clientY - rect.top);
  }, []);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setMouseY(null);
  }, []);

  const isVerticalExpand = cursorEffect === 'vertical-expand';

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: cornerRadius,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        ...style,
      }}
      onMouseMove={isVerticalExpand ? handleMouseMove : undefined}
      onMouseEnter={isVerticalExpand ? handleMouseEnter : undefined}
      onMouseLeave={isVerticalExpand ? handleMouseLeave : undefined}
    >
      {/* Visual-only effect layer */}
      {isVerticalExpand ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: '100%',
              height: 100,
              top: mouseY != null ? mouseY - 50 : -100,
              opacity: isHovered ? 1 : 0,
              background:
                'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.06) 70%, transparent 100%)',
              transition: 'top 0.15s ease-out, opacity 0.25s ease-out',
              borderRadius: cornerRadius,
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <LiquidGlass
            style={{ width: '100%', height: '100%' }}
            cornerRadius={cornerRadius}
            displacementScale={displacementScale}
            blurAmount={blurAmount}
            saturation={saturation}
            aberrationIntensity={aberrationIntensity}
            elasticity={elasticity}
            overLight={overLight}
            mouseContainer={mouseContainer}
          >
            <div style={{ width: '100%', height: '100%' }} />
          </LiquidGlass>
        </div>
      )}

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(200, 200, 210, 0.08)',
          backdropFilter: 'blur(2px) saturate(1.2)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

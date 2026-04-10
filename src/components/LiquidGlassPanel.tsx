import type React from 'react';
import { useEffect, useRef } from 'react';
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
}: LiquidGlassPanelProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Override the library's inline styles that break panel layout
  useEffect(() => {
    const el = wrapperRef.current?.querySelector(':scope > *') as HTMLElement | null;
    if (!el) return;

    // The library sets display:inline-flex and overflow:hidden which collapses panels
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.overflow = 'auto';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.padding = '0';
    el.style.fontFamily = 'inherit';
    el.style.fontSize = 'inherit';
    el.style.lineHeight = 'inherit';
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      <LiquidGlass
        style={{
          width: '100%',
          height: '100%',
        }}
        cornerRadius={cornerRadius}
        displacementScale={displacementScale}
        blurAmount={blurAmount}
        saturation={saturation}
        aberrationIntensity={aberrationIntensity}
        elasticity={elasticity}
        overLight={overLight}
        mouseContainer={mouseContainer}
      >
        {children}
      </LiquidGlass>
    </div>
  );
}

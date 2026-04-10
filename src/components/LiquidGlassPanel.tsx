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

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function applyOverrides() {
      const el = wrapper!.querySelector(':scope > div > div') as HTMLElement | null;
      const direct = wrapper!.querySelector(':scope > div') as HTMLElement | null;

      for (const target of [direct, el]) {
        if (!target) continue;
        target.style.display = 'flex';
        target.style.flexDirection = 'column';
        target.style.overflow = 'auto';
        target.style.width = '100%';
        target.style.height = '100%';
        target.style.padding = '0';
        target.style.fontFamily = 'inherit';
        target.style.fontSize = 'inherit';
        target.style.lineHeight = 'inherit';
        target.style.position = 'relative';
      }
    }

    applyOverrides();

    const observer = new MutationObserver(() => applyOverrides());
    observer.observe(wrapper, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });

    return () => observer.disconnect();
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

import type React from 'react';
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
  return (
    <LiquidGlass
      className={className}
      style={{
        overflow: 'auto',
        width: '100%',
        height: '100%',
        ...style,
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
  );
}

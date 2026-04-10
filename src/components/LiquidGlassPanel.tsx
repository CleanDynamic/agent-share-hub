import type React from 'react';

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
  blurAmount = 20,
  saturation = 1.4,
}: LiquidGlassPanelProps) {
  return (
    <div
      className={className}
      style={{
        overflow: 'auto',
        width: '100%',
        height: '100%',
        backdropFilter: `blur(${blurAmount}px) saturate(${saturation})`,
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: `${cornerRadius}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

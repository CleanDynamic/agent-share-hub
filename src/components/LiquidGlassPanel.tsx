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
}: LiquidGlassPanelProps) {
  const glassStyle: React.CSSProperties = {
    backdropFilter: 'blur(20px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
    background: 'rgba(255, 255, 255, 0.04)',
    borderRadius: `${cornerRadius}px`,
    overflow: 'auto',
    width: '100%',
    height: '100%',
    ...style,
  };

  return (
    <div className={className} style={glassStyle}>
      {children}
    </div>
  );
}

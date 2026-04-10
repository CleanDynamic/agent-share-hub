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
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: cornerRadius,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Visual-only glass layer */}
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
          {/* Empty — this layer is purely visual */}
          <div style={{ width: '100%', height: '100%' }} />
        </LiquidGlass>
      </div>

      {/* Content layer — normal layout, scrollable */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}

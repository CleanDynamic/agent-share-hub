import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export const PANEL_DIVIDER = '0.5px solid hsl(var(--foreground) / 0.06)';
export const PANEL_CARD_BACKGROUND = 'hsl(var(--foreground) / 0.025)';
export const PANEL_INPUT_BACKGROUND = 'hsl(240 14% 14% / 0.5)';
export const PANEL_INPUT_BORDER = '0.5px solid hsl(var(--foreground) / 0.08)';
export const PANEL_INPUT_RADIUS = 6;

export const SECTION_LABEL_STYLE: CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'hsl(var(--foreground) / 0.35)',
};

export const TOOL_HEADER_TITLE_STYLE: CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  color: 'hsl(var(--foreground) / 0.85)',
};

interface EmptyPanelStateProps {
  description: string;
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}

export function EmptyPanelState({
  description,
  icon: Icon,
  title,
  children,
}: EmptyPanelStateProps) {
  return (
    <div
      style={{
        height: '100%',
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 10,
        padding: '0 20px',
      }}
    >
      <Icon size={64} style={{ color: 'hsl(var(--foreground) / 0.25)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            fontWeight: 500,
            color: 'hsl(var(--foreground) / 0.86)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 11,
            fontWeight: 400,
            lineHeight: 1.45,
            color: 'hsl(var(--foreground) / 0.46)',
          }}
        >
          {description}
        </div>
      </div>
      {children}
    </div>
  );
}
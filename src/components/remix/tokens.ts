// Shared design-system tokens for the Remix Lineage / Creator Credit surface.
export const tokens = {
  shell: 'rgba(52,52,66,0.55)',
  card: 'rgba(68,68,84,0.60)',
  input: 'rgba(82,82,100,0.60)',
  borderFaint: '0.5px solid rgba(255,255,255,0.10)',
  borderSoft: '0.5px solid rgba(255,255,255,0.14)',
  orange: '#E8571A',
  orangeGradient: 'linear-gradient(135deg, #E8571A 0%, #C44514 100%)',
  teal: '#2EC4B6',
  amber: '#F59E0B',
  purple: '#7C3AED',
  green: '#22C55E',
  text: 'rgba(255,255,255,0.92)',
  textMuted: 'rgba(255,255,255,0.62)',
  textFaint: 'rgba(255,255,255,0.40)',
  locked: 'rgba(255,255,255,0.25)',
  panel: 14,
  cardRadius: 10,
  pill: 100,
  glass: 'blur(28px) saturate(160%)',
} as const;

export const xpColor = tokens.orange;
export const reputationColor = tokens.teal;
export const streakColor = tokens.amber;

export const fontMono = 'var(--font-geist-mono), "JetBrains Mono", monospace';

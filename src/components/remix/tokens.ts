// Shared design-system tokens for the Remix Lineage / Creator Credit surface.
export const tokens = {
  shell: 'rgba(52,52,66,0.55)',
  card: 'rgba(68,68,84,0.60)',
  input: 'rgba(82,82,100,0.60)',
  borderFaint: '0.5px solid var(--line)',
  borderSoft: '0.5px solid var(--line)',
  orange: 'var(--action)',
  orangeGradient: 'linear-gradient(135deg, var(--action) 0%, #C44514 100%)',
  teal: 'var(--evidence)',
  amber: 'var(--lit)',
  purple: 'var(--cat-agents)',
  green: 'var(--cat-configuration)',
  text: 'var(--text)',
  textMuted: 'var(--recess)',
  textFaint: 'var(--recess)',
  locked: 'var(--recess)',
  panel: 14,
  cardRadius: 10,
  pill: 100,
  glass: 'blur(28px) saturate(160%)',
} as const;

export const xpColor = tokens.orange;
export const reputationColor = tokens.teal;
export const streakColor = tokens.amber;

export const fontMono = 'var(--font-geist-mono), "JetBrains Mono", monospace';

// ─── POST TYPES (the social object — what the post IS) ───

export const POST_TYPES = [
  {
    value: 'build',
    label: 'Build',
    description: 'Something you made — a tool, agent, workflow, or system',
    color: '#E8571A',
    bg: 'rgba(232,87,26,0.15)',
    border: 'rgba(232,87,26,0.30)',
    emoji: '🔨',
  },
  {
    value: 'technique',
    label: 'Technique',
    description: 'A specific method or approach you have tested and proven',
    color: '#2EC4B6',
    bg: 'rgba(46,196,182,0.15)',
    border: 'rgba(46,196,182,0.30)',
    emoji: '⚡',
  },
  {
    value: 'discovery',
    label: 'Discovery',
    description: 'Something you found — a behaviour, result, or tool',
    color: '#7C3AED',
    bg: 'rgba(124,58,237,0.15)',
    border: 'rgba(124,58,237,0.30)',
    emoji: '🔍',
  },
  {
    value: 'discussion',
    label: 'Discussion',
    description: 'A question, debate, challenge, or open thought',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.15)',
    border: 'rgba(245,158,11,0.30)',
    emoji: '💬',
  },
] as const;

export type PostType = typeof POST_TYPES[number]['value'];

export function getPostType(value: string) {
  return POST_TYPES.find(p => p.value === value) ?? POST_TYPES[0];
}

// ─── BLOCK TYPES (what lives INSIDE a post as subheadings) ───

export const BLOCK_TYPES = [
  {
    value: 'prompt',
    label: 'Prompt',
    description: 'A copyable prompt to paste into any AI tool',
    icon: 'MessageSquare',
  },
  {
    value: 'agent_config',
    label: 'Agent Config',
    description: 'System prompt, model settings, and agent instructions',
    icon: 'Bot',
  },
  {
    value: 'workflow',
    label: 'Workflow',
    description: 'Step-by-step process or automation sequence',
    icon: 'GitBranch',
  },
  {
    value: 'model_params',
    label: 'Model Parameters',
    description: 'Temperature, context window, and model settings',
    icon: 'Sliders',
  },
  {
    value: 'tool_setup',
    label: 'Tool Setup',
    description: 'How to configure a specific tool or integration',
    icon: 'Settings',
  },
  {
    value: 'code',
    label: 'Code',
    description: 'A script, function, or code snippet',
    icon: 'Code',
  },
  {
    value: 'result',
    label: 'Result',
    description: 'Output or screenshot showing what happened',
    icon: 'BarChart',
  },
  {
    value: 'comparison',
    label: 'Comparison',
    description: 'Side-by-side model or approach comparison',
    icon: 'Columns',
  },
  {
    value: 'text',
    label: 'Text',
    description: 'Written context, explanation, or narrative',
    icon: 'AlignLeft',
  },
  {
    value: 'image',
    label: 'Image',
    description: 'A screenshot, diagram, or visual',
    icon: 'Image',
  },
  {
    value: 'resource',
    label: 'Resource',
    description: 'A link, paper, or external reference',
    icon: 'Link',
  },
] as const;

export type BlockType = typeof BLOCK_TYPES[number]['value'];

export function getBlockType(value: string) {
  return BLOCK_TYPES.find(b => b.value === value) ??
    BLOCK_TYPES.find(b => b.value === 'text')!;
}

// ─── LEGACY SUPPORT — maps old content_type to post_type ───
// Keeps old posts readable. Remove after full migration.

export const LEGACY_TYPE_MAP: Record<string, PostType> = {
  'Prompt File':         'technique',
  'Agent Blueprint':     'build',
  'AI Agent Install Guide': 'build',
  'Model Config Guide':  'build',
  'Integration Guide':   'build',
  'Workflow Template':   'build',
  'Evaluation Framework':'technique',
  'Agent Stack':         'build',
  'Failure Library':     'discovery',
  'Blog':                'discussion',
  'AI Tools (LLMs)':     'build',
  'Open Question':       'discussion',
  'Challenge':           'discussion',
};

export function resolvePostType(
  post_type: string | null,
  content_type: string | null
): PostType {
  if (post_type && ['build','technique','discovery','discussion'].includes(post_type)) {
    return post_type as PostType;
  }
  if (content_type && LEGACY_TYPE_MAP[content_type]) {
    return LEGACY_TYPE_MAP[content_type];
  }
  return 'build';
}

// ─── DIFFICULTY ───

export const DIFFICULTIES = [
  'Beginner', 'Intermediate', 'Advanced', 'Any'
] as const;

export type Difficulty = typeof DIFFICULTIES[number];

export const DIFFICULTY_COLORS: Record<string, {
  color: string; bg: string; border: string;
}> = {
  'Beginner':     { color: '#22C55E', bg: 'rgba(22,163,74,0.12)',  border: 'rgba(22,163,74,0.30)'  },
  'Intermediate': { color: '#F59E0B', bg: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.30)'  },
  'Advanced':     { color: '#EF4444', bg: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.30)'  },
  'Any':          { color: '#9CA3AF', bg: 'rgba(75,85,99,0.12)',   border: 'rgba(75,85,99,0.30)'   },
};

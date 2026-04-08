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

// ─── Primary type label (Blueprint / Blog) ───
// Build / Technique / Discovery all roll up to "Blueprint"
// at the primary badge level, with the sub-type kept as a
// secondary distinguisher. Discussion becomes "Blog".
export function getPrimaryTypeLabel(
  postType: string | null
): { label: string; sub: string | null; emoji: string } {
  switch (postType) {
    case 'build':
      return { label: 'Blueprint', sub: 'Build', emoji: '🔷' };
    case 'technique':
      return { label: 'Blueprint', sub: 'Technique', emoji: '🔷' };
    case 'discovery':
      return { label: 'Blueprint', sub: 'Discovery', emoji: '🔷' };
    case 'discussion':
      return { label: 'Blog', sub: null, emoji: '📝' };
    default:
      return { label: 'Blueprint', sub: null, emoji: '🔷' };
  }
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
  // Handle post_category values from the database
  if (post_type === 'bounty') return 'discussion';
  if (post_type === 'blueprint') return LEGACY_TYPE_MAP[content_type ?? ''] ?? 'build';
  if (post_type === 'blog') return 'discussion';
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

// ─── LEGACY EXPORTS (used by 27+ files) ───

export const ORDERED_CONTENT_TYPES = [
  'Prompt File',
  'Agent Blueprint',
  'AI Agent Install Guide',
  'Model Config Guide',
  'Integration Guide',
  'Workflow Template',
  'Evaluation Framework',
  'Agent Stack',
  'Failure Library',
  'Blog',
] as const;

export const BLUEPRINT_CONTENT_TYPES = [
  'Prompt File',
  'Agent Blueprint',
  'AI Agent Install Guide',
  'Model Config Guide',
  'Integration Guide',
  'Workflow Template',
  'Evaluation Framework',
  'Agent Stack',
  'Failure Library',
  'Blog',
] as const;

export const BOUNTY_CONTENT_TYPES = [
  'Open Question',
  'Challenge',
] as const;

export const TYPE_COLORS: Record<string, string> = {
  'Prompt File':           'bg-[#E8571A]/15 text-[#E8571A] border-[#E8571A]/30',
  'Agent Blueprint':       'bg-[#7C3AED]/15 text-[#7C3AED] border-[#7C3AED]/30',
  'AI Agent Install Guide':'bg-[#7C3AED]/15 text-[#7C3AED] border-[#7C3AED]/30',
  'Workflow Template':     'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30',
  'Agent Stack':           'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
  'Model Config Guide':    'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
  'Integration Guide':     'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
  'Evaluation Framework':  'bg-[#EC4899]/15 text-[#EC4899] border-[#EC4899]/30',
  'Failure Library':       'bg-[#9CA3AF]/15 text-[#9CA3AF] border-[#9CA3AF]/30',
  'Blog':                  'bg-[#F472B6]/15 text-[#F472B6] border-[#F472B6]/30',
  'AI Tools (LLMs)':       'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30',
  'Open Question':         'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30',
  'Challenge':             'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
};

const DISPLAY_LABELS: Record<string, string> = {
  'Prompt File':           'Prompt',
  'Agent Blueprint':       'Agent',
  'AI Agent Install Guide':'Install Guide',
  'Model Config Guide':    'Config',
  'Integration Guide':     'Integration',
  'Workflow Template':     'Workflow',
  'Evaluation Framework':  'Evaluation',
  'Agent Stack':           'Stack',
  'Failure Library':       'Failure Log',
  'Blog':                  'Blog',
  'AI Tools (LLMs)':       'AI Tool',
  'Open Question':         'Open Question',
  'Challenge':             'Challenge',
};

export function displayContentType(type: string): string {
  return DISPLAY_LABELS[type] ?? type;
}

export const SLUG_TO_TYPE: Record<string, string> = {
  'prompts':       'Prompt File',
  'agents':        'Agent Blueprint',
  'install-guides':'AI Agent Install Guide',
  'configs':       'Model Config Guide',
  'integrations':  'Integration Guide',
  'workflows':     'Workflow Template',
  'evaluations':   'Evaluation Framework',
  'stacks':        'Agent Stack',
  'failures':      'Failure Library',
  'blog':          'Blog',
};

export const TOPICS = [
  'Prompt Engineering',
  'Autonomous Agents',
  'RAG',
  'Fine-Tuning',
  'LLM Evaluation',
  'AI Safety',
  'Multi-Agent Systems',
  'Tool Use',
  'Code Generation',
  'Image Generation',
  'Voice & Audio',
  'Embeddings',
  'Vector Databases',
  'AI Workflows',
  'Open Source Models',
  'Commercial Models',
  'AI Ethics',
  'AI News',
  'Tutorials',
  'Case Studies',
] as const;

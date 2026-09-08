// ─── POST TYPES (the social object — what the post IS) ───

export const POST_TYPES = [
  {
    value: 'build',
    label: 'Build',
    description: 'Something you made — a tool, agent, workflow, or system',
    color: '#8B4513',
    bg: 'rgba(139,69,19,0.15)',
    border: 'rgba(139,69,19,0.30)',
    emoji: '🔨',
  },
  {
    value: 'technique',
    label: 'Technique',
    description: 'A specific method or approach you have tested and proven',
    color: '#1F7A6D',
    bg: 'rgba(31,122,109,0.15)',
    border: 'rgba(31,122,109,0.30)',
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

/**
 * BG-P05. DIFFICULTY CARRIES NO COLOUR.
 *
 * Difficulty is not a part category. The nine hues encode what a piece of a
 * build IS, and a green Beginner badge next to a green configuration chip says
 * the two are related when they are not — so the four difficulty colours are
 * retired outright rather than folded into the nine.
 *
 * What replaces them is one class, used everywhere a difficulty is shown: mono,
 * `--text2`, no fill and no border. It reads as the piece of metadata it is.
 * Every local `difficultyColor`, `DIFF_COLORS` and `DIFFICULTY_STYLES` in this
 * codebase now returns this; there is one definition and no second copy.
 *
 * The mono face is named inline rather than through `font-mono`, because the
 * Tailwind config still points that utility at the system stack and repointing
 * it would restyle 30-odd unrelated surfaces.
 */
export const DIFFICULTY_LABEL_CLASS =
  "[font-family:'DM_Mono',ui-monospace,monospace] bg-transparent text-[var(--text2)] border-transparent";

/** @deprecated BG-P05. Every level is the same uncoloured label now. */
export const DIFFICULTY_COLORS: Record<string, {
  color: string; bg: string; border: string;
}> = {
  'Beginner':     { color: 'var(--text2)', bg: 'transparent', border: 'transparent' },
  'Intermediate': { color: 'var(--text2)', bg: 'transparent', border: 'transparent' },
  'Advanced':     { color: 'var(--text2)', bg: 'transparent', border: 'transparent' },
  'Any':          { color: 'var(--text2)', bg: 'transparent', border: 'transparent' },
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

/**
 * BG-P05. THE MAPPING TABLE: each legacy content-type label, resolved into one
 * of the nine part categories. This is the record of the decision; `TYPE_COLORS`
 * below is only its rendering, and `content-types.test.ts` asserts the two
 * agree.
 *
 * Each was decided by what the label MEANS, not by which hue it used to carry:
 *
 *   Prompt File             instruction    a prompt is the instruction itself
 *   Agent Blueprint         agents         the agent hue exists for exactly this
 *   AI Agent Install Guide  configuration  standing an agent up is configuring it
 *   Model Config Guide      configuration  named in the brief
 *   Integration Guide       configuration  `integration` is a configuration row
 *                                          in node_types; this is the same thing
 *                                          written as prose
 *   Workflow Template       configuration  named in the brief — a template is a
 *                                          wiring you copy, not an instruction
 *   Evaluation Framework    evidence       named in the brief
 *   Agent Stack             configuration  `stack` is a configuration row in
 *                                          node_types, for the same reason
 *   AI Tools (LLMs)         configuration  `tool_definition` is a configuration
 *                                          row; a post about a tool is the same
 *                                          subject as the tool's own node
 *   Failure Library         breakage       named in the brief
 *   Blog                    narrative      named in the brief
 *   Open Question           breakage       named in the brief — an open question
 *                                          is a gap someone has written down
 *   Challenge               instruction    named in the brief
 *
 * Nothing here lands on `data`, `artefact` or `media`: the legacy vocabulary
 * described kinds of WRITING about builds, and those three describe parts of a
 * build. That is the shape of the mismatch, not an omission. Nothing needed the
 * fallback either — every one of the thirteen means something one of the nine
 * already names.
 *
 * A label this table does not carry — an older row, a newer one — is
 * `TYPE_COLOR_FALLBACK`, never an invented hue.
 */
export const LEGACY_BADGE_CATEGORY: Record<string, string> = {
  'Prompt File':            'instruction',
  'Agent Blueprint':        'agents',
  'AI Agent Install Guide': 'configuration',
  'Model Config Guide':     'configuration',
  'Integration Guide':      'configuration',
  'Workflow Template':      'configuration',
  'Evaluation Framework':   'evidence',
  'Agent Stack':            'configuration',
  'AI Tools (LLMs)':        'configuration',
  'Failure Library':        'breakage',
  'Blog':                   'narrative',
  'Open Question':          'breakage',
  'Challenge':              'instruction',
};

/**
 * A content type nothing above names. `--cat-fallback` on `--cat-fallback-fill`
 * — the same pair `categoryFill("")` returns, spelled as Tailwind classes.
 *
 * Eight call sites used to reach for the "Failure Library" entry as their
 * default, which was grey in the old palette and is breakage red in the new
 * one. They point here instead.
 */
export const TYPE_COLOR_FALLBACK =
  'bg-[var(--cat-fallback-fill)] text-[var(--cat-fallback)] border-[var(--cat-fallback)]';

/**
 * The mapping table above, as the Tailwind classes a badge wears.
 *
 * Written out literally rather than generated from `LEGACY_BADGE_CATEGORY`,
 * because Tailwind generates a utility only for a class string it can find by
 * scanning the source — a class assembled at runtime produces no CSS. The test
 * is what keeps the two in step.
 */
export const TYPE_COLORS: Record<string, string> = {
  'Prompt File':           'bg-[var(--cat-instruction-fill)] text-[var(--cat-instruction)] border-[var(--cat-instruction)]',
  'Agent Blueprint':       'bg-[var(--cat-agents-fill)] text-[var(--cat-agents)] border-[var(--cat-agents)]',
  'AI Agent Install Guide':'bg-[var(--cat-configuration-fill)] text-[var(--cat-configuration)] border-[var(--cat-configuration)]',
  'Workflow Template':     'bg-[var(--cat-configuration-fill)] text-[var(--cat-configuration)] border-[var(--cat-configuration)]',
  'Agent Stack':           'bg-[var(--cat-configuration-fill)] text-[var(--cat-configuration)] border-[var(--cat-configuration)]',
  'Model Config Guide':    'bg-[var(--cat-configuration-fill)] text-[var(--cat-configuration)] border-[var(--cat-configuration)]',
  'Integration Guide':     'bg-[var(--cat-configuration-fill)] text-[var(--cat-configuration)] border-[var(--cat-configuration)]',
  'Evaluation Framework':  'bg-[var(--cat-evidence-fill)] text-[var(--cat-evidence)] border-[var(--cat-evidence)]',
  'Failure Library':       'bg-[var(--cat-breakage-fill)] text-[var(--cat-breakage)] border-[var(--cat-breakage)]',
  'Blog':                  'bg-[var(--cat-narrative-fill)] text-[var(--cat-narrative)] border-[var(--cat-narrative)]',
  'AI Tools (LLMs)':       'bg-[var(--cat-configuration-fill)] text-[var(--cat-configuration)] border-[var(--cat-configuration)]',
  'Open Question':         'bg-[var(--cat-breakage-fill)] text-[var(--cat-breakage)] border-[var(--cat-breakage)]',
  'Challenge':             'bg-[var(--cat-instruction-fill)] text-[var(--cat-instruction)] border-[var(--cat-instruction)]',
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

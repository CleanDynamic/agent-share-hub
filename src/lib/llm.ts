/**
 * llm.ts
 *
 * Lightweight "run a prompt" helper that does NOT call any LLM API directly.
 * Instead it:
 *   1. Substitutes {{varName}} tokens in the system + user prompts.
 *   2. Assembles a single text payload.
 *   3. Copies the payload to the clipboard.
 *   4. Returns a provider chat URL the caller can open in a new tab.
 *
 * This keeps API keys out of the client bundle entirely — the user just
 * pastes the prompt into ChatGPT / Claude / Gemini themselves.
 *
 * Token counting uses a simple heuristic (chars / 4) — close enough for
 * UI display without bundling tiktoken.
 */

export interface RunPromptInput {
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  variables: Record<string, string>;
}

export interface RunPromptResult {
  /** The fully-substituted text that was copied to the clipboard. */
  payload: string;
  /** URL of the provider chat page to open. */
  providerUrl: string;
  /** Friendly provider name, e.g. "ChatGPT". */
  providerName: string;
  /** Approximate token count of the assembled payload. */
  approxTokens: number;
}

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g;

/** Replace {{name}} tokens; throw if any are unresolved. */
export function substituteVariables(
  template: string,
  variables: Record<string, string>,
): string {
  const missing = new Set<string>();
  const out = template.replace(VAR_RE, (_match, name: string) => {
    const v = variables[name];
    if (v === undefined || v === null || v === '') {
      missing.add(name);
      return '';
    }
    return String(v);
  });
  if (missing.size > 0) {
    throw new Error(
      `Unresolved variable${missing.size > 1 ? 's' : ''}: ${[...missing]
        .map((n) => `{{${n}}}`)
        .join(', ')}`,
    );
  }
  return out;
}

/** ~4 chars per token is the standard cheap approximation. */
export function approximateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

interface ProviderInfo {
  name: string;
  url: string;
}

function providerForModel(model: string): ProviderInfo {
  const m = model.toLowerCase();
  if (m.startsWith('claude')) {
    return { name: 'Claude', url: 'https://claude.ai/new' };
  }
  if (m.startsWith('gemini')) {
    return { name: 'Gemini', url: 'https://gemini.google.com/app' };
  }
  // Default to ChatGPT for gpt-* and anything unrecognised.
  return { name: 'ChatGPT', url: 'https://chat.openai.com/' };
}

function assemblePayload(
  systemPrompt: string | undefined,
  userPrompt: string,
  model: string,
  temperature: number | undefined,
  maxTokens: number | undefined,
): string {
  const lines: string[] = [];
  lines.push(`# Model: ${model}`);
  if (temperature !== undefined) lines.push(`# Temperature: ${temperature}`);
  if (maxTokens !== undefined) lines.push(`# Max tokens: ${maxTokens}`);
  lines.push('');
  if (systemPrompt && systemPrompt.trim()) {
    lines.push('## System');
    lines.push(systemPrompt.trim());
    lines.push('');
  }
  lines.push('## Prompt');
  lines.push(userPrompt.trim());
  return lines.join('\n');
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback: hidden textarea + execCommand
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}

/**
 * Substitute variables, copy the assembled prompt to the clipboard, and
 * open the relevant provider chat page in a new tab.
 */
export async function runPrompt(
  input: RunPromptInput,
): Promise<RunPromptResult> {
  const {
    model,
    systemPrompt,
    userPrompt,
    temperature,
    maxTokens,
    variables,
  } = input;

  const resolvedSystem = systemPrompt
    ? substituteVariables(systemPrompt, variables)
    : undefined;
  const resolvedUser = substituteVariables(userPrompt, variables);

  const payload = assemblePayload(
    resolvedSystem,
    resolvedUser,
    model,
    temperature,
    maxTokens,
  );

  await copyToClipboard(payload);

  const provider = providerForModel(model);
  if (typeof window !== 'undefined') {
    window.open(provider.url, '_blank', 'noopener,noreferrer');
  }

  return {
    payload,
    providerUrl: provider.url,
    providerName: provider.name,
    approxTokens: approximateTokens(payload),
  };
}

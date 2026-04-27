/**
 * variables.ts
 *
 * Helpers for the named-block variable injection system.
 *
 * Blocks that have a `name` set become addressable as `{{name}}` from any
 * other block's prompt text or code. At execution time:
 *  - Prompt blocks expose `properties.output` / `properties.lastRun.payload`
 *  - Code blocks expose `properties.output`
 *  - Text blocks expose plaintext extracted from `properties.richText` or
 *    `properties.text`
 *
 * The same `Block` shape used by `documentStore` is consumed here.
 */

import type { Block } from '@/types/document';

export const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g;

export type VariableStatus = 'resolved' | 'no_output' | 'missing';

export interface VariableInfo {
  name: string;
  status: VariableStatus;
  value?: string;
  blockId?: string;
}

/** Extract unique {{name}} tokens from a string. Order-preserving. */
export function extractVariables(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(VAR_RE)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Plain-text extraction from a TipTap JSON document. */
function tiptapToPlainText(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const node = json as { type?: string; text?: string; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    const parts = node.content.map(tiptapToPlainText);
    // Block-level nodes contribute a newline so paragraphs don't smush together.
    const joiner =
      node.type === 'paragraph' ||
      node.type === 'heading' ||
      node.type === 'doc' ||
      node.type === 'listItem' ||
      node.type === 'blockquote'
        ? '\n'
        : '';
    return parts.join('') + (joiner && parts.length ? '' : '');
  }
  return '';
}

/**
 * Best-effort string value of a block, used as the substitution payload for
 * `{{name}}` references.
 */
export function getBlockValue(block: Block | undefined): string | null {
  if (!block) return null;
  const props = (block.properties ?? {}) as Record<string, unknown>;

  // Prefer an explicit output (Prompt + Code blocks set this on run).
  if (typeof props.output === 'string' && props.output.length > 0) {
    return props.output;
  }
  const lastRun = props.lastRun as { payload?: string } | undefined;
  if (lastRun && typeof lastRun.payload === 'string' && lastRun.payload) {
    return lastRun.payload;
  }

  switch (block.type) {
    case 'text': {
      if (typeof props.text === 'string' && props.text) return props.text;
      const plain = tiptapToPlainText(props.richText).trim();
      return plain || null;
    }
    case 'code': {
      if (typeof props.code === 'string' && props.code) return props.code;
      return null;
    }
    default:
      return null;
  }
}

/** True when the block has been "run" and produced an output payload. */
export function blockHasOutput(block: Block | undefined): boolean {
  if (!block) return false;
  const props = (block.properties ?? {}) as Record<string, unknown>;
  if (typeof props.output === 'string' && props.output.length > 0) return true;
  const lastRun = props.lastRun as { payload?: string } | undefined;
  if (lastRun && typeof lastRun.payload === 'string' && lastRun.payload) {
    return true;
  }
  // Static-content blocks (text, code) are always considered "available".
  return block.type === 'text' || block.type === 'code';
}

/**
 * Build the per-variable status list for display chips.
 */
export function describeVariables(
  names: string[],
  blocksByName: Map<string, Block>,
): VariableInfo[] {
  return names.map((name) => {
    const b = blocksByName.get(name);
    if (!b) return { name, status: 'missing' };
    const v = getBlockValue(b);
    if (v === null || v === '') {
      return { name, status: 'no_output', blockId: b.id };
    }
    return { name, status: 'resolved', value: v, blockId: b.id };
  });
}

/**
 * Index named blocks by `name` (case-sensitive). Blocks without a name are
 * skipped. If the same name is used twice (a duplicate the user has not yet
 * fixed), the first wins.
 */
export function indexBlocksByName(
  blocks: Record<string, Block>,
): Map<string, Block> {
  const map = new Map<string, Block>();
  for (const b of Object.values(blocks)) {
    const n = (b.name ?? '').trim();
    if (!n) continue;
    if (!map.has(n)) map.set(n, b);
  }
  return map;
}

/**
 * Returns true if `candidate` is a unique name within `blocks`, ignoring
 * `selfId` (the block being renamed). Empty names are considered unique
 * (they're allowed; just not addressable).
 */
export function isNameUnique(
  candidate: string,
  selfId: string,
  blocks: Record<string, Block>,
): boolean {
  const trimmed = (candidate ?? '').trim();
  if (!trimmed) return true;
  for (const b of Object.values(blocks)) {
    if (b.id === selfId) continue;
    if ((b.name ?? '').trim() === trimmed) return false;
  }
  return true;
}

/** All currently-named blocks, sorted alphabetically — used by autocomplete. */
export function listNamedBlocks(
  blocks: Record<string, Block>,
): Array<{ id: string; name: string; type: string }> {
  return Object.values(blocks)
    .filter((b) => (b.name ?? '').trim().length > 0)
    .map((b) => ({ id: b.id, name: (b.name ?? '').trim(), type: b.type }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

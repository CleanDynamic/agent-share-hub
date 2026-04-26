/**
 * detectLanguage
 *
 * Cheap heuristics to guess the language of a code snippet so the user
 * doesn't have to pick it manually every time. The user can always override
 * via the dropdown.
 */

export type CodeLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'json'
  | 'html'
  | 'css'
  | 'sql'
  | 'shell'
  | 'markdown'
  | 'plaintext';

export const SUPPORTED_LANGUAGES: { value: CodeLanguage; label: string }[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'json', label: 'JSON' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'shell', label: 'Shell' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'plaintext', label: 'Plain text' },
];

export function detectLanguage(code: string): CodeLanguage {
  if (!code || !code.trim()) return 'plaintext';
  const head = code.slice(0, 2000);

  // Shebangs
  if (/^#!.*\bpython/m.test(head)) return 'python';
  if (/^#!.*\b(bash|sh|zsh)/m.test(head)) return 'shell';
  if (/^#!.*\bnode/m.test(head)) return 'javascript';

  // HTML
  if (/<!doctype html|<html[\s>]|<\/html>/i.test(head)) return 'html';

  // CSS — selector { prop: value; }
  if (/[#.\w-]+\s*\{[^}]*[a-z-]+\s*:/i.test(head) && !/function|=>/.test(head))
    return 'css';

  // JSON (must be a single value)
  const trimmed = code.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      /* fall through */
    }
  }

  // SQL
  if (/\b(select|insert|update|delete|create\s+table)\b/i.test(head))
    return 'sql';

  // Python — strong signals
  if (
    /^\s*def\s+\w+\s*\(/m.test(head) ||
    /^\s*import\s+\w+/m.test(head) ||
    /^\s*from\s+\w+\s+import\b/m.test(head) ||
    /\bprint\s*\(/.test(head) ||
    /^\s*if\s+__name__\s*==\s*['"]__main__['"]/m.test(head)
  )
    return 'python';

  // TypeScript — type annotations or interface/type keywords
  if (
    /\binterface\s+\w+\s*\{/.test(head) ||
    /\btype\s+\w+\s*=/.test(head) ||
    /:\s*(string|number|boolean|any|void|unknown)\b/.test(head)
  )
    return 'typescript';

  // JavaScript fallback signals
  if (
    /\b(console\.|=>|function\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|require\s*\()/.test(
      head,
    )
  )
    return 'javascript';

  // Markdown
  if (/^#{1,6}\s+\S/m.test(head) || /^\*\s+\S/m.test(head)) return 'markdown';

  return 'plaintext';
}

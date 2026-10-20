// CA-05 P3 — Started with: the command that opened a session, and the settings it names, read word for word.
//
// PURE. Only a `claude` command is read, and only four flags: `--model`, `--permission-mode`, `--worktree` and
// `--max-turns`. Anything else stays in the command, which is kept exactly as pasted. A flag whose value is not one
// this file knows is not put into words: it is shown in the command only. Nothing is guessed.

export interface CommandSetting {
  /** The setting in plain words: "Model: opus", "Allowed to: plan only", "Own copy of the code: fix-totals", "At most 3 turns". */
  line: string;
  /** What the flag was given: "opus", "plan", "fix-totals", "3". */
  value: string;
  /** The flag it was read from. */
  flag: string;
}

const PERMISSION_WORDS: Record<string, string> = {
  plan: "plan only",
  acceptEdits: "edit files",
  bypassPermissions: "ask for nothing",
};

/** Shell-like words: whitespace splits, single and double quotes group, a backslash escapes inside double quotes. */
export function commandWords(command: string): string[] {
  const out: string[] = [];
  let current = "";
  let started = false;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < command.length) current += command[++i];
      else current += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      started = true;
    } else if (/\s/.test(c)) {
      if (started || current) out.push(current);
      current = "";
      started = false;
    } else {
      current += c;
      started = true;
    }
  }
  if (started || current) out.push(current);
  return out;
}

/** Whether a command runs Claude Code: its first word, after any NAME=value words, is `claude` or a path ending in it. */
export function isClaudeCommand(command: string): boolean {
  const first = commandWords(command).find((word) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word));
  return Boolean(first && /(^|\/)claude$/.test(first));
}

const FLAGS = ["--model", "--permission-mode", "--worktree", "--max-turns"] as const;

/** The settings a command names that are read, in the order they were written. */
export function commandSettings(command: string): CommandSetting[] {
  if (!isClaudeCommand(command)) return [];
  const words = commandWords(command);
  const out: CommandSetting[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // A pipe, `;` or `&&` ends the command.
    if (/^(\||;|&&|\|\|)$/.test(word)) break;
    const flag = FLAGS.find((name) => word === name || word.startsWith(`${name}=`));
    if (!flag) continue;
    const inline = word.startsWith(`${flag}=`) ? word.slice(flag.length + 1) : null;
    const next = words[i + 1];
    const value = inline ?? (next !== undefined && !next.startsWith("-") ? next : null);
    if (inline === null && value !== null) i += 1;
    if (value === null || value === "") continue;
    if (flag === "--model") out.push({ line: `Model: ${value}`, value, flag });
    else if (flag === "--permission-mode") {
      const said = PERMISSION_WORDS[value];
      if (said) out.push({ line: `Allowed to: ${said}`, value, flag });
    } else if (flag === "--worktree") out.push({ line: `Own copy of the code: ${value}`, value, flag });
    else if (/^\d+$/.test(value) && Number(value) > 0) out.push({ line: `At most ${Number(value)} ${Number(value) === 1 ? "turn" : "turns"}`, value, flag });
  }
  return out;
}

/** The words under the command, in the order written. */
export const settingLines = (command: string): string[] => commandSettings(command).map((setting) => setting.line);

/** The name `--worktree` gave the session's own copy of the code, when the command names one. */
export const worktreeOf = (command: string): string | null => commandSettings(command).find((setting) => setting.flag === "--worktree")?.value ?? null;

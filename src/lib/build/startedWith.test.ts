// CA-05 P3 — Started with: each flag read, and an unknown one kept in the command and not put into words.

import { describe, expect, it } from "vitest";

import { commandWords, isClaudeCommand, settingLines, worktreeOf } from "./startedWith";

const lines = settingLines;

describe("each flag is read word for word", () => {
  it("--model", () => {
    expect(lines("claude --model opus")).toEqual(["Model: opus"]);
    expect(lines("claude --model=claude-opus-5-5 -p 'x'")).toEqual(["Model: claude-opus-5-5"]);
  });
  it("--permission-mode", () => {
    expect(lines("claude --permission-mode plan")).toEqual(["Allowed to: plan only"]);
    expect(lines("claude --permission-mode acceptEdits")).toEqual(["Allowed to: edit files"]);
    expect(lines("claude --permission-mode bypassPermissions")).toEqual(["Allowed to: ask for nothing"]);
  });
  it("--worktree", () => {
    expect(lines("claude --worktree fix-totals")).toEqual(["Own copy of the code: fix-totals"]);
    expect(worktreeOf("claude -p 'go' --worktree=fix-totals")).toBe("fix-totals");
    expect(worktreeOf("claude --model opus")).toBeNull();
  });
  it("--max-turns", () => {
    expect(lines("claude -p 'x' --max-turns 12")).toEqual(["At most 12 turns"]);
    expect(lines("claude --max-turns 1")).toEqual(["At most 1 turn"]);
  });
  it("keeps the order written, across quotes and env words", () => {
    expect(lines('CI=1 claude -p "fix the bug --model nope" --max-turns 3 --model sonnet')).toEqual(["At most 3 turns", "Model: sonnet"]);
  });
});

describe("what is not read", () => {
  it("keeps an unknown flag in the command only", () => {
    expect(lines("claude --verbose --output-format json --add-dir ../x")).toEqual([]);
  });
  it("does not put an unknown permission mode into words", () => {
    expect(lines("claude --permission-mode somethingNew")).toEqual([]);
    expect(lines("claude --permission-mode")).toEqual([]);
  });
  it("refuses a turn count that is not a whole number", () => {
    expect(lines("claude --max-turns lots")).toEqual([]);
    expect(lines("claude --max-turns 0")).toEqual([]);
  });
  it("reads nothing from another program's command", () => {
    expect(isClaudeCommand("npx tsx --model x")).toBe(false);
    expect(lines("codex --model gpt")).toEqual([]);
    expect(isClaudeCommand("/usr/local/bin/claude -p x")).toBe(true);
  });
  it("stops at the end of the command", () => {
    expect(lines("claude --model opus | tee out --max-turns 4")).toEqual(["Model: opus"]);
  });
  it("splits words like a shell", () => {
    expect(commandWords(`a 'b c' "d \\" e" f=g`)).toEqual(["a", "b c", 'd " e', "f=g"]);
  });
});

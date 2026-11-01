// SV-30 P10: one background session that sped up a virtual machine, with every fact a session can now record: its model and effort,
// a measurable goal, where it ran and what it could reach, a plugin, three prompts that were sent three ways, its compactions and
// messages, what it produced, a before and after measurement, three pieces of code that belong to different parts, and how much a
// human reviewed. Sample content written for this prompt.

import type { NodeTree } from "@/lib/build/types";

import { fixtureNode as node } from "../deployment/node";

const S = "typed-sdlc-fixture-0001";

export const sessionsSdlcTree: NodeTree[] = [
  node("sd-p1", 0, "prompt", { session: S, text: "Make the VM twice as fast on the boot benchmark. Keep every existing test passing.", asks_for: "outcome", settings: { model: "Claude Opus 4.5", effort: "high", instructions: "" } }, "Make the VM 2x faster"),
  node("sd-p2", 1, "prompt", { session: S, text: "Continue the VM speed-up. Check where you stopped, then carry on from there.", sent_by: "agent_wakeup", asks_for: "outcome" }, "Pick the work back up"),
  node("sd-p3", 2, "prompt", { session: S, text: "Run the boot benchmark and post the numbers to the thread. Stop if it is slower than last time.", sent_by: "heartbeat", interval: "daily 09:00", asks_for: "procedure" }, "Daily benchmark"),
  node("sd-k1", 3, "eval_run", {
    session: S,
    tested: "Boot time of the VM image on the benchmark machine",
    passing: "Boot time at or under half the baseline",
    passed: 20,
    total: 20,
    method: "automated",
    reviewer: "you",
    evidence: { kind: "measurement", measurement: { metric: "Boot time", unit: "ms", before: 120, after: 58, runs: 20 } },
  }, "Boot benchmark"),
  node("sd-c1", 4, "code", { session: S, language: "ts", filename: "vm/boot.ts", source: "export function boot(image: Image): Machine {\n  return fastBoot(image);\n}", part_of: "app" }, "Boot path"),
  node("sd-c2", 5, "code", { session: S, language: "bash", filename: "bench/run.sh", source: "npm run bench -- --runs 20 --compare baseline.json", part_of: "eval_harness", runs_where: "Terminal 2, in the harness folder" }, "Run the benchmark"),
  node("sd-c3", 6, "code", { session: S, language: "yaml", filename: ".github/workflows/bench.yml", source: "on: [pull_request]\njobs:\n  bench:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm run bench", part_of: "ci", runs_where: "GitHub Actions" }, "Benchmark in CI"),
  // The session's plugin: its install line, never its files.
  node("sd-s1", 7, "code", {
    source: "/plugin install perf-tools@acme-marketplace",
    language: "bash",
    setup: { session: S, kind: "plugin", loaded: "start" },
    plugin: { name: "perf-tools", source: "acme-marketplace", contains: ["commands", "hooks"], install: "/plugin install perf-tools@acme-marketplace" },
  }),
];

export const sessionsSdlcMaking = {
  sessions: [],
  session_order: [S],
  sessions_meta: {
    [S]: {
      tool: "claude-code",
      date: "2026-10-30",
      model: "Claude Opus 4.5",
      model_id: "claude-opus-4-5-20251101",
      effort: "high",
      background: true,
      goal: { condition: "VM 2x faster", reached: "reached", turns: 212, target: { metric: "VM speed", unit: "x", baseline: 1, target: 2, achieved: 2.1, source: "maker" } },
      environment: "cloud_sandbox",
      isolation: "worktree",
      can_install: true,
      access: [
        { system: "code", scope: "write" },
        { system: "tests", scope: "write" },
        { system: "run_app", scope: "write" },
        { system: "prod_logs", scope: "read" },
        { system: "deploy", scope: "write" },
        { system: "feature_flags", scope: "write" },
        { system: "issues", scope: "write" },
      ],
      messages: 3714,
      compactions: 2,
      outputs: [
        { kind: "commit", repo: "https://github.com/acme/vm", sha: "a1b2c3d" },
        { kind: "commit", repo: "https://github.com/acme/vm", sha: "e4f5a6b7c8" },
        { kind: "commit", repo: "https://github.com/acme/vm", sha: "0123abc4567" },
        { kind: "pull_request", url: "https://github.com/acme/vm/pull/482" },
      ],
      showOutputs: true,
      review: { scope: "high_blast_radius", files: ["vm/boot.ts", "db/migrations/0042_boot_cache.sql"] },
    },
  },
};

// SV-27 P14: a self-hosted model stack. Sample content only: every name and figure here is invented.
//
// One session; a team using the handoff pattern, built in code with LangGraph; a model run (Qwen 32B, Q4_K_M, GGUF, llama.cpp, a
// draft model, split by layers); a workstation with 2 × RTX 5090 (32 GB each), always on, with a setup cost; an Ollama inference
// server, OpenAI-compatible, on the private network; Grafana monitoring; Stripe usage-based billing per 1M tokens; an API estimate
// of £20 a month, and a measured speed on a Result.

import { refOf } from "@/lib/build/deployment";
import type { NodeTree } from "@/lib/build/types";

import { fixtureNode as node } from "./node";

const S = "fx-self-s1";
const RUN = { precision: "Q4_K_M", weights_format: "GGUF", parameters: "32B", context_length: 32768, engine: "llama-cpp", draft_model: "Qwen 0.5B", split: "by layers", server: "sh-s1", host: "sh-h1" };

export const selfHostedTree: NodeTree[] = [
  node("sh-t1", 0, "team", { session: S, pattern: "handoff", framework: "langgraph", api_estimate: { amount: 20, per: "month" } }, "Support swarm", [
    node("sh-a1", 0, "agent_config", { model: "qwen2-5", modelRun: RUN, role: "Triage" }, "Triage"),
    node("sh-a2", 1, "agent_config", { model: "qwen2-5", modelRun: RUN, role: "Resolver" }, "Resolver"),
  ]),
  node("sh-r1", 1, "result", { session: S, summary: "Answers in under a second", measured: { tokens_per_second: 92, time_to_first_token_ms: 240 } }),
  node("sh-h1", 2, "host", { machine: "workstation", name: "Workstation", always_on: true, gpus: [{ model: "RTX 5090", count: 2, vram_gb: 32 }], setup_cost: 4200, agent: "sh-t1", connects: [] }),
  node("sh-s1", 3, "inference_server", { provider: "ollama", api: "OpenAI-compatible", reach: "private network", serves: [{ tile: "sh-a1", model: "Qwen 32B" }], agent: "sh-t1", connects: [{ to: refOf("sh-h1"), label: "runs on" }] }),
  node("sh-g1", 4, "monitoring", { provider: "grafana", measures: ["tokens per second", "latency", "GPU use"], tags: ["customer", "harness"], test_traffic_tagged: true, agent: null, connects: [{ to: refOf("sh-t1"), label: "watches" }] }),
  node("sh-b1", 5, "billing", { provider: "stripe", model: "usage-based", unit: "1M tokens", charges: "the agent's users", agent: "sh-t1", connects: [] }),
];

export const selfHostedMaking = { session_order: [S], sessions_meta: { [S]: { tool: "claude-code", date: "2026-10-22" } } };

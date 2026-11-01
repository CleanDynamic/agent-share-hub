// SV-27 P14: a team of agents run by a chief of staff. Sample content only: every name and figure here is invented.
//
// One session; a group chat team with Hermes Agent as harness; three agents (Researcher, Writer, Reviewer), each with its own model
// and Memory tile; Approvals `reviewer` with a reviewer model, Sandbox `container`; How did it run? `ongoing`; a skill written by
// the agent and one from ClawHub; Slack and GitHub with Read and write, Gmail Read only; a knowledge base in Obsidian synced with
// git, read by all three, with two notes; a relay on Tailscale that queues; the Reviewer's model routing; a paid partnership.

import type { NodeTree } from "@/lib/build/types";

import { fixtureNode as node } from "./node";

const S = "fx-team-s1";
const shared = { harness: "hermes-agent", approval_mode: "reviewer", reviewer_model: "haiku-5-5", sandbox: "container", tools: ["slack", "github", "gmail"], tool_permissions: { slack: "write", github: "write", gmail: "read" } };

export const agentTeamTree: NodeTree[] = [
  node("at-t1", 0, "team", { session: S, pattern: "group", runs: { how: "ongoing", detail: "Keep the launch post on track" } }, "Launch team", [
    node("at-a1", 0, "agent_config", { ...shared, model: "opus-5-5", role: "Researcher" }, "Researcher"),
    node("at-a2", 1, "agent_config", { ...shared, model: "sonnet-5-5", role: "Writer" }, "Writer"),
    node("at-a3", 2, "agent_config", { ...shared, model: "qwen2-5", role: "Reviewer", model_routing: { mode: "maker_switches", rule: "cheapest open model that week" } }, "Reviewer"),
  ]),
  node("at-m1", 1, "memory", { provider: "mem0", keeps: "What the researcher found", agent: "at-a1", tagged_by_agent: true, review_after_days: 90, connects: [] }),
  node("at-m2", 2, "memory", { provider: "mem0", keeps: "Drafts and feedback", agent: "at-a2", tagged_by_agent: true, connects: [] }),
  node("at-m3", 3, "memory", { provider: "mem0", keeps: "What was approved", agent: "at-a3", tagged_by_agent: true, connects: [] }),
  node("at-kb", 4, "knowledge_base", {
    format: "markdown files",
    app: "obsidian",
    sync: "git",
    written_by: "the maker",
    read_by: ["at-a1", "at-a2", "at-a3"],
    notes: [
      { name: "voice", purpose: "How the business writes", template: "Short sentences. No jargon." },
      { name: "clients", purpose: "Who we work for", template: "{client_name} pays monthly." },
    ],
    agent: null,
    connects: [],
  }),
  node("at-r1", 5, "relay", { joins: ["at-a1", "at-a2", "at-a3"], provider: "Agent Tincan", network: "tailscale", queues: true, identifies_by: "network identity", connects: [] }),
  node("at-k1", 6, "document", { title: "release-notes", setup: { agent: "at-a2", kind: "skill" }, skill: { name: "release-notes" }, origin: "agent" }),
  node("at-k2", 7, "document", { title: "email-triage", setup: { agent: "at-a1", kind: "skill" }, skill: { name: "email-triage" }, origin: "registry", registry: "ClawHub", skill_name: "email-triage" }),
];

export const agentTeamMaking = { session_order: [S], sessions_meta: { [S]: { tool: "hermes-agent", date: "2026-10-25" } }, partnership: { partner: "Example Partner", kind: "paid" } };

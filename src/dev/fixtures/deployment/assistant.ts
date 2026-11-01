// SV-27 P14: a personal assistant agent, assembled in nine steps. Sample content only: every name and figure here is invented.
//
// One session and one agent (OpenClaw, Claude Opus used, GPT and Gemini as compatible models); a Mac Mini host, always on; Letta
// memory; Telegram and WhatsApp channels that start runs; ElevenLabs text-to-speech; a front end built with Claude Design; a context
// file template with {your_name}, {your_business} and {your_clients}; three skills; Gmail and Google Calendar MCP servers. How did
// it run? is background, with both channels; Approvals are left unset, so Before you copy shows OpenClaw's default when its docs
// give one.

import { refOf } from "@/lib/build/deployment";
import type { NodeTree } from "@/lib/build/types";

import { fixtureNode as node } from "./node";

const S = "fx-assistant-s1";

export const assistantTree: NodeTree[] = [
  node("as-p1", 0, "prompt", { text: "Set up my assistant on the Mac Mini.", session: S }),
  node("as-a1", 1, "agent_config", {
    session: S,
    harness: "openclaw",
    model: "opus-5-5",
    compatible_models: ["GPT", "Gemini"],
    system_prompt: "You are {your_name}'s assistant.",
    tools: ["gmail", "google-calendar"],
    runs: { how: "background", detail: "messages on Telegram and WhatsApp", channels: ["as-c1", "as-c2"] },
  }, "Assistant"),
  node("as-h1", 2, "host", { machine: "mini PC", name: "Mac Mini", always_on: true, agent: "as-a1", made_in: S, connects: [] }),
  node("as-m1", 3, "memory", { provider: "letta", keeps: "Clients, projects and what was agreed", lives: "cloud", starts: "empty", tagged_by_agent: false, agent: "as-a1", connects: [] }),
  node("as-c1", 4, "channel", { provider: "telegram", direction: "both", starts_runs: true, agent: "as-a1", connects: [] }),
  node("as-c2", 5, "channel", { provider: "whatsapp", direction: "both", starts_runs: true, agent: "as-a1", connects: [] }),
  node("as-v1", 6, "voice", { provider: "elevenlabs", mode: "tts", agent: "as-a1", connects: [] }),
  node("as-f1", 7, "live_app", { front_end_of: "as-a1", agent: "as-a1", built_with: "claude-design", url: "https://assistant.example.com", connects: [{ to: refOf("as-a1"), label: "sends to" }] }),
  node("as-i1", 8, "document", { title: "AGENTS.md", setup: { agent: "as-a1", kind: "instructions" }, not_shared: true, template: "I am {your_name}. I run {your_business} for {your_clients}.", variables: [{ name: "your_name", description: "Your first name" }, { name: "your_business", description: "Your business" }, { name: "your_clients", description: "Who you work for" }] }),
  node("as-k1", 9, "document", { title: "inbox-zero", setup: { agent: "as-a1", kind: "skill" }, skill: { name: "inbox-zero", description: "Sorts the inbox" }, origin: "maker" }),
  node("as-k2", 10, "document", { title: "meeting-prep", setup: { agent: "as-a1", kind: "skill" }, skill: { name: "meeting-prep" }, origin: "maker" }),
  node("as-k3", 11, "document", { title: "weekly-review", setup: { agent: "as-a1", kind: "skill" }, skill: { name: "weekly-review" }, origin: "agent" }),
  node("as-g1", 12, "integration", { service: "gmail", setup: { agent: "as-a1", kind: "server" }, server: { type: "stdio", command: "npx", args: ["gmail-mcp"], env: { GMAIL_TOKEN: "${GMAIL_TOKEN}" } } }),
  node("as-g2", 13, "integration", { service: "google-calendar", setup: { agent: "as-a1", kind: "server" }, server: { type: "stdio", command: "npx", args: ["calendar-mcp"], env: { GOOGLE_TOKEN: "${GOOGLE_TOKEN}" } } }),
];

export const assistantMaking = { session_order: [S], sessions_meta: { [S]: { tool: "claude-code", date: "2026-10-20" } } };

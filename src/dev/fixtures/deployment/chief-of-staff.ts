// SV-28 P9: a chief of staff and three specialists. Sample content written for this prompt: every name, sentence and figure here is
// invented, and none is taken from an article or a post.
//
// A team using the lead pattern: a Chief of staff who takes requests in Slack (a Channel tile) and hands work to Research, Sales and
// Operations. Team instructions mention all three. Jobs: Research delivers a report to Google Drive; Sales a draft to Gmail, approved
// first; Operations a sheet to Google Sheets. Sales has output rules and follows one published guide. An Approval step (the maker
// approves the client email draft) blocks the step after it. A knowledge base of markdown notes in Obsidian, synced with git, with
// three templates; a shared Memory (Mem0) tagged by agent, reviewed after 90 days; a relay on Tailscale that queues. Two trust
// boundary crossings: Research reads Gmail and hands work to Operations with no approval on that handoff, and Operations reads Slack
// and can send in it. An example run of five entries, and a paid partnership with "Example Partner".

import type { NodeTree } from "@/lib/build/types";

import { fixtureNode as node } from "./node";

const S = "fx-cos-s1";
const base = { harness: "claude-code", approval_mode: "risky", sandbox: "container" };

export const chiefOfStaffTree: NodeTree[] = [
  node("cs-p1", 0, "prompt", { text: "Set up a chief of staff for the agency, with three specialists.", session: S }),
  node(
    "cs-t1",
    1,
    "team",
    {
      session: S,
      pattern: "lead",
      runs: { how: "event", detail: "A request arrives in Slack", channels: ["cs-c1"] },
      system_prompt: "The Chief of staff reads each request and passes it to one specialist: market questions to @Research, client emails to @Sales, and sheets or schedules to @Operations. Every agent writes for {agency_name} and keeps its notes in the shared folder.",
      example_run: [
        { agent: "cs-a0", did: "Read a request for a client follow-up", passed_on: "The request" },
        { agent: "cs-a1", did: "Pulled the client's last three emails", passed_on: "A short brief" },
        { agent: "cs-a3", did: "Drafted the follow-up email", passed_on: "The draft" },
        { agent: "cs-a1", did: "Found the open deal in the inbox", passed_on: "The deal details" },
        { agent: "cs-a2", did: "Added the deal to the pipeline sheet", passed_on: "The updated sheet" },
      ],
    },
    "Agency team",
    [
      node("cs-a0", 0, "agent_config", { ...base, model: "opus-5-5", role: "Chief of staff", system_prompt: "Read each request, decide who does it, and say back who has it.", handoffs: [{ to: "cs-a1", when: "it needs research" }, { to: "cs-a3", when: "it needs a client email" }, { to: "cs-a2", when: "it needs a sheet updated" }] }, "Chief of staff"),
      node(
        "cs-a1",
        1,
        "agent_config",
        { ...base, model: "sonnet-5-5", role: "Research", system_prompt: "Find what the request needs from the inbox and the web, and cite where each fact came from.", tools: ["gmail"], tool_permissions: { gmail: "read" }, handoffs: [{ to: "cs-a2", when: "a deal needs adding to the pipeline" }] },
        "Research",
        [node("cs-a1p", 0, "prompt", { text: "Write this week's market report for {agency_name}.", deliverable: { kind: "report", name: "Weekly market report" }, destination: "Google Drive, Research folder" }, "Weekly market report")],
      ),
      node(
        "cs-a2",
        2,
        "agent_config",
        { ...base, model: "haiku-5-5", role: "Operations", system_prompt: "Keep the pipeline sheet and the team's schedule up to date.", tools: ["slack", "google-sheets"], tool_permissions: { slack: "write", "google-sheets": "write" } },
        "Operations",
        [node("cs-a2p", 0, "prompt", { text: "Update the pipeline sheet with this week's deals.", deliverable: { kind: "sheet", name: "Weekly pipeline sheet" }, destination: "google-sheets" }, "Pipeline sheet")],
      ),
      node(
        "cs-a3",
        3,
        "agent_config",
        {
          ...base,
          model: "sonnet-5-5",
          role: "Sales",
          system_prompt: "Draft replies to clients in the agency's voice.",
          tools: ["gmail"],
          tool_permissions: { gmail: "write" },
          output_rules: ["Drafts only, never send", "One question per email"],
          rules_followed: [{ text: "Plain English guide", url: "https://www.plainenglish.example/guide" }],
        },
        "Sales",
        [node("cs-a3p", 0, "prompt", { text: "Draft a follow-up to {client_name} about the proposal.", deliverable: { kind: "draft", name: "Client follow-up email" }, destination: "gmail", needs_approval: true }, "Client follow-up")],
      ),
    ],
  ),
  node("cs-g1", 2, "manual_step", { session: S, gate: { approves: "The client email draft", by: "maker", blocks: ["cs-p2"], reason: "Every client email is read by a person first" } }),
  node("cs-p2", 3, "prompt", { text: "Send the approved email from your own inbox.", session: S }),
  node("cs-c1", 4, "channel", { provider: "slack", direction: "both", starts_runs: true, agent: "cs-a0", connects: [] }),
  node("cs-kb", 5, "knowledge_base", {
    format: "markdown files",
    app: "obsidian",
    sync: "git",
    written_by: "both",
    read_by: [],
    notes: [
      { name: "voice", purpose: "How the agency writes", template: "Short sentences. Name the next step. Sign off as {sender_name}." },
      { name: "clients", purpose: "Who the agency works for", template: "{client_name}: what they buy, who decides, when they last heard from us." },
      { name: "pipeline", purpose: "Deals in progress", template: "{deal_name}, worth {deal_value}, next step on {next_date}." },
    ],
    agent: null,
    connects: [],
  }),
  node("cs-m1", 6, "memory", { provider: "mem0", keeps: "Requests, who took them and what came of them", lives: "cloud", starts: "empty", tagged_by_agent: true, review_after_days: 90, agent: null, connects: [] }),
  node("cs-r1", 7, "relay", { joins: ["cs-a0", "cs-a1", "cs-a2", "cs-a3"], provider: "", network: "tailscale", queues: true, identifies_by: "network identity", connects: [] }),
];

export const chiefOfStaffMaking = { session_order: [S], sessions_meta: { [S]: { tool: "claude-code", date: "2026-10-30" } }, partnership: { partner: "Example Partner", kind: "paid" } };

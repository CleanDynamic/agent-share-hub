// CA-15: the draft the screenshots are taken of, written into the CA-09 stand-in over its REST door.
//   One session, typed here, holding one tile of every kind: a prompt with a response, an agent with a prompt of its own, a
//   multi-agent team, code, a check, a manual step, a file, a tool, a decision, a system prompt, a dataset and a GitHub repository.
// Prints the draft's id. Run after `standin.sh start`; `--reset` first puts the stand-in's data back.
import { randomUUID } from "node:crypto";
import { API, resetData, session } from "../../ca-09/scripts/lib.mjs";

const tokens = (await session()).access_token;
const headers = { "content-type": "application/json", apikey: "ca09-publishable-placeholder", authorization: `Bearer ${tokens}`, prefer: "return=representation" };
const post = async (table, rows) => {
  const res = await fetch(`${API}/rest/v1/${table}`, { method: "POST", headers, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
};

if (process.argv.includes("--reset")) await resetData();

const typed = `typed-${randomUUID()}`;
const [build] = await post("builds", [{ id: randomUUID(), creator_id: "0b0b0b0b-0000-4000-8000-000000000001", slug: `ca15-${Date.now()}`, title: "Support inbox helper", status: "draft", shape: "other", made_for: [], made_with: [], making: { sessions_meta: { [typed]: { tool: "claude", date: new Date().toISOString().slice(0, 10) } } } }]);

let at = 0;
const node = (type, payload, extra = {}) => ({ id: randomUUID(), build_id: build.id, parent_id: null, position: at++, type, title: null, payload: { session: typed, ...payload }, ...extra });
const agentId = randomUUID();
const teamId = randomUUID();
const nodes = [
  node("prompt", { text: "Write a reply to {customer} about the late order, in the brand voice, and keep it under 80 words.", tool: "claude", model: "claude-sonnet-5-5", reply: "Hi Sam, I'm sorry your order is late. It leaves the warehouse today and you will have it by Friday." }, { title: "Late order reply" }),
  node("system_prompt", { step: true, text: "You write in plain British English. Never use buzzwords. Sign off with the team's first name.", scope: "all", version: "v2" }, { title: "Brand voice" }),
  { ...node("agent_config", { system_prompt: "Read each new support email, label it, and draft a reply for a person to approve.", model: "claude-opus-5-5", tools: [{ tool_ref: "t1" }], limits: ["Never sends a reply without approval"] }, { title: "Triage agent" }), id: agentId },
  node("prompt", { text: "Also flag any email that mentions a refund." }, { title: "Refund flag", parent_id: agentId }),
  { ...node("team", { pattern: "review" }, { title: "Reply writers" }), id: teamId },
  node("agent_config", { system_prompt: "Draft the reply.", model: "claude-opus-5-5" }, { title: "Writer", parent_id: teamId }),
  node("agent_config", { system_prompt: "Check the tone and the facts.", model: "claude-sonnet-5-5" }, { title: "Reviewer", parent_id: teamId }),
  node("code", { source: "export function route(email) {\n  if (email.subject.includes(\"refund\")) return \"billing\";\n  return \"support\";\n}\n", language: "ts", filename: "src/route.ts" }, { title: "Router" }),
  node("eval_run", { tested: "Routes 40 sample emails", passing: "Every refund email goes to billing", passed: 40, total: 40, run_at: "2026-10-15", method: "automated", cases: [{ input: "Refund please", expected: "billing", actual: "billing", passed: true }, { input: "Where is my order", expected: "support", actual: "support", passed: true }] }, { title: "Routing check" }),
  node("manual_step", { text: "Ask the support lead to approve the first ten replies.\nCopy the approved replies into the helpdesk.\nNote any that needed changes." , tool: "figma" }, { title: "Approve the first replies" }),
  node("document", { step: true, title: "style-guide.md", size: 2048, preview: ["# Style guide", "Short sentences.", "No jargon."] }),
  node("integration", { step: true, service: "Slack", connection: "mcp", scopes: "Posted the approved replies to #support", permissions: "write", plan: "Pro plan" }),
  node("decision", { provider: "typesafe-jev", model: "jev-1.13.0", questions: [{ id: "team", type: "choice", instructions: "Which team owns this email?", options: [{ key: "billing" }, { key: "support" }] }, { id: "urgent", type: "yesno", instructions: "Is it urgent?" }], answer: { team: { value: "billing", probabilities: { billing: 0.92, support: 0.08 } }, urgent: { value: 0.18 } }, source: "run" }, { title: "Which team" }),
  node("dataset", { step: true, description: "1,200 anonymised support emails from 2025, labelled by team", use: "evaluation", format: "CSV", columns: ["email_id", "subject", "team"], record_count: 1200, licence: "CC BY 4.0" }, { title: "Support emails" }),
  node("repo", { step: true, url: "https://github.com/acme/helpdesk-router", ownership: "third_party", description: "The helpdesk router this build started from", usage: ["copied", "docs"], language: "TypeScript", licence_spdx: "MIT", licence_name: "MIT License", pushed_at: "2026-09-01T00:00:00Z", fetched_at: "2026-10-07T09:00:00Z", author: "acme" }),
];
await post("build_nodes", nodes);
await post("build_sessions", [{ build_id: build.id, session_key: typed, import_id: null, position: 0, collapsed: false }]);
console.log(build.id);

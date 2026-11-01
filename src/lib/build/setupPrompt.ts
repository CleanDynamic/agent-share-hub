// SV-28 Part 7: the setup prompt. One plain-text instruction a reader gives their own harness to recreate an agent or a team,
// assembled from the tiles' fields by this pure function. No model call: the same build gives the same text.
//
// The text runs in a fixed order (Harness, Model, Instructions, Context file, Skills, MCP servers, Tools, Output rules, Rules
// followed, Jobs, Knowledge base, Deployment, How it runs, Approvals and sandbox, Limits, Team, Approvals between steps, Example
// run, Before you run, Fill in). A section with nothing to say is left out. Every line is a sentence in the imperative.
//
// NOTHING PRIVATE. A Not shared item is left out whole. A secret is named as `${NAME}`, never its value. No deployment address,
// port or key, and no front end URL: those fields are never read. Template variables stay `{name}` and are listed under Fill in.
//
// A vendor-hosted harness (`facts.hosting: "vendor"`) takes only the goal, the tools and the approvals; files, skills and MCP
// servers do not carry over and are listed in `notCarried`. A target harness (Part 8) renames the files after its entry and lists
// each field it has no documented equivalent for.

import { toolFor, toolName } from "@/lib/tools/registry";
import { modelLabel } from "@/lib/models/registry";

import { APPROVAL_MODES, agentFieldsOf, type ApprovalMode, type Sandbox } from "./agentFields";
import { deploymentTilesOf, providerName, type DeploymentTile } from "./deployment";
import { buildSteps, type Step } from "./graph";
import { FIELD_WORDS, harnessEntry, notCarriedLine, skillFolder, type HarnessEntry } from "./harnessMap";
import { precisionWord } from "./modelRun";
import { hasPipelineSetup, pipelineSections } from "./pipelineSetup";
import { originNote } from "./promptOrigin";
import { pluginInstallLine, setupItemsOf, type SetupItem } from "./setup";
import {
  DELIVERABLE_ARTICLE,
  MAKER,
  agentLabel,
  exampleRunOf,
  gateOf,
  handoffsOf,
  jobOf,
  outputRulesOf,
  rulesFollowedOf,
  workspaceOf,
  type TeamNode,
} from "./teamFields";
import { variableNamesIn, variablesOf, type PromptVariable } from "./tileExtras";
import { crossingNames, sendsIn, trustBoundaryOf } from "./trustBoundary";
import type { BuildRecord, NodeTree } from "./types";

export type AgentOrTeam = string | { id: string };

export interface SetupPrompt {
  text: string;
  variables: PromptVariable[];
  secrets: string[];
  notCarried: string[];
}

export const SETUP_PROMPT_COPY = {
  copy: "Copy setup prompt",
  copied: "Setup prompt copied",
  show: "Show setup prompt",
  needsInstructions: "Add instructions first",
  title: "Setup prompt",
  characters: (n: number) => `${n.toLocaleString("en-GB")} characters`,
} as const;

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const flat = (nodes: readonly NodeTree[]): NodeTree[] => nodes.flatMap((node) => [node, ...flat(node.children ?? [])]);
const payloadOf = (node: Pick<NodeTree, "payload"> | undefined): Raw => (node && isRecord(node.payload) ? node.payload : {});
const sentence = (line: string): string => {
  const said = line.trim();
  return said && !/[.!?:]$/.test(said) ? `${said}.` : said;
};
const lowerFirst = (line: string): string => (/^([A-Z][a-z]|A\b)/.test(line) && !/^[A-Z][a-z]*[A-Z]/.test(line) ? line.charAt(0).toLowerCase() + line.slice(1) : line);
const join = (names: readonly string[]): string => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const count = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/** A block fenced longer than any run of backticks inside it, so the text appears whole. */
function fence(body: string): string {
  const longest = Math.max(2, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const marks = "`".repeat(longest + 1);
  return `${marks}\n${body}\n${marks}`;
}

/** Whether a harness is hosted by its vendor (from its registry facts, SV-27 Part 8). */
export const isVendorHosted = (harness: string | null | undefined): boolean => toolFor(harness)?.facts?.hosting === "vendor";

const PERMISSION_WORDS: Record<string, string> = { read: "read only", write: "read and write", delegated: "acting as you" };
const APPROVAL_WORDS: Record<ApprovalMode, string> = { full: "Let it act without asking", risky: "Ask before risky actions", every: "Ask before every action", reviewer: "Have an AI reviewer check each action, and ask a person when it is unsure" };
const SANDBOX_WORDS: Record<Sandbox, string> = { none: "Run commands directly on the host, with no sandbox", container: "Run commands in a container", vm: "Run commands in a virtual machine", vendor: "Run it in the vendor's cloud" };
const PATTERN_WORDS: Record<string, string> = {
  sequential: "that work one after another",
  lead: "led by the first, who hands work to the others",
  parallel: "that work at the same time, then merge their work",
  review: "where one writes and another reviews",
  handoff: "that hand work to each other",
  group: "that talk in one group chat",
};
const VOICE_WORDS: Record<string, (name: string) => string> = {
  tts: (name) => `Speak replies with ${name} (text-to-speech)`,
  stt: (name) => `Listen to voice messages with ${name} (speech-to-text)`,
  "speech-to-speech": (name) => `Talk out loud with ${name} (speech-to-speech)`,
};

/** A tile's deployment tiles: its own, its agents', and those of the whole build. */
function tilesFor(tiles: readonly DeploymentTile[], ids: readonly string[]): DeploymentTile[] {
  return tiles.filter((tile) => {
    const p = tile.payload as unknown as Raw;
    if (tile.kind === "relay") return (p.joins as string[]).some((id) => ids.includes(id));
    if (tile.kind === "knowledge_base") return (p.read_by as string[]).length === 0 || (p.read_by as string[]).some((id) => ids.includes(id));
    const owner = tile.kind === "front_end" ? str(p.front_end_of) : str(p.agent);
    return !owner || ids.includes(owner);
  });
}

/** An agent's Available tools as tool ids, with an integration node read through its service. */
function toolsOf(payload: Raw, all: readonly NodeTree[]): string[] {
  const raw = Array.isArray(payload.tools) ? payload.tools : [];
  return [
    ...new Set(
      raw.flatMap((entry) => {
        if (typeof entry === "string" && entry.trim()) return [entry.trim()];
        const ref = isRecord(entry) ? str(entry.tool_ref) : "";
        const service = ref ? str(payloadOf(all.find((node) => node.id === ref)).service) : "";
        return service ? [service] : [];
      }),
    ),
  ];
}

/** "Connect Slack (read and write) and Gmail (read only)." */
function toolsLine(payload: Raw, all: readonly NodeTree[]): string | null {
  const tools = toolsOf(payload, all);
  if (tools.length === 0) return null;
  const permissions = isRecord(payload.tool_permissions) ? payload.tool_permissions : {};
  return `Connect ${join(tools.map((tool) => `${toolName(tool) ?? tool}${PERMISSION_WORDS[str(permissions[tool])] ? ` (${PERMISSION_WORDS[str(permissions[tool])]})` : ""}`))}.`;
}

/** A destination as said: a tool's name, or the place as typed. */
const destinationName = (destination: string, all: readonly NodeTree[]): string => {
  const node = all.find((entry) => entry.id === destination);
  const service = node ? str(payloadOf(node).service) : "";
  return service ? (toolName(service) ?? service) : (toolName(destination) ?? destination);
};

interface Collect {
  variables: Map<string, string>;
  secrets: string[];
  notCarried: string[];
}

const noteVariables = (into: Collect, text: string, described: readonly PromptVariable[] = []) => {
  for (const name of variableNamesIn(text)) {
    const said = described.find((entry) => entry.name === name)?.description ?? "";
    if (!into.variables.has(name) || (!into.variables.get(name) && said)) into.variables.set(name, said);
  }
};
const noteSecret = (into: Collect, name: string) => {
  if (name && !into.secrets.includes(name)) into.secrets.push(name);
};

/** The model, how it was run, and the models the maker says it also works with. */
function modelLines(node: NodeTree, all: readonly NodeTree[], tiles: readonly DeploymentTile[]): string[] {
  const p = payloadOf(node);
  const model = modelLabel(str(p.model));
  if (!model) return [];
  const run = isRecord(p.modelRun) ? p.modelRun : null;
  const server = run && str(run.server) ? tiles.find((tile) => tile.id === str(run.server) && tile.kind === "inference_server") : undefined;
  const engine = run && str(run.engine) ? (toolName(str(run.engine)) ?? str(run.engine)) : "";
  const parts = [run && str(run.parameters) ? `${model} ${str(run.parameters)}` : model, run && str(run.precision) ? precisionWord(str(run.precision)) : null, run && str(run.weights_format) ? str(run.weights_format) : null].filter(Boolean);
  const servedBy = server ? `served by ${providerName(str((server.payload as unknown as Raw).provider))}${str((server.payload as unknown as Raw).api) ? ` (${str((server.payload as unknown as Raw).api)} API)` : ""}` : engine ? `run with ${engine}` : null;
  const lines = [`Model: ${parts.join(", ")}${servedBy ? `, ${servedBy}` : ""}.`];
  const also = agentFieldsOf(p).compatibleModels ?? [];
  if (also.length > 0) lines[0] += ` The maker reports it also works with ${join(also)}.`;
  return lines;
}

/** The harness line: "Use OpenClaw on an always-on machine (Mac Mini)." / "Build it in code with LangGraph." */
function harnessLine(node: NodeTree, tiles: readonly DeploymentTile[], entry: HarnessEntry | null): string | null {
  const p = payloadOf(node);
  const host = tiles.find((tile) => tile.kind === "host");
  const hostPayload = host ? (host.payload as unknown as Raw) : null;
  const where = hostPayload ? ` on ${hostPayload.always_on === true ? "an always-on machine" : "a machine"}${str(hostPayload.name) ? ` (${str(hostPayload.name)})` : ""}` : "";
  const harness = entry?.name ?? (str(p.harness) ? (toolName(str(p.harness)) ?? str(p.harness)) : "");
  if (harness) return `Use ${harness}${where}.`;
  const framework = str(p.framework);
  if (framework || p.built_in_code === true) return `Build it in code${framework ? ` with ${toolName(framework) ?? framework}` : ""}${where}.`;
  return where ? `Run it${where}.` : null;
}

/**
 * Setup items an agent owns, without anything Not shared. A context file made into a template is the exception: its template is
 * what is shared (SV-27 P6), never the original, which is not read here.
 */
const ownItems = (tree: readonly NodeTree[], ids: readonly string[]): SetupItem[] => setupItemsOf(tree as NodeTree[]).filter((item) => item.agent && ids.includes(item.agent) && (!item.notShared || (item.kind === "instructions" && Boolean(item.template))));

function fileSections(items: readonly SetupItem[], entry: HarnessEntry | null, into: Collect): string[] {
  const out: string[] = [];
  for (const item of items.filter((candidate) => candidate.kind === "instructions" && candidate.template)) {
    const file = entry ? entry.contextFile : item.name;
    if (!file) {
      if (entry && !into.notCarried.includes(notCarriedLine("contextFile", entry))) into.notCarried.push(notCarriedLine("contextFile", entry));
      continue;
    }
    out.push(`Create ${file} with this content:\n\n${fence(item.template ?? "")}`);
    noteVariables(into, item.template ?? "", item.variables);
  }
  const skills = items.filter((candidate) => candidate.kind === "skill");
  if (skills.length > 0) {
    if (entry && !entry.skillsDir) into.notCarried.push(notCarriedLine("skillsDir", entry));
    else
      out.push(
        skills
          .map((skill) =>
            skill.origin === "registry"
              ? `Install the skill ${skill.skillName ?? skill.name} from ${skill.registry ?? "its registry"}.`
              : `Add the skill ${skill.name}${entry ? ` in ${skillFolder(entry, skill.name)}` : ""}${skill.description ? `: ${lowerFirst(sentence(skill.description))}` : "."}`,
          )
          .join("\n"),
      );
  }
  // SV-30 P5: a plugin is its install line, never its files.
  const plugins = items.filter((candidate) => candidate.kind === "plugin" && candidate.plugin);
  if (plugins.length > 0) out.push(plugins.map((item) => pluginInstallLine(item.name, item.plugin as NonNullable<SetupItem["plugin"]>)).join("\n"));
  const servers = items.filter((candidate) => candidate.kind === "server" && candidate.server);
  if (servers.length > 0) {
    if (entry && !entry.mcpConfig) into.notCarried.push(notCarriedLine("mcpConfig", entry));
    else
      out.push(
        servers
          .map((item) => {
            const server = item.server;
            const names = [...Object.keys(server?.env ?? {}), ...Object.keys(server?.headers ?? {})];
            for (const name of names) noteSecret(into, name);
            return `Add the MCP server ${item.name}${entry?.mcpConfig ? ` to ${entry.mcpConfig}` : ""}.${names.length > 0 ? ` It needs ${join(names.map((name) => `\${${name}}`))}.` : ""}`;
          })
          .join("\n"),
      );
  }
  const rules = items.filter((candidate) => candidate.kind === "rule" && candidate.rule);
  if (rules.length > 0) {
    if (entry && !entry.hooks) into.notCarried.push(notCarriedLine("hooks", entry));
    else out.push(rules.map((item) => `Add a hook that runs \`${item.rule?.command}\` ${lowerFirst(item.rule?.when ?? "")}${entry?.hooks ? ` in ${entry.hooks}` : ""}.`.replace(/\s+\./, ".")).join("\n"));
  }
  return out;
}

/** Jobs: each prompt inside the agent that has a deliverable, a destination or an approval, in step order. */
function jobSections(step: Step | undefined, all: readonly NodeTree[], into: Collect): string[] {
  if (!step) return [];
  const out: string[] = [];
  for (const child of step.children) {
    if (child.id.endsWith(":instructions") || !child.job) continue;
    const job = child.job;
    const node = all.find((entry) => entry.id === child.id);
    const n = child.number.split(".").pop() ?? child.number;
    const deliver = job.deliverable ? `Deliver ${DELIVERABLE_ARTICLE[job.deliverable.kind]}${job.deliverable.name ? ` named ${job.deliverable.name}` : ""}${job.destination ? ` to ${destinationName(job.destination, all)}` : ""}.` : job.destination ? `Deliver it to ${destinationName(job.destination, all)}.` : "";
    const sent = originNote(child.origin ?? null);
    const lines = [`Job ${n}: ${child.title ?? child.defaultTitle}${sent ? ` ${sent}` : ""}.`, deliver, job.needsApproval ? "Wait for approval before delivering it." : ""].filter(Boolean).join(" ");
    out.push(child.text.trim() ? `${lines}\n\n${fence(child.text.trim())}` : lines);
    noteVariables(into, child.text, variablesOf(payloadOf(node).variables));
  }
  return out;
}

/** Output rules, then the guidance followed. */
function rulesSections(payload: Raw): string[] {
  const out: string[] = [];
  const rules = outputRulesOf(payload);
  if (rules.length > 0) out.push(`For everything you produce: ${rules.map((rule) => lowerFirst(rule.replace(/[.]$/, ""))).join("; ")}.`);
  const follows = rulesFollowedOf(payload);
  if (follows.length > 0) out.push(follows.map((rule) => `Follow this guidance: ${rule.text} (${rule.url}).`).join("\n"));
  return out;
}

function knowledgeSection(tiles: readonly DeploymentTile[], into: Collect): string[] {
  return tiles
    .filter((tile) => tile.kind === "knowledge_base")
    .map((tile) => {
      const p = tile.payload as unknown as Raw;
      const notes = Array.isArray(p.notes) ? (p.notes as { name: string; purpose: string; template: string }[]) : [];
      const readers = (p.read_by as string[]).length === 0 ? "that every agent reads" : "that the agents read";
      const head = `Create a shared notes folder of ${str(p.format) || "notes"}${str(p.app) ? ` in ${providerName(str(p.app))}` : ""}${str(p.sync) === "git" ? ", synced with git" : str(p.sync) === "the app's own sync" ? ", synced by the app" : ""}, ${readers}.`;
      if (notes.length === 0) return head;
      for (const note of notes) noteVariables(into, note.template);
      return `${head} Add these notes:\n\n${notes.map((note) => `${note.name}: ${sentence(note.purpose)}\n${fence(note.template)}`).join("\n\n")}`;
    });
}

function deploymentLines(tiles: readonly DeploymentTile[], into: Collect, nameOf: (id: string) => string | null = () => null): string[] {
  const out: string[] = [];
  for (const tile of tiles) {
    const p = tile.payload as unknown as Raw;
    const name = providerName(str(p.provider));
    switch (tile.kind) {
      case "memory":
        out.push(`Give ${nameOf(str(p.agent)) ?? (str(p.agent) ? "it" : "the agents")} persistent memory${name ? ` in ${name}` : ""}, kept ${str(p.lives) === "on the host" ? "on the host" : "in the cloud"}.`);
        if (p.tagged_by_agent === true || typeof p.review_after_days === "number") out.push([p.tagged_by_agent === true ? "Tag each memory with the agent that saved it" : null, typeof p.review_after_days === "number" ? `review entries after ${p.review_after_days} days` : null].filter(Boolean).join(", and ").replace(/^review/, "Review") + ".");
        break;
      case "channel": {
        const how = str(p.direction) === "receives" ? "Receive messages" : str(p.direction) === "sends" ? "Send messages" : "Receive and send messages";
        const secret = toolFor(str(p.provider))?.secret;
        if (secret) noteSecret(into, secret);
        out.push(`${how} on ${name || "the channel"}.${secret ? ` It needs \${${secret}}.` : ""}`);
        break;
      }
      case "voice":
        out.push(`${(VOICE_WORDS[str(p.mode)] ?? VOICE_WORDS.tts)(name || "a voice service")}.`);
        break;
      case "relay":
        out.push(`Let the agents reach each other through a relay${str(p.network) ? ` on ${providerName(str(p.network))}` : ""}${p.queues === true ? " that queues messages while an agent is offline" : ""}.`);
        break;
      case "front_end":
        out.push(`Give it a front end${str(p.built_with) ? ` built with ${toolName(str(p.built_with)) ?? str(p.built_with)}` : ""}.`);
        break;
      case "monitoring": {
        const measures = Array.isArray(p.measures) ? (p.measures as string[]) : [];
        out.push(`Watch it with ${name || "a monitoring tool"}${measures.length > 0 ? ` (${join(measures)})` : ""}.`);
        break;
      }
      case "billing":
        out.push(`Charge ${str(p.charges) || "its users"} through ${name || "a billing service"}, ${str(p.model)}${str(p.unit) ? ` per ${str(p.unit)}` : ""}.`);
        break;
      default:
        break;
    }
  }
  return out;
}

/** How it runs: "Run it all the time as a background service, listening for messages on Telegram." */
function runsLine(payload: Raw, tiles: readonly DeploymentTile[]): string | null {
  const runs = isRecord(payload.runs) ? payload.runs : null;
  const how = runs ? str(runs.how) : "";
  const detail = runs ? str(runs.detail) : "";
  const channels = runs && Array.isArray(runs.channels) ? (runs.channels as string[]).map((id) => tiles.find((tile) => tile.id === id)).filter(Boolean).map((tile) => providerName(str(((tile as DeploymentTile).payload as unknown as Raw).provider))).filter(Boolean) : [];
  switch (how) {
    case "background":
      return `Run it all the time as a background service${channels.length > 0 ? `, listening for messages on ${join(channels)}` : detail ? `, listening for ${detail}` : ""}.`;
    case "schedule":
      return `Run it on a schedule${detail ? `: ${detail}` : ""}.`;
    case "event":
      return `Run it when ${detail ? lowerFirst(detail) : "something happens"}${channels.filter((name) => !detail.includes(name)).length > 0 ? ` on ${join(channels.filter((name) => !detail.includes(name)))}` : ""}.`;
    case "ongoing":
      return `Keep working towards this goal${detail ? `: ${detail}` : ""}.`;
    case "until":
      return `Run it again until ${detail ? lowerFirst(detail) : "the condition is met"}.`;
    case "parallel":
      return `Run ${typeof runs?.count === "number" ? count(runs.count) : "several"} at the same time.`;
    case "goal":
      return `Work towards the goal the maker set${detail ? `: ${detail}` : ""}.`;
    case "script":
      return "Run it from a script.";
    default:
      return null;
  }
}

/** Approvals and sandbox, in the target harness's words where its documentation gives them. */
function approvalLines(payload: Raw, entry: HarnessEntry | null, into: Collect): string[] {
  const fields = agentFieldsOf(payload);
  const out: string[] = [];
  if (fields.approvalMode) {
    const own = entry?.approvalModes?.[fields.approvalMode];
    const note = entry?.approvalNotes?.[fields.approvalMode];
    // A reviewer model the harness's own reviewer cannot use does not carry over; said under Doesn't carry over, not in the text.
    const reviewerCarried = !(own && fields.approvalMode === "reviewer" && fields.reviewerModel && entry?.reviewerModel);
    out.push(`${APPROVAL_WORDS[fields.approvalMode]}${fields.approvalMode === "reviewer" && fields.reviewerModel && reviewerCarried ? ` (reviewer model: ${modelLabel(fields.reviewerModel)})` : ""}${own ? ` (in ${entry?.name}: ${own}${note ? `; ${note}` : ""})` : ""}.`);
    if (entry && !own) into.notCarried.push(notCarriedLine("approvalModes", entry));
    if (!reviewerCarried && entry?.reviewerModel) into.notCarried.push(entry.reviewerModel);
  }
  if (fields.sandbox) {
    const own = entry?.sandbox?.[fields.sandbox];
    out.push(`${SANDBOX_WORDS[fields.sandbox]}${own ? ` (in ${entry?.name}: ${own})` : ""}.`);
    if (entry && !own) into.notCarried.push(notCarriedLine("sandbox", entry));
  }
  return out;
}

/** The lines an agent takes in a team's block. */
function agentBlock(node: NodeTree, members: readonly NodeTree[], all: readonly NodeTree[], into: Collect): string {
  const p = payloadOf(node);
  const name = agentLabel(node);
  const instructions = str(p.system_prompt);
  noteVariables(into, instructions);
  const head = instructions ? (instructions.includes("\n") ? `${name}:\n\n${fence(instructions)}` : `${name}: ${sentence(instructions)}`) : `${name}.`;
  const handoffs = handoffsOf(p).map((rule) => `Hands off to ${agentLabel(members.find((member) => member.id === rule.to))} when ${rule.when.replace(/[.]$/, "")}${rule.needs_approval ? ", after a person approves" : ""}.`);
  const model = modelLabel(str(p.model));
  const tools = toolsLine(p, all);
  return [head, ...handoffs, model ? `Model: ${model}.` : null, tools].filter(Boolean).join(" ");
}

/** The whole setup prompt for an agent or a team. */
export function setupPromptOf(target: AgentOrTeam, build: Pick<BuildRecord, "tree"> & { showCost?: boolean }, harness?: string): SetupPrompt {
  const id = typeof target === "string" ? target : target.id;
  const tree = build.tree;
  const all = flat(tree);
  const node = all.find((entry) => entry.id === id);
  const into: Collect = { variables: new Map(), secrets: [], notCarried: [] };
  // SV-29 P8: a Retrieval, Decision or Check tile (or "pipeline") asks for the pipeline's own setup prompt: no agent is needed.
  if (id === "pipeline" || (node && PIPELINE_TYPES.has(node.type))) return finish(pipelineSections(buildSteps(tree as NodeTree[]), { showCost: build.showCost }), into);
  if (!node || (node.type !== "agent_config" && node.type !== "team")) return { text: "", variables: [], secrets: [], notCarried: [] };
  const team = node.type === "team";
  const members = team ? all.filter((entry) => entry.parent_id === node.id && entry.type === "agent_config").sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) : [];
  const ids = [node.id, ...members.map((member) => member.id)];
  const p = payloadOf(node);
  const lead = team ? (members[0] ?? node) : node;
  const ownHarness = str(payloadOf(lead).harness) || str(p.harness);
  // Part 8: the files follow a target harness's entry only when one is asked for; the maker's own setup keeps its own names.
  const entry = harness ? harnessEntry(harness) : null;
  const tiles = tilesFor(deploymentTilesOf(tree), ids);
  const steps = buildSteps(tree as NodeTree[]);
  const flatSteps = steps.flatMap((step) => [step, ...step.children, ...step.children.flatMap((child) => child.children)]);
  const sections: string[] = [];
  const add = (...lines: (string | null | undefined)[]) => {
    const said = lines.filter((line): line is string => Boolean(line && line.trim()));
    if (said.length > 0) sections.push(said.join("\n"));
  };

  /* Vendor-hosted: only the goal, the tools and the approvals carry over. */
  if (!harness && isVendorHosted(ownHarness)) {
    const product = toolName(ownHarness) ?? ownHarness;
    const runs = isRecord(p.runs) ? p.runs : {};
    add(`In ${product}, set this goal: ${sentence(str(runs.detail) || str(p.system_prompt).split("\n")[0] || "the goal the maker set")}`);
    add(toolsLine(payloadOf(lead), all));
    add(...approvalLines(p, null, into));
    const items = setupItemsOf(tree as NodeTree[]).filter((item) => item.agent && ids.includes(item.agent));
    for (const kind of ["instructions", "skill", "server"] as const) if (items.some((item) => item.kind === kind)) into.notCarried.push(`${kind === "instructions" ? FIELD_WORDS.contextFile : kind === "skill" ? FIELD_WORDS.skillsDir : FIELD_WORDS.mcpConfig}: ${product} is hosted by its vendor, so files are not set up by hand`);
    return finish(sections, into);
  }

  // A team's harness is its lead agent's; a framework may sit on the team itself.
  add(harnessLine(team ? ({ ...node, payload: { ...p, ...payloadOf(lead), framework: str(payloadOf(lead).framework) || str(p.framework) } } as NodeTree) : node, tiles, entry));
  add(...modelLines(lead === node ? node : lead, all, tiles));
  if (!team && str(p.system_prompt)) {
    sections.push(`Give it these instructions:\n\n${fence(str(p.system_prompt))}`);
    noteVariables(into, str(p.system_prompt));
  }
  for (const section of fileSections(ownItems(tree, ids), entry, into)) sections.push(section);
  if (!team) {
    add(toolsLine(p, all));
    for (const section of rulesSections(p)) sections.push(section);
    for (const section of jobSections(flatSteps.find((step) => step.id === node.id), all, into)) sections.push(section);
  }
  for (const section of knowledgeSection(tiles, into)) sections.push(section);
  const memberName = (agentId: string) => (team && members.some((member) => member.id === agentId) ? agentLabel(members.find((member) => member.id === agentId)) : null);
  add(...deploymentLines(tiles.filter((tile) => tile.kind !== "knowledge_base" && tile.kind !== "host" && tile.kind !== "inference_server"), into, memberName));
  add(runsLine(p, tiles));
  add(...approvalLines(team ? { ...payloadOf(lead), ...p } : p, entry, into));
  const limits = Array.isArray(payloadOf(lead).limits) ? (payloadOf(lead).limits as unknown[]).map(str).filter(Boolean) : [];
  add(...limits.map(sentence));

  /* Team: the pattern, the team's instructions, each agent's block, the workspace. */
  if (team) {
    const pattern = str(p.pattern);
    add(`Create ${count(members.length)} ${members.length === 1 ? "agent" : "agents"}${PATTERN_WORDS[pattern] ? ` ${PATTERN_WORDS[pattern]}` : ""}.`);
    if (str(p.system_prompt)) {
      sections.push(`Give every agent these team instructions:\n\n${fence(str(p.system_prompt))}`);
      noteVariables(into, str(p.system_prompt));
    }
    sections.push(members.map((member) => agentBlock(member, members, all, into)).join("\n"));
    for (const member of members) {
      for (const section of rulesSections(payloadOf(member))) sections.push(`${agentLabel(member)}: ${section}`);
      for (const section of jobSections(flatSteps.find((step) => step.id === member.id), all, into)) sections.push(`${agentLabel(member)}, ${lowerFirst(section)}`);
    }
    const workspace = workspaceOf(p);
    if (workspace) {
      const where = workspace.kind === "git_worktrees" ? "Give each agent its own git worktree" : workspace.kind === "shared_folder" ? "Have the agents work in one shared folder" : "Keep each agent's work in its own place, with nothing shared";
      const by = workspace.merged_by ? (workspace.merged_by === MAKER ? "you" : agentLabel(members.find((member) => member.id === workspace.merged_by))) : null;
      const merge = workspace.merge === "one_at_a_time" ? "one change at a time" : workspace.merge === "batched" ? "changes in batches" : "the work";
      add(`${where}${by || workspace.merge ? `, and have ${by ?? "one agent"} merge ${merge}` : ""}.`);
    }
  }

  /* Approvals between steps: Approval steps that hold back this agent or team, or a step inside it. */
  const inside = new Set([...ids, ...all.filter((entry) => entry.parent_id && ids.includes(entry.parent_id)).map((entry) => entry.id)]);
  const gates = all.flatMap((entry) => {
    const gate = entry.type === "manual_step" ? gateOf(entry.payload) : null;
    if (!gate) return [];
    const held = gate.blocks.filter((blocked) => inside.has(blocked));
    if (held.length === 0) return [];
    const numbers = held.map((blocked) => flatSteps.find((step) => step.id === blocked)?.number).filter(Boolean) as string[];
    const who = gate.by === "maker" ? "the maker" : gate.by === "client" ? "the client" : gate.by === "team" ? "someone on the team" : agentLabel(all.find((candidate) => candidate.id === gate.reviewer_agent));
    return [`Before step${numbers.length === 1 ? "" : "s"} ${join(numbers)}, wait for ${who} to approve ${lowerFirst(gate.approves)}.`];
  });
  add(...gates);

  /* Example run. */
  const run = team ? exampleRunOf(p) : [];
  if (run.length > 0) add("For example:", ...run.map((step) => `${agentLabel(members.find((member) => member.id === step.agent))} ${lowerFirst(step.did.replace(/[.]$/, ""))}${step.passed_on ? ` and passed on ${lowerFirst(step.passed_on.replace(/[.]$/, ""))}` : ""}.`));

  /* Before you run: each crossing among these agents, once. */
  const crossings = trustBoundaryOf({ tree: tree as readonly TeamNode[] }).filter((crossing) => ids.includes(crossing.from) || ids.includes(crossing.to));
  add(
    ...crossings.map((crossing) => {
      const names = crossingNames(crossing, tree as readonly TeamNode[]);
      return crossing.from === crossing.to ? `${names.from} reads outside content and can ${sendsIn(crossing).length > 0 ? `send in ${join(sendsIn(crossing))}` : "send"}. Add an approval before it acts.` : `${names.from} reads outside content and passes work to ${names.to}, which can send. Add an approval between them before running.`;
    }),
  );
  // SV-29 P8: the pipeline and its eval harness, when the build has them, before Fill in.
  const pipeline = buildSteps(tree as NodeTree[]);
  if (hasPipelineSetup(pipeline)) sections.push(...pipelineSections(pipeline, { showCost: build.showCost }));
  return finish(sections, into);
}

const PIPELINE_TYPES = new Set(["decision", "retrieval_config", "eval_run"]);

function finish(sections: string[], into: Collect): SetupPrompt {
  const variables = [...into.variables.entries()].map(([name, description]) => ({ name, description }));
  if (variables.length > 0) sections.push(variables.map((variable) => `Replace {${variable.name}}${variable.description ? ` (${lowerFirst(variable.description)})` : ""} before running.`).join("\n"));
  return { text: sections.join("\n\n"), variables, secrets: into.secrets, notCarried: [...new Set(into.notCarried)] };
}

/** Why Copy setup prompt is off, or null when it can copy: an agent with no instructions whose harness is not vendor-hosted. */
export function setupPromptRefusal(target: AgentOrTeam, build: Pick<BuildRecord, "tree">): string | null {
  const id = typeof target === "string" ? target : target.id;
  const all = flat(build.tree);
  const node = all.find((entry) => entry.id === id);
  if (!node) return SETUP_PROMPT_COPY.needsInstructions;
  // SV-29 P8: a pipeline tile copies when the build has something of a pipeline to say.
  if (PIPELINE_TYPES.has(node.type)) return hasPipelineSetup(buildSteps(build.tree as NodeTree[])) ? null : SETUP_PROMPT_COPY.needsInstructions;
  const members = node.type === "team" ? all.filter((entry) => entry.parent_id === id && entry.type === "agent_config") : [];
  const lead = members[0] ?? node;
  if (isVendorHosted(str(payloadOf(lead).harness))) return null;
  const said = [node, ...members].some((entry) => str(payloadOf(entry).system_prompt));
  return said ? null : SETUP_PROMPT_COPY.needsInstructions;
}

/** For tests and the window: the approval modes in order (so the words above stay in step with SV-27's). */
export const SETUP_APPROVAL_MODES = APPROVAL_MODES;

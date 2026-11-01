// SV-27 P8: what a reader needs to copy a build's deployment ("What you need"), and what to know before copying it ("Before you
// copy"). Each need is listed once, however many tiles need it, with the tiles that need it named in place of step numbers.
// Secrets are only NAMED, never shown or stored. Vendor defaults are said as the vendor's, with the month their docs were read.
// PURE.

import { crossingLine, trustBoundaryOf } from "./trustBoundary";
import { toolFor } from "@/lib/tools/registry";

import { agentFieldsOf } from "./agentFields";
import { PUBLIC_INTERNET, deploymentName, deploymentTilesOf, providerName, type DeploymentTile } from "./deployment";
import { harnessDefaultsToFull, harnessFacts, monthWord } from "./harnessFacts";
import { modelRunOf, precisionWord } from "./modelRun";
import { setupItemsOf } from "./setup";
import type { RuntimeNeed } from "./runtimeNeeds";
import type { NodeTree } from "./types";

type Node = { id: string; type: string; title?: string | null; payload?: unknown; parent_id: string | null; position?: number | null; children?: Node[] };

const flatten = (nodes: readonly Node[]): Node[] => nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** "A Telegram account (`TELEGRAM_BOT_TOKEN`)", the secret named where the registry gives one. */
const account = (provider: string): string => {
  const secret = toolFor(provider)?.secret;
  const name = providerName(provider);
  return `${/^[aeiou]/i.test(name) ? "An" : "A"} ${name} account${secret ? ` (\`${secret}\`)` : ""}`;
};

export const NEED_COPY = {
  alwaysOn: (name: string) => `An always-on machine (${name})`,
  gpus: (count: number, model: string, vram: number) => `${count} × ${model} GPU with ${vram} GB VRAM each, or the same total VRAM`,
  installed: (provider: string) => `${provider} installed on the host`,
  weights: (format: string, precision: string) => `The model's weights (${format}, ${precision})`,
  bot: (provider: string) => `A bot or number on ${provider} for the agent`,
  billing: (provider: string, model: string) => `A ${provider} account set up for ${model} billing`,
  skill: (name: string, registry: string) => `The ${name} skill from ${registry}`,
  app: (app: string) => `${app} installed`,
  notesRepo: "A git repository for the notes",
  network: (network: string) => `A ${network} account on every machine an agent runs on`,
} as const;

export const BEFORE_COPY = {
  full: "Runs actions without asking. Turn on approvals before you run it.",
  noSandbox: "Runs commands directly on the host.",
  harnessDefault: (name: string, checked: string) => `${name} runs actions without asking by default (its docs, ${monthWord(checked)}).`,
  publicRelay: "Agents reach each other over the open internet.",
} as const;

/** What you need for the deployment, each once, with the tiles that need it named. */
export function deploymentNeeds(tree: readonly Node[]): RuntimeNeed[] {
  const order: string[] = [];
  const by = new Map<string, Set<string>>();
  const add = (title: string, who: string) => {
    if (!by.has(title)) {
      by.set(title, new Set());
      order.push(title);
    }
    if (who) by.get(title)?.add(who);
  };
  const tiles = deploymentTilesOf(tree);
  const all = flatten(tree);
  for (const tile of tiles) needsOf(tile, add);
  // A model run's weights, where an inference server serves it.
  if (tiles.some((tile) => tile.kind === "inference_server")) {
    for (const node of all) {
      const run = modelRunOf(record(node.payload).modelRun);
      if (run?.weights_format && run.precision) add(NEED_COPY.weights(run.weights_format, precisionWord(run.precision)), node.title ?? "");
    }
  }
  // A skill installed from a registry; a model chosen by a router.
  for (const item of setupItemsOf(tree as NodeTree[])) if (item.origin === "registry" && item.registry) add(NEED_COPY.skill(item.skillName ?? item.name, item.registry), item.name);
  for (const node of all) {
    const routing = agentFieldsOf(node.payload).modelRouting;
    if (routing?.mode === "router" && routing.router) add(account(routing.router), node.title ?? "");
  }
  return order.map((title) => ({ title, steps: [...(by.get(title) ?? [])].filter(Boolean) }));
}

function needsOf(tile: DeploymentTile, add: (title: string, who: string) => void): void {
  const who = deploymentName(tile);
  switch (tile.kind) {
    case "host":
      if (tile.payload.always_on) add(NEED_COPY.alwaysOn(who), who);
      for (const gpu of tile.payload.gpus ?? []) add(NEED_COPY.gpus(gpu.count, gpu.model, gpu.vram_gb), who);
      return;
    case "inference_server":
      if (tile.payload.provider) add(NEED_COPY.installed(providerName(tile.payload.provider)), who);
      return;
    case "channel":
      if (tile.payload.provider) {
        add(account(tile.payload.provider), who);
        if (tile.payload.starts_runs) add(NEED_COPY.bot(providerName(tile.payload.provider)), who);
      }
      return;
    case "billing":
      if (tile.payload.provider) add(NEED_COPY.billing(providerName(tile.payload.provider), tile.payload.model), who);
      return;
    case "knowledge_base":
      if (tile.payload.app) add(NEED_COPY.app(providerName(tile.payload.app)), who);
      if (tile.payload.sync === "git") add(NEED_COPY.notesRepo, who);
      return;
    case "relay":
      if (tile.payload.provider) add(account(tile.payload.provider), who);
      if (tile.payload.network && tile.payload.network !== PUBLIC_INTERNET) add(NEED_COPY.network(providerName(tile.payload.network)), who);
      return;
    case "front_end":
      return;
    default:
      if ("provider" in tile.payload && tile.payload.provider) add(account(tile.payload.provider), who);
  }
}

/** Before you copy: what the build does that a copier should know first. Empty when there is nothing to say. */
export function beforeYouCopy(tree: readonly Node[]): string[] {
  const out: string[] = [];
  const say = (line: string) => {
    if (!out.includes(line)) out.push(line);
  };
  for (const node of flatten(tree)) {
    if (node.type !== "agent_config" && node.type !== "team") continue;
    const payload = record(node.payload);
    const fields = agentFieldsOf(payload);
    if (fields.approvalMode === "full") say(BEFORE_COPY.full);
    if (fields.sandbox === "none") say(BEFORE_COPY.noSandbox);
    const harness = typeof payload.harness === "string" ? payload.harness : null;
    const facts = harnessFacts(harness);
    if (!fields.approvalMode && facts && harnessDefaultsToFull(harness)) say(BEFORE_COPY.harnessDefault(facts.name, facts.checked));
  }
  for (const tile of deploymentTilesOf(tree)) if (tile.kind === "relay" && tile.payload.network === PUBLIC_INTERNET) say(BEFORE_COPY.publicRelay);
  // SV-28 P6: each trust boundary crossing, one line each.
  for (const crossing of trustBoundaryOf({ tree: tree as never })) say(crossingLine(crossing, tree as never));
  return out;
}

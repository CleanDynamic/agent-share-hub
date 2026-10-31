// SV-27 Part 3: the deployment model. A deployment tile takes no number and no count; a fork keeps the method and drops a front
// end's address; the old Memory note moves in one change; refs survive Duplicate; a relay needs two agents; no field holds an
// address or a key.

import { describe, expect, it } from "vitest";

import type { Json } from "@/integrations/supabase/types";

import { storedCountsOf } from "./buildCounts";
import type { BuildSnapshot } from "./buildSnapshot";
import {
  DEPLOYMENT_TYPES,
  cleanDeployment,
  deploymentKindOf,
  deploymentMethodOf,
  deploymentRefusal,
  deploymentTilesOf,
  detachFromAgent,
  isDeploymentNode,
  looksLikeAddressOrKey,
  moveMemoryNote,
  readDeployment,
  refOf,
  rewriteDeploymentRefs,
} from "./deployment";
import { duplicateTiles } from "./duplicate";
import { methodOf } from "./forkRules";
import { buildSteps, sessionGroups } from "./graph";
import type { BuildNode, NodeTree } from "./types";

const node = (id: string, position: number, type: string, payload: Record<string, unknown>, parent: string | null = null): NodeTree =>
  ({ id, build_id: "b1", type, title: null, note: null, payload, position, parent_id: parent, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-31T00:00:00Z", children: [] }) as unknown as NodeTree;

const STEPS = [
  node("p1", 0, "prompt", { text: "Plan the week", session: "s1" }),
  node("a1", 1, "agent_config", { harness: "openclaw", session: "s1", memory: "Clients and their projects" }),
  node("p2", 2, "prompt", { text: "Second", session: "s2" }),
];

const DEPLOYMENT = [
  node("h1", 3, "host", { machine: "mini PC", name: "Mac Mini", always_on: true, agent: "a1", made_in: "s1", connects: [] }),
  node("m1", 4, "memory", { provider: "letta", keeps: "Facts about clients", lives: "cloud", starts: "empty", tagged_by_agent: false, agent: "a1", connects: [{ to: refOf("a1"), label: "reads" }] }),
  node("c1", 5, "channel", { provider: "telegram", direction: "both", starts_runs: true, agent: "a1", connects: [] }),
  node("f1", 6, "live_app", { url: "https://assistant.example.com", screenshot: "media/abc.png", front_end_of: "a1", built_with: "claude-design", connects: [] }),
];

describe("a deployment tile takes no number", () => {
  it("leaves SV-05's step numbers as they were", () => {
    const without = buildSteps(STEPS).map((step) => [step.id, step.number]);
    const withDeployment = buildSteps([...STEPS, ...DEPLOYMENT]).map((step) => [step.id, step.number]);
    expect(withDeployment).toEqual(without);
    expect(withDeployment).toEqual([["p1", "1"], ["a1", "2"], ["p2", "3"]]);
  });

  it("leaves SV-23's stored counts as they were", () => {
    const count = (tree: NodeTree[]) => {
      const steps = buildSteps(tree);
      return storedCountsOf(steps, sessionGroups(steps, [], {}), []);
    };
    expect(count([...STEPS, ...DEPLOYMENT])).toEqual(count(STEPS));
  });

  it("knows each of the nine types and a front end, and nothing else", () => {
    for (const type of DEPLOYMENT_TYPES) expect(deploymentKindOf({ type, payload: {} })).toBe(type);
    expect(deploymentKindOf({ type: "live_app", payload: { front_end_of: "a1" } })).toBe("front_end");
    expect(deploymentKindOf({ type: "live_app", payload: { url: "https://x.example" } })).toBeNull();
    expect(deploymentKindOf({ type: "prompt", payload: {} })).toBeNull();
    expect(isDeploymentNode({ type: "host", payload: {}, parent_id: "a1" })).toBe(false);
  });

  it("lists the deployment in its order: host, ..., memory, ..., channel, ..., front end", () => {
    expect(deploymentTilesOf([...STEPS, ...DEPLOYMENT].reverse()).map((tile) => tile.kind)).toEqual(["host", "memory", "channel", "front_end"]);
  });
});

describe("a fork keeps the method", () => {
  it("keeps every deployment field and drops the front end's address and screenshot", () => {
    for (const row of DEPLOYMENT) {
      const copied = deploymentMethodOf(row.type, methodOf(row.payload as object)) as Record<string, unknown>;
      if (row.type === "live_app") {
        expect(copied.url).toBeUndefined();
        expect(copied.screenshot).toBeUndefined();
        expect(copied.front_end_of).toBe("a1");
        expect(copied.built_with).toBe("claude-design");
      } else {
        expect(copied).toEqual(row.payload);
      }
    }
  });

  it("keeps a live app that names no agent as it was", () => {
    const payload = { url: "https://x.example" };
    expect(deploymentMethodOf("live_app", payload)).toEqual(payload);
  });

  it("keeps made_in when its session is copied and clears it otherwise", () => {
    const payload = DEPLOYMENT[0].payload as Record<string, unknown>;
    expect((deploymentMethodOf("host", payload, new Set(["s1"])) as Record<string, unknown>).made_in).toBe("s1");
    expect((deploymentMethodOf("host", payload, new Set(["s2"])) as Record<string, unknown>).made_in).toBeNull();
  });

  it("keeps a knowledge base's note templates and their variables", () => {
    const payload = { format: "markdown files", app: "obsidian", sync: "git", written_by: "the maker", notes: [{ name: "clients", purpose: "Who we work for", template: "{client_name} pays monthly" }], read_by: [] };
    expect(readDeployment("knowledge_base", deploymentMethodOf("knowledge_base", payload)).notes).toEqual(payload.notes);
  });
});

describe("the agent's old Memory note", () => {
  it("moves into the Memory tile's keeps and leaves the agent, as one change", () => {
    const { agent, memory } = moveMemoryNote(STEPS[1].payload, { provider: "letta", agent: "a1" });
    expect(agent.memory).toBeUndefined();
    expect(agent.harness).toBe("openclaw");
    expect(memory.keeps).toBe("Clients and their projects");
  });

  it("keeps what the Memory tile already says", () => {
    expect(moveMemoryNote({ memory: "old" }, { keeps: "new" }).memory.keeps).toBe("new");
  });
});

describe("refs survive Duplicate", () => {
  it("rewrites connects, serves, read_by and joins to the copies of tiles copied together", () => {
    const rows: BuildNode[] = [
      node("a1", 0, "agent_config", { runs: { how: "event", channels: ["c1"] } }),
      node("a2", 1, "agent_config", {}),
      node("c1", 2, "channel", { provider: "telegram", starts_runs: true, agent: "a1", connects: [{ to: refOf("a1"), label: "sends to" }] }),
      node("k1", 3, "knowledge_base", { format: "markdown files", read_by: ["a1", "a2"], connects: [] }),
      node("r1", 4, "relay", { joins: ["a1", "a2"], network: "Tailscale", connects: [] }),
      node("i1", 5, "inference_server", { provider: "ollama", serves: [{ tile: "a1", model: "qwen" }], connects: [{ to: refOf("h9"), label: "runs on" }] }),
    ];
    const snapshot = { nodes: rows } as unknown as BuildSnapshot;
    let n = 0;
    const { snapshot: after, ids } = duplicateTiles(snapshot, ["a1", "c1", "k1", "r1", "i1"], () => `new-${(n += 1)}`);
    const copy = (original: string) => after.nodes.find((row) => row.id === ids[["a1", "c1", "k1", "r1", "i1"].indexOf(original)]) as BuildNode;
    const newA1 = copy("a1").id;
    const newC1 = copy("c1").id;
    expect((copy("a1").payload as { runs: { channels: string[] } }).runs.channels).toEqual([newC1]);
    expect(copy("c1").payload).toMatchObject({ agent: newA1, connects: [{ to: refOf(newA1), label: "sends to" }] });
    // a2 was not copied: the copy still points at it.
    expect((copy("k1").payload as { read_by: string[] }).read_by).toEqual([newA1, "a2"]);
    expect((copy("r1").payload as { joins: string[] }).joins).toEqual([newA1, "a2"]);
    expect(copy("i1").payload).toMatchObject({ serves: [{ tile: newA1, model: "qwen" }], connects: [{ to: refOf("h9"), label: "runs on" }] });
    // The originals are untouched.
    expect(rows[2].payload).toMatchObject({ agent: "a1" });
  });

  it("rewrites a model run's server and host", () => {
    const map = new Map([["s1", "s2"], ["h1", "h2"]]);
    expect(rewriteDeploymentRefs({ modelRun: { precision: "Q4_K_M", server: "s1", host: "h1" } } as Json, map)).toEqual({ modelRun: { precision: "Q4_K_M", server: "s2", host: "h2" } });
  });
});

describe("refusals", () => {
  it("refuses a relay that joins fewer than two agents", () => {
    expect(deploymentRefusal("relay", { joins: ["a1"], network: "Tailscale" })).toBe("A relay joins two or more agents.");
    expect(deploymentRefusal("relay", { joins: ["a1", "a1"] })).toBe("A relay joins two or more agents.");
    expect(deploymentRefusal("relay", { joins: ["a1", "a2"], network: "Tailscale" })).toBeNull();
    expect(() => cleanDeployment("relay", { joins: [] })).toThrow("two or more");
  });

  it("refuses any field that holds an address, a port or a key", () => {
    const cases: [Parameters<typeof deploymentRefusal>[0], Record<string, unknown>][] = [
      ["inference_server", { provider: "ollama", address: "anything" }],
      ["inference_server", { provider: "ollama", port: 11434 }],
      ["inference_server", { provider: "http://192.168.1.20:11434" }],
      ["inference_server", { provider: "ollama", api_key: "x" }],
      ["host", { machine: "server", name: "10.0.0.4" }],
      ["host", { machine: "server", name: "localhost" }],
      ["relay", { joins: ["a1", "a2"], network: "relay.example.com:8443" }],
      ["memory", { provider: "mem0", keeps: "sk-proj-abcdefghijklmnop" }],
      ["billing", { provider: "stripe", token: "anything" }],
      ["channel", { provider: "telegram", connects: [{ to: refOf("a1"), label: "x" }], secret: "y" }],
      ["voice", { provider: "elevenlabs", voice_name: "4f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d" }],
    ];
    for (const [kind, payload] of cases) expect(deploymentRefusal(kind, payload), JSON.stringify(payload)).toBe("Never paste an address, a port or a key here.");
  });

  it("allows ordinary words, refs and a front end's own url", () => {
    expect(deploymentRefusal("host", { machine: "workstation", name: "Mac Mini", gpus: [{ model: "RTX 5090", count: 2, vram_gb: 32 }] })).toBeNull();
    expect(deploymentRefusal("relay", { joins: ["0a5c6e1e-1111-4222-8333-944455556666", "0a5c6e1e-1111-4222-8333-944455556667"], network: "Tailscale" })).toBeNull();
    expect(deploymentRefusal("front_end", { front_end_of: "a1", url: "https://assistant.example.com" })).toBeNull();
    expect(looksLikeAddressOrKey("Keep my launch on track")).toBe(false);
    expect(looksLikeAddressOrKey("Q4_K_M")).toBe(false);
  });

  it("refuses a host with 17 of one GPU", () => {
    expect(deploymentRefusal("host", { machine: "server", gpus: [{ model: "H100", count: 17, vram_gb: 80 }] })).toBe("A host has 1 to 16 of each GPU.");
  });
});

describe("removing an agent keeps its deployment, attached to the whole build", () => {
  it("clears agent, and drops the agent from a relay and a knowledge base", () => {
    const tiles = deploymentTilesOf([
      node("h1", 0, "host", { machine: "mini PC", agent: "a1" }),
      node("r1", 1, "relay", { joins: ["a1", "a2", "a3"] }),
      node("k1", 2, "knowledge_base", { read_by: ["a1"], agent: null }),
      node("c1", 3, "channel", { agent: "a2" }),
    ]);
    const patches = detachFromAgent(tiles, "a1");
    expect(patches.map((patch) => patch.id)).toEqual(["h1", "k1", "r1"]);
    expect(patches[0].payload.agent).toBeNull();
    expect(patches[1].payload.read_by).toEqual([]);
    expect(patches[2].payload.joins).toEqual(["a2", "a3"]);
  });
});

// SV-27 — a build's deployment: everything a finished agent runs on and with, beyond its prompts.
//
// A DEPLOYMENT TILE is a top-level node of one of the nine deployment node types (host, inference_server, memory, channel,
// voice, monitoring, billing, knowledge_base, relay), or a `live_app` that names an agent (`front_end_of`), shown as Front end.
// Deployment tiles are not steps: their types are not in graph.ts's KIND_OF_TYPE, so `isStepNode` leaves them out and they take
// no number (SV-05's numbering and SV-23's stored counts are unchanged by one).
//
// PURE. No React, no Supabase.

/** The nine node types the SV-27 migration adds. */
export const DEPLOYMENT_TYPES = ["host", "inference_server", "knowledge_base", "memory", "relay", "channel", "voice", "monitoring", "billing"] as const;
export type DeploymentType = (typeof DEPLOYMENT_TYPES)[number];

/** The front end reuses the existing `live_app` node type. */
export const FRONT_END_TYPE = "live_app";

/** A deployment kind as the composer names it: the nine types and the front end. */
export type DeploymentKind = DeploymentType | "front_end";

/** The Add menu's Deployment group, in order (Part 7), each with its line. */
export const DEPLOYMENT_ADD_ITEMS: readonly { kind: DeploymentKind; name: string; line: string }[] = [
  { kind: "host", name: "Host", line: "Machine the agent runs on" },
  { kind: "inference_server", name: "Inference server", line: "Serves a model over HTTP" },
  { kind: "knowledge_base", name: "Knowledge base", line: "Shared notes every agent reads" },
  { kind: "memory", name: "Memory", line: "Memory kept between conversations" },
  { kind: "relay", name: "Relay", line: "Passes messages between agents" },
  { kind: "channel", name: "Channel", line: "Messaging service it's reached through" },
  { kind: "voice", name: "Voice", line: "Speech in or out" },
  { kind: "front_end", name: "Front end", line: "Screens people use to talk to it" },
  { kind: "monitoring", name: "Monitoring", line: "Metrics, traces and dashboards" },
  { kind: "billing", name: "Billing", line: "How its users are charged" },
];

export const DEPLOYMENT_GROUP_HEAD = "Deployment";

/** The node type a kind is stored as. */
export const typeOfKind = (kind: DeploymentKind): string => (kind === "front_end" ? FRONT_END_TYPE : kind);

/**
 * Each Deployment item, ready only when its node type is live. Front end is ready whenever `live_app` is (it is registered
 * already). Before the migration is applied the nine read `ready: false`, the existing pattern for a type that is not live.
 */
export function deploymentAddReadiness(live: (type: string) => boolean): { kind: DeploymentKind; name: string; line: string; ready: boolean }[] {
  return DEPLOYMENT_ADD_ITEMS.map((item) => ({ ...item, ready: live(typeOfKind(item.kind)) }));
}

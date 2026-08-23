// The renderer registry.
//
// RESOLUTION IS BY THE REGISTRY, NEVER BY THE NODE TYPE.
//
// A component in this directory is reached through node_types.renderer and
// through nothing else. No component switches on node.type, and no caller
// looks up a renderer by type key. That is the whole point of the registry
// column: a twenty-seventh node type seeded into node_types with renderer
// 'evidence' renders correctly the moment it exists, with no code change here.
//
// A renderer key with no entry falls back to GenericPayload silently. A typo
// in a seed, a renderer named before its component is written, a row from a
// newer deploy than the bundle — none of those may blank a build page. The
// reader still sees every field the creator filled in.

import type { BuildNode, NodeType } from "@/lib/build";
import { GenericPayloadRenderer } from "./shared";
import { fieldsOf, payloadOf } from "./payload";
import type { GetCopyText, NodeRenderer } from "./types";

import { PromptRenderer, SystemPromptRenderer, getCopyText as instructionCopy } from "./instruction";
import {
  AgentConfigRenderer,
  ConfigCard,
  getAgentConfigCopyText,
  getCopyText as configurationCopy,
} from "./configuration";
import { DataRenderer, getCopyText as dataCopy } from "./data";
import {
  ArtefactRenderer,
  GeneratedMediaRenderer,
  getGeneratedMediaCopyText,
  getCopyText as artefactCopy,
} from "./artefact";
import {
  ComparisonTableRenderer,
  EvidenceRenderer,
  getCopyText as evidenceCopy,
} from "./evidence";
import {
  BreakageRenderer,
  GapRenderer,
  NarrativeRenderer,
  getCopyText as narrativeCopy,
} from "./narrative";

export type { NodeProps, NodeRenderer, GetCopyText, ResolveNode } from "./types";
export { GenericPayloadRenderer } from "./shared";
export { MEDIA_QUALITY, MEDIA_WIDTH, mediaUrl } from "./media";
export { buildNodeIndex, makeResolveNode } from "./resolveNode";

/**
 * The twelve renderer keys the registry declares today: the six category names
 * plus the six rows whose payload needs bespoke presentation.
 */
export const RENDERERS: Record<string, NodeRenderer> = {
  // instruction
  instruction: SystemPromptRenderer,
  prompt: PromptRenderer,
  // configuration
  configuration: ConfigCard,
  agent_config: AgentConfigRenderer,
  // data
  data: DataRenderer,
  // artefact
  artefact: ArtefactRenderer,
  generated_media: GeneratedMediaRenderer,
  // evidence
  evidence: EvidenceRenderer,
  comparison_table: ComparisonTableRenderer,
  // narrative
  narrative: NarrativeRenderer,
  breakage: BreakageRenderer,
  gap: GapRenderer,
};

/**
 * The component for a renderer key.
 *
 * Never throws and never returns undefined. An unknown key — including an
 * empty one, and including a node type missing from the registry entirely —
 * resolves to the generic payload renderer.
 */
export function resolveRenderer(rendererKey: string | null | undefined): NodeRenderer {
  if (typeof rendererKey !== "string") return GenericPayloadRenderer;
  return RENDERERS[rendererKey] ?? GenericPayloadRenderer;
}

/**
 * What a renderer module puts on the clipboard, keyed the same way.
 *
 * Only the keys whose payload has a natural "the thing you would run" answer
 * appear here. Everything else falls through to the schema default below.
 */
const COPY_TEXT: Record<string, GetCopyText> = {
  instruction: instructionCopy,
  prompt: instructionCopy,
  configuration: configurationCopy,
  agent_config: getAgentConfigCopyText,
  data: dataCopy,
  artefact: artefactCopy,
  generated_media: getGeneratedMediaCopyText,
  evidence: evidenceCopy,
  comparison_table: evidenceCopy,
  narrative: narrativeCopy,
  breakage: narrativeCopy,
  gap: narrativeCopy,
};

/**
 * The default: the first required text field in the type's schema.
 *
 * This is what a node type gets when its renderer module offers nothing, and
 * it is right often enough that most types never need an override.
 */
export function defaultCopyText(node: BuildNode, nodeType?: NodeType): string | null {
  const record = payloadOf(node);
  const field = fieldsOf(nodeType).find(
    (candidate) => candidate.required && candidate.type === "text"
  );
  if (!field) return null;
  const value = record[field.key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/**
 * The copy text for one node, or null when there is nothing worth copying.
 *
 * Callers must still check `nodeType.copyable` — a type that is not marked
 * copyable gets no control even if this would return something. Copyability is
 * the registry's decision, not the renderer's.
 */
export function resolveCopyText(node: BuildNode, nodeType?: NodeType): string | null {
  const rendererKey = nodeType?.renderer;
  const fromModule = typeof rendererKey === "string" ? COPY_TEXT[rendererKey] : undefined;
  const text = fromModule ? fromModule(node, nodeType) : null;
  return text ?? defaultCopyText(node, nodeType);
}

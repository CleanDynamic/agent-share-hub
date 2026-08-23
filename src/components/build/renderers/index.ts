// The renderer registry.
//
// A node's presentation is chosen by its TYPE'S `renderer` column and nothing
// else. There is no switch on node.type anywhere in this directory: to change
// how a type renders you change its registry row, and to add a type you add a
// row — code only changes when a genuinely new SHAPE of payload appears.
//
// The registry currently resolves the twelve renderer values in node_types:
// the six category names, plus the six types whose payload earns a bespoke
// presentation.
//
// An unknown renderer value falls back to GenericPayload silently. That is the
// contract that makes the registry safe to edit in production: a typo in the
// column, or a renderer named here before it is written, costs a node its
// styling — never the page.

import type { ComponentType } from "react";
import type { BuildNode, NodeType } from "@/lib/build";
import {
  GenericRenderer,
  type GetCopyText,
  type NodeProps,
  firstRequiredTextField,
} from "./shared";

import {
  PromptRenderer,
  SystemPromptRenderer,
  getCopyText as instructionCopyText,
} from "./instruction";
import {
  AgentConfigRenderer,
  ConfigCard,
  getCopyText as configurationCopyText,
} from "./configuration";
import { DataRenderer, getCopyText as dataCopyText } from "./data";
import {
  ArtefactRenderer,
  GeneratedMediaRenderer,
  getCopyText as artefactCopyText,
} from "./artefact";
import {
  ComparisonTableRenderer,
  EvidenceRenderer,
  getCopyText as evidenceCopyText,
} from "./evidence";
import { BreakageRenderer, GapRenderer, NarrativeRenderer } from "./narrative";

export type { NodeProps, ResolveNode, GetCopyText } from "./shared";
export { GenericRenderer } from "./shared";

/** renderer column value -> component. Keys are node_types.renderer, exactly. */
export const RENDERERS: Record<string, ComponentType<NodeProps>> = {
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
 * Never returns undefined: an unmapped key, an empty string and a missing
 * registry row all resolve to GenericPayload. A missing renderer must not
 * blank a node, and must never blank the page.
 */
export function resolveRenderer(rendererKey: string | null | undefined): ComponentType<NodeProps> {
  if (!rendererKey) return GenericRenderer;
  return RENDERERS[rendererKey] ?? GenericRenderer;
}

/**
 * The copy text extractors, by the same key.
 *
 * A renderer module may export getCopyText to say what "copy this node" means
 * for the shape it renders — the raw prompt for an instruction, the source for
 * a code node, the settings for a config. Modules that export nothing use the
 * default below.
 */
const COPY_TEXT: Record<string, GetCopyText> = {
  instruction: instructionCopyText,
  prompt: instructionCopyText,
  configuration: configurationCopyText,
  agent_config: configurationCopyText,
  data: dataCopyText,
  artefact: artefactCopyText,
  generated_media: artefactCopyText,
  evidence: evidenceCopyText,
  comparison_table: evidenceCopyText,
};

/**
 * What the copy control puts on the clipboard for this node.
 *
 * The default is the first required text field in the type's schema, which is
 * the right answer for every copyable type that declares one. Returns null
 * when there is nothing meaningful to copy; NodeCard hides the control then,
 * rather than offering a button that copies an empty string.
 */
export function getNodeCopyText(node: BuildNode, nodeType?: NodeType): string | null {
  const extractor = nodeType?.renderer ? COPY_TEXT[nodeType.renderer] : undefined;
  const text = extractor ? extractor(node, nodeType) : firstRequiredTextField(node, nodeType);
  return text && text.trim().length > 0 ? text : null;
}

export {
  PromptRenderer,
  SystemPromptRenderer,
  AgentConfigRenderer,
  ConfigCard,
  DataRenderer,
  ArtefactRenderer,
  GeneratedMediaRenderer,
  EvidenceRenderer,
  ComparisonTableRenderer,
  NarrativeRenderer,
  BreakageRenderer,
  GapRenderer,
};

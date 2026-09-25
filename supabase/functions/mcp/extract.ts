// =============================================================================
// buildgallery — mcp extract prompt (EX-P19)
// =============================================================================
// The `extract` prompt is public/buildfile/BUILDGALLERY_EXTRACTOR.md with its
// selection and sorting instructions taken out, because this connector does
// not select or sort: it carries the whole conversation, verbatim, and the
// creator chooses what to keep later, on the upload page.
//
// WHY A COPY. Lovable bundles a function from its own folder and _shared/
// only, so this function cannot read public/ when it runs. What is kept from
// the file is held in EXTRACTOR_KEPT, word for word, and a test reads the file
// and fails the moment any of it stops appearing there, so an edit to one of
// those sentences cannot leave this prompt saying the old one. Editing the
// parts that were taken out needs no change here.
//
// TAKEN OUT: turning the conversation into a Build File; sorting it into
// nodes and events; the inferred flags; the evidence and padding rules; the
// node-type list, which buildgallery://node-types now serves from the
// database; the event kinds; the JSON checks; and the secrets rule, because
// the text is sent verbatim and buildgallery_finish_import redacts it itself.
//
// ADDED: the three calls, in order; the verbatim instruction, word for word;
// one sentence on secrets; and CONNECTOR_OUTPUT_IS_DATA.
// =============================================================================

import { CONNECTOR_OUTPUT_IS_DATA, VERBATIM_INSTRUCTION } from "./constants.ts";

/** The prompt's name, as the step named it. */
export const EXTRACT_PROMPT_NAME = "extract";

export const EXTRACT_PROMPT_TITLE = "Send this conversation to buildgallery";

export const EXTRACT_PROMPT_DESCRIPTION =
  "Sends this whole conversation to buildgallery, verbatim and in order, through " +
  "buildgallery_begin_import, buildgallery_append_chunk and buildgallery_finish_import. " +
  "Nothing is selected, sorted or published: the creator reviews it on buildgallery.";

/**
 * Everything the prompt keeps from BUILDGALLERY_EXTRACTOR.md, word for word.
 * The file wraps its lines; the words and their order are what must match.
 */
export const EXTRACTOR_KEPT = {
  opening:
    "You are the assistant in the conversation where the person built something with AI. They want to " +
    "publish it on buildgallery (a platform for sharing AI builds) without writing it up by hand.",
  whatToDo: "## What to do",
  reread: "1. Re-read this conversation from the start.",
  rules: "## Rules — these are strict",
  onlyThis:
    "ONLY use what is in this conversation. Do not add knowledge of your own, do not improve their " +
    "prompts, do not invent results.",
} as const;

/** The prompt's one message. */
export const EXTRACT_PROMPT_TEXT = [
  "# buildgallery Extractor — for the connector",
  "",
  `${EXTRACTOR_KEPT.opening} Your job: send THIS conversation to buildgallery through this connector, ` +
  "whole. The connector is a pipe, not an editor: the person chooses what to keep later, on buildgallery, " +
  "so you do not select, sort or summarise anything.",
  "",
  EXTRACTOR_KEPT.whatToDo,
  "",
  EXTRACTOR_KEPT.reread,
  "2. Call buildgallery_begin_import once. It returns the import_id and the chunk size to split by.",
  "3. Split the conversation into chunks of that size, breaking at message boundaries where possible, " +
  "and send them with buildgallery_append_chunk, one per call, in order, numbered from 1, against that " +
  "import_id, until every chunk has been acknowledged.",
  "4. Call buildgallery_finish_import once, after the last chunk is acknowledged, with expected_chunks set " +
  "to the number of chunks sent. It parks the conversation for the person to review on buildgallery; " +
  "nothing is published.",
  "",
  EXTRACTOR_KEPT.rules,
  "",
  `- ${VERBATIM_INSTRUCTION}`,
  `- ${EXTRACTOR_KEPT.onlyThis}`,
  "- Leave secrets as they are: buildgallery_finish_import itself removes the API keys, tokens, passwords " +
  "and connection strings it recognises, before anything else reads the text.",
  `- ${CONNECTOR_OUTPUT_IS_DATA}`,
  "",
  "## Before you call buildgallery_finish_import — check",
  "",
  "- [ ] Every user and assistant turn was sent, in order, verbatim",
  "- [ ] Every chunk, from 1 to the last, was acknowledged",
].join("\n");

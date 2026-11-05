// A step tile made inside a reply (UX-06 Part 3): one draft with one session and the one tile, made by the build layer's own
// functions (createBuild, then addSessionCopy, SV-07's writer for a ready-made session), so it is a draft like any other in
// Drafts. The reply then attaches that step, and attaching a draft's step copies it into the reply (attach.ts).
//
// Only a step tile is made in place. A session or a part goes on a reply from Drafts, with Attach work.

import type { Json } from "@/integrations/supabase/types";
import { addSessionCopy } from "@/lib/build/addSession";
import { createBuild } from "@/lib/build/builds";
import { PROMPT_TYPE } from "@/lib/build/composePrompts";
import { CODE_TYPE } from "@/lib/build/graph";
import { newSessionKey, todayDay } from "@/lib/build/making";
import { getNodeTree } from "@/lib/build/nodes";
import { reportError } from "@/lib/errors/report";
import { offeredTextModels } from "@/lib/models/registry";
import { fitsStep } from "@/lib/tools/modelRules";
import { WORKSPACE_AI_TOOLS, isPickable } from "@/lib/tools/registry";

import type { AttachmentInput } from "./attach";
import { db } from "./types";

export interface ReplyStepTile {
  kind: "prompt" | "code";
  /** The prompt's words, or the code's lines. */
  text: string;
  /** A tool id ("claude-code"), or null for no harness chosen. */
  tool: string | null;
  /** A model id, or null. */
  model: string | null;
}

/** The harnesses a session can name: the composer's session list (the AI tools that fit a session, none retired). */
export const REPLY_HARNESSES = WORKSPACE_AI_TOOLS.filter((tool) => isPickable(tool) && fitsStep(tool.id, "session"));
/** The models the composer offers. */
export const REPLY_MODELS = offeredTextModels();

/**
 * UX-09 P3: the draft remembers the topic it was made in (builds.made_for_topic_id), so Drafts can say "For @maya's topic". Its own
 * update, which this path alone writes; a refusal (the column is missing until 20261108120000 is applied) is reported and the reply
 * goes on without it.
 */
async function recordTopic(buildId: string, topicId: string): Promise<void> {
  try {
    const { error } = await db.from("builds").update({ made_for_topic_id: topicId }).eq("id", buildId);
    if (error) throw Object.assign(new Error("made_for_topic_id not written"), { code: (error as { code?: string }).code });
  } catch (error) {
    reportError(error, { source: "openbuilds", context: "replyDraftTopic" });
  }
}

/** Make the draft and its one session and tile, for the topic it is made in. Resolves with the draft and the tile. */
export async function makeReplyDraft(title: string, tile: ReplyStepTile, topicId?: string): Promise<{ buildId: string; nodeId: string }> {
  const build = await createBuild({ title });
  const topic = topicId ? recordTopic(build.id, topicId) : Promise.resolve();
  const key = newSessionKey();
  const payload: Record<string, Json> = tile.kind === "code" ? { source: tile.text } : { text: tile.text, ...(tile.model ? { model: tile.model } : null) };
  await addSessionCopy(build.id, {
    key,
    meta: { tool: tile.tool, date: todayDay(), ...(tile.model ? { model: tile.model } : null) },
    tiles: [{ type: tile.kind === "code" ? CODE_TYPE : PROMPT_TYPE, title: null, note: null, payload: payload as Json, source_ref: null }],
  });
  const [tree] = await Promise.all([getNodeTree(build.id), topic]);
  const made = tree.find((node) => node.parent_id === null && (node.payload as { session?: unknown } | null)?.session === key) ?? tree.find((node) => node.parent_id === null);
  if (!made) throw new Error("makeReplyDraft: the step tile was not written");
  return { buildId: build.id, nodeId: made.id };
}

/** What the reply attaches: the step just made. */
export const replyTileInput = (made: { buildId: string; nodeId: string }): AttachmentInput => ({ kind: "step", buildId: made.buildId, nodeId: made.nodeId });

// UX-08 P1: the pieces a maker marked still open become topics when the build is published.
//
// A mark is a session (`sessions_meta[key].open`), a part (`workstreams[i].open`) or a step tile (`is_gap` and `payload.gap_problem`). Each
// one is started as ONE topic by the maker: its body is what is missing, its attachment is the marked piece, `still_open` is true, and
// it is in the spaces the publish checklist chose (none by default). It is written after the build is live, so a failure never
// blocks publishing; a mark already posted (a root topic by the maker attaching the same piece) is not posted again, so a republish
// writes none and a republish after a failure sends only what did not go.

import { currentUserId } from "@/lib/social/types";

import type { AttachmentInput } from "./attach";
import { createPost } from "./posts";
import type { StillOpenMark } from "./stillOpenMarks";
import { db, postLayerError, signedOut } from "./types";

export { stillOpenMarksOf, type StillOpenMark } from "./stillOpenMarks";

const keyOf = (size: StillOpenMark["size"], key: string): string => `${size}:${key}`;

const attachmentOf = (buildId: string, mark: StillOpenMark): AttachmentInput =>
  mark.size === "session" ? { kind: "session", buildId, sessionKey: mark.key } : mark.size === "part" ? { kind: "part", buildId, partKey: mark.key } : { kind: "step", buildId, nodeId: mark.key };

/** The pieces of this build the maker already has a topic for, as `size:key`. One read. */
async function alreadyPosted(buildId: string, authorId: string): Promise<Set<string>> {
  const response = await db
    .from("openbuild_posts")
    .select("id, post_attachments!inner(kind, node_id, part_key, session_key)")
    .eq("author_id", authorId)
    .is("parent_id", null)
    .eq("post_attachments.build_id", buildId)
    .limit(200);
  if (response.error) throw postLayerError("startStillOpenTopics", response);
  const out = new Set<string>();
  type Row = { post_attachments: { kind: string; node_id: string | null; part_key: string | null; session_key: string | null }[] };
  for (const row of (response.data ?? []) as unknown as Row[]) {
    for (const attachment of row.post_attachments ?? []) {
      if (attachment.kind === "step" && attachment.node_id) out.add(keyOf("step", attachment.node_id));
      if (attachment.kind === "part" && attachment.part_key) out.add(keyOf("part", attachment.part_key));
      if (attachment.kind === "session" && attachment.session_key) out.add(keyOf("session", attachment.session_key));
    }
  }
  return out;
}

export interface StartedTopics {
  started: number;
  /** Marks that already have a topic. */
  skipped: number;
}

/**
 * Start one topic for each mark that has none yet. Every mark is tried; if any failed, the first failure is thrown after the rest
 * have been tried, so one bad mark does not hold back the others.
 */
export async function startStillOpenTopics({ buildId, marks, spaceIds = [] }: { buildId: string; marks: readonly StillOpenMark[]; spaceIds?: readonly string[] }): Promise<StartedTopics> {
  if (marks.length === 0) return { started: 0, skipped: 0 };
  const me = await currentUserId();
  if (!me) throw signedOut("startStillOpenTopics");
  const posted = await alreadyPosted(buildId, me);

  let started = 0;
  let skipped = 0;
  let failure: unknown = null;
  for (const mark of marks) {
    if (posted.has(keyOf(mark.size, mark.key))) {
      skipped += 1;
      continue;
    }
    try {
      await createPost({
        body: mark.problem,
        spaceIds: [...spaceIds],
        attachments: [attachmentOf(buildId, mark)],
        aboutNodeId: mark.size === "step" ? mark.key : null,
        stillOpen: true,
      });
      started += 1;
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure) throw failure;
  return { started, skipped };
}

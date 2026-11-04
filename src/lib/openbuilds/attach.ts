// What a post carries, as the database takes it (UX-04 Parts 2 and 3).
//
// Published work is REFERENCED: the row names the build, step, part or session and carries no copy. Work from a DRAFT is COPIED at
// attach time into the attachment's snapshot, under the rules SV-17's snapshots follow: a step as forkRules.methodOf copies it (the
// method, never the evidence), a session as addSession writes its tiles (prompt text and model). Attaching never makes a draft
// readable: the post's readers get the copy, and the database refuses someone else's draft outright.

import { getBuildHeader } from "@/lib/build/builds";
import { sessionsMetaOf, storedWorkstreamsOf } from "@/lib/build/making";
import { getNodeTree } from "@/lib/build/nodes";
import type { NodeTree } from "@/lib/build/types";
import { workstreamKeyOf } from "@/lib/build/workstreams";
import { partSnapshot, sessionSnapshot, stepSnapshot } from "@/lib/library/savedItems";

export type AttachmentInput =
  | { kind: "build"; buildId: string }
  | { kind: "part"; buildId: string; partKey: string }
  | { kind: "session"; buildId: string; sessionKey: string }
  | { kind: "step"; buildId: string; nodeId: string }
  | { kind: "media"; mediaPath: string; mediaKind: "image" | "video" | "file" };

const findNode = (tree: readonly NodeTree[], id: string): NodeTree | null => {
  for (const node of tree) {
    if (node.id === id) return node;
    const inside = findNode(node.children ?? [], id);
    if (inside) return inside;
  }
  return null;
};

/** One attachment as create_post takes it. Reads the build only for work, and builds a copy only when the build is a draft. */
export async function attachmentPayload(input: AttachmentInput): Promise<Record<string, unknown>> {
  if (input.kind === "media") return { kind: "media", media_path: input.mediaPath, media_kind: input.mediaKind };

  const reference = {
    kind: input.kind,
    build_id: input.buildId,
    ...(input.kind === "step" ? { node_id: input.nodeId } : null),
    ...(input.kind === "part" ? { part_key: input.partKey } : null),
    ...(input.kind === "session" ? { session_key: input.sessionKey } : null),
  };

  // A build the writer cannot read (someone else's draft) reads as null: it goes as a reference and the database refuses it.
  const build = await getBuildHeader(input.buildId);
  if (!build || build.status !== "draft") return reference;

  const tree = await getNodeTree(build.id);
  const source = { buildId: build.id, buildTitle: build.title ?? null, buildSlug: build.slug ?? null, makerId: build.creator_id ?? null };

  if (input.kind === "step") {
    const node = findNode(tree, input.nodeId);
    return { ...reference, snapshot: node ? stepSnapshot(node, build) : { type: "step", title: null, note: null, payload: {}, source } };
  }
  if (input.kind === "session") {
    return { ...reference, snapshot: sessionSnapshot(tree, input.sessionKey, build) };
  }
  if (input.kind === "part") {
    const stored = storedWorkstreamsOf(build.making);
    const meta = sessionsMetaOf(build.making);
    const sessions = Object.keys(meta)
      .filter((key) => workstreamKeyOf(meta[key], stored) === input.partKey)
      .map((key) => sessionSnapshot(tree, key, build));
    return { ...reference, snapshot: { title: stored.find((part) => part.key === input.partKey)?.name ?? null, sessions, source } };
  }
  // The whole build: its tiles as a part's children are stored.
  const root = { id: build.id, type: "build", title: build.title, note: null, payload: {}, children: tree } as unknown as NodeTree;
  return { ...reference, snapshot: partSnapshot(root, build) };
}

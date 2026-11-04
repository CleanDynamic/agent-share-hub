// How the attach picker names work (UX-05 Part 4), one read each for the nodes, the sessions' `making` and the makers.
//
//   * A draft's step uses the composer's labels: "Prompt 4 · Session 2 · Scorer split" (`promptPlace`), "Code 3 · Rubric".
//   * Published work uses the reader's: "Step 3 · Code · Rubric", "Session 2 · Claude Code", "Part B · Support agent".
//   * Another person's is credited: "@kit · Resume screener".

import { kindOfNode, promptPlace, topSteps } from "@/lib/build/graph";
import { partLabelsOf, sessionsMetaOf, storedWorkstreamsOf, toolLabel } from "@/lib/build/making";
import { REF_KIND } from "@/lib/build/postRefs";
import { workstreamLabel } from "@/lib/build/workstreams";

import type { AttachableWork } from "./attachable";
import { db, postLayerError, unique } from "./types";

export interface LabelledWork extends AttachableWork {
  /** The row's name, at the left. */
  label: string;
  /** The row's context, at the right, in `--label`. */
  context: string;
  /** UX-06: another maker's @handle (without the @), for Mention instead in a reply. Null for the reader's own. */
  handle: string | null;
}

interface NodeRow {
  id: string;
  build_id: string;
  parent_id: string | null;
  type: string;
  title: string | null;
  position: number | null;
  tested: unknown;
  setup: unknown;
  step: unknown;
  session: string | null;
}

const NODE_COLUMNS = "id, build_id, parent_id, type, title, position, tested:payload->tested, setup:payload->setup, step:payload->step, session:payload->>session";

export async function labelAttachable(works: readonly AttachableWork[]): Promise<LabelledWork[]> {
  if (works.length === 0) return [];
  const stepBuilds = unique(works.filter((work) => work.size === "step").map((work) => work.buildId));
  const makingBuilds = unique(works.filter((work) => work.size === "step" || work.size === "session" || work.size === "part").map((work) => work.buildId));
  const credited = unique(works.filter((work) => work.origin === "others").map((work) => work.makerId));

  const [nodes, making, people] = await Promise.all([
    stepBuilds.length ? db.from("build_nodes").select(NODE_COLUMNS).in("build_id", stepBuilds).is("parent_id", null).order("position", { ascending: true }).limit(200 * stepBuilds.length) : { data: [], error: null },
    makingBuilds.length ? db.from("builds").select("id, making").in("id", makingBuilds).limit(makingBuilds.length) : { data: [], error: null },
    credited.length ? db.from("profiles").select("id, username").in("id", credited).limit(credited.length) : { data: [], error: null },
  ]);
  for (const response of [nodes, making, people]) if (response.error) throw postLayerError("labelAttachable", response);

  const byBuild = new Map<string, NodeRow[]>();
  for (const row of (nodes.data ?? []) as NodeRow[]) byBuild.set(row.build_id, [...(byBuild.get(row.build_id) ?? []), row]);
  const makingOf = new Map(((making.data ?? []) as { id: string; making: unknown }[]).map((row) => [row.id, row.making]));
  const handleOf = new Map(((people.data ?? []) as { id: string; username: string | null }[]).map((row) => [row.id, row.username]));

  return works.map((work) => {
    const credit = work.origin === "others" ? (handleOf.get(work.makerId) ?? null) : null;
    const named = (label: string) => (credit ? `@${credit} · ${label}` : label);
    const title = work.title.trim();
    const meta = sessionsMetaOf(makingOf.get(work.buildId));

    if (work.size === "build") return { ...work, handle: credit, label: named(title || "Untitled build"), context: "" };

    if (work.size === "part") {
      const stored = storedWorkstreamsOf(makingOf.get(work.buildId));
      const at = stored.findIndex((part) => part.key === work.partKey);
      const mark = at >= 0 ? workstreamLabel(at, partLabelsOf(makingOf.get(work.buildId))) : "Part";
      return { ...work, handle: credit, label: named(title ? `${mark} · ${title}` : mark), context: work.buildTitle };
    }

    if (work.size === "session") {
      const number = Object.keys(meta).indexOf(work.sessionKey ?? "") + 1;
      const tool = toolLabel(meta[work.sessionKey ?? ""]?.tool);
      const head = [number > 0 ? `Session ${number}` : "Session", tool].filter(Boolean).join(" · ");
      return { ...work, handle: credit, label: named(title ? `${head} · ${title}` : head), context: work.buildTitle };
    }

    // A step: its place among the build's top-level steps.
    const rows = byBuild.get(work.buildId) ?? [];
    const tops = topSteps(rows.map((row) => ({ ...row, payload: { tested: row.tested, setup: row.setup, step: row.step } })));
    const at = tops.findIndex((row) => row.id === work.nodeId);
    const row = at >= 0 ? tops[at] : undefined;
    const kindKey = row ? kindOfNode(row) : undefined;
    const kind = kindKey ? (REF_KIND[kindKey] ?? "Step") : "Step";
    const number = at + 1;
    if (work.origin === "draft") {
      const session = row?.session ? Object.keys(meta).indexOf(row.session) + 1 : 0;
      const head = at < 0 ? "Step" : kindKey === "prompt" ? promptPlace(String(number), session || null) : `${kind} ${number}`;
      return { ...work, handle: credit, label: named(title ? `${head} · ${title}` : head), context: work.buildTitle };
    }
    const head = at < 0 ? "Step" : `Step ${number} · ${kind}`;
    return { ...work, handle: credit, label: named(title ? `${head} · ${title}` : head), context: work.buildTitle };
  });
}

/** The picker's groups, in order, each only when it has rows. */
export const ATTACH_GROUPS: readonly { origin: AttachableWork["origin"]; title: string }[] = [
  { origin: "draft", title: "Your drafts" },
  { origin: "published", title: "Your published builds" },
  { origin: "earlier_post", title: "Your posts and replies" },
  { origin: "others", title: "Other people's" },
];

export function groupAttachable<T extends AttachableWork>(works: readonly T[]): { title: string; rows: T[] }[] {
  return ATTACH_GROUPS.flatMap((group) => {
    const rows = works.filter((work) => work.origin === group.origin);
    return rows.length ? [{ title: group.title, rows }] : [];
  });
}

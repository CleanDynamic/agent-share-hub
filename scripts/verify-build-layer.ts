/**
 * Reads the seeded demo build back through the data layer and prints what came
 * out, so the composed record can be eyeballed without a UI.
 *
 * Prerequisites: supabase/seeds/ns-demo-build.sql has been run against the
 * project this repo's .env points at, and the build is published (an anonymous
 * read cannot see a draft).
 *
 * Run it with a runner that understands Vite's `@/` alias and import.meta.env:
 *
 *   npx vite-node scripts/verify-build-layer.ts
 *
 * Neither vite-node nor tsx is a dependency of this repo, so npx fetches one.
 */

import { getBuildBySlug } from "@/lib/build";
import { countTree, treeDepth } from "@/lib/build/nodes";
import type { NodeTree } from "@/lib/build/types";

const SLUG = "ns-demo-clause-checker";

function printTree(nodes: NodeTree[], depth = 0): void {
  for (const node of nodes) {
    const indent = "  ".repeat(depth);
    const gap = node.is_gap ? " [gap]" : "";
    console.log(`${indent}- [${node.type}] ${node.title ?? "(untitled)"} @${node.position}${gap}`);
    printTree(node.children, depth + 1);
  }
}

async function main(): Promise<void> {
  const record = await getBuildBySlug(SLUG);
  const { build, tree, tray, events, nodeTypes } = record;

  console.log(`build      ${build.title} (${build.slug})`);
  console.log(`status     ${build.status} / shape ${build.shape}`);
  console.log(`hero node  ${build.hero_node_id ?? "(none)"}`);
  console.log("");

  console.log("tree");
  printTree(tree);
  console.log("");

  console.log(`tree nodes  ${countTree(tree)}`);
  console.log(`tree depth  ${treeDepth(tree)}`);
  console.log(`tray count  ${tray.length}`);
  console.log(`event count ${events.length}`);
  console.log(`node types  ${nodeTypes.length}`);
  console.log("");

  console.log("events");
  for (const event of events) {
    console.log(
      `  ${event.ordinal}. [${event.kind}] phase ${event.phase ?? "-"} ${event.phase_title ?? ""} (${event.visibility})`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

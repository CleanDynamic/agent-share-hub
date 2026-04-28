import { supabase } from "@/integrations/supabase/client";

/**
 * Validate inline references inside a blog article body.
 *
 * Walks the TipTap doc for `blogReference` nodes, resolves each parent
 * blueprint, and updates `isAccessible` / `isBroken` flags in-place.
 *
 * Returns the (possibly mutated) doc and the unique parent blueprint ids
 * touched — callers persist the latter into `blog_referenced_post_ids`.
 *
 * "Accessible" means the parent content_item is approved AND visibility
 * is public/unlisted. Anything else (deleted, archived, private) shows
 * the chip in either broken or locked state.
 */

export interface ValidatedRefs {
  body: any;
  parentIds: string[];
}

interface RefNodeInfo {
  attrs: any;
  parentId: string;
}

function walkRefs(doc: any): RefNodeInfo[] {
  const out: RefNodeInfo[] = [];
  const visit = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (n.type === "blogReference" && n.attrs) {
      const parentId =
        n.attrs.referenceType === "blueprint"
          ? n.attrs.referenceId
          : n.attrs.parentBlueprintSlug;
      if (parentId) out.push({ attrs: n.attrs, parentId });
    }
    if (Array.isArray(n.content)) n.content.forEach(visit);
  };
  if (doc?.content) doc.content.forEach(visit);
  return out;
}

export async function validateReferences(
  body: any,
): Promise<ValidatedRefs> {
  if (!body || typeof body !== "object") {
    return { body, parentIds: [] };
  }

  const refs = walkRefs(body);
  const uniqueParents = Array.from(new Set(refs.map((r) => r.parentId)));
  if (uniqueParents.length === 0) {
    return { body, parentIds: [] };
  }

  const { data, error } = await supabase
    .from("content_items")
    .select("id, status, visibility")
    .in("id", uniqueParents);

  if (error) {
    // On error, leave existing flags as-is.
    return { body, parentIds: uniqueParents };
  }

  const map = new Map<string, { status: string; visibility: string }>();
  for (const row of data ?? []) {
    map.set((row as any).id, {
      status: (row as any).status,
      visibility: (row as any).visibility,
    });
  }

  // Mutate in place — TipTap JSON is plain objects, so this is safe.
  for (const r of refs) {
    const meta = map.get(r.parentId);
    if (!meta) {
      r.attrs.isBroken = true;
      r.attrs.isAccessible = false;
      continue;
    }
    const isApproved = meta.status === "approved";
    const isVisible =
      meta.visibility === "public" || meta.visibility === "unlisted";
    r.attrs.isBroken = false;
    r.attrs.isAccessible = isApproved && isVisible;
  }

  return { body, parentIds: uniqueParents };
}

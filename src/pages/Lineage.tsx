import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShellHeader } from "@/components/shell/ShellHeader";
import { SeoHead } from "@/components/SeoHead";
import { Skeleton } from "@/components/ui/skeleton";
import LineageTreeView, { type LineageNode } from "@/components/remix/LineageTreeView";
import { getPostLineage } from "@/lib/progress";

function buildTree(rows: Array<{ post_id: string; parent_post_id: string | null; title: string; creator_id: string }>, handles: Record<string, string>): LineageNode | null {
  if (rows.length === 0) return null;
  const map = new Map<string, LineageNode>();
  rows.forEach((r) => {
    map.set(r.post_id, {
      id: r.post_id,
      title: r.title || "Untitled",
      authorHandle: handles[r.creator_id] || "creator",
      xp: 0,
      children: [],
    });
  });
  let root: LineageNode | null = null;
  rows.forEach((r) => {
    const node = map.get(r.post_id)!;
    if (!r.parent_post_id) {
      node.root = true;
      root = node;
    } else {
      const parent = map.get(r.parent_post_id);
      if (parent) parent.children!.push(node);
    }
  });
  return root;
}

export default function Lineage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [root, setRoot] = useState<LineageNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState<string>("Lineage");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      if (!slug) { setLoading(false); return; }
      const { data: post } = await (supabase as any)
        .from("content_items")
        .select("id, title")
        .eq("slug", slug)
        .maybeSingle();
      if (!post) { if (!cancel) { setLoading(false); setRoot(null); } return; }
      if (!cancel) setTitle(post.title || "Lineage");

      const { data: lin } = await (supabase as any)
        .from("post_lineage")
        .select("root_post_id")
        .eq("post_id", post.id)
        .maybeSingle();
      const rootId = lin?.root_post_id || post.id;

      const rows = await getPostLineage(rootId);
      const ids = Array.from(new Set(rows.map((r) => r.creator_id)));
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("id, username")
        .in("id", ids);
      const handles = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.username]));

      const tree = buildTree(rows, handles);
      if (!cancel) { setRoot(tree); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [slug]);

  return (
    <>
      <SeoHead title={`Lineage · ${title}`} description={`Remix lineage tree for ${title}`} path={`/b/${slug}/lineage`} />
      <ShellHeader title={`Lineage · ${title}`} onBack={() => navigate(-1)} />
      <div className="px-6 pb-12 max-w-[720px] mx-auto">
        {loading && <Skeleton className="h-48 w-full" />}
        {!loading && !root && (
          <div className="text-sm text-muted-foreground py-16 text-center">
            No lineage data for this post yet.
          </div>
        )}
        {!loading && root && <LineageTreeView root={root} />}
      </div>
    </>
  );
}

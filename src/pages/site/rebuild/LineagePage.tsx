/* UI-P31 — /b2/:slug/lineage in the site frame: the container.

   The build system's own lineage address (RC-P14 made /b2/:slug/lineage the
   family of rebuilds; the legacy post lineage is long gone from it). This page
   draws that family with the rebuild page's pieces: the Family panel, and for
   the build the reader picks, what changed against the build it was rebuilt
   from — both records read (getBuild), diffed (changeSet), and listed line for
   line (serialiseChangeSet). Nothing is read until a pick is made.

   No Supabase call in this file. The legacy page (`src/pages/Lineage.tsx`) is
   not edited: `FrameRoute` picks one by the `site_frame` flag. */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/brand/Button";
import { useCrumbTitle } from "@/components/shell/useBreadcrumb";
import {
  changeSet,
  flattenFamily,
  getBuild,
  getBuildClocks,
  getBuildFamily,
  getBuildHeaderBySlug,
  type Build,
  type BuildClock,
  type BuildRecord,
  type RebuildTreeNode,
} from "@/lib/build";
import { t } from "@/lib/theme/tokens";

import { LineageView, type LineageSelection } from "./LineageView";
import { RebuildViewFailed, RebuildViewNotice, RebuildViewSkeleton } from "./RebuildView";
import { changeGroups, familyView } from "./rebuildModel";

/** A family does not change while somebody is looking at it. */
const STALE_TIME = 300_000;

export function LineagePage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const header = useQuery<Build | null>({
    queryKey: ["build", "getBuildHeaderBySlug", slug],
    queryFn: () => getBuildHeaderBySlug(slug),
    enabled: Boolean(slug),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const build = header.data ?? null;
  useCrumbTitle(build ? build.title : header.isPending ? null : header.isError ? "Build" : "Not found");

  const rootId = build ? (build.root_build_id ?? build.id) : null;
  const family = useQuery<RebuildTreeNode | null>({
    queryKey: ["build", "getBuildFamily", rootId, build?.id],
    queryFn: () => getBuildFamily({ rootId: rootId as string, currentId: (build as Build).id }),
    enabled: Boolean(build),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const nodes = useMemo(() => flattenFamily(family.data ?? null), [family.data]);
  const ids = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const clocks = useQuery<Map<string, BuildClock>>({
    queryKey: ["build", "getBuildClocks", ids.join(",")],
    queryFn: () => getBuildClocks(ids),
    enabled: ids.length > 0,
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const tree = useMemo(
    () => familyView(family.data ?? null, { clocks: clocks.data, currentId: build?.id ?? null }),
    [family.data, clocks.data, build?.id],
  );

  /* ── the build the reader picked, and the one it was rebuilt from ── */

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const picked = selectedId ? (nodes.find((node) => node.id === selectedId) ?? null) : null;
  const parentId = picked?.parent_build_id ?? null;

  const pickedRecord = useQuery<BuildRecord | null>({
    queryKey: ["build", "getBuild", picked?.id],
    queryFn: () => getBuild((picked as RebuildTreeNode).id),
    enabled: Boolean(picked && parentId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });
  const parentRecord = useQuery<BuildRecord | null>({
    queryKey: ["build", "getBuild", parentId],
    queryFn: () => getBuild(parentId as string),
    enabled: Boolean(picked && parentId),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: false,
  });

  const groups = useMemo(() => {
    const before = parentRecord.data;
    const after = pickedRecord.data;
    return before && after ? changeGroups(before, after, changeSet(before, after)) : null;
  }, [parentRecord.data, pickedRecord.data]);

  /* ── the states ── */

  if (header.isPending && Boolean(slug)) return <RebuildViewSkeleton label="Loading the family" />;

  if (header.isError) {
    return <RebuildViewFailed panel="The family" onRetry={() => void header.refetch()} error={header.error} />;
  }

  if (!build) {
    return (
      <RebuildViewNotice
        line="No build at this address."
        detail={`Nothing is published at /b2/${slug}. It may have been unpublished, or the link may be wrong.`}
        action={
          <Button variant="secondary" size={36} fontSize={13} onClick={() => navigate("/gallery")}>
            See the gallery
          </Button>
        }
      />
    );
  }

  /* ── mapped for the view ── */

  const parentNode = parentId ? nodes.find((node) => node.id === parentId) : undefined;
  const loaded = !pickedRecord.isPending && !parentRecord.isPending;
  const selection: LineageSelection | null = picked
    ? {
        title: (picked.title ?? "").trim() || "Untitled build",
        to: `/b2/${picked.slug}`,
        parentTitle: parentId ? ((parentNode?.title ?? parentRecord.data?.build.title ?? "").trim() || "its source") : null,
        groups,
        loading: Boolean(parentId) && !loaded,
        onRetry: () => {
          void pickedRecord.refetch();
          void parentRecord.refetch();
        },
        error: pickedRecord.error ?? parentRecord.error,
        failed:
          pickedRecord.isError || parentRecord.isError || (Boolean(parentId) && loaded && (!pickedRecord.data || !parentRecord.data)),
      }
    : null;

  const alone = !family.isPending && nodes.length <= 1;

  return (
    <>
      <SeoHead
        title={`The family of ${build.title} — buildgallery`}
        description={`Every published rebuild of ${build.title}, and what each one changed.`}
        path={`/b2/${build.slug}/lineage`}
        noIndex={build.status === "draft"}
      />
      <LineageView
        fit="content"
        title={build.title}
        family={tree}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
        selection={selection}
        alone={alone}
        familyLoading={family.isPending}
        familyFailure={family.isError ? { onRetry: () => void family.refetch(), error: family.error } : undefined}
      />
    </>
  );
}

export default LineagePage;

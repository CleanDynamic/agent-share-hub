/* CA-13 P9 — /b2/:slug/compare/:otherSlug: the container. Reads both builds by slug, refuses a pair that does not share a root in the
   rebuild tree, and hands the view the matched steps, the totals and the difference in words. No Supabase call in this file. */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { useCrumbTitle } from "@/components/shell/useBreadcrumb";
import { differenceSentence, matchSteps, shareRoot, totalsOf, totalsRows, type CompareSide } from "@/lib/build/compare";
import { buildSteps, sessionGroups } from "@/lib/build/graph";
import { getBuildBySlug, type BuildRecord } from "@/lib/build";
import { sessionsMetaOf } from "@/lib/build/making";
import { asMaking } from "@/pages/site/build/buildModel";
import { modelLabel } from "@/lib/models/registry";

import { RebuildViewFailed, RebuildViewNotice, RebuildViewSkeleton } from "@/pages/site/rebuild/RebuildView";

import { CompareView } from "./CompareView";

const STALE_TIME = 300_000;

/** The build as a side: its steps, its sessions and the models they used. */
export function sideOf(record: BuildRecord): CompareSide {
  const steps = buildSteps(record.tree);
  const making = asMaking(record.build.making);
  const groups = sessionGroups(steps, making.sessions, making.session_tools ?? {}, sessionsMetaOf(record.build.making));
  const models = [...groups.map((group) => group.model), ...steps.map((step) => step.model)].filter((name): name is string => Boolean(name)).map((name) => modelLabel(name) || name);
  return { title: (record.build.title ?? "").trim() || "Untitled build", steps, groups, models };
}

export function ComparePage() {
  const { slug = "", otherSlug = "" } = useParams<{ slug: string; otherSlug: string }>();
  const mine = useQuery<BuildRecord | null>({ queryKey: ["build", "getBuildBySlug", slug], queryFn: () => getBuildBySlug(slug), enabled: Boolean(slug), staleTime: STALE_TIME, refetchOnWindowFocus: false });
  const theirs = useQuery<BuildRecord | null>({ queryKey: ["build", "getBuildBySlug", otherSlug], queryFn: () => getBuildBySlug(otherSlug), enabled: Boolean(otherSlug), staleTime: STALE_TIME, refetchOnWindowFocus: false });
  useCrumbTitle(mine.data ? "Compare" : mine.isPending ? null : "Not found");

  const view = useMemo(() => {
    if (!mine.data || !theirs.data) return null;
    const a = sideOf(mine.data);
    const b = sideOf(theirs.data);
    const ta = totalsOf(a);
    const tb = totalsOf(b);
    return { a, b, rows: matchSteps(a.steps, b.steps), totals: totalsRows(ta, tb), sentence: differenceSentence(ta, tb) };
  }, [mine.data, theirs.data]);

  if ((mine.isPending && Boolean(slug)) || (theirs.isPending && Boolean(otherSlug))) return <RebuildViewSkeleton label="Loading the two builds" />;
  if (mine.isError || theirs.isError) return <RebuildViewFailed panel="The comparison" onRetry={() => void Promise.all([mine.refetch(), theirs.refetch()])} error={mine.error ?? theirs.error} />;
  if (!mine.data || !theirs.data) {
    return <RebuildViewNotice line="One of those builds is not here." detail="It may have been unpublished, or the link may be wrong." action={<Link to="/gallery"><Button variant="secondary" size={36} fontSize={13}>See the gallery</Button></Link>} />;
  }
  if (!shareRoot(mine.data.build, theirs.data.build)) {
    return <RebuildViewNotice line="These two are not builds of the same thing." detail="Compare is only offered for builds in the same family of rebuilds." action={<Link to={`/b2/${slug}`}><Button variant="secondary" size={36} fontSize={13}>Back to the build</Button></Link>} />;
  }
  if (!view) return null;
  return <CompareView a={{ title: view.a.title, to: `/b2/${slug}` }} b={{ title: view.b.title, to: `/b2/${otherSlug}` }} rows={view.rows} totals={view.totals} sentence={view.sentence} />;
}

export default ComparePage;

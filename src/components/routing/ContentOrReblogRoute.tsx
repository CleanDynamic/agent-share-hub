"use client";

import { useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import ContentDetail from "@/pages/ContentDetail";

const ReblogDetail = lazy(() => import("@/pages/ReblogDetail"));

interface Props {
  mode?: "detail" | "thread";
}

/**
 * Route switcher for /b/:id and /b/:id/thread.
 * Reblog slugs are prefixed with "reblog-" — branch to ReblogDetail.
 * Everything else falls through to the canonical ContentDetail page.
 */
export default function ContentOrReblogRoute({ mode = "detail" }: Props) {
  const { id } = useParams<{ id: string }>();
  if (id?.startsWith("reblog-")) {
    return (
      <Suspense fallback={<div className="p-8 text-center text-white/50">Loading…</div>}>
        <ReblogDetail mode={mode} />
      </Suspense>
    );
  }
  return <ContentDetail />;
}

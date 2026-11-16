// G4: one component draws loading, failed, empty, not found and ready for every page.
//
// A page hands it its query results (one or several), its skeleton, its empty line and action, its not-found kind and
// way out, and its content as a function (drawn only once the data is there). The page does not draw failure, empty or
// not found itself. ErrorState and EmptyState are the two pieces it draws them with.
//
// THE BOX STAYS (G12). The mark around the state is `display: contents`, so the region's own box (the column, the
// panel) is what the skeleton and the state are laid out in: nothing below moves when one replaces the other.

import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { EmptyState, type EmptyStateAction } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";

import { isRetrying, shownState, type ReadLike, type Shown } from "./pageStateModel";
import { FAILED_PAGE, NOT_FOUND, NOT_FOUND_DETAIL, failedLine, type MissingKind, type Thing, type WayOut } from "./stateCopy";

export interface PageStateProps {
  /** The region's query results: one, or every read the region needs. */
  read: ReadLike | readonly ReadLike[];
  /** What failed, for "Couldn't load <thing>. Try again." */
  thing: Thing;
  /** The region's name for a screen reader, and the log line's prefix. */
  region: string;
  /** The region's own skeleton, drawn while its reads are out. */
  skeleton: ReactNode;
  /** G6: the server answered with nothing. `when` is given every read's data, in order. */
  empty?: { when: (data: unknown[]) => boolean; line: string; action?: EmptyStateAction };
  /** G7: the server answered that what the address names does not exist. */
  notFound?: { when?: (data: unknown[]) => boolean; kind: MissingKind; way: WayOut };
  /** Spacing for the failed, empty and not-found states inside the region. */
  style?: CSSProperties;
  /** The content, drawn only once every read has answered with something to show. */
  children: () => ReactNode;
}

const asList = (read: ReadLike | readonly ReadLike[]): readonly ReadLike[] => (Array.isArray(read) ? read : [read as ReadLike]);

const retryFailed = (reads: readonly ReadLike[]) => {
  for (const read of reads) if (read.status === "error" && read.data === undefined) void read.refetch();
};

function Mark({ state, region, children }: { state: Shown; region: string; children: ReactNode }) {
  return (
    <div data-page-state={state} data-region={region} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

export function PageState({ read, thing, region, skeleton, empty, notFound, style, children }: PageStateProps) {
  const navigate = useNavigate();
  const reads = asList(read);
  const state = shownState(reads, {
    isEmpty: empty?.when,
    isMissing: notFound ? (notFound.when ?? (() => false)) : undefined,
  });

  let body: ReactNode;
  switch (state) {
    case "loading":
      body = skeleton;
      break;
    case "failed": {
      const failure = reads.find((r) => r.status === "error" && r.data === undefined);
      body = (
        <ErrorState
          line={failedLine(thing)}
          panel={region}
          onRetry={() => retryFailed(reads)}
          retrying={isRetrying(reads)}
          error={failure?.error}
          log={`[${region}] read failed`}
          style={style}
        />
      );
      break;
    }
    case "notfound":
      body = notFound ? (
        <EmptyState line={NOT_FOUND} detail={NOT_FOUND_DETAIL[notFound.kind]} action={{ label: notFound.way.label, onClick: () => navigate(notFound.way.to) }} style={style} />
      ) : null;
      break;
    case "empty":
      body = empty ? <EmptyState line={empty.line} action={empty.action} style={style} /> : null;
      break;
    case "ready":
      body = children();
      break;
  }
  return (
    <Mark state={state} region={region}>
      {body}
    </Mark>
  );
}

/** G9: the page-level failed state, for a page whose every region failed. */
export function PageFailed({ reads, region, style }: { reads: readonly ReadLike[]; region: string; style?: CSSProperties }) {
  const failure = reads.find((r) => r.status === "error" && r.data === undefined);
  return (
    <Mark state="failed" region={region}>
      <ErrorState line={FAILED_PAGE} panel={region} onRetry={() => retryFailed(reads)} retrying={isRetrying(reads)} error={failure?.error} log={`[${region}] read failed`} style={style} />
    </Mark>
  );
}

export default PageState;

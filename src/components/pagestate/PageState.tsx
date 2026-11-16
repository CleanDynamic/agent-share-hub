// G4: one component draws loading, failed, empty, not found and ready for every page.
//
// A page hands it its query results (one or several), its skeleton, its empty line and action, its not-found kind and
// way out, and its content as a function (drawn only once the data is there). The page does not draw failure, empty or
// not found itself. ErrorState and EmptyState are the two pieces it draws them with.
//
// THE BOX STAYS (G12). The mark around the state is `display: contents`, so the region's own box (the column, the
// panel) is what the skeleton and the state are laid out in: nothing below moves when one replaces the other.

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { EmptyState, type EmptyStateAction } from "@/components/brand/EmptyState";
import { ErrorState } from "@/components/brand/ErrorState";
import { errorLine } from "@/lib/errors/code";

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
  empty?: { when: (data: unknown[]) => boolean; line: string; action?: EmptyStateAction; testId?: string };
  /** G7: the server answered that what the address names does not exist. */
  notFound?: { when?: (data: unknown[]) => boolean; kind: MissingKind; way: WayOut };
  /** The console line's prefix for a failure, "[Drafts] drafts read failed"; `[<region>] read failed` when not given. */
  log?: string;
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

export function PageState({ read, thing, region, skeleton, empty, notFound, log, style, children }: PageStateProps) {
  const navigate = useNavigate();
  const reads = asList(read);
  useLogEach(reads, reads.map(() => log ?? `[${region}] read failed`));
  const state = shownState(reads, {
    isEmpty: empty?.when,
    isMissing: notFound ? (notFound.when ?? (() => false)) : undefined,
  });

  let body: ReactNode;
  switch (state) {
    case "loading":
      body = skeleton;
      break;
    case "failed":
      body = <ErrorState line={failedLine(thing)} panel={region} onRetry={() => retryFailed(reads)} retrying={isRetrying(reads)} style={style} />;
      break;
    case "notfound":
      body = notFound ? (
        <EmptyState line={NOT_FOUND} detail={NOT_FOUND_DETAIL[notFound.kind]} action={{ label: notFound.way.label, onClick: () => navigate(notFound.way.to) }} style={style} />
      ) : null;
      break;
    case "empty":
      body = empty ? <EmptyState line={empty.line} action={empty.action} style={style} data-testid={empty.testId} /> : null;
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

/** Every failure logged so far, by the region that showed it or the page-level state that replaced it: once each. */
const LOGGED = new WeakSet<object>();

/** Each read's failure logged once, as one line with its code (G10), however often the page re-renders. */
function useLogEach(reads: readonly ReadLike[], logs: readonly string[]) {
  useEffect(() => {
    reads.forEach((read, at) => {
      const error = read.status === "error" && read.data === undefined ? read.error : undefined;
      if (!error || typeof error !== "object" || LOGGED.has(error)) return;
      LOGGED.add(error);
      // eslint-disable-next-line no-console -- the one structured log of a read that did not load (G10)
      console.error(errorLine(logs[at] ?? "[page] read failed", error));
    });
  });
}

/** G9: the page-level failed state, for a page whose every region failed. `logs` gives each read's log prefix, in order. */
export function PageFailed({ reads, region, logs = [], style }: { reads: readonly ReadLike[]; region: string; logs?: readonly string[]; style?: CSSProperties }) {
  useLogEach(reads, logs.length ? logs : reads.map(() => `[${region}] read failed`));
  return (
    <Mark state="failed" region={region}>
      <ErrorState line={FAILED_PAGE} panel={region} onRetry={() => retryFailed(reads)} retrying={isRetrying(reads)} style={style} />
    </Mark>
  );
}

export default PageState;

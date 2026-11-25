// G4: one component draws loading, failed, empty, not found and ready for every page.
//
// A page hands it its query results (one or several), its skeleton, its empty line and action, its not-found kind and
// way out, and its content as a function (drawn only once the data is there). The page does not draw failure, empty or
// not found itself. ErrorState and EmptyState are the two pieces it draws them with.
//
// THE BOX STAYS (G12). The mark around the state is `display: contents`, so the region's own box (the column, the
// panel) is what the skeleton and the state are laid out in: nothing below moves when one replaces the other.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { EmptyState, type EmptyStateAction } from "@/components/brand/EmptyState";
import { PhoneEmpty } from "@/components/phone/PhoneEmpty";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ErrorState, type ErrorStateProps } from "@/components/brand/ErrorState";
import { errorLine } from "@/lib/errors/code";

import { useSessionPhase } from "./useSessionPhase";
import { isRetrying, shownState, type ReadLike, type Shown } from "./pageStateModel";
import { FAILED_PAGE, NOT_FOUND, NOT_FOUND_DETAIL, failedLine, type MissingKind, type Thing, type WayOut } from "@/lib/copy/copy";

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
  /** `phoneList`: a whole list's empty state, drawn on a phone as the drop on still water (`PhoneEmpty`, mobile 28 G). */
  empty?: { when: (data: unknown[]) => boolean; line: string; action?: EmptyStateAction; testId?: string; phoneList?: boolean; detail?: string };
  /** G7: the server answered that what the address names does not exist. */
  notFound?: { when?: (data: unknown[]) => boolean; kind: MissingKind; way: WayOut };
  /** The console line's prefix for a failure, "[Drafts] drafts read failed"; `[<region>] read failed` when not given. */
  log?: string;
  /**
   * The region's own frame (a section and its heading) around every state but loading: the skeleton stands in for the whole
   * region while it loads, as the region's placeholder always has, and the other states sit under the region's heading.
   */
  frame?: (body: ReactNode) => ReactNode;
  /** Whether the frame also wraps the content once ready: false where the content draws its own frame (Settings' views). */
  frameReady?: boolean;
  /** Spacing for the failed, empty and not-found states inside the region. */
  style?: CSSProperties;
  /** The content, drawn only once every read has answered with something to show. */
  children: () => ReactNode;
}

const asList = (read: ReadLike | readonly ReadLike[]): readonly ReadLike[] => (Array.isArray(read) ? read : [read as ReadLike]);

const retryFailed = (reads: readonly ReadLike[]) => {
  for (const read of reads) if (read.status === "error" && read.data === undefined) void read.refetch();
};

function Mark({ state, region, children, markRef }: { state: Shown; region: string; children: ReactNode; markRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={markRef} data-page-state={state} data-region={region} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

/**
 * G12: the height the skeleton took, measured while it is on screen (the mark is `display: contents`, so its children's boxes
 * are what is measured), so the state that replaces it can keep that box and nothing below moves.
 */
function useSkeletonHeight(state: Shown): { markRef: React.RefObject<HTMLDivElement>; height: number | null } {
  const markRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  // Measured when the skeleton goes up and again whenever its boxes change size (fonts, the column settling).
  useLayoutEffect(() => {
    const mark = markRef.current;
    if (state !== "loading" || !mark) return;
    const measure = () => {
      const boxes = Array.from(mark.children).map((child) => child.getBoundingClientRect()).filter((box) => box.height > 0);
      if (boxes.length === 0) return;
      const measured = Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top));
      if (measured > 0) setHeight((kept) => (kept === measured ? kept : measured));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(measure);
    for (const child of Array.from(mark.children)) watch.observe(child);
    return () => watch.disconnect();
  }, [state]);
  return { markRef, height };
}

export function PageState({ read, thing, region, skeleton, empty, notFound, log, frame, frameReady = true, style, children }: PageStateProps) {
  const reads = asList(read);
  const phone = useIsPhone();
  // G18: drawn again when the session's phase moves (shownState reads it).
  const phase = useSessionPhase();
  useLogEach(phase === "live" ? reads : [], reads.map(() => log ?? `[${region}] read failed`));
  const state = shownState(reads, {
    isEmpty: empty?.when,
    isMissing: notFound ? (notFound.when ?? (() => false)) : undefined,
  });
  const { markRef, height } = useSkeletonHeight(state);

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
        <EmptyState line={NOT_FOUND} detail={NOT_FOUND_DETAIL[notFound.kind]} action={{ label: notFound.way.label, href: notFound.way.to }} style={style} />
      ) : null;
      break;
    case "empty":
      body = empty ? (
        empty.phoneList && phone ? (
          <PhoneEmpty line={empty.line} detail={empty.detail} action={empty.action ?? null} data-testid={empty.testId} />
        ) : (
          <EmptyState line={empty.line} action={empty.action} style={style} data-testid={empty.testId} />
        )
      ) : null;
      break;
    case "ready":
      body = children();
      break;
  }
  const drawn = frame && state !== "loading" && (frameReady || state !== "ready") ? frame(body) : body;
  /* G12: failed, empty and not found keep the box the skeleton had (with the frame, when the skeleton stood in for it), so
     nothing below them moves. */
  const kept = height !== null && (state === "failed" || state === "empty" || state === "notfound") ? <div style={{ minHeight: height }}>{drawn}</div> : drawn;
  return (
    <Mark state={state} region={region} markRef={markRef}>
      {kept}
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

/**
 * G6: the empty state of a part of data that has already loaded (a build with no parts, a timeline with no events): one
 * sentence and at most one action, the same EmptyState PageState draws. Pages use this, never EmptyState itself (G30).
 */
export function PageEmpty({ line, action, style, testId, phoneList = false, detail }: { line: string; action?: EmptyStateAction; style?: CSSProperties; testId?: string; phoneList?: boolean; detail?: string }) {
  const phone = useIsPhone();
  return (
    <Mark state="empty" region={testId ?? "empty"}>
      {phoneList && phone ? <PhoneEmpty line={line} detail={detail} action={action ?? null} data-testid={testId} /> : <EmptyState line={line} detail={detail} action={action} style={style} data-testid={testId} />}
    </Mark>
  );
}

/**
 * A write that the server refused, said where its result was shown: ErrorState exactly as the page drew it before (its own
 * sentence, "That didn't save.", its panel name, Try again and its retry). Moved here only so that no page imports ErrorState
 * itself (G30); its wording is prompt 9's.
 */
export function WriteFailed(props: ErrorStateProps) {
  return <ErrorState {...props} />;
}

export type { EmptyStateAction } from "@/components/brand/EmptyState";
export type { PanelFailure } from "@/components/brand/ErrorState";

export default PageState;

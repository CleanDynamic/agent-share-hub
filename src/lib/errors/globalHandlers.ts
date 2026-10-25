import { reportError } from "@/lib/errors/report";

/** The browser's own notice that a resize did not settle in one frame; it is not a fault in the page. */
const BROWSER_NOISE = /ResizeObserver loop/;

/**
 * Report what nothing else caught: an uncaught error and an unhandled promise
 * rejection. An error from a file outside this origin (a browser extension) is
 * not ours. Returns the function that stops listening.
 */
export function installGlobalErrorReporting(target: Window): () => void {
  const onError = (event: ErrorEvent) => {
    if (BROWSER_NOISE.test(event.message ?? "")) return;
    if (event.filename && !event.filename.startsWith(target.location.origin)) return;
    reportError(event.error ?? new Error("window.error"), { source: "window.error", route: target.location.pathname });
  };
  const onRejection = (event: Event) => {
    reportError((event as PromiseRejectionEvent).reason, { source: "unhandledrejection", route: target.location.pathname });
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}

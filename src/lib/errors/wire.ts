// The places errors are caught, joined to reportError. SV-01 Part 7.

import type { Mutation, Query } from "@tanstack/react-query";
import { reportError } from "./report";

const route = (): string => (typeof window === "undefined" ? "" : window.location.pathname);
const label = (key: readonly unknown[] | undefined): string | undefined => (typeof key?.[0] === "string" ? key[0] : undefined);

/** The handlers App.tsx gives the query client's caches, and the window listeners. */
export function connectErrorReporting() {
  return {
    /** QueryCache.onError: once per query that has given up. */
    queryError(error: unknown, query: Query<unknown, unknown, unknown, readonly unknown[]>) {
      reportError(error, { source: "query", route: route(), context: label(query.queryKey) });
    },
    /** MutationCache.onError. */
    mutationError(error: unknown, _variables: unknown, _result: unknown, mutation: Mutation<unknown, unknown, unknown, unknown>) {
      reportError(error, { source: "mutation", route: route(), context: label(mutation.options.mutationKey) });
    },
    /** `error` and `unhandledrejection` on the window. Returns the function that stops listening. */
    listen(target: Window): () => void {
      const onError = (event: ErrorEvent) => reportError(event.error ?? event.message, { source: "window", route: route() });
      const onRejection = (event: Event) => reportError((event as PromiseRejectionEvent).reason, { source: "unhandledrejection", route: route() });
      target.addEventListener("error", onError);
      target.addEventListener("unhandledrejection", onRejection);
      return () => {
        target.removeEventListener("error", onError);
        target.removeEventListener("unhandledrejection", onRejection);
      };
    },
  };
}

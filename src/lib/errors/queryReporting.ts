import { MutationCache, QueryCache } from "@tanstack/react-query";

import { reportError } from "@/lib/errors/report";

/** The domain and function a key names (`['builds', 'listBuilds', ...args]`); the rest of the key can hold ids and text. */
const keyOf = (key: readonly unknown[] | undefined): string | undefined => {
  const named = (key ?? []).slice(0, 2).filter((part): part is string => typeof part === "string");
  return named.length > 0 ? named.join("/") : undefined;
};

/**
 * The query client's two caches, each telling `reportError` when a query or a
 * mutation fails. `onError` on a cache runs once per failure, after any retries,
 * however many components read the query.
 */
export function reportingCaches() {
  return {
    queryCache: new QueryCache({
      onError: (error, query) => {
        const key = keyOf(query.queryKey);
        reportError(error, { source: "query", ...(key ? { key } : {}), route: window.location.pathname });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _onMutateResult, mutation) => {
        const key = keyOf(mutation.options.mutationKey);
        reportError(error, { source: "mutation", ...(key ? { key } : {}), route: window.location.pathname });
      },
    }),
  };
}

// The query key of the composer's build record, in a module of its own.
//
// ComposeRoute reads that cache entry to choose which composer an address
// opens, and App.tsx imports ComposeRoute eagerly. Importing the key from
// useComposeBuild put that hook, and through it the whole `@/lib/build` barrel,
// into every visitor's first download. useComposeBuild re-exports it, so its
// other importers are unchanged.
export function composeBuildQueryKey(buildId: string | undefined) {
  return ["compose-build", buildId] as const;
}

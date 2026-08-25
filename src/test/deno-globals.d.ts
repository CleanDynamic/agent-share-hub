// The Deno globals the edge-function modules that tests import rely on.
//
// Five modules under supabase/functions/ are imported directly by suites in
// src/ — the point being that the server's parser and the client's expectations
// of it are checked against the same code rather than two copies of it. Those
// modules run on Deno in production, so they reach for Deno globals that the
// app's own program has never heard of:
//
//   supabase/functions/parse-repo/github.ts
//     error TS2304: Cannot find name 'Deno'.
//
// Adding supabase/functions to tsconfig's `include` would pull the whole Deno
// tree — HTTP servers, npm: and jsr: specifiers, import maps — into a program
// configured for a browser bundle. Declaring the one surface those modules
// touch is the smaller thing.
//
// Deliberately minimal: only `env.get`, and only because github.ts reads an
// optional GITHUB_TOKEN through it. Anything the app itself tried to do with
// Deno would still fail to compile, which is the intent — this is a shim for
// the modules that cross the boundary, not permission for new ones.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

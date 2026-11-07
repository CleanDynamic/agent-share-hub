// Deno test for delete-my-account's steps, on a seeded fake account (UX-15 P6). Run: deno test supabase/functions/delete-my-account/core.test.ts
// The same scenario runs under Vitest in src/test/security/ux15Delete.test.ts (Deno is not installed in every session).

import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { deleteAccount, DeleteStopped, type DeleteDeps } from "./core.ts";

function seeded() {
  const state = {
    files: [
      { bucket: "avatars", name: "u1/a.png" },
      { bucket: "build-media", name: "u1/b.mp4" },
      { bucket: "dm-images", name: "t9/c.jpg" },
    ],
    rows: { builds: 3, replies: 2, follows: 4 },
    authUser: true,
    log: { requested: 0, completed: 0 },
  };
  const deps: DeleteDeps = {
    userId: "u1",
    typed: "Ava",
    usernameOf: () => Promise.resolve("ava"),
    logRequested: () => { state.log.requested++; return Promise.resolve(); },
    listObjects: () => Promise.resolve([...state.files]),
    removeObjects: (bucket, names) => { state.files = state.files.filter((f) => !(f.bucket === bucket && names.includes(f.name))); return Promise.resolve(); },
    deleteRows: () => { state.rows = { builds: 0, replies: 0, follows: 0 }; return Promise.resolve(); },
    deleteAuthUser: () => { state.authUser = false; return Promise.resolve(true); },
    logCompleted: () => { state.log.completed++; return Promise.resolve(); },
  };
  return { state, deps };
}

Deno.test("deletes files, rows and the user, and writes the log", async () => {
  const { state, deps } = seeded();
  const result = await deleteAccount(deps);
  assertEquals(result.filesRemoved, 3);
  assertEquals(state.files, []);
  assertEquals(state.rows, { builds: 0, replies: 0, follows: 0 });
  assertEquals(state.authUser, false);
  assertEquals(state.log, { requested: 1, completed: 1 });
});

Deno.test("a second run finds nothing left and still succeeds", async () => {
  const { state, deps } = seeded();
  await deleteAccount(deps);
  state.files = [];
  const again = await deleteAccount({ ...deps, listObjects: () => Promise.resolve([]) });
  assertEquals(again.filesRemoved, 0);
});

Deno.test("refuses without the right username and touches nothing", async () => {
  const { state, deps } = seeded();
  const error = await assertRejects(() => deleteAccount({ ...deps, typed: "bob" }), DeleteStopped);
  assert(error instanceof DeleteStopped && error.step === "check");
  assertEquals(state.authUser, true);
  assertEquals(state.log.requested, 0);
});

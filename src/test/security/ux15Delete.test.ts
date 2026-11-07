// UX-15 P6: delete-my-account's steps on a seeded fake account. The same scenarios as supabase/functions/delete-my-account/core.test.ts
// (the Deno test), run here because Deno is not in every session.

import { describe, expect, it } from "vitest";

import { deleteAccount, DeleteStopped, type DeleteDeps } from "../../../supabase/functions/delete-my-account/core";

function seeded(over: Partial<DeleteDeps> = {}) {
  const state = {
    files: [
      { bucket: "avatars", name: "u1/a.png" },
      { bucket: "build-media", name: "u1/b.mp4" },
      { bucket: "dm-images", name: "t9/c.jpg" },
    ],
    rows: { builds: 3, replies: 2, follows: 4 },
    authUser: true,
    log: { requested: 0, completed: 0 },
    order: [] as string[],
  };
  const deps: DeleteDeps = {
    userId: "u1",
    typed: "Ava",
    usernameOf: async () => "ava",
    logRequested: async () => {
      state.log.requested++;
      state.order.push("log");
    },
    listObjects: async () => [...state.files],
    removeObjects: async (bucket, names) => {
      state.files = state.files.filter((f) => !(f.bucket === bucket && names.includes(f.name)));
      state.order.push("storage");
    },
    deleteRows: async () => {
      state.rows = { builds: 0, replies: 0, follows: 0 };
      state.order.push("rows");
    },
    deleteAuthUser: async () => {
      state.authUser = false;
      state.order.push("auth");
      return true;
    },
    logCompleted: async () => {
      state.log.completed++;
      state.order.push("done");
    },
    ...over,
  };
  return { state, deps };
}

describe("delete-my-account", () => {
  it("removes the files, the rows and the sign-in, and writes the log, in that order", async () => {
    const { state, deps } = seeded();
    const result = await deleteAccount(deps);
    expect(result.filesRemoved).toBe(3);
    expect(state.files).toEqual([]);
    expect(state.rows).toEqual({ builds: 0, replies: 0, follows: 0 });
    expect(state.authUser).toBe(false);
    expect(state.log).toEqual({ requested: 1, completed: 1 });
    expect(state.order[0]).toBe("log");
    expect(state.order.indexOf("rows")).toBeGreaterThan(state.order.lastIndexOf("storage"));
    expect(state.order.indexOf("auth")).toBeGreaterThan(state.order.indexOf("rows"));
    expect(state.order.at(-1)).toBe("done");
  });

  it("a second run finds nothing left and succeeds", async () => {
    const { state, deps } = seeded();
    await deleteAccount(deps);
    const again = await deleteAccount(deps);
    expect(again.filesRemoved).toBe(0);
    expect(state.log.completed).toBe(2);
  });

  it("removes more than one round of files", async () => {
    const many = Array.from({ length: 2500 }, (_, i) => ({ bucket: "build-media", name: `u1/${i}.png` }));
    const { state, deps } = seeded();
    state.files = many;
    // the real list returns at most a thousand at a time
    deps.listObjects = async () => state.files.slice(0, 1000);
    const result = await deleteAccount(deps);
    expect(result.filesRemoved).toBe(2500);
    expect(state.files).toHaveLength(0);
  });

  it("refuses without the right username and touches nothing", async () => {
    const { state, deps } = seeded({ typed: "bob" });
    await expect(deleteAccount(deps)).rejects.toMatchObject({ name: "DeleteStopped", step: "check" });
    expect(state.authUser).toBe(true);
    expect(state.log.requested).toBe(0);
    expect(state.files).toHaveLength(3);
  });

  it("accepts the username in any case, and with spaces round it", async () => {
    const { state, deps } = seeded({ typed: "  AVA " });
    await deleteAccount(deps);
    expect(state.authUser).toBe(false);
  });

  it("stops at the step that failed, names it, and a retry carries on", async () => {
    let fail = true;
    const { state, deps } = seeded({
      deleteRows: async () => {
        if (fail) throw new Error("boom");
      },
    });
    const error = await deleteAccount(deps).catch((e) => e);
    expect(error).toBeInstanceOf(DeleteStopped);
    expect((error as DeleteStopped).step).toBe("rows");
    expect(state.authUser).toBe(true);
    expect(state.log.completed).toBe(0);
    fail = false;
    await deleteAccount(deps);
    expect(state.authUser).toBe(false);
    expect(state.log.completed).toBe(1);
  });
});

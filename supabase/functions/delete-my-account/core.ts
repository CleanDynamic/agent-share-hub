// UX-15 P6: deleting an account, as a list of steps that are each safe to run again. Pure TypeScript: the function hands it the real
// service-role calls, a test hands it a fake.
//
// THE ORDER, and why each step can be repeated:
//   1. write the request to account_deletions   an upsert on user_id; the first requested_at is kept
//   2. delete the person's files, bucket by bucket   asks storage what is left, removes it, asks again; nothing left is a step done
//   3. delete or replace their rows             delete_account_rows(uid): topics deleted, replies replaced by "This reply was removed",
//                                                every other row that would stop step 4 deleted or cleared; nothing left is nothing to do
//   4. delete the auth user                     a user that is already gone is a step done (its rows went with it)
//   5. write completed_at                       an update; again is the same time
// A failure at any step stops there and says which. The same call again carries on from where the data stands.

export interface DeleteDeps {
  /** The verified user id: from the token, never from the body. */
  userId: string;
  /** The username the person typed, and the one the profile has: the server checks them as the page did. */
  typed: string;
  usernameOf(userId: string): Promise<string | null>;
  logRequested(userId: string): Promise<void>;
  /** Up to a thousand files the person uploaded that are still there. */
  listObjects(userId: string): Promise<{ bucket: string; name: string }[]>;
  removeObjects(bucket: string, names: string[]): Promise<void>;
  deleteRows(userId: string): Promise<void>;
  /** True when the user was deleted now or was already gone. */
  deleteAuthUser(userId: string): Promise<boolean>;
  logCompleted(userId: string): Promise<void>;
}

export type DeleteStep = "check" | "log" | "storage" | "rows" | "auth" | "done";

export class DeleteStopped extends Error {
  constructor(readonly step: DeleteStep, message: string) {
    super(message);
    this.name = "DeleteStopped";
  }
}

/** The most rounds of "list, remove" before the step gives up (a thousand files a round). */
const MAX_ROUNDS = 200;

export async function deleteAccount(deps: DeleteDeps): Promise<{ filesRemoved: number }> {
  // The page asks the person to type their username; the server holds them to it.
  const username = await deps.usernameOf(deps.userId).catch(() => null);
  if (username === null || deps.typed.trim().toLowerCase() !== username.toLowerCase()) {
    throw new DeleteStopped("check", "Type your username to confirm.");
  }

  const run = async <T>(step: DeleteStep, work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      throw new DeleteStopped(step, error instanceof Error ? error.message : "failed");
    }
  };

  await run("log", () => deps.logRequested(deps.userId));

  let filesRemoved = 0;
  await run("storage", async () => {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const objects = await deps.listObjects(deps.userId);
      if (objects.length === 0) return;
      const byBucket = new Map<string, string[]>();
      for (const object of objects) byBucket.set(object.bucket, [...(byBucket.get(object.bucket) ?? []), object.name]);
      for (const [bucket, names] of byBucket) {
        await deps.removeObjects(bucket, names);
        filesRemoved += names.length;
      }
    }
    throw new Error("more files than one call can remove; call again");
  });

  await run("rows", () => deps.deleteRows(deps.userId));
  await run("auth", () => deps.deleteAuthUser(deps.userId));
  await run("done", () => deps.logCompleted(deps.userId));
  return { filesRemoved };
}
